/**
 * Arte de la forja: mejora el objeto que lleva cada héroe. En el primer hueco, la fragua de
 * ladrillo con las brasas (el fuego alumbra la sala) y su campana hasta el techo, el fuelle
 * desde el nivel 2, y el yunque en su tocón con las herramientas colgadas encima; bajo la
 * ventana, la artesa de templar; en los demás huecos, el banco de trabajo y las hojas acabadas.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { stoneWall } from '../../paint';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FORGE,
  WALL,
  W,
  at,
  bx,
  cellsOf,
  fire,
  row,
  stretchesOf,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { web } from './piezas';

const BRICK = [P.plum, P.rust, P.brick, P.amber] as const;
const STONE = [P.black, P.navy, P.slate, P.steel, P.fog] as const;

/** Dónde va la fragua y dónde el yunque (en el primer hueco). */
const FORGE_X = 20;
const ANVIL_X = 51;

// ---------- Piezas ----------

/** La fragua: hogar de ladrillo con la cama de brasas, campana y tiro; fuelle con nivel. */
export function forge(level: number, lit: boolean): PixelBuffer {
  const w = 30;
  const h = 64;
  return Prop.piece(w, h, (p) => {
    // Tiro y campana de piedra ennegrecida.
    stoneWall(p, 10, 0, 10, 12, 'tiro-forja', { ramp: STONE, bw: 5, bh: 3 });
    for (let y = 12; y < 34; y++) {
      const hw = Math.round(5 + ((y - 12) / 21) * 10);
      const x0 = 15 - hw;
      p.hline(x0, y, hw * 2, y > 26 ? P.black : y % 3 ? P.navy : P.slate);
      p.set(x0, y, P.steel);
      p.set(x0 + hw * 2 - 1, y, P.black);
    }
    p.rect(0, 33, w, 2, P.slate);
    p.hline(0, 33, w, P.fog);
    // Hogar de ladrillo con la cama de brasas encima.
    stoneWall(p, 1, 40, 28, 24, 'hogar-forja', { ramp: BRICK, bw: 6, bh: 3 });
    p.rect(0, 38, w, 3, P.slate);
    p.hline(0, 38, w, P.steel);
    p.rect(4, 35, 22, 3, P.black);
    if (lit) {
      for (let x = 5; x < 25; x += 2) p.set(x, 36, x % 4 ? P.orange : P.gold);
      p.hline(7, 37, 16, P.brick);
      p.set(13, 35, P.lemon);
      p.set(17, 35, P.lemon);
    } else {
      for (let x = 5; x < 25; x += 3) p.set(x, 36, P.steel);
      web(p, 2, 13, 1);
    }
    // Boca de la ceniza abajo.
    p.rect(10, 54, 10, 10, P.black);
    p.hline(10, 54, 10, P.plum);
    if (level >= 2 && lit) {
      // Fuelle de cuero colgado del costado, con su tobera hacia el fuego.
      p.poly(
        [
          [0, 42],
          [7, 44],
          [7, 50],
          [0, 52],
        ],
        P.umber,
      );
      for (const y of [44, 47, 50]) p.hline(0, y, 7, P.mocha);
      p.rect(7, 46, 3, 2, P.slate);
      p.vline(0, 40, 14, W[4]!);
    }
    if (level >= 3 && lit) {
      // Tenazas con una pieza al rojo en las brasas.
      p.line(19, 30, 24, 35, P.slate);
      p.rect(21, 35, 4, 2, P.orange);
      p.set(22, 35, P.lemon);
    }
  });
}

