/**
 * Arte del salón (la sala de muestra del estilo definitivo): la pared del fondo con la alacena
 * de botellas detrás de la barra, las vigas, los trofeos y los tapices; y los muebles de delante:
 * la barra con sus jarras, las mesas con velas, la chimenea con el escudo, los barriles y la
 * leña. Crece con el nivel del salón y con la decoración que se compra.
 */
import type { GearView } from '../scene';
import { trophyIcon } from '../../art/items';
import { P, R, type Ramp } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import type { Room, TrophyIcon } from '../../core/model';
import { Rng } from '../../core/rng';
import { stoneWall } from '../paint';
import * as Prop from '../props';
import { DEPTH, PITCH, ROOM_H } from './layout';
import { BACK, scaleAt } from './view3d';

const W = R.wood; // [black, plum, bark, rust, oak, clay, tan]
const DARK: Ramp = [P.black, P.ebony, P.plum, P.bark];

/**
 * Lo que las salas enseñan de la partida además de su nivel: decoración, escudo, trofeos y el
 * perro del salón, y el equipo sin dueño con la sala donde se guarda (ver `gearRoom`).
 */
export interface SalonLook {
  decor: readonly string[];
  crest: { field: string; dark: string; symbol: string };
  trophies: readonly TrophyIcon[];
  dog: boolean;
  gear: readonly GearView[];
  gearRoom: string | null;
}

export const NO_LOOK: SalonLook = {
  decor: [],
  crest: { field: P.wine, dark: P.plum, symbol: 'jarra' },
  trophies: [],
  dog: false,
  gear: [],
  gearRoom: null,
};

// ---------- Pared del fondo (a la escala del fondo) ----------

/** Alacena de detrás de la barra: estantes de botellas, jarras colgadas y dos barricas con espita. */
export function backBar(level: number, seed: string): PixelBuffer {
  return Prop.piece(46, 46, (b) => {
    const rng = new Rng(`alacena-${seed}`);
    // Mueble: fondo oscuro, laterales y remate.
    b.rect(0, 2, 46, 44, W[1]!);
    b.rect(2, 4, 42, 40, W[2]!);
    for (let y = 6; y < 44; y += 3) b.hline(3, y, 40, W[1]!);
    b.rect(0, 0, 46, 3, W[4]!);
    b.hline(0, 0, 46, W[5]!);
    b.hline(0, 2, 46, W[2]!);
    b.rect(0, 2, 2, 44, W[3]!);
    b.rect(44, 2, 2, 44, W[3]!);
    b.vline(0, 2, 44, W[4]!);
    // Estantes con botellas (más cuanto mejor es el salón).
    const shelves = [13, 23, 33];
    const full = [Math.min(8, 3 + level * 2), level >= 2 ? 7 : 2, level >= 3 ? 6 : 0];
    shelves.forEach((y, k) => {
      b.rect(2, y, 42, 2, W[4]!);
      b.hline(2, y, 42, W[5]!);
      b.hline(2, y + 1, 42, W[3]!);
      let x = 4;
      for (let i = 0; i < full[k]! && x < 40; i++) {
        Prop.bottleOn(b, x, y, rng.int(0, 11));
        x += rng.int(4, 6);
      }
    });
    // Jarras colgadas bajo el primer estante.
    for (let i = 0; i < Math.min(5, 2 + level); i++) {
      const x = 5 + i * 8;
      b.set(x + 2, 15, P.slate);
      b.rect(x, 16, 4, 4, P.oak);
      b.hline(x, 16, 4, P.sand);
      b.vline(x + 4, 17, 2, P.oak);
      b.set(x, 17, P.tan);
    }
    // Dos barricas tumbadas con su espita.
    for (const cx of [11, 33]) {
      b.ellipse(cx, 40, 8, 5.5, W[3]!);
      b.ellipse(cx, 40, 6.5, 4.5, W[4]!);
      b.ellipse(cx - 1, 39, 3, 2, W[5]!);
      b.vline(cx - 5, 36, 9, P.slate);
      b.vline(cx + 5, 36, 9, P.slate);
      b.rect(cx - 1, 44, 3, 2, P.steel);
      b.set(cx, 45, P.gold);
    }
  });
}

