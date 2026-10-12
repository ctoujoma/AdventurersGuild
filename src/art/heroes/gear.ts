import type { ItemIcon, Rarity } from '../../core/model';
import { P } from '../palette';
import { alpha, type PixelBuffer } from '../pixel';

/**
 * El equipo que lleva el héroe, pintado encima (o por detrás) de su sprite y de su retrato:
 * coraza con hombreras, capa, amuleto al cuello, espada o hacha a la espalda, escudo, varita,
 * botas y bolsa de ganzúas. La rareza cambia el metal y el brillo: común, raro (azul) o
 * legendario (oro, con destellos).
 */

export interface GearMark {
  icon: ItemIcon;
  rarity: Rarity;
}

const METAL = [
  [P.slate, P.steel, P.fog],
  [P.steel, P.fog, P.mist],
  [P.amber, P.gold, P.lemon],
] as const;
const ACCENT = [P.fog, P.cyan, P.lemon] as const;
const CAPE = [
  [P.plum, P.wine],
  [P.navy, P.ocean],
  [P.rust, P.amber],
] as const;
const BOOT = [P.umber, P.ocean, P.amber] as const;

/** Pinta solo donde no hay nada (para lo que va detrás de la figura). */
function under(b: PixelBuffer, x: number, y: number, c: string): void {
  if (!alpha(b.get(x, y))) b.set(x, y, c);
}

function line(
  b: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: string,
  back: boolean,
): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (back) under(b, x, y, c);
    else b.set(x, y, c);
  }
}

// ---------- Sprite de frente (16×26 antes del contorno) ----------

export function gearFront(b: PixelBuffer, g: GearMark): void {
  const m = METAL[g.rarity];
  const a = ACCENT[g.rarity];
  switch (g.icon) {
    case 'coraza':
      for (let y = 13; y <= 17; y++)
        for (let x = 5; x <= 10; x++) b.setIfFilled(x, y, y === 13 || x === 5 ? m[2] : m[1]);
      b.setIfFilled(3, 13, m[2]);
      b.setIfFilled(12, 13, m[2]);
      b.setIfFilled(7, 15, a);
      b.setIfFilled(8, 15, a);
      break;
    case 'capa': {
      const [dark, light] = CAPE[g.rarity];
      for (let y = 12; y <= 23; y++) {
        const w = y < 15 ? 0 : 1;
        under(b, 2 - w, y, dark);
        under(b, 3 - w, y, light);
        under(b, 12 + w, y, light);
        under(b, 13 + w, y, dark);
        under(b, 2, y, light);
        under(b, 13, y, light);
      }
      b.setIfFilled(6, 12, a);
      b.setIfFilled(9, 12, a);
      break;
    }
    case 'amuleto':
      b.setIfFilled(6, 13, P.ebony);
      b.setIfFilled(9, 13, P.ebony);
      b.setIfFilled(7, 14, a);
      b.setIfFilled(8, 14, a);
      b.setIfFilled(7, 15, m[1]);
      break;
    case 'botas':
      for (let y = 22; y <= 25; y++)
        for (let x = 2; x <= 13; x++) b.setIfFilled(x, y, y === 22 ? a : BOOT[g.rarity]);
      break;
    case 'espada':
    case 'hacha':
      // A la espalda: asoma por encima del hombro derecho.
      line(b, 13, 14, 13, 5, m[1], true);
      line(b, 14, 13, 14, 6, m[2], true);
      if (g.icon === 'hacha') {
        for (let y = 4; y <= 7; y++)
          for (let x = 11; x <= 15; x++) under(b, x, y, m[y === 4 ? 2 : 1]);
      } else {
        line(b, 11, 12, 15, 12, P.gold, true);
        under(b, 13, 4, a);
      }
      break;
    case 'escudo':
      for (let y = 14; y <= 20; y++)
        for (let x = 0; x <= 4; x++) {
          const edge = y === 14 || y === 20 || x === 0 || x === 4;
          if ((y === 14 || y === 20) && (x === 0 || x === 4)) continue;
          b.set(x, y, edge ? m[2] : P.wine);
        }
      b.set(2, 17, a);
      break;
    case 'varita':
      line(b, 13, 20, 14, 15, P.oak, false);
      b.set(14, 14, a);
      b.set(15, 13, P.white);
      break;
    case 'ganzua':
      b.setIfFilled(10, 18, P.oak);
      b.setIfFilled(11, 18, P.oak);
      b.setIfFilled(11, 19, m[2]);
      break;
  }
}

// ---------- Sprite de perfil (mirando a la derecha) ----------

