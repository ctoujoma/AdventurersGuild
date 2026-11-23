/**
 * La niebla del mapa de rumbos: tapa lo que el gremio no ha visto, se despeja por donde pasan los
 * grupos (y alrededor de los parajes) y se mueve despacio. La comarca, siempre despejada.
 *
 * Para que moverla salga barato, todo se precalcula una vez y en cada fotograma solo se desplaza.
 * La lejanía a lo visto (`fogField`) se calcula al cambiar lo visto. `paintFog` pinta un
 * fotograma en el estilo de la sala de mapas:
 * - pergamino: pergamino sin pintar, con las nubes a tinta en el borde como en un grabado
 *   (contorno, segundo trazo y rayado por debajo); la densidad sale de tres mosaicos de ruido
 *   (`tiles`) a tres escalas.
 * - color: un mar de cúmulos visto desde arriba (`cloudLayers`): dos capas de bolas (medias
 *   esferas) pintadas en mosaicos de 512 × 512 sin costura, que se mueven a distinta velocidad.
 *   Cada bola lleva su luz (cara clara arriba a la izquierda, cuerpo, sombra propia) y la sombra
 *   de los cúmulos cae tramada sobre la capa de debajo y el terreno. Junto a lo visto las bolas se
 *   encogen o se quitan enteras, así el borde sale redondo.
 * Al despejar, la niebla de antes se retira poco a poco (`FogFrame.from`): a tinta, cada punto a
 * su ritmo; a color, cada bola se encoge con su propio retardo.
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
    const reach = c.r + FAR;
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
  // Tope a la lejanía (más allá, todo es niebla cerrada): así no hay saltos en el borde de la
  // caja de cada círculo, que al retirarse la niebla se verían como cortes rectos.
  for (let i = 0; i < far.length; i++) if (far[i]! > FAR) far[i] = FAR;
  return far;
}

/** Lejanía a partir de la cual la niebla es cerrada. */
const FAR = 120;

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
  if (style === 'color') {
    paintClouds(out, far, t, frame);
    return;
  }
  const W = WORLD_W;
  const H = WORLD_H;
  const { big, mid, fine } = tiles();
  const [ax, ay, bx, by] = drift(t);
  const full = frame.full ?? true;
  const from = frame.from;
  const p = frame.p ?? 1;
  // El marco del mapa queda a la vista.
  const M = 7;
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
      if (!full && f > 80) {
        dens[i] = STILL;
        continue;
      }
      const nb = big[rBig + ((x + ax) & 1023)]!;
      const nm = mid[rMid + ((x + bx) & 511)]!;
      const nf = fine[rFine + ((x + bx) & 255)]!;
      // A tinta, masas suaves con lóbulos redondos en el borde: el contorno sale a festones.
      const n = (nb * 0.62 + nm * 0.38) / 255;
      const lob = 1 - Math.abs((2 * nf) / 255 - 1);
      dens[i] = (f < 0 ? f / 8 : Math.min(1.5, f / 44)) + (n - 0.5) * 1.4 + (lob - 0.5) * 0.45;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : dens[y * W + x]!);
  paintInk(out, dens, at, paper());
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

// ---------- A color: un mar de cúmulos ----------

/** Lado del mosaico de nubes (se repite sin costura). */
const CT = 512;
const CM = CT - 1;

/**
 * Una capa de nubes: de quién es cada píxel (la bola que asoma más) y dónde cae su centro; y, donde
 * dos bolas se tocan, la otra bola y cuánto se funden (así no queda un corte recto entre ellas).
 */
interface CloudLayer {
  owner: Uint16Array;
  dx: Int8Array;
  dy: Int8Array;
  owner2: Uint16Array;
  dx2: Int8Array;
  dy2: Int8Array;
  /** Cuánto se funde con la otra bola (0–128 = 0–½). */
  mix: Uint8Array;
  /** Tapado por una bola más alta de arriba a la izquierda (su sombra). */
  occ: Uint8Array;
  /** El radio de cada bola y su retardo al deshacerse (0–1). */
  r: Float32Array;
  lag: Float32Array;
}