/** Tapiz con los colores del escudo y un fleco dorado. */
function tapestry(field: string, dark: string): PixelBuffer {
  return Prop.piece(12, 26, (b) => {
    b.hline(0, 0, 12, W[3]!);
    b.rect(1, 1, 10, 21, field);
    b.vline(1, 1, 21, dark);
    b.vline(10, 1, 21, dark);
    for (let y = 4; y < 20; y += 4) b.hline(3, y, 6, dark);
    b.rect(4, 8, 4, 5, P.gold);
    b.rect(5, 13, 2, 1, P.gold);
    for (let x = 1; x < 11; x++) b.vline(x, 22, x % 2 ? 3 : 4, x % 2 ? P.gold : P.orange);
  });
}

/** Pendón largo con los colores del escudo, colgado de una vara (en el salón de dos alturas). */
function banner(field: string, dark: string, h: number): PixelBuffer {
  return Prop.piece(14, h, (b) => {
    b.hline(0, 0, 14, W[3]!);
    b.set(0, 1, P.gold);
    b.set(13, 1, P.gold);
    const body = h - 6;
    b.rect(2, 1, 10, body, field);
    b.vline(2, 1, body, dark);
    b.vline(11, 1, body, dark);
    // Cola de golondrina abajo.
    for (let k = 0; k < 5; k++) {
      b.hline(2, body + 1 + k, 5 - k, field);
      b.hline(7 + k, body + 1 + k, 5 - k, field);
    }
    // El emblema en medio: un rombo dorado.
    const cy = Math.round(body * 0.4);
    for (let k = 0; k < 4; k++) b.hline(7 - k, cy - 3 + k, 2 * k, P.gold);
    for (let k = 0; k < 4; k++) b.hline(4 + k, cy + 1 + k, 6 - 2 * k, P.gold);
    b.hline(3, 3, 8, P.gold);
  });
}

/** Ristras de ajos, hierbas y un jamón colgando de una vara del techo (delante de la barra). */
export function larder(): PixelBuffer {
  return Prop.piece(26, 16, (b) => larderOn(b, 2, 0));
}

function larderOn(b: PixelBuffer, x: number, y: number) {
  b.hline(x - 1, y, 24, P.slate);
  // Jamón.
  b.vline(x + 2, y + 1, 2, P.black);
  b.ellipse(x + 2, y + 8, 3, 5, P.brick);
  b.ellipse(x + 2, y + 7, 1, 2, P.coral);
  b.set(x + 2, y + 12, P.sand);
  // Hierbas.
  b.vline(x + 9, y + 1, 2, P.black);
  for (let k = 0; k < 8; k++) b.vline(x + 8 + (k % 3), y + 3 + k, 2, k % 2 ? P.leaf : P.forest);
  // Ristra de ajos.
  b.vline(x + 16, y + 1, 12, P.tan);
  for (let k = 0; k < 4; k++) {
    b.ellipse(x + 16 + (k % 2 ? 1 : -1), y + 4 + k * 3, 1.5, 1.5, P.sand);
    b.set(x + 16, y + 4 + k * 3, P.white);
  }
  // Otro manojo, de laurel.
  b.vline(x + 21, y + 1, 2, P.black);
  for (let k = 0; k < 6; k++) b.vline(x + 20 + (k % 2), y + 3 + k, 2, k % 2 ? P.lime : P.leaf);
}

/** Tornapuntas en cruz en los paños de yeso que no tienen ventana. */
function braces(b: PixelBuffer, x0: number, x1: number, top: number, bottom: number) {
  const ramp = DARK;
  for (let x = x0; x < x1; x++) {
    const k = (x - x0) / (x1 - x0);
    const ya = Math.round(top + k * (bottom - top));
    const yb = Math.round(bottom - k * (bottom - top));
    for (const y of [ya, yb]) {
      b.set(x, y, ramp[2]!);
      b.set(x, y + 1, ramp[3]!);
      b.set(x, y + 2, ramp[1]!);
    }
  }
}