/** El yunque en su tocón (con una hoja encima desde el nivel 2). */
export function anvil(level: number, rusty = false): PixelBuffer {
  return Prop.piece(16, 16, (p) => {
    // Tocón.
    p.rect(4, 9, 9, 7, W[3]!);
    p.vline(4, 9, 7, W[4]!);
    p.vline(12, 9, 7, W[2]!);
    p.hline(4, 9, 9, W[5]!);
    // Yunque con su cuerno.
    const [d, m, l] = rusty ? [P.plum, P.rust, P.clay] : [P.navy, P.slate, P.fog];
    p.rect(3, 2, 12, 3, m);
    p.hline(3, 2, 12, l);
    p.poly(
      [
        [0, 2],
        [3, 2],
        [3, 5],
      ],
      m,
    );
    p.rect(6, 5, 6, 2, d);
    p.rect(4, 7, 10, 2, m);
    if (level >= 2 && !rusty) {
      p.hline(5, 1, 8, P.mist);
      p.set(13, 1, W[2]!);
      p.set(14, 1, W[2]!);
    }
  });
}

/** Herramientas colgadas de una barra: martillos, tenazas y lima (más con nivel). */
function tools(level: number): PixelBuffer {
  return Prop.piece(20, 16, (p) => {
    p.hline(0, 0, 20, W[3]!);
    p.hline(0, 1, 20, W[2]!);
    const n = Math.min(5, level + 2);
    for (let k = 0; k < n; k++) {
      const x = 2 + k * 4;
      if (k % 2 === 0) {
        // Martillo, colgado por el mango.
        p.vline(x, 2, 9, W[5]!);
        p.rect(x - 2, 11, 5, 3, P.steel);
        p.hline(x - 2, 11, 5, P.mist);
      } else {
        // Tenazas.
        p.vline(x - 1, 2, 9, P.fog);
        p.vline(x + 1, 2, 9, P.steel);
        p.line(x - 1, 11, x, 14, P.fog);
        p.line(x + 1, 11, x, 14, P.fog);
      }
    }
  });
}

/** Artesa de templar: agua (con vapor desde el nivel 3). */
function trough(level: number): PixelBuffer {
  return Prop.piece(22, 18, (p) => {
    p.rect(0, 8, 22, 10, W[3]!);
    p.hline(0, 8, 22, W[5]!);
    for (const y of [11, 15]) p.hline(0, y, 22, P.slate);
    p.rect(2, 9, 18, 2, P.ocean);
    p.hline(3, 9, 6, P.sky);
    if (level >= 2) {
      // Tenazas metidas en el agua.
      p.line(14, 2, 18, 9, P.slate);
      p.line(16, 2, 19, 9, P.steel);
    }
    if (level >= 3)
      for (let k = 0; k < 3; k++) {
        p.set(6 + k * 4, 6 - k, P.mist);
        p.set(7 + k * 4, 4 - k, P.fog);
      }
  });
}

/** Montón de carbón y mineral. */
function coal(): PixelBuffer {
  return Prop.piece(12, 7, (p) => {
    p.ellipse(6, 7, 6, 5, P.black);
    p.ellipse(5, 6.5, 4, 3.5, P.navy);
    for (const [x, y] of [
      [3, 5],
      [6, 3],
      [9, 5],
      [5, 6],
    ])
      p.set(x!, y!, P.slate);
    p.set(9, 4, P.rust);
  });
}

/** Banco de trabajo: tornillo, limas y lingotes (al rojo en el nivel 3). */
function bench(level: number): PixelBuffer {
  return Prop.piece(30, 18, (p) => {
    p.rect(0, 7, 30, 3, W[4]!);
    p.hline(0, 7, 30, W[5]!);
    p.hline(0, 9, 30, W[2]!);
    p.rect(2, 10, 3, 8, W[3]!);
    p.rect(25, 10, 3, 8, W[3]!);
    p.hline(5, 14, 20, W[2]!);
    // Tornillo de banco.
    p.rect(2, 3, 5, 4, P.slate);
    p.hline(2, 3, 5, P.fog);
    p.vline(7, 2, 4, P.steel);
    // Lingotes.
    const hot = level >= 3;
    for (let k = 0; k < Math.min(3, level + 1); k++) {
      p.rect(12 + k * 5, 5, 4, 2, hot && k === 0 ? P.orange : P.steel);
      p.hline(12 + k * 5, 5, 4, hot && k === 0 ? P.lemon : P.fog);
    }
  });
}

