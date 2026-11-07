/**
 * Reglas de los trabajadores: puestos de cada sala, camas del servicio, quién trabaja dónde y
 * lo que rinde cada sala con la gente que tiene. TS puro: lo usan el reducer, la interfaz y la
 * escena.
 */
import { VILLAGE, TRADE_LIST, WORKER_QUOTES, TRADES, type Trade } from '../data/workers';
import { FIRST_NAMES } from '../data/names';
import type { StaffId } from '../data/custom';
import { TRAINS, type RoomType } from '../data/rooms';
import {
  DAY_SECONDS,
  HERO_WORK,
  JOB_SLOTS,
  JOB_WALK,
  WORK_END,
  WORK_START,
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

/** Salas de entrenamiento: tienen puestos, pero solo para héroes. */
export const isTrainRoom = (t: RoomType) => TRAINS[t] !== undefined;

/** Salas con puestos: las que producen y las de entrenamiento. */
export const hasPosts = (t: RoomType) => isJobRoom(t) || isTrainRoom(t);

/** Puestos de una sala: dos por hueco si tiene puestos y está en uso. */
export function slotsOf(r: Room): number {
  const a = active(r);
  return hasPosts(r.type) && a.level > 0 ? a.cells * JOB_SLOTS : 0;
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

/** Parte del día que ha pasado (0 al amanecer, 1 al caer la noche). */
export const dayPartOf = (s: GameState) => Math.min(1, (s.clock ?? 0) / DAY_SECONDS);

type OnShift = Pick<Worker, 'walk' | 'since'>;

/** Desde qué parte de hoy cuenta alguien en su sala (0: todo el día). */
export const shiftStart = (x: OnShift) => x.walk ?? x.since ?? 0;

/** Si aún va de camino a su sala ahora mismo. */
export const onWay = (s: GameState, x: OnShift) => x.walk !== undefined && dayPartOf(s) < x.walk;

/**
 * La parte de la jornada que cae entre las partes del día `a` y `b` (0–1: 1 es la jornada
 * entera). Lo que pasa antes de que lleguen por la mañana o cuando ya se han ido a dormir no
 * cuenta.
 */
export const workedIn = (a: number, b: number) =>
  Math.max(0, Math.min(b, WORK_END) - Math.max(a, WORK_START)) / (WORK_END - WORK_START);

/** Si ahora es hora de trabajar (de la jornada). */
export const onDuty = (s: GameState) => {
  const p = dayPartOf(s);
  return p >= WORK_START && p < WORK_END;
};

/** La parte de la jornada que habrá estado en su sala al caer la noche (0–1). */
export const shiftShare = (x: OnShift) => workedIn(shiftStart(x), 1);

/**
 * Trabajo en una sala: la gente que tiene y el nivel. Por defecto, el del día entero (cada uno
 * cuenta la parte del día que ha estado allí); con `now`, el de ahora mismo (quien va de camino
 * aún no cuenta): lo usan los talleres, que avanzan con el reloj.
 */
export function workAt(s: GameState, r: Room, now = false): number {
  if (!isJobRoom(r.type) || slotsOf(r) === 0) return 0;
  const k = (x: OnShift) => (now ? (onWay(s, x) ? 0 : 1) : shiftShare(x));
  let n = 0;
  for (const w of s.workers) if (w.room === r.id) n += effortOf(w, r.type) * k(w);
  for (const h of s.heroes)
    if (h.job === r.id && h.status === 'ok' && !h.guard && !dressing(s, h.id))
      n += HERO_WORK * k(h);
  return n * (0.75 + 0.25 * r.level);
}

/** Al que visten en la sastrería no está en su sala. */
const dressing = (s: GameState, id: string) => !!s.crafts?.some((c) => c.dress?.hero === id);

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
  if (!hasPosts(r.type)) return 'En esa sala no hay trabajo.';
  if (w && isTrainRoom(r.type)) return 'Entrenar es cosa de los héroes.';
  if (slotsOf(r) === 0) return 'La sala no está en uso.';
  if (used(s, room) >= slotsOf(r)) return 'No quedan puestos libres en esa sala.';
  return null;
}

/**
 * Pone a alguien a trabajar en una sala (o lo quita). El estado ya es una copia. Con sala nueva
 * va de camino: cuenta desde que llega (`arrivedAt`) o, como mucho, en `JOB_WALK` horas.
 */
export function assign(s: GameState, who: string, room: string | null): void {
  const x: (Worker | Hero) | undefined =
    s.workers.find((w) => w.id === who) ?? s.heroes.find((h) => h.id === who);
  if (!x) return;
  const was = 'trade' in x ? x.room : x.job;
  if ('trade' in x) {
    if (room) x.room = room;
    else delete x.room;
  } else if (room) x.job = room;
  else delete x.job;
  if (was === (room ?? undefined)) return;
  delete x.since;
  if (room) x.walk = dayPartOf(s) + JOB_WALK / 24;
  else delete x.walk;
}

/**
 * La escena dice que alguien ha llegado a una sala: si iba de camino a trabajar o entrenar allí,
 * empieza a contar ya. Devuelve si ha cambiado algo. El estado ya es una copia.
 */
export function arrivedAt(s: GameState, who: string, room: string): boolean {
  const i = s.workers.findIndex((w) => w.id === who && w.room === room && w.walk !== undefined);
  const j = s.heroes.findIndex((h) => h.id === who && h.job === room && h.walk !== undefined);
  if (i < 0 && j < 0) return false;
  const start = <T extends OnShift>(x: T): T => {
    const out = { ...x, since: Math.min(x.walk!, dayPartOf(s)) };
    delete out.walk;
    return out;
  };
  if (i >= 0) s.workers = s.workers.map((w, k) => (k === i ? start(w) : w));
  else s.heroes = s.heroes.map((h, k) => (k === j ? start(h) : h));
  return true;
}

/** Al acabar la noche, mañana cuentan todos desde el principio. El estado ya es una copia. */
export function newShift(s: GameState): void {
  for (const x of [...s.workers, ...s.heroes]) {
    delete x.walk;
    delete x.since;
  }
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
    return !!r && hasPosts(r.type) && active(r).cells > 0;
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
export function generateWorker(
  rng: Rng,
  id: string,
  usedNames: readonly string[],
  trades: readonly Trade[] = TRADE_LIST,
): Worker {
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
    trade: rng.pick(trades.length ? trades : TRADE_LIST),
    xp: 0,
    salary: 3 + skill,
    fee: 5 + skill * 4,
    quote: rng.pick(WORKER_QUOTES),
  };
}

const namesIn = (s: GameState) =>
  [...s.heroes, ...s.candidates, ...s.workers, ...s.seekers].map((x) => x.name);

/**
 * De qué oficios viene la gente a pedir trabajo: de las salas que hay (en uso). Dos de cada
 * tres veces, de una sala que aún no tiene a nadie de su oficio (se corre la voz).
 */
export function seekerTrades(s: GameState, rng: Rng): Trade[] {
  const open = TRADE_LIST.filter((t) =>
    s.building.rooms.some((r) => r.type === t && active(r).level > 0),
  );
  const empty = open.filter((t) => !s.workers.some((w) => w.trade === t));
  return empty.length && rng.chance(2 / 3) ? empty : open;
}

/** Llega alguien a pedir trabajo; si ya esperan muchos, el primero se cansa. */
export function addSeeker(s: GameState, rng: Rng, events: DawnEvent[]): void {
  const w = generateWorker(rng, `w${s.uid++}`, namesIn(s), seekerTrades(s, rng));
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
  if (s.mode !== 'libre') return;
  // Una sala nueva sin nadie de su oficio: se corre la voz y viene alguien a la mañana siguiente.
  const lack = TRADE_LIST.find(
    (t) =>
      s.building.rooms.some((r) => r.type === t && active(r).level > 0) &&
      !s.workers.some((w) => w.trade === t) &&
      !s.seekers.some((w) => w.trade === t),
  );
  if (lack && s.workers.length < workerCap(s)) {
    const w = generateWorker(rng, `w${s.uid++}`, namesIn(s), [lack]);
    s.seekers.push(w);
    if (s.seekers.length > MAX_SEEKERS) s.seekers.shift();
    events.push({
      t: `Se ha corrido la voz: viene a pedir trabajo ${workerTitle(w)} (Maña ${w.skill}).`,
    });
  } else if (rng.chance(Math.min(0.6, SEEKER_CHANCE + visitors * 0.02))) addSeeker(s, rng, events);
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
