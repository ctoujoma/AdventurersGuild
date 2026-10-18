/**
 * Texturas de la vista 3D: las caras de cada sala (fondo, suelo, techo y lados), la fachada
 * del corte con la tierra y los muros, los tejados y lo que hay fuera. Todo pintado a mano en
 * búferes de la paleta; la escena solo las pega en sus planos.
 *
 * Escalas: el fondo de las salas se pinta ya al tamaño con el que se ve (BACK), para que cada
 * píxel de la textura caiga en un píxel de la pantalla; el suelo, el techo y los lados van a
 * media resolución en profundidad, que es lo poco que se ven de canto.
 */
import { P, R, type Ramp } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { Rng } from '../../core/rng';
import type { Room } from '../../core/model';
import { GROUND } from '../geometry';
import { ambientOcclusion, beam, cobweb, planksV, plaster, post, stoneWall } from '../paint';
import * as Prop from '../props';
import {
  CELL_W,
  DEPTH,
  PARTITION,
  PITCH,
  ROOM_H,
  SLAB,
  STAIR_W,
  WALL,
  colX,
  floorTop,
  interior,
  roofRuns,
  stairX,
  type Rect,
  type RoofRun,
  type RoomsLayout,
} from './layout';
import { NO_LOOK, salonWall, type SalonLook } from './salon';
import { BACK } from './view3d';

export type Theme = 'madera' | 'yeso' | 'piedra' | 'cueva';
export const themeOf = (f: number): Theme =>
  f >= 1 ? 'madera' : f === 0 ? 'yeso' : f === -1 ? 'piedra' : 'cueva';

/** Filas del suelo, del techo y de los lados (media resolución en profundidad). */
export const DEEP = DEPTH / 2;

/** Sala sin muebles todavía (se está levantando o mudando) y sala rota. */
export const bare = (r: Room) => !!r.works && r.works.kind !== 'extend';
export const ruined = (r: Room) => r.level === 0 && !r.works;

const WOOD: Ramp = [P.plum, P.bark, P.rust, P.oak];
const WOOD_DARK: Ramp = [P.black, P.plum, P.bark, P.rust];
const WAINSCOT: Ramp = [P.ebony, P.plum, P.bark, P.rust];
const PLASTER: Ramp = R.plaster;
const RAW: Ramp = [P.plum, P.rust, P.clay, P.tan, P.sand];
const STONE: Ramp = [P.black, P.navy, P.slate, P.steel, P.fog];
/** Sillares de las salas de la planta de abajo: más claros, que se vean a la luz del farol. */
const CELLAR: Ramp = [P.navy, P.slate, P.steel, P.fog, P.mist];
const ROCK: Ramp = [P.black, P.ebony, P.plum, P.umber, P.bark];
const TILE: Ramp = [P.black, P.plum, P.rust, P.clay, P.tan];

/** Ancho de un hueco en la pared del fondo y dónde cae su ventana. */
const CELL_BACK = CELL_W * BACK;
/** Alma oscura de los tabiques entre salas (lo demás del grosor lleva la textura del muro). */
const CORE = 8;
const windowX = (i: number) => Math.round((i * CELL_W + CELL_W * 0.7 - PARTITION / 2) * BACK);

/** Las salas que no tienen ventanas aunque estén por encima del suelo. */
const BLIND = new Set(['tesoro', 'despensa']);

// ---------- Caras de una sala ----------

