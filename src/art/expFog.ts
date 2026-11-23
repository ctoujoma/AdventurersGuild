/**
 * La niebla del mapa de rumbos: tapa lo que el gremio no ha visto, se despeja por donde pasan los
 * grupos (y alrededor de los parajes) y se mueve despacio. La comarca, siempre despejada.
 *
 * Para que moverla salga barato, el ruido se calcula una vez en tres mosaicos que se repiten
 * (`tiles`: masas grandes de 1024 px, medianas de 512 y detalle de 256, así no se ve ningún patrón)
 * y en cada fotograma solo se desplazan, las masas grandes más despacio que el resto. La densidad
 * de un punto es su lejanía a lo visto (`fogField`, una vez por cada cambio) más el ruido. Al
 * despejar, la niebla de antes se retira poco a poco (`FogFrame.from`). `paintFog` pinta un
 * fotograma en el estilo de la sala de mapas:
 * - pergamino: pergamino sin pintar, con las nubes a tinta en el borde como en un grabado
 *   (contorno, segundo trazo y rayado por debajo);
 * - color: bancos de nubes blancas con volumen (luz arriba a la izquierda, panza en sombra),
 *   borde tramado y algún hueco por el que se intuye el terreno.
 */
import { MAP_H, MAP_W } from '../data/places';
import { OX, OY, WORLD_H, WORLD_W } from './expGeo';
import type { MapStyle } from './map';
import { fbm, hash2 } from './mapTerrain';
import { P } from './palette';
import { PixelBuffer, bayer, rgba } from './pixel';

/** Lo que se ve: círculos (en píxeles del mapa grande) despejados de niebla. */
export interface Clear {
  x: number;
  y: number;
  r: number;
}

/** Ruido de valor que se repite cada `period` celdas. */
function wrapNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const m = (k: number) => ((k % period) + period) % period;
  const a = hash2(m(xi), m(yi), seed);
  const b = hash2(m(xi + 1), m(yi), seed);
  const c = hash2(m(xi), m(yi + 1), seed);
  const d = hash2(m(xi + 1), m(yi + 1), seed);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

const S = 256;

/**
 * Un mosaico de ruido fractal de `S × S` que se repite sin costura, estirado a todo su recorrido
 * (0–1) y agrandado `up` veces (interpolando, así las masas grandes salen suaves).
 */
function noiseTile(periods: readonly number[], seed: number, up: number): Uint8Array {
  const base = new Float32Array(S * S);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = 0;
      let amp = 1;
      let norm = 0;
      for (const p of periods) {
        v += wrapNoise((x / S) * p, (y / S) * p, p, seed + p) * amp;
        norm += amp;
        amp *= 0.55;
      }
      v /= norm;
      base[y * S + x] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  const N = S * up;
  const out = new Uint8Array(N * N);
  const at = (x: number, y: number) => base[(y & (S - 1)) * S + (x & (S - 1))]!;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const fx = x / up;
      const fy = y / up;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const u = fx - x0;
      const v = fy - y0;
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * u;
      const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * u;
      out[y * N + x] = Math.round(((top + (bot - top) * v - lo) / (hi - lo)) * 255);
    }
  return out;
}

interface Tiles {
  /** Las masas grandes (1024 de lado), las medianas (512) y el detalle (256). */
  big: Uint8Array;
  mid: Uint8Array;
  fine: Uint8Array;
}
let tilesCache: Tiles | null = null;

/** Los tres mosaicos de la niebla, a tres escalas (se calculan una vez). */
export function tiles(): Tiles {
  tilesCache ??= {
    big: noiseTile([2, 4, 8, 16], 600, 4),
    mid: noiseTile([4, 8, 16], 640, 2),
    fine: noiseTile([8, 16, 32], 680, 1),
  };
  return tilesCache;
}

/**
 * Lo lejos (px) que queda cada punto del mapa grande de lo visto (negativo, dentro). La comarca
 * cuenta como vista.
 */
export function fogField(clears: readonly Clear[]): Float32Array {
  const W = WORLD_W;
  const H = WORLD_H;
  const far = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Fuera de la comarca, lo lejos que queda; dentro, lo que se mete (así el borde no se ve).
      const dx = Math.max(OX - x, 0, x - (OX + MAP_W));
      const dy = Math.max(OY - y, 0, y - (OY + MAP_H));
      const inner = Math.min(x - OX, y - OY, OX + MAP_W - x, OY + MAP_H - y);
      far[y * W + x] = (dx || dy ? Math.hypot(dx, dy) : -inner) - 8;
    }
  for (const c of clears) {
    const reach = c.r + 70;
    const x0 = Math.max(0, Math.floor(c.x - reach));
    const x1 = Math.min(W - 1, Math.ceil(c.x + reach));
    const y0 = Math.max(0, Math.floor(c.y - reach));
    const y1 = Math.min(H - 1, Math.ceil(c.y + reach));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - c.x, y - c.y) - c.r;
        if (d < far[y * W + x]!) far[y * W + x] = d;
      }
  }
  return far;
}

let paperCache: Uint8Array | null = null;

