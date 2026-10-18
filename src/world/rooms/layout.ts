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
export const CELL_W = 120;
export const STAIR_W = 40;
export const ROOM_H = 90;
export const SLAB = 10;
export const PITCH = ROOM_H + SLAB;
/** Paredes entre salas: la mitad del grosor cae dentro de cada hueco. */
export const PARTITION = 16;
/** Lo que el muro de fuera sobresale del hueco (con su media pared, igual de grueso). */
export const WALL = PARTITION / 2;
/** Fondo de las salas, del plano de corte a la pared del fondo. */
export const DEPTH = 60;
/** El patio, a la izquierda del edificio, y el terreno de la derecha (solares). */
export const PATIO_W = 200;
const RIGHT = 120;
/** Cielo que se deja por encima del tejado o de la torre. */
const SKY = 120;
/** Lo más alto que puede subir un tejado y lo que asoma la torre por encima de su sala. */
export const ROOF_H = 50;
export const TOWER_H = 84;

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

/** Interior de un hueco o de una sala: sin la media pared de cada lado. */
export const interior = (r: Rect): Rect => ({
  x: r.x + PARTITION / 2,
  y: r.y,
  w: r.w - PARTITION,
  h: r.h,
});

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
    // Debajo, sitio para que la barra de abajo no tape la última planta.
    y1: floorY(bottom) + SLAB + 90,
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

/** Tramo de tejado: de dos aguas, de x0 a x1, apoyado en `base` y con caballete a `h` de altura. */
export interface RoofRun {
  x0: number;
  x1: number;
  base: number;
  h: number;
}

/** Tejados sobre cada tramo de huecos (y escaleras) que acaban a la misma altura. */
export function roofRuns(L: RoomsLayout): RoofRun[] {
  const runs: RoofRun[] = [];
  const segs: { x: number; w: number; top: number }[] = [];
  const topOf = (x: number, w: number) =>
    Math.max(
      -99,
      ...L.rooms
        .filter((o) => o.room.type !== 'torre' && o.rect.x < x + w && o.rect.x + o.rect.w > x)
        .map((o) => o.room.floor + o.room.h - 1),
    );
  for (let c = 0; c < L.b.cols; c++)
    segs.push({ x: colX(L.b, c), w: CELL_W, top: topOf(colX(L.b, c), CELL_W) });
  for (const s of L.stairs) segs.push({ x: s, w: STAIR_W, top: L.top });
  segs.sort((a, c) => a.x - c.x);
  let i = 0;
  while (i < segs.length) {
    let j = i;
    while (
      j + 1 < segs.length &&
      segs[j + 1]!.top === segs[i]!.top &&
      segs[j + 1]!.x === segs[j]!.x + segs[j]!.w
    )
      j++;
    const top = segs[i]!.top;
    if (top >= 0) {
      const x0 = segs[i]!.x - WALL - 6;
      const x1 = segs[j]!.x + segs[j]!.w + WALL + 6;
      runs.push({
        x0,
        x1,
        base: floorTop(top) - SLAB,
        h: Math.min(ROOF_H, Math.round((x1 - x0) / 3)),
      });
    }
    i = j + 1;
  }
  return runs;
}

/** Altura del tejado en una x (lo que sube la torre para apoyarse en el caballete). */
export function roofLift(runs: RoofRun[], x: number, base: number): number {
  const run = runs.find((u) => x > u.x0 && x < u.x1 && u.base === base);
  if (!run) return 0;
  const half = (run.x1 - run.x0) / 2;
  return Math.round(run.h * (1 - Math.abs(x - (run.x0 + half)) / half));
}

/** Qué hay al otro lado de cada pared de una sala, planta a planta. */
export type Side = 'sala' | 'escalera' | 'aire' | 'tierra';

export function sidesOf(b: Building, r: Room): { left: Side[]; right: Side[] } {
  const look = (c: number, f: number, stair: number): Side => {
    if (b.stairs.includes(stair)) return 'escalera';
    const o = b.rooms.find(
      (x) =>
        x.type !== 'torre' && c >= x.col && c < x.col + x.w && f >= x.floor && f < x.floor + x.h,
    );
    if (o) return 'sala';
    return f < 0 ? 'tierra' : 'aire';
  };
  const left: Side[] = [];
  const right: Side[] = [];
  for (let f = r.floor; f < r.floor + r.h; f++) {
    left.push(look(r.col - 1, f, r.col));
    right.push(look(r.col + r.w, f, r.col + r.w));
  }
  return { left, right };
}