/** Pared del fondo de una sala de `w`×`h` (interior), ya a la escala del fondo. */
export function backWall(room: Room, w: number, h: number, look: SalonLook = NO_LOOK): PixelBuffer {
  const bw = Math.round(w * BACK);
  const bh = Math.round(h * BACK);
  const b = new PixelBuffer(bw, bh);
  const theme = themeOf(room.floor);
  const seed = `${room.id}-${room.type}`;
  const ruin = ruined(room);
  const wain = 14;
  if (bare(room)) {
    plaster(b, 0, 0, bw, bh, seed, RAW);
    for (let x = 0; x < bw; x += 30) post(b, x, 0, 3, bh, WOOD_DARK);
  } else if (theme === 'yeso') {
    plaster(b, 0, 0, bw, bh - wain, seed, ruin ? RAW : PLASTER, ruin);
    planksV(b, 0, bh - wain, bw, wain, seed, WAINSCOT, 6);
    beam(b, 0, bh - wain - 3, bw, 3, WOOD_DARK);
    for (let x = 0; x < bw; x += 36) post(b, x, 0, 3, bh - wain - 3, WOOD_DARK);
  } else if (theme === 'madera') {
    planksV(b, 0, 0, bw, bh, seed, ruin ? WOOD_DARK : WOOD, 7);
    beam(b, 0, bh - wain, bw, 3, WOOD_DARK);
  } else if (theme === 'piedra')
    stoneWall(b, 0, 0, bw, bh, seed, { ramp: CELLAR, bw: 12, bh: 7, moss: ruin ? 10 : 0 });
  else stoneWall(b, 0, 0, bw, bh, seed, { ramp: ROCK, bw: 14, bh: 8 });
  // Vigas a la altura de cada planta en las salas de más de una.
  for (let j = 1; j < room.h; j++)
    beam(b, 0, Math.round((j * PITCH - SLAB) * BACK), bw, 4, WOOD_DARK);
  beam(b, 0, 0, bw, 3, WOOD_DARK);
  if (room.floor >= 0 && !BLIND.has(room.type))
    for (let j = 0; j < room.h; j++)
      for (let i = 0; i < room.w; i++)
        windowAt(b, windowX(i), Math.round((j * PITCH + 18) * BACK), room, ruin);
  if (!bare(room) && !ruin) {
    if (room.type === 'salon') {
      const windows = Array.from({ length: room.w }, (_, i) => windowX(i));
      salonWall(b, room, look, windows, CELL_BACK, wain);
    } else decorate(b, room);
  }
  if (ruin) {
    cobweb(b, 1, 1, 8, 1);
    cobweb(b, bw - 2, 1, 6, -1);
    const rng = new Rng(seed);
    for (let k = 0; k < 3; k++) {
      const px = rng.int(4, Math.max(5, bw - 30));
      const py = rng.int(6, Math.max(7, bh - 14));
      b.line(px, py, px + rng.int(14, 24), py + rng.int(-4, 4), P.oak);
      b.line(px, py + 1, px + rng.int(14, 24), py + rng.int(-3, 5), P.rust);
    }
  }
  ambientOcclusion(b, 0, 0, bw, bh, 5, { top: true, bottom: false, left: true, right: true });
  return b;
}

/** Ventana de cuarterones centrada en `cx`: el cristal se deja transparente (se ve el cielo). */
function windowAt(b: PixelBuffer, cx: number, y: number, room: Room, ruin: boolean) {
  const w = 16;
  const h = 20;
  const x = cx - w / 2;
  b.rect(x - 3, y - 3, w + 6, h + 6, P.plum);
  b.rect(x - 2, y - 2, w + 4, h + 4, P.bark);
  const stained = room.type === 'capilla';
  const glass = [P.rose, P.gold, P.sky, P.grape];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (stained) b.set(x + i, y + j, glass[(Math.floor(i / 4) + Math.floor(j / 5)) % 4]!);
      else b.clear(x + i, y + j);
  b.vline(x + w / 2, y, h, P.bark);
  b.hline(x, y + h / 2, w, P.bark);
  b.hline(x - 4, y + h + 3, w + 8, P.oak);
  b.hline(x - 4, y + h + 4, w + 8, P.plum);
  if (ruin) {
    // Tablones clavados de través.
    b.line(x - 2, y + 3, x + w + 1, y + h - 6, P.oak);
    b.line(x - 2, y + 4, x + w + 1, y + h - 5, P.rust);
    b.line(x - 2, y + h - 3, x + w + 1, y + 6, P.oak);
  } else if (!stained) {
    b.rect(x + 2, y + h, 6, 3, P.brick);
    b.set(x + 3, y + h - 1, P.leaf);
    b.set(x + 5, y + h - 2, P.lime);
    b.set(x + 6, y + h - 1, P.leaf);
  }
}

