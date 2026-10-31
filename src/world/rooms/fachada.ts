/**
 * Los materiales de la fachada por partes (`FacadeLook` en `data/custom.ts`): el tejado (en las
 * vertientes y en el alero de los hastiales) y las paredes de fuera (el muro del corte por encima
 * del suelo, los hastiales y los lados que dan al aire). Sin elegir, lo de siempre: teja roja y
 * tablas.
 */
import { P, type Ramp } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import type { RoofId, WallId } from '../../data/custom';
import { beam, planksV, plaster, post, stoneWall } from '../paint';

const WOOD_DARK: Ramp = [P.black, P.plum, P.bark, P.rust];
const PLASTER: Ramp = [P.clay, P.skinS, P.skin, P.sand, P.white];
/** Piedra de fuera: más clara y cálida que la de los sótanos. */
const ASHLAR: Ramp = [P.plum, P.slate, P.steel, P.fog, P.mist];

/** Ruido fijo por píxel (0–1). */
const noise = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 1000) / 1000;
};

/**
 * Color del tejado en un píxel de una vertiente o del alero (`row`: alto de cada hilada). Teja
 * roja o verde con sus juntas, pizarra en escamas, paja en mechones y tablillas de madera.
 */
export function roofAt(roof: RoofId = 'teja', x: number, y: number, row: number): string {
  const r = Math.floor(y / row);
  const shadow = y % row === row - 1;
  const off = r % 2 ? 2 : 0;
  switch (roof) {
    case 'pizarra': {
      if (shadow) return P.black;
      if ((x + off * 2) % 7 === 0) return P.navy;
      return r % 4 === 0 ? P.steel : noise(x, r) < 0.12 ? P.fog : P.slate;
    }
    case 'paja': {
      // Mechones de largo desigual: se nota la hilada por una línea más oscura que ondula.
      const wave = Math.round(Math.sin(x * 0.7 + r) * 1);
      if ((y + wave) % (row + 2) === row + 1) return P.rust;
      const n = noise(x, Math.floor(y / 2));
      return n < 0.18 ? P.amber : n > 0.82 ? P.lemon : x % 3 === 0 ? P.orange : P.gold;
    }
    case 'verde': {
      if (shadow) return P.black;
      if ((x + off) % 5 === 0) return P.deep;
      return r % 3 === 0 ? P.lime : P.leaf;
    }
    case 'tablilla': {
      if (shadow) return P.plum;
      if ((x + off * 2) % 6 === 0) return P.bark;
      return noise(Math.floor((x + off * 2) / 6), r) < 0.4 ? P.rust : P.oak;
    }
    default: {
      if (shadow) return P.plum;
      if ((x + off) % 5 === 0) return P.wine;
      return r % 3 === 0 ? P.amber : P.brick;
    }
  }
}

/**
 * Pared de fuera en un trozo del búfer: tablas (lo de siempre), entramado (vigas oscuras con
 * yeso entre medias y cruces en algunos paños) o sillería de piedra.
 */
export function wallFill(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  walls: WallId = 'tablas',
): void {
  if (w <= 0 || h <= 0) return;
  if (walls === 'piedra') {
    stoneWall(b, x, y, w, h, seed, { ramp: ASHLAR, bw: 14, bh: 7 });
    return;
  }
  if (walls !== 'entramado') {
    planksV(b, x, y, w, h, seed, WOOD_DARK, 6);
    return;
  }
  plaster(b, x, y, w, h, seed, PLASTER);
  // Las vigas: postes cada 24, carreras cada 30 y una cruz en uno de cada tres paños.
  for (let j = 0; j * 30 < h; j++) {
    const yy = y + j * 30;
    for (let i = 0; i * 24 < w; i++) {
      const xx = x + i * 24;
      if ((i + j) % 3 === 1) {
        b.line(xx + 3, yy + 3, Math.min(x + w - 1, xx + 23), Math.min(y + h - 1, yy + 29), P.bark);
        b.line(xx + 4, yy + 3, Math.min(x + w - 1, xx + 24), Math.min(y + h - 1, yy + 29), P.plum);
      }
    }
  }
  for (let i = 0; i * 24 < w; i++) post(b, x + i * 24, y, 3, h, WOOD_DARK);
  for (let j = 0; j * 30 < h; j++) beam(b, x, y + j * 30, w, 3, WOOD_DARK);
}
