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
import {
  WALL,
  W,
  at,
  bx,
  cellsOf,
  row,
  stretchesOf,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
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

/** Secadero: bastidor de madera con jamones y chorizos curándose (más con el nivel). */
function dryingRack(level: number): PixelBuffer {
  return Prop.piece(30, 40, (p) => {
    p.rect(0, 0, 2, 40, W[3]!);
    p.rect(28, 0, 2, 40, W[3]!);
    p.vline(0, 0, 40, W[4]!);
    for (const y of [2, 20]) {
      p.rect(0, y, 30, 2, W[4]!);
      p.hline(0, y, 30, W[5]!);
    }
    const n = Math.min(4, level + 1);
    for (const [row, y] of [
      [0, 4],
      [1, 22],
    ] as const)
      for (let k = 0; k < n; k++) {
        const x = 5 + k * 6;
        p.vline(x, y, 2, P.black);
        if ((k + row) % 2 === 0) {
          p.ellipse(x, y + 8, 2.5, 5, P.brick);
          p.ellipse(x - 0.5, y + 7, 1, 2, P.coral);
          p.set(x, y + 13, P.sand);
        } else
          for (let j = 0; j < 4; j++) {
            p.rect(x - 1, y + 2 + j * 3, 2, 3, j % 2 ? P.red : P.wine);
            p.set(x, y + 2 + j * 3, P.coral);
          }
      }
    p.rect(0, 37, 30, 3, W[2]!);
  });
}

/** Dos barriles de salazón con sus tapas (y un pescado asomando). */
function saltBarrels(): PixelBuffer {
  return Prop.piece(26, 17, (p) => {
    p.blit(Prop.barrel(), 0, 2);
    p.blit(Prop.barrel(), 13, 2);
    p.ellipse(19, 2.5, 3, 1.5, P.fog);
    p.set(21, 1, P.steel);
  });
}

/** Balanza en su mesa, con las pesas y el libro de las cuentas. */
function scaleTable(level: number): PixelBuffer {
  return Prop.piece(26, 24, (p) => {
    p.rect(0, 14, 26, 3, W[4]!);
    p.hline(0, 14, 26, W[5]!);
    p.rect(2, 17, 3, 7, W[3]!);
    p.rect(21, 17, 3, 7, W[3]!);
    // Balanza.
    p.vline(12, 3, 11, P.gold);
    p.hline(5, 3, 15, P.gold);
    p.vline(6, 4, 4, P.orange);
    p.vline(18, 4, 4, P.orange);
    p.hline(3, 8, 7, P.orange);
    p.hline(15, 8, 7, P.orange);
    p.ellipse(18, 7, 2, 1.2, P.red);
    p.rect(10, 12, 5, 2, P.gold);
    // Pesas y el libro.
    p.rect(1, 11, 2, 3, P.slate);
    p.rect(3, 12, 2, 2, P.slate);
    if (level >= 2) {
      p.rect(19, 11, 6, 3, P.wine);
      p.hline(19, 11, 6, P.white);
    }
  });
}

/** Cesto de huevos y verduras. */
function basket(): PixelBuffer {
  return Prop.piece(16, 11, (p) => {
    for (const [x, c] of [
      [3, P.white],
      [6, P.sand],
      [9, P.white],
      [12, P.lime],
    ] as const)
      p.ellipse(x, 3, 1.8, 1.8, c);
    p.rect(1, 4, 14, 7, P.tan);
    for (let x = 1; x < 15; x += 2) p.vline(x, 4, 7, P.clay);
    p.hline(1, 4, 14, P.sand);
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  cells.forEach((c, j) => {
    const x = bx(c.win) - 12;
    if (ruin) {
      // La barra vacía con un gancho suelto.
      b.hline(x, 16, 24, P.slate);
      b.vline(x + 9, 17, 3, P.black);
      return;
    }
    // Encima de cada sitio de ventana: la barra de jamones o, en el tercero, la pizarra.
    if (j === 2) {
      b.rect(x + 2, 14, 20, 14, W[3]!);
      b.rect(x + 3, 15, 18, 12, P.black);
      for (let k = 0; k < 4; k++) {
        b.hline(x + 5, 17 + k * 2, 5, P.mist);
        b.hline(x + 12, 17 + k * 2, 2 + ((k * 3 + room.level) % 5), P.fog);
      }
    } else b.blit(hangers(room.level), x, 16);
  });
}

/**
 * La pequeña: la estantería, los sacos y las cajas de fruta. Las anchas suman el secadero de
 * jamones con los barriles de salazón (primer tramo de en medio) y el estante de los quesos
 * con la balanza (segundo).
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left')
      t.push(
        ...row(s, [
          [pantryShelf(lvl, 0), WALL],
          [grain(lvl), WALL - 2],
        ]),
      );
    else if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          [dryingRack(lvl), WALL],
          [saltBarrels(), WALL - 2],
        ]),
      );
    else if (s.kind === 'mid')
      t.push(
        ...row(s, [
          [Prop.cheeseShelf(), WALL],
          [scaleTable(lvl), WALL - 2],
        ]),
      );
    else t.push(at(Prop.barrel(), Math.min(s.x0 + 8, w - 9), WALL));
  }
  cellsOf(room, w).forEach((c, j) => t.push(at(j === 1 ? basket() : crates(lvl, j), c.win, WALL)));
  return t;
}

function ruin(room: Room, w: number): Thing[] {
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w))
    if (s.kind !== 'right') t.push(at(pantryShelf(0, s.i, true), s.x0 + 22, WALL));
  for (const c of cellsOf(room, w)) t.push(at(Prop.crate(), c.win - 6, WALL));
  t.push(at(Prop.brokenChair(), w - 12, 18));
  return t;
}

export const despensa: RoomArt = { wall, things, ruin };