/**
 * Lo propio del salón en la pared del fondo (`b` ya lleva el yeso, el zócalo y las ventanas):
 * la alacena detrás de la barra, el tablón, tornapuntas, trofeos, tapices, apliques y ristras.
 * `windows` son las x (en el fondo) de las ventanas de cada planta, de arriba abajo; `cell` lo
 * que mide un hueco en el fondo.
 */
export function salonWall(
  b: PixelBuffer,
  room: Room,
  look: SalonLook,
  windows: number[][],
  cell: number,
  wain: number,
): void {
  const lvl = room.level;
  const floor = b.h;
  // Arriba de la planta de abajo (en el de dos alturas, la de arriba queda para lucir).
  const low = floor - Math.round(ROOM_H * BACK);
  const tall = room.h > 1;
  // Lo que no se tapa con una ventana de la planta `j` (por defecto, la de abajo).
  const free = (x: number, w: number, j = room.h - 1) =>
    windows[j]!.every((wx) => x + w < wx - 14 || x > wx + 14);
  // Dónde empieza la chimenea (y su tiro) vista en el fondo: lo de la pared no se pone detrás.
  const { hearthLeft, flueLeft } = hearthSpan(b.w);
  // Tornapuntas en los paños sin ventana (entre los postes de cada 36), planta a planta.
  for (let j = 0; j < room.h; j++) {
    const top = Math.round(j * PITCH * BACK) + 5;
    const bottom = j === room.h - 1 ? floor - wain - 4 : Math.round((j * PITCH + ROOM_H) * BACK);
    for (let x = 0; x + 36 <= b.w; x += 36)
      if (free(x + 3, 30, j)) braces(b, x + 3, x + 36, top, bottom);
  }
  // Alacena detrás de la barra.
  b.blit(backBar(lvl, room.id), 4, floor - 46);
  // El tablón de anuncios, en el segundo hueco (o tras la alacena, si solo hay uno).
  const board = Prop.noticeBoard(Math.min(4, lvl + 1), lvl >= 2);
  const bx = Math.min(Math.round(cell + 6), hearthLeft - board.w - 3);
  const boardOn = room.w > 1 && free(bx, board.w);
  if (boardOn) b.blit(board, bx, Math.round(floor - 30 - board.h));
  // Apliques con vela en los postes (desde el nivel 2).
  if (lvl >= 2)
    for (let x = 36; x < b.w - 40; x += 72)
      if (free(x - 3, 7)) b.blit(Prop.sconce(), x - 2, low + 22);
  // En el de dos alturas, pendones del gremio en los postes de arriba (sin tapar ventanas).
  const flags: number[] = [];
  if (tall)
    for (let x = 36; x < b.w - 30; x += 36)
      if (free(x - 7, 14, 0) && x + 7 < flueLeft && x - (flags.at(-1) ?? -99) >= 60) {
        b.blit(banner(look.crest.field, look.crest.dark, low - 24), x - 7, 4);
        flags.push(x);
      }
  const clear = (x: number, w: number) =>
    free(x, w, 0) &&
    x + w < flueLeft &&
    flags.every((f) => x + w < f - 8 || x > f + 8) &&
    // En el de una planta, la fila de arriba no pisa el tablón.
    (tall || !boardOn || x + w < bx || x > bx + board.w);
  // Tapices con el escudo.
  if (look.decor.includes('tapices')) {
    const spots = [];
    for (let x = 36; x < b.w - 20 && spots.length < 2; x += 36)
      if (free(x - 6, 12) && Math.abs(x - bx - 19) > 26) spots.push(x);
    for (const x of spots) b.blit(tapestry(look.crest.field, look.crest.dark), x - 5, 4);
  }
  // Trofeos de las misiones, en fila arriba (en el de dos alturas, a media pared de arriba).
  let x = 8;
  const ty = tall ? Math.round(low * 0.45) : 4;
  for (const t of look.trophies.slice(0, 6)) {
    while (x < b.w - 70 && !clear(x, 14)) x += 6;
    if (x >= b.w - 70) break;
    b.blit(trophyIcon(t), x, ty);
    x += 18;
  }
}