/** El tono del papel (1 = mancha), igual que el del pergamino de la comarca. */
function paper(): Uint8Array {
  if (paperCache) return paperCache;
  const p = new Uint8Array(WORLD_W * WORLD_H);
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const cx = x - OX;
      const cy = y - OY;
      const tone = fbm(cx / 34, cy / 26, 201);
      if ((tone > 0.6 && bayer(cx, cy) < (tone - 0.6) * 0.9) || hash2(cx, cy, 202) < 0.006)
        p[y * WORLD_W + x] = 1;
    }
  paperCache = p;
  return p;
}

/**
 * Cuánto se ha movido la niebla a los `t` segundos, en píxeles enteros: las masas grandes, muy
 * despacio; las medianas y el detalle, algo más deprisa y hacia otro lado.
 */
function drift(t: number): [number, number, number, number] {
  return [Math.floor(t * 0.9), Math.floor(t * 0.35), Math.floor(-t * 1.7), Math.floor(t * 0.8)];
}

const TH = 0.42;
/** Lo que sube la densidad de un banco de nubes al de encima (a color). */
const BANK = 0.42;
/** Densidad de lo que no cambia de un fotograma a otro (se deja como estaba). */
const STILL = 9;

/** Opciones de un fotograma. */
export interface FogFrame {
  /** Pintarlo todo (el primero); si no, lo hondo del pergamino, que no cambia, ni se mira. */
  full?: boolean;
  /** Al despejar: la lejanía de antes y cuánto va de la retirada (0–1). */
  from?: Float32Array;
  p?: number;
}

/**
 * Pinta un fotograma de la niebla en `out` (ABGR, `WORLD_W × WORLD_H`, el formato de ImageData),
 * a los `t` segundos. `dens` es un búfer de trabajo del mismo tamaño (para no pedir memoria cada
 * vez). Lo despejado queda transparente. Con `from`, la niebla de antes se retira hacia la nueva
 * deshilachándose: cada punto se va a su ritmo, según el detalle del ruido.
 */
export function paintFog(
  out: Uint32Array,
  dens: Float32Array,
  far: Float32Array,
  t: number,
  style: MapStyle,
  frame: FogFrame = {},
): void {
  const W = WORLD_W;
  const H = WORLD_H;
  const { big, mid, fine } = tiles();
  const [ax, ay, bx, by] = drift(t);
  const full = frame.full ?? true;
  const from = frame.from;
  const p = frame.p ?? 1;
  // El marco del mapa queda a la vista.
  const M = style === 'color' ? 4 : 7;
  const ink = style === 'pergamino';
  softBuf ??= new Float32Array(W * H);
  const soft = softBuf;
  for (let y = 0; y < H; y++) {
    const rBig = ((y + ay) & 1023) * 1024;
    const rMid = ((y + by) & 511) * 512;
    const rFine = ((y + by) & 255) * 256;
    const rStill = (y & 255) * 256;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let f = far[i]!;
      if (from) {
        const fo = from[i]!;
        if (fo > f) {
          const q = Math.max(0, Math.min(1, p * 1.7 - (fine[rStill + (x & 255)]! / 255) * 0.7));
          f = fo + (f - fo) * q * q * (3 - 2 * q);
        }
      }
      if (f < -24 || x < M || y < M || x >= W - M || y >= H - M) {
        dens[i] = 0;
        continue;
      }
      // En pergamino, lo hondo es papel quieto: tras el primer fotograma no se toca.
      if (!full && ink && f > 80) {
        dens[i] = STILL;
        continue;
      }
      const nb = big[rBig + ((x + ax) & 1023)]!;
      const nm = mid[rMid + ((x + bx) & 511)]!;
      const nf = fine[rFine + ((x + bx) & 255)]!;
      if (ink) {
        // A tinta, masas suaves (poco detalle): el contorno sale limpio.
        // A tinta, masas suaves con lóbulos redondos en el borde: el contorno sale a festones.
        const n = (nb * 0.62 + nm * 0.38) / 255;
        const lob = 1 - Math.abs((2 * nf) / 255 - 1);
        dens[i] = (f < 0 ? f / 8 : Math.min(1.5, f / 44)) + (n - 0.5) * 1.4 + (lob - 0.5) * 0.45;
      } else {
        // A color: los bancos salen de las masas grandes y medianas (`soft`); el detalle solo
        // festonea los bordes.
        // Lo ya visto queda despejado (la niebla solo se asoma unos píxeles).
        const base = f < 0 ? f / 8 : Math.min(1.2, f / 50);
        const sm = base + ((nb * 0.6 + nm * 0.4) / 255 - 0.5) * 2.2;
        soft[i] = sm;
        // Lóbulos redondos (ruido «hinchado»: cimas romas y valles marcados), como cúmulos.
        const lob = 1 - Math.abs((2 * nf) / 255 - 1);
        dens[i] = sm + (lob - 0.5) * 0.65;
      }
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : dens[y * W + x]!);
  if (style === 'color') paintColor(out, dens, far);
  else paintInk(out, dens, at, paper());
}

