/**
 * Reglas de los trabajadores: puestos de cada sala, camas del servicio, quién trabaja dónde y
 * lo que rinde cada sala con la gente que tiene. TS puro: lo usan el reducer, la interfaz y la
 * escena.
 */
import { VILLAGE, TRADE_LIST, WORKER_QUOTES, TRADES, type Trade } from '../data/workers';
import { FIRST_NAMES } from '../data/names';
import type { StaffId } from '../data/custom';
import type { RoomType } from '../data/rooms';
import {
  HERO_WORK,
  JOB_SLOTS,
  MAX_SEEKERS,
  NURSE_WORK,
  SEEKER_CHANCE,
  SKILL_XP,
  TRADE_BONUS,
} from './balance';
import type { Building, DawnEvent, GameState, Hero, Room, Worker } from './model';
import { active } from './rooms';
import type { Rng } from './rng';

/** Hasta tener el dormitorio del servicio, trabajan los tres del pueblo. */
export const VILLAGE_COUNT = 3;

export const isJobRoom = (t: RoomType): t is Trade => (TRADE_LIST as RoomType[]).includes(t);

/** Puestos de una sala: dos por hueco si produce y está en uso. */
export function slotsOf(r: Room): number {
  const a = active(r);
  return isJobRoom(r.type) && a.level > 0 ? a.cells * JOB_SLOTS : 0;
}

/** Camas del dormitorio del servicio: dos por hueco y nivel. */
export function staffBeds(b: Building): number {
  let n = 0;
  for (const r of b.rooms) if (r.type === 'servicio') n += active(r).cells * 2 * active(r).level;
  return n;
}

/** Cuántos trabajadores caben: los del pueblo o una cama del servicio para cada uno. */
export const workerCap = (s: GameState) => Math.max(VILLAGE_COUNT, staffBeds(s.building));

/** Nombre con el oficio, para listas: «Remedios, la cocinera» o «Brom, cervecero». */
export const workerTitle = (w: Worker) =>
  w.village
    ? `${w.name}, ${VILLAGE[w.village].role}`
    : `${w.name}, ${TRADES[w.trade].name[w.sex].toLowerCase()}`;

/** Quién ocupa los puestos de una sala (los héroes con el trabajo apuntado, estén o no hoy). */
export function crewOf(s: GameState, roomId: string): { workers: Worker[]; heroes: Hero[] } {
  return {
    workers: s.workers.filter((w) => w.room === roomId),
    heroes: s.heroes.filter((h) => h.job === roomId),
  };
}

const used = (s: GameState, roomId: string) => {
  const c = crewOf(s, roomId);
  return c.workers.length + c.heroes.length;
};

/** Lo que rinde un trabajador en una sala. */
export const effortOf = (w: Worker, type: RoomType) =>
  w.skill * (w.trade === type ? TRADE_BONUS : 1);

/** Trabajo de hoy en una sala: la gente que hay y el nivel de la sala. */
export function workAt(s: GameState, r: Room): number {
  if (!isJobRoom(r.type) || slotsOf(r) === 0) return 0;
  let n = 0;
  for (const w of s.workers) if (w.room === r.id) n += effortOf(w, r.type);
  for (const h of s.heroes) if (h.job === r.id && h.status === 'ok' && !h.guard) n += HERO_WORK;
  return n * (0.75 + 0.25 * r.level);
}

/** Trabajo de hoy en todas las salas de un tipo. */
export const workIn = (s: GameState, type: Trade) =>
  s.building.rooms.reduce((a, r) => a + (r.type === type ? workAt(s, r) : 0), 0);

/** Días de más que se curan los heridos cada noche con alguien en la enfermería. */
export const nurseBonus = (s: GameState) => (workIn(s, 'enfermeria') >= NURSE_WORK ? 1 : 0);

/** El bardo toca en el salón (la tarima lo nota). */
export const bardPlaying = (s: GameState) =>
  s.workers.some(
    (w) =>
      w.village === 'bardo' &&
      s.building.rooms.some((r) => r.id === w.room && r.type === 'salon' && slotsOf(r) > 0),
  );

/** Por qué no puede ir alguien a una sala (null = puede). `room` null es dejar de trabajar. */
export function canAssign(s: GameState, who: string, room: string | null): string | null {
  const w = s.workers.find((x) => x.id === who);
  const h = w ? undefined : s.heroes.find((x) => x.id === who);
  if (!w && !h) return 'Ya no está en la taberna.';
  if (room === null) return null;
  if (h) {
    if (h.status !== 'ok') return `${h.name} no está en casa.`;
    if (h.guard) return `${h.name} está de guardia.`;
  }
  if ((w?.room ?? h?.job) === room) return null;
  const r = s.building.rooms.find((x) => x.id === room);
  if (!r) return 'Esa sala ya no está.';
  if (!isJobRoom(r.type)) return 'En esa sala no hay trabajo.';
  if (slotsOf(r) === 0) return 'La sala no está en uso.';
  if (used(s, room) >= slotsOf(r)) return 'No quedan puestos libres en esa sala.';
  return null;
}

/** Pone a alguien a trabajar en una sala (o lo quita). El estado ya es una copia. */
export function assign(s: GameState, who: string, room: string | null): void {
  const w = s.workers.find((x) => x.id === who);
  if (w) {
    if (room) w.room = room;
    else delete w.room;
    return;
  }
  const h = s.heroes.find((x) => x.id === who);
  if (!h) return;
  if (room) h.job = room;
  else delete h.job;
}