// ---------- Muebles de delante ----------

/** La barra con lo de encima: jarras, una jarra grande, el barrilito especial y una vela. */
export function bar(level: number, special: boolean): PixelBuffer {
  return Prop.piece(66, 28, (b) => {
    b.blit(Prop.counter(Math.min(4, level)), 0, 10);
    // Jarras de cerveza con espuma.
    for (const [x, full] of [
      [8, true],
      [14, false],
      [46, true],
    ] as const) {
      b.rect(x, 5, 4, 5, P.oak);
      b.vline(x + 4, 6, 3, P.oak);
      b.hline(x, 5, 4, full ? P.white : P.tan);
      b.set(x, 6, P.tan);
    }
    // Jarra de barro.
    b.ellipse(25, 7, 3, 3, P.clay);
    b.rect(24, 2, 3, 3, P.clay);
    b.set(28, 6, P.clay);
    b.set(23, 7, P.tan);
    if (level >= 2) {
      // Vela en su palmatoria.
      b.rect(36, 8, 5, 2, P.steel);
      b.rect(37, 4, 2, 4, P.white);
      b.set(38, 3, P.lemon);
    }
    if (special) {
      // Barrilito especial con espita.
      b.ellipse(57, 5, 5, 5, W[3]!);
      b.ellipse(57, 5, 3.5, 3.5, W[4]!);
      b.vline(54, 1, 9, P.slate);
      b.vline(60, 1, 9, P.slate);
      b.rect(56, 9, 2, 2, P.gold);
    }
  });
}

/** Una mesa redonda con lo que haya encima: jarras, un plato, una vela, o naipes. */
export function tableSet(
  seed: string,
  cloth: boolean,
  candle: boolean,
  cards: boolean,
): PixelBuffer {
  return Prop.piece(26, 22, (b) => {
    if (cards) {
      // Mesa de naipes: tapete verde y monedas.
      b.blit(Prop.roundTable(false), 0, 8);
      b.ellipse(13, 10.5, 12, 2.5, P.forest);
      b.hline(3, 10, 20, P.leaf);
      b.rect(6, 7, 3, 4, P.white);
      b.set(7, 8, P.red);
      b.rect(10, 6, 3, 4, P.white);
      b.set(11, 7, P.black);
      b.rect(17, 8, 3, 2, P.gold);
      b.hline(17, 8, 3, P.lemon);
      b.rect(19, 7, 2, 2, P.gold);
      return;
    }
    b.blit(Prop.roundTable(cloth), 0, 8);
    const rng = new Rng(`mesa-${seed}`);
    const left = rng.chance(0.5);
    // Jarra.
    const jx = left ? 4 : 18;
    b.rect(jx, 5, 4, 5, P.oak);
    b.vline(jx + 4, 6, 3, P.oak);
    b.hline(jx, 5, 4, P.white);
    // Plato con pan.
    const px = left ? 15 : 6;
    b.ellipse(px + 2, 10, 3, 1, P.mist);
    b.ellipse(px + 2, 9, 2, 1.2, P.tan);
    b.set(px + 1, 9, P.sand);
    if (candle) {
      b.rect(11, 8, 3, 2, P.steel);
      b.rect(12, 4, 1, 4, P.white);
      b.set(12, 3, P.lemon);
    }
  });
}

/** Barriles apilados: dos abajo y uno encima. */
export function barrels(): PixelBuffer {
  return Prop.piece(26, 28, (b) => {
    const one = Prop.barrel();
    b.blit(one, 0, 13);
    b.blit(one, 13, 13);
    b.blit(one, 7, 0);
  });
}

/** Leña apilada junto a la chimenea. */
export function logPile(): PixelBuffer {
  return Prop.piece(18, 12, (b) => {
    const ends: [number, number][] = [
      [3, 9],
      [8, 9],
      [13, 9],
      [5, 5],
      [10, 5],
      [8, 1.5],
    ];
    for (const [x, y] of ends) {
      b.ellipse(x + 0.5, y + 1, 2.5, 2.2, W[3]!);
      b.ellipse(x + 0.5, y + 1, 1.5, 1.4, W[5]!);
      b.set(Math.round(x), Math.round(y + 1), W[4]!);
    }
  });
}

