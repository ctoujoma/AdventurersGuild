import { Rng } from '../core/rng';
import { MAP_H, MAP_W, PLACE_INFO, TAVERN, type Terrain } from '../data/places';
import { P } from './palette';
import { PixelBuffer, bayer } from './pixel';

/**
 * El mapa de la comarca en pixel art: pergamino con costa, río, montes, bosques, pantano,
 * campos y caminos. Los marcadores (encargos, grupos) se ponen encima desde la interfaz.
 */

let cached: PixelBuffer | null = null;

/** Río: del vado, al norte, hasta el mar por el suroeste. */
const RIVER: readonly [number, number][] = [
  [128, 0],
  [124, 34],
  [112, 56],
  [96, 70],
  [82, 84],
  [70, 98],
  [48, 110],
  [22, 116],
];

function lerpPath(
  b: PixelBuffer,
  pts: readonly [number, number][],
  draw: (x: number, y: number) => void,
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / n + Math.sin((ay + k) * 0.4) * 1.2);
      const y = Math.round(ay + ((by - ay) * k) / n);
      if (b.inside(x, y)) draw(x, y);
    }
  }
}

function mountain(b: PixelBuffer, x: number, y: number, h: number): void {
  for (let k = 0; k < h; k++) {
    b.hline(x - k, y - h + k, 2 * k + 1, k < 2 ? P.white : P.tan);
    b.set(x - k, y - h + k, P.rust);
    b.set(x + k, y - h + k, P.clay);
  }
  b.hline(x - h + 1, y, 2 * h - 1, P.rust);
}

function tree(b: PixelBuffer, x: number, y: number): void {
  b.rect(x - 1, y - 3, 3, 3, P.leaf);
  b.set(x, y - 4, P.leaf);
  b.set(x - 1, y - 3, P.lime);
  b.set(x, y, P.bark);
}

export function mapBuffer(): PixelBuffer {
  if (cached) return cached;
  const b = new PixelBuffer(MAP_W, MAP_H);
  const rng = new Rng('mapa');
  // Pergamino con manchas y bordes oscurecidos.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      const stain = Math.sin(x * 0.07) * Math.cos(y * 0.09) + Math.sin((x + y) * 0.031);
      let c: string = P.sand;
      if (stain > 1.1 + bayer(x, y) * 0.3) c = P.tan;
      if (edge < 4 && bayer(x, y) < (4 - edge) / 4) c = edge < 2 ? P.clay : P.tan;
      b.set(x, y, c);
    }
  // Mar al suroeste.
  for (let y = 96; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const coast = 18 + Math.sin(y * 0.2) * 3 + (y - 96) * 0.12;
      if (x < coast) b.set(x, y, (x + y) % 5 === 0 ? P.mist : x > coast - 2 ? P.sky : P.ocean);
    }
  // Montes al norte.
  for (const [x, y, h] of [
    [70, 30, 7],
    [84, 26, 9],
    [100, 28, 6],
    [150, 24, 9],
    [166, 20, 7],
    [184, 28, 8],
    [200, 22, 10],
    [218, 30, 7],
    [134, 18, 5],
  ] as const)
    mountain(b, x, y, h);
  // Bosque de Sotomuro y arboledas.
  for (let i = 0; i < 46; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.next() * 18;
    tree(b, Math.round(44 + Math.cos(a) * r * 1.3), Math.round(62 + Math.sin(a) * r));
  }
  for (let i = 0; i < 14; i++) tree(b, rng.int(150, 230), rng.int(52, 66));
  // Pantano: charcos y juncos.
  for (let i = 0; i < 26; i++) {
    const x = rng.int(46, 78);
    const y = rng.int(132, 152);
    b.hline(x, y, 3, P.sky);
    if (i % 2) b.vline(x + 3, y - 3, 3, P.forest);
  }
  // Campos del granero.
  for (let y = 132; y < 154; y++)
    for (let x = 138; x < 170; x++) if ((y + Math.floor(x / 6)) % 3 === 0) b.set(x, y, P.gold);
  // Río con brillo.
  lerpPath(b, RIVER, (x, y) => {
    b.set(x, y, P.ocean);
    b.set(x + 1, y, P.sky);
    if (y % 4 === 0) b.set(x + 1, y, P.mist);
  });
  // Caminos de tierra desde la taberna a cada lugar.
  for (const p of Object.values(PLACE_INFO)) {
    const n = Math.max(Math.abs(p.x - TAVERN.x), Math.abs(p.y - TAVERN.y));
    for (let k = 3; k < n - 2; k += 3) {
      const x = Math.round(TAVERN.x + ((p.x - TAVERN.x) * k) / n);
      const y = Math.round(TAVERN.y + ((p.y - TAVERN.y) * k) / n);
      b.set(x, y, P.oak);
    }
  }
  // Rosa de los vientos.
  b.vline(222, 6, 13, P.rust);
  b.hline(216, 12, 13, P.rust);
  b.set(222, 5, P.wine);
  b.rect(221, 11, 3, 3, P.gold);
  cached = b;
  return b;
}

/** Símbolo del lugar según su terreno (los marcadores de la interfaz van encima). */
export const TERRAIN_GLYPH: Record<Terrain, string> = {
  rio: '≈',
  pueblo: '⌂',
  monte: '▲',
  bosque: '♣',
  costa: '~',
  pantano: '≋',
  campo: '#',
  ruina: '†',
};

/**
 * Niebla sobre lo que no se conoce: trama oscura de pergamino lejos de los puntos
 * conocidos. `known` son centros con su radio.
 */
export function fogBuffer(known: readonly { x: number; y: number; r: number }[]): PixelBuffer {
  const b = new PixelBuffer(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      let best = Infinity;
      for (const k of known) best = Math.min(best, Math.hypot(x - k.x, y - k.y) - k.r);
      if (best <= 0) continue;
      const f = Math.min(1, best / 14);
      if (bayer(x, y) < f) b.set(x, y, f > 0.85 && (x + y) % 3 === 0 ? P.rust : P.clay);
    }
  return b;
}
