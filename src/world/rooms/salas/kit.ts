/**
 * Lo común del arte de cada sala: profundidades, luces, dónde caen los huecos y sus ventanas, y
 * la forma de lo que aporta cada sala (`RoomArt`: su pared del fondo, sus muebles y lo que queda
 * cuando está por reparar). Cada sala va en su fichero de esta carpeta y se registra en
 * `index.ts`.
 */
import type { Mat } from '../volume';
import { P, R } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import * as Prop from '../../props';
import type { Room } from '../../../core/model';
import type { SalonLook } from '../salon';
import { CELL_W, DEPTH, PARTITION, PITCH, ROOM_H } from '../layout';
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
  /** Igual de fuerte de día que de noche (la luz que entra por un agujero del techo). */
  steady?: boolean;
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
  /** Con volumen: de su silueta salen los lados y la parte de arriba hasta la pared (ver `volume.ts`). */
  box?: boolean;
  /**
   * Con cuerpo de este grosor (en profundidad del mundo) en vez de hasta la pared: lo suelto
   * por la sala (arcones, montones, barriles, cubas). Ver `thick`.
   */
  thick?: number;
  /** De qué es (su costado se pinta según eso): ver `Mat` en `volume.ts`. */
  mat?: Mat;
  /** Un cilindro de verdad (cubas, barriles): ver `Round`. */
  round?: Round;
  /**
   * Lo que suelta de vez en cuando (destellos del oro, vapor, burbujas): qué, cuántos por
   * segundo y en qué zona de su dibujo (x0, y0, x1, y1 en sus píxeles). Ver `emits`.
   */
  emit?: Emit[];
  /** Se puede tocar: al pasar el ratón se marca y al tocarlo abre lo suyo. */
  act?: ActId;
  /** Sitio al que la gente va a hacer algo (calentarse las manos, rezar…). */
  poi?: PoiKind;
}

/**
 * Lo que se hace en un sitio de una sala: leer (el tablón, el mapa), calentarse o rezar (los
 * héroes libres); o, para el servicio, cada tarea de su oficio en su mueble: la olla del hogar,
 * la mesa (picar, amasar), la pila de fregar, el horno, la cuba, el barril y la caldera.
 */
export type PoiKind = LeisurePoi | TaskPoi;
export type LeisurePoi = 'read' | 'warm' | 'pray';
export type TaskPoi = 'olla' | 'mesa' | 'fregar' | 'horno' | 'cuba' | 'barril' | 'caldera';

/** Un mueble con su sitio de trabajo. */
export const task = (t: Thing, poi: TaskPoi): Thing => ({ ...t, poi });

/** Lo que abre una cosa de una sala al tocarla (el tablón, el mapa de la comarca…). */
export type ActId = 'tablon' | 'mapa' | 'candidatos' | 'equipo';

