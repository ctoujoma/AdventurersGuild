/**
 * La pesadilla (suceso nocturno, ver `night.ts`): un héroe herido o con la moral baja da vueltas
 * en la cama. Si se le toca, se le lleva un trago de la bodega (una jarra y sube su moral);
 * si no, amanece con algo menos de moral. Los de guardia no se meten: es cosa del jugador. Con
 * «Pasar la noche» se resuelve igual que sin tocar.
 */
import { NIGHTMARE_BEER, NIGHTMARE_EASE, NIGHTMARE_EVERY, NIGHTMARE_LOSS } from './balance';
import { sleepPlan } from './beds';
import type { DawnEvent, GameState, Hero } from './model';
import type { NightEvent } from './night';
import { MORALE_LOW } from './party';
import { raidTonight } from './raids';
import { active } from './rooms';

/** Si está en su cama esta noche: en el reparto de camas o, herido, en la enfermería. */
function inBed(s: GameState, h: Hero, plan: Map<string, string>): boolean {
  if (plan.has(h.id)) return true;
  return (
    h.status === 'herido' &&
    s.building.rooms.some((r) => r.type === 'enfermeria' && active(r).level > 0)
  );
}

/** Los que pueden tener la pesadilla: heridos o con la moral baja, en casa y en su cama. */
export function restless(s: GameState): Hero[] {
  const plan = sleepPlan(s);
  return s.heroes.filter(
    (h) =>
      (h.status === 'herido' || (h.status === 'ok' && !h.guard && h.morale < MORALE_LOW)) &&
      inBed(s, h, plan),
  );
}

/** La pesadilla de esta noche (la de hoy y aún en casa), si la hay. */
export function nightmareNow(
  s: GameState,
): { n: NonNullable<GameState['nightmare']>; h: Hero } | null {
  const n = s.nightmare;
  if (!n || n.day !== s.day) return null;
  const h = s.heroes.find(
    (x) => x.id === n.hero && !x.guard && (x.status === 'ok' || x.status === 'herido'),
  );
  return h ? { n, h } : null;
}

export const NIGHTMARE_EVENT: NightEvent = {
  id: 'pesadilla',
  weight: 1,
  when: (s) => !raidTonight(s) && restless(s).length > 0,
  every: NIGHTMARE_EVERY,
  start: (s, rng) => {
    s.nightmare = { day: s.day, hero: rng.pick(restless(s)).id };
    // Sin aviso: se ve en la escena (y en la campanita).
    return null;
  },
  dawn: (s) => settleNightmare(s),
};

/** Por qué no se le puede llevar el trago ahora (null: se puede). */
export function easeIssue(s: GameState): string | null {
  const now = nightmareNow(s);
  if (!now) return 'Ya duerme tranquilo.';
  if (now.n.eased) return `${now.h.name} ya se ha tomado su trago.`;
  if (s.beer < NIGHTMARE_BEER) return 'No queda cerveza en la bodega (hace falta una jarra).';
  return null;
}

/** Llevarle el trago (ya comprobado con `easeIssue`). Muta `s`; devuelve el aviso. */
export function easeNightmare(s: GameState): DawnEvent {
  const { n, h } = nightmareNow(s)!;
  s.beer -= NIGHTMARE_BEER;
  h.morale = Math.min(100, h.morale + NIGHTMARE_EASE);
  n.eased = true;
  return {
    t: `${h.name} se incorpora, se bebe el trago y se vuelve a acostar más tranquil${h.sex === 'f' ? 'a' : 'o'} (+${NIGHTMARE_EASE} de moral, −${NIGHTMARE_BEER} jarra).`,
    k: 'good',
  };
}

/** Al amanecer: cómo ha pasado la noche. Muta `s` (ya copiado). */
export function settleNightmare(s: GameState): DawnEvent | null {
  const now = nightmareNow(s);
  if (s.nightmare && s.nightmare.day <= s.day) s.nightmare = null;
  if (!now) return null;
  const { n, h } = now;
  if (n.eased) return { t: `${h.name} durmió del tirón tras el trago de anoche.`, k: 'good' };
  h.morale = Math.max(0, h.morale - NIGHTMARE_LOSS);
  return {
    t: `${h.name} pasó la noche dando vueltas en la cama, entre pesadillas: amanece con menos moral (−${NIGHTMARE_LOSS}).`,
    k: 'warn',
  };
}
