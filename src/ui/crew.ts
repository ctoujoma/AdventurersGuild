/**
 * La gente de la casa por tarea, para la lista de «quién hace qué»: cada sala con sus puestos
 * (ocupados o libres), los que entrenan, la guardia, quien descansa y quien está fuera, y los
 * avisos de lo que pide atención. Solo lee el estado: los cambios van por `planTask`.
 */
import {
  BREW_PER_WORK,
  CELLAR_COOL,
  COOK_PER_WORK,
  HERO_WORK,
  MAX_GUARDS,
  NURSE_WORK,
  SERVE_PER_WORK,
} from '../core/balance';
import { dayPart } from '../core/game';
import { brewAt, cookAt } from '../core/larder';
import type { GameState, Hero, Room, Worker } from '../core/model';
import { visitorsOf } from '../core/salon';
import { plural } from '../core/text';
import { ATTR_NAMES, gainText, skillGain, trainState } from '../core/training';
import { crewOf, effortOf, isJobRoom, isTrainRoom, slotsOf, workIn } from '../core/workers';
import { ROOMS, TRAINS } from '../data/rooms';
import { TRADES, TRADE_LIST } from '../data/workers';
import { statusLabel } from '../data/labels';
import { GUARD, planTask, type Task } from './drop';
import { jobRoomName } from './roomName';
import { isRealTime, left as timeLeft } from './when';

/** Alguien de la casa en la lista. */
export interface Member {
  id: string;
  name: string;
  /** Oficio y Maña de un trabajador; clase o lo que entrena de un héroe. */
  sub: string;
  hero: boolean;
  /** Trabaja fuera de su oficio (rinde menos). */
  off?: boolean;
  /** Lo que pone en su sala: «+12 raciones». */
  gives?: string;
  /** Cómo va lo que entrena (0–1). */
  progress?: number;
  /** Algo más que se lee al elegirlo (lo que gana con el siguiente punto). */
  more?: string;
}

/** Un grupo de la lista: una sala con puestos, la guardia, los que descansan o los de fuera. */
export interface Group {
  key: string;
  title: string;
  /** Lo que sale de ahí hoy o lo que significa el grupo. */
  note?: string;
  people: Member[];
  /** Puestos en total (sin cifra, el grupo no tiene huecos: descansan, fuera). */
  slots?: number;
  /** La tarea que da el grupo a quien se pone en un hueco libre. */
  task?: Task;
}

/** Lo que hace hoy la gente que trabaja en una sala. */
export function crewEffect(game: GameState, room: Room): string {
  switch (room.type) {
    case 'salon': {
      const v = visitorsOf(game, game.day);
      return `Hoy se atiende a ${v.served} de ${v.total} visitantes.`;
    }
    case 'bodega':
      return `Saca ${Math.round(brewAt(game, room))} jarras al día.`;
    case 'cocina':
      return `Hace ${Math.round(cookAt(game, room))} raciones al día.`;
    case 'enfermeria':
      return workIn(game, 'enfermeria') >= NURSE_WORK
        ? 'Los heridos se curan un día antes.'
        : 'Con más mano, los heridos se curarían un día antes.';
    default:
      return '';
  }
}

/** Lo que sale de una sala que produce por cada punto de trabajo (sin cifra en la enfermería). */
function perWork(room: Room): number {
  const lv = 0.75 + 0.25 * room.level;
  switch (room.type) {
    case 'cocina':
      return lv * COOK_PER_WORK;
    case 'bodega':
      return lv * BREW_PER_WORK * (room.floor < 0 ? CELLAR_COOL : 1);
    case 'salon':
      return lv * SERVE_PER_WORK;
    default:
      return 0;
  }
}

/** «+12 raciones», «+3 jarras» o «Atiende a 2». */
function givesText(room: Room, n: number): string {
  if (room.type === 'salon') return `Atiende a ${n}`;
  return room.type === 'cocina'
    ? `+${n} ${plural(n, 'ración', 'raciones')}`
    : `+${n} ${plural(n, 'jarra', 'jarras')}`;
}

/**
 * Lo que pone cada uno en su sala, repartido para que la suma dé el total redondeado de la sala
 * (si cada parte se redondeara por su lado, 5,6 + 2,5 serían 9 jarras en una bodega que saca 8).
 */
export function givesAt(room: Room, efforts: number[]): (string | undefined)[] {
  const k = perWork(room);
  if (!k) return efforts.map(() => undefined);
  const raw = efforts.map((e) => e * k);
  const out = raw.map(Math.floor);
  let left = Math.round(raw.reduce((a, b) => a + b, 0)) - out.reduce((a, b) => a + b, 0);
  const order = raw.map((_, i) => i).sort((a, b) => (raw[b]! % 1) - (raw[a]! % 1));
  for (const i of order) if (left-- > 0) out[i]!++;
  return out.map((n) => givesText(room, n));
}