/** Lo que va colgado en la pared del fondo, a la izquierda de cada ventana. */
function decorate(b: PixelBuffer, room: Room) {
  const floor = b.h;
  /** Pone una pieza en el hueco `i`, con su base a `up` píxeles (del mundo) sobre el suelo. */
  const hang = (img: PixelBuffer, i: number, up: number, dx = 0) => {
    const x = Math.round(i * CELL_BACK + 6 + dx);
    b.blit(img, Math.min(x, b.w - img.w - 2), Math.round(floor - up * BACK - img.h));
  };
  const lvl = room.level;
  switch (room.type) {
    case 'recibidor':
      coatRack(b, 8, floor - Math.round(64 * BACK));
      hang(Prop.sconce(), 0, 54, 30);
      break;
    case 'cocina': {
      b.hline(6, 8, b.w - 12, P.slate);
      const rng = new Rng(`cacharros-${room.id}`);
      for (let x = 12; x < b.w - 12; x += 11) {
        b.vline(x, 9, 3, P.black);
        if (rng.chance(0.5)) {
          b.ellipse(x, 15, 3, 2, P.slate);
          b.hline(x - 2, 13, 5, P.steel);
        } else
          for (let k = 0; k < 5; k++)
            b.vline(x - 2 + (k % 3), 11 + k, 2, k % 2 ? P.leaf : P.forest);
      }
      hang(Prop.shelf(30, 3, `cocina-${room.id}`), 0, 44, 32);
      break;
    }
    case 'veteranos':
      hang(Prop.antlers(), 0, 64, 6);
      hang(Prop.sword(), 0, 52, 2);
      break;
    case 'dormitorio':
      if (lvl >= 2) hang(Prop.shelf(24, 2, `dorm-${room.id}`), 0, 60, 4);
      break;
    case 'mapas':
      hang(Prop.wallMap(), 0, 38, -2);
      break;
    case 'armeria':
    case 'armas':
      for (let i = 0; i < 3; i++) hang(Prop.sword(), 0, 34 + i * 10, 14);
      break;
    case 'forja':
      tools(b, Math.round(CELL_BACK * 0.42), floor - Math.round(60 * BACK));
      break;
    case 'despensa':
      for (let i = 0; i < 4; i++) ham(b, 14 + i * 12, 6);
      break;
    case 'tiro':
      hang(Prop.dartboard(), 0, 42, 10);
      if (room.w > 1) hang(Prop.dartboard(), 1, 46, 10);
      break;
    case 'capilla':
      b.ellipse(Math.round(b.w / 2), 12, 5, 5, P.gold);
      b.ellipse(Math.round(b.w / 2), 12, 3, 3, P.lemon);
      break;
    case 'enfermeria':
      for (let i = 0; i < 3; i++) herbs(b, 10 + i * 9, 8);
      break;
    default:
      break;
  }
}

function coatRack(b: PixelBuffer, x: number, y: number) {
  b.hline(x, y, 24, P.rust);
  for (const px of [3, 11, 19]) b.set(x + px, y + 1, P.black);
  b.rect(x + 2, y + 2, 7, 18, P.wine);
  b.vline(x + 2, y + 2, 18, P.plum);
  b.rect(x + 15, y + 1, 8, 4, P.umber);
  b.hline(x + 14, y + 5, 10, P.bark);
}

function tools(b: PixelBuffer, x: number, y: number) {
  b.hline(x, y, 30, P.bark);
  for (let i = 0; i < 4; i++) {
    const tx = x + 3 + i * 7;
    b.vline(tx, y + 1, 12, P.umber);
    if (i % 2) b.rect(tx - 2, y + 11, 5, 3, P.slate);
    else {
      b.vline(tx - 1, y + 10, 4, P.steel);
      b.vline(tx + 1, y + 10, 4, P.steel);
    }
  }
}

function ham(b: PixelBuffer, x: number, y: number) {
  b.vline(x + 2, y, 3, P.black);
  b.ellipse(x + 2, y + 7, 3, 5, P.brick);
  b.ellipse(x + 2, y + 6, 1, 2, P.coral);
}