/** Hojas acabadas en la pared: espadas y un hacha (desde el nivel 2). */
function blades(level: number): PixelBuffer {
  return Prop.piece(24, 26, (p) => {
    p.hline(0, 0, 24, W[3]!);
    p.hline(0, 1, 24, W[2]!);
    const n = level >= 3 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const x = 3 + k * 6;
      p.hline(x - 1, 3, 3, P.gold);
      p.vline(x, 2, 3, W[2]!);
      p.vline(x, 4, 20, P.mist);
      p.vline(x + 1, 4, 19, P.fog);
      p.set(x, 24, P.white);
    }
  });
}

/** Herradura de la suerte, con sus clavos. */
function horseshoe(): PixelBuffer {
  return Prop.piece(10, 10, (p) => {
    // Un aro abierto por arriba: la mitad de abajo de un anillo y dos brazos rectos.
    p.ellipse(5, 5, 5, 5, (_x, y, d) => (d > 0.36 && y >= 5 ? P.fog : 0));
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (p.get(x, y) === 0) p.clear(x, y);
    p.rect(0, 1, 2, 5, P.fog);
    p.rect(8, 1, 2, 5, P.fog);
    p.vline(0, 1, 6, P.mist);
    for (const [x, y] of [
      [1, 3],
      [8, 3],
      [2, 8],
      [7, 8],
    ])
      p.set(x!, y!, P.slate);
  });
}

/** Afiladora grande de pedal: la rueda de piedra en su banco, con el asiento. */
function bigWheel(): PixelBuffer {
  return Prop.piece(26, 28, (p) => {
    p.rect(0, 20, 26, 3, W[4]!);
    p.hline(0, 20, 26, W[5]!);
    p.rect(1, 23, 3, 5, W[3]!);
    p.rect(22, 23, 3, 5, W[3]!);
    p.vline(9, 6, 14, W[3]!);
    p.vline(17, 6, 14, W[3]!);
    p.ellipse(13, 10, 9, 9, P.slate);
    p.ellipse(13, 10, 8, 8, P.steel);
    p.ellipse(12, 9, 5, 5, P.fog);
    p.ellipse(13, 10, 1.5, 1.5, P.navy);
    // Chispas del filo.
    p.set(4, 4, P.lemon);
    p.set(2, 6, P.gold);
    p.set(3, 2, P.orange);
    // Pedal.
    p.line(20, 27, 25, 24, W[2]!);
  });
}

/** Horno de fundir: torre de ladrillo con el crisol al rojo arriba y la boca abajo. */
function smelter(lit: boolean): PixelBuffer {
  return Prop.piece(24, 46, (p) => {
    p.rect(9, 0, 6, 10, P.slate);
    p.vline(9, 0, 10, P.steel);
    stoneWall(p, 1, 8, 22, 38, 'horno-fundir', {
      ramp: [P.plum, P.rust, P.brick, P.amber],
      bw: 5,
      bh: 3,
    });
    for (const y of [14, 30]) {
      p.hline(0, y, 24, P.slate);
      p.hline(0, y + 1, 24, P.navy);
    }
    // Boca del fuego.
    p.rect(7, 36, 10, 10, P.black);
    if (lit) {
      p.hline(8, 44, 8, P.orange);
      p.hline(9, 43, 6, P.gold);
      // Crisol al rojo en su ventanuco.
      p.rect(8, 19, 8, 7, P.black);
      p.rect(9, 21, 6, 4, P.orange);
      p.hline(10, 21, 4, P.lemon);
    } else p.rect(8, 19, 8, 7, P.black);
  });
}

