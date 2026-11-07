/**
 * Entrenamiento: los héroes que se quedan en casa entrenan un atributo en la sala de armas
 * (Fuerza), la galería de tiro (Destreza) o la biblioteca (Mente). Cada día suma progreso según
 * el nivel de la sala; al completarlo sube un punto, hasta el tope: el menor entre el de la sala
 * y el del héroe (`TRAIN_HERO_BASE` + `TRAIN_PER_LEVEL` por nivel, y `TRAIN_MAIN_BONUS` más en el
 * atributo principal de su clase). Las habilidades suben solas, según lo que pese ese atributo en
 * la clase.
 */
import { ROOMS, TRAINS } from '../data/rooms';
import {
  TRAIN_CAP,
  TRAIN_COST_BASE,
  TRAIN_HERO_BASE,
  TRAIN_MAIN_BONUS,
  TRAIN_PER_LEVEL,
  TRAIN_RATE,
} from './balance';
import { MAIN_ATTR } from './resolve';
import type { DawnEvent, GameState, Hero, Room } from './model';
import { SKILLS, skill, type AttrId, type SkillId } from './party';
import { active } from './rooms';
import { assign, shiftShare, shiftStart, slotsOf, workedIn } from './workers';
import { bump } from './feats';

export const ATTR_NAMES: Record<AttrId, string> = { F: 'Fuerza', D: 'Destreza', M: 'Mente' };

/** Hasta dónde llega el atributo entrenando en esta sala. */
export const trainCap = (r: Room) => TRAIN_CAP[active(r).level] ?? TRAIN_CAP[TRAIN_CAP.length - 1];

/**
 * Hasta dónde llega entrenando este héroe un atributo: por su nivel (dos más con cada nivel) y,
 * en el principal de su clase, `TRAIN_MAIN_BONUS` más.
 */
export const heroCap = (h: Pick<Hero, 'lvl' | 'cls'>, a: AttrId) =>
  TRAIN_HERO_BASE + TRAIN_PER_LEVEL * h.lvl + (MAIN_ATTR[h.cls] === a ? TRAIN_MAIN_BONUS : 0);

/** El tope de verdad para un héroe en una sala, y quién lo pone (la sala o su nivel). */
export function capFor(
  h: Pick<Hero, 'lvl' | 'cls'>,
  r: Room,
): { cap: number; by: 'sala' | 'nivel' } {
  const room = trainCap(r);
  const attr = TRAINS[r.type];
  const hero = attr ? heroCap(h, attr) : room;
  return hero < room ? { cap: hero, by: 'nivel' } : { cap: room, by: 'sala' };
}

/** Qué hace falta para seguir subiendo cuando se llega al tope. */
export const capHint = (by: 'sala' | 'nivel') =>
  by === 'sala'
    ? 'Para seguir, hay que mejorar la sala.'
    : 'Para seguir, tiene que subir de nivel.';

/** Progreso que da un día en esta sala. */
export const trainRate = (r: Room) => TRAIN_RATE * (0.75 + 0.25 * active(r).level);

/** Progreso que cuesta el siguiente punto: más cuanto más alto está ya. */
export const trainCost = (h: Hero, a: AttrId) => TRAIN_COST_BASE + h.attrs[a];

/** Dónde entrena hoy un héroe y qué atributo, si entrena (en casa, sin guardia y en una sala en uso). */
export function trainingOf(s: GameState, h: Hero): { room: Room; attr: AttrId } | null {
  if (!h.job || h.status !== 'ok' || h.guard) return null;
  const room = s.building.rooms.find((r) => r.id === h.job);
  const attr = room ? TRAINS[room.type] : undefined;
  return room && attr && slotsOf(room) > 0 ? { room, attr } : null;
}

export interface TrainState {
  attr: AttrId;
  value: number;
  cap: number;
  /** Lo que lleva hacia el siguiente punto (0–1), contando la parte del día que ya ha pasado. */
  frac: number;
  /** Lo que avanza la barra en un día entero. */
  perDay: number;
  /** Ya está en el tope: hace falta mejorar la sala o que suba de nivel (`by`). */
  capped: boolean;
  by: 'sala' | 'nivel';
}

