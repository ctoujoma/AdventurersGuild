/**
 * Geometría del gremio por salas: dónde cae cada sala, cada escalera y cada planta del corte
 * del edificio, en píxeles del mundo. Lógica pura (sin DOM): la escena y el pintor solo
 * dibujan lo que diga este fichero.
 */
import type { RoomType } from '../../data/rooms';
import { MAX_DOWN } from '../../core/balance';
import type { Building, Room } from '../../core/model';
import { GROUND } from '../geometry';

/** Ancho de un hueco, de una escalera y alto de una planta (interior + forjado). */
export const CELL_W = 96;
export const STAIR_W = 32;
export const ROOM_H = 64;
export const SLAB = 8;
export const PITCH = ROOM_H + SLAB;
/** Grosor de los muros de fuera. */
export const WALL = 6;
/** El patio, a la izquierda del edificio, y el terreno de la derecha (solares). */
export const PATIO_W = 176;
const RIGHT = 120;
/** Cielo que se deja por encima del tejado o de la torre. */
const SKY = 120;
/** Lo más alto que puede subir un tejado y lo que asoma la torre por encima de su sala. */
export const ROOF_H = 44;
export const TOWER_H = 70;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RoomsLayout {
  b: Building;
  /** Límites del mundo visible. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Cara de fuera de los muros del edificio. */
  left: number;
  right: number;
  /** Planta más alta con salas (sin la torre) y la más honda excavada. */
  top: number;
  deepest: number;
  rooms: { room: Room; rect: Rect }[];
  /** Escaleras: x de su hueco. Van desde la planta más honda hasta la más alta. */
  stairs: number[];
  patio: Rect;
}

/** Arriba del interior de una planta y su suelo. */
export const floorTop = (f: number) => GROUND - f * PITCH - ROOM_H;
export const floorY = (f: number) => GROUND - f * PITCH;

const stairsBefore = (b: Building, c: number, inclusive: boolean) =>
  b.stairs.filter((s) => (inclusive ? s <= c : s < c)).length;

/** Borde izquierdo de un hueco (las escaleras de su izquierda lo empujan). */
export const colX = (b: Building, c: number) =>
  WALL + c * CELL_W + STAIR_W * stairsBefore(b, c, true);

/** Borde izquierdo de la escalera que va a la izquierda del hueco `s`. */
export const stairX = (b: Building, s: number) =>
  WALL + s * CELL_W + STAIR_W * stairsBefore(b, s, false);

export const innerWidth = (b: Building) => b.cols * CELL_W + b.stairs.length * STAIR_W;

export function roomRect(b: Building, r: Room): Rect {
  const y = floorTop(r.floor + r.h - 1);
  return { x: colX(b, r.col), y, w: r.w * CELL_W, h: floorY(r.floor) - y };
}

export function roomsLayout(b: Building): RoomsLayout {
  const plain = b.rooms.filter((r) => r.type !== 'torre');
  const top = Math.max(0, ...plain.map((r) => r.floor + r.h - 1));
  const deepest = Math.min(0, ...b.dug.map((k) => Number(k.split(',')[1])));
  const tower = b.rooms.find((r) => r.type === 'torre');
  const right = 2 * WALL + innerWidth(b);
  const sky = tower ? floorTop(tower.floor) - TOWER_H : floorTop(top) - SLAB - ROOF_H;
  // Una planta de roca por debajo de lo excavado (para ver dónde se puede seguir cavando).
  const bottom = Math.max(deepest - 1, -MAX_DOWN);
  return {
    b,
    x0: -PATIO_W - 40,
    x1: right + RIGHT,
    y0: Math.min(0, sky - SKY),
    y1: floorY(bottom) + SLAB + 24,
    left: 0,
    right,
    top,
    deepest,
    rooms: b.rooms.map((room) => ({ room, rect: roomRect(b, room) })),
    stairs: b.stairs.map((s) => stairX(b, s)),
    patio: { x: -PATIO_W, y: floorTop(0), w: PATIO_W, h: ROOM_H },
  };
}

export const centerOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function roomAtPoint(L: RoomsLayout, x: number, y: number): Room | null {
  const hit = L.rooms.find(
    ({ rect }) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h,
  );
  return hit?.room ?? null;
}

/** Los sitios de la taberna dibujada, en el edificio por salas (para los avisos y las notas). */
const LEGACY: Record<string, RoomType | 'patio'> = {
  dormitorios: 'dormitorio',
  enfermeria: 'enfermeria',
  sala: 'salon',
  barra: 'salon',
  tablon: 'salon',
  puerta: 'recibidor',
  rellano: 'recibidor',
  bodega: 'bodega',
  cofres: 'tesoro',
  despacho: 'mapas',
  armeria: 'armeria',
  capilla: 'capilla',
  forja: 'forja',
  veteranos: 'veteranos',
  torre: 'torre',
  exterior: 'patio',
  patio: 'patio',
  camino: 'patio',
  establo: 'patio',
  'patio-entreno': 'patio',
  empalizada: 'patio',
};

/** Punto al que mirar para un sitio: una sala por su id o tipo, o un nombre de antes. */
export function focusPoint(L: RoomsLayout, name: string): Point | null {
  const byId = L.rooms.find((x) => x.room.id === name);
  if (byId) return centerOf(byId.rect);
  const kind = LEGACY[name] ?? name;
  if (kind === 'patio') return centerOf(L.patio);
  const hit = L.rooms.find((x) => x.room.type === kind);
  return hit ? centerOf(hit.rect) : null;
}
