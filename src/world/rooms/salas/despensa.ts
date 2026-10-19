/**
 * Arte de la despensa: guarda la comida (no tiene ventanas). En cada hueco, una estantería con
 * quesos, panes y tarros; a su lado, jamones y chorizos colgados de una barra en la pared con
 * las cajas de fruta debajo, y los sacos de grano en el rincón. Con el nivel se va llenando.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { WALL, WIN_HALF, W, at, bx, cellsOf, type RoomArt, type Thing, type WallCtx } from './kit';
import { cheese, jar, loaf, sack, shelf, web } from './piezas';

// ---------- Piezas ----------

/** Estantería de tres baldas: quesos arriba, panes en medio y tarros abajo (más con nivel). */
export function pantryShelf(level: number, seed: number, broken = false): PixelBuffer {
  return Prop.piece(30, 46, (p) => {
    p.rect(0, 0, 3, 46, W[3]!);
    p.rect(27, 0, 3, 46, W[3]!);
    p.vline(0, 0, 46, W[4]!);
    p.vline(27, 0, 46, W[4]!);
    p.rect(3, 1, 24, 44, W[1]!);
    const rows = [14, 28, 42];
    rows.forEach((y, i) => {
      if (broken && i === 1) {
        p.line(3, y, 26, y + 4, W[4]!);
        p.line(3, y + 1, 26, y + 5, W[2]!);
      } else shelf(p, 3, y, 24);
    });
    p.rect(0, 0, 30, 2, W[4]!);
    p.hline(0, 0, 30, W[5]!);
    if (broken) {
      web(p, 4, 2, 1);
      p.rect(8, 40, 3, 2, P.clay);
      p.set(13, 41, P.rust);
      return;
    }
    const full = Math.min(4, level + 1);
    // Quesos.
    for (let k = 0; k < Math.min(3, full); k++) cheese(p, 4 + k * 7, 14);
    if (level >= 3) cheese(p, 8, 10);
    // Panes.
    for (let k = 0; k < full; k++) loaf(p, 4 + k * 6, 28);
    // Tarros.
    for (let k = 0; k < full + 1; k++) jar(p, 4 + k * 5, 42, seed + k, (k + seed) % 3 === 0);
  });
}

/** Barra de pared con jamones, chorizos y una ristra de ajos (cuantos más, más nivel). */
function hangers(level: number): PixelBuffer {
  return Prop.piece(24, 20, (p) => {
    p.hline(0, 0, 24, P.slate);
    p.hline(0, 1, 24, P.navy);
    const items = Math.min(4, level + 1);
    for (let k = 0; k < items; k++) {
      const x = 3 + k * 6;
      p.vline(x, 2, 2, P.black);
      if (k % 2 === 0) {
        // Jamón.
        p.ellipse(x, 10, 2.6, 5, P.brick);
        p.ellipse(x - 0.5, 9, 1, 2.2, P.coral);
        p.set(x, 15, P.sand);
        p.set(x, 16, P.sand);
      } else if (k === 3) {
        // Ristra de ajos.
        p.vline(x, 4, 12, P.tan);
        for (let j = 0; j < 4; j++)
          p.ellipse(x + (j % 2 ? 0.5 : -0.5), 6 + j * 3, 1.5, 1.4, P.sand);
      } else
        for (let j = 0; j < 4; j++) {
          // Chorizos en lazo.
          p.rect(x - 1, 4 + j * 3, 2, 3, j % 2 ? P.red : P.wine);
          p.set(x, 4 + j * 3, P.coral);
        }
    }
  });
}

/** Caja de fruta: manzanas o nabos asomando. */
function fruitCrate(kind: number): PixelBuffer {
  return Prop.piece(16, 12, (p) => {
    const [a, b] = kind % 2 ? [P.white, P.rose] : [P.red, P.wine];
    for (let x = 1; x < 15; x += 3) {
      p.ellipse(x + 1, 3, 1.6, 1.6, a);
      p.set(x + 2, 4, b);
    }
    if (kind % 2) for (let x = 2; x < 15; x += 3) p.set(x, 0, P.leaf);
    p.rect(0, 4, 16, 8, W[4]!);
    p.hline(0, 4, 16, W[5]!);
    p.hline(0, 8, 16, W[3]!);
    p.hline(0, 11, 16, W[2]!);
    p.vline(0, 4, 8, W[3]!);
    p.vline(15, 4, 8, W[3]!);
  });
}

/** Cajas de fruta apiladas y, con nivel, el barril de salazón. */
function crates(level: number, seed: number): PixelBuffer {
  return Prop.piece(27, 26, (p) => {
    p.blit(fruitCrate(seed), 0, 14);
    if (level >= 2) p.blit(fruitCrate(seed + 1), 1, 2);
    // Barril de salazón.
    if (level >= 3) p.blit(Prop.barrel(), 15, 11);
  });
}

/** Sacos de grano apilados. */
function grain(level: number): PixelBuffer {
  return Prop.piece(16, 16, (p) => {
    sack(p, 0, 6);
    if (level >= 2) sack(p, 8, 6, [P.rust, P.clay, P.tan]);
    if (level >= 3) sack(p, 4, 0, [P.tan, P.sand, P.white]);
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  for (const c of cells) {
    const x = bx(c.win) - 12;
    if (ruin) {
      // La barra vacía con un gancho suelto.
      b.hline(x, 16, 24, P.slate);
      b.vline(x + 9, 17, 3, P.black);
      continue;
    }
    b.blit(hangers(room.level), x, 16);
  }
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  return cellsOf(room, w).flatMap((c) => [
    at(pantryShelf(lvl, c.i), c.x0 + 24, WALL),
    at(crates(lvl, c.i), c.win - 6, WALL),
    at(grain(lvl), c.win + WIN_HALF + 5, WALL - 2),
  ]);
}

function ruin(room: Room, w: number): Thing[] {
  return cellsOf(room, w).flatMap((c) => [
    at(pantryShelf(0, c.i, true), c.x0 + 24, WALL),
    at(Prop.crate(), c.win - 6, WALL),
    at(Prop.brokenChair(), c.win + WIN_HALF + 4, 18),
  ]);
}

export const despensa: RoomArt = { wall, things, ruin };