/** Las bolas, algo achatadas: más anchas que altas y con la base más plana. */
const WIDE = 1.2;
const BASE = 1.4;

/** Coordenadas de un punto dentro de su bola (−1 a 1; la base, aplastada). */
const ballU = (ex: number, r: number) => ex / (r * WIDE);
const ballV = (ey: number, r: number) => (ey < 0 ? ey / r : (ey * BASE) / r);

/**
 * Pinta una capa de cúmulos en un mosaico de `CT × CT` sin costura: bolas por una rejilla con
 * desvío (`cell` de lado, radios de `r0` a `r1`), cada una una media bola achatada; cada píxel es
 * de la bola que más alto asoma, y junto a la que le sigue se funde un poco. Se calcula una vez.
 */
function cloudLayer(
  seed: number,
  cell: number,
  r0: number,
  r1: number,
  extra: number,
  gap: number,
): CloudLayer {
  const balls: { x: number; y: number; r: number; z: number }[] = [];
  const n = CT / cell;
  for (let gy = 0; gy < n; gy++)
    for (let gx = 0; gx < n; gx++)
      for (let k = 0; k < 1 + extra; k++) {
        const h = (j: number) => hash2(gx * 7 + k, gy * 13 + j, seed);
        if (k > 0 && h(9) > extra / (1 + extra)) continue;
        const x = (gx + h(1)) * cell;
        const y = (gy + h(2)) * cell;
        // Las bolas van a montones: donde el ruido lento sube, más grandes; donde baja, nada.
        const clump =
          wrapNoise((x / CT) * 4, (y / CT) * 4, 4, seed + 1) * 0.6 +
          wrapNoise((x / CT) * 8, (y / CT) * 8, 8, seed + 2) * 0.4;
        if (clump < gap) continue;
        const r = (r0 + (r1 - r0) * h(3) ** (k ? 2 : 1)) * (0.65 + 0.6 * clump);
        balls.push({ x, y, r, z: h(4) * 4 + r * 0.3 + clump * 10 });
      }
  const N = CT * CT;
  const height = new Float32Array(N).fill(-1);
  const height2 = new Float32Array(N).fill(-1);
  const owner = new Uint16Array(N);
  const dx = new Int8Array(N);
  const dy = new Int8Array(N);
  const owner2 = new Uint16Array(N).fill(0xffff);
  const dx2 = new Int8Array(N);
  const dy2 = new Int8Array(N);
  balls.forEach((b, id) => {
    const RX = Math.ceil(b.r * WIDE);
    const R = Math.ceil(b.r);
    for (let oy = -R; oy <= R; oy++)
      for (let ox = -RX; ox <= RX; ox++) {
        const px = Math.round(b.x) + ox;
        const py = Math.round(b.y) + oy;
        const ex = px - b.x;
        const ey = py - b.y;
        const u = ballU(ex, b.r);
        const v = ballV(ey, b.r);
        const d2 = u * u + v * v;
        if (d2 >= 1) continue;
        const z = b.z + b.r * Math.sqrt(1 - d2);
        const i = (py & CM) * CT + (px & CM);
        if (z > height[i]!) {
          height2[i] = height[i]!;
          owner2[i] = height[i]! < 0 ? 0xffff : owner[i]!;
          dx2[i] = dx[i]!;
          dy2[i] = dy[i]!;
          height[i] = z;
          owner[i] = id;
          dx[i] = Math.round(ex);
          dy[i] = Math.round(ey);
        } else if (z > height2[i]!) {
          height2[i] = z;
          owner2[i] = id;
          dx2[i] = Math.round(ex);
          dy2[i] = Math.round(ey);
        }
      }
  });
  // Donde dos bolas casi igual de altas se tocan, se funden unos píxeles.
  const mix = new Uint8Array(N);
  for (let i = 0; i < N; i++)
    if (owner2[i] !== 0xffff && height[i]! >= 0)
      mix[i] = Math.round(Math.max(0, 1 - (height[i]! - height2[i]!) / 4) * 128);
  // La sombra propia entre bolas: lo que queda bajo una bola más alta de arriba a la izquierda.
  const occ = new Uint8Array(N);
  for (let y = 0; y < CT; y++)
    for (let x = 0; x < CT; x++) {
      const i = y * CT + x;
      if (height[i]! < 0) continue;
      for (const k of [2, 4]) {
        const j = ((y - k) & CM) * CT + ((x - k) & CM);
        if (owner[j] !== owner[i] && height[j]! > height[i]! + k * 0.9) {
          occ[i] = k === 2 ? 2 : 1;
          break;
        }
      }
    }
  for (let i = 0; i < N; i++) if (height[i]! < 0) owner[i] = 0xffff;
  const r = new Float32Array(balls.map((b) => b.r));
  const lag = new Float32Array(balls.map((_, id) => hash2(id, 5, seed)));
  return { owner, dx, dy, owner2, dx2, dy2, mix, occ, r, lag };
}

