/**
 * Sucesos nocturnos (fase 7, «La noche»): la pieza común. Cada suceso dice cuándo puede pasar
 * (`when`), cada cuánto como poco (`every`) y qué pasa al llegar (`start`). Cada noche se tira una
 * sola vez y pasa uno como mucho: con el juego abierto, a la hora `NIGHT_ROLL`; con el juego
 * cerrado (o si se pasa el día antes), al pasar el día. La noche del asalto no pasa nada.
 *
 * Cuántos (N2): los que tienen `chance` (el forastero) se tiran antes, cada uno con la suya. Para
 * el resto, una tirada «¿pasa algo esta noche?» (`NIGHT_ODDS`, más con niebla o tormenta) y, si
 * sale, se elige uno de los posibles por su peso (`weight`, 1 si no lo dice).
 */
import { DAY_SECONDS, NIGHT_ODDS, NIGHT_ODDS_ROUGH, NIGHT_ROLL } from './balance';
import { MESSENGER_EVENT } from './messenger';
import type { DawnEvent, GameState, NightLog } from './model';
import { Rng } from './rng';
import { roughNight } from './sky';
import { STRANGER_EVENT } from './stranger';
import { THIEF_EVENT } from './thief';
import { tutorialOn } from './tutorial';

export interface NightEvent {
  id: string;
  /** Si puede pasar esta noche (sin contar la probabilidad ni el `every`). */
  when: (s: GameState) => boolean;
  /** Se tira aparte, antes que los demás, con esta probabilidad (el forastero). */
  chance?: (s: GameState) => number;
  /** Peso al elegir entre los demás cuando «pasa algo» (1 si no lo dice). */
  weight?: (s: GameState) => number;
  /** Días que han de pasar, como poco, desde la última vez. */
  every: number;
  /** Lo que pasa: muta `s` (ya copiado) y devuelve el aviso, si lo hay. */
  start: (s: GameState, rng: Rng) => DawnEvent | null;
}

/** Por orden: los que se tiran aparte, el de arriba primero. */
export const NIGHT_EVENTS: readonly NightEvent[] = [STRANGER_EVENT, THIEF_EVENT, MESSENGER_EVENT];

export const nightLog = (s: GameState): NightLog => s.nights ?? { rolled: 0, last: {} };

/** Si un suceso podría pasar esta noche (condición y tiempo desde la última vez). */
export function canHappen(s: GameState, e: NightEvent): boolean {
  const last = nightLog(s).last[e.id];
  return (last === undefined || s.day - last >= e.every) && e.when(s);
}

/**
 * La tirada de cada noche, con su propia semilla (la partida y el día): así no mueve el azar del
 * resto del juego (lo que pase en la taberna no cambia por tirar la noche) y es la misma con el
 * juego abierto o cerrado.
 */
export const nightRng = (s: GameState) => new Rng(`noche:${s.seed}:${s.day}`);

/** Si esta noche hay asalto (se juega la noche de antes de `raid.day`). */
export const raidTonight = (s: GameState) => !!s.raid && s.raid.day <= s.day + 1;

/** Probabilidad de que pase algo esta noche (aparte de los que se tiran solos). */
export const nightOdds = (s: GameState) =>
  roughNight(s.seed, s.day) ? NIGHT_ODDS_ROUGH : NIGHT_ODDS;

/** Elige uno por su peso. */
function pickWeighted(s: GameState, list: NightEvent[], rng: Rng): NightEvent | null {
  const w = list.map((e) => Math.max(0, e.weight?.(s) ?? 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (let i = 0; i < list.length; i++) if ((r -= w[i]!) < 0) return list[i]!;
  return list.at(-1)!;
}

/**
 * Tira la noche de hoy, si no se ha tirado ya. Muta `s` (ya copiado). Devuelve el aviso del
 * suceso que pase (o nada).
 */
export function rollNight(s: GameState, rng: Rng): DawnEvent[] {
  const log = nightLog(s);
  if (log.rolled >= s.day || s.over || tutorialOn(s)) return [];
  s.nights = { rolled: s.day, last: { ...log.last } };
  if (raidTonight(s)) return [];
  const happen = (e: NightEvent) => {
    s.nights!.last[e.id] = s.day;
    const said = e.start(s, rng);
    return said ? [said] : [];
  };
  for (const e of NIGHT_EVENTS)
    if (e.chance && canHappen(s, e) && rng.chance(e.chance(s))) return happen(e);
  if (!rng.chance(nightOdds(s))) return [];
  const e = pickWeighted(
    s,
    NIGHT_EVENTS.filter((x) => !x.chance && canHappen(s, x)),
    rng,
  );
  return e ? happen(e) : [];
}

/** Si el reloj ha pasado de `from` a `to` por la hora del suceso de la noche. */
export const nightDue = (s: GameState, from: number, to: number) =>
  from < NIGHT_ROLL * DAY_SECONDS && to >= NIGHT_ROLL * DAY_SECONDS && nightLog(s).rolled < s.day;