function herbs(b: PixelBuffer, x: number, y: number) {
  b.vline(x + 2, y, 2, P.black);
  for (let k = 0; k < 7; k++) b.vline(x + (k % 3) + 1, y + 2 + k, 2, k % 2 ? P.leaf : P.forest);
}

/** Suelo de la sala (ancho × fondo, a media resolución): tablas hacia el fondo, losas o roca. */
export function floorTex(room: Room | null, theme: Theme, w: number, seed: string): PixelBuffer {
  const b = new PixelBuffer(w, DEEP);
  if (room?.type === 'cocina' || room?.type === 'forja')
    stoneWall(b, 0, 0, w, DEEP, seed, { ramp: TILE, bw: 8, bh: 4 });
  else if (theme === 'piedra') stoneWall(b, 0, 0, w, DEEP, seed, { ramp: STONE, bw: 10, bh: 5 });
  else if (theme === 'cueva') stoneWall(b, 0, 0, w, DEEP, seed, { ramp: ROCK, bw: 12, bh: 5 });
  else planksV(b, 0, 0, w, DEEP, seed, room && ruined(room) ? WOOD_DARK : WOOD, 8);
  if (room && !bare(room) && !ruined(room)) {
    const rug = (x: number, rw: number, ramp: [string, string, string]) => {
      b.rect(x, 6, rw, DEEP - 12, ramp[0]);
      b.rect(x + 2, 7, rw - 4, DEEP - 14, ramp[1]);
      for (let i = x + 4; i < x + rw - 4; i += 6) b.set(i, DEEP / 2, ramp[2]);
    };
    if (room.type === 'salon') rug(w - 100, 70, [P.wine, P.red, P.gold]);
    if (room.type === 'recibidor') rug(30, 50, [P.forest, P.leaf, P.lime]);
    if (room.type === 'capilla') rug(w / 2 - 12, 24, [P.wine, P.grape, P.gold]);
  }
  return b;
}

/** Techo (ancho × fondo, a media resolución): tablas oscuras con vigas, bóveda o roca. */
export function ceilingTex(theme: Theme, w: number, seed: string): PixelBuffer {
  const b = new PixelBuffer(w, DEEP);
  if (theme === 'madera' || theme === 'yeso') {
    planksV(b, 0, 0, w, DEEP, seed, WOOD_DARK, 6);
    for (let x = 8; x < w; x += 30) beam(b, x, 0, 6, DEEP, WOOD_DARK);
  } else
    stoneWall(b, 0, 0, w, DEEP, seed, {
      ramp:
        theme === 'piedra'
          ? [P.black, P.black, P.navy, P.slate]
          : [P.black, P.black, P.ebony, P.plum],
      bw: 12,
      bh: 6,
    });
  return b;
}

/**
 * Pared de un lado (fondo × alto, el fondo a media resolución; x = 0 junto al corte). Lleva
 * puerta en cada planta (contada desde abajo) que da a otra sala o a la escalera.
 */
export function sideTex(
  theme: Theme,
  h: number,
  doors: number[],
  seed: string,
  front: number[] = [],
): PixelBuffer {
  const b = new PixelBuffer(DEEP, h);
  if (theme === 'yeso') {
    plaster(b, 0, 0, DEEP, h, seed, PLASTER);
    for (let f = 0; f * PITCH < h; f++) {
      const y = h - f * PITCH;
      planksV(b, 0, y - 18, DEEP, 18, seed, WAINSCOT, 5);
    }
  } else if (theme === 'madera') planksV(b, 0, 0, DEEP, h, seed, WOOD_DARK, 7);
  else if (theme === 'piedra') stoneWall(b, 0, 0, DEEP, h, seed, { ramp: CELLAR, bw: 8, bh: 7 });
  else stoneWall(b, 0, 0, DEEP, h, seed, { ramp: ROCK, bw: 9, bh: 8 });
  for (const f of doors) {
    const y = h - f * PITCH;
    b.rect(8, y - 50, 13, 50, P.plum);
    b.rect(9, y - 48, 11, 48, P.bark);
    b.rect(10, y - 46, 9, 46, P.black);
  }
  // La puerta de la calle, cerrada: tablones con herrajes, aldaba y su umbral.
  for (const f of front) {
    const y = h - f * PITCH;
    b.rect(6, y - 54, 17, 54, P.plum);
    b.rect(7, y - 52, 15, 52, P.bark);
    planksV(b, 8, y - 51, 13, 51, `${seed}puerta`, [P.plum, P.rust, P.oak, P.clay], 4);
    for (const by of [y - 44, y - 16]) {
      b.hline(8, by, 13, P.slate);
      b.hline(8, by + 1, 13, P.navy);
    }
    b.ellipse(18, y - 28, 1.5, 1.5, P.gold);
    b.set(18, y - 26, P.amber);
    b.hline(5, y - 1, 19, P.steel);
  }
  ambientOcclusion(b, 0, 0, DEEP, h, 3, { top: true, bottom: true, left: false, right: true });
  return b;
}

