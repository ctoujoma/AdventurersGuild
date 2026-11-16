/**
 * Sucesos nocturnos (fase 7, «La noche»): la pieza común. Cada suceso dice cuándo puede pasar
 * (`when`), con qué probabilidad (`chance`), cada cuánto como poco (`every`) y qué pasa al
 * llegar (`start`). Cada noche se tira una sola vez y pasa uno como mucho (el primero de la
 * lista que salga): con el juego abierto, a la hora `NIGHT_ROLL`; con el juego cerrado (o si se
 * pasa el día antes), al pasar el día. De momento solo está el forastero de la tormenta; el
 * ladrón, el mensajero, la pesadilla y el gato (N1) entran aquí.
 */
import { DAY_SECONDS, NIGHT_ROLL } from './balance';
import type { DawnEvent, GameState, NightLog } from './model';
import type { Rng } from './rng';
import { STRANGER_EVENT } from './stranger';
import { tutorialOn } from './tutorial';

export interface NightEvent {
  id: string;
  /** Si puede pasar esta noche (sin contar la probabilidad ni el `every`). */
  when: (s: GameState) => boolean;
  /** Probabilidad de que pase, si puede. */
  chance: (s: GameState) => number;
  /** Días que han de pasar, como poco, desde la última vez. */
  every: number;
  /** Lo que pasa: muta `s` (ya copiado) y devuelve el aviso, si lo hay. */
  start: (s: GameState, rng: Rng) => DawnEvent | null;
}

/** Por orden: si pueden dos, se tira primero el de arriba. */
export const NIGHT_EVENTS: readonly NightEvent[] = [STRANGER_EVENT];

export const nightLog = (s: GameState): NightLog => s.nights ?? { rolled: 0, last: {} };

/** Si un suceso podría pasar esta noche (condición y tiempo desde la última vez). */
export function canHappen(s: GameState, e: NightEvent): boolean {
  const last = nightLog(s).last[e.id];
  return (last === undefined || s.day - last >= e.every) && e.when(s);
}

/**
 * Tira la noche de hoy, si no se ha tirado ya. Muta `s` (ya copiado). Devuelve el aviso del
 * suceso que pase (o nada).
 */
export function rollNight(s: GameState, rng: Rng): DawnEvent[] {
  const log = nightLog(s);
  if (log.rolled >= s.day || s.over || tutorialOn(s)) return [];
  s.nights = { rolled: s.day, last: { ...log.last } };
  for (const e of NIGHT_EVENTS) {
    if (!canHappen(s, e) || !rng.chance(e.chance(s))) continue;
    s.nights.last[e.id] = s.day;
    const said = e.start(s, rng);
    return said ? [said] : [];
  }
  return [];
}

/** Si el reloj ha pasado de `from` a `to` por la hora del suceso de la noche. */
export const nightDue = (s: GameState, from: number, to: number) =>
  from < NIGHT_ROLL * DAY_SECONDS && to >= NIGHT_ROLL * DAY_SECONDS && nightLog(s).rolled < s.day;
