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
import { stoneWall } from '../../paint';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { scaleAt } from '../view3d';
import { broom } from './cocina';
import {
  CANDLE,
  FIRE,
  FLOOR_D,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  candle,
  cellsOf,
  fire,
  lampOver,
  solid,
  stretchesOf,
  wallLight,
  type Bed,
  type Glow,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, web } from './piezas';
import { cloth } from './tintes';

type Style = 'tropa' | 'servicio' | 'veterano';

/** Filas del colchón de cada piso, desde arriba del dibujo. */
const ROWS = [6, 26, 46] as const;
/** Alto de una litera de dos pisos (a la que se refieren las filas de `Bed.top`). */
const BUNK_H = 40;
/** Las camas, algo separadas de la pared: así se nota la profundidad al mover la cámara. */
const BED_Z = WALL - 6;

// ---------- Dónde va cada cama ----------

/** Literas (o jergones) por hueco y cuántos pisos tienen. */
function perCell(room: Room): { n: number; tiers: 1 | 2 | 3 } {
  const lvl = room.level;
  if (room.type === 'servicio')
    return lvl < 2 ? { n: 2, tiers: 1 } : { n: 2, tiers: lvl >= 3 ? 3 : 2 };
  return { n: lvl >= 2 ? 2 : 1, tiers: 2 };
}

/** Ancho de una litera (o un jergón), en el mundo. */
const BUNK_W = 26 / scaleAt(BED_Z);

/**
 * Dónde va cada cosa: en el tramo de la izquierda y en cada uno de en medio, las literas de un
 * hueco (una o dos); en los de en medio, además, el mueble propio de ese tramo (armario,
 * chimenea, armero…) entre ellas o a su izquierda. Así las salas anchas no repiten la pequeña.
 */
function plan(room: Room, w: number): { bunks: number[]; features: { x: number; k: number }[] } {
  const { n } = perCell(room);
  const bunks: number[] = [];
  const features: { x: number; k: number }[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'right') continue;
    if (s.kind === 'left') {
      const a = s.x0 + 2;
      const b = s.x1 - 1;
      for (let k = 0; k < n; k++) bunks.push(a + ((b - a) * (k + 0.5)) / n);
      continue;
    }
    const left = s.x0 + BUNK_W / 2 + 0.5;
    const right = s.x1 - BUNK_W / 2 - 0.5;
    if (n >= 2) {
      bunks.push(left, right);
      features.push({ x: (s.x0 + s.x1) / 2, k: s.i });
    } else {
      bunks.push(right);
      features.push({ x: (s.x0 + right - BUNK_W / 2) / 2, k: s.i });
    }
  }
  return { bunks, features };
}

/** Las camas de un dormitorio (de héroes, del servicio o de veteranos). */
export function bedsOf(room: Room, w: number): Bed[] {
  const { tiers } = perCell(room);
  // La manta del que duerme: la de los veteranos es la mejor y la del servicio, siempre parda.
  const level = quiltOf(room);
  return plan(room, w).bunks.flatMap((x): Bed[] => {
    if (tiers === 1) return [{ kind: 'jergon', x, z: BED_Z, top: 0, level }];
    const h = tiers === 3 ? 60 : BUNK_H;
    return ROWS.slice(0, tiers).map((row) => ({
      kind: 'litera',
      x,
      z: BED_Z,
      top: row - (h - BUNK_H),
      level,
    }));
  });
}

// ---------- Piezas ----------

/**
 * Litera de dos o tres pisos, con la manta del nivel o del tema de la sala (la misma que lleva
 * quien duerme en ella). La de los veteranos, de madera oscura con remates de latón; la del
 * servicio, tosca.
 */
