/**
 * La gente de la casa: por dónde se anda en cada planta, cómo se llega de una sala a otra por
 * las escaleras y dónde se sienta, duerme, hace guardia o espera cada uno. Lógica pura (sin
 * DOM): la escena mueve las figuras y este fichero decide a dónde van.
 */
import type { Room } from '../../core/model';
import { hasPosts } from '../../core/workers';
import { beds, seats, type Bed } from './furniture';
import { PATIO_W, PITCH, STAIR_W, WALL, floorY, interior, type RoomsLayout } from './layout';

/** Un punto del suelo: x del mundo y planta. */
export interface Place {
  x: number;
  floor: number;
}

/** Tramos de suelo seguidos de cada planta (salas que se tocan y escaleras). */
export type Segments = Map<number, [number, number][]>;

/** Profundidades por las que se anda (cada uno la suya, para que no se tapen del todo). */
export const LANES = [16, 21, 26] as const;

/** Por dónde se sale al patio y dónde se pierde uno de vista al irse de misión. */
export const outside = (): Place => ({ x: -PATIO_W + 24, floor: 0 });

export function segments(L: RoomsLayout): Segments {
  const raw = new Map<number, [number, number][]>();
  const push = (f: number, a: number, b: number) => {
    if (!raw.has(f)) raw.set(f, []);
    raw.get(f)!.push([a, b]);
  };
  for (const { room, rect } of L.rooms)
    if (room.type !== 'torre') push(room.floor, rect.x, rect.x + rect.w);
  for (const s of L.stairs) for (const f of [...s.floors, ...s.halls]) push(f, s.x, s.x + STAIR_W);
  // El patio, delante del recibidor.
  push(0, -PATIO_W, 0);
  const out: Segments = new Map();
  for (const [f, list] of raw) {
    list.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of list) {
      const last = merged.at(-1);
      // Se juntan si se tocan (con el grueso de un muro de por medio, como mucho).
      if (last && a <= last[1] + 2 * WALL + 1) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    out.set(f, merged);
  }
  return out;
}

const segOf = (S: Segments, p: Place) =>
  S.get(p.floor)?.findIndex(([a, b]) => p.x >= a - 1 && p.x <= b + 1) ?? -1;

/**
 * Camino de un sitio a otro: los puntos por los que pasa (al cambiar de planta, dos puntos
 * seguidos con la misma x, en la escalera). Null si no se puede llegar.
 */
export function route(L: RoomsLayout, from: Place, to: Place, S = segments(L)): Place[] | null {
  const a = segOf(S, from);
  const z = segOf(S, to);
  if (a < 0 || z < 0) return null;
  if (from.floor === to.floor && a === z) return [to];
  // Nodos: cada rellano de cada escalera. Dijkstra sencillo (son pocos).
  const nodes: Place[] = [];
  const shaft: number[] = [];
  L.stairs.forEach((s, k) => {
    for (const f of s.floors) {
      nodes.push({ x: s.x + STAIR_W / 2, floor: f });
      shaft.push(k);
    }
  });
  const n = nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  const level = (p: Place, q: Place) => p.floor === q.floor && segOf(S, p) === segOf(S, q);
  // Dos rellanos se unen por la planta o, en la misma escalera, por el tramo de en medio.
  const linked = (i: number, j: number) => {
    const p = nodes[i]!;
    const q = nodes[j]!;
    if (p.floor === q.floor) return level(p, q);
    const s = L.stairs[shaft[i]!]!;
    return (
      shaft[i] === shaft[j] &&
      Math.abs(p.floor - q.floor) === 1 &&
      s.flights.includes(Math.min(p.floor, q.floor))
    );
  };
  const cost = (p: Place, q: Place) => Math.abs(p.x - q.x) + Math.abs(p.floor - q.floor) * PITCH;
  for (let i = 0; i < n; i++) if (level(from, nodes[i]!)) dist[i] = cost(from, nodes[i]!);
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || !linked(u, v)) continue;
      const d = dist[u]! + cost(nodes[u]!, nodes[v]!);
      if (d < dist[v]!) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const p = nodes[i]!;
    if (p.floor !== to.floor || segOf(S, p) !== z) continue;
    const d = dist[i]! + cost(p, to);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  const path: Place[] = [to];
  for (let i = best; i >= 0; i = prev[i]!) path.unshift(nodes[i]!);
  return path;
}