/** La tarima del bardo, con el laúd apoyado en su atril. */
export function stage(): PixelBuffer {
  return Prop.piece(44, 30, (b) => {
    b.rect(0, 24, 44, 6, W[3]!);
    b.hline(0, 24, 44, W[5]!);
    b.hline(0, 25, 44, W[4]!);
    for (let x = 4; x < 44; x += 10) b.vline(x, 26, 4, W[2]!);
    b.hline(0, 29, 44, W[1]!);
    // Atril y laúd.
    b.vline(30, 10, 14, W[2]!);
    b.hline(27, 23, 7, W[2]!);
    b.blit(Prop.lute(), 18, 0);
  });
}

/**
 * La chimenea del salón: la de siempre con el tiro más alto y, encima de la repisa, el escudo del
 * gremio entre dos espadas (desde el nivel 2) y lo que se va juntando en la repisa.
 */
/** La chimenea: a cuánto de la pared de la derecha va su centro y a qué fondo. */
export const HEARTH_RIGHT = 40;
export const HEARTH_Z = DEPTH - 4;

/**
 * Dónde empiezan la chimenea y su tiro vistos en la pared del fondo (de `bw` de ancho), para no
 * poner nada detrás. Las piezas miden 56 de ancho y el tiro va de 16 a 40.
 */
export function hearthSpan(bw: number): {
  hearthLeft: number;
  flueLeft: number;
  flueRight: number;
} {
  const k = scaleAt(HEARTH_Z);
  const mid = bw / BACK - HEARTH_RIGHT;
  return {
    hearthLeft: Math.round((mid - 28 / k) * BACK),
    flueLeft: Math.round((mid - 12 / k) * BACK),
    flueRight: Math.round((mid + 12 / k) * BACK),
  };
}

export function hearth(
  level: number,
  crest: SalonLook['crest'],
  big: boolean,
  rise = 0,
): PixelBuffer {
  const fire = Prop.fireplace(Math.min(3, level + (big ? 1 : 0)));
  // El tiro sube hasta el techo: `rise` de más en el salón de dos alturas.
  const top = 18 + rise;
  return Prop.piece(fire.w, fire.h + top, (b) => {
    stoneWall(b, 16, 0, 24, top + 2, 'tiro-salon', { bw: 8, bh: 5 });
    b.blit(fire, 0, top);
    const mantle = top + 10;
    // Repisa: una jarra; con nivel, velas y una copa dorada.
    b.ellipse(7, mantle - 3, 2, 2, P.clay);
    b.rect(6, mantle - 6, 2, 2, P.clay);
    if (level >= 2)
      for (const x of [46, 50]) {
        b.rect(x, mantle - 5, 2, 5, P.white);
        b.set(x, mantle - 6, P.lemon);
      }
    if (level >= 3) {
      b.rect(26, mantle - 3, 4, 1, P.gold);
      b.rect(27, mantle - 6, 2, 3, P.gold);
      b.rect(26, mantle - 8, 4, 2, P.lemon);
    }
    if (level >= 2) {
      // Espadas cruzadas y el escudo del gremio.
      const y = rise;
      b.line(17, y + 2, 39, top + 4, P.fog);
      b.line(39, y + 2, 17, top + 4, P.fog);
      b.set(17, y + 2, P.gold);
      b.set(39, y + 2, P.gold);
      b.rect(22, y + 3, 12, 11, crest.dark);
      b.rect(23, y + 3, 10, 11, crest.field);
      b.rect(24, y + 14, 8, 2, crest.field);
      b.rect(26, y + 16, 4, 1, crest.field);
      b.hline(23, y + 3, 10, P.gold);
      b.rect(26, y + 6, 4, 5, P.sand);
      b.set(27, y + 7, crest.dark);
    }
  });
}
