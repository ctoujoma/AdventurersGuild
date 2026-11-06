/**
 * El fondo con «luz con ambiente» (fase 4 del plan de luz, ver `docs/plan-luz.md`): montes
 * grandes con nieve, la cara al sol y la de sombra separadas por el espinazo, surcos a lo largo
 * de la ladera y bruma que crece hacia el pie (perspectiva atmosférica); el cielo, en bandas de
 * borde mellado en vez de tramado; y las capas de delante, algo más apagadas por la bruma
 * cuanto más lejos. Sale de la prueba A (`tools/estilo/paisaje.py`).
 */
import { PixelBuffer, rgba } from '../../art/pixel';
import { GROUND } from '../geometry';
import { LAYER_W, ridgeAt, type Tree } from '../parallax';
import { oakCnc, pineCnc } from './arboles';

type RGB = [number, number, number];

const hex = (s: string): RGB => {
  const v = parseInt(s.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const pack = (c: RGB): number =>
  ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
const mixc = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Color de una rampa por tramos (sin degradado dentro de cada tramo). */
const ramp = (cols: RGB[], t: number): RGB =>
  cols[Math.min(cols.length - 1, Math.floor(clamp01(t) * cols.length * 0.9999))]!;

// ---------- Ruido de valores (determinista) ----------

const h2 = (x: number, y: number, s: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 982451653, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 10007) / 10007;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
function value(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const a = h2(xi, yi, s);
  const b = h2(xi + 1, yi, s);
  const c = h2(xi, yi + 1, s);
  const d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Ruido fractal en 0–1: `sx` y `sy`, el tamaño de los grumos más grandes. */
export function fbm(x: number, y: number, sx: number, sy: number, s: number, oct = 3): number {
  let v = 0;
  let amp = 0.5;
  let tot = 0;
  for (let o = 0; o < oct; o++) {
    const f = 1 << o;
    v += value((x / sx) * f, (y / sy) * f, s + o * 31) * amp;
    tot += amp;
    amp *= 0.5;
  }
  return v / tot;
}

/**
 * El mismo ruido, pero periódico a lo ancho de la capa (`LAYER_W`): al final se funde con lo
 * que hay antes del principio, para que la capa se repita sin junta.
 */
function fbmW(x: number, y: number, sx: number, sy: number, s: number, oct = 3): number {
  const v = fbm(x, y, sx, sy, s, oct);
  const k = (x - (LAYER_W - 64)) / 64;
  return k <= 0 ? v : v + (fbm(x - LAYER_W, y, sx, sy, s, oct) - v) * smooth(Math.min(1, k));
}

// ---------- Colores ----------

interface Tones {
  mount: RGB[];
  snow: RGB[];
  haze: RGB;
}
/** De día: azul grisáceo, nieve casi blanca y la bruma del color del horizonte. */
const DAY: Tones = {
  mount: ['#4c5a85', '#6a7aa3', '#8d9cc0', '#b7c3dc'].map(hex),
  snow: ['#9aa9cc', '#c9d4ea', '#f1f5fb'].map(hex),
  haze: hex('#b4d2ea'),
};
/** De noche (luego se oscurece y azulea más en `Sky`): siluetas con la nieve a la luna. */
const NIGHT: Tones = {
  mount: ['#222a48', '#2c375a', '#3a4670', '#4c5a84'].map(hex),
  snow: ['#4a5a88', '#6a7cac', '#97a8d2'].map(hex),
  haze: hex('#323f68'),
};

/** Al ponerse (y al salir) el sol: la nieve rosa y naranja, la bruma cálida. */
const DUSK: Tones = {
  mount: ['#3f3a5e', '#5d4d72', '#86637f', '#b48288'].map(hex),
  snow: ['#8a7398', '#e0a29a', '#ffd3a2'].map(hex),
  haze: hex('#d99482'),
};

// ---------- Montes ----------

/**
 * Una cresta repetible a lo ancho de la capa: al final se funde con la de antes del principio.
 */
const periodic = (f: (x: number) => number) => (x: number) => {
  const k = (x - (LAYER_W - 96)) / 96;
  return k <= 0 ? f(x) : f(x) + (f(x - LAYER_W) - f(x)) * smooth(Math.min(1, k));
};

/**
 * Las dos sierras, con la forma de las de siempre (`ridgeAt`: cumbres de tres tamaños sobre una
 * base común, collados y la cresta mellada): delante, la de siempre; detrás, otra más alta y con
 * más bruma, desplazada para que sus cumbres no coincidan.
 */
const RANGES = [
  {
    ridge: periodic((x) => 244 - (244 - ridgeAt(x * 0.8 + 517)) * 1.3 - 8),
    hz: 0.26,
    seed: 1,
  },
  { ridge: periodic((x) => ridgeAt(x)), hz: 0.06, seed: 2 },
];

export interface MountainSet {
  /** De día, con el sol por la derecha (mañana) y por la izquierda (tarde); y de noche. */
  right: PixelBuffer;
  left: PixelBuffer;
  night: PixelBuffer;
  /** Al atardecer (luz por la izquierda) y al alba (por la derecha). */
  dusk: PixelBuffer;
  dawn: PixelBuffer;
}

/** Las dos sierras, en una pasada: las cinco versiones tienen la misma silueta y se funden. */
export function mountainsCnc(): MountainSet {
  const W = LAYER_W;
  const H = GROUND + 4;
  const set = {
    right: new PixelBuffer(W, H),
    left: new PixelBuffer(W, H),
    night: new PixelBuffer(W, H),
    dusk: new PixelBuffer(W, H),
    dawn: new PixelBuffer(W, H),
  };
  for (const R of RANGES) {
    const top = new Float32Array(W + 64);
    for (let x = -32; x < W + 32; x++) top[x + 32] = R.ridge(((x % W) + W) % W);
    const ridge = (x: number) => top[Math.max(0, Math.min(W + 63, Math.round(x) + 32))]!;
    for (let x = 0; x < W; x++) {
      const y0 = Math.max(0, Math.ceil(ridge(x)));
      for (let y = y0; y < H; y++) {
        const d = y - ridge(x);
        // La cara: hacia dónde baja la cresta cerca de aquí (cuanto más abajo, más ancho se
        // mira: las caras grandes del monte), con el espinazo serpenteando.
        const r = 2 + d * 0.55;
        const xs = x + (fbmW(x, y, 9, 9, R.seed + 3, 2) - 0.5) * Math.min(d, 30) * 0.5;
        const slope = ridge(xs + r) - ridge(xs - r);
        // slope > 0: la cresta baja hacia la derecha, la cara mira a la derecha.
        const right = slope > 0;
        // Surcos a lo largo de la ladera (en diagonal, bajando hacia fuera).
        const u = x - (right ? 1 : -1) * d * 0.9;
        const g = fbmW(u, 0, 5, 1, R.seed + 11) * 0.7 + fbmW(x, y, 3, 12, R.seed + 13, 2) * 0.3;
        const sub = fbmW(x, y, 14, 14, R.seed + 17, 2) - 0.5;
        // La nieve, por encima de una línea que sube y baja; con calvas de roca.
        const snowline = 186 + (fbmW(x, 0, 24, 1, R.seed + 5) - 0.5) * 22 + (g - 0.5) * 18;
        const snowy = y < snowline && !(g < 0.3 && d > 5);
        // La bruma, más hacia el pie y en la sierra de atrás.
        const amt = Math.min(
          0.92,
          Math.max(
            0,
            clamp01((y - 196) / 70) * 0.65 + R.hz + (fbmW(x, y, 50, 6, R.seed + 19, 2) - 0.5) * 0.2,
          ),
        );
        // Lo más llano (la cresta de un collado), con la luz de arriba.
        const flat = Math.abs(slope) < r * 0.15;
        const paint = (t: Tones, lit: boolean) => {
          const l = flat ? 0.5 : lit ? 0.68 : 0.28;
          const c = snowy
            ? ramp(t.snow, l + 0.12 + (g - 0.5) * 0.35)
            : ramp(t.mount, l + (g - 0.5) * 0.5 + sub * 0.25);
          return pack(mixc(c, t.haze, amt));
        };
        const i = y * W + x;
        set.right.data[i] = paint(DAY, right);
        set.left.data[i] = paint(DAY, !right);
        set.night.data[i] = paint(NIGHT, !right);
        set.dusk.data[i] = paint(DUSK, !right);
        set.dawn.data[i] = paint(DUSK, right);
      }
    }
  }
  return set;
}

// ---------- Cielo y bruma ----------

/**
 * Tira de cielo de `w` de ancho (se repite a lo ancho): las bandas de `bands` de `y0` a `y1`,
 * cada una con el borde mellado en grumos de 2 píxeles (no tramado).
 */
export function skyStripCnc(
  bands: readonly string[],
  w: number,
  h: number,
  y0: number,
  y1: number,
): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const n = bands.length - 1;
  const cols = bands.map(rgba);
  for (let x = 0; x < w; x++) {
    // Ondula suave a lo ancho (periódico en `w`) y se mella de 2 en 2.
    const wave = Math.sin((x / w) * Math.PI * 2) * 1.5 + Math.sin((x / w) * Math.PI * 6 + 1) * 1;
    for (let y = 0; y < h; y++) {
      const jag = (h2(x >> 1, y >> 1, 77) - 0.5) * 3 + wave;
      const u = clamp01((y + jag - y0) / (y1 - y0));
      b.data[y * w + x] = cols[Math.min(n, Math.round(u ** 1.6 * n))]!;
    }
  }
  return b;
}

/**
 * Una capa de día pasada por la bruma: el color se acerca al de la bruma (`amt`) y se apaga
 * algo (los colores vivos de Endesga, menos saturados).
 */
export function hazed(src: PixelBuffer, amt: number, desat = 0.25): PixelBuffer {
  const b = src.clone();
  const hz = DAY.haze;
  for (let i = 0; i < b.data.length; i++) {
    const c = b.data[i]!;
    if (!(c >>> 24)) continue;
    const rgb: RGB = [c & 255, (c >> 8) & 255, (c >> 16) & 255];
    const l = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    const m = mixc(mixc(rgb, [l, l, l], desat), hz, amt);
    b.data[i] = pack(m);
  }
  return b;
}

// ---------- Bosque lejano ----------

/** El bosque lejano, entre los montes y las colinas: se mueve algo más que los montes. */
export const FAR_FOREST_FX = 0.235;

/**
 * Una franja de abetos pequeños por pisos, apagados por la bruma (de día) o casi negros (de
 * noche), con la misma silueta. Se repite sin junta.
 */
export function farForestCnc(): { day: PixelBuffer; night: PixelBuffer } {
  const W = LAYER_W;
  const H = GROUND + 4;
  const day = new PixelBuffer(W, H);
  const night = new PixelBuffer(W, H);
  const DAYC = ['#3e5a5a', '#4f6d66', '#678274', '#83977f'].map(hex);
  const NIGHTC = ['#151d33', '#1a2440', '#212c4a', '#2a3656'].map(hex);
  const put = (x: number, y: number, v: number, hz: number) => {
    const xi = ((Math.round(x) % W) + W) % W;
    if (y < 0 || y >= H) return;
    const i = y * W + xi;
    day.data[i] = pack(mixc(ramp(DAYC, v), DAY.haze, hz));
    night.data[i] = pack(mixc(ramp(NIGHTC, v), NIGHT.haze, hz * 0.6));
  };
  const ridge = (x: number) => GROUND - 70 - fbmW(x, 0, 60, 1, 41) * 12;
  // Filas de abetos de atrás adelante: la de arriba, la más lejana (pequeña y con más bruma); las
  // de abajo, más cerca (más grandes y nítidas), tapan a las de detrás. Debajo de cada fila, la
  // masa del bosque en sombra, para que no se vean huecos.
  const ROWS = 4;
  for (let r = 0; r < ROWS; r++) {
    const k = r / (ROWS - 1);
    const lift = r * 6;
    const hz = 0.55 - k * 0.3;
    const step = 2 + r;
    for (let x = 0; x < W; x++) {
      const top = Math.ceil(ridge(x) + lift + 4);
      for (let y = top; y < Math.min(H, top + 8); y++)
        put(x, y, 0.22 + (fbmW(x, y, 3, 2, 43 + r, 2) - 0.5) * 0.4, hz + 0.05);
    }
    for (let x = (r * 7) % step; x < W; x += step) {
      const h = Math.round((5 + h2(x, 3 + r, 45) * 7) * (1 + k * 0.7));
      const cx = x + (h2(x, 4 + r, 45) - 0.5) * step;
      const base = Math.round(ridge(x) + lift) + 4;
      const tiers = Math.max(2, Math.round(h / 4));
      for (let y = base - h; y <= base; y++) {
        const t = (y - (base - h)) / h;
        const tt = (t * tiers) % 1;
        const half = (0.4 + t * h * 0.34) * (0.55 + 0.45 * tt);
        for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
          if (Math.abs(dx) > half + (h2(x + dx, y, 47 + r) - 0.5) * 1.2) continue;
          const v = 0.42 + (tt < 0.5 ? 0.2 : -0.12) + (dx < 0 ? -0.1 : 0.08) - k * 0.06;
          put(cx + dx, y, v, hz + (1 - t) * 0.05);
        }
      }
    }
  }
  // El lago, de la orilla del bosque al horizonte: refleja los árboles (algo ondulados, más
  // apagados y oscuros), y de lejos, el cielo; con rayas de brillo. Se ve donde bajan las colinas.
  const WATER_DAY = ['#6f8fae', '#86a4c0', '#9fb9d2'].map(hex);
  const WATER_NIGHT = ['#18213c', '#1f2a4a', '#2a3759'].map(hex);
  const SHINE_DAY = hex('#d8e6f2');
  const SHINE_NIGHT = hex('#56679a');
  const unpack = (c: number): RGB => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
  for (let x = 0; x < W; x++) {
    const shore = Math.ceil(ridge(x) + 6 * (ROWS - 1) + 12);
    for (let y = shore; y < H; y++) {
      const dy = y - shore;
      const i = y * W + x;
      const sx = (((x + Math.round(Math.sin(dy * 1.3 + x * 0.05) * 1.2)) % W) + W) % W;
      const sy = shore - 1 - Math.round(dy * 1.2);
      const shine = h2(Math.floor((x + dy * 5) / 4), dy, 91) > 0.93;
      for (const [buf, water, sh, hz] of [
        [day, WATER_DAY, SHINE_DAY, DAY.haze],
        [night, WATER_NIGHT, SHINE_NIGHT, NIGHT.haze],
      ] as const) {
        let c = ramp(water as RGB[], 0.85 - dy / 40);
        const src = sy >= 0 ? buf.data[sy * W + sx]! : 0;
        if (src >>> 24 && dy < 26) c = mixc(mixc(unpack(src), c, 0.45), [0, 0, 0], 0.12);
        if (shine) c = mixc(c, sh as RGB, 0.7);
        // La orilla: una raya oscura bajo los árboles.
        if (dy === 0) c = mixc(c, [20, 30, 30], 0.35);
        buf.data[i] = pack(mixc(c, hz as RGB, 0.18));
      }
    }
  }
  return { day, night };
}

// ---------- Arboledas y colinas ----------

/**
 * Una arboleda del fondo con los árboles nuevos (`arboles.ts`), a su pie en `base`: de día,
 * apagada por la bruma (`amt`); de noche, la misma silueta en azules oscuros.
 */
export function groveCnc(
  trees: readonly Tree[],
  base: number,
  amt: number,
): { day: PixelBuffer; night: PixelBuffer } {
  const W = LAYER_W;
  const day = new PixelBuffer(W, base + 2);
  for (const t of trees) {
    const img = t.conifer ? pineCnc(`fondo${t.x}`, t.h) : oakCnc(`fondo${t.x}`, t.h);
    // Repetido a un ancho de capa a cada lado: la capa se repite sin junta.
    for (const k of [-W, 0, W]) day.blit(img, Math.round(t.x + k - img.w / 2), base - img.h);
  }
  const night = new PixelBuffer(W, day.h);
  const NC = ['#0f1628', '#141c32', '#1a243e', '#222e4c'].map(hex);
  for (let i = 0; i < day.data.length; i++) {
    const c = day.data[i]!;
    if (!(c >>> 24)) continue;
    const l = ((c & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + ((c >> 16) & 255) * 0.11) / 255;
    night.data[i] = pack(ramp(NC, l * 1.6));
  }
  return { day: hazed(day, amt, 0.1), night };
}

/**
 * Quita el tramado de una capa: donde un píxel no se parece a ninguno de sus cuatro vecinos (un
 * cuadro del ajedrez del tramado, o un punto suelto) toma la media de su entorno de 3 × 3. El
 * tramado se vuelve un tono liso intermedio, como un degradado en bandas.
 */
export function untrammed(src: PixelBuffer): PixelBuffer {
  const b = src.clone();
  const { w, h } = src;
  const d = src.data;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = d[i]!;
      if (!(c >>> 24)) continue;
      const nb = [d[i - 1]!, d[i + 1]!, d[i - w]!, d[i + w]!];
      if (nb.some((n) => n === c || !(n >>> 24))) continue;
      let r = 0;
      let g = 0;
      let bl = 0;
      let n = 0;
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) {
          const q = d[i + j * w + k]!;
          if (!(q >>> 24)) continue;
          r += q & 255;
          g += (q >> 8) & 255;
          bl += (q >> 16) & 255;
          n++;
        }
      b.data[i] = pack([r / n, g / n, bl / n]);
    }
  return b;
}
