/**
 * La enfermería (decidido con el usuario, 24 de noviembre): el ancho da catres y el nivel, lo que
 * se cura cada noche en ellos, pero solo con quien trabaje: la mano de cada una (la maña de los
 * trabajadores, los héroes que echan una mano y, más, los clérigos) decide cuánto de eso se cura;
 * sin nadie, un catre cura como una cama. Puede haber varias: los
 * heridos más graves van a los catres de la que mejor cura; los que no caben se curan más despacio,
 * en su cama.
 */
import {
  CLERIC_NURSE,
  COTS_EXTRA,
  HEAL_IN_BED,
  HERO_WORK,
  NURSE_FULL,
  NURSE_MAX,
  healRate,
} from './balance';
import type { GameState, Hero, Room } from './model';
import { active } from './rooms';
import { workAt } from './workers';

/** Catres de una enfermería: uno por hueco de ancho y uno más (ninguno si no está en uso). */
export function cotsIn(r: Room): number {
  const { level, cells } = active(r);
  return level > 0 ? cells + COTS_EXTRA : 0;
}

/** La mano de hoy en una enfermería: la de siempre y lo de más de los clérigos. */
export function nurseWork(s: GameState, r: Room): number {
  const clerics = s.heroes.filter(
    (h) => h.job === r.id && h.cls === 'clerigo' && h.status === 'ok' && !h.guard,
  ).length;
  return workAt(s, r) + clerics * HERO_WORK * (CLERIC_NURSE - 1) * (0.75 + 0.25 * r.level);
}

/** Qué parte de la mano que pide tiene hoy (0 sin nadie; 1, a pleno). */
export function staffing(s: GameState, r: Room): number {
  const need = NURSE_FULL * Math.max(1, active(r).cells);
  return Math.min(1, nurseWork(s, r) / need);
}

/**
 * Lo que se cura cada noche en un catre de esta enfermería: como en una cama sin nadie, y lo del
 * nivel y la mano en proporción a quien trabaja (en días enteros, al menos uno).
 */
export const healAt = (s: GameState, r: Room) =>
  Math.max(
    HEAL_IN_BED,
    Math.round(HEAL_IN_BED + (healRate(active(r).level) - 1 + NURSE_MAX) * staffing(s, r)),
  );

/** Las enfermerías en uso, de la que mejor cura a la que peor. */
export const infirmaries = (s: GameState) =>
  s.building.rooms
    .filter((r) => r.type === 'enfermeria' && cotsIn(r) > 0)
    .sort((a, b) => healAt(s, b) - healAt(s, a) || a.id.localeCompare(b.id));

/**
 * Quién está en qué enfermería: los heridos con más días por delante, primero, en los catres de
 * la que mejor cura. Los que no caben no están (se curan en su cama).
 */
export function infirmaryPlan(s: GameState): Map<string, string> {
  const plan = new Map<string, string>();
  const hurt = s.heroes
    .filter((h) => h.status === 'herido')
    .sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
  let i = 0;
  for (const r of infirmaries(s)) {
    for (let n = cotsIn(r); n > 0 && i < hurt.length; n--) plan.set(hurt[i++]!.id, r.id);
  }
  return plan;
}

/** Días que se le curan esta noche a un herido (en su catre o, si no tiene, en su cama). */
export function healOf(s: GameState, h: Hero, plan = infirmaryPlan(s)): number {
  const id = plan.get(h.id);
  const r = id && s.building.rooms.find((x) => x.id === id);
  return r ? healAt(s, r) : HEAL_IN_BED;
}