export function bunk(
  level: number,
  tiers: 2 | 3,
  style: Style,
  quilt: Ramp = Prop.bunkQuilt(level),
): PixelBuffer {
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
    // Nivel 4: dosel arriba con flecos dorados y las cortinas recogidas en los postes.
    if (level >= 4 && style === 'tropa') {
      b.rect(0, 0, 24, 3, quilt[1]!);
      b.hline(0, 0, 24, quilt[2]!);
      for (let x = 1; x < 24; x += 2) b.set(x, 3, P.gold);
      for (const [x, dir] of [
        [3, 1],
        [20, -1],
      ] as const) {
        b.rect(x, 3, 1, h - 12, quilt[2]!);
        b.rect(x + dir, 3, 1, 6, quilt[1]!);
        b.set(x, 14, P.gold);
        b.set(x, 15, P.gold);
      }
    }
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
function chest(level: number, q: Ramp = Prop.bunkQuilt(level)): PixelBuffer {
  return Prop.piece(22, 17, (b) => {
    b.blit(Prop.trunk(), 0, 3);
    if (level >= 2) {
      b.rect(4, 0, 14, 4, q[2]!);
      b.hline(4, 0, 14, q[3]!);
      b.hline(4, 3, 14, q[1]!);
    }
  });
}

/** Taburete con una vela encima (la mesilla); en el nivel 4, un candelabro de dos velas. */
function nightstand(level = 2): PixelBuffer {
  return Prop.piece(9, 16, (b) => {
    b.blit(Prop.stool(), 0, 6);
    if (level >= 4) {
      b.rect(1, 4, 7, 1, P.gold);
      b.vline(4, 4, 2, P.gold);
      candleOn(b, 1, 4, 3);
      candleOn(b, 6, 4, 3);
      return;
    }
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

/** Armario de dos puertas (de pino tosco en el servicio, con herrajes dorados en el nivel 3). */
function wardrobe(level: number, style: Style): PixelBuffer {
  const wood: Ramp =
    style === 'servicio' ? [P.rust, P.oak, P.clay, P.tan] : [P.plum, P.bark, P.rust, P.oak];
  return Prop.piece(22, 40, (p) => {
    p.rect(0, 2, 22, 38, wood[1]!);
    p.rect(0, 0, 22, 3, wood[3]!);
    p.hline(0, 0, 22, wood[3]!);
    p.hline(0, 2, 22, wood[0]!);
    for (const x of [2, 12]) {
      p.rect(x, 4, 8, 31, wood[2]!);
      p.rect(x + 1, 6, 6, 12, wood[1]!);
      p.rect(x + 1, 21, 6, 12, wood[1]!);
      p.vline(x, 4, 31, wood[3]!);
    }
    if (level >= 4 && style !== 'servicio') {
      // Remate tallado con filete de oro.
      p.hline(0, 0, 22, P.gold);
      p.hline(0, 3, 22, P.amber);
      for (const x of [2, 12]) {
        p.hline(x + 1, 6, 6, P.amber);
        p.hline(x + 1, 21, 6, P.amber);
      }
    }
    const knob = level >= 3 && style !== 'servicio' ? P.gold : P.slate;
    p.set(9, 19, knob);
    p.set(12, 19, knob);
    p.rect(1, 36, 3, 4, wood[0]!);
    p.rect(18, 36, 3, 4, wood[0]!);
  });
}

/** Chimenea pequeña de piedra con su fuego (de piedra oscura en los veteranos). */
function smallHearth(style: Style): PixelBuffer {
  const stone =
    style === 'veterano'
      ? [P.black, P.ebony, P.plum, P.umber, P.bark]
      : [P.black, P.navy, P.slate, P.steel, P.fog];
  return Prop.piece(22, 44, (p) => {
    stoneWall(p, 5, 0, 12, 22, `tiro-${style}`, { ramp: stone, bw: 4, bh: 3 });
    p.rect(0, 22, 22, 3, W[4]!);
    p.hline(0, 22, 22, W[5]!);
    stoneWall(p, 1, 25, 20, 19, `hogar-${style}`, { ramp: stone, bw: 5, bh: 3 });
    p.rect(5, 31, 12, 13, P.black);
    p.ellipse(11, 31.5, 6, 2.5, P.black);
    p.hline(6, 42, 10, W[3]!);
    p.hline(7, 41, 8, P.orange);
    p.set(10, 40, P.gold);
    // En la repisa, una vela y una jarra.
    candleOn(p, 2, 22, 3);
    p.rect(16, 19, 3, 3, P.clay);
  });
}

/** Armero de pie del veterano: espada, hacha y alabarda. */
function weaponStand(): PixelBuffer {
  return Prop.piece(22, 42, (p) => {
    p.rect(0, 38, 22, 4, W[2]!);
    p.hline(0, 38, 22, W[4]!);
    p.rect(1, 10, 20, 2, W[3]!);
    p.vline(1, 10, 28, W[2]!);
    p.vline(20, 10, 28, W[2]!);
    // Alabarda.
    p.vline(5, 2, 36, W[4]!);
    p.rect(2, 4, 3, 5, P.fog);
    p.set(5, 1, P.mist);
    // Espada.
    p.vline(11, 8, 28, P.mist);
    p.vline(12, 8, 28, P.fog);
    p.hline(9, 9, 6, P.gold);
    p.rect(11, 5, 2, 3, W[2]!);
    // Hacha.
    p.vline(17, 6, 32, W[4]!);
    p.rect(14, 7, 3, 5, P.steel);
    p.vline(14, 7, 5, P.mist);
  });
}

/** Lavamanos: jofaina y jarra sobre su soporte, con el espejo encima. */
function washstand(): PixelBuffer {
  return Prop.piece(20, 36, (p) => {
    // Espejo.
    p.ellipse(10, 6, 6, 6, W[3]!);
    p.ellipse(10, 6, 4.5, 4.5, P.mist);
    p.ellipse(9, 5, 2, 2.5, P.white);
    p.vline(10, 12, 6, W[2]!);
    // Soporte, jofaina y jarra.
    p.rect(1, 22, 18, 2, W[4]!);
    p.hline(1, 22, 18, W[5]!);
    p.rect(3, 24, 2, 12, W[3]!);
    p.rect(15, 24, 2, 12, W[3]!);
    p.hline(5, 31, 10, W[2]!);
    p.ellipse(8, 20, 5, 2, P.fog);
    p.ellipse(8, 19.5, 3.5, 1, P.sky);
    p.rect(14, 16, 3, 6, P.mist);
    p.set(17, 17, P.mist);
  });
}

/** Mesita baja con la jofaina y la jarra (cabe bajo una ventana). */
function basinTable(): PixelBuffer {
  return Prop.piece(18, 16, (p) => {
    p.rect(0, 6, 18, 3, W[4]!);
    p.hline(0, 6, 18, W[5]!);
    p.rect(2, 9, 2, 7, W[3]!);
    p.rect(14, 9, 2, 7, W[3]!);
    p.hline(4, 12, 10, W[2]!);
    p.ellipse(7, 4.5, 5, 2, P.fog);
    p.ellipse(7, 4, 3.5, 1, P.sky);
    p.rect(13, 0, 3, 6, P.mist);
    p.set(16, 1, P.mist);
  });
}

/** Cesto de la ropa con sábanas. */
function laundry(): PixelBuffer {
  return Prop.piece(16, 12, (p) => {
    p.rect(1, 4, 14, 8, P.tan);
    for (let x = 1; x < 15; x += 2) p.vline(x, 4, 8, P.clay);
    p.hline(1, 4, 14, P.sand);
    p.ellipse(8, 3, 6, 2.5, P.white);
    p.ellipse(6, 2.5, 3, 1.5, P.mist);
  });
}

/** Mesita de los veteranos con los dados y dos jarras. */
function diceTable(): PixelBuffer {
  return Prop.piece(20, 16, (p) => {
    p.rect(0, 6, 20, 3, W[4]!);
    p.hline(0, 6, 20, W[5]!);
    p.rect(8, 9, 4, 7, W[3]!);
    p.rect(4, 15, 12, 1, W[2]!);
    for (const x of [2, 14]) {
      p.rect(x, 1, 4, 5, P.oak);
      p.hline(x, 1, 4, P.white);
      p.vline(x + 4, 2, 3, P.oak);
    }
    p.rect(9, 4, 2, 2, P.white);
    p.set(9, 4, P.black);
    p.rect(11, 3, 2, 2, P.mist);
  });
}

// ---------- Pared, suelo y sala ----------

/** Nivel de la manta (el de `bedsOf`). */
const quiltOf = (room: Room) =>
  room.type === 'veteranos' ? 3 : room.type === 'servicio' ? 1 : room.level;
/** Los colores de esa manta: los de su nivel o los del tema de la sala. */
const quiltRamp = (room: Room): Ramp => cloth(room, Prop.bunkQuilt(quiltOf(room)));

function styleOf(room: Room): Style {
  return room.type === 'servicio' ? 'servicio' : room.type === 'veteranos' ? 'veterano' : 'tropa';
}

function wall(b: PixelBuffer, room: Room, look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const lvl = room.level;
  const style = styleOf(room);
  const { tiers } = perCell(room);
  // Encima de cada litera (de dos pisos, desde el nivel 2), su repisa o su trofeo.
  if (tiers === 2 && (lvl >= 2 || style === 'veterano'))
    plan(room, cells.at(-1)!.x1).bunks.forEach((x, k) => {
      if (style === 'veterano' && (lvl >= 2 || k === 0)) {
        const t = trophy(k, look.crest);
        b.blit(t, bx(x) - Math.floor(t.w / 2), 30 - t.h);
      } else if (style !== 'veterano') b.blit(bunkShelf(k, style), bx(x) - 7, 22);
    });
  // Las perchas, en el tramo de la derecha.
  const last = cells.at(-1)!;
  const winR = bx(last.win + WIN_HALF);
  if (bx(last.x1) - winR >= 12) b.blit(pegs(lvl, style), winR + 1, 16);
  // Sin ventana: un cuadro (un paisaje) donde iría.
  for (const c of cells)
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

/** Alfombra delante de cada grupo de camas desde el nivel 2 (los veteranos, piel de oso). */
function floor(b: PixelBuffer, room: Room): void {
  if (room.level < 2 || room.type === 'servicio') return;
  const vet = room.type === 'veteranos';
  // La de la casa, del color de las mantas del nivel (granate, azul, morada); o la del tema.
  const c = cloth(room, Prop.bunkQuilt(room.level));
  const [edge, base, dot] = vet
    ? [P.bark, P.umber, P.cocoa]
    : room.level >= 4
      ? [P.gold, c[1], P.lemon]
      : room.level >= 3
        ? [c[0], c[1], P.gold]
        : [c[0], c[1], c[2]];
  for (const s of stretchesOf(room, b.w)) {
    if (s.kind === 'right') continue;
    const x0 = Math.round(s.x0 + 6);
    const x1 = Math.round(s.x1 - 6);
    b.rect(x0, 9, x1 - x0, FLOOR_D - 18, edge);
    b.rect(x0 + 1, 10, x1 - x0 - 2, FLOOR_D - 20, base);
    for (let x = x0 + 3; x < x1 - 2; x += 4) b.set(x, FLOOR_D / 2, dot);
    // En el nivel 4, con una cenefa dentro y flecos en las puntas.
    if (room.level >= 4 && !vet) {
      b.rect(x0 + 3, 12, x1 - x0 - 6, 1, c[2]);
      b.rect(x0 + 3, FLOOR_D - 13, x1 - x0 - 6, 1, c[2]);
      for (let y = 10; y < FLOOR_D - 10; y += 2) {
        b.set(x0 - 1, y, P.sand);
        b.set(x1, y, P.sand);
      }
    }
  }
}

/** El mueble propio de cada tramo de en medio (el primero y el segundo). */
function feature(
  style: Style,
  k: number,
  lvl: number,
): { img: PixelBuffer; light?: Glow; box?: boolean } {
  // La chimenea, con volumen (ver `solid`).
  const hearth = { img: smallHearth(style), light: fire(6, 60, FIRE, false), box: true };
  if (style === 'veterano') return k === 1 ? { img: weaponStand() } : hearth;
  if (style === 'servicio') return k === 1 ? { img: wardrobe(lvl, style) } : { img: washstand() };
  return k === 1 ? { img: wardrobe(lvl, style) } : hearth;
}

/** Lo de debajo de cada ventana (bajo), según cuál sea. */
function underWindow(style: Style, j: number, room: Room): PixelBuffer {
  const lvl = room.level;
  if (style === 'veterano') {
    if (j === 0) return lvl >= 3 ? Prop.armorStand() : chest(3, quiltRamp(room));
    return j === 1 ? diceTable() : chest(3, quiltRamp(room));
  }
  if (style === 'servicio') {
    if (j === 0) return lvl < 2 ? bucket() : chest(1);
    return j === 1 ? laundry() : chest(1);
  }
  return j === 1 ? basinTable() : chest(lvl, quiltRamp(room));
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const style = styleOf(room);
  const { tiers } = perCell(room);
  const cells = cellsOf(room, w);
  const { bunks, features } = plan(room, w);
  const t: Thing[] = [lampOver(cells, w, lvl)];
  for (const x of bunks)
    t.push(
      at(
        tiers === 1 ? mat() : bunk(quiltOf(room), tiers === 3 ? 3 : 2, style, quiltRamp(room)),
        x,
        BED_Z,
      ),
    );
  for (const f of features) {
    const { img, light, box } = feature(style, f.k, lvl);
    t.push(box ? solid(img, f.x, 0, light) : at(img, f.x, WALL, 0, light));
  }
  cells.forEach((c, j) => t.push(at(underWindow(style, j, room), c.win, WALL)));
  // En el tramo de la derecha: la mesilla con su vela (o la escoba del servicio).
  const last = cells.at(-1)!;
  const rx = Math.min(last.win + WIN_HALF + 7, w - 7);
  if (style === 'servicio') {
    t.push(at(broom(), rx, WALL));
    // La vela de la primera repisa (con literas de dos pisos; ver wall).
    if (tiers === 2 && bunks.length) t.push(wallLight(room, bx(bunks[0]!) + 3, 24, 0.4, 34));
  } else if (lvl >= 2)
    t.push(
      at(nightstand(lvl), rx, WALL - 2, 0, {
        ...candle(14, lvl >= 4 ? 40 : 30, lvl >= 4 ? 0.6 : 0.4),
        color: CANDLE,
      }),
    );
  return t;
}

/** Por reparar: literas rotas, paja por el suelo y una caja. */
function ruin(room: Room, w: number): Thing[] {
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w))
    if (s.kind !== 'right') t.push(at(brokenBunk(), s.x0 + BUNK_W / 2 + 4, WALL));
  for (const c of cellsOf(room, w)) t.push(at(mat(), c.win, WALL));
  t.push(at(Prop.crate(), w - 9, WALL));
  return t;
}

const art = { wall, things, ruin, floor, ownLamp: true };
export const dormitorio: RoomArt = art;
export const servicio: RoomArt = art;
export const veteranos: RoomArt = art;
