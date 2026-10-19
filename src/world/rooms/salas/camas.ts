/**
 * Arte de las salas de dormir: el dormitorio de los héroes, el del servicio y los cuartos de
 * los veteranos. Las literas van a la izquierda de cada ventana (nunca delante del cristal),
 * una por hueco al principio y dos desde el nivel 2; bajo la ventana, el baúl; a su derecha,
 * las perchas. El servicio empieza con jergones de paja y acaba con literas de tres pisos; los
 * veteranos tienen madera oscura y trofeos. `bedsOf` dice dónde duerme cada uno (la gente usa
 * las mismas camas que se ven).
 */
import { P, type Ramp } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { broom } from './cocina';
import {
  CANDLE,
  FLOOR_D,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  candle,
  cellsOf,
  lampOver,
  type Bed,
  type Cell,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, web } from './piezas';

type Style = 'tropa' | 'servicio' | 'veterano';

/** Filas del colchón de cada piso, desde arriba del dibujo. */
const ROWS = [6, 26, 46] as const;
/** Alto de una litera de dos pisos (a la que se refieren las filas de `Bed.top`). */
const BUNK_H = 40;

// ---------- Dónde va cada cama ----------

/** Literas (o jergones) por hueco y cuántos pisos tienen. */
function perCell(room: Room): { n: number; tiers: 1 | 2 | 3 } {
  const lvl = room.level;
  if (room.type === 'servicio')
    return lvl < 2 ? { n: 2, tiers: 1 } : { n: 2, tiers: lvl >= 3 ? 3 : 2 };
  return { n: lvl >= 2 ? 2 : 1, tiers: 2 };
}

/** Centros de las literas de un hueco: repartidas a la izquierda de su ventana. */
function slots(c: Cell, n: number): number[] {
  const a = c.x0 + 2;
  const b = c.win - WIN_HALF - 1;
  return Array.from({ length: n }, (_, k) => a + ((b - a) * (k + 0.5)) / n);
}

/** Las camas de un dormitorio (de héroes, del servicio o de veteranos). */
export function bedsOf(room: Room, w: number): Bed[] {
  const { n, tiers } = perCell(room);
  // La manta del que duerme: la de los veteranos es la mejor y la del servicio, siempre parda.
  const level = quiltOf(room);
  return cellsOf(room, w).flatMap((c) =>
    slots(c, n).flatMap((x): Bed[] => {
      if (tiers === 1) return [{ kind: 'jergon', x, z: WALL, top: 0, level }];
      const h = tiers === 3 ? 60 : BUNK_H;
      return ROWS.slice(0, tiers).map((row) => ({
        kind: 'litera',
        x,
        z: WALL,
        top: row - (h - BUNK_H),
        level,
      }));
    }),
  );
}

// ---------- Piezas ----------

/**
 * Litera de dos o tres pisos, con la manta del nivel (la misma que lleva quien duerme en
 * ella). La de los veteranos, de madera oscura con remates de latón; la del servicio, tosca.
 */
