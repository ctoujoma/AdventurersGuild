import type { ItemIcon, Rarity, TrophyIcon } from '../core/model';
import { P, darker } from './palette';
import { PixelBuffer, toHex } from './pixel';

/**
 * Iconos de objetos (12×12) y trofeos (14×14) en pixel art. Se usan en la escena (tablero
 * del equipo en la bodega, pared de trofeos de la sala) y en las fichas.
 */

const cache = new Map<string, PixelBuffer>();

function make(key: string, w: number, h: number, draw: (b: PixelBuffer) => void): PixelBuffer {
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new PixelBuffer(w, h);
  draw(b);
  const out = b.outlined((n) => darker(toHex(n), 2));
  cache.set(key, out);
  return out;
}

/** Colores del metal según la rareza: hierro, acero pulido, plata élfica. */
const METAL = [
  [P.steel, P.fog, P.mist],
  [P.fog, P.mist, P.white],
  [P.sky, P.cyan, P.white],
] as const;
const TRIM = [P.oak, P.gold, P.lemon] as const;

export function itemIcon(icon: ItemIcon, rarity: Rarity = 0): PixelBuffer {
  const [m0, m1, m2] = METAL[rarity];
  const trim = TRIM[rarity];
  return make(`i:${icon}:${rarity}`, 12, 12, (b) => {
    switch (icon) {
      case 'espada':
        b.line(2, 9, 9, 2, m1);
        b.line(3, 9, 10, 2, m0);
        b.set(10, 1, m2);
        b.line(1, 7, 4, 10, trim);
        b.line(1, 10, 2, 9, P.bark);
        b.set(0, 11, trim);
        break;
      case 'hacha':
        b.line(2, 10, 8, 2, P.oak);
        b.line(3, 10, 9, 2, P.bark);
        b.rect(7, 1, 4, 5, m0);
        b.rect(8, 1, 3, 4, m1);
        b.vline(11, 1, 5, m2);
        break;
      case 'escudo':
        b.rect(2, 1, 8, 7, m0);
        b.rect(3, 8, 6, 2, m0);
        b.rect(4, 10, 4, 1, m0);
        b.rect(3, 2, 6, 6, P.wine);
        b.rect(5, 2, 2, 8, trim);
        b.rect(3, 4, 6, 2, trim);
        break;
      case 'coraza':
        b.rect(2, 2, 8, 8, m0);
        b.rect(3, 3, 3, 6, m1);
        b.rect(0, 2, 3, 3, m1);
        b.rect(9, 2, 3, 3, m0);
        b.rect(4, 1, 4, 1, P.black);
        b.hline(2, 9, 8, trim);
        break;
      case 'amuleto':
        b.line(2, 1, 6, 6, P.oak);
        b.line(10, 1, 6, 6, P.oak);
        b.rect(4, 6, 5, 5, trim);
        b.rect(5, 7, 3, 3, rarity === 2 ? P.cyan : P.wine);
        b.set(5, 7, P.white);
        break;
      case 'ganzua':
        b.hline(1, 3, 9, m1);
        b.hline(1, 6, 8, m0);
        b.hline(1, 9, 9, m1);
        b.set(10, 2, m1);
        b.set(9, 5, m0);
        b.set(10, 8, m1);
        b.rect(0, 2, 2, 9, P.wine);
        b.vline(1, 2, 9, trim);
        break;
      case 'botas':
        b.rect(2, 1, 4, 8, P.oak);
        b.rect(2, 8, 8, 3, P.oak);
        b.rect(3, 2, 2, 6, P.clay);
        b.hline(2, 10, 8, P.bark);
        b.hline(2, 3, 4, trim);
        break;
      case 'capa':
        b.rect(4, 0, 4, 2, trim);
        for (let y = 2; y < 12; y++) {
          const half = 2 + Math.floor(y / 3);
          b.hline(6 - half, y, half * 2, rarity === 2 ? P.leaf : P.forest);
          b.set(6 - half, y, P.deep);
        }
        b.vline(6, 2, 9, rarity === 2 ? P.lime : P.leaf);
        break;
      case 'varita':
        b.line(2, 10, 8, 4, P.oak);
        b.line(3, 10, 9, 4, P.bark);
        b.rect(8, 1, 3, 3, rarity === 2 ? P.cyan : trim);
        b.set(9, 0, P.white);
        b.set(11, 2, P.white);
        break;
    }
  });
}

export function trophyIcon(icon: TrophyIcon): PixelBuffer {
  return make(`t:${icon}`, 14, 14, (b) => {
    switch (icon) {
      case 'cabeza':
        // Placa de madera y cabeza de bestia con orejas y colmillos.
        b.rect(3, 9, 8, 5, P.oak);
        b.hline(3, 9, 8, P.clay);
        b.rect(3, 2, 8, 7, P.umber);
        b.rect(2, 0, 2, 3, P.umber);
        b.rect(10, 0, 2, 3, P.umber);
        b.rect(5, 6, 4, 4, P.cocoa);
        b.set(4, 4, P.lemon);
        b.set(9, 4, P.lemon);
        b.set(5, 10, P.white);
        b.set(8, 10, P.white);
        b.rect(6, 6, 2, 1, P.black);
        break;
      case 'colmillos':
        b.rect(1, 9, 12, 4, P.oak);
        b.hline(1, 9, 12, P.clay);
        b.line(3, 9, 5, 1, P.sand);
        b.line(4, 9, 5, 2, P.white);
        b.line(10, 9, 8, 1, P.sand);
        b.line(9, 9, 8, 2, P.white);
        break;
      case 'estandarte':
        b.vline(1, 0, 14, P.oak);
        b.hline(1, 1, 11, P.oak);
        b.rect(2, 2, 10, 9, P.wine);
        b.rect(2, 11, 3, 2, P.wine);
        b.rect(9, 11, 3, 2, P.wine);
        b.rect(5, 4, 4, 4, P.black);
        b.set(6, 5, P.red);
        b.set(7, 5, P.red);
        break;
      case 'calavera':
        b.rect(3, 1, 8, 7, P.sand);
        b.rect(4, 8, 6, 3, P.sand);
        b.rect(4, 4, 2, 2, P.black);
        b.rect(8, 4, 2, 2, P.black);
        b.set(7, 7, P.black);
        b.hline(4, 10, 6, P.tan);
        b.rect(3, 0, 8, 1, P.gold);
        b.set(4, 0, P.lemon);
        b.rect(2, 12, 10, 2, P.oak);
        break;
      case 'idolo':
        b.rect(4, 1, 6, 10, P.leaf);
        b.rect(3, 3, 8, 3, P.leaf);
        b.rect(5, 2, 2, 8, P.lime);
        b.set(5, 4, P.lemon);
        b.set(8, 4, P.lemon);
        b.rect(6, 7, 2, 1, P.forest);
        b.rect(2, 11, 10, 3, P.steel);
        b.hline(2, 11, 10, P.fog);
        break;
      case 'mascara':
        b.rect(3, 2, 8, 9, P.white);
        b.rect(2, 4, 10, 4, P.white);
        b.rect(4, 4, 2, 2, P.black);
        b.rect(8, 4, 2, 2, P.black);
        b.line(4, 8, 6, 9, P.wine);
        b.line(7, 9, 9, 8, P.wine);
        b.vline(7, 1, 2, P.gold);
        b.hline(3, 2, 8, P.gold);
        break;
    }
  });
}