const workerMember = (w: Worker, room?: Room): Member => ({
  id: w.id,
  name: w.name,
  sub: `${TRADES[w.trade].name[w.sex]} · Maña ${w.skill}`,
  hero: false,
  off: !!room && room.type !== w.trade,
  more: `«${w.quote}»`,
});

const heroMember = (h: Hero, sub: string): Member => ({ id: h.id, name: h.name, sub, hero: true });

/** «Faltan unos 3 días» (o «Sube esta noche»); con el tiempo que corre solo, en minutos. */
export function daysLeft(frac: number, perDay: number, clock: number): string {
  const d = Math.ceil((1 - frac) / perDay - 1e-9);
  if (isRealTime()) return `Sube en ${timeLeft(Math.max(1, d), clock)}`;
  return d <= 1 ? 'Sube esta noche' : `Faltan unos ${d} días`;
}

/** Un héroe en una sala: entrenando (con su barra) o echando una mano. */
function heroAt(game: GameState, h: Hero, room: Room): Member {
  if (h.status !== 'ok') return heroMember(h, 'Fuera hoy');
  const attr = TRAINS[room.type];
  if (!attr) return heroMember(h, 'Héroe, echa una mano');
  const t = trainState(game, h, dayPart(game));
  const m = heroMember(h, `${ATTR_NAMES[attr]} ${h.attrs[attr]}`);
  if (!t) return m;
  if (t.capped)
    return { ...m, sub: `${m.sub} · en el tope`, more: 'Mejora la sala para que siga.' };
  const gain = gainText(skillGain(h, attr));
  return {
    ...m,
    gives: daysLeft(t.frac, t.perDay, game.clock ?? 0),
    progress: t.frac,
    more: gain ? `Con ese punto: ${gain}.` : 'Ese punto aún no se notará en las habilidades.',
  };
}

/** Salas con puestos en uso, en un orden fijo: las que producen y luego las de entrenar. */
function postRooms(game: GameState): Room[] {
  const order = [...TRADE_LIST, ...(Object.keys(TRAINS) as Room['type'][])];
  return game.building.rooms
    .filter((r) => slotsOf(r) > 0 && order.includes(r.type))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || b.floor - a.floor);
}

/** La casa por tareas. */
export function crewGroups(game: GameState): Group[] {
  const groups: Group[] = [];
  for (const room of postRooms(game)) {
    const crew = crewOf(game, room.id);
    const train = isTrainRoom(room.type);
    const attr = TRAINS[room.type];
    groups.push({
      key: room.id,
      title: train ? `Entrenan · ${jobRoomName(game, room)}` : jobRoomName(game, room),
      note: train ? `${ATTR_NAMES[attr!]}.` : crewEffect(game, room),
      slots: slotsOf(room),
      task: room.id,
      people: [
        ...crew.workers.map((w) => workerMember(w, room)),
        ...crew.heroes.map((h) => heroAt(game, h, room)),
      ],
    });
    // Lo que pone cada uno (los héroes de guardia o fuera, nada).
    const gives = givesAt(room, [
      ...crew.workers.map((w) => effortOf(w, room.type)),
      ...crew.heroes.map((h) => (h.status === 'ok' && !h.guard ? HERO_WORK : 0)),
    ]);
    if (!train)
      groups.at(-1)!.people.forEach((m, i) => {
        m.gives = gives[i];
      });
  }
  groups.push({
    key: GUARD,
    title: 'De guardia',
    note: 'En la puerta: no salen de misión y dan la alarma si asaltan.',
    slots: MAX_GUARDS,
    task: GUARD,
    people: game.heroes
      .filter((h) => h.status === 'ok' && h.guard)
      .map((h) => heroMember(h, 'Héroe')),
  });
  const idle = [
    ...game.workers.filter((w) => !w.room).map((w) => workerMember(w)),
    ...game.heroes
      .filter((h) => h.status === 'ok' && !h.job && !h.guard)
      .map((h) => heroMember(h, 'Héroe')),
  ];
  groups.push({
    key: 'descansan',
    title: 'Descansan',
    note: 'Los héroes recuperan la moral; los trabajadores cobran igual.',
    people: idle,
  });
  const away = game.heroes.filter((h) => h.status === 'mision' || h.status === 'herido');
  if (away.length)
    groups.push({
      key: 'fuera',
      title: 'Fuera',
      people: away.map((h) => heroMember(h, statusLabel(h))),
    });
  return groups;
}

/** Un aviso de lo que pide atención; si es de alguien, al tocarlo se elige a esa persona. */
export interface Alert {
  text: string;
  who?: string;
}