let cloudCache: [CloudLayer, CloudLayer] | null = null;

/** Las dos capas: el fondo, de bolas grandes y apretadas, y los cúmulos de encima, más sueltos. */
export function cloudLayers(): [CloudLayer, CloudLayer] {
  cloudCache ??= [cloudLayer(701, 32, 15, 30, 0.6, 0), cloudLayer(733, 32, 7, 30, 1.4, 0.38)];
  return cloudCache;
}

/** La luz, de arriba a la izquierda (normalizada). */
const LX = -0.5;
const LY = -0.55;
const LZ = 0.67;

const NONE = -1;

/**
 * Pinta el mar de cúmulos. Cada bola se ve entera, encogida o nada según lo lejos que quede su
 * centro de lo visto (así el borde con lo explorado sale redondo, a bolas); al despejar, cada bola
 * se encoge con su propio retardo. La luz va por bola (cara clara, cuerpo, sombra propia) y la
 * sombra de los cúmulos cae, tramada, sobre la capa de debajo y sobre el terreno.
 */
function paintClouds(out: Uint32Array, far: Float32Array, t: number, frame: FogFrame): void {
  const W = WORLD_W;
  const H = WORLD_H;
  const [lo, hi] = cloudLayers();
  const from = frame.from;
  const p = frame.p ?? 1;
  // Las dos capas se mueven a distinta velocidad.
  const lx = Math.floor(t * 0.8);
  const ly = Math.floor(t * 0.3);
  const hx = Math.floor(t * 2);
  const hy = Math.floor(t * 0.6);
  const M = 4;
  // Lo lejos que queda de lo visto un punto (con la retirada, según el retardo de la bola).
  const farAt = (x: number, y: number, lag: number) => {
    const cx = x < 0 ? 0 : x >= W ? W - 1 : x;
    const cy = y < 0 ? 0 : y >= H ? H - 1 : y;
    const i = cy * W + cx;
    let f = far[i]!;
    if (from) {
      const fo = from[i]!;
      if (fo > f) {
        const q = Math.max(0, Math.min(1, p * 1.6 - lag * 0.6));
        f = fo + (f - fo) * q * q * (3 - 2 * q);
      }
    }
    return f;
  };
  /**
   * El tono (0 luz, 1 cuerpo, 2 sombra, 3 hondo) de una capa en un punto, o `NONE` si no hay
   * nube. `ox, oy`: lo que se ha movido la capa.
   */
  /**
   * La luz de una bola en un punto (`ex, ey` desde su centro), o `NaN` si no se ve ahí: encogida
   * según lo lejos que quede su centro de lo visto (o entera, `deep`).
   */
  const ballLight = (
    L: CloudLayer,
    id: number,
    ex: number,
    ey: number,
    x: number,
    y: number,
    deep: boolean,
  ) => {
    const r = L.r[id]!;
    let sc = 1;
    if (!deep || from) {
      const fc = farAt(x - ex, y - ey, L.lag[id]!);
      sc = Math.max(0, Math.min(1, (fc + 2) / (r + 18)));
      // Las que se encogen mucho desaparecen (no quedan canicas sueltas).
      if (r * sc < 5) return NaN;
    }
    const rr = r * sc;
    const u = ballU(ex, rr);
    const v = ballV(ey, rr);
    const d2 = u * u + v * v;
    if (d2 >= 1) return NaN;
    // La base, algo más en sombra.
    return (
      u * LX + v * LY + Math.sqrt(1 - d2) * LZ - (v > 0.4 ? (v - 0.4) * 0.5 : 0) + (sc < 1 ? 0 : 2)
    );
  };
  /**
   * El tono (0 luz, 1 cuerpo, 2 sombra, 3 hondo) de una capa en un punto, o `NONE` si no hay
   * nube. `ox, oy`: lo que se ha movido la capa.
   */
  const tone = (L: CloudLayer, x: number, y: number, ox: number, oy: number, deep: boolean) => {
    const i = ((y + oy) & CM) * CT + ((x + ox) & CM);
    const id = L.owner[i]!;
    if (id === 0xffff) return NONE;
    let l1 = ballLight(L, id, L.dx[i]!, L.dy[i]!, x, y, deep);
    const id2 = L.owner2[i]!;
    let full = false;
    if (id2 !== 0xffff && (L.mix[i]! > 0 || Number.isNaN(l1))) {
      const l2 = ballLight(L, id2, L.dx2[i]!, L.dy2[i]!, x, y, deep);
      if (Number.isNaN(l1)) l1 = l2;
      else if (!Number.isNaN(l2)) {
        // Donde se tocan, la luz de las dos se funde y queda un pliegue suave.
        const w = L.mix[i]! / 256;
        const f1 = l1 >= 1.5;
        const a = f1 ? l1 - 2 : l1;
        const c = l2 >= 1.5 ? l2 - 2 : l2;
        l1 = a * (1 - w) + c * w - w * 0.12 + (f1 ? 2 : 0);
      }
    }
    if (Number.isNaN(l1)) return NONE;
    if (l1 >= 1.5) {
      full = true;
      l1 -= 2;
    }
    const light = l1;
    const b = bayer(x + ox, y + oy);
    // Tres escalones por luz (cara clara, cuerpo, sombra propia), tramados en el paso.
    let k =
      light > 0.6
        ? 0
        : light > 0.48
          ? b < (light - 0.48) / 0.12
            ? 0
            : 1
          : light > 0.14
            ? 1
            : light > 0.02
              ? b < (light - 0.02) / 0.12
                ? 1
                : 2
              : 2;
    if (full && L.occ[i]) k = Math.min(3, k + L.occ[i]!);
    return k;
  };
  const HI = [C.white, C.mist, C.fog, C.steel];
  const LO = [C.mist, C.mist, C.fog, C.steel];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x < M || y < M || x >= W - M || y >= H - M || far[i]! < -30) {
        out[i] = C.none;
        continue;
      }
      // Lejos de lo visto (y sin retirada), todas las bolas están enteras: no hace falta mirar
      // más. (Una bola llega a 45 px de su centro y está entera desde 54 px de lo visto, más los 4
      // de la sombra: desde 105 px es seguro.)
      const deep = far[i]! >= 105 && !from;
      const a = tone(hi, x, y, hx, hy, deep);
      if (a !== NONE) {
        out[i] = HI[a]!;
        continue;
      }
      const bay = bayer(x, y);
      // La sombra que echan los cúmulos de encima (abajo a la derecha).
      const shade = tone(hi, x - 4, y - 4, hx, hy, deep) !== NONE;
      const c = tone(lo, x, y, lx, ly, deep);
      if (c !== NONE) {
        // La capa de debajo, más apagada: cuerpo liso y sombra honda tramada.
        const k = Math.min(3, c + (shade ? 1 : 0));
        out[i] = k === 3 ? (bay < 0.5 ? C.steel : C.fog) : LO[k]!;
        continue;
      }
      // Sin nube, lejos de lo visto: un fondo de nube que cierra los huecos (no asoma terreno sin
      // explorar); cerca, el terreno, con la sombra de las nubes tramada encima.
      const drop = shade || tone(lo, x - 4, y - 4, lx, ly, deep) !== NONE;
      const fill = (far[i]! - 70) / 40;
      if (fill > 0 && bay < fill) {
        out[i] = drop ? (bay < 0.5 ? C.steel : C.fog) : C.fog;
        continue;
      }
      out[i] = drop && bay < 0.5 ? C.steel : C.none;
    }
}