/** Sala con puesto libre para alguien: la de su oficio y, si no, la que tenga sitio. */
export function freeRoomFor(s: GameState, trade: Trade): Room | null {
  const open = s.building.rooms.filter((r) => slotsOf(r) > used(s, r.id));
  const order = [trade, ...TRADE_LIST.filter((t) => t !== trade)];
  for (const t of order) {
    const r = open.find((x) => x.type === t);
    if (r) return r;
  }
  return null;
}

/**
 * Tras una obra: quien trabajaba en una sala que ya no está (o que ya no tiene puestos) se
 * busca otra; los héroes simplemente dejan de trabajar.
 */
export function tidyJobs(s: GameState): void {
  const ok = (id: string | undefined) => {
    const r = id ? s.building.rooms.find((x) => x.id === id) : undefined;
    return !!r && isJobRoom(r.type) && active(r).cells > 0;
  };
  for (const h of s.heroes) if (h.job && !ok(h.job)) delete h.job;
  const lost: Worker[] = [];
  for (const w of s.workers)
    if (w.room && !ok(w.room)) {
      delete w.room;
      lost.push(w);
    }
  // Si una sala se ha quedado pequeña, salen los últimos en llegar.
  for (const r of s.building.rooms) {
    const crew = crewOf(s, r.id);
    let extra = crew.workers.length + crew.heroes.length - slotsOf(r);
    for (const h of [...crew.heroes].reverse()) if (extra-- > 0) delete h.job;
    for (const w of [...crew.workers].reverse())
      if (extra-- > 0) {
        delete w.room;
        lost.push(w);
      }
  }
  for (const w of lost) {
    const r = freeRoomFor(s, w.trade);
    if (r) w.room = r.id;
  }
}

/** Los tres del pueblo (la partida nueva los pone en la sala de su oficio, si está en uso). */
export function villageCrew(s: GameState): Worker[] {
  return (Object.keys(VILLAGE) as StaffId[]).map((k) => {
    const v = VILLAGE[k];
    return {
      id: `w${s.uid++}`,
      seed: `pueblo-${k}`,
      name: v.name,
      sex: v.sex,
      skill: v.skill,
      trade: v.trade,
      xp: 0,
      salary: 6,
      fee: 0,
      village: k,
      quote: v.quote,
    };
  });
}

/** Alguien que viene a pedir trabajo. */
export function generateWorker(rng: Rng, id: string, usedNames: readonly string[]): Worker {
  const sex = rng.chance(0.5) ? 'm' : 'f';
  let name = '';
  for (let tries = 0; tries < 20; tries++) {
    name = rng.pick(FIRST_NAMES[sex]);
    if (!usedNames.some((n) => n.split(' ')[0] === name)) break;
  }
  const skill = rng.int(2, 6);
  return {
    id,
    seed: `${id}-${name}`,
    name,
    sex,
    skill,
    trade: rng.pick(TRADE_LIST),
    xp: 0,
    salary: 3 + skill,
    fee: 5 + skill * 4,
    quote: rng.pick(WORKER_QUOTES),
  };
}

const namesIn = (s: GameState) =>
  [...s.heroes, ...s.candidates, ...s.workers, ...s.seekers].map((x) => x.name);

/** Llega alguien a pedir trabajo; si ya esperan muchos, el primero se cansa. */
export function addSeeker(s: GameState, rng: Rng, events: DawnEvent[]): void {
  const w = generateWorker(rng, `w${s.uid++}`, namesIn(s));
  if (s.seekers.length >= MAX_SEEKERS) {
    const left = s.seekers.shift()!;
    events.push({ t: `${left.name} se cansó de esperar trabajo y se fue a otra posada.` });
  }
  s.seekers.push(w);
  events.push({ t: `Viene a pedir trabajo ${workerTitle(w)} (Maña ${w.skill}).` });
}

/**
 * La noche de los trabajadores: quien ha trabajado coge maña y, entre los visitantes del día,
 * alguno viene a pedir trabajo (más cuanta más gente pasa por el salón).
 */
export function stepWorkers(s: GameState, rng: Rng, events: DawnEvent[], visitors = 0): void {
  for (const w of s.workers) {
    const r = s.building.rooms.find((x) => x.id === w.room);
    if (!r || slotsOf(r) === 0 || w.skill >= 10) continue;
    w.xp += w.trade === r.type ? 2 : 1;
    if (w.xp < w.skill * SKILL_XP) continue;
    w.xp = 0;
    w.skill++;
    events.push({ t: `${w.name} le ha cogido el truco al trabajo: Maña ${w.skill}.`, k: 'good' });
  }
  if (s.mode === 'libre' && rng.chance(Math.min(0.6, SEEKER_CHANCE + visitors * 0.02)))
    addSeeker(s, rng, events);
}

/** Por qué no se puede contratar a alguien que pide trabajo (null = se puede). */
export function canHireWorker(s: GameState, id: string): string | null {
  const w = s.seekers.find((x) => x.id === id);
  if (!w) return 'Ya no está esperando.';
  if (s.workers.length >= workerCap(s))
    return s.mode === 'libre'
      ? 'No queda cama: construye o amplía el dormitorio del servicio.'
      : 'De momento basta con los tres del pueblo.';
  if (s.gold < w.fee) return `Te faltan ${w.fee - s.gold} monedas.`;
  return null;
}
