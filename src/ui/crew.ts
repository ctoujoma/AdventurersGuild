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
  SERVE_PER_WORK,
} from '../core/balance';
import { dayPart } from '../core/game';
import { isWorkshop } from '../core/crafting';
import { brewAt, cookAt } from '../core/larder';
import type { GameState, Hero, Room, Worker } from '../core/model';
import { visitorsOf } from '../core/salon';
import { ATTR_NAMES, gainText, skillGain, trainState } from '../core/training';
import { crewOf, effortOf, isJobRoom, isTrainRoom, slotsOf } from '../core/workers';
import { healAt, staffing } from '../core/infirmary';
import { TRAINS } from '../data/rooms';
import { TRADES, TRADE_LIST } from '../data/workers';
import { CLASS_NAMES, statusLabel } from '../data/labels';
import { GUARD, GUARD_VAULT, planTask, type Task } from './drop';
import { guardsAt } from '../core/guards';
import { vaultOf } from '../core/vault';
import { jobRoomName } from './roomName';
import { t } from '../textos';

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
  /** Ya no aprende más en esa sala (la barra, llena, y «Al máximo»). */
  maxed?: boolean;
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
      return t('ficha.crew.hoy_se_atiende_a', { served: v.served, total: v.total });
    }
    case 'bodega':
      return t('ficha.crew.saca_jarras_al_dia', { brew_at: Math.round(brewAt(game, room)) });
    case 'cocina':
      return t('ficha.crew.hace_raciones_al_dia', { cook_at: Math.round(cookAt(game, room)) });
    case 'enfermeria':
      // La cuenta del núcleo (`core/infirmary.ts`): la mano de esta sala frente a la que pide.
      return t('ficha.crew.enf_mano', {
        pct: Math.round(staffing(game, room) * 100),
        dias: healAt(game, room),
      });
    default:
      return '';
  }
}

/** Mano con un decimal y coma: «2», «2,3». */
export const handText = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

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
  if (room.type === 'salon') return t('ficha.crew.atiende_a', { n });
  return room.type === 'cocina' ? t('ficha.crew.raciones', { n }) : t('ficha.crew.jarras', { n });
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
  sub: t('ficha.crew.mana', { oficio: TRADES[w.trade].name[w.sex], mana: w.skill }),
  hero: false,
  off: !!room && room.type !== w.trade,
  more: t('ficha.crew.cita', { cita: w.quote }),
});

const heroMember = (h: Hero, sub: string): Member => ({ id: h.id, name: h.name, sub, hero: true });

/** «Faltan unos 3 días» (o «Sube esta noche»). */
export function daysLeft(frac: number, perDay: number): string {
  const d = Math.ceil((1 - frac) / perDay - 1e-9);
  return d <= 1 ? t('ficha.crew.sube_esta_noche') : t('ficha.crew.faltan_unos_dias', { d });
}