export function bunk(level: number, tiers: 2 | 3, style: Style): PixelBuffer {
  const quilt = Prop.bunkQuilt(level);
  const h = tiers === 3 ? 60 : BUNK_H;
  const wood: Ramp =
    style === 'veterano'
      ? [P.black, P.ebony, P.plum, P.bark, P.rust]
      : style === 'servicio'
        ? [P.rust, P.oak, P.clay, P.tan, P.sand]
        : [P.black, P.plum, P.bark, P.rust, P.oak, P.clay];
  return Prop.piece(24, h, (b) => {
    for (const px of [0, 21]) {
      b.rect(px, 0, 3, h, wood[3]!);
      b.vline(px, 0, h, wood[4]!);
      b.vline(px + 2, 0, h, wood[2]!);
      b.rect(px, 0, 3, 2, wood[5] ?? wood[4]!);
      if (style === 'veterano') {
        b.rect(px, 0, 3, 2, P.amber);
        b.set(px + 1, 0, P.gold);
      }
    }
    if (style === 'veterano') {
      // Cabecero tallado arriba.
      b.rect(3, 1, 18, 3, wood[2]!);
      b.hline(3, 1, 18, wood[3]!);
      for (let x = 5; x < 20; x += 4) b.set(x, 2, P.gold);
    }
    for (const my of ROWS.slice(0, tiers)) {
      b.rect(3, my + 6, 18, 3, wood[3]!);
      b.hline(3, my + 6, 18, wood[4]!);
      b.hline(3, my + 8, 18, wood[1]!);
      b.rect(3, my + 1, 18, 5, P.sand);
      b.hline(3, my + 5, 18, P.tan);
      b.rect(3, my - 1, 6, 4, P.white);
      b.hline(3, my + 2, 6, P.mist);
      b.set(8, my - 1, P.mist);
      b.rect(8, my, 13, 6, quilt[2]!);
      b.hline(8, my, 13, quilt[3]!);
      b.hline(8, my + 5, 13, quilt[1]!);
      b.vline(8, my, 6, quilt[1]!);
      if (level >= 2) for (let x = 10; x < 21; x += 4) b.vline(x, my + 1, 4, quilt[1]!);
      if (level >= 3)
        for (let x = 9; x < 21; x += 4)
          for (let y = my + 1; y < my + 5; y += 2) b.set(x + ((y / 2) % 2), y, P.gold);
      if (style === 'servicio') {
        // Un remiendo en la manta.
        b.rect(15, my + 2, 3, 2, P.clay);
        b.set(15, my + 2, P.tan);
      }
    }
    for (let y = 8; y < h - 10; y += 5) b.hline(21, y, 3, wood[2]!);
  });
}

/** Litera rota: un poste caído y el somier de través. */
function brokenBunk(): PixelBuffer {
  return Prop.piece(24, 40, (b) => {
    b.rect(0, 0, 3, 40, W[3]!);
    b.vline(0, 0, 40, W[4]!);
    b.line(3, 28, 23, 38, W[4]!);
    b.line(3, 29, 23, 39, W[2]!);
    b.line(22, 18, 14, 39, W[3]!);
    b.rect(5, 34, 8, 2, P.tan);
    web(b, 3, 1, 1);
  });
}

/** Jergón de paja con su manta parda doblada a los pies. */
function mat(): PixelBuffer {
  return Prop.piece(22, 6, (b) => {
    b.ellipse(11, 4, 11, 2.5, P.clay);
    b.ellipse(11, 3.6, 9.5, 1.6, P.tan);
    for (let x = 2; x < 20; x += 3) b.set(x, 3 + (x % 2), P.sand);
    b.rect(14, 1, 7, 3, P.rust);
    b.hline(14, 1, 7, P.oak);
  });
}

/** Repisa encima de una litera con las cosas de su dueño (según la semilla). */
function bunkShelf(seed: number, style: Style): PixelBuffer {
  return Prop.piece(14, 8, (b) => {
    b.rect(0, 6, 14, 2, W[4]!);
    b.hline(0, 6, 14, W[5]!);
    // (En el servicio, siempre la jarra: no hay yelmos ni libros.)
    const k = style === 'servicio' ? 2 : seed % 3;
    if (style === 'veterano' || k === 0) {
      // Yelmo.
      b.ellipse(4, 3.5, 3, 3, P.steel);
      b.ellipse(3.5, 3, 1.5, 1.5, P.fog);
      b.hline(1, 5, 7, P.slate);
    } else if (k === 1) {
      // Libros.
      b.rect(1, 1, 2, 5, P.wine);
      b.rect(3, 2, 2, 4, P.ocean);
      b.rect(5, 1, 2, 5, P.forest);
    } else {
      // Jarra.
      b.rect(2, 2, 4, 4, P.clay);
      b.set(6, 3, P.clay);
      b.hline(2, 2, 4, P.tan);
    }
    candleOn(b, 10, 6, 3);
  });
}

