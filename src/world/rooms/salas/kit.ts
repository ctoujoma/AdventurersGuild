/**
 * Lo común del arte de cada sala: profundidades, luces, dónde caen los huecos y sus ventanas, y
 * la forma de lo que aporta cada sala (`RoomArt`: su pared del fondo, sus muebles y lo que queda
 * cuando está por reparar). Cada sala va en su fichero de esta carpeta y se registra en
 * `index.ts`.
 */
import { P, R } from '../../../art/palette';
import type { PixelBuffer } from '../../../art/pixel';
import * as Prop from '../../props';
import type { Room } from '../../../core/model';
import type { SalonLook } from '../salon';
import { CELL_W, DEPTH, PARTITION } from '../layout';
import { BACK, scaleAt } from '../view3d';

export type RGB = [number, number, number];

export interface Glow {
  /** Altura sobre la base de la figura y alcance de la luz, en píxeles del mundo. */
  dy: number;
  r: number;
  color: RGB;
  /** Fuerza (1 = farol) y cuánto tiembla (0 quieta, 0,3 fuego). */
  power: number;
  flicker: number;
  /** Llamas que se ven bailar (fuego de chimenea, fogón o velas). */
  flames?: { dx: number; dy: number; size: number }[];
}

export interface Thing {
  img: PixelBuffer;
  /** Centro en x, profundidad y altura de la base sobre el suelo. */
  x: number;
  z: number;
  y: number;
  /** Colgado del techo (y se cuenta desde el techo hacia abajo hasta su parte de arriba). */
  hang?: boolean;
  light?: Glow;
}

/** Filas de la textura del suelo (va a media resolución en profundidad). */
export const FLOOR_D = DEPTH / 2;

/** Contra la pared del fondo, a media sala y delante. */
export const WALL = DEPTH - 6;
export const MID = DEPTH / 2;
export const FRONT = 12;

export const LANTERN: RGB = [255, 196, 120];
export const WARM: RGB = [255, 168, 92];
export const FIRE: RGB = [255, 132, 60];
export const FORGE: RGB = [255, 110, 44];
export const CANDLE: RGB = [255, 210, 140];
export const GOLD: RGB = [254, 200, 80];
export const COLD: RGB = [150, 200, 255];

export const fire = (dy: number, r: number, color: RGB, big: boolean): Glow => ({
  dy,
  r,
  color,
  power: 0.85,
  flicker: 0.3,
  flames: big
    ? [
        { dx: -4, dy: 0, size: 1 },
        { dx: 3, dy: 1, size: 0.8 },
      ]
    : [{ dx: 0, dy: 0, size: 0.6 }],
});

export const candle = (dy: number, r = 34, power = 0.45): Glow => ({
  dy,
  r,
  color: CANDLE,
  power,
  flicker: 0.12,
});

/** Madera: [black, plum, bark, rust, oak, clay, tan]. */
export const W = R.wood;

/** Las salas que no tienen ventanas aunque estén por encima del suelo. */
export const BLIND: ReadonlySet<string> = new Set(['tesoro', 'despensa']);
export const hasWindows = (room: Room) => room.floor >= 0 && !BLIND.has(room.type);

/** Centro de la ventana del hueco `i` en la pared del fondo (en sus píxeles). */
export const windowX = (i: number) =>
  Math.round((i * CELL_W + CELL_W * 0.7 - PARTITION / 2) * BACK);

/** Mitad del ancho de una ventana con su alféizar, en el mundo. */
export const WIN_HALF = 15;
/**
 * Lo más alto que puede ser un mueble pegado a la pared bajo una ventana (el alféizar, visto en
 * el fondo, queda a esa altura sobre el suelo).
 */
export const SILL = 32;

/**
 * Un hueco de la sala, en x del interior (en el mundo): dónde empieza y acaba y dónde cae el
 * centro de su ventana (`win`, aunque no la tenga: entonces `glass` es falso y ahí también
 * caben cosas altas o colgadas).
 */
export interface Cell {
  i: number;
  x0: number;
  x1: number;
  win: number;
  glass: boolean;
}

export function cellsOf(room: Room, w: number): Cell[] {
  const glass = hasWindows(room);
  return Array.from({ length: room.w }, (_, i) => ({
    i,
    x0: Math.max(0, i * CELL_W - PARTITION / 2),
    x1: Math.min(w, (i + 1) * CELL_W - PARTITION / 2),
    win: windowX(i) / BACK,
    glass,
  }));
}

/** De x del interior (mundo) a x de la pared del fondo. */
export const bx = (x: number) => Math.round(x * BACK);

/** Ancho en el mundo de una pieza colocada a `z` de fondo. */
export const worldW = (img: PixelBuffer, z: number) => img.w / scaleAt(z);

/** Lo que recibe la pared del fondo de una sala, además del búfer, la sala y el aspecto. */
export interface WallCtx {
  /** Huecos de la sala (en el mundo) y alto del zócalo (en el fondo). */
  cells: Cell[];
  wain: number;
  /** Fila (en el fondo) de arriba del zócalo: lo que se apoya en él va ahí. */
  top: number;
  ruin: boolean;
}