/** Un héroe en una sala: entrenando (con su barra) o echando una mano. */
function heroAt(game: GameState, h: Hero, room: Room): Member {
  if (h.status !== 'ok') return heroMember(h, t('ficha.crew.fuera_hoy'));
  const attr = TRAINS[room.type];
  if (!attr) return heroMember(h, t('ficha.crew.heroe_echa_una_mano'));
  const st = trainState(game, h, dayPart(game));
  const m = heroMember(h, `${ATTR_NAMES[attr]} ${h.attrs[attr]}`);
  if (!st) return m;
  if (st.capped)
    return {
      ...m,
      gives: t('ficha.crew.al_maximo'),
      progress: 1,
      maxed: true,
      more: t('ficha.crew.si_se_queda_al', { por: st.by }),
    };
  const gain = gainText(skillGain(h, attr));
  return {
    ...m,
    gives: daysLeft(st.frac, st.perDay),
    progress: st.frac,
    more: gain ? t('ficha.crew.con_ese_punto', { gain }) : t('ficha.crew.ese_punto_aun_no'),
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
      title: train
        ? t('ficha.crew.entrenan', { job_room_name: jobRoomName(game, room) })
        : jobRoomName(game, room),
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
    // En la enfermería no sale nada que contar: lo que pone cada uno de la mano que hace falta.
    if (room.type === 'enfermeria') {
      const lv = 0.75 + 0.25 * room.level;
      const hands = [
        ...crew.workers.map((w) => effortOf(w, room.type) * lv),
        ...crew.heroes.map((h) => (h.status === 'ok' && !h.guard ? HERO_WORK * lv : 0)),
      ];
      groups.at(-1)!.people.forEach((m, i) => {
        if (hands[i]) m.gives = t('ficha.crew.de_mano', { hand_text: handText(hands[i]) });
      });
    }
    // En un taller, cada trabajo va al ritmo de todos juntos: la parte de cada uno (si son varios).
    if (isWorkshop(room.type)) {
      const parts = [
        ...crew.workers.map((w) => effortOf(w, room.type)),
        ...crew.heroes.map((h) => (h.status === 'ok' && !h.guard ? HERO_WORK : 0)),
      ];
      const sum = parts.reduce((a, b) => a + b, 0);
      if (parts.filter(Boolean).length > 1)
        groups.at(-1)!.people.forEach((m, i) => {
          if (parts[i])
            m.gives = t('ficha.crew.hace_el', { pct: Math.round((100 * parts[i]) / sum) });
        });
    }
  }
  groups.push({
    key: GUARD,
    title: t('ficha.crew.de_guardia'),
    note: t('ficha.crew.en_la_puerta_no'),
    slots: MAX_GUARDS,
    task: GUARD,
    people: guardsAt(game, 'puerta').map((h) => heroMember(h, t('ficha.crew.heroe'))),
  });
  if (vaultOf(game))
    groups.push({
      key: GUARD_VAULT,
      title: t('ficha.crew.de_guardia_en_la'),
      note: t('ficha.crew.patrullan_el_tesoro_se'),
      slots: MAX_GUARDS,
      task: GUARD_VAULT,
      people: guardsAt(game, 'tesoro').map((h) => heroMember(h, t('ficha.crew.heroe'))),
    });
  const idle = [
    ...game.workers.filter((w) => !w.room).map((w) => workerMember(w)),
    ...game.heroes
      .filter((h) => h.status === 'ok' && !h.job && !h.guard)
      .map((h) => heroMember(h, t('ficha.crew.heroe'))),
  ];
  groups.push({
    key: 'descansan',
    title: t('ficha.crew.descansan'),
    note: t('ficha.crew.los_heroes_recuperan_la'),
    people: idle,
  });
  const away = game.heroes.filter((h) => h.status === 'mision' || h.status === 'herido');
  if (away.length)
    groups.push({
      key: 'fuera',
      title: t('ficha.crew.fuera'),
      people: away.map((h) => heroMember(h, statusLabel(h, false, game))),
    });
  return groups;
}

/** Un aviso de lo que pide atención; si es de alguien, al tocarlo se elige a esa persona. */
export interface Alert {
  text: string;
  who?: string;
  /** La sala de la que se avisa (la que no tiene a nadie). */
  room?: string;
}

/** Lo que pide atención: salas sin nadie, trabajadores sin tarea o fuera de su oficio. */
export function crewAlerts(game: GameState): Alert[] {
  const out: Alert[] = [];
  const rooms = postRooms(game).filter((r) => isJobRoom(r.type));
  for (const r of rooms) {
    const c = crewOf(game, r.id);
    if (!c.workers.length && !c.heroes.length)
      out.push({
        text: t('ficha.crew.no_trabaja_nadie', { job_room_name: jobRoomName(game, r) }),
        room: r.id,
      });
  }
  const free = (r: Room) => {
    const c = crewOf(game, r.id);
    return slotsOf(r) - c.workers.length - c.heroes.length;
  };
  for (const w of game.workers) {
    if (!w.room) {
      out.push({ text: t('ficha.crew.no_tiene_tarea', { nombre: w.name }), who: w.id });
      continue;
    }
    const now = game.building.rooms.find((r) => r.id === w.room);
    if (!now || now.type === w.trade) continue;
    const own = rooms.find((r) => r.type === w.trade && free(r) > 0);
    if (own)
      out.push({
        text: t('ficha.crew.rendiria_mas_en_es', {
          nombre: w.name,
          job_room_name: jobRoomName(game, own),
        }),
        who: w.id,
      });
  }
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
  return h?.guard ? (h.post === 'tesoro' ? GUARD_VAULT : GUARD) : (h?.job ?? null);
}

/** Puestos libres en una sala, para el selector. */
function freeText(game: GameState, room: Room): string {
  const c = crewOf(game, room.id);
  const n = slotsOf(room) - c.workers.length - c.heroes.length;
  return t('ficha.crew.libres', { n: Math.max(0, n) });
}

