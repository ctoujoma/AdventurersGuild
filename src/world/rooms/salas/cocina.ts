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
  W,
  at,
  bx,
  cellsOf,
  fire,
  row,
  solid,
  stretchesOf,
  type RoomArt,
  type Thing,
  type WallCtx,
  task,
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
    if (level >= 4 && lit) {
      // El asador: el espetón de lado a lado con el cordero dorándose y la manivela.
      p.vline(6, 52, 4, P.slate);
      p.vline(30, 52, 4, P.slate);
      p.hline(5, 54, 27, P.steel);
      p.ellipse(18, 54.5, 7, 3.5, P.brick);
      p.ellipse(17, 53.5, 5.5, 2.2, P.amber);
      p.hline(14, 52, 6, P.gold);
      p.set(25, 55, P.sand);
      p.set(11, 55, P.sand);
      p.vline(32, 54, 3, P.slate);
      p.set(33, 56, P.steel);
      // La grasera debajo.
      p.rect(11, 59, 14, 1, P.slate);
    } else if (level >= 2 && lit) {
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
    if (level >= 4) {
      // Una empanada dorada junto al pan.
      p.ellipse(8, 5, 4.5, 1.8, P.amber);
      p.ellipse(8, 4.5, 3.5, 1.2, P.gold);
      p.set(7, 4, P.rust);
      p.set(9, 4, P.rust);
    }
    if (level >= 3) {
      // Pollo asado en su fuente (de plata en el nivel 4).
      p.ellipse(15.5, 6, 6, 1.5, level >= 4 ? P.white : P.mist);
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

/** La batería de cobre (nivel 4): cazos y sartenes colgados de una barra, del grande al chico. */
export function copperRack(): PixelBuffer {
  return Prop.piece(14, 18, (p) => {
    p.hline(0, 0, 14, W[3]!);
    p.hline(0, 1, 14, W[2]!);
    for (const [x, r, l] of [
      [3, 2.6, 9],
      [8, 2, 6],
      [12, 1.5, 4],
    ] as const) {
      p.vline(x, 2, l, P.amber);
      p.ellipse(x, 2 + l + r, r, r, P.orange);
      p.ellipse(x - 0.5, 1.5 + l + r, r - 0.8, r - 0.8, P.amber);
      p.set(Math.round(x - r / 2), Math.round(1 + l + r), P.gold);
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
      p.ellipse(x + 2.5, 8, 2, 2, level >= 4 ? P.white : level >= 3 ? P.sky : P.mist);
      // En el nivel 4, loza fina con el filo de oro.
      if (level >= 4) {
        p.set(x + 2, 5, P.gold);
        p.set(x + 4, 6, P.gold);
      }
      p.set(x + 2, 7, P.white);
    }
    // Jarras y tazones en el de abajo.
    p.rect(5, 15, 4, 4, P.clay);
    p.set(9, 16, P.clay);
    p.hline(5, 15, 4, P.tan);
    p.ellipse(16, 17.5, 3, 1.5, P.steel);
    p.hline(13, 16, 7, P.fog);
    p.rect(22, 15, 4, 4, level >= 4 ? P.fog : P.mist);
    p.set(21, 16, level >= 4 ? P.fog : P.mist);
    p.hline(22, 15, 4, P.white);
    if (level >= 4) p.set(23, 14, P.white);
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

/** Horno de pan: cúpula de ladrillo sobre su poyo, con la boca (encendida desde el nivel 2). */
function breadOven(lit: boolean): PixelBuffer {
  return Prop.piece(34, 34, (p) => {
    // Cúpula: media elipse de ladrillo encima del poyo.
    for (let y = 6; y <= 20; y++) {
      const t = (20 - y) / 14;
      const hw = Math.round(15 * Math.sqrt(Math.max(0, 1 - t * t)));
      p.hline(17 - hw, y, hw * 2, P.brick);
      p.set(17 - hw, y, P.amber);
      p.set(16 + hw, y, P.rust);
      if (y % 3 === 0)
        for (let x = 17 - hw + 2 + (y % 2) * 2; x < 15 + hw; x += 5) p.set(x, y, P.rust);
    }
    p.hline(10, 8, 7, P.amber);
    // Boca y chimenea pequeña.
    p.ellipse(17, 18, 6, 4, P.black);
    p.rect(11, 18, 12, 3, P.black);
    if (lit) {
      p.hline(13, 20, 8, P.orange);
      p.set(15, 19, P.gold);
      p.set(19, 19, P.gold);
    }
    p.rect(24, 0, 4, 9, P.slate);
    p.hline(24, 0, 4, P.steel);
    // El poyo de piedra.
    p.rect(0, 20, 34, 2, W[4]!);
    p.hline(0, 20, 34, W[5]!);
    stoneWall(p, 0, 22, 34, 12, 'poyo-horno', { ramp: STONE, bw: 6, bh: 4 });
    // La pala del pan apoyada.
    p.line(33, 6, 31, 33, W[4]!);
    p.rect(31, 2, 3, 5, W[5]!);
  });
}

/** Tajo del carnicero: tocón con la cuchilla clavada y un buen trozo de carne. */
function butcherBlock(level: number): PixelBuffer {
  return Prop.piece(18, 20, (p) => {
    p.rect(2, 8, 14, 12, W[3]!);
    p.vline(2, 8, 12, W[4]!);
    p.vline(15, 8, 12, W[2]!);
    p.ellipse(9, 8, 7, 2, W[5]!);
    p.ellipse(9, 8, 4, 1, W[4]!);
    // Cuchilla clavada.
    p.rect(11, 3, 5, 4, P.mist);
    p.hline(11, 3, 5, P.white);
    p.rect(12, 0, 2, 3, W[2]!);
    // Carne.
    p.ellipse(6, 6, 4, 2.5, P.red);
    p.ellipse(5, 5.5, 2, 1, P.coral);
    if (level >= 3) p.set(8, 6, P.white);
  });
}

/** Mesa de amasar: la masa, el rodillo y harina. */
function doughTable(level: number): PixelBuffer {
  return Prop.piece(28, 18, (p) => {
    p.rect(0, 8, 28, 3, W[5]!);
    p.hline(0, 8, 28, W[6]!);
    p.hline(0, 10, 28, W[3]!);
    p.rect(2, 11, 3, 7, W[3]!);
    p.rect(23, 11, 3, 7, W[3]!);
    p.hline(5, 14, 18, W[2]!);
    for (let x = 3; x < 25; x += 3) p.set(x, 8, P.white);
    p.ellipse(9, 7, 5, 1.6, P.sand);
    p.ellipse(8, 6.5, 3, 1, P.white);
    p.rect(15, 6, 9, 2, W[4]!);
    p.hline(15, 6, 9, W[5]!);
    if (level >= 2) loaf(p, 2, 8);
    if (level >= 3) {
      // Una empanada.
      p.ellipse(23, 7, 3, 1.5, P.amber);
      p.hline(21, 6, 4, P.gold);
    }
  });
}

/** Barra de pared con jamones y ristras (encima del tajo). */
function hamRail(level: number): PixelBuffer {
  return Prop.piece(22, 18, (p) => {
    p.hline(0, 0, 22, P.slate);
    p.hline(0, 1, 22, P.navy);
    for (let k = 0; k < Math.min(4, level + 1); k++) {
      const x = 3 + k * 5;
      p.vline(x, 2, 2, P.black);
      if (k % 2 === 0) {
        p.ellipse(x, 9, 2.4, 4.5, P.brick);
        p.ellipse(x - 0.5, 8, 1, 2, P.coral);
        p.set(x, 14, P.sand);
      } else herbs(p, x - 2, 2, true);
    }
  });
}

// ---------- Pared del fondo ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const lvl = room.level;
  const w = cells.at(-1)!.x1;
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left')
      b.blit(lvl >= 4 ? copperRack() : utensils(lvl), bx(s.x1) - (lvl >= 4 ? 15 : 13), 20);
    else if (s.kind === 'mid' && s.i === 1 && lvl < 2) {
      // Sin alacena todavía, un estante con tazones encima de los sacos.
      const sx = bx((s.x0 + s.x1) / 2) - 11;
      shelf(b, sx, 30, 22);
      for (let k = 0; k < 3; k++) {
        b.ellipse(sx + 4 + k * 7, 28.5, 2.5, 1.5, k % 2 ? P.clay : P.steel);
        b.hline(sx + 2 + k * 7, 27, 5, k % 2 ? P.tan : P.fog);
      }
    } else if (s.kind === 'mid' && s.i === 2) {
      // Jamones y ristras encima del tajo.
      b.blit(hamRail(lvl), bx(s.x0 + 66) - 11, 18);
    } else if (s.kind === 'right' && bx(s.x1) - bx(s.x0) >= 12) {
      b.blit(jarShelf(lvl, 0), bx(s.x0) + 2, 18);
    }
  }
  // Sin ventana, otro estante de tarros donde iría.
  for (const c of cells) if (!c.glass) b.blit(jarShelf(lvl, c.i + 2), bx(c.win) - 5, 20);
}

// ---------- En la sala ----------

/**
 * La sala pequeña: el fogón y la mesa de trabajo. Las anchas suman, en el primer tramo de en
 * medio, la alacena y los sacos de harina y, en el segundo, el horno de pan con el tajo; bajo
 * las otras ventanas, la pila de fregar y la mesa de amasar.
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [
    task(solid(hearth(lvl, true), HEARTH_X, 0, fire(7, 80 + lvl * 10, FIRE, false)), 'olla'),
  ];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          ...(lvl >= 2 ? ([[dresser(lvl), WALL]] as [PixelBuffer, number][]) : []),
          [flourSacks(), WALL - 2],
        ]),
      );
    if (s.kind === 'mid' && s.i === 2) {
      const [oven, block] = row(s, [
        [breadOven(lvl >= 2), WALL + 2, lvl >= 2 ? fire(4, 50, FIRE, false) : undefined],
        [butcherBlock(lvl), WALL],
      ]);
      t.push(task(oven!, 'horno'), task(block!, 'mesa'));
    }
    if (s.kind === 'right') t.push(at(Prop.barrel(), Math.min(s.x0 + 7, w - 9), WALL));
  }
  cellsOf(room, w).forEach((c, j) =>
    t.push(
      task(
        at(j === 0 ? workTable(lvl) : j === 1 ? sink(lvl) : doughTable(lvl), c.win, WALL),
        j === 1 ? 'fregar' : 'mesa',
      ),
    ),
  );
  return t;
}

/** Por reparar: el fogón frío, la mesa rota y unas cajas. */
function ruin(room: Room, w: number): Thing[] {
  const t: Thing[] = [solid(hearth(1, false), HEARTH_X)];
  cellsOf(room, w).forEach((c, j) =>
    t.push(at(j === 0 ? brokenTable() : Prop.brokenChair(), c.win, j === 0 ? WALL : WALL - 4)),
  );
  for (const s of stretchesOf(room, w))
    if (s.kind === 'mid') t.push(at(Prop.crate(), (s.x0 + s.x1) / 2, WALL));
  t.push(at(Prop.crate(), w - 9, WALL));
  return t;
}

export const cocina: RoomArt = { wall, things, ruin };
