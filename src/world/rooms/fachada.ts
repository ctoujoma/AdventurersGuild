/**
 * Los materiales de la fachada por partes (`FacadeLook` en `data/custom.ts`): el tejado (en las
 * vertientes y en el alero de los hastiales) y las paredes de fuera (el muro del corte por encima
 * del suelo, los hastiales y los lados que dan al aire). Sin elegir, lo de siempre: teja roja y
 * tablas.
 */
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import type { RoofId, WallId } from '../../data/custom';
import { wallFace } from './muros';

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
/**
 * Relieve de las tejas (0–255, ver `PixelBuffer.relief`): cada hilera sale más por abajo, donde
 * monta sobre la de debajo, y la línea de sombra queda hundida.
 */
export function roofRelief(roof: RoofId = 'teja', x: number, y: number, row: number): number {
  const k = y % row;
  if (roof === 'paja') return 3 + Math.round(Math.sin(x * 0.7 + Math.floor(y / row)) + 1);
  if (k === row - 1) return 1;
  return 2 + k;
}

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
 * Pared de fuera, de frente, en un trozo del búfer (ver `wallFace` en `muros.ts`): tablas (lo de
 * siempre), entramado o sillería.
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
  wallFace(b, x, y, w, h, seed, walls);
}
