/**
 * El gato cazador (suceso nocturno de ambiente, ver `night.ts`): Bigotes deja el fuego del salón
 * y persigue ratas por la despensa o la bodega de su planta. Solo se mira. Al amanecer, una
 * línea menuda: se salvan unas raciones (las ratas de día siguen viniendo como siempre).
 */
import { CAT_NIGHT_EVERY, CAT_NIGHT_FOOD } from './balance';
import { catHunts } from './incidents';
import type { DawnEvent, GameState, Room } from './model';
import type { NightEvent } from './night';
import { raidTonight } from './raids';
import { active } from './rooms';
import { msg } from '../textos';

/** Las salas donde puede cazar de noche: despensa (antes) o bodega en uso, en la planta del salón. */
export function huntRooms(s: GameState): Room[] {
  return s.building.rooms
    .filter(
      (r) =>
        (r.type === 'despensa' || r.type === 'bodega') &&
        active(r).level > 0 &&
        catHunts(s.building, r.id),
    )
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'despensa' ? -1 : 1));
}

/** La caza de esta noche (la de hoy), si la hay. */
export const nightCatNow = (s: GameState) =>
  s.nightCat && s.nightCat.day === s.day ? s.nightCat : null;

export const NIGHT_CAT_EVENT: NightEvent = {
  id: 'gato',
  weight: 1,
  when: (s) => !raidTonight(s) && huntRooms(s).length > 0,
  every: CAT_NIGHT_EVERY,
  start: (s, rng) => {
    s.nightCat = { day: s.day, room: huntRooms(s)[0]!.id, n: rng.int(2, 4) };
    return null;
  },
  dawn: (s) => settleNightCat(s),
};

/** Al amanecer: lo que ha cazado. Muta `s` (ya copiado). */
export function settleNightCat(s: GameState): DawnEvent | null {
  const c = s.nightCat;
  if (!c) return null;
  s.nightCat = null;
  if (c.day < s.day) return null;
  const room = s.building.rooms.find((r) => r.id === c.room);
  s.food += CAT_NIGHT_FOOD;
  return {
    t: msg('gato.caza', { n: c.n, bodega: room?.type === 'bodega', raciones: CAT_NIGHT_FOOD }),
  };
}