/** Montón de mineral y unos lingotes. */
function ore(): PixelBuffer {
  return Prop.piece(16, 9, (p) => {
    p.ellipse(6, 9, 6, 5, P.umber);
    p.ellipse(5, 8, 4, 3, P.mocha);
    for (const [x, y] of [
      [3, 6],
      [6, 5],
      [8, 7],
    ])
      p.set(x!, y!, P.rust);
    p.rect(10, 6, 5, 2, P.steel);
    p.hline(10, 6, 5, P.fog);
    p.rect(11, 4, 4, 2, P.steel);
    p.hline(11, 4, 4, P.mist);
  });
}

/** Cubo de agua con unas tenazas (bajo una ventana). */
function waterBucket(): PixelBuffer {
  return Prop.piece(12, 16, (p) => {
    p.rect(1, 7, 10, 9, W[3]!);
    p.vline(1, 7, 9, W[4]!);
    for (const y of [9, 14]) p.hline(1, y, 10, P.slate);
    p.hline(2, 7, 8, P.ocean);
    p.line(4, 0, 6, 7, P.slate);
    p.line(7, 0, 7, 7, P.steel);
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const w = cells.at(-1)!.x1;
  for (const s of stretchesOf(room, w)) {
    // Encima del yunque, las herramientas; encima del banco, las hojas acabadas (nivel 2).
    if (s.kind === 'left') b.blit(tools(room.level), bx(s.x0 + ANVIL_X) - 10, 24);
    if (s.kind === 'mid' && s.i === 1 && room.level >= 2)
      b.blit(blades(room.level), bx(s.x0 + 26) - 12, 14);
  }
  // Sin ventana, en su sitio: la herradura, unas tenazas cruzadas o un escudo sin pintar.
  cells.forEach((c, j) => {
    if (c.glass) return;
    const x = bx(c.win);
    if (j % 3 === 0) b.blit(horseshoe(), x - 5, 18);
    else if (j % 3 === 1) {
      b.line(x - 7, 14, x + 7, 30, P.fog);
      b.line(x + 7, 14, x - 7, 30, P.steel);
      b.rect(x - 1, 21, 3, 2, P.slate);
    } else {
      b.ellipse(x, 22, 7, 8, P.slate);
      b.ellipse(x - 0.5, 21.5, 6, 7, P.steel);
      b.ellipse(x, 22, 1.5, 1.5, P.fog);
    }
  });
}

/**
 * La pequeña: la fragua con el yunque y la artesa. Las anchas suman el banco de trabajo con
 * la afiladora grande (primer tramo de en medio) y el horno de fundir con el mineral (segundo).
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      t.push(
        at(forge(lvl, true), s.x0 + FORGE_X, WALL + 2, 0, fire(28, 80 + lvl * 15, FORGE, true)),
      );
      t.push(at(anvil(lvl), s.x0 + ANVIL_X, WALL));
    } else if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          [bench(lvl), WALL],
          [bigWheel(), WALL - 2],
        ]),
      );
    else if (s.kind === 'mid')
      t.push(
        ...row(s, [
          [smelter(lvl >= 2), WALL + 2, lvl >= 2 ? fire(22, 60, FORGE, false) : undefined],
          [ore(), WALL - 2],
        ]),
      );
    else t.push(at(coal(), Math.min(s.x0 + 7, w - 9), WALL - 2));
  }
  cellsOf(room, w).forEach((c, j) =>
    t.push(at(j === 1 ? waterBucket() : trough(lvl), c.win - 1, WALL)),
  );
  return t;
}

/** Por reparar: la fragua fría, el yunque oxidado y unas cajas. */
function ruin(room: Room, w: number): Thing[] {
  const t: Thing[] = [at(forge(1, false), FORGE_X, WALL + 2), at(anvil(1, true), ANVIL_X, WALL)];
  for (const c of cellsOf(room, w)) t.push(at(Prop.crate(), c.win, WALL));
  for (const s of stretchesOf(room, w))
    if (s.kind === 'mid') t.push(at(smelter(false), (s.x0 + s.x1) / 2, WALL + 2));
  return t;
}

export const forja: RoomArt = { wall, things, ruin };