const C = {
  none: 0,
  white: rgba(P.white),
  mist: rgba(P.mist),
  fog: rgba(P.fog),
  steel: rgba(P.steel),
  sand: rgba(P.sand),
  tan: rgba(P.tan),
  clay: rgba(P.clay),
  umber: rgba(P.umber),
  cocoa: rgba(P.cocoa),
};

let softBuf: Float32Array | null = null;
let levels: Int8Array | null = null;
let belly: Uint8Array | null = null;

function paintColor(out: Uint32Array, dens: Float32Array, far: Float32Array) {
  const W = WORLD_W;
  const H = WORLD_H;
  // Cada escalón de densidad es un banco de nubes; de cada punto, lo que le queda por debajo hasta
  // el borde de abajo de su banco (la panza), en una pasada por columnas de abajo arriba.
  levels ??= new Int8Array(W * H);
  belly ??= new Uint8Array(W * H);
  const lv = levels;
  const bl = belly;
  const soft = softBuf!;
  for (let i = 0; i < W * H; i++) {
    const d = dens[i]! < TH && soft[i]! > TH + 0.2 ? TH : dens[i]!;
    lv[i] = d < TH ? -1 : Math.max(0, Math.min(100, Math.floor((soft[i]! - TH) / BANK)));
  }
  for (let x = 0; x < W; x++) {
    let run = 99;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      const below = y < H - 1 ? lv[i + W]! : -1;
      run = below < lv[i]! ? 1 : below > lv[i]! ? 99 : Math.min(99, run + 1);
      bl[i] = run;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let d = dens[i]!;
      const bay = bayer(x, y);
      // Dentro de un banco, las arrugas del detalle no abren agujeros.
      if (d < TH && soft[i]! > TH + 0.2) d = TH + 0.01;
      if (d < TH - 0.12) {
        // Un hueco entre bancos, lejos de lo visto: el terreno se intuye bajo un velo tramado.
        const deep = (far[i]! - 60) / 60;
        out[i] = deep > 0 && bay < Math.min(1, deep) * 0.6 ? C.mist : C.none;
        continue;
      }
      // El borde, tramado.
      if (d < TH) {
        out[i] = bay < (d - TH + 0.12) / 0.12 ? C.mist : C.none;
        continue;
      }
      // La panza de cada banco: oscura justo en el borde de abajo y aclarando hacia arriba (la del
      // banco de fuera, más oscura); la luz, arriba a la izquierda.
      const r = bl[i]!;
      const outer = lv[i] === 0;
      let c: number;
      if (r <= 1) c = outer ? C.steel : C.fog;
      else if (r <= 3) c = outer ? (bay < 0.6 ? C.fog : C.steel) : C.fog;
      else if (r <= 6) c = bay < (outer ? 0.75 : 0.5) ? C.fog : C.mist;
      else if (r <= 9) c = bay < (outer ? 0.3 : 0.15) ? C.fog : C.mist;
      else if (r <= 13) c = bay < 0.5 ? C.mist : C.white;
      else if (r <= 16) c = bay < 0.2 ? C.mist : C.white;
      else c = C.white;
      out[i] = c;
    }
}

function paintInk(
  out: Uint32Array,
  dens: Float32Array,
  at: (x: number, y: number) => number,
  paper: Uint8Array,
) {
  const W = WORLD_W;
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = dens[i]!;
      if (d === STILL) continue;
      if (d < TH) {
        out[i] = C.none;
        continue;
      }
      // El contorno de las nubes, a tinta (sin las motas sueltas).
      const open =
        Number(at(x - 1, y) < TH) +
        Number(at(x + 1, y) < TH) +
        Number(at(x, y - 1) < TH) +
        Number(at(x, y + 1) < TH);
      if (open >= 3) {
        out[i] = C.none;
        continue;
      }
      if (open) {
        out[i] = C.umber;
        continue;
      }
      // El trazo, más grueso por debajo (lleno y perfil, como a pluma).
      if (at(x, y + 2) < TH && at(x - 1, y + 2) < TH) {
        out[i] = C.umber;
        continue;
      }
      // Por debajo del festón, como en los grabados: un segundo trazo paralelo y el rayado
      // entre los dos; arriba, limpio.
      const under = at(x, y + 4) < d - 0.05;
      if (under && d < TH + 0.2) {
        if (d >= TH + 0.13 && (at(x, y + 1) < TH + 0.13 || at(x + 1, y + 1) < TH + 0.13)) {
          out[i] = C.cocoa;
          continue;
        }
        if (d < TH + 0.13 && (x - y + 900) % 3 === 0) {
          out[i] = C.tan;
          continue;
        }
      }
      // El pergamino sin pintar, con el mismo tono que el papel del mapa.
      out[i] = paper[i] ? C.tan : C.sand;
    }
}

/** Un fotograma como búfer (para las capturas y las pruebas). */
export function fogBuffer(clears: readonly Clear[], style: MapStyle, t = 0): PixelBuffer {
  const b = new PixelBuffer(WORLD_W, WORLD_H);
  paintFog(b.data, new Float32Array(WORLD_W * WORLD_H), fogField(clears), t, style);
  return b;
}