/** Cómo va el entrenamiento de un héroe; `part` es la parte del día que ya ha pasado. */
export function trainState(s: GameState, h: Hero, part = 0): TrainState | null {
  const t = trainingOf(s, h);
  if (!t) return null;
  const value = h.attrs[t.attr];
  const { cap, by } = capFor(h, t.room);
  const cost = trainCost(h, t.attr);
  const capped = value >= cap;
  const perDay = capped ? 0 : trainRate(t.room) / cost;
  // Cuenta la parte de la jornada que lleva en la sala (quien llegó tarde, o aún va, menos).
  const here = workedIn(shiftStart(h), part);
  const frac = capped ? 0 : Math.min(1, (h.train?.[t.attr] ?? 0) / cost + perDay * here);
  return { attr: t.attr, value, cap, frac, perDay, capped, by };
}

/** Lo que gana cada habilidad con un punto más del atributo (según la clase). */
export function skillGain(h: Hero, a: AttrId): Partial<Record<SkillId, number>> {
  const up = { ...h, attrs: { ...h.attrs, [a]: h.attrs[a] + 1 } };
  const out: Partial<Record<SkillId, number>> = {};
  for (const k of SKILLS) {
    const d = skill(up, k, true) - skill(h, k, true);
    if (d > 0) out[k] = d;
  }
  return out;
}

/** «Combate +1, Supervivencia +1» (o nada si con este punto aún no se nota). */
export const gainText = (g: Partial<Record<SkillId, number>>) =>
  (Object.entries(g) as [SkillId, number][]).map(([k, n]) => `${k} +${n}`).join(', ');

/** Quien sigue en una sala de entrenamiento sin poder subir más (para avisar en directo). */
export function cappedTrainees(
  s: GameState,
): { hero: Hero; room: Room; attr: AttrId; by: 'sala' | 'nivel' }[] {
  const out: { hero: Hero; room: Room; attr: AttrId; by: 'sala' | 'nivel' }[] = [];
  for (const h of s.heroes) {
    const t = trainingOf(s, h);
    if (!t) continue;
    const { cap, by } = capFor(h, t.room);
    if (h.attrs[t.attr] >= cap) out.push({ hero: h, room: t.room, attr: t.attr, by });
  }
  return out;
}

/** «Bruna deja la sala de armas: ya no aprende más Fuerza ahí. Para seguir, …» */
export const capLeaveText = (h: Hero, r: Room, a: AttrId, by: 'sala' | 'nivel') =>
  `${h.name} deja la ${ROOMS[r.type].name.toLowerCase()}: ya no aprende más ${ATTR_NAMES[a]} ahí. ${capHint(by)}`;

/**
 * La noche de quien entrena: suma el progreso del día y, si lo completa, sube un punto. Quien
 * llega al tope (o ya estaba en él) deja la sala y se va a descansar, con un aviso.
 */
export function stepTraining(s: GameState, events: DawnEvent[]): void {
  for (const h of s.heroes) {
    const t = trainingOf(s, h);
    if (!t) continue;
    const { cap, by } = capFor(h, t.room);
    if (h.attrs[t.attr] >= cap) {
      assign(s, h.id, null);
      events.push({ t: capLeaveText(h, t.room, t.attr, by), k: 'warn' });
      continue;
    }
    const train = (h.train ??= {});
    // Solo la parte del día que ha estado allí (si llegó a media jornada, menos).
    let p = (train[t.attr] ?? 0) + trainRate(t.room) * shiftShare(h);
    while (p >= trainCost(h, t.attr) && h.attrs[t.attr] < cap) {
      p -= trainCost(h, t.attr);
      const gain = gainText(skillGain(h, t.attr));
      h.attrs[t.attr]++;
      bump(s, 'trained');
      h.history.push(`Día ${s.day - 1} · Entrenando: ${ATTR_NAMES[t.attr]} ${h.attrs[t.attr]}`);
      events.push({
        t: `${h.name} ha entrenado: ${ATTR_NAMES[t.attr]} ${h.attrs[t.attr]}${gain ? ` (${gain})` : ''}.`,
        k: 'good',
      });
    }
    train[t.attr] = h.attrs[t.attr] >= cap ? 0 : p;
    if (h.attrs[t.attr] >= cap) {
      assign(s, h.id, null);
      events.push({ t: capLeaveText(h, t.room, t.attr, by), k: 'warn' });
    }
  }
}