/** Todo lo que puede hacer alguien: descansar, cada sala con puestos y (los héroes) la guardia. */
export function taskOptions(game: GameState, who: string): TaskOption[] {
  const now = taskOf(game, who);
  const hero = !game.workers.some((w) => w.id === who);
  const opt = (task: Task, label: string): TaskOption => {
    const p = task === now ? null : planTask(game, who, task);
    return { task, label, ...(p && !p.ok ? { why: p.text } : {}) };
  };
  // Lo que hace ahora se dice como estado («Trabaja en Salón»); lo demás, como lo que se
  // le manda («Poner a trabajar en Cocina · 1 libre»).
  const out = [
    opt(null, now === null ? t('ficha.crew.descansa') : t('ficha.crew.mandar_a_descansar')),
  ];
  const h = game.heroes.find((x) => x.id === who);
  const capped = (r: Room) => !!h && !!trainState(game, h)?.capped && h.job === r.id;
  for (const r of postRooms(game)) {
    const attr = TRAINS[r.type];
    if (attr && !hero) continue;
    const name = jobRoomName(game, r);
    out.push(
      opt(
        r.id,
        r.id === now
          ? attr
            ? t('ficha.crew.entrena', { atributo: ATTR_NAMES[attr], nombre: name, tope: capped(r) })
            : t('ficha.crew.trabaja_en', { nombre: name })
          : attr
            ? t('ficha.crew.poner_a_entrenar', {
                atributo: ATTR_NAMES[attr],
                nombre: name,
                libres: freeText(game, r),
              })
            : t('ficha.crew.poner_a_trabajar_en', { nombre: name, libres: freeText(game, r) }),
      ),
    );
  }
  if (hero) {
    const left = MAX_GUARDS - guardsAt(game, 'puerta').length;
    out.push(
      opt(
        GUARD,
        now === GUARD
          ? t('ficha.crew.de_guardia')
          : t('ficha.crew.poner_de_guardia', {
              libres: t('ficha.crew.libres', { n: Math.max(0, left) }),
            }),
      ),
    );
    if (vaultOf(game)) {
      const n = MAX_GUARDS - guardsAt(game, 'tesoro').length;
      out.push(
        opt(
          GUARD_VAULT,
          now === GUARD_VAULT
            ? t('ficha.crew.de_guardia_en_la')
            : t('ficha.crew.poner_de_guardia_en', {
                libres: t('ficha.crew.libres', { n: Math.max(0, n) }),
              }),
        ),
      );
    }
  }
  return out;
}

/** Quien puede ir a un hueco libre de un grupo (gente en casa que no está ya ahí). */
export function candidatesFor(game: GameState, task: Task): Member[] {
  const out: Member[] = [];
  for (const w of game.workers)
    if (taskOf(game, w.id) !== task && planTask(game, w.id, task).ok) {
      const room = game.building.rooms.find((r) => r.id === w.room);
      // Su oficio y dónde está ahora, para elegir bien.
      out.push({
        ...workerMember(w),
        sub: t('ficha.crew.oficio_y_tarea', {
          oficio: TRADES[w.trade].name[w.sex],
          tarea: room
            ? t('ficha.crew.en_sala', { sala: jobRoomName(game, room) })
            : t('ficha.crew.descansa_min'),
        }),
      });
    }
  for (const h of game.heroes)
    if (h.status === 'ok' && taskOf(game, h.id) !== task && planTask(game, h.id, task).ok) {
      const cur = taskOf(game, h.id);
      const room = game.building.rooms.find((r) => r.id === cur);
      const where =
        cur === GUARD
          ? t('ficha.crew.de_guardia_2')
          : cur === GUARD_VAULT
            ? t('ficha.crew.de_guardia_en_la_2')
            : room
              ? t('ficha.crew.en_sala', { sala: jobRoomName(game, room) })
              : t('ficha.crew.descansa_min');
      // La clase y el nivel, que deciden en qué rinde (entrenar, cocinar…).
      out.push(
        heroMember(
          h,
          t('ficha.crew.clase_nivel_tarea', {
            clase: CLASS_NAMES[h.cls][h.sex],
            nivel: h.lvl,
            tarea: where,
          }),
        ),
      );
    }
  return out;
}

/**
 * La tarea de alguien en dos o tres palabras, para chapas y la escena: «En la cocina», «Entrena
 * Fuerza», «De guardia» o «Descansa» (los de fuera, su estado: «De misión · 3 d»).
 */
export function taskLabel(game: GameState, who: string): string {
  const h = game.heroes.find((x) => x.id === who);
  if (h && h.status !== 'ok') return statusLabel(h, false, game);
  const cur = taskOf(game, who);
  if (cur === GUARD) return t('ficha.crew.de_guardia');
  if (cur === GUARD_VAULT) return t('ficha.crew.guarda_la_camara');
  const room = cur ? game.building.rooms.find((r) => r.id === cur) : undefined;
  if (!room) return t('ficha.crew.descansa');
  const attr = TRAINS[room.type];
  return attr
    ? t('ficha.crew.entrena_2', { atributo: ATTR_NAMES[attr] })
    : t('ficha.crew.en_la_sala', { sala: t(`salas.con_articulo.${room.type}`) });
}