/** Perchas de pared: un zurrón y, con nivel, una capa y un sombrero (o la espada del veterano). */
function pegs(level: number, style: Style): PixelBuffer {
  return Prop.piece(11, 22, (b) => {
    b.hline(0, 0, 11, W[3]!);
    b.hline(0, 1, 11, W[2]!);
    for (const x of [2, 8]) b.set(x, 2, W[1]!);
    if (style === 'servicio') {
      // Delantales.
      b.rect(0, 3, 5, 9, P.mist);
      b.hline(0, 3, 5, P.white);
      b.vline(4, 4, 8, P.fog);
      if (level >= 2) {
        b.rect(6, 3, 5, 9, P.sand);
        b.vline(10, 4, 8, P.tan);
      }
      return;
    }
    // Zurrón.
    b.rect(0, 4, 5, 6, W[4]!);
    b.hline(0, 4, 5, W[5]!);
    b.rect(0, 6, 5, 1, W[2]!);
    b.line(2, 2, 0, 4, W[2]!);
    if (style === 'veterano') {
      // Espada en su vaina.
      b.vline(8, 2, 3, P.gold);
      b.hline(6, 5, 5, P.gold);
      b.rect(7, 6, 3, 15, W[2]!);
      b.vline(7, 6, 15, W[3]!);
      b.set(8, 21, P.gold);
      return;
    }
    if (level >= 2) {
      b.rect(6, 3, 4, 15, level >= 3 ? P.ocean : P.wine);
      b.vline(6, 3, 15, level >= 3 ? P.sky : P.red);
      b.hline(6, 17, 4, P.plum);
    }
  });
}

/** Baúl a los pies (con una manta doblada encima, con nivel). */
function chest(level: number): PixelBuffer {
  return Prop.piece(22, 17, (b) => {
    b.blit(Prop.trunk(), 0, 3);
    if (level >= 2) {
      const q = Prop.bunkQuilt(level);
      b.rect(4, 0, 14, 4, q[2]!);
      b.hline(4, 0, 14, q[3]!);
      b.hline(4, 3, 14, q[1]!);
    }
  });
}

/** Taburete con una vela encima (la mesilla). */
function nightstand(): PixelBuffer {
  return Prop.piece(9, 16, (b) => {
    b.blit(Prop.stool(), 0, 6);
    b.rect(3, 4, 3, 2, P.steel);
    candleOn(b, 3, 4, 3);
  });
}

/** Cubo de agua de madera con su asa. */
function bucket(): PixelBuffer {
  return Prop.piece(9, 9, (b) => {
    b.rect(1, 3, 7, 6, W[4]!);
    b.vline(1, 3, 6, W[5]!);
    b.vline(7, 3, 6, W[2]!);
    b.hline(1, 4, 7, P.slate);
    b.hline(1, 7, 7, P.slate);
    b.hline(2, 3, 5, P.ocean);
    b.line(1, 2, 4, 0, P.slate);
    b.line(4, 0, 7, 2, P.slate);
  });
}

/** Trofeo de veterano para la pared: astas, espadas cruzadas o un escudo partido. */
function trophy(seed: number, crest: SalonLook['crest']): PixelBuffer {
  const k = seed % 3;
  if (k === 0) return Prop.antlers();
  return Prop.piece(18, 16, (b) => {
    if (k === 1) {
      b.line(1, 1, 16, 14, P.fog);
      b.line(16, 1, 1, 14, P.fog);
      b.line(2, 1, 17, 14, P.mist);
      b.rect(0, 13, 3, 3, W[3]!);
      b.rect(15, 13, 3, 3, W[3]!);
      b.ellipse(9, 8, 4, 4, crest.dark);
      b.ellipse(9, 8, 3, 3, crest.field);
      return;
    }
    b.ellipse(9, 8, 7, 7, P.gold);
    b.ellipse(9, 8, 6, 6, crest.field);
    b.rect(9, 2, 6, 13, crest.dark);
    b.line(4, 3, 12, 13, P.black);
    b.ellipse(9, 8, 1.5, 1.5, P.lemon);
  });
}

// ---------- Pared, suelo y sala ----------

/** Nivel de la manta (el de `bedsOf`). */
const quiltOf = (room: Room) =>
  room.type === 'veteranos' ? 3 : room.type === 'servicio' ? 1 : room.level;

function styleOf(room: Room): Style {
  return room.type === 'servicio' ? 'servicio' : room.type === 'veteranos' ? 'veterano' : 'tropa';
}

