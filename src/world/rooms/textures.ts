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
  type Rect,
  type RoofRun,
  type RoomsLayout,
} from './layout';
import { ART } from './salas';
import { PLASTER_FINE, WOOD_FINE, floorFinish, sideFinish, wallFinish } from './salas/acabados';
import { BLIND, cellsOf, sconceOn, takeWallActs, windowX } from './salas/kit';
import { RISE, goesRight, stepAt } from './stairs';
import { streetDoor } from './salas/recibidor';
import { cloth } from './salas/tintes';
import { beamEnds, ivy, ladder, pickDetails, rainBarrel, shadeAt, woodpile } from './detalles';
import { ageWall } from './envejecer';
import { roofAt, roofRelief, wallFill } from './fachada';
import { wallSection } from './muros';
import type { FacadeLook, RoofId, WallId } from '../../data/custom';

/** Los colores y el símbolo del escudo (para pintarlo en la fachada). */
type Crest = { field: string; dark: string; symbol: string };
import { NO_LOOK, hearthSpan, salonWall, type SalonLook } from './salon';
import { BACK } from './view3d';
import { ruinFloor } from './ruina';

export type Theme = 'madera' | 'yeso' | 'piedra' | 'cueva';
export const themeOf = (f: number): Theme =>
  f >= 1 ? 'madera' : f === 0 ? 'yeso' : f === -1 ? 'piedra' : 'cueva';

/** Filas del suelo, del techo y de los lados (media resolución en profundidad). */
export const DEEP = DEPTH / 2;
/**
 * Ancho de las paredes de los lados (las que van hacia el fondo): a resolución completa, un
 * píxel por unidad de fondo. A media resolución (DEEP) cada píxel salía el doble de ancho que
 * de alto, y en ángulo se notaba estirado.
 */
export const SIDE_W = DEPTH;

/**
 * Pinta encima de `b` (a resolución completa) lo dibujado en `half` a media resolución en el
 * fondo, con cada píxel al doble de ancho: las piezas de tamaño fijo (puertas) siguen igual de
 * grandes que antes.
 */
function overHalf(b: PixelBuffer, half: PixelBuffer): void {
  for (let y = 0; y < half.h; y++)
    for (let x = 0; x < half.w; x++) {
      const c = half.data[y * half.w + x]!;
      if (!(c >>> 24)) continue;
      b.data[y * b.w + 2 * x] = c;
      if (2 * x + 1 < b.w) b.data[y * b.w + 2 * x + 1] = c;
    }
}

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

// ---------- Caras de una sala ----------

