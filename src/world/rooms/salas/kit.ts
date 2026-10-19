/**
 * Lo común del arte de cada sala: profundidades, luces, dónde caen los huecos y sus ventanas, y
 * la forma de lo que aporta cada sala (`RoomArt`: su pared del fondo, sus muebles y lo que queda
 * cuando está por reparar). Cada sala va en su fichero de esta carpeta y se registra en
 * `index.ts`.
 */
import { R } from '../../../art/palette';
import type { PixelBuffer } from '../../../art/pixel';
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
  /** Pone sus propias luces colgadas: entonces no lleva el farol de siempre. */
  ownLamp?: boolean;
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
