/**
 * Arte de la capilla: moral para todos y una vela por cada caído. Las ventanas son vidrieras;
 * el altar va bajo la del hueco de en medio (la vidriera hace de retablo) con sus velas, y en
 * los demás, un reclinatorio. A la izquierda de cada ventana, la imagen del santo y el
 * candelabro de las velas de los caídos (más velas con el nivel); a la derecha, la pila del
 * agua bendita. Los bancos van delante, bajos. Desde el nivel 2, la lápida con los nombres.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  CANDLE,
  FLOOR_D,
  FRONT,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  cellsOf,
  lampOver,
  type Cell,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, web } from './piezas';

/** El hueco del altar: el de en medio. */
const mid = (cells: Cell[]) => cells[Math.floor((cells.length - 1) / 2)]!;

// ---------- Piezas ----------

/** Altar de piedra con su paño, el cáliz y las velas (más altas y doradas con nivel). */
function altar(level: number): PixelBuffer {
  return Prop.piece(30, 24, (p) => {
    p.rect(1, 10, 28, 14, P.steel);
    p.hline(1, 10, 28, P.mist);
    p.rect(3, 12, 24, 10, P.fog);
    for (let x = 5; x < 26; x += 5) p.vline(x, 12, 10, P.steel);
    // Paño con el borde dorado.
    p.rect(0, 9, 30, 4, level >= 2 ? P.wine : P.white);
    p.hline(0, 12, 30, level >= 2 ? P.gold : P.mist);
    p.rect(11, 13, 8, 6, level >= 2 ? P.wine : P.white);
    p.hline(11, 18, 8, P.gold);
    // Cáliz en medio.
    p.rect(14, 4, 3, 3, P.gold);
    p.set(15, 7, P.orange);
    p.hline(14, 8, 3, P.gold);
    p.set(14, 4, P.lemon);
    // Velas.
    const n = Math.min(4, level + 1);
    for (let k = 0; k < n; k++) {
      const x = k < 2 ? 3 + k * 4 : 24 - (k - 2) * 4;
      p.rect(x - 1, 8, 4, 1, P.gold);
      candleOn(p, x, 8, level >= 3 ? 6 : 4);
    }
  });
}

/** Candelabro de las velas de los caídos: filas de velitas (más cuanto más nivel). */
function votive(level: number): PixelBuffer {
  return Prop.piece(20, 26, (p) => {
    p.vline(9, 10, 14, W[3]!);
    p.vline(10, 10, 14, W[2]!);
    p.rect(5, 24, 10, 2, W[3]!);
    const rows = Math.min(3, level);
    for (let r = 0; r < rows; r++) {
      const y = 10 - r * 4 + 4 * (rows - 1);
      p.rect(1, y, 18, 2, P.gold);
      p.hline(1, y, 18, P.lemon);
      for (let x = 2; x < 18; x += 3) {
        p.vline(x, y - 2, 2, P.white);
        p.set(x, y - 3, (x + r) % 2 ? P.gold : P.lemon);
      }
    }
  });
}

/** Imagen del santo en su peana. */
function saint(): PixelBuffer {
  return Prop.piece(14, 36, (p) => {
    p.rect(1, 28, 12, 8, P.steel);
    p.hline(1, 28, 12, P.mist);
    p.rect(0, 27, 14, 2, P.fog);
    // Túnica, manos juntas y cabeza con aureola.
    p.poly(
      [
        [4, 10],
        [10, 10],
        [12, 27],
        [2, 27],
      ],
      P.ocean,
    );
    p.vline(4, 11, 15, P.sky);
    p.rect(5, 10, 4, 6, P.sky);
    p.rect(6, 14, 2, 2, P.skin);
    // Aureola (un arco dorado por detrás de la cabeza) y la cabeza con el pelo.
    for (let x = 2; x <= 12; x++) {
      const y = Math.round(5 - Math.sqrt(Math.max(0, 25 - (x - 7) ** 2)) * 0.8);
      p.set(x, y + 1, P.gold);
    }
    p.ellipse(7, 6, 2.6, 3, P.skin);
    p.vline(9, 5, 3, P.skinS);
    p.hline(5, 3, 5, P.umber);
    p.set(5, 4, P.umber);
  });
}

/** Banco de iglesia con su respaldo (bajo: va delante). */
function pew(): PixelBuffer {
  return Prop.piece(30, 8, (p) => {
    p.rect(0, 0, 30, 2, W[3]!);
    p.hline(0, 0, 30, W[5]!);
    p.rect(0, 4, 30, 2, W[4]!);
    p.hline(0, 4, 30, W[5]!);
    p.rect(1, 2, 2, 6, W[2]!);
    p.rect(27, 2, 2, 6, W[2]!);
  });
}