/** Pared del fondo de un tramo de escalera, con los peldaños pintados en zigzag. */
export function stairBack(theme: Theme, w: number, h: number, floor: number): PixelBuffer {
  const bw = Math.round(w * BACK);
  const bh = Math.round(h * BACK);
  const b = new PixelBuffer(bw, bh);
  const seed = `escalera${floor}`;
  if (theme === 'madera' || theme === 'yeso') planksV(b, 0, 0, bw, bh, seed, WOOD_DARK, 6);
  else stoneWall(b, 0, 0, bw, bh, seed, { ramp: theme === 'cueva' ? ROCK : STONE, bw: 8, bh: 6 });
  const steps = 9;
  const up = floor % 2 === 0;
  const rise = (bh - 4) / steps;
  for (let i = 0; i < steps; i++) {
    const sx = Math.round(
      up ? 1 + (i * (bw - 7)) / (steps - 1) : bw - 7 - (i * (bw - 7)) / (steps - 1),
    );
    const sy = Math.round(bh - 4 - i * rise);
    b.rect(sx, sy, 6, 3, P.oak);
    b.hline(sx, sy, 6, P.clay);
    b.hline(sx, sy + 2, 6, P.plum);
  }
  b.line(up ? 1 : bw - 2, bh - 14, up ? bw - 2 : 1, 4, P.tan);
  ambientOcclusion(b, 0, 0, bw, bh, 4, { top: true, bottom: false, left: true, right: true });
  return b;
}

/** Pared del fondo de un hueco excavado sin sala: roca viva. */
export function caveBack(w: number, h: number, seed: string): PixelBuffer {
  const b = new PixelBuffer(Math.round(w * BACK), Math.round(h * BACK));
  stoneWall(b, 0, 0, b.w, b.h, seed, { ramp: ROCK, bw: 14, bh: 8 });
  ambientOcclusion(b, 0, 0, b.w, b.h, 6);
  return b;
}

/** El mismo búfer, de espejo (para las caras que se ven desde el otro lado). */
export function mirror(b: PixelBuffer): PixelBuffer {
  const m = new PixelBuffer(b.w, b.h);
  m.blit(b, 0, 0, true);
  return m;
}

/**
 * Pared de fuera de un lado del edificio (fondo × alto, con el forjado arriba; x = 0 junto al
 * corte). La del recibidor lleva la puerta.
 */
export function outerSide(theme: Theme, h: number, door: boolean, seed: string): PixelBuffer {
  const b = new PixelBuffer(DEEP, h);
  if (theme === 'yeso') {
    plaster(b, 0, 0, DEEP, h, seed, PLASTER);
    post(b, 0, 0, 3, h, WOOD_DARK);
    post(b, DEEP - 3, 0, 3, h, WOOD_DARK);
  } else planksV(b, 0, 0, DEEP, h, seed, WOOD_DARK, 6);
  for (let y = 0; y < h; y += PITCH) beam(b, 0, y, DEEP, SLAB, WOOD_DARK);
  if (door) {
    b.rect(8, h - 50, 16, 50, P.plum);
    b.blit(Prop.doorLeaf(), 10, h - 49);
  }
  return b;
}