function wall(b: PixelBuffer, room: Room, look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const lvl = room.level;
  const style = styleOf(room);
  const { n, tiers } = perCell(room);
  for (const c of cells) {
    // Encima de cada litera (de dos pisos, desde el nivel 2), su repisa o su trofeo.
    if (tiers === 2 && (lvl >= 2 || style === 'veterano'))
      slots(c, n).forEach((x, k) => {
        if (style === 'veterano' && (lvl >= 2 || k === 0)) {
          const t = trophy(c.i * 2 + k, look.crest);
          b.blit(t, bx(x) - Math.floor(t.w / 2), 30 - t.h);
        } else if (style !== 'veterano') b.blit(bunkShelf(c.i * 2 + k, style), bx(x) - 7, 22);
      });
    // Las perchas, a la derecha de la ventana.
    const winR = bx(c.win + WIN_HALF);
    if (bx(c.x1) - winR >= 12) b.blit(pegs(lvl, style), winR + 1, 16);
    // Sin ventana: un cuadro (un paisaje) donde iría.
    if (!c.glass) {
      const x = bx(c.win) - 8;
      b.rect(x, 14, 16, 12, W[4]!);
      b.rect(x + 1, 15, 14, 10, P.sky);
      b.rect(x + 1, 21, 14, 4, P.forest);
      b.line(x + 2, 21, x + 7, 17, P.slate);
      b.line(x + 7, 17, x + 12, 21, P.slate);
      b.set(x + 11, 16, P.lemon);
    }
  }
}

/** Alfombra delante de las camas desde el nivel 2 (los veteranos, una piel de oso). */
function floor(b: PixelBuffer, room: Room, cells: Cell[]): void {
  if (room.level < 2 || room.type === 'servicio') return;
  const vet = room.type === 'veteranos';
  const [edge, base, dot] = vet
    ? [P.bark, P.umber, P.cocoa]
    : room.level >= 3
      ? [P.navy, P.ocean, P.gold]
      : [P.plum, P.wine, P.red];
  for (const c of cells) {
    const x0 = Math.round(c.x0 + 6);
    const x1 = Math.round(c.win - WIN_HALF - 4);
    b.rect(x0, 9, x1 - x0, FLOOR_D - 18, edge);
    b.rect(x0 + 1, 10, x1 - x0 - 2, FLOOR_D - 20, base);
    for (let x = x0 + 3; x < x1 - 2; x += 4) b.set(x, FLOOR_D / 2, dot);
  }
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const style = styleOf(room);
  const { n, tiers } = perCell(room);
  const cells = cellsOf(room, w);
  const t: Thing[] = [lampOver(cells, w)];
  for (const c of cells) {
    for (const x of slots(c, n))
      t.push(at(tiers === 1 ? mat() : bunk(quiltOf(room), tiers === 3 ? 3 : 2, style), x, WALL));
    // Bajo la ventana: el baúl (el armadura del veterano, desde el nivel 3).
    if (style === 'veterano' && lvl >= 3) t.push(at(Prop.armorStand(), c.win, WALL));
    else if (style === 'servicio' && lvl < 2) t.push(at(bucket(), c.win, WALL));
    else t.push(at(chest(quiltOf(room)), c.win, WALL));
    // A su derecha: la mesilla con su vela (o la escoba del servicio).
    const rx = c.win + WIN_HALF + 7;
    if (style === 'servicio') t.push(at(broom(), rx, WALL));
    else if (lvl >= 2)
      t.push(at(nightstand(), rx, WALL - 2, 0, { ...candle(14, 30, 0.4), color: CANDLE }));
  }
  return t;
}

/** Por reparar: literas rotas, paja por el suelo y una caja. */
function ruin(room: Room, w: number): Thing[] {
  return cellsOf(room, w).flatMap((c) => [
    at(brokenBunk(), slots(c, 1)[0]!, WALL),
    at(mat(), c.win, WALL),
    at(Prop.crate(), c.win + WIN_HALF + 7, WALL),
  ]);
}

const art = { wall, things, ruin, floor, ownLamp: true };
export const dormitorio: RoomArt = art;
export const servicio: RoomArt = art;
export const veteranos: RoomArt = art;