/** Reclinatorio con un libro de horas. */
function kneeler(): PixelBuffer {
  return Prop.piece(16, 18, (p) => {
    p.rect(1, 4, 14, 3, W[4]!);
    p.hline(1, 4, 14, W[5]!);
    p.rect(3, 7, 2, 11, W[3]!);
    p.rect(11, 7, 2, 11, W[3]!);
    p.rect(0, 14, 16, 3, P.wine);
    p.hline(0, 14, 16, P.red);
    p.rect(5, 2, 6, 2, P.wine);
    p.hline(5, 2, 6, P.white);
  });
}

/** Pila de agua bendita en su pie. */
function font(): PixelBuffer {
  return Prop.piece(10, 16, (p) => {
    p.rect(3, 6, 4, 9, P.steel);
    p.vline(3, 6, 9, P.fog);
    p.rect(2, 14, 6, 2, P.slate);
    p.ellipse(5, 4, 5, 2.5, P.fog);
    p.ellipse(5, 3.5, 3.5, 1.2, P.sky);
  });
}

/** Lápida de los caídos: piedra con renglones grabados. */
function plaque(level: number): PixelBuffer {
  return Prop.piece(14, 12, (p) => {
    p.rect(0, 0, 14, 12, P.steel);
    p.rect(1, 1, 12, 10, P.fog);
    p.hline(1, 1, 12, P.mist);
    for (let k = 0; k < 2 + level; k++) p.hline(3, 3 + k * 2, 8 - (k % 3) * 2, P.slate);
  });
}

/** Disco del sol, el símbolo del templo (donde no hay vidriera). */
function sun(b: PixelBuffer, x: number, y: number) {
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.line(x, y, Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 9), P.orange);
  }
  b.ellipse(x, y, 5, 5, P.gold);
  b.ellipse(x - 1, y - 1, 3, 3, P.lemon);
}

// ---------- Pared, suelo y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  for (const c of cells) {
    if (!c.glass) sun(b, bx(c.win), 24);
    // La lápida, entre la imagen del santo y el candelabro, arriba (desde el nivel 2).
    if (room.level >= 2 && c === mid(cells)) b.blit(plaque(room.level), bx(c.x0 + 34) - 7, 14);
  }
}

function floor(b: PixelBuffer, room: Room, cells: Cell[]): void {
  // La alfombra hasta el altar.
  const c = mid(cells);
  const x0 = Math.round(c.win - 13);
  const [edge, base] = room.level >= 3 ? [P.gold, P.wine] : [P.wine, P.grape];
  b.rect(x0, 2, 26, FLOOR_D - 4, edge);
  b.rect(x0 + 2, 2, 22, FLOOR_D - 4, base);
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const cells = cellsOf(room, w);
  const m = mid(cells);
  const t: Thing[] = [lampOver(cells, w)];
  for (const c of cells) {
    t.push(at(saint(), c.x0 + 17, WALL));
    t.push(
      at(votive(lvl), c.x0 + 46, WALL, 0, {
        dy: 14,
        r: 30 + lvl * 8,
        color: CANDLE,
        power: 0.35 + lvl * 0.1,
        flicker: 0.15,
      }),
    );
    if (c === m)
      t.push(
        at(altar(lvl), c.win, WALL, 0, {
          dy: 14,
          r: 60,
          color: CANDLE,
          power: 0.7,
          flicker: 0.15,
          flames: [-12, 12].map((dx) => ({ dx, dy: 1, size: 0.3 })),
        }),
      );
    else t.push(at(kneeler(), c.win, WALL));
    t.push(at(font(), Math.min(c.win + WIN_HALF + 7, c.x1 - 7), WALL));
    // Bancos delante, a los lados del pasillo del altar.
    if (lvl >= 1) t.push(at(pew(), c.x0 + 34, FRONT + 2));
    if (lvl >= 2 && c !== m) t.push(at(pew(), c.win, FRONT + 2));
  }
  return t;
}

/** Por reparar: la imagen caída, bancos rotos y telarañas. */
function ruin(room: Room, w: number): Thing[] {
  const fallen = new PixelBuffer(36, 14);
  const s = saint();
  // La imagen tumbada en el suelo.
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = s.data[y * s.w + x]!;
      if (c) fallen.data[x * fallen.w + (s.h - 1 - y)] = c;
    }
  const broken = pew();
  web(broken, 1, 0, 1);
  broken.rect(12, 0, 4, 8, 0);
  return cellsOf(room, w).flatMap((c) => [
    at(fallen, c.x0 + 26, WALL),
    at(broken, c.win, FRONT + 2),
  ]);
}

export const capilla: RoomArt = { wall, things, ruin, floor, ownLamp: true };
