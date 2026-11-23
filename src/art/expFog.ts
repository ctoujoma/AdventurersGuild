/**
 * La niebla del mapa de rumbos: tapa lo que el gremio no ha visto, se despeja por donde pasan los
 * grupos (y alrededor de los parajes) y se mueve despacio. La comarca, siempre despejada.
 *
 * Para que moverla salga barato, el ruido se calcula una vez en un mosaico de 256 × 256 que se
 * repite (`tile`) y en cada fotograma solo se desplaza: la densidad de un punto es su lejanía a lo
 * visto (`fogField`, una vez por cada cambio de lo visto) más dos capas del mosaico corridas a
 * distinta velocidad. `paintFog` pinta un fotograma en el estilo de la sala de mapas:
 * - pergamino: pergamino sin pintar, con las nubes dibujadas a tinta en el borde (contorno de
 *   lóbulos y su panza rayada);
 * - color: nubes blancas con volumen (luz arriba a la izquierda, sombra abajo a la derecha) y el
 *   borde tramado.
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

const T = 256;
const TM = T - 1;
let tileCache: Float32Array | null = null;

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

/**
 * El mosaico de ruido (0–1): bolas de nube (lóbulos redondos, para que el borde salga a festones)
 * sobre un ruido suave. Se repite sin costura en los dos ejes.
 */
export function tile(): Float32Array {
  if (tileCache) return tileCache;
  const out = new Float32Array(T * T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      let v = 0;
      let amp = 0.5;
      let norm = 0;
      for (const p of [4, 8, 16]) {
        v += wrapNoise((x / T) * p, (y / T) * p, p, 600 + p) * amp;
        norm += amp;
        amp *= 0.5;
      }
      out[y * T + x] = (v / norm) * 0.55;
    }
  // Las bolas, con vuelta por los bordes.
  for (let k = 0; k < 90; k++) {
    const cx = hash2(k, 1, 611) * T;
    const cy = hash2(k, 2, 611) * T;
    const r = 6 + hash2(k, 3, 611) * 13;
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = (dx * dx + dy * dy * 1.6) / (r * r);
        if (d >= 1) continue;
        const i = ((Math.floor(cy) + dy) & TM) * T + ((Math.floor(cx) + dx) & TM);
        out[i] = Math.max(out[i]!, 0.3 + 0.55 * Math.sqrt(1 - d));
      }
  }
  tileCache = out;
  return out;
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

/** Cuánto se ha movido la niebla a los `t` segundos (dos capas, en píxeles enteros). */
function drift(t: number): [number, number, number, number] {
  return [Math.floor(t * 2.2), Math.floor(t * 0.7), Math.floor(-t * 1.3), Math.floor(t * 1.6)];
}

const TH = 0.42;

/**
 * Pinta un fotograma de la niebla en `out` (ABGR, `WORLD_W × WORLD_H`, el formato de ImageData),
 * a los `t` segundos. `dens` es un búfer de trabajo del mismo tamaño (para no pedir memoria cada
 * vez). Lo despejado queda transparente.
 */
export function paintFog(
  out: Uint32Array,
  dens: Float32Array,
  far: Float32Array,
  t: number,
  style: MapStyle,
): void {
  const W = WORLD_W;
  const H = WORLD_H;
  const n = tile();
  const [ax, ay, bx, by] = drift(t);
  // El marco del mapa queda a la vista.
  const M = style === 'color' ? 4 : 7;
  // La densidad: lejanía + las dos capas del mosaico.
  for (let y = 0; y < H; y++) {
    const ra = ((y + ay) & TM) * T;
    const rb = (((y >> 1) + by) & TM) * T;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const f = far[i]!;
      if (f < -20 || x < M || y < M || x >= W - M || y >= H - M) {
        dens[i] = 0;
        continue;
      }
      const base = Math.min(1.4, f / 46);
      const v = n[ra + ((x + ax) & TM)]! * 0.65 + n[rb + (((x >> 1) + bx) & TM)]! * 0.45;
      dens[i] = base + (v - 0.45) * 1.4;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : dens[y * W + x]!);
  if (style === 'color') paintColor(out, dens, at);
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

function paintColor(out: Uint32Array, dens: Float32Array, at: (x: number, y: number) => number) {
  const W = WORLD_W;
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = dens[i]!;
      if (d < TH - 0.1) {
        out[i] = C.none;
        continue;
      }
      // El borde, tramado.
      if (d < TH) {
        out[i] = bayer(x, y) < (d - TH + 0.1) / 0.1 ? C.mist : C.none;
        continue;
      }
      // El volumen: la cara que mira arriba a la izquierda, a la luz; la de abajo, en sombra.
      const g = at(x + 2, y + 2) - at(x - 2, y - 2);
      let c: number;
      if (d < TH + 0.14) {
        // Junto al borde: la panza gris abajo y a la derecha, la luz arriba.
        if (at(x, y + 2) < TH || at(x + 2, y + 1) < TH) c = C.steel;
        else if (g < -0.03) c = bayer(x, y) < 0.6 ? C.fog : C.mist;
        else c = g > 0.05 ? C.white : C.mist;
      } else if (g < -0.2) c = bayer(x, y) < 0.5 ? C.fog : C.mist;
      else if (g < -0.1) c = bayer(x, y) < 0.6 ? C.mist : C.white;
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
      // La sombra de la panza (abajo y a la derecha del festón), rayada, y un segundo festón.
      const below = at(x + 1, y + 3) < TH || at(x, y + 2) < TH;
      if (below && d < TH + 0.18) {
        out[i] = (x + y) % 2 ? C.tan : C.sand;
        continue;
      }
      const inner = TH + 0.2;
      if (d >= inner && d < inner + 0.05 && (at(x, y + 1) < inner || at(x + 1, y) < inner)) {
        out[i] = hash2(x >> 2, y >> 2, 621) < 0.55 ? C.cocoa : C.sand;
        continue;
      }
      if (d < TH + 0.3 && at(x, y + 4) < d - 0.08 && (x - y + 900) % 3 === 0) {
        out[i] = C.tan;
        continue;
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