/** Tejas de una vertiente (largo × fondo, a media resolución en el fondo). */
export function roofTiles(len: number, seed: string): PixelBuffer {
  const b = new PixelBuffer(DEEP + 4, len);
  const rng = new Rng(seed);
  for (let y = 0; y < len; y++) {
    const row = Math.floor(y / 4);
    for (let x = 0; x < b.w; x++) {
      const edge = (x + (row % 2 ? 2 : 0)) % 5 === 0;
      b.set(x, y, y % 4 === 3 ? P.plum : edge ? P.wine : row % 3 === 0 ? P.amber : P.brick);
    }
    if (rng.chance(0.08)) b.set(rng.int(0, b.w - 1), y, P.rust);
  }
  return b;
}

/** Tierra de arriba, a los lados del edificio: patio pisado a la izquierda, hierba a la derecha. */
export function groundTex(w: number, d: number, patio: boolean, seed: string): PixelBuffer {
  const b = new PixelBuffer(w, d);
  const rng = new Rng(seed);
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      const n = rng.next();
      b.set(
        x,
        y,
        patio
          ? n < 0.12
            ? P.umber
            : n > 0.94
              ? P.cocoa
              : P.bark
          : n < 0.1
            ? P.deep
            : n > 0.9
              ? P.leaf
              : P.forest,
      );
    }
  if (patio)
    for (let x = 0; x < Math.min(w, 26); x++) b.vline(x, 0, d, (x + 1) % 7 ? P.umber : P.mocha);
  return b;
}

// ---------- La fachada del corte ----------

export interface Facade {
  buf: PixelBuffer;
  /** Esquina del búfer en el mundo. */
  x: number;
  y: number;
  runs: RoofRun[];
}

/** Rectángulo de cada hueco de escalera, planta a planta. */
export const stairCells = (L: RoomsLayout): { rect: Rect; floor: number; s: number }[] =>
  L.b.stairs.flatMap((s) => {
    const out = [];
    for (let f = L.deepest; f <= L.top; f++)
      out.push({ rect: { x: stairX(L.b, s), y: floorTop(f), w: STAIR_W, h: ROOM_H }, floor: f, s });
    return out;
  });

/** Huecos excavados en los que todavía no hay sala. */
export const caveCells = (L: RoomsLayout): { rect: Rect; floor: number; col: number }[] =>
  L.b.dug.flatMap((k) => {
    const [c, f] = k.split(',').map(Number) as [number, number];
    const taken = L.rooms.some(
      ({ room: r }) => c >= r.col && c < r.col + r.w && f >= r.floor && f < r.floor + r.h,
    );
    return taken
      ? []
      : [{ rect: { x: colX(L.b, c), y: floorTop(f), w: CELL_W, h: ROOM_H }, floor: f, col: c }];
  });

/**
 * El plano de corte: tierra y roca con los huecos excavados, los muros y forjados entre salas
 * y los hastiales de los tejados. Lo que queda dentro de cada sala se deja transparente.
 */
