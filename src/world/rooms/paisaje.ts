/**
 * El fondo con «luz con ambiente» (fase 4 del plan de luz, ver `docs/plan-luz.md`): montes
 * grandes con nieve, la cara al sol y la de sombra separadas por el espinazo, surcos a lo largo
 * de la ladera y bruma que crece hacia el pie (perspectiva atmosférica); el cielo, en bandas de
 * borde mellado en vez de tramado; y las capas de delante, algo más apagadas por la bruma
 * cuanto más lejos. Sale de la prueba A (`tools/estilo/paisaje.py`).
 */
import { Rng } from '../../core/rng';
import { PixelBuffer, rgba } from '../../art/pixel';
import { GROUND } from '../geometry';
import { LAYER_W } from '../parallax';

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
function fbm(x: number, y: number, sx: number, sy: number, s: number, oct = 3): number {
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

interface Peak {
  x: number;
  y: number;
  wl: number;
  wr: number;
  base: number;
  hz: number;
  seed: number;
}

/** Dos sierras: la de atrás, más alta y con más bruma; la de delante, más baja. */
function ranges(): Peak[][] {
  const rng = new Rng('paisaje-montes');
  const out: Peak[][] = [];
  const specs = [
    { gap: [150, 300], y: [72, 150], w: [90, 220], base: GROUND - 20, hz: 0.24 },
    { gap: [100, 230], y: [150, 200], w: [60, 150], base: GROUND - 10, hz: 0.1 },
  ];
  specs.forEach((sp, li) => {
    const list: Peak[] = [];
    for (let x = rng.next() * 80; x < LAYER_W - 60;) {
      list.push({
        x,
        y: sp.y[0]! + rng.next() * (sp.y[1]! - sp.y[0]!),
        wl: sp.w[0]! + rng.next() * (sp.w[1]! - sp.w[0]!),
        wr: sp.w[0]! + rng.next() * (sp.w[1]! - sp.w[0]!),
        base: sp.base,
        hz: sp.hz,
        seed: li * 100 + list.length,
      });
      x += sp.gap[0]! + rng.next() * (sp.gap[1]! - sp.gap[0]!);
    }
    // Con sus copias a un ancho de capa a cada lado: se repite sin junta.
    out.push([
      ...list,
      ...list.map((q) => ({ ...q, x: q.x - LAYER_W })),
      ...list.map((q) => ({ ...q, x: q.x + LAYER_W })),
    ]);
  });
  return out;
}

/** La cresta de un pico en la x (con su mella), o Infinity si no llega. */
function ridgeOf(p: Peak, x: number): number {
  const left = x < p.x;
  const d = Math.abs(x - p.x) / (left ? p.wl : p.wr);
  if (d > 1.6) return Infinity;
  const s = p.seed * 7 + (left ? 1 : 2);
  const jag = (fbmW(x, 0, 7, 1, s) - 0.5) * 6 + (fbmW(x, 0, 30, 1, s + 3) - 0.5) * 10;
  return p.y + (p.base - p.y) * d ** 0.8 + jag * Math.min(1, d * 3);
}

export interface MountainSet {
  /** De día, con el sol por la derecha (mañana) y por la izquierda (tarde); y de noche. */
  right: PixelBuffer;
  left: PixelBuffer;
  night: PixelBuffer;
  /** Al atardecer (luz por la izquierda) y al alba (por la derecha). */
  dusk: PixelBuffer;
  dawn: PixelBuffer;
}

/** Las dos sierras, en una pasada: las tres versiones tienen la misma silueta y se funden. */
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
  // El serpenteo del espinazo de cada pico, por filas.
  const spines = new Map<number, Float32Array>();
  const driftOf = (p: Peak) => {
    let d = spines.get(p.seed);
    if (!d) {
      d = new Float32Array(H);
      for (let y = 0; y < H; y++) d[y] = (fbm(0, y, 1, 18, p.seed + 9) - 0.5) * 30;
      spines.set(p.seed, d);
    }
    return d;
  };
  for (const list of ranges()) {
    for (let x = 0; x < W; x++) {
      // De quién es la cresta en esta x: el pico que más sube.
      let top = Infinity;
      let p: Peak | null = null;
      for (const q of list) {
        const r = ridgeOf(q, x);
        if (r < top) {
          top = r;
          p = q;
        }
      }
      if (!p) continue;
      const span = p.base - p.y;
      // La nieve, hasta media ladera y nunca por debajo de cierta altura.
      const snowBase = Math.min(
        p.y + span * (0.42 + (fbmW(x, 0, 12, 1, p.seed + 5) - 0.5) * 0.35),
        172 + (fbmW(x, 0, 20, 1, 4) - 0.5) * 16,
      );
      const y0 = Math.max(0, Math.ceil(top));
      const drift = driftOf(p);
      for (let y = y0; y < H; y++) {
        // El espinazo baja del pico serpenteando: a un lado una cara, al otro la otra.
        const spine = p.x + drift[y]! * clamp01((y - p.y) / 40);
        const left = x < spine;
        // Surcos a lo largo de la ladera.
        const ang = Math.atan2(span, left ? p.wl : p.wr);
        const u = (left ? 1 : -1) * (x - p.x) * Math.sin(ang) + (y - p.y) * Math.cos(ang);
        const g =
          fbm(u * 0.9, 0, 5, 1, p.seed + 11) * 0.7 + fbmW(x, y, 3, 12, p.seed + 13, 2) * 0.3;
        const sub = fbmW(x, y, 14, 14, p.seed + 17, 2) - 0.5;
        const snowy = y < snowBase + (g - 0.5) * 22 && !(g < 0.3 && y > p.y + 6);
        // La bruma, más hacia el pie y en la sierra de atrás.
        const amt = Math.min(
          0.92,
          Math.max(
            0,
            clamp01(((y - (p.y + span * 0.45)) / span) * 1.2) * 0.7 +
              p.hz +
              (fbmW(x, y, 50, 6, p.seed + 19, 2) - 0.5) * 0.25,
          ),
        );
        const paint = (t: Tones, lit: boolean) => {
          const c = snowy
            ? ramp(t.snow, (lit ? 0.8 : 0.35) + (g - 0.5) * 0.35)
            : ramp(t.mount, (lit ? 0.66 : 0.3) + (g - 0.5) * 0.55 + sub * 0.25);
          return pack(mixc(c, t.haze, amt));
        };
        const i = y * W + x;
        set.right.data[i] = paint(DAY, !left);
        set.left.data[i] = paint(DAY, left);
        set.night.data[i] = paint(NIGHT, left);
        set.dusk.data[i] = paint(DUSK, left);
        set.dawn.data[i] = paint(DUSK, !left);
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
  // La masa del bosque, con grumos.
  for (let x = 0; x < W; x++)
    for (let y = Math.ceil(ridge(x)); y < H; y++)
      put(x, y, 0.3 + (fbmW(x, y, 3, 2, 43, 2) - 0.5) * 0.9, 0.45 + (y - ridge(x)) * 0.006);
  // Los abetos, de 2 en 2, por pisos que caen en punta; lo alto de cada piso, a la luz.
  for (let x = 0; x < W; x += 2) {
    const h = 6 + Math.floor(h2(x, 3, 45) * 9);
    const cx = x + (h2(x, 4, 45) - 0.5) * 2;
    const base = Math.round(ridge(x)) + 3;
    const tiers = Math.max(2, Math.round(h / 4));
    for (let y = base - h; y <= base; y++) {
      const t = (y - (base - h)) / h;
      const tt = (t * tiers) % 1;
      const half = (0.4 + t * h * 0.36) * (0.55 + 0.45 * tt);
      for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
        if (Math.abs(dx) > half + (h2(x + dx, y, 47) - 0.5) * 1.2) continue;
        const v = 0.45 + (tt < 0.5 ? 0.22 : -0.1) + (dx < 0 ? -0.12 : 0.08);
        put(cx + dx, y, v, 0.4 + (1 - t) * 0.08);
      }
    }
  }
  return { day, night };
}