/** Una cama en el mundo: la del mueble y la sala en la que está. */
export interface BedSpot extends Bed {
  roomId: string;
  floor: number;
}

/** Un taburete del salón en el mundo. */
export interface SeatSpot extends Place {
  z: number;
}

/** Sitios de la casa a los que va la gente. */
export interface Spots {
  beds: BedSpot[];
  cots: BedSpot[];
  /** Camas del dormitorio del servicio (para los trabajadores). */
  staffBeds: BedSpot[];
  /** Salas con trabajo: por dónde se mueve quien trabaja en cada una (por id). */
  jobs: Map<string, { room: Room; x0: number; x1: number }>;
  seats: SeatSpot[];
  /** De pie en la barra (los candidatos esperan aquí). */
  bar: Place[];
  /** Los dos de guardia, en el recibidor. */
  guard: Place[];
  /** Salas en uso a las que se puede ir a dar una vuelta. */
  rooms: { room: Room; x0: number; x1: number }[];
  /** Puerta de la calle, por dentro. */
  door: Place;
}

const inUse = (r: Room) => r.level > 0 && !(r.works && r.works.kind !== 'extend');

export function spots(L: RoomsLayout): Spots {
  const out: Spots = {
    beds: [],
    cots: [],
    staffBeds: [],
    jobs: new Map(),
    seats: [],
    bar: [],
    guard: [],
    rooms: [],
    door: { x: 12, floor: 0 },
  };
  for (const { room, rect } of L.rooms) {
    if (room.type === 'torre') continue;
    const i = interior(rect);
    if (room.type === 'recibidor') {
      out.door = { x: i.x + 10, floor: 0 };
      out.guard = [
        { x: i.x + i.w * 0.42, floor: 0 },
        { x: i.x + i.w * 0.7, floor: 0 },
      ];
    }
    if (!inUse(room)) continue;
    for (const b of beds(room, i.w)) {
      const spot = { ...b, x: i.x + b.x, roomId: room.id, floor: room.floor };
      (room.type === 'servicio' ? out.staffBeds : b.kind === 'catre' ? out.cots : out.beds).push(
        spot,
      );
    }
    for (const s of seats(room, i.w)) out.seats.push({ x: i.x + s.x, floor: room.floor, z: s.z });
    if (room.type === 'salon')
      for (let k = 0; k < 4; k++) out.bar.push({ x: i.x + 30 + k * 14, floor: room.floor });
    if (room.type !== 'tesoro') out.rooms.push({ room, x0: i.x + 14, x1: i.x + i.w - 14 });
    if (hasPosts(room.type)) out.jobs.set(room.id, { room, x0: i.x + 16, x1: i.x + i.w - 16 });
  }
  return out;
}

/** Lo que hace cada uno: de pie, sentado, en la cama o fuera de casa. */
export type Pose = 'stand' | 'sit' | 'bed';

/** Un sitio al que ir y qué hacer al llegar. */
export interface Goal {
  place: Place;
  pose: Pose;
  /** Profundidad al llegar (la del taburete o la cama). */
  z?: number;
  bed?: BedSpot;
}

export interface Resident {
  id: string;
  status: 'ok' | 'herido' | 'mision' | 'candidato';
  guard?: boolean;
  /** Trabajador: con cama en el servicio o de los que duermen en el pueblo (sin sitio fijo). */
  staff?: 'casa' | 'pueblo';
}

