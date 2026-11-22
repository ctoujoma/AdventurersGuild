/**
 * Lo que la interfaz de las expediciones necesita del núcleo, ya hecho: cuántos días de ida dan
 * unas raciones y qué pinta el visor ahora (`world/expeditionStrip.ts`).
 */
import { DAY_SECONDS, DUSK, EXP_CAMP, EXP_HURT_DOWN } from '../core/balance';
import { fightRoster } from '../core/chains';
import { HEADING_FOES, HOUR, distAt } from '../core/expedition';
import type { Expedition, GameState } from '../core/model';
import type { MarchNow } from '../world/expeditionStrip';

/**
 * Días de ida que dan `rations` raciones a `n` héroes, con la regla del núcleo: siguen otro día
 * si les queda para él y para la vuelta (que tarda la mitad).
 */
export function daysOut(n: number, rations: number): number {
  let d = 0;
  let left = rations;
  while (left >= n * (1 + Math.ceil((d + 1) / 2))) {
    left -= n;
    d++;
  }
  return d;
}

/** Hora del día (0–23) en la hora `h` de la expedición. */
export const hourOfDay = (e: Expedition, h = e.hours) =>
  Math.floor(((e.from + h * HOUR) % DAY_SECONDS) / HOUR);

/** Lo que pinta el visor ahora. */
export function marchNow(s: GameState, e: Expedition): MarchNow {
  const heroes = e.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const crew = fightRoster(heroes);
  for (const c of crew) if ((e.hurt[c.id] ?? 0) > 0) c.fate = 'herido';
  const last = e.log.at(-1);
  const recent = last && e.hours - last.h <= 1 ? last : undefined;
  const fightLine = [...e.log].reverse().find((l) => l.k === 'pelea');
  const hod = hourOfDay(e);
  const clock = s.clock ?? 0;
  const foes = HEADING_FOES[e.heading] ?? ['bestia'];
  return {
    seed: e.seed,
    terrain:
      e.heading === 'bosque'
        ? 'bosque'
        : e.heading === 'sierra'
          ? 'monte'
          : e.heading === 'marismas'
            ? 'pantano'
            : 'ruina',
    crew,
    mode:
      recent?.k === 'pelea' && e.hours === recent.h
        ? 'fight'
        : hod >= EXP_CAMP || hod < 5
          ? 'camp'
          : 'walk',
    night: clock >= DUSK * DAY_SECONDS || clock < 0.04 * DAY_SECONDS,
    home: !!e.turn,
    foe: foes[fightLine?.foe ?? 0] ?? 'bestia',
    wild: Math.min(1, distAt(e) / 8),
    last: recent?.k,
  };
}

/** Quién está en el suelo. */
export const isDown = (e: Expedition, id: string) => (e.hurt[id] ?? 0) >= EXP_HURT_DOWN;