/** Pared del fondo de una sala de `w`×`h` (interior), ya a la escala del fondo. */
export function backWall(room: Room, w: number, h: number, look: SalonLook = NO_LOOK): PixelBuffer {
  takeWallActs();
  const bw = Math.round(w * BACK);
  const bh = Math.round(h * BACK);
  const b = new PixelBuffer(bw, bh);
  const theme = themeOf(room.floor);
  const seed = `${room.id}-${room.type}`;
  const ruin = ruined(room);
  const wain = 14;
  // Las salas con su arte ganan acabados desde el nivel 2 (el salón tiene los suyos).
  const fine = !bare(room) && !ruin && !!ART[room.type] && room.level >= 2;
  if (bare(room)) {
    plaster(b, 0, 0, bw, bh, seed, RAW);
    for (let x = 0; x < bw; x += 30) post(b, x, 0, 3, bh, WOOD_DARK);
  } else if (theme === 'yeso') {
    plaster(b, 0, 0, bw, bh - wain, seed, ruin ? RAW : fine ? PLASTER_FINE : PLASTER, ruin);
    planksV(b, 0, bh - wain, bw, wain, seed, WAINSCOT, 6);
    beam(b, 0, bh - wain - 3, bw, 3, WOOD_DARK);
    for (let x = 0; x < bw; x += 36) post(b, x, 0, 3, bh - wain - 3, WOOD_DARK);
  } else if (theme === 'madera') {
    planksV(b, 0, 0, bw, bh, seed, ruin ? WOOD_DARK : fine ? WOOD_FINE : WOOD, 7);
    beam(b, 0, bh - wain, bw, 3, WOOD_DARK);
  } else if (theme === 'piedra')
    stoneWall(b, 0, 0, bw, bh, seed, { ramp: CELLAR, bw: 12, bh: 7, moss: ruin ? 10 : 0 });
  else stoneWall(b, 0, 0, bw, bh, seed, { ramp: ROCK, bw: 14, bh: 8 });
  if (fine) wallFinish(b, room, theme, wain, seed);
  // Vigas a la altura de cada planta en las salas de más de una (en el salón, solo un listón:
  // es una sala alta, no dos plantas).
  for (let j = 1; j < room.h; j++)
    beam(b, 0, Math.round((j * PITCH - SLAB) * BACK), bw, room.type === 'salon' ? 2 : 4, WOOD_DARK);
  beam(b, 0, 0, bw, 3, WOOD_DARK);
  // Ventanas planta a planta (de arriba abajo), en las mismas columnas en todas. En el salón
  // se quita la columna que cae detrás de la chimenea (o de su tiro, que sube hasta el techo).
  const { hearthLeft } = hearthSpan(bw);
  const cols = Array.from({ length: room.w }, (_, i) => windowX(i)).filter(
    (x) => room.type !== 'salon' || x + 14 < hearthLeft,
  );
  const windows = Array.from({ length: room.h }, () => cols);
  if (room.floor >= 0 && !BLIND.has(room.type))
    windows.forEach((row, j) =>
      row.forEach((x) => windowAt(b, x, Math.round((j * PITCH + 18) * BACK), room, ruin)),
    );
  // Lo propio de cada sala (las que ya tienen su arte, también por reparar).
  const art = ART[room.type];
  if (!bare(room)) {
    if (art?.wall)
      art.wall(b, room, look, { cells: cellsOf(room, w), wain, top: bh - wain - 3, ruin });
    else if (!ruin && room.type === 'salon') salonWall(b, room, look, windows, CELL_BACK, wain);
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

/**
 * Las ventanas que se acaban de pintar en una pared del fondo (centro y alféizar, en píxeles del
 * búfer): la escena las recoge tras `backWall` para poner la luz que entra por ellas.
 */
const windowsDrawn: { x: number; y: number; top: number; w: number }[] = [];
export const takeWindows = () => windowsDrawn.splice(0);

/** Ventana de cuarterones centrada en `cx`: el cristal se deja transparente (se ve el cielo). */
function windowAt(b: PixelBuffer, cx: number, y: number, room: Room, ruin: boolean) {
  const w = 16;
  const h = 20;
  const x = cx - w / 2;
  b.rect(x - 3, y - 3, w + 6, h + 6, P.plum);
  b.rect(x - 2, y - 2, w + 4, h + 4, P.bark);
  const stained = room.type === 'capilla';
  const glass = [P.rose, P.gold, P.sky, P.grape];
  if (!ruin) windowsDrawn.push({ x: cx, y: y + h, top: y, w });
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

/** Suelo de la sala (ancho × fondo, a media resolución): tablas hacia el fondo, losas o roca. */
export function floorTex(room: Room | null, theme: Theme, w: number, seed: string): PixelBuffer {
  const b = new PixelBuffer(w, DEEP);
  if (room?.type === 'cocina' || room?.type === 'forja')
    stoneWall(b, 0, 0, w, DEEP, seed, { ramp: TILE, bw: 8, bh: 4 });
  else if (theme === 'piedra') stoneWall(b, 0, 0, w, DEEP, seed, { ramp: STONE, bw: 10, bh: 5 });
  else if (theme === 'cueva') stoneWall(b, 0, 0, w, DEEP, seed, { ramp: ROCK, bw: 12, bh: 5 });
  else planksV(b, 0, 0, w, DEEP, seed, room && ruined(room) ? WOOD_DARK : WOOD, 8);
  if (room && ruined(room) && room.type !== 'torre') ruinFloor(b, seed);
  if (room && !bare(room) && !ruined(room)) {
    if (ART[room.type])
      floorFinish(
        b,
        room,
        room.type === 'cocina' || room.type === 'forja'
          ? 'barro'
          : theme === 'piedra'
            ? 'piedra'
            : theme === 'cueva'
              ? 'roca'
              : 'tablas',
        seed,
      );
    const rug = (x: number, rw: number, ramp: [string, string, string]) => {
      b.rect(x, 6, rw, DEEP - 12, ramp[0]);
      b.rect(x + 2, 7, rw - 4, DEEP - 14, ramp[1]);
      for (let i = x + 4; i < x + rw - 4; i += 6) b.set(i, DEEP / 2, ramp[2]);
    };
    const art = ART[room.type];
    if (art?.floor) art.floor(b, room, cellsOf(room, w));
    else if (room.type === 'salon') {
      // La alfombra roja (o del tema de la sala).
      const c = cloth(room, [P.plum, P.wine, P.red, P.coral]);
      rug(w - 100, 70, [c[1], c[2], P.gold]);
    } else if (room.type === 'capilla') rug(w / 2 - 12, 24, [P.wine, P.grape, P.gold]);
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

/** El hueco de las puertas entre salas: de `DOOR_U0` a `DOOR_U1` a lo hondo (a media
 * resolución: en el mundo, el doble) y `DOOR_H` de alto. */
export const DOOR_U0 = 10;
export const DOOR_U1 = 19;
export const DOOR_H = 46;

/**
 * Pared de un lado (fondo × alto, el fondo a media resolución; x = 0 junto al corte). Lleva
 * puerta en cada planta (contada desde abajo) que da a otra sala o a la escalera: un hueco de
 * verdad (transparente) con su marco.
 */
export function sideTex(
  theme: Theme,
  h: number,
  doors: number[],
  seed: string,
  front: number[] = [],
  strength = 1,
  room?: Room,
  windows: number[] = [],
): PixelBuffer {
  const W = SIDE_W;
  const b = new PixelBuffer(W, h);
  if (theme === 'yeso') {
    plaster(b, 0, 0, W, h, seed, PLASTER);
    for (let f = 0; f * PITCH < h; f++) {
      const y = h - f * PITCH;
      planksV(b, 0, y - 18, W, 18, seed, WAINSCOT, 5);
    }
  } else if (theme === 'madera') planksV(b, 0, 0, W, h, seed, WOOD_DARK, 7);
  else if (theme === 'piedra') stoneWall(b, 0, 0, W, h, seed, { ramp: CELLAR, bw: 12, bh: 7 });
  else stoneWall(b, 0, 0, W, h, seed, { ramp: ROCK, bw: 14, bh: 8 });
  // Los acabados de la sala, como en su pared del fondo.
  if (room && !bare(room) && !ruined(room) && ART[room.type]) sideFinish(b, room, theme, seed);
  // El marco de cada puerta a la sala de al lado (DOOR_U0…DOOR_U1 van a media resolución); el
  // hueco se abre después de la sombra.
  const u0 = 2 * DOOR_U0;
  const u1 = 2 * DOOR_U1;
  for (const f of doors) {
    const y = h - f * PITCH;
    b.rect(u0 - 3, y - DOOR_H - 4, u1 - u0 + 6, DOOR_H + 4, P.plum);
    b.rect(u0 - 2, y - DOOR_H - 2, u1 - u0 + 4, DOOR_H + 2, P.bark);
  }
  // La puerta de la calle: aquí, el marco y el hueco oscuro; la hoja va aparte (`streetLeaf`) y
  // se abre cuando pasa alguien (ver `swingDoors` en RoomScene.ts). A media resolución y
  // ensanchada (así mide lo mismo que antes).
  if (front.length) {
    const half = new PixelBuffer(DEEP, h);
    for (const f of front) {
      const y = h - f * PITCH - 54;
      half.rect(6, y, 17, 54, strength > 0 ? P.plum : P.black);
      half.rect(7, y + 2, 15, 52, '#1c140f');
    }
    overHalf(b, half);
  }
  ambientOcclusion(b, 0, 0, W, h, 3, { top: true, bottom: true, left: false, right: true });
  ambientOcclusion(b, 0, 0, W, h, 6, { top: false, bottom: false, left: false, right: true });
  // Las ventanas a la calle, planta a planta (tras la sombra: el cristal queda hueco).
  const boarded = !!room && ruined(room);
  for (const f of windows) sideWindow(b, h - f * PITCH - ROOM_H, boarded, true);
  // El hueco: se ve el paso, con su hoja (ver `doorway` en RoomScene.ts).
  for (const f of doors) {
    const y = h - f * PITCH;
    for (let j = y - DOOR_H; j < y; j++) for (let i = u0; i < u1; i++) b.clear(i, j);
  }
  return b;
}

/** Pared del fondo de un tramo de escalera, con los peldaños pintados en zigzag. */
export function stairBack(
  theme: Theme,
  w: number,
  h: number,
  floor: number,
  steps = true,
  flight = steps,
): PixelBuffer {
  const bw = Math.round(w * BACK);
  const bh = Math.round(h * BACK);
  const b = new PixelBuffer(bw, bh);
  const seed = `escalera${floor}`;
  if (theme === 'madera' || theme === 'yeso') planksV(b, 0, 0, bw, bh, seed, WOOD_DARK, 6);
  else stoneWall(b, 0, 0, bw, bh, seed, { ramp: theme === 'cueva' ? ROCK : STONE, bw: 8, bh: 6 });
  // Un pasillo (sin tramo) es solo la pared del fondo.
  if (!steps) {
    ambientOcclusion(b, 0, 0, bw, bh, 4, { top: true, bottom: false, left: true, right: true });
    return b;
  }
  // Con tramo (los peldaños son una pieza aparte, ver `stairs.ts`): su sombra en la pared y el
  // pasamanos sujeto con sus palomillas. En el rellano, el aplique que lo alumbra (arriba, en
  // el lado sin peldaños).
  if (flight) {
    const at = (i: number) => {
      const p = stepAt(0, floor, i);
      return { x: Math.round((p.x - PARTITION / 2) * BACK), y: Math.round(bh - i * RISE * BACK) };
    };
    const last = Math.floor(ROOM_H / RISE);
    for (let i = 1; i <= last; i++) {
      const p = at(i);
      b.hline(p.x - 2, p.y + 3, 5, P.ebony);
    }
    const a = at(1);
    const z = at(last + 1);
    const rail = 12;
    b.line(a.x, a.y - rail, z.x, z.y - rail, P.tan);
    b.line(a.x, a.y - rail + 1, z.x, z.y - rail + 1, P.rust);
    for (const i of [2, Math.round(last / 2) + 1, last]) {
      const p = at(i);
      b.rect(p.x - 1, p.y - rail + 2, 1, 2, P.slate);
    }
  }
  sconceOn(b, goesRight(floor) ? 4 : bw - 5, 22);
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
export function outerSide(
  theme: Theme,
  h: number,
  door: boolean,
  seed: string,
  strength = 1,
  walls?: WallId,
  window?: 'cristal' | 'tablas',
): PixelBuffer {
  const W = SIDE_W;
  const b = new PixelBuffer(W, h);
  // Con paredes elegidas, todas las plantas iguales; si no, yeso abajo y tablas arriba.
  if (walls) {
    wallFill(b, 0, 0, W, h, seed, walls);
    // Envejecido: paños y la humedad del pie (ver `envejecer.ts`).
    ageWall(b, 0, 0, W, h, seed, { ground: h, top: -h, walls });
  } else if (theme === 'yeso') {
    plaster(b, 0, 0, W, h, seed, PLASTER);
    post(b, 0, 0, 3, h, WOOD_DARK);
    post(b, W - 3, 0, 3, h, WOOD_DARK);
  } else planksV(b, 0, 0, W, h, seed, WOOD_DARK, 6);
  for (let y = 0; y < h; y += PITCH) beam(b, 0, y, W, SLAB, WOOD_DARK);
  // La puerta, a media resolución y ensanchada (mide lo mismo que antes).
  if (door) {
    const half = new PixelBuffer(DEEP, h);
    half.rect(8, h - 50, 16, 50, P.plum);
    half.blit(Prop.doorLeaf(strength), 10, h - 49);
    overHalf(b, half);
  }
  // La ventana de la planta (por fuera, el mismo hueco que por dentro; arriba, el forjado).
  if (window) sideWindow(b, SLAB, window === 'tablas', false);
  return b;
}

/**
 * Ventana de un muro de los lados (en `sideTex` y `outerSide`): el mismo hueco por dentro y
 * por fuera, en medio del fondo (`SIDE_WIN`), desde lo alto de la planta (`top`). El cristal se
 * deja transparente: se ve lo de fuera (o, desde fuera, la sala); tapiada, con tablas.
 */
export const SIDE_WIN = { u0: 23, u1: 37, top: 22, h: 25 };
function sideWindow(b: PixelBuffer, top: number, boarded: boolean, inside: boolean) {
  const { u0, u1 } = SIDE_WIN;
  const w = u1 - u0;
  const y = top + SIDE_WIN.top;
  const h = SIDE_WIN.h;
  b.rect(u0 - 3, y - 3, w + 6, h + 6, P.plum);
  b.rect(u0 - 2, y - 2, w + 4, h + 4, P.bark);
  if (boarded) {
    planksV(b, u0, y, w, h, `tablas${top}`, WOOD_DARK, 4);
    b.line(u0, y + 3, u1 - 1, y + h - 6, P.oak);
    b.line(u0, y + h - 4, u1 - 1, y + 5, P.oak);
    return;
  }
  for (let j = 0; j < h; j++) for (let i = u0; i < u1; i++) b.clear(i, y + j);
  // Los cuarterones (finos, para que se vea a través) y el alféizar.
  b.vline(u0 + Math.floor(w / 2), y, h, P.bark);
  b.hline(u0, y + Math.floor(h / 2), w, P.bark);
  b.hline(u0 - 4, y + h + 3, w + 8, P.oak);
  b.hline(u0 - 4, y + h + 4, w + 8, P.plum);
  // Por fuera, una jardinera; por dentro, el alféizar solo.
  if (!inside) {
    b.rect(u0 + 1, y + h + 5, w - 2, 4, P.brick);
    for (let i = u0 + 2; i < u1 - 2; i += 3) b.set(i, y + h + 4, i % 2 ? P.leaf : P.lime);
  }
}

/** El grosor del muro en el hueco de una ventana de los lados (jambas, dintel y alféizar). */
export function sideReveal(theme: Theme, seed: string): PixelBuffer {
  const b = new PixelBuffer(16, 32);
  if (theme === 'yeso') plaster(b, 0, 0, 16, 32, seed, PLASTER);
  else planksV(b, 0, 0, 16, 32, seed, WOOD_DARK, 5);
  ambientOcclusion(b, 0, 0, 16, 32, 3, { top: false, bottom: false, left: true, right: true });
  return b;
}

/** Tejas de una vertiente (largo × fondo, a media resolución en el fondo). */
export function roofTiles(len: number, seed: string, roof?: RoofId): PixelBuffer {
  const b = new PixelBuffer(DEEP + 4, len);
  const rng = new Rng(seed);
  for (let y = 0; y < len; y++) {
    for (let x = 0; x < b.w; x++) {
      b.level = roofRelief(roof, x, y, 4);
      b.set(x, y, roofAt(roof, x, y, 4));
    }
    // Alguna teja desportillada (en la de siempre).
    if ((roof ?? 'teja') === 'teja' && rng.chance(0.08)) b.set(rng.int(0, b.w - 1), y, P.rust);
  }
  b.level = 0;
  return b;
}

/** Tierra de arriba, a los lados del edificio (ver `art/grass.ts`). */
export { groundTex } from '../../art/grass';

// ---------- La fachada del corte ----------

export interface Facade {
  buf: PixelBuffer;
  /** Esquina del búfer en el mundo. */
  x: number;
  y: number;
  runs: RoofRun[];
}

/**
 * Cada hueco de las columnas de escalera (`s`: el hueco a cuya izquierda va): los rellanos
 * (`steps`; con `flight`, de ahí sube un tramo) y los pasillos entre dos salas donde no llega
 * ningún tramo.
 */
export const stairCells = (
  L: RoomsLayout,
): { rect: Rect; floor: number; s: number; steps: boolean; flight: boolean }[] =>
  L.stairs.flatMap((s) =>
    [...s.floors, ...s.halls].map((f) => ({
      rect: { x: s.x, y: floorTop(f), w: STAIR_W, h: ROOM_H },
      floor: f,
      s: s.at,
      steps: s.floors.includes(f),
      flight: s.flights.includes(f),
    })),
  );

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
export function facade(L: RoomsLayout, look: FacadeLook = {}, crest?: Crest): Facade {
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
  // Con patio trasero, el edificio acaba donde empieza el jardín: bajo el jardín, tierra como
  // la de fuera, y bajo el anexo, sus cimientos (no se excava).
  const garden = L.garden;
  const main = garden ? garden.x - ox : right;
  // Roca bajo el edificio: asoma por los lados en escalones, cada hilada algo más ancha que la
  // de encima, como una zarpa que lo asienta.
  const inRock = rockBase(buf, left, main, g + SLAB);
  for (let y = g + 4 * PITCH; y < H; y++)
    for (let x = 0; x < W; x++) if ((x + y) % 3 === 0 && inRock(x, y)) buf.set(x, y, P.black);
  // Los cimientos, solo bajo lo que está construido en la planta baja del anexo (sus solares
  // vacíos son tierra, como el jardín).
  const built = garden ? groundSpans(L, garden.x + garden.w) : [];
  for (const [a, c] of built) footing(buf, a - ox, c - ox, g + SLAB);
  // Borde de hierba y del camino a ras de suelo (también en el jardín y los solares del anexo).
  for (let x = 0; x < W; x++) {
    const wx = x + ox;
    const yard = x >= main && !built.some(([a, c]) => wx >= a && wx < c);
    if (x >= left && x < right && !yard) continue;
    const road = wx < L.patio.x + 26;
    const patio = wx < 0;
    buf.vline(x, g, 3, road ? P.umber : patio ? P.bark : P.forest);
    buf.set(x, g, road ? P.cocoa : patio ? P.rust : P.leaf);
  }

  // Muros y forjados: cada hueco ocupado, con su media pared y sus forjados, de madera arriba
  // y de piedra abajo; luego se vacía el interior.
  const wood = new PixelBuffer(W, H);
  wallFill(wood, 0, 0, W, g + SLAB, 'muros', look.walls);
  const stone = new PixelBuffer(W, H);
  stoneWall(stone, 0, g, W, H - g, 'sillares', { ramp: STONE, bw: 12, bh: 6 });
  const stairs = stairCells(L);
  const cells: { rect: Rect; floor: number }[] = [
    ...L.rooms
      .filter((x) => x.room.type !== 'torre')
      .map(({ room, rect }) => ({ rect, floor: room.floor })),
    ...stairs,
    ...caveCells(L),
  ];
  for (const { rect, floor } of cells) {
    const x = rect.x - WALL - ox;
    const y = rect.y - SLAB - oy;
    const w = rect.w + 2 * WALL;
    const h = rect.h + 2 * SLAB;
    copyRect(buf, floor >= 0 ? wood : stone, x, y, w, h);
    // El grueso del muro a los dos lados, en corte (lo de dentro del muro, no su cara): de fuera
    // de la sala hasta donde empieza su hueco (`interior`), WALL + PARTITION / 2.
    const kind = floor >= 0 ? (look.walls ?? 'tablas') : 'sotano';
    const thick = WALL + PARTITION / 2;
    wallSection(buf, x, y + SLAB, thick, h - 2 * SLAB, true, kind);
    wallSection(buf, x + w - thick, y + SLAB, thick, h - 2 * SLAB, false, kind);
    if (floor >= 0) {
      beam(buf, x, y, w, SLAB, WOOD_DARK);
      beam(buf, x, y + h - SLAB, w, SLAB, WOOD_DARK);
    }
  }
  // Forjados entre una sala y la de encima: igual, el alma oscura en medio del grueso.
  const solid = cells.filter((c) => !stairs.includes(c as (typeof stairs)[number]));
  for (const a of solid)
    for (const c of solid) {
      if (c.rect.y + c.rect.h + SLAB !== a.rect.y) continue;
      const x0 = Math.max(a.rect.x, c.rect.x) - WALL;
      const x1 = Math.min(a.rect.x + a.rect.w, c.rect.x + c.rect.w) + WALL;
      if (x1 <= x0) continue;
      const y = a.rect.y - SLAB / 2 - CORE / 2 - oy;
      buf.rect(x0 - ox, y, x1 - x0, CORE, P.black);
      buf.hline(x0 - ox, y, x1 - x0, P.ebony);
      buf.hline(x0 - ox, y + CORE - 1, x1 - x0, P.ebony);
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
  // El escudo pintado, en el hastial más ancho.
  const big =
    look.sign === 'pintado' && crest
      ? runs.reduce((a, r) => (r.x1 - r.x0 > a.x1 - a.x0 ? r : a))
      : null;
  for (const run of runs)
    gable(
      buf,
      run.x0 - ox,
      run.x1 - ox,
      run.base - oy,
      run.h,
      look,
      run === big ? crest : undefined,
    );
  return { buf, x: ox, y: oy, runs };
}

/**
 * La roca de debajo del edificio, de `x0` a `x1` y desde `y` hacia abajo, que asoma por los lados
 * en escalones (uno por hilada, hasta `REACH`). Devuelve si un punto cae en ella.
 */
function rockBase(b: PixelBuffer, x0: number, x1: number, y: number) {
  const BH = 12;
  const REACH = 22;
  const rng = new Rng('zarpa-roca');
  const rows = Math.ceil((b.h - y) / BH);
  // Lo que sale cada hilada por la izquierda y por la derecha.
  const out = Array.from({ length: rows }, (_, i) =>
    [0, 1].map(() => Math.min(REACH, 4 + i * 6 + rng.int(-1, 2))),
  ) as [number, number][];
  const row = (yy: number) => out[Math.min(rows - 1, Math.floor((yy - y) / BH))]!;
  const inside = (x: number, yy: number) => {
    if (yy < y || yy >= b.h) return false;
    const [l, r] = row(yy);
    return x >= x0 - l && x < x1 + r;
  };
  const rock = new PixelBuffer(b.w, b.h);
  stoneWall(rock, x0 - REACH - 4, y, x1 - x0 + 2 * REACH + 8, b.h - y, 'roca', {
    ramp: [P.black, P.navy, P.slate, P.steel],
    bw: 20,
    bh: BH,
  });
  for (let yy = y; yy < b.h; yy++)
    for (let x = Math.max(0, x0 - REACH); x < Math.min(b.w, x1 + REACH); x++)
      if (inside(x, yy)) b.set(x, yy, rock.get(x, yy));
  // Cada escalón: el canto de arriba, a la luz, y el lado de fuera, en sombra.
  for (let i = 0; i < rows; i++) {
    const top = y + i * BH;
    const [l, r] = out[i]!;
    const [pl, pr] = i ? out[i - 1]! : [0, 0];
    if (l > pl) b.hline(x0 - l, top, l - pl, P.steel);
    if (r > pr) b.hline(x1 + pr, top, r - pr, P.steel);
    const h = Math.min(BH, b.h - top);
    b.vline(x0 - l, top + 1, h - 1, P.black);
    b.vline(x1 + r - 1, top + 1, h - 1, P.black);
  }
  return inside;
}

/**
 * Tramos de la planta baja con sala o escalera desde `x0` hacia la derecha, de la cara de fuera
 * de un muro a la del otro y juntando los que se tocan.
 */
function groundSpans(L: RoomsLayout, x0: number): [number, number][] {
  const spans: [number, number][] = [
    ...L.rooms
      .filter(({ room: r }) => r.type !== 'torre' && r.floor <= 0 && r.floor + r.h > 0)
      .map(({ rect }) => rect),
    ...stairCells(L)
      .filter((s) => s.floor === 0)
      .map((s) => s.rect),
  ]
    .filter((r) => r.x >= x0)
    .map((r): [number, number] => [r.x - WALL, r.x + r.w + WALL])
    .sort((a, c) => a[0] - c[0]);
  const out: [number, number][] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]);
    else out.push(s);
  }
  return out;
}

/**
 * Los cimientos del anexo, de `x0` a `x1` y desde `y` hacia abajo: tres hiladas de sillares
 * y la zarpa (una más, algo más ancha que el muro), con la sombra que dejan en la tierra.
 */
function footing(b: PixelBuffer, x0: number, x1: number, y: number) {
  const ramp: Ramp = [P.black, P.navy, P.slate, P.steel, P.fog];
  const BH = 8;
  const ROWS = 3;
  const ZARPA = 4;
  const zy = y + ROWS * BH;
  stoneWall(b, x0, y, x1 - x0, ROWS * BH, 'cimientos', { ramp, bw: 18, bh: BH });
  stoneWall(b, x0 - ZARPA, zy, x1 - x0 + 2 * ZARPA, BH, 'zarpa', { ramp, bw: 22, bh: BH });
  // El canto de la zarpa, al aire, y la sombra de debajo.
  b.hline(x0 - ZARPA, zy, ZARPA, P.steel);
  b.hline(x1, zy, ZARPA, P.steel);
  b.hline(x0 - ZARPA, zy + BH, x1 - x0 + 2 * ZARPA, P.black);
  for (let x = x0 - ZARPA + 1; x < x1 + ZARPA; x += 2) b.set(x, zy + BH + 1, P.black);
}

function copyRect(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, w: number, h: number) {
  for (let j = Math.max(0, y); j < Math.min(dst.h, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(dst.w, x + w); i++) {
      const c = src.data[j * src.w + i]!;
      if (!c) continue;
      dst.data[j * dst.w + i] = c;
      const r = src.reliefAt(i, j);
      if (r || dst.relief) dst.lift(j * dst.w + i, r);
    }
}

/**
 * Tierra suelta de `w` × `h` (la de los lados del corte, más allá del mundo), con el mismo borde
 * de arriba que el corte: tierra del patio a la izquierda y hierba a la derecha.
 */
export function earthBuf(w: number, h: number, patio: boolean): PixelBuffer {
  const b = new PixelBuffer(w, h);
  earth(b, 0, 0, w, h);
  for (let x = 0; x < w; x++) {
    b.vline(x, 0, 3, patio ? P.bark : P.forest);
    b.set(x, 0, patio ? P.rust : P.leaf);
  }
  return b;
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

/**
 * Hastial de un tejado: pared (tablas, entramado o piedra) con el alero del tejado elegido y un
 * ventanuco (con jardinera, si se ha elegido); o, si se le da `crest`, el escudo pintado.
 */
function gable(
  b: PixelBuffer,
  x0: number,
  x1: number,
  base: number,
  h: number,
  look: FacadeLook = {},
  crest?: Crest,
) {
  const mid = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const inside = (x: number, y: number, inset: number) =>
    y <= base + 2 && Math.abs(x - mid) <= half * (1 - (base + 2 - y) / (h + 2)) - inset;
  // El alero: el de siempre, fino; los demás, algo más gruesos para que se note el material
  // (desde delante no se ven las vertientes), y la paja más aún.
  // (El de siempre se mide en horizontal; los demás, en alto: 5 píxeles, y la paja 8.)
  const thatch = look.roof === 'paja';
  const eave =
    (look.roof ?? 'teja') === 'teja' ? 6 : ((thatch ? 8 : 5) * half) / Math.max(1, h + 2);
  const tile = (x: number, y: number) => roofAt(look.roof, x, y - Math.floor(base - h), 3);
  const planks = new PixelBuffer(Math.ceil(x1 - x0) + 1, h + 3);
  wallFill(planks, 0, 0, planks.w, planks.h, `hastial${x0}`, look.walls);
  // Envejecido: paños y lo alto, pálido por el sol (ver `envejecer.ts`).
  ageWall(planks, 0, 0, planks.w, planks.h, `hastial${x0}`, { top: 0, walls: look.walls });
  for (let y = Math.floor(base - h); y <= base + 2; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (!inside(x, y, 0)) continue;
      const wall = inside(x, y, eave);
      const px = x - Math.floor(x0);
      const py = y - Math.floor(base - h);
      const c = wall ? planks.get(px, py) : tile(x, y);
      // Relieve: la pared, el suyo; el alero vuela por delante (más cuanto más fuera).
      b.level = wall
        ? planks.reliefAt(px, py)
        : 5 + roofRelief(look.roof, x, y - Math.floor(base - h), 3);
      if (c) b.set(x, y, c);
    }
  b.level = 8;
  b.line(x0, base + 2, Math.round(mid), base - h, P.black);
  b.line(Math.round(mid), base - h, x1, base + 2, P.black);
  b.level = 0;
  if (thatch) {
    // La paja asoma por debajo del alero en flecos, con su sombra en la pared.
    for (let x = Math.floor(x0); x <= x1; x++) {
      const t = Math.abs(x - mid) / half;
      const y = Math.round(base + 2 - (1 - t) * (h + 2)) + eave;
      if (y > base + 2 || !inside(x, y, eave + 1)) continue;
      b.set(x, y, (x * 7) % 3 ? P.amber : P.rust);
      if (inside(x, y + 1, eave + 2)) b.set(x, y + 1, P.plum);
    }
  }
  if (crest && h > 30) {
    // El escudo pintado, al doble (o a su tamaño, si no cabe).
    const s = Prop.shield(crest.field, crest.dark, crest.symbol);
    const big = h > 36 ? 2 : 1;
    const cy = base - Math.round(h * 0.42);
    for (let j = 0; j < s.h; j++)
      for (let i = 0; i < s.w; i++) {
        const c = s.get(i, j);
        if (!c) continue;
        b.rect(
          Math.round(mid - (s.w * big) / 2) + i * big,
          Math.round(cy - (s.h * big) / 2) + j * big,
          big,
          big,
          c,
        );
      }
    return;
  }
  // Ventanuco redondo del desván.
  if (h > 24) {
    const cy = base - Math.round(h * 0.38);
    b.level = 4;
    b.ellipse(mid, cy, 5, 5, P.plum);
    b.level = 0;
    b.ellipse(mid, cy, 3, 3, P.black);
    b.level = 5;
    if (look.boxes) {
      // La jardinera: una caja de tablas con geranios.
      const y = cy + 6;
      const m = Math.round(mid);
      b.rect(m - 7, y, 15, 3, P.oak);
      b.hline(m - 7, y, 15, P.tan);
      b.hline(m - 7, y + 2, 15, P.rust);
      for (let k = -6; k <= 6; k += 2) {
        b.set(m + k, y - 1, P.leaf);
        b.set(m + k + 1, y - 2, k % 4 ? P.red : P.coral);
      }
    }
    b.level = 0;
  }
}

// ---------- Figuras de fuera ----------

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

// ---------- El paso de las puertas entre salas ----------

/** La jamba del fondo del paso (`w` × `DOOR_H`): con el acabado de la pared y su canto. */
export function doorJamb(theme: Theme, w: number, seed: string): PixelBuffer {
  const b = new PixelBuffer(w, DOOR_H);
  if (theme === 'yeso') plaster(b, 0, 0, w, DOOR_H, seed, PLASTER);
  else if (theme === 'madera') planksV(b, 0, 0, w, DOOR_H, seed, WOOD_DARK, 4);
  else
    stoneWall(b, 0, 0, w, DOOR_H, seed, { ramp: theme === 'piedra' ? CELLAR : ROCK, bw: 6, bh: 5 });
  b.vline(0, 0, DOOR_H, P.bark);
  b.vline(w - 1, 0, DOOR_H, P.bark);
  ambientOcclusion(b, 0, 0, w, DOOR_H, 3, { top: true, bottom: false, left: true, right: true });
  return b;
}

/** La hoja de la puerta entre salas: tablas de roble con dos herrajes y el tirador. */
export function doorPanel(): PixelBuffer {
  const w = (DOOR_U1 - DOOR_U0) * 2;
  const b = new PixelBuffer(w, DOOR_H);
  planksV(b, 0, 0, w, DOOR_H, 'hoja', [P.plum, P.rust, P.oak, P.clay], 4);
  b.vline(0, 0, DOOR_H, P.rust);
  b.vline(w - 1, 0, DOOR_H, P.plum);
  for (const y of [7, DOOR_H - 9]) {
    b.rect(1, y, w - 2, 2, P.slate);
    b.hline(1, y, w - 2, P.steel);
  }
  b.rect(3, 24, 2, 3, P.gold);
  return b;
}

/**
 * La «tapa» de la vista desde fuera (luz con ambiente, al alejar del todo): el plano de corte
 * (`facade`) con los huecos de las salas cerrados, como se ve la taberna desde el camino. Por
 * encima del suelo, la pared de fuera con una ventana por columna y planta (la escalera, una
 * estrecha; el recibidor, la puerta de la calle); por debajo, la tierra. El cristal se deja
 * transparente: a través se ve la sala de verdad (y de noche, su luz).
 */
export function outsideFace(
  L: RoomsLayout,
  look: FacadeLook,
  F: Facade,
  seed = 'fuera',
): { buf: PixelBuffer; glass: PixelBuffer } {
  const b = F.buf.clone();
  /** Centros de las ventanas y la puerta (en el búfer), para no tapar ninguna. */
  const openings: { x: number; y: number }[] = [];
  // El cristal de cada ventana encendido (de noche): cálido, más claro abajo (la luz de la sala
  // sube del suelo y de las mesas), cada sala con su tono.
  const glass = new PixelBuffer(b.w, b.h);
  const rng = new Rng('ventanas-fuera');
  const ox = F.x;
  const oy = F.y;
  const g = GROUND - oy;
  const wall = new PixelBuffer(b.w, b.h);
  wallFill(wall, 0, 0, b.w, g + SLAB, 'fuera', look.walls);
  const dirt = new PixelBuffer(b.w, b.h);
  earth(dirt, 0, g, b.w, b.h - g);
  // El zócalo de piedra de la planta baja: tres hiladas con musgo abajo y una albardilla encima
  // que sale un poco (la madera no toca la tierra).
  const plinth = new PixelBuffer(b.w, b.h);
  stoneWall(plinth, 0, g - PLINTH + 2, b.w, PLINTH - 2, 'zocalo', {
    ramp: [P.black, P.navy, P.slate, P.steel, P.fog],
    bw: 13,
    bh: 6,
    moss: 7,
  });
  plinth.level = 4;
  plinth.hline(0, g - PLINTH, b.w, P.fog);
  plinth.hline(0, g - PLINTH + 1, b.w, P.slate);
  for (let x = 0; x < b.w; x += 9 + (x % 5)) plinth.set(x, g - PLINTH + 1, P.navy);
  plinth.level = 0;
  // Bajo la albardilla, su sombra en la pared.
  const fill = (r: Rect) => {
    const x0 = Math.round(r.x - ox);
    const y0 = Math.round(r.y - oy);
    for (let y = y0; y < y0 + r.h; y++)
      for (let x = x0; x < x0 + r.w; x++) {
        if (!b.inside(x, y) || b.get(x, y)) continue;
        const src = y >= g ? dirt : y >= g - PLINTH ? plinth : wall;
        b.level = src.reliefAt(x, y);
        b.set(x, y, src.get(x, y));
      }
    b.level = 0;
  };
  const sills: { x: number; y: number; w: number }[] = [];
  /**
   * Una ventana de `w` × `h` (el cristal), de uno de tres modelos: de cuarterones, de arco o con
   * contraventanas abiertas (alguna, cerrada). Con su marco, el dintel, el alféizar y, a veces,
   * una jardinera. El cristal se deja transparente (se ve la sala) y en `glass`, encendido.
   */
  const window = (
    cx: number,
    top: number,
    w: number,
    h: number,
    kind: WindowKind,
    box = false,
    shut = false,
    paint: readonly [string, string, string] = SHUTTERS[0]!,
  ) => {
    const x = Math.round(cx - ox - w / 2);
    const y = Math.round(top - oy);
    openings.push({ x: cx - ox, y: y + h / 2 });
    const r = w / 2;
    // El hueco: un rectángulo o, el de arco, con medio círculo arriba.
    const inside = (i: number, j: number) => {
      if (i < 0 || j < 0 || i >= w || j >= h) return false;
      if (kind !== 'arco' || j >= r) return true;
      const dx = i + 0.5 - r;
      const dy = j + 0.5 - r;
      return dx * dx + dy * dy <= r * r;
    };
    const near = (i: number, j: number, d: number) => {
      for (let v = -d; v <= d; v++)
        for (let u = -d; u <= d; u++) if (inside(i + u, j + v)) return true;
      return false;
    };
    const warm = rng.chance(0.15) ? ['#7a4a2a', '#9a5e30'] : ['#e0974a', '#ffd27a'];
    const flower = rng.pick([
      [P.red, P.gold],
      [P.coral, P.white],
      [P.rose, P.lemon],
    ] as const);
    // El marco (dos de grueso, más claro arriba) siguiendo el hueco.
    b.level = 3;
    for (let j = -3; j < h + 2; j++)
      for (let i = -3; i < w + 3; i++)
        if (!inside(i, j) && near(i, j, 2))
          b.set(x + i, y + j, near(i, j + 1, 2) && !near(i, j - 1, 2) ? P.umber : P.bark);
    // El dintel: una viga encima que sobresale; en la de arco, la clave.
    b.level = 4;
    if (kind === 'arco') {
      b.rect(x + Math.floor(r) - 2, y - 5, 4, 4, P.oak);
      b.hline(x + Math.floor(r) - 2, y - 5, 4, P.tan);
    } else {
      b.rect(x - 5, y - 6, w + 10, 3, P.rust);
      b.hline(x - 5, y - 6, w + 10, P.oak);
      b.hline(x - 4, y - 3, w + 8, P.black);
    }
    // El alféizar.
    b.rect(x - 3, y + h + 2, w + 6, 2, P.oak);
    b.hline(x - 3, y + h + 4, w + 6, P.black);
    b.level = 0;
    if (!shut) {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++)
          if (inside(i, j)) {
            glass.set(x + i, y + j, j > h * 0.45 || (i + j) % 7 === 0 ? warm[1]! : warm[0]!);
            b.clear(x + i, y + j);
          }
      // Los parteluces: cruz; los de cuarterones, más paños si es grande; el de arco, el pie.
      b.level = 2;
      const mid = x + Math.floor(w / 2);
      b.vline(mid, y, h, P.bark);
      const rows = kind === 'cuarterones' && h >= 24 ? 3 : 2;
      for (let k = 1; k < rows; k++) {
        const yy = kind === 'arco' ? y + Math.round(r) : y + Math.round((h * k) / rows);
        for (let i = 0; i < w; i++) if (inside(i, yy - y)) b.set(x + i, yy, P.bark);
      }
      if (kind === 'cuarterones' && w >= 20)
        for (const xx of [x + Math.floor(w / 4), x + Math.floor((3 * w) / 4)])
          b.vline(xx, y, h, P.bark);
      b.level = 0;
    }
    // Las contraventanas: abiertas a los lados o, alguna, cerradas encima del cristal.
    if (kind === 'contra') {
      const sw = Math.ceil(w / 2) + 1;
      const [dk, mid, lt] = paint;
      const leaf = (lx: number) => {
        b.level = 3;
        // Tablas pintadas (verticales, de tres), con su contorno y la Z de los travesaños.
        for (let i = 0; i < sw; i++) {
          const k = i % 3;
          b.vline(lx + i, y - 1, h + 2, k === 0 ? dk : k === 1 ? lt : mid);
        }
        b.hline(lx, y + 2, sw, lt);
        b.hline(lx, y + h - 3, sw, lt);
        b.line(lx, y + h - 3, lx + sw - 1, y + 2, dk);
        b.level = 4;
        b.hline(lx, y - 2, sw, P.black);
        b.hline(lx, y + h + 1, sw, P.black);
        b.vline(lx - 1, y - 2, h + 4, P.black);
        b.vline(lx + sw, y - 2, h + 4, P.black);
        b.level = 0;
      };
      if (shut) {
        leaf(x);
        leaf(x + w - sw);
      } else {
        leaf(x - sw - 4);
        leaf(x + w + 4);
      }
    }
    // La jardinera: un cajón bajo el alféizar con matas y flores que asoman por encima.
    let drip = y + h + 5;
    if (box) {
      b.level = 4;
      b.rect(x - 3, y + h + 5, w + 6, 5, P.rust);
      b.hline(x - 3, y + h + 5, w + 6, P.oak);
      b.hline(x - 3, y + h + 9, w + 6, P.black);
      b.vline(x - 3, y + h + 5, 5, P.black);
      b.vline(x + w + 2, y + h + 5, 5, P.black);
      b.level = 5;
      for (let i = -2; i < w + 2; i++) {
        const k = (i * 7 + x * 3) % 6;
        const hgt = k % 3 === 0 ? 3 : 2;
        for (let d = 0; d < hgt; d++) b.set(x + i, y + h + 4 - d, d === 0 ? P.forest : P.leaf);
        if (k === 1 || k === 4) b.set(x + i, y + h + 4 - hgt, flower[(i + x) & 1]!);
      }
      b.level = 0;
      drip = y + h + 10;
    }
    sills.push({ x: x - 2, y: drip, w: w + 4 });
  };
  const rooms = L.rooms.filter(({ room }) => room.type !== 'torre');
  // Bajo tierra, el hueco de cada sala se rellena de tierra (los muros de piedra, como estaban).
  for (const { room, rect } of rooms) if (room.floor < 0) fill(interior(rect));
  for (const c of [...stairCells(L), ...caveCells(L)]) if (c.floor < 0) fill(interior(c.rect));
  // Por encima, la pared de fuera tapa toda la silueta del edificio: el hueco de cada sala y
  // también el grueso de los muros y los forjados (que en la vista de siempre se ven en corte).
  // Debajo de un tejado, se respetan las tres filas del alero del hastial.
  const above = [
    ...rooms.filter(({ room }) => room.floor >= 0).map(({ rect }) => rect),
    ...stairCells(L)
      .filter((c) => c.floor >= 0)
      .map((c) => c.rect),
  ];
  const runs = roofRuns(L);
  const underRoof = (r: Rect) =>
    runs.some((u) => u.base === r.y - SLAB && u.x0 < r.x + r.w && u.x1 > r.x);
  const stone = look.walls === 'piedra' || look.walls === 'pizarra' || look.walls === 'ladrillo';
  const bands: { x0: number; x1: number; y: number }[] = [];
  for (const r of above) {
    const x0 = Math.round(r.x - WALL - ox);
    const x1 = Math.round(r.x + r.w + WALL - ox);
    const y0 = Math.round(r.y - SLAB - oy) + (underRoof(r) ? 3 : 0);
    for (let y = Math.max(0, y0); y < Math.min(g, r.y + r.h + SLAB - oy); y++)
      for (let x = Math.max(0, x0); x < Math.min(b.w, x1); x++) {
        const src = y >= g - PLINTH ? plinth : wall;
        b.level = src.reliefAt(x, y);
        b.set(x, y, src.get(x, y));
      }
    bands.push({ x0, x1, y: y0 + (underRoof(r) ? 0 : 4) });
  }
  b.level = 0;
  // En cada forjado, una viga corrida maciza (madera) o una cornisa de piedra, con su sombra.
  const BAND = 8;
  for (const { x0, x1, y } of bands) {
    for (let x = x0; x < x1; x++) {
      shadeAt(b, x, y + BAND);
      shadeAt(b, x, y + BAND + 1);
    }
    if (stone) {
      b.level = 4;
      b.rect(x0, y, x1 - x0, BAND, P.steel);
      b.hline(x0, y, x1 - x0, P.mist);
      b.hline(x0, y + 1, x1 - x0, P.fog);
      b.hline(x0, y + BAND - 2, x1 - x0, P.slate);
      b.hline(x0, y + BAND - 1, x1 - x0, P.black);
      for (let x = x0 + 3; x < x1; x += 11 + ((x * 7) % 5)) b.vline(x, y + 2, BAND - 3, P.navy);
    } else beam(b, x0, y, x1 - x0, BAND, WOOD_DARK);
    b.level = 0;
  }
  // En las esquinas del edificio, un cantonero (madera) o los sillares de esquina (piedra).
  const edge = (x: number) => Math.abs(x - (L.left - ox)) < 1 || Math.abs(x - (L.right - ox)) < 1;
  for (const r of above) {
    const x0 = Math.round(r.x - WALL - ox);
    const x1 = Math.round(r.x + r.w + WALL - ox);
    const y0 = Math.round(r.y - SLAB - oy) + (underRoof(r) ? 3 : 0);
    const y1 = Math.min(g - PLINTH, Math.round(r.y + r.h + SLAB - oy));
    for (const [ex, side] of [
      [x0, 1],
      [x1 - 5, -1],
    ] as const) {
      if (!edge(side === 1 ? x0 : x1)) continue;
      b.level = 5;
      if (stone)
        for (let y = y0; y < y1; y += 6) {
          const long = ((y - y0) / 6) % 2 === 0;
          const w = long ? 9 : 5;
          const xx = side === 1 ? x0 : x1 - w;
          b.rect(xx, y, w, 5, P.steel);
          b.hline(xx, y, w, P.fog);
          b.hline(xx, y + 5, w, P.navy);
        }
      else {
        b.rect(ex, y0, 5, y1 - y0, P.rust);
        b.vline(ex, y0, y1 - y0, P.oak);
        b.vline(ex + 4, y0, y1 - y0, P.bark);
        for (let y = y0; y < y1; y++) shadeAt(b, side === 1 ? ex + 5 : ex - 1, y);
      }
      b.level = 0;
    }
  }
  for (const { room, rect } of rooms) {
    if (room.floor < 0) continue;
    for (let f = 0; f < room.h; f++)
      for (let c = 0; c < room.w; c++) {
        const cx = rect.x + c * CELL_W + CELL_W / 2;
        const top = floorTop(room.floor + f);
        if (room.type === 'recibidor' && f === 0 && c === 0) {
          // La puerta de la calle: dos hojas de tablas con su dintel, a ras del suelo.
          const x = Math.round(cx - ox - 11);
          const y = Math.round(top + ROOM_H - 36 - oy);
          openings.push({ x: cx - ox, y: y + 18 });
          b.level = 3;
          b.rect(x - 3, y - 3, 28, 39, P.umber);
          b.level = 1;
          planksV(b, x, y, 22, 36, 'puerta-calle', [P.plum, P.bark, P.rust, P.oak], 6);
          b.vline(x + 11, y, 36, P.bark);
          b.level = 3;
          b.rect(x + 7, y + 18, 2, 2, P.gold);
          b.rect(x + 13, y + 18, 2, 2, P.gold);
          b.level = 0;
          continue;
        }
        // Cada sala, su modelo (todas sus ventanas iguales); las del salón, más grandes. Pocas
        // jardineras y alguna contraventana cerrada (nunca en el salón).
        const pick = roomRng(room.id);
        const kind = WINDOW_KINDS[Math.floor(pick * WINDOW_KINDS.length) % WINDOW_KINDS.length]!;
        const big = room.type === 'salon';
        const box = rng.chance(f === 0 ? 0.45 : 0.3);
        const shut = kind === 'contra' && !big && rng.chance(0.18);
        const paint = SHUTTERS[Math.floor(pick * 97) % SHUTTERS.length]!;
        if (big) window(cx, top + 18, 22, 28, kind, box, false, paint);
        else window(cx, top + 24, 16, 22, kind, box, shut, paint);
      }
  }
  for (const s of stairCells(L))
    if (s.floor >= 0) window(s.rect.x + s.rect.w / 2, s.rect.y + 30, 8, 14, 'cuarterones');
  // Las testas de las vigas en cada forjado (el de encima de cada sala), con su sombra.
  const beams = new Rng(`vigas-${seed}`);
  if (!stone)
    for (const { x0, x1, y } of bands) beamEnds(b, x0 + 6, x1 - 6, y, BAND, beams, () => false);
  // Y todo, envejecido: la humedad del pie, los churretes bajo alféizares y aleros, paños y el
  // sol en lo alto (ver `envejecer.ts`).
  let top = 0;
  while (top < g && !b.data.subarray(top * b.w, (top + 1) * b.w).some((c) => c >>> 24)) top++;
  ageWall(b, 0, 0, b.w, g, 'fuera', {
    walls: look.walls,
    ground: g,
    top,
    sills,
    eaves: roofRuns(L).map((r) => ({ x0: r.x0 - ox, x1: r.x1 - ox, y: r.base - oy + 1 })),
  });
  // Los detalles sueltos, fijos por partida: los huecos de la planta baja libres de ventanas y
  // de la puerta (separados entre sí), y la hiedra en una esquina.
  const left = L.left - ox;
  const right = L.right - ox;
  const low = openings.filter((o) => o.y > g - ROOM_H);
  const gaps: number[] = [];
  for (let x = left + 26; x < right - 26; x += 4)
    if (low.every((o) => Math.abs(o.x - x) > 38) && gaps.every((v) => Math.abs(v - x) > 56))
      gaps.push(x);
  const d = pickDetails(seed, gaps, { left, right });
  const rng2 = new Rng(`detalles-pinta-${seed}`);
  const foot = g - PLINTH;
  if (d.pile !== null) woodpile(b, Math.round(d.pile - 22), g, rng2);
  if (d.barrel !== null) {
    const run = roofRuns(L).find((r) => d.barrel! + ox > r.x0 + 8 && d.barrel! + ox < r.x1 - 8);
    if (run) rainBarrel(b, Math.round(d.barrel), run.base - oy + 3, g);
  }
  if (d.ladder !== null) ladder(b, Math.round(d.ladder - 8), g, 62);
  if (d.ivy) ivy(b, Math.round(d.ivy.x), foot + 6, g - ROOM_H - 40, d.ivy.dir, rng2);
  return { buf: b, glass };
}

/** Los modelos de ventana de la vista desde fuera. */
type WindowKind = 'cuarterones' | 'arco' | 'contra';
const WINDOW_KINDS: readonly WindowKind[] = ['cuarterones', 'arco', 'contra'];
/** Colores de las contraventanas pintadas (sombra, cuerpo, luz). */
const SHUTTERS: readonly (readonly [string, string, string])[] = [
  [P.deep, P.forest, P.leaf],
  [P.navy, P.ocean, P.sky],
  [P.plum, P.wine, P.brick],
];
/** Alto del zócalo de piedra de la planta baja (con la albardilla). */
const PLINTH = 20;
/** Un número fijo (0–1) para cada sala. */
function roomRng(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Dónde va la hoja de la puerta de la calle en la pared del recibidor (a lo hondo y de alto). */
export const STREET_LEAF = { z0: 14, z1: 44, h: 52 } as const;

/**
 * La hoja de la puerta de la calle (más fuerte cuanto más nivel tiene el recibidor), a lo ancho
 * de `STREET_LEAF` (de z0 a z1) y `STREET_LEAF.h` de alto.
 */
export function streetLeaf(strength: number, seed: string): PixelBuffer {
  const half = new PixelBuffer(17, 54);
  streetDoor(half, 0, 0, strength, seed);
  const b = new PixelBuffer(STREET_LEAF.z1 - STREET_LEAF.z0, STREET_LEAF.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const c = half.get(Math.min(16, 1 + Math.floor((x * 15) / b.w)), y + 2);
      if (c) b.set(x, y, c);
    }
  return b;
}
