/**
 * La enfermería (decidido con el usuario, 24 de noviembre): el ancho da catres y el nivel, lo que
 * se cura cada noche en ellos, pero solo con quien trabaje: la mano de cada una (la maña de los
 * trabajadores, los héroes que echan una mano y, más, los clérigos) decide cuánto de eso se cura;
 * sin nadie, un catre cura como una cama. Puede haber varias.
 *
 * Los catres (26 de noviembre): quien entra en uno (`Hero.cot`) se queda en cama (`status:
 * 'herido'`, sin puesto ni guardia) hasta tener la vida entera, aunque esté leve o casi sano; así no
 * se rota. Los catres libres se llenan solos con los heridos de casa, el de menos vida primero; si
 * no queda ninguno y llega un grave, deja su sitio el que esté mejor (si no es grave también). A
 * mano (la ficha de la enfermería) se cambia a quién se cura en cada uno o se le da el alta. A quien
 * se le da el alta (`cotOff`) no se le vuelve a acostar solo hasta que se cure o le vuelvan a herir.
 */
import {
  CLERIC_NURSE,
  COTS_EXTRA,
  HEAL_IN_BED,
  HERO_WORK,
  HP_GRAVE,
  HP_LIGHT,
  NURSE_FULL,
  NURSE_MAX,
  healRate,
} from './balance';
import type { GameState, Hero, Room } from './model';
import { active } from './rooms';
import { workAt } from './workers';
import { atHome, hpOf, regenPerDay } from './health';
import { t } from '../textos';

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

/** Quién está en qué enfermería (héroe → sala): los que están en un catre. */
export function infirmaryPlan(s: GameState): Map<string, string> {
  const plan = new Map<string, string>();
  for (const h of s.heroes) if (h.status === 'herido' && h.cot) plan.set(h.id, h.cot);
  return plan;
}

/** Los que están en los catres de una sala, del de menos vida al de más. */
export const cotsOf = (s: GameState, roomId: string) =>
  s.heroes
    .filter((h) => h.status === 'herido' && h.cot === roomId)
    .sort((a, b) => hpOf(a) - hpOf(b) || a.id.localeCompare(b.id));

/** Puede ir a un catre: está en casa, le falta vida y no está ya en uno. */
export const wantsCot = (h: Hero) => atHome(h) && hpOf(h) < 1 && !(h.status === 'herido' && h.cot);

/** Lo acuesta en un catre: deja su puesto y la guardia, para volver a ellos al curarse. Muta. */
export function lieIn(h: Hero, roomId: string): void {
  // La vida, fija antes de poner `days` a 0 (las partidas de antes la sacan de los días).
  h.hp = hpOf(h);
  if (h.status === 'ok') {
    if (h.job) h.jobBefore = h.job;
    if (h.guard) h.guardBefore = true;
  }
  delete h.job;
  delete h.guard;
  delete h.walk;
  delete h.since;
  delete h.cotOff;
  h.status = 'herido';
  h.days = 0;
  h.cot = roomId;
}

/**
 * Lo saca de su catre: con el 20 % o más se levanta (y `up` lo devuelve a su puesto); si no, sigue
 * en cama, en la suya. `off`: el alta a mano (no se le vuelve a acostar solo). Muta.
 */
export function leaveCot(h: Hero, up: (h: Hero) => void, off = false): void {
  delete h.cot;
  if (off && hpOf(h) < 1) h.cotOff = true;
  if (h.status !== 'herido' || hpOf(h) < HP_GRAVE) return;
  h.status = 'ok';
  h.days = 0;
  up(h);
}

/**
 * Pone en orden los catres: saca a quien ya no puede estar (la sala se cerró o encogió: se
 * levantan los que más vida tienen) y llena los libres con los heridos de casa, el de menos vida
 * primero. Devuelve si ha cambiado algo. Muta.
 */
export function admit(s: GameState, up: (h: Hero) => void): boolean {
  let changed = false;
  const rooms = infirmaries(s);
  const cap = new Map(rooms.map((r) => [r.id, cotsIn(r)]));
  for (const h of s.heroes) {
    if (h.cotOff && (hpOf(h) >= 1 || !atHome(h))) delete h.cotOff;
    if (h.cot && (h.status !== 'herido' || !cap.has(h.cot))) {
      leaveCot(h, up);
      changed = true;
    }
  }
  const used = new Map<string, number>();
  for (const r of rooms) {
    const here = cotsOf(s, r.id);
    for (const h of here.slice(cap.get(r.id)!)) {
      leaveCot(h, up);
      changed = true;
    }
    used.set(r.id, Math.min(here.length, cap.get(r.id)!));
  }
  const waiting = s.heroes
    .filter((h) => wantsCot(h) && !h.cotOff)
    .sort((a, b) => hpOf(a) - hpOf(b) || a.id.localeCompare(b.id));
  for (const h of waiting) {
    const r = rooms.find((x) => used.get(x.id)! < cap.get(x.id)!);
    if (r) {
      lieIn(h, r.id);
      used.set(r.id, used.get(r.id)! + 1);
      changed = true;
      continue;
    }
    // Sin catre libre, un grave pasa delante: deja su sitio el que esté mejor (si no es grave).
    if (hpOf(h) >= HP_GRAVE) continue;
    const best = s.heroes
      .filter((x) => x.status === 'herido' && x.cot && cap.has(x.cot) && hpOf(x) >= HP_GRAVE)
      .sort((a, b) => hpOf(b) - hpOf(a) || a.id.localeCompare(b.id))[0];
    if (!best) continue;
    const at = best.cot!;
    leaveCot(best, up);
    lieIn(h, at);
    changed = true;
  }
  return changed;
}

/** Por qué no se puede poner a alguien en un catre de esta sala (null: se puede). */
export function cotIssue(s: GameState, who: string, roomId: string): string | null {
  const h = s.heroes.find((x) => x.id === who);
  if (!h || !atHome(h)) return t('enfermeria.fuera');
  if (hpOf(h) >= 1) return t('enfermeria.sano', { sexo: h.sex });
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r || r.type !== 'enfermeria' || cotsIn(r) <= 0) return t('enfermeria.cerrada');
  if (h.cot === roomId && h.status === 'herido') return t('enfermeria.ya', { sexo: h.sex });
  return null;
}

/** Días que se le curan esta noche a un herido (en su catre o, si no tiene, en su cama). */
export function healOf(s: GameState, h: Hero, plan = infirmaryPlan(s)): number {
  const id = plan.get(h.id);
  const r = id && s.building.rooms.find((x) => x.id === id);
  return r ? healAt(s, r) : HEAL_IN_BED;
}

/**
 * Horas de juego (el día, 24) que le faltan, a su ritmo de ahora: en un catre, para la vida entera;
 * al grave en su cama, para levantarse (el 20 %); al leve, para estar sano (el 50 %). 0 si ya lo
 * está.
 */
export function restHours(s: GameState, h: Hero, plan = infirmaryPlan(s)): number {
  const goal = plan.has(h.id) ? 1 : h.status === 'herido' ? HP_GRAVE : HP_LIGHT;
  const gap = goal - hpOf(h);
  if (gap <= 0) return 0;
  return Math.max(1, Math.ceil((gap / regenPerDay(healOf(s, h, plan))) * 24 - 1e-9));
}