/** Algo tocable pintado en la pared del fondo, en sus píxeles. */
export interface WallAct {
  act: ActId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lo tocable de la pared que se está pintando: `backWall` lo vacía al empezar y la escena lo
 * recoge justo después (así las salas no tienen que devolver nada más que su dibujo).
 */
const wallActs: WallAct[] = [];
export const markWall = (a: WallAct) => void wallActs.push(a);
export const takeWallActs = (): WallAct[] => wallActs.splice(0);

/** Filas de la textura del suelo (va a media resolución en profundidad). */
export const FLOOR_D = DEPTH / 2;

/** Contra la pared del fondo, a media sala y delante. */
export const WALL = DEPTH - 6;
/**
 * Lo suelto por la sala (arcones, montones, cubas, barriles, calderas): bien separado de la
 * pared, con suelo detrás; con su grosor (`thick`), no llega a tocarla y, al mover la cámara,
 * se mueve contra ella como algo de verdad.
 */
export const FREE = DEPTH - 20;
/** Lo grande con volumen (hogares, fraguas): más adelante que la pared, con sus lados hasta ella. */
export const SOLID = DEPTH - 16;
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
 * Araña de hierro con cuatro velas (la luz del nivel 3) o, en el 4, de latón con seis: igual de
 * alta que el farol al que sustituye, con `chain` filas de cadena encima de las velas.
 */
export function chandelier(chain: number, brass = false): PixelBuffer {
  const c = chain;
  const w = brass ? 21 : 15;
  const mid = (w - 1) / 2;
  const arm = brass ? P.amber : P.black;
  const xs = brass ? [1, 4, 7, 13, 16, 19] : [1, 4, 10, 13];
  return Prop.piece(
    w,
    c + 7,
    (p) => {
      p.vline(mid, 0, c + 5, P.black);
      for (const x of xs) {
        p.set(x, c - 1, P.gold);
        p.set(x, c, P.lemon);
        p.vline(x, c + 1, 2, P.white);
        p.hline(x - 1, c + 3, 3, brass ? P.gold : P.steel);
      }
      // Los brazos, curvados hacia arriba en las puntas, y el remate de abajo.
      p.hline(1, c + 4, w - 2, arm);
      p.set(0, c + 3, arm);
      p.set(w - 1, c + 3, arm);
      if (brass) p.hline(2, c + 4, w - 4, P.gold);
      p.hline(mid - 1, c + 5, 3, brass ? P.gold : P.slate);
      p.set(mid, c + 6, brass ? P.amber : P.black);
    },
    'none',
  );
}

/**
 * La luz del techo de una sala: el farol o, en el nivel 3, la araña (más fuerte y más lejos; en
 * el 4, más todavía).
 */
export function ceilingGlow(w: number, level: number, dy: number): Glow {
  const k = level >= 4 ? 1.35 : level >= 3 ? 1.2 : 1;
  return {
    dy,
    r: Math.round(Math.max(80, w * 0.7) * k),
    color: level >= 3 ? CANDLE : LANTERN,
    power: level >= 4 ? 1.45 : level >= 3 ? 1.25 : 1,
    flicker: level >= 3 ? 0.1 : 0.08,
  };
}

/**
 * El farol de la sala (la araña en el nivel 3), colgado delante de la ventana del hueco de en
 * medio (allí no tapa nada: con su cadena corta queda por encima del cristal), para las salas
 * con muebles altos a los lados de las ventanas.
 */
export function lampOver(cells: Cell[], w: number, level = 1): Thing {
  const c = cells[Math.floor((cells.length - 1) / 2)]!;
  const img = level >= 3 ? chandelier(2, level >= 4) : lantern();
  return hung(img, c.win, MID, 0, ceilingGlow(w, level, 3));
}

/** Aplique de pared: una vela encendida en su brazo de hierro (se pinta en la pared). */
export function sconce(): PixelBuffer {
  return Prop.piece(7, 11, (p) => {
    p.set(3, 0, P.gold);
    p.set(3, 1, P.lemon);
    p.rect(2, 2, 3, 4, P.white);
    p.vline(4, 2, 4, P.mist);
    p.rect(1, 6, 5, 2, P.steel);
    p.hline(1, 6, 5, P.fog);
    p.rect(3, 8, 1, 3, P.slate);
    p.rect(2, 10, 3, 1, P.slate);
  });
}

/** Pinta un aplique en la pared del fondo con la llama en (`x`, `y`) del fondo. */
export function sconceOn(b: PixelBuffer, x: number, y: number): void {
  b.blit(sconce(), x - 4, y - 1);
}

/**
 * La luz de un aplique pintado en la pared (o de una vela pintada): una figura vacía contra la
 * pared, a la altura de la llama, que solo pone la luz. `x` e `y` son del fondo (los de
 * `sconceOn`).
 */
export function wallLight(room: Room, x: number, y: number, power = 0.6, r = 50): Thing {
  const bh = Math.round((room.h * PITCH - (PITCH - ROOM_H)) * BACK);
  return at(new PixelBuffer(1, 1), x / BACK, WALL, (bh - y) / BACK, {
    ...candle(0, r, power),
    flicker: 0.1,
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

/** Igual que `at`, con volumen hasta la pared (para hogares y fraguas, a `SOLID`). */
export const solid = (img: PixelBuffer, x: number, y = 0, light?: Glow): Thing => ({
  ...at(img, x, SOLID, y, light),
  box: true,
  // Lo empotrado (hogares, fraguas) es de obra.
  mat: 'piedra',
});

/**
 * Un cilindro de verdad detrás del dibujo: tumbado (`fondo`: la tapa redonda mira a la cámara y
 * el cuerpo se va hacia el fondo) o de pie (`pie`: el eje es vertical y el frente coincide con
 * el dibujo). Centro y radio en píxeles del dibujo; `len`, lo largo (tumbado, en profundidad del
 * mundo) o lo alto (de pie, en píxeles del dibujo, centrado en `cy`). Duelas y aros con los
 * colores que se le den.
 */
export interface Round {
  axis: 'fondo' | 'pie';
  cx: number;
  cy: number;
  r: number;
  len: number;
  wood: string;
  dark: string;
  hoop: string;
}

/** Un mueble que es un cilindro de verdad (ver `Round`). */
export const round = (t: Thing, r: Round): Thing => ({ ...t, round: r });

export interface Emit {
  kind: 'glint' | 'steam' | 'bubble' | 'ember';
  rate: number;
  at: [number, number, number, number];
}

/** Un mueble que suelta algo de vez en cuando (en la zona `at` de su dibujo). */
export const emits = (t: Thing, ...list: Emit[]): Thing => ({
  ...t,
  emit: [...(t.emit ?? []), ...list],
});

/** Con cuerpo: la silueta se estira `d` hacia el fondo (lo suelto por la sala), de `mat`. */
export const thick = (t: Thing, d: number, mat?: Mat): Thing => ({
  ...t,
  thick: d,
  mat: mat ?? t.mat,
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
