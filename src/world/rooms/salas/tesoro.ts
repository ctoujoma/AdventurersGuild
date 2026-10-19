/**
 * Arte de la cámara del tesoro: guarda el oro del gremio y no tiene ventanas. En el primer
 * hueco, la puerta de la caja fuerte empotrada en la pared, que es su cerradura: de tablas con
 * un candado (nivel 1), de hierro con cerrojos (2) y redonda con su rueda (3). Delante y en los
 * demás huecos, arcones, sacos de monedas y montones de oro que crecen con el nivel; en el 3,
 * un ídolo de oro en su peana. El oro da su brillo. Sin armería, el equipo sin dueño también se
 * guarda aquí, en arcones.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { gearChests } from './equipo';
import {
  GOLD,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  cellsOf,
  type Cell,
  type Glow,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, sack, web } from './piezas';

const SHINE = (r: number, power = 0.5): Glow => ({
  dy: 4,
  r,
  color: GOLD,
  power,
  flicker: 0.05,
});

// ---------- Piezas ----------

/** La puerta de la caja fuerte, empotrada en la pared (en el fondo): su cerradura es el nivel. */
function vaultDoor(level: number): PixelBuffer {
  return Prop.piece(26, 30, (p) => {
    // Marco de piedra.
    p.rect(0, 0, 26, 30, P.slate);
    p.rect(1, 1, 24, 28, P.steel);
    p.hline(1, 1, 24, P.fog);
    if (level >= 3) {
      // Redonda, con remaches dorados, la rueda y los cerrojos.
      p.rect(2, 2, 22, 26, P.black);
      p.ellipse(13, 15, 11, 11, P.slate);
      p.ellipse(13, 15, 10, 10, P.steel);
      p.ellipse(12, 14, 7, 7, P.fog);
      for (let a = 0; a < 12; a++) {
        const t = (a / 12) * Math.PI * 2;
        p.set(Math.round(13 + Math.cos(t) * 9.5), Math.round(15 + Math.sin(t) * 9.5), P.gold);
      }
      p.line(9, 11, 17, 19, P.slate);
      p.line(17, 11, 9, 19, P.slate);
      p.hline(8, 15, 11, P.slate);
      p.vline(13, 10, 11, P.slate);
      p.ellipse(13, 15, 2, 2, P.gold);
      p.set(12, 14, P.lemon);
      return;
    }
    if (level >= 2) {
      // De hierro, con remaches, dos cerrojos y una cerradura grande.
      p.rect(3, 3, 20, 24, P.slate);
      p.rect(4, 4, 18, 22, P.steel);
      for (let y = 6; y < 26; y += 5) for (const x of [5, 20]) p.set(x, y, P.mist);
      for (const y of [8, 20]) {
        p.rect(14, y, 9, 2, P.navy);
        p.hline(14, y, 9, P.fog);
      }
      p.rect(8, 11, 6, 8, P.gold);
      p.rect(9, 12, 4, 6, P.orange);
      p.rect(10, 13, 2, 3, P.black);
      p.set(10, 16, P.black);
      return;
    }
    // De tablas con dos herrajes y un candado.
    p.rect(3, 3, 20, 24, W[3]!);
    for (let x = 3; x < 23; x += 4) p.vline(x, 3, 24, W[2]!);
    for (const y of [7, 21]) {
      p.hline(3, y, 20, P.slate);
      p.hline(3, y + 1, 20, P.navy);
    }
    p.rect(16, 13, 4, 2, P.slate);
    p.ellipse(18, 17, 2.5, 2, P.steel);
    p.set(18, 17, P.black);
  });
}

/** Montón de monedas de oro (de 18 de ancho), con algún destello. */
function goldPile(big: boolean): PixelBuffer {
  const w = big ? 22 : 16;
  const h = big ? 10 : 7;
  return Prop.piece(w, h, (p) => {
    p.ellipse(w / 2, h, w / 2, h - 0.5, P.orange);
    p.ellipse(w / 2 - 1, h - 0.5, w / 2 - 2, h - 2, P.gold);
    for (let x = 2; x < w - 2; x += 3) p.set(x, h - 2 - (x % 2), P.lemon);
    p.set(Math.floor(w / 2), 1, P.white);
    p.set(Math.floor(w / 2) - 1, 2, P.lemon);
  });
}

/** Saco de monedas atado, con unas cuantas por el suelo. */
function coinSack(): PixelBuffer {
  return Prop.piece(12, 11, (p) => {
    sack(p, 0, 1, [P.rust, P.clay, P.tan]);
    p.set(4, 3, P.gold);
    for (const x of [9, 11]) {
      p.hline(x - 1, 10, 2, P.gold);
      p.set(x, 9, P.lemon);
    }
  });
}