export function gearSide(b: PixelBuffer, g: GearMark): void {
  const m = METAL[g.rarity];
  const a = ACCENT[g.rarity];
  switch (g.icon) {
    case 'coraza':
      for (let y = 13; y <= 16; y++)
        for (let x = 5; x <= 10; x++) b.setIfFilled(x, y, y === 13 ? m[2] : m[1]);
      b.setIfFilled(9, 14, a);
      break;
    case 'capa': {
      const [dark, light] = CAPE[g.rarity];
      for (let y = 12; y <= 23; y++) {
        under(b, 3, y, dark);
        under(b, 4, y, light);
        if (y > 16) under(b, 2, y, dark);
      }
      break;
    }
    case 'amuleto':
      b.setIfFilled(10, 14, a);
      break;
    case 'botas':
      for (let y = 22; y <= 25; y++)
        for (let x = 2; x <= 14; x++) b.setIfFilled(x, y, y === 22 ? a : BOOT[g.rarity]);
      break;
    case 'espada':
    case 'hacha':
      line(b, 3, 18, 5, 6, m[1], true);
      line(b, 2, 17, 4, 6, m[2], true);
      if (g.icon === 'hacha')
        for (let y = 4; y <= 7; y++) for (let x = 3; x <= 7; x++) under(b, x, y, m[1]);
      else under(b, 5, 5, a);
      break;
    case 'escudo':
      for (let y = 12; y <= 19; y++)
        for (let x = 1; x <= 4; x++)
          under(b, x, y, x === 1 || y === 12 || y === 19 ? m[2] : P.wine);
      under(b, 2, 15, a);
      break;
    case 'varita':
      b.setIfFilled(12, 19, a);
      break;
    case 'ganzua':
      b.setIfFilled(6, 18, P.oak);
      b.setIfFilled(6, 19, m[2]);
      break;
  }
}

// ---------- Retrato (40×48) ----------

/** Lo que va por detrás de la figura del retrato (se pinta antes que la cabeza). */
export function gearPortraitBack(b: PixelBuffer, g: GearMark): void {
  const m = METAL[g.rarity];
  const a = ACCENT[g.rarity];
  switch (g.icon) {
    case 'espada':
      // Empuñadura sobre el hombro derecho.
      line(b, 35, 47, 30, 26, m[1], false);
      line(b, 36, 46, 31, 26, m[2], false);
      line(b, 27, 33, 35, 31, P.gold, false);
      line(b, 31, 25, 31, 22, P.oak, false);
      b.set(31, 21, a);
      b.set(32, 21, a);
      break;
    case 'hacha':
      line(b, 35, 47, 30, 24, P.oak, false);
      for (let y = 20; y <= 28; y++)
        for (let x = 25; x <= 31; x++) {
          const d = Math.abs(y - 24) + Math.max(0, 28 - x);
          if (d < 5) b.set(x, y, d === 4 || x === 25 ? m[2] : m[1]);
        }
      break;
    case 'escudo':
      for (let y = 30; y <= 47; y++)
        for (let x = 0; x <= 14; x++) {
          const d = Math.hypot(x - 6, y - 40);
          if (d <= 9) b.set(x, y, d > 7.6 ? m[2] : d < 2 ? a : P.wine);
        }
      break;
    case 'capa': {
      const [dark, light] = CAPE[g.rarity];
      for (let y = 36; y < 48; y++)
        for (let x = 0; x < 40; x++) {
          const edge = Math.abs(x - 20) > 18 - (y - 36) * 0.4;
          if (!edge) b.set(x, y, (x + y) % 7 === 0 ? dark : light);
        }
      break;
    }
  }
}

/** Lo que va por delante (después de la ropa). */
export function gearPortraitFront(b: PixelBuffer, g: GearMark): void {
  const m = METAL[g.rarity];
  const a = ACCENT[g.rarity];
  const sparkle = (x: number, y: number) => {
    if (g.rarity < 2) return;
    b.set(x, y, P.white);
    b.set(x - 1, y, P.lemon);
    b.set(x + 1, y, P.lemon);
    b.set(x, y - 1, P.lemon);
    b.set(x, y + 1, P.lemon);
  };
  switch (g.icon) {
    case 'coraza':
      // Hombreras de placas.
      for (const cx of [6, 33]) {
        for (let y = 38; y < 48; y++)
          for (let x = cx - 7; x <= cx + 7; x++) {
            const d = Math.hypot((x - cx) * 0.8, y - 44);
            if (d < 6.5) b.set(x, y, d > 5.3 ? m[0] : y < 42 ? m[2] : m[1]);
          }
        b.set(cx, 42, a);
      }
      sparkle(9, 39);
      break;
    case 'capa':
      // Broche del cuello.
      for (let y = 41; y <= 43; y++) for (let x = 19; x <= 21; x++) b.set(x, y, m[1]);
      b.set(20, 42, a);
      sparkle(23, 40);
      break;
    case 'amuleto':
      line(b, 15, 39, 20, 44, P.ebony, false);
      line(b, 25, 39, 20, 44, P.ebony, false);
      for (let y = 44; y <= 47; y++) for (let x = 19; x <= 21; x++) b.set(x, y, m[1]);
      b.set(20, 45, a);
      b.set(20, 46, a);
      sparkle(23, 45);
      break;
    case 'varita':
      line(b, 35, 47, 31, 37, P.oak, false);
      b.set(31, 36, a);
      b.set(30, 35, P.white);
      b.set(32, 35, a);
      b.set(30, 37, a);
      sparkle(33, 33);
      break;
    case 'espada':
      sparkle(33, 20);
      break;
    case 'hacha':
      sparkle(27, 19);
      break;
    case 'escudo':
      sparkle(10, 34);
      break;
    case 'botas':
    case 'ganzua':
      // No se ven en el retrato: una insignia pequeña en el pecho.
      b.set(26, 44, m[2]);
      b.set(27, 44, a);
      b.set(26, 45, a);
      b.set(27, 45, m[1]);
      break;
  }
}