/** Lo que aporta cada sala. */
export interface RoomArt {
  /** Lo que va en la pared del fondo (encima del yeso, la madera o la piedra y las ventanas). */
  wall?(b: PixelBuffer, room: Room, look: SalonLook, ctx: WallCtx): void;
  /** Los muebles de la sala en uso (sin el farol del techo, que lo pone `furnish`). */
  things?(room: Room, w: number, look: SalonLook): Thing[];
  /** Los muebles de la sala por reparar (si no, los de cualquier sala rota). */
  ruin?(room: Room, w: number, look: SalonLook): Thing[];
  /** Lo que se pinta en el suelo (alfombras, esteras…), en su textura de ancho × fondo. */
  floor?(b: PixelBuffer, room: Room, cells: Cell[]): void;
  /** Pone sus propias luces colgadas: entonces no lleva el farol de siempre. */
  ownLamp?: boolean;
}

/**
 * Una cama de las que usa la gente (la litera, el catre de la enfermería o el jergón), con el
 * centro del mueble en x, su profundidad y la fila de la almohada (contada como en una litera
 * de 40 de alto: en una de tres pisos, más alta, sale negativa arriba).
 */
export interface Bed {
  kind: 'litera' | 'catre' | 'jergon';
  x: number;
  z: number;
  top: number;
  level: number;
}

/** Farol de cadena corta: colgado delante de una ventana, no la tapa. */
export function lantern(): PixelBuffer {
  return Prop.piece(
    7,
    9,
    (p) => {
      p.vline(3, 0, 1, P.black);
      p.rect(1, 1, 5, 7, P.black);
      p.rect(2, 2, 3, 5, P.gold);
      p.set(3, 3, P.lemon);
      p.hline(0, 8, 7, P.black);
    },
    'none',
  );
}

/**
 * El farol de la sala, colgado delante de la ventana del hueco de en medio (allí no tapa nada:
 * con su cadena corta queda por encima del cristal), para las salas con muebles altos a los
 * lados de las ventanas.
 */
export function lampOver(cells: Cell[], w: number): Thing {
  const c = cells[Math.floor((cells.length - 1) / 2)]!;
  return hung(lantern(), c.win, MID, 0, {
    dy: 3,
    r: Math.max(80, Math.round(w * 0.7)),
    color: LANTERN,
    power: 1,
    flicker: 0.08,
  });
}

/** Un mueble en el suelo. */
export const at = (img: PixelBuffer, x: number, z: number, y = 0, light?: Glow): Thing => ({
  img,
  x,
  z,
  y,
  light,
});

/** Algo colgado del techo, con su parte de arriba a `y` del techo. */
export const hung = (img: PixelBuffer, x: number, z: number, y = 0, light?: Glow): Thing => ({
  img,
  x,
  z,
  y,
  hang: true,
  light,
});

/**
 * Un tramo de pared entre ventanas (en x del interior, en el mundo): el de la izquierda (hasta
 * la primera ventana), los de en medio (entre dos ventanas: casi el doble de anchos, donde las
 * salas anchas ponen lo que la pequeña no tiene) y el de la derecha (estrecho).
 */
export interface Stretch {
  /** 0 el de la izquierda, 1 el primero de en medio… y `room.w` el de la derecha. */
  i: number;
  x0: number;
  x1: number;
  kind: 'left' | 'mid' | 'right';
}

export function stretchesOf(room: Room, w: number): Stretch[] {
  const wins = cellsOf(room, w).map((c) => c.win);
  const out: Stretch[] = [{ i: 0, x0: 0, x1: wins[0]! - WIN_HALF, kind: 'left' }];
  for (let k = 0; k + 1 < wins.length; k++)
    out.push({ i: k + 1, x0: wins[k]! + WIN_HALF, x1: wins[k + 1]! - WIN_HALF, kind: 'mid' });
  out.push({ i: wins.length, x0: wins.at(-1)! + WIN_HALF, x1: w, kind: 'right' });
  return out;
}

/**
 * Centros para poner seguidas, de izquierda a derecha, piezas de esos anchos (en el mundo) en
 * un tramo, con el mismo hueco entre ellas y con los bordes.
 */
export function spread(x0: number, x1: number, widths: number[]): number[] {
  const free = x1 - x0 - widths.reduce((a, b) => a + b, 0);
  const gap = Math.max(0, free / (widths.length + 1));
  let x = x0 + gap;
  return widths.map((wd) => {
    const c = x + wd / 2;
    x += wd + gap;
    return c;
  });
}

/** Las piezas (con su profundidad) repartidas en un tramo con `spread`. */
export function row(s: { x0: number; x1: number }, items: [PixelBuffer, number, Glow?][]): Thing[] {
  const xs = spread(
    s.x0,
    s.x1,
    items.map(([img, z]) => worldW(img, z)),
  );
  return items.map(([img, z, light], k) => at(img, xs[k]!, z, 0, light));
}