/** Arcón abierto rebosando de oro (con alguna gema, desde el nivel 3). */
function openChest(gems: boolean): PixelBuffer {
  return Prop.piece(18, 15, (p) => {
    p.blit(Prop.chest(true), 1, 3);
    p.ellipse(9, 6, 7, 2.5, P.gold);
    p.hline(3, 5, 12, P.lemon);
    if (gems) {
      p.set(6, 5, P.red);
      p.set(10, 4, P.cyan);
      p.set(13, 5, P.lime);
    }
    // Tapa abierta hacia atrás.
    p.rect(1, 0, 16, 3, W[4]!);
    p.hline(1, 0, 16, W[5]!);
  });
}

/** Ídolo de oro en su peana de piedra. */
function idol(): PixelBuffer {
  return Prop.piece(14, 28, (p) => {
    p.rect(1, 18, 12, 10, P.steel);
    p.hline(1, 18, 12, P.fog);
    p.rect(0, 17, 14, 2, P.mist);
    // Figura sentada.
    p.ellipse(7, 5, 3, 3, P.gold);
    p.set(6, 4, P.black);
    p.set(8, 4, P.black);
    p.rect(4, 8, 6, 6, P.gold);
    p.rect(3, 13, 8, 4, P.orange);
    p.vline(4, 8, 6, P.lemon);
    p.set(7, 1, P.cyan);
  });
}

/** Repisa de pared con copas y una bandeja de oro (desde el nivel 2). */
function goblets(level: number): PixelBuffer {
  return Prop.piece(22, 12, (p) => {
    p.rect(0, 10, 22, 2, W[4]!);
    p.hline(0, 10, 22, W[5]!);
    p.ellipse(5, 5, 4, 4, P.orange);
    p.ellipse(5, 5, 3, 3, P.gold);
    p.set(4, 3, P.lemon);
    for (const x of [12, 17]) {
      if (x === 17 && level < 3) continue;
      p.rect(x, 3, 3, 3, P.gold);
      p.set(x + 1, 6, P.orange);
      p.vline(x + 1, 7, 2, P.gold);
      p.hline(x, 9, 3, P.orange);
    }
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  for (const c of cells) {
    const x = bx(c.win);
    if (c.i === 0) {
      // La caja fuerte (por reparar, la de tablas, rota).
      const d = vaultDoor(ruin ? 1 : room.level);
      if (ruin) web(d, 2, 2, 1);
      b.blit(d, x - 13, 12);
      // Encima de los arcones, la repisa de las copas.
      if (!ruin && room.level >= 2) b.blit(goblets(room.level), bx(c.x0 + 26) - 11, 22);
    } else if (!ruin && room.level >= 2) b.blit(goblets(room.level), x - 11, 18);
    // A la derecha, una vela en su aplique (desde el nivel 2).
    const winR = bx(c.win + WIN_HALF);
    if (!ruin && room.level >= 2 && bx(c.x1) - winR >= 8) {
      b.rect(winR + 3, 28, 5, 2, P.slate);
      candleOn(b, winR + 4, 28, 4);
    }
  }
}

/** Lo de un hueco: arcones y sacos a la izquierda, oro bajo la caja (o la repisa). */
function cellThings(c: Cell, lvl: number, t: Thing[]) {
  const l = c.x0;
  if (lvl >= 3 && c.i > 0) t.push(at(idol(), l + 13, WALL));
  else t.push(at(Prop.chest(), l + 13, WALL));
  t.push(at(lvl >= 2 ? openChest(lvl >= 3) : Prop.chest(), l + 36, WALL, 0, SHINE(40, 0.35)));
  if (lvl >= 2) t.push(at(coinSack(), l + 57, WALL));
  // Debajo de la caja fuerte (más bajo que ella) y de la repisa: el oro.
  t.push(at(goldPile(lvl >= 3), c.win + 1, WALL, 0, lvl >= 2 ? SHINE(50) : undefined));
}

function things(room: Room, w: number, look: SalonLook): Thing[] {
  const cells = cellsOf(room, w);
  const t: Thing[] = [];
  const gear = look.gearRoom === room.id ? look.gear : [];
  cells.forEach((c, i) => {
    // Sin armería, el equipo va en arcones en el último hueco (en el sitio de los arcones).
    if (gear.length && i === cells.length - 1) {
      t.push(...gearChests(gear.length, c.x0 + 12, 1));
      t.push(at(goldPile(room.level >= 3), c.win, WALL, 0, SHINE(50)));
    } else cellThings(c, room.level, t);
  });
  return t;
}

/** Por reparar: arcones vacíos, uno volcado, y el equipo (si se guarda aquí) en arcones. */
function ruin(room: Room, w: number, look: SalonLook): Thing[] {
  const gear = look.gearRoom === room.id ? look.gear : [];
  const tipped = new PixelBuffer(18, 14);
  tipped.blit(Prop.chest(true), 0, 0, true);
  const t: Thing[] = [];
  for (const c of cellsOf(room, w)) {
    t.push(at(tipped, c.x0 + 20, WALL));
    t.push(at(Prop.crate(), c.win + WIN_HALF + 6, WALL));
  }
  if (gear.length) t.push(...gearChests(gear.length, w - 14, -1));
  return t;
}

export const tesoro: RoomArt = { wall, things, ruin };
