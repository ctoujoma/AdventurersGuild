/**
 * Arte de la cocina: hace la comida del salón y de la casa. En el primer hueco, el fogón con su
 * campana hasta el techo (el fuego alumbra la sala) y los cacharros colgados a su lado; bajo
 * cada ventana, la mesa de trabajo o la pila de fregar; en los demás huecos, la alacena con la
 * loza. Crece con el nivel: del puchero al caldero colgado y al cobre reluciente.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { stoneWall } from '../../paint';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FIRE,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  cellsOf,
  fire,
  type Cell,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { herbs, jar, loaf, sack, shelf, web } from './piezas';

const STONE = [P.black, P.navy, P.slate, P.steel, P.fog] as const;

/** Dónde va el fogón (centro, en el primer hueco). */
const HEARTH_X = 25;

// ---------- Piezas ----------

/** El fogón: hogar de piedra con su campana encalada hasta el techo; encendido o frío. */
export function hearth(level: number, lit: boolean): PixelBuffer {
  const w = 36;
  const h = 64;
  return Prop.piece(w, h, (p) => {
    // Tiro de piedra hasta el techo y campana de entramado: vigas oscuras en los cantos y
    // en medio, yeso ahumado (más negro cerca del fuego).
    stoneWall(p, 11, 0, 14, 12, 'tiro-cocina', { ramp: STONE, bw: 5, bh: 3 });
    for (let y = 10; y < 38; y++) {
      const hw = Math.round(8 + ((y - 10) / 27) * 10);
      const x0 = 18 - hw;
      const soot = y > 30 ? P.rust : y > 24 && (x0 + y) % 2 === 0 ? P.rust : P.clay;
      p.hline(x0, y, hw * 2, soot);
      p.set(x0 + 2, y, P.tan);
      p.hline(x0, y, 2, W[2]!);
      p.hline(x0 + hw * 2 - 2, y, 2, W[1]!);
    }
    p.rect(3, 24, 30, 2, W[3]!);
    p.hline(3, 24, 30, W[4]!);
    p.hline(10, 10, 16, W[3]!);
    // La repisa.
    p.rect(0, 38, w, 4, W[4]!);
    p.hline(0, 38, w, W[5]!);
    p.hline(0, 41, w, W[2]!);
    // El hogar de piedra con su boca.
    stoneWall(p, 0, 42, w, h - 42, 'fogon-cocina', { ramp: STONE, bw: 6, bh: 4 });
    p.rect(7, 49, 22, 15, P.black);
    p.ellipse(18, 49.5, 11, 4, P.black);
    p.hline(8, 63, 20, P.ebony);
    if (lit) {
      // Leños y brasas (las llamas las pone la luz).
      p.hline(10, 62, 16, W[3]!);
      p.hline(11, 61, 6, W[2]!);
      p.hline(19, 61, 6, W[2]!);
      p.hline(12, 60, 12, P.orange);
      p.set(15, 59, P.gold);
      p.set(20, 59, P.gold);
    } else {
      // Ceniza fría y una telaraña en la boca.
      for (let x = 10; x < 26; x += 2) p.set(x, 62, x % 4 ? P.steel : P.fog);
      p.hline(11, 63, 14, P.slate);
      web(p, 8, 47, 1);
    }
    if (level >= 2 && lit) {
      // Caldero colgado de su cadena.
      for (let y = 46; y < 52; y++) p.set(18, y, y % 2 ? P.steel : P.slate);
      p.ellipse(18, 56, 6.5, 4.5, P.black);
      p.ellipse(17, 55, 4, 2.5, P.navy);
      p.hline(11, 52, 15, P.slate);
      p.hline(12, 52, 6, P.steel);
      p.set(15, 54, P.slate);
    } else if (lit) {
      // Puchero sobre las trébedes.
      p.ellipse(18, 57, 4.5, 3, P.black);
      p.hline(14, 54, 9, P.slate);
      p.set(15, 56, P.navy);
      p.vline(14, 59, 2, P.slate);
      p.vline(22, 59, 2, P.slate);
    }
    if (level >= 3) {
      // Ristras de guindillas a los lados de la boca y chorizos en la repisa.
      for (const x of [2, 32]) {
        p.vline(x, 42, 2, P.tan);
        for (let k = 0; k < 4; k++) {
          p.set(x + (k % 2), 44 + k * 2, P.red);
          p.set(x + (k % 2), 45 + k * 2, P.wine);
        }
      }
      for (let x = 8; x < 28; x += 3) {
        p.set(x, 37, P.wine);
        p.set(x + 1, 37, P.red);
        p.set(x + 1, 36, P.wine);
      }
    }
    if (!lit) {
      // Una grieta en la campana.
      p.line(13, 10, 16, 18, P.clay);
      p.line(16, 18, 14, 24, P.clay);
    }
  });
}

