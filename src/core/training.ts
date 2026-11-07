/**
 * Entrenamiento: los héroes que se quedan en casa entrenan un atributo en la sala de armas
 * (Fuerza), la galería de tiro (Destreza) o la biblioteca (Mente). Cada día suma progreso según
 * el nivel de la sala; al completarlo sube un punto, hasta el tope: el menor entre el de la sala
 * y el del héroe (`TRAIN_HERO_BASE` + `TRAIN_PER_LEVEL` por nivel). Las habilidades suben solas, según lo que pese
 * ese atributo en la clase.
 */
import { TRAINS } from '../data/rooms';
import {
  TRAIN_CAP,
  TRAIN_COST_BASE,
  TRAIN_HERO_BASE,
  TRAIN_PER_LEVEL,
  TRAIN_RATE,
} from './balance';
import type { DawnEvent, GameState, Hero, Room } from './model';
import { SKILLS, skill, type AttrId, type SkillId } from './party';
import { active } from './rooms';
import { shiftShare, shiftStart, slotsOf } from './workers';

export const ATTR_NAMES: Record<AttrId, string> = { F: 'Fuerza', D: 'Destreza', M: 'Mente' };

/** Hasta dónde llega el atributo entrenando en esta sala. */
export const trainCap = (r: Room) => TRAIN_CAP[active(r).level] ?? TRAIN_CAP[TRAIN_CAP.length - 1];

/** Hasta dónde llega entrenando este héroe, por su nivel (sube dos con cada nivel). */
export const heroCap = (h: Pick<Hero, 'lvl'>) => TRAIN_HERO_BASE + TRAIN_PER_LEVEL * h.lvl;

/** El tope de verdad para un héroe en una sala, y quién lo pone (la sala o su nivel). */
export function capFor(h: Pick<Hero, 'lvl'>, r: Room): { cap: number; by: 'sala' | 'nivel' } {
  const room = trainCap(r);
  const hero = heroCap(h);
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
  // Cuenta la parte del día que lleva en la sala (quien llegó tarde, o aún va, menos).
  const here = Math.max(0, part - shiftStart(h));
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

/** La noche de quien entrena: suma el progreso del día y, si lo completa, sube un punto. */
export function stepTraining(s: GameState, events: DawnEvent[]): void {
  for (const h of s.heroes) {
    const t = trainingOf(s, h);
    if (!t) continue;
    const { cap, by } = capFor(h, t.room);
    if (h.attrs[t.attr] >= cap) continue;
    const train = (h.train ??= {});
    // Solo la parte del día que ha estado allí (si llegó a media jornada, menos).
    let p = (train[t.attr] ?? 0) + trainRate(t.room) * shiftShare(h);
    while (p >= trainCost(h, t.attr) && h.attrs[t.attr] < cap) {
      p -= trainCost(h, t.attr);
      const gain = gainText(skillGain(h, t.attr));
      h.attrs[t.attr]++;
      h.history.push(`Día ${s.day - 1} · Entrenando: ${ATTR_NAMES[t.attr]} ${h.attrs[t.attr]}`);
      const top = h.attrs[t.attr] >= cap;
      events.push({
        t: `${h.name} ha entrenado: ${ATTR_NAMES[t.attr]} ${h.attrs[t.attr]}${gain ? ` (${gain})` : ''}.${top ? ` ${capHint(by)}` : ''}`,
        k: 'good',
      });
    }
    train[t.attr] = h.attrs[t.attr] >= cap ? 0 : p;
  }
}
