/**
 * Recoger (decidido con el usuario, 27 de noviembre): lo que da la taberna durante el día espera
 * flotando sobre su sala hasta que se toca, para que se sienta que entra.
 *
 * - La caja del salón: lo que entregan los visitantes se junta en una bolsa sobre la barra.
 * - La cocina y la bodega: sus raciones y jarras, a medida que avanza la jornada.
 * - Si no se recoge a mano, se recoge todo solo al anochecer (`DUSK`, al irse a dormir); con el
 *   juego cerrado, igual (pasa por ahí).
 * - Lo de los talleres no se recoge solo: espera en su puesto (`core/crafting.ts`).
 */
import { DUSK } from './balance';
import { yieldsOf } from './larder';
import type { GameState } from './model';
import { earn } from './vault';
import { dayPartOf, workedIn } from './workers';

/** Lo que hay en la bolsa de la caja ahora. */
export const tillReady = (s: GameState) => Math.max(0, (s.till ?? 0) - (s.tillTaken ?? 0));

/** Recoge la bolsa de la caja (al oro, con el tope de la cámara). Devuelve cuánto. Muta `s`. */
export function takeTill(s: GameState): number {
  const n = tillReady(s);
  if (n > 0) earn(s, n);
  s.tillTaken = s.till ?? 0;
  return n;
}

/** Lo que una sala ha hecho hoy hasta ahora y aún no se ha recogido (raciones y jarras). */
export function yieldReady(s: GameState, roomId: string): { food: number; beer: number } {
  const y = yieldsOf(s).filter((x) => x.room === roomId);
  const share = workedIn(0, dayPartOf(s));
  const got = s.taken?.[roomId] ?? {};
  const made = (n: number) => Math.floor(n * share);
  const food = y.reduce((a, x) => a + made(x.food ?? 0), 0);
  const beer = y.reduce((a, x) => a + made(x.beer ?? 0), 0);
  return { food: Math.max(0, food - (got.food ?? 0)), beer: Math.max(0, beer - (got.beer ?? 0)) };
}

/** Las salas con algo que recoger ahora (sala → raciones y jarras). */
export function yieldsReady(s: GameState): { room: string; food: number; beer: number }[] {
  const rooms = new Set(yieldsOf(s).map((y) => y.room));
  return [...rooms]
    .map((room) => ({ room, ...yieldReady(s, room) }))
    .filter((x) => x.food > 0 || x.beer > 0);
}

/**
 * Recoge lo de una sala: a la despensa y la bodega (el tope se aplica por la noche, como siempre).
 * Devuelve lo recogido. Muta `s`.
 */
export function takeYield(s: GameState, roomId: string): { food: number; beer: number } {
  const n = yieldReady(s, roomId);
  if (!n.food && !n.beer) return n;
  s.food += n.food;
  s.beer += n.beer;
  const got = s.taken?.[roomId] ?? {};
  s.taken = {
    ...s.taken,
    [roomId]: { food: (got.food ?? 0) + n.food, beer: (got.beer ?? 0) + n.beer },
  };
  return n;
}

/** Al anochecer (o al pasar por él con el juego cerrado): se recoge solo lo que quede. Muta `s`. */
export function takeAll(s: GameState): void {
  takeTill(s);
  for (const y of yieldsReady(s)) takeYield(s, y.room);
}

/** Si ya es la hora de recogerlo todo solo. */
export const pastDusk = (s: GameState) => dayPartOf(s) >= DUSK;