/** Mesa de trabajo con lo que se esté guisando: más cosas encima cuanto más nivel. */
export function workTable(level: number): PixelBuffer {
  return Prop.piece(32, 18, (p) => {
    p.rect(0, 7, 32, 3, W[4]!);
    p.hline(0, 7, 32, W[5]!);
    p.hline(0, 9, 32, W[2]!);
    p.rect(2, 10, 3, 8, W[3]!);
    p.rect(27, 10, 3, 8, W[3]!);
    p.hline(5, 14, 22, W[2]!);
    // Tabla de cortar con el cuchillo y unos nabos.
    p.rect(3, 5, 10, 2, W[5]!);
    p.hline(3, 5, 10, W[6]!);
    p.hline(6, 4, 6, P.mist);
    p.set(5, 4, W[2]!);
    for (const x of [15, 19]) {
      p.ellipse(x + 1, 5, 1.6, 1.6, P.white);
      p.set(x + 1, 6, P.rose);
      p.set(x + 1, 2, P.leaf);
      p.set(x, 3, P.lime);
    }
    if (level >= 2) {
      loaf(p, 23, 7);
      p.ellipse(29, 6, 2.5, 1.2, P.slate);
      p.hline(27, 5, 5, P.steel);
    }
    if (level >= 3) {
      // Pollo asado en su fuente.
      p.ellipse(15.5, 6, 6, 1.5, P.mist);
      p.ellipse(15.5, 4.5, 4, 2.5, P.amber);
      p.ellipse(14.5, 3.8, 2, 1.2, P.gold);
      p.set(20, 3, P.sand);
      p.set(11, 3, P.sand);
    }
  });
}

/** La misma mesa, rota: con una pata partida y la tabla caída hacia un lado. */
function brokenTable(): PixelBuffer {
  return Prop.piece(32, 18, (p) => {
    p.line(0, 15, 31, 7, W[4]!);
    p.line(0, 16, 31, 8, W[3]!);
    p.line(0, 17, 31, 9, W[2]!);
    p.rect(27, 10, 3, 8, W[3]!);
    p.rect(3, 14, 6, 2, W[3]!);
    // Cascos de un puchero.
    p.rect(14, 16, 3, 2, P.clay);
    p.set(18, 17, P.rust);
  });
}

/** Cacharros colgados de una barra: cucharón, cuchara de palo, cuchillo y cobre. */
export function utensils(level: number): PixelBuffer {
  return Prop.piece(12, 18, (p) => {
    p.hline(0, 0, 12, W[3]!);
    p.hline(0, 1, 12, W[2]!);
    // Cucharón.
    p.vline(2, 2, 10, P.steel);
    p.ellipse(2, 13, 2, 1.5, P.slate);
    p.hline(1, 12, 3, P.fog);
    // Cuchara de palo.
    p.vline(6, 2, 9, W[4]!);
    p.ellipse(6, 12, 1.4, 2, W[5]!);
    if (level >= 2) {
      // Cuchillo grande.
      p.vline(10, 2, 3, W[2]!);
      p.rect(9, 5, 2, 8, P.mist);
      p.vline(9, 5, 8, P.white);
    }
  });
}

/** Estante de pared con tarros (y ajos colgando con nivel). */
export function jarShelf(level: number, seed: number): PixelBuffer {
  return Prop.piece(11, 18, (p) => {
    shelf(p, 0, 7, 11);
    shelf(p, 0, 15, 11);
    jar(p, 1, 7, seed, level >= 2);
    if (level >= 2) jar(p, 6, 7, seed + 1);
    jar(p, 1, 15, seed + 2);
    if (level >= 3) jar(p, 6, 15, seed + 3, true);
    else if (level >= 2) jar(p, 6, 15, seed + 4);
  });
}

/** Alacena: abajo, puertas; arriba, la loza de pie y las jarras (con nivel, la loza azul). */
export function dresser(level: number): PixelBuffer {
  return Prop.piece(30, 46, (p) => {
    // Cuerpo de arriba.
    p.rect(1, 2, 28, 22, W[3]!);
    p.rect(3, 3, 24, 21, W[2]!);
    p.rect(0, 0, 30, 3, W[4]!);
    p.hline(0, 0, 30, W[5]!);
    for (const y of [11, 19]) shelf(p, 3, y, 24);
    // Platos de pie en el estante de arriba.
    for (let x = 4; x < 26; x += 6) {
      p.ellipse(x + 2.5, 8, 2.8, 2.8, P.fog);
      p.ellipse(x + 2.5, 8, 2, 2, level >= 3 ? P.sky : P.mist);
      p.set(x + 2, 7, P.white);
    }
    // Jarras y tazones en el de abajo.
    p.rect(5, 15, 4, 4, P.clay);
    p.set(9, 16, P.clay);
    p.hline(5, 15, 4, P.tan);
    p.ellipse(16, 17.5, 3, 1.5, P.steel);
    p.hline(13, 16, 7, P.fog);
    p.rect(22, 15, 4, 4, P.mist);
    p.set(21, 16, P.mist);
    p.hline(22, 15, 4, P.white);
    // Encimera y cuerpo de abajo con sus dos puertas.
    p.rect(0, 24, 30, 3, W[5]!);
    p.hline(0, 26, 30, W[2]!);
    p.rect(1, 27, 28, 19, W[3]!);
    for (const x of [3, 16]) {
      p.rect(x, 29, 11, 15, W[4]!);
      p.rect(x + 2, 31, 7, 11, W[3]!);
      p.set(x + (x === 3 ? 9 : 1), 36, P.gold);
    }
    if (level >= 3) p.hline(0, 45, 30, W[1]!);
  });
}