/** Lo que pide atención: salas sin nadie, trabajadores sin tarea o fuera de su oficio, y quien pide trabajo. */
export function crewAlerts(game: GameState): Alert[] {
  const out: Alert[] = [];
  const rooms = postRooms(game).filter((r) => isJobRoom(r.type));
  for (const r of rooms) {
    const c = crewOf(game, r.id);
    if (!c.workers.length && !c.heroes.length)
      out.push({ text: `${jobRoomName(game, r)}: no trabaja nadie.` });
  }
  const free = (r: Room) => {
    const c = crewOf(game, r.id);
    return slotsOf(r) - c.workers.length - c.heroes.length;
  };
  for (const w of game.workers) {
    if (!w.room) {
      out.push({ text: `${w.name} no tiene tarea.`, who: w.id });
      continue;
    }
    const now = game.building.rooms.find((r) => r.id === w.room);
    if (!now || now.type === w.trade) continue;
    const own = rooms.find((r) => r.type === w.trade && free(r) > 0);
    if (own)
      out.push({
        text: `${w.name} rendiría más en ${jobRoomName(game, own)}: es su oficio.`,
        who: w.id,
      });
  }
  const n = game.seekers.length;
  if (n) out.push({ text: `${n} ${plural(n, 'pide', 'piden')} trabajo.` });
  return out;
}

/** Una opción del selector de tarea. */
export interface TaskOption {
  task: Task;
  label: string;
  /** Por qué no se puede (sin esto, se puede o ya la tiene). */
  why?: string;
}

/** La tarea que tiene alguien ahora. */
export function taskOf(game: GameState, who: string): Task {
  const w = game.workers.find((x) => x.id === who);
  if (w) return w.room ?? null;
  const h = game.heroes.find((x) => x.id === who);
  return h?.guard ? GUARD : (h?.job ?? null);
}

/** Puestos libres en una sala, para el selector. */
function freeText(game: GameState, room: Room): string {
  const c = crewOf(game, room.id);
  const n = slotsOf(room) - c.workers.length - c.heroes.length;
  return n > 0 ? `${n} ${plural(n, 'libre', 'libres')}` : 'llena';
}

/** Todo lo que puede hacer alguien: descansar, cada sala con puestos y (los héroes) la guardia. */
export function taskOptions(game: GameState, who: string): TaskOption[] {
  const now = taskOf(game, who);
  const hero = !game.workers.some((w) => w.id === who);
  const opt = (task: Task, label: string): TaskOption => {
    const p = task === now ? null : planTask(game, who, task);
    return { task, label, ...(p && !p.ok ? { why: p.text } : {}) };
  };
  const out = [opt(null, 'Descansa')];
  for (const r of postRooms(game)) {
    const attr = TRAINS[r.type];
    if (attr && !hero) continue;
    const name = jobRoomName(game, r);
    const label = attr ? `Entrena ${ATTR_NAMES[attr]} (${name})` : `Trabaja en ${name}`;
    out.push(opt(r.id, r.id === now ? label : `${label} · ${freeText(game, r)}`));
  }
  if (hero) {
    const guards = game.heroes.filter((h) => h.status === 'ok' && h.guard).length;
    const left = MAX_GUARDS - guards;
    out.push(
      opt(
        GUARD,
        now === GUARD
          ? 'De guardia'
          : `De guardia · ${left > 0 ? `${left} ${plural(left, 'libre', 'libres')}` : 'llena'}`,
      ),
    );
  }
  return out;
}

/** Quien puede ir a un hueco libre de un grupo (gente en casa que no está ya ahí). */
export function candidatesFor(game: GameState, task: Task): Member[] {
  const out: Member[] = [];
  for (const w of game.workers)
    if (taskOf(game, w.id) !== task && planTask(game, w.id, task).ok) {
      const room = game.building.rooms.find((r) => r.id === w.room);
      out.push({
        ...workerMember(w),
        sub: room ? `en ${jobRoomName(game, room)}` : 'descansa',
      });
    }
  for (const h of game.heroes)
    if (h.status === 'ok' && taskOf(game, h.id) !== task && planTask(game, h.id, task).ok) {
      const t = taskOf(game, h.id);
      const room = game.building.rooms.find((r) => r.id === t);
      out.push(
        heroMember(
          h,
          t === GUARD ? 'de guardia' : room ? `en ${jobRoomName(game, room)}` : 'descansa',
        ),
      );
    }
  return out;
}

/** «el salón», «la cocina»: la sala con su artículo, para frases cortas. */
const withArticle = (room: Room) =>
  `${room.type === 'salon' ? 'el' : 'la'} ${ROOMS[room.type].name.toLowerCase()}`;

/**
 * La tarea de alguien en dos o tres palabras, para chapas y la escena: «En la cocina», «Entrena
 * Fuerza», «De guardia» o «Descansa» (los de fuera, su estado: «De misión · 3 d»).
 */
export function taskLabel(game: GameState, who: string): string {
  const h = game.heroes.find((x) => x.id === who);
  if (h && h.status !== 'ok') return statusLabel(h);
  const t = taskOf(game, who);
  if (t === GUARD) return 'De guardia';
  const room = t ? game.building.rooms.find((r) => r.id === t) : undefined;
  if (!room) return 'Descansa';
  const attr = TRAINS[room.type];
  return attr ? `Entrena ${ATTR_NAMES[attr]}` : `En ${withArticle(room)}`;
}