export function facade(L: RoomsLayout): Facade {
  const runs = roofRuns(L);
  const top = Math.min(GROUND, ...runs.map((r) => r.base - r.h)) - 4;
  const ox = L.x0;
  const oy = top;
  const W = L.x1 - L.x0;
  const H = L.y1 - top;
  const buf = new PixelBuffer(W, H);
  const g = GROUND - oy;
  const left = L.left - ox;
  const right = L.right - ox;
  earth(buf, 0, g, W, H - g);
  // Roca bajo el edificio.
  stoneWall(buf, left, g + SLAB, right - left, H - g - SLAB, 'roca', {
    ramp: [P.black, P.navy, P.slate, P.steel],
    bw: 20,
    bh: 12,
  });
  for (let y = g + 4 * PITCH; y < H; y++)
    for (let x = left; x < right; x++) if ((x + y) % 3 === 0) buf.set(x, y, P.black);
  // Borde de hierba y del camino a ras de suelo.
  for (let x = 0; x < W; x++) {
    if (x >= left && x < right) continue;
    const wx = x + ox;
    const road = wx < L.patio.x + 26;
    const patio = wx < 0;
    buf.vline(x, g, 3, road ? P.umber : patio ? P.bark : P.forest);
    buf.set(x, g, road ? P.cocoa : patio ? P.rust : P.leaf);
  }

  // Muros y forjados: cada hueco ocupado, con su media pared y sus forjados, de madera arriba
  // y de piedra abajo; luego se vacía el interior.
  const wood = new PixelBuffer(W, H);
  planksV(wood, 0, 0, W, g + SLAB, 'muros', WOOD_DARK, 6);
  const stone = new PixelBuffer(W, H);
  stoneWall(stone, 0, g, W, H - g, 'sillares', { ramp: STONE, bw: 12, bh: 6 });
  const cells: { rect: Rect; floor: number }[] = [
    ...L.rooms
      .filter((x) => x.room.type !== 'torre')
      .map(({ room, rect }) => ({ rect, floor: room.floor })),
    ...stairCells(L),
    ...caveCells(L),
  ];
  for (const { rect, floor } of cells) {
    const x = rect.x - WALL - ox;
    const y = rect.y - SLAB - oy;
    const w = rect.w + 2 * WALL;
    const h = rect.h + 2 * SLAB;
    copyRect(buf, floor >= 0 ? wood : stone, x, y, w, h);
    if (floor >= 0) {
      beam(buf, x, y, w, SLAB, WOOD_DARK);
      beam(buf, x, y + h - SLAB, w, SLAB, WOOD_DARK);
    }
  }
  // Tabiques entre salas: textura a los lados y el alma oscura en medio.
  for (const a of cells)
    for (const c of cells) {
      if (a.rect.x + a.rect.w !== c.rect.x) continue;
      const y0 = Math.max(a.rect.y, c.rect.y);
      const y1 = Math.min(a.rect.y + a.rect.h, c.rect.y + c.rect.h);
      if (y1 <= y0) continue;
      const x = c.rect.x - CORE / 2 - ox;
      buf.rect(x, y0 - oy, CORE, y1 - y0, P.black);
      buf.vline(x, y0 - oy, y1 - y0, P.ebony);
      buf.vline(x + CORE - 1, y0 - oy, y1 - y0, P.ebony);
    }
  for (const { rect } of cells) {
    const r = interior(rect);
    for (let j = 0; j < r.h; j++)
      for (let i = 0; i < r.w; i++) buf.clear(r.x - ox + i, r.y - oy + j);
  }
  for (const run of runs) gable(buf, run.x0 - ox, run.x1 - ox, run.base - oy, run.h);
  return { buf, x: ox, y: oy, runs };
}