/** Pila de piedra con agua y platos apilados al lado. */
export function sink(level: number): PixelBuffer {
  return Prop.piece(28, 16, (p) => {
    p.rect(2, 12, 3, 4, P.slate);
    p.rect(23, 12, 3, 4, P.slate);
    p.rect(0, 5, 28, 8, P.steel);
    p.hline(0, 5, 28, P.mist);
    p.hline(0, 6, 28, P.fog);
    p.hline(0, 12, 28, P.slate);
    for (let x = 4; x < 26; x += 6) p.vline(x, 8, 4, P.slate);
    p.rect(3, 6, 15, 2, P.ocean);
    p.hline(5, 6, 4, P.sky);
    // Platos apilados.
    const n = 2 + level;
    for (let k = 0; k < n; k++) p.hline(20, 4 - k, 7, k % 2 ? P.mist : P.white);
    p.set(26, 4, P.fog);
  });
}

/** Escoba apoyada en la pared. */
export function broom(): PixelBuffer {
  return Prop.piece(7, 30, (p) => {
    p.vline(3, 0, 22, W[4]!);
    p.vline(4, 0, 22, W[2]!);
    p.rect(2, 21, 4, 2, P.wine);
    for (let x = 0; x < 7; x++)
      p.vline(x, 23, 7 - (x === 0 || x === 6 ? 1 : 0), x % 2 ? P.tan : P.clay);
  });
}

/** Sacos de harina apilados (dos abajo, uno encima). */
export function flourSacks(): PixelBuffer {
  return Prop.piece(17, 16, (p) => {
    sack(p, 0, 6);
    sack(p, 8, 6, [P.rust, P.clay, P.tan]);
    sack(p, 4, 0, [P.tan, P.sand, P.white]);
  });
}

// ---------- Pared del fondo ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const lvl = room.level;
  for (const c of cells) {
    const winL = bx(c.win - WIN_HALF);
    const winR = bx(c.win + WIN_HALF);
    if (c.i === 0) {
      // Los cacharros, entre el fogón y la ventana.
      b.blit(utensils(lvl), winL - 13, 20);
    } else if (lvl < 2) {
      // Sin alacena todavía, un estante con tazones.
      const sx = bx(c.x0) + 6;
      shelf(b, sx, 30, 22);
      for (let k = 0; k < 3; k++) {
        b.ellipse(sx + 4 + k * 7, 28.5, 2.5, 1.5, k % 2 ? P.clay : P.steel);
        b.hline(sx + 2 + k * 7, 27, 5, k % 2 ? P.tan : P.fog);
      }
    }
    // A la derecha de la ventana: tarros en el primero y hierbas en los demás (sin ventana,
    // los tarros van donde iría).
    if (bx(c.x1) - winR >= 12) {
      if (c.i === 0) {
        if (c.glass) b.blit(jarShelf(lvl, c.i), winR + 2, 18);
      } else
        for (let k = 0; k < Math.min(2, lvl) && winR + 9 + k * 6 <= bx(c.x1); k++)
          herbs(b, winR + 3 + k * 6, 10, k % 2 === 1 || lvl >= 3);
    }
    // Sin ventana, otro estante de tarros donde iría.
    if (!c.glass) b.blit(jarShelf(lvl, c.i + 2), bx(c.win) - 5, 20);
  }
}

// ---------- En la sala ----------

/** Lo de cada hueco que no es el fogón: la alacena (desde el nivel 2) y los sacos. */
function cellThings(c: Cell, lvl: number, t: Thing[]) {
  if (c.i > 0) {
    if (lvl >= 2) t.push(at(dresser(lvl), c.x0 + 26, WALL));
    t.push(at(flourSacks(), c.x0 + 57, WALL - 2));
    t.push(at(sink(lvl), c.win, WALL));
  } else t.push(at(workTable(lvl), c.win, WALL));
  // En el rincón de la derecha, el barril del agua (o la escoba en los de en medio).
  t.push(at(c.i === 0 ? Prop.barrel() : broom(), c.win + WIN_HALF + 7, WALL));
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [
    at(hearth(lvl, true), HEARTH_X, WALL + 2, 0, fire(7, 80 + lvl * 10, FIRE, false)),
  ];
  for (const c of cellsOf(room, w)) cellThings(c, lvl, t);
  return t;
}

/** Por reparar: el fogón frío, la mesa rota y una caja; en los demás huecos, sacos rotos. */
function ruin(room: Room, w: number): Thing[] {
  const t: Thing[] = [at(hearth(1, false), HEARTH_X, WALL + 2)];
  for (const c of cellsOf(room, w)) {
    if (c.i === 0) t.push(at(brokenTable(), c.win, WALL));
    else t.push(at(Prop.brokenChair(), c.win, WALL - 4));
    t.push(at(Prop.crate(), c.win + WIN_HALF + 7, WALL));
  }
  return t;
}

export const cocina: RoomArt = { wall, things, ruin };