/**
 * Sitio fijo de cada uno: los heridos en los catres (y si no caben, en camas), los de guardia
 * en el recibidor, los candidatos en la barra, los trabajadores en el servicio y los demás con
 * una cama cada uno.
 */
export function homes(people: readonly Resident[], S: Spots): Map<string, Goal> {
  const out = new Map<string, Goal>();
  const cots = [...S.cots];
  const free = [...S.beds];
  const bed = (b: BedSpot): Goal => ({
    place: { x: b.x, floor: b.floor },
    pose: 'bed',
    z: b.z,
    bed: b,
  });
  for (const p of people.filter((x) => x.status === 'herido')) {
    const b = cots.shift() ?? free.shift();
    if (b) out.set(p.id, bed(b));
  }
  let g = 0;
  const staff = [...S.staffBeds];
  for (const p of people.filter((x) => x.staff === 'casa')) {
    const b = staff.shift();
    if (b) out.set(p.id, bed(b));
  }
  for (const p of people.filter((x) => x.status === 'ok' && !x.staff)) {
    if (p.guard && g < S.guard.length) {
      out.set(p.id, { place: S.guard[g++]!, pose: 'stand' });
      continue;
    }
    const b = free.shift();
    if (b) out.set(p.id, bed(b));
  }
  let c = 0;
  for (const p of people.filter((x) => x.status === 'candidato'))
    if (c < S.bar.length) out.set(p.id, { place: S.bar[c++]!, pose: 'stand' });
  return out;
}

/**
 * A dónde va alguien que está en casa y libre durante el día: casi siempre al salón (a una
 * mesa libre o a la barra) y a veces a otra sala, a dar una vuelta. `rnd` da números de 0 a 1.
 */
export function wander(S: Spots, taken: ReadonlySet<SeatSpot>, rnd: () => number): Goal | null {
  const r = rnd();
  const free = S.seats.filter((s) => !taken.has(s));
  if (r < 0.45 && free.length) {
    const s = free[Math.floor(rnd() * free.length)]!;
    return { place: { x: s.x, floor: s.floor }, pose: 'sit', z: s.z };
  }
  if (r < 0.6 && S.bar.length) {
    const b = S.bar[Math.floor(rnd() * S.bar.length)]!;
    return { place: { x: b.x + (rnd() - 0.5) * 10, floor: b.floor }, pose: 'stand' };
  }
  if (!S.rooms.length) return null;
  const room = S.rooms[Math.floor(rnd() * S.rooms.length)]!;
  return {
    place: { x: room.x0 + rnd() * (room.x1 - room.x0), floor: room.room.floor },
    pose: 'stand',
  };
}

/**
 * A dónde va quien trabaja en una sala: cada uno a su puesto (`k` de `n`) y, en el salón, de
 * mesa en mesa sirviendo.
 */
export function workGoal(
  S: Spots,
  roomId: string,
  k: number,
  n: number,
  rnd: () => number,
): Goal | null {
  const j = S.jobs.get(roomId);
  if (!j) return null;
  const floor = j.room.floor;
  if (j.room.type === 'salon') {
    const tables = S.seats.filter((s) => s.floor === floor && s.x >= j.x0 - 20 && s.x <= j.x1 + 20);
    if (tables.length && rnd() < 0.7) {
      const t = tables[Math.floor(rnd() * tables.length)]!;
      return { place: { x: t.x + (rnd() < 0.5 ? -9 : 9), floor }, pose: 'stand' };
    }
  }
  const x = j.x0 + (((k % Math.max(1, n)) + 0.5) * (j.x1 - j.x0)) / Math.max(1, n);
  return { place: { x: x + (rnd() - 0.5) * 8, floor }, pose: 'stand' };
}

/** Altura del suelo de una planta en el mundo (y hacia abajo). */
export const groundOf = (p: Place) => floorY(p.floor);