function copyRect(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, w: number, h: number) {
  for (let j = Math.max(0, y); j < Math.min(dst.h, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(dst.w, x + w); i++) {
      const c = src.data[j * src.w + i]!;
      if (c) dst.data[j * dst.w + i] = c;
    }
}

function earth(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  const rng = new Rng('tierra');
  for (let j = 0; j < h; j++) {
    const depth = j / Math.max(1, h);
    const band = Math.floor((j + Math.sin(j * 0.05) * 6) / 22) % 3;
    const base = depth > 0.6 ? P.black : band === 1 ? P.plum : P.ebony;
    b.hline(x, y + j, w, base);
  }
  for (let k = 0; k < (w * h) / 60; k++) {
    const px = x + rng.int(0, w - 3);
    const py = y + rng.int(4, h - 2);
    b.hline(px, py, rng.int(1, 3), rng.chance(0.5) ? P.umber : P.navy);
    if (rng.chance(0.2)) b.set(px, py - 1, P.bark);
  }
}

/** Hastial de un tejado: pared de tablas con alero de tejas y un ventanuco. */
function gable(b: PixelBuffer, x0: number, x1: number, base: number, h: number) {
  const mid = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const inside = (x: number, y: number, inset: number) =>
    y <= base + 2 && Math.abs(x - mid) <= half * (1 - (base + 2 - y) / (h + 2)) - inset;
  const tile = (x: number, y: number) => {
    const row = Math.floor((y - (base - h)) / 3);
    return (x + (row % 2 ? 2 : 0)) % 6 === 0 ? P.wine : row % 3 === 0 ? P.amber : P.brick;
  };
  const planks = new PixelBuffer(x1 - x0, h + 3);
  planksV(planks, 0, 0, planks.w, planks.h, `hastial${x0}`, WOOD_DARK, 6);
  for (let y = Math.floor(base - h); y <= base + 2; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (!inside(x, y, 0)) continue;
      const c = inside(x, y, 6) ? planks.get(x - x0, y - (base - h)) : tile(x, y);
      if (c) b.set(x, y, c);
    }
  b.line(x0, base + 2, Math.round(mid), base - h, P.black);
  b.line(Math.round(mid), base - h, x1, base + 2, P.black);
  // Ventanuco redondo del desván.
  if (h > 24) {
    const cy = base - Math.round(h * 0.38);
    b.ellipse(mid, cy, 5, 5, P.plum);
    b.ellipse(mid, cy, 3, 3, P.black);
  }
}

// ---------- Figuras de fuera ----------

/** La torre del vigía: sin levantar, un solar con estacas; luego de madera, más alta al subir. */
export function watchtower(level: number, crest: { field: string; dark: string }): PixelBuffer {
  if (level === 0)
    return Prop.piece(40, 12, (p) => {
      for (const dx of [2, 12, 25, 35]) post(p, dx, 2, 3, 10, WOOD_DARK);
      p.hline(2, 4, 36, P.tan);
    });
  const h = level > 1 ? 84 : 64;
  return Prop.piece(52, h + 24, (p) => {
    const top = 24;
    const cx = 26;
    post(p, cx - 18, top + 12, 4, h - 12, WOOD_DARK);
    post(p, cx + 14, top + 12, 4, h - 12, WOOD_DARK);
    for (let y = top + 20; y < top + h - 6; y += 14) {
      p.line(cx - 15, y, cx + 15, y + 10, P.bark);
      p.line(cx + 15, y, cx - 15, y + 10, P.bark);
    }
    p.rect(cx - 22, top + 8, 44, 6, P.oak);
    p.hline(cx - 22, top + 8, 44, P.clay);
    p.hline(cx - 22, top + 13, 44, P.bark);
    p.poly(
      [
        [cx - 24, top + 8],
        [cx, top - 10],
        [cx + 24, top + 8],
      ],
      P.wine,
    );
    p.line(cx - 24, top + 8, cx, top - 10, P.black);
    p.line(cx, top - 10, cx + 24, top + 8, P.black);
    if (level > 1) {
      p.vline(cx, 0, 14, P.black);
      p.rect(cx + 1, 0, 9, 6, crest.field);
      p.hline(cx + 1, 5, 9, crest.dark);
      p.ellipse(cx, top + 2, 3, 3, P.gold);
    }
  });
}

/** Andamio delante de una sala en obras, ya al tamaño con el que se ve. */
export function scaffold(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(Math.round(w), Math.round(h));
  for (let x = 4; x < b.w - 2; x += 22) {
    b.vline(x, 2, b.h - 2, P.tan);
    b.vline(x + 1, 2, b.h - 2, P.clay);
  }
  for (let y = 18; y < b.h; y += 24) {
    b.hline(2, y, b.w - 4, P.oak);
    b.hline(2, y + 1, b.w - 4, P.rust);
  }
  for (let x = 4; x + 22 < b.w; x += 44) b.line(x, b.h - 2, x + 22, 18, P.clay);
  return b;
}

/** Establo de tablas con tejadillo (patio). */
export function stable(level: number): PixelBuffer {
  return Prop.piece(76, 66, (p) => {
    planksV(p, 3, 20, 70, 46, 'establo', WOOD_DARK, 6);
    p.poly(
      [
        [0, 20],
        [38, 2],
        [76, 20],
      ],
      P.wine,
    );
    p.rect(25, 36, 26, 30, P.black);
    if (level > 1) p.rect(53, 50, 14, 10, P.oak);
  });
}

/** Tramo de empalizada. */
export function palisade(tall: number): PixelBuffer {
  return Prop.piece(40, tall + 2, (p) => {
    for (let x = 0; x < 36; x += 6) {
      post(p, x, 2, 5, tall, WOOD_DARK);
      p.set(x + 2, 1, P.oak);
    }
  });
}
