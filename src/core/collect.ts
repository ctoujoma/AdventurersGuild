/**
 * Recoger (decidido con el usuario, 27 de noviembre): lo que da la taberna durante el día espera
 * sobre su sala hasta que se toca, para que se sienta que entra.
 *
 * - La cocina y la bodega: lo que hacen va a su **cola** (medio día por hueco y nivel). Llena, paran
 *   hasta que se recoja, como en Fallout Shelter. Recoger lo pasa a los armarios (la despensa y la
 *   bodega, con su tope: lo que no cabe se queda en la cola). La burbuja sale con la cola al 90 %;
 *   en la ficha se puede recoger siempre.
 * - La caja del salón: las monedas de los visitantes se juntan en una bolsa, sin tope. Sale sobre
 *   el salón desde 100 monedas; en la ficha, siempre.
 * - Al anochecer la caja se recoge sola; al irse a dormir (al cerrar el día), las colas entran en
 *   los armarios después de que coman los visitantes (`nightQueues`). Con el juego cerrado, igual:
 *   lo de todo el día, sin que la cola pare.
 * - Lo de los talleres no se recoge solo: espera en su puesto (`core/crafting.ts`).
 */
import { BREW_QUEUE, COOK_QUEUE, DUSK, QUEUE_SHOW, TILL_SHOW } from './balance';
import { beerCap, brewAt, cookAt, foodCap } from './larder';
import type { GameState, Room } from './model';
import { active } from './rooms';
import { earn } from './vault';
import { dayPartOf, workedIn } from './workers';

type Kind = 'food' | 'beer';

/** Lo que hay en la bolsa de la caja ahora. */
export const tillReady = (s: GameState) => Math.max(0, (s.till ?? 0) - (s.tillTaken ?? 0));

/** Si la bolsa de la caja ya sale sobre el salón. */
export const tillShows = (s: GameState) => tillReady(s) >= TILL_SHOW;

/** Recoge la bolsa de la caja (al oro, con el tope de la cámara). Devuelve cuánto. Muta `s`. */
export function takeTill(s: GameState): number {
  const n = tillReady(s);
  if (n > 0) earn(s, n);
  s.tillTaken = s.till ?? 0;
  return n;
}

/** Lo que hace una sala en un día (raciones o jarras) y de qué. */
function makes(s: GameState, r: Room): { kind: Kind; perDay: number } | null {
  if (r.type === 'cocina') return { kind: 'food', perDay: cookAt(s, r) };
  if (r.type === 'bodega') return { kind: 'beer', perDay: brewAt(s, r) };
  return null;
}

/** Lo que cabe en la cola de una sala (0 si no hace nada o no está en uso). */
export function queueCap(r: Room): number {
  const { cells, level } = active(r);
  if (level <= 0) return 0;
  if (r.type === 'cocina') return cells * level * COOK_QUEUE;
  if (r.type === 'bodega') return cells * level * BREW_QUEUE;
  return 0;
}

/** Lo que hay en la cola de una sala (con decimales) y de qué. */
export function queueOf(s: GameState, r: Room): { kind: Kind; n: number; cap: number } | null {
  const kind: Kind | null = r.type === 'cocina' ? 'food' : r.type === 'bodega' ? 'beer' : null;
  if (!kind) return null;
  return { kind, n: s.queue?.[r.id]?.[kind] ?? 0, cap: queueCap(r) };
}

/**
 * Avanza las colas hasta la parte del día `part`: cada sala suma lo que hace en ese rato de la
 * jornada, sin pasar de lo que cabe (llena, para). Muta `s`.
 */
export function stepQueues(
  s: GameState,
  part: number,
  /** Por la noche: lo que no cabe en la cola no se pierde, va directo a los armarios. */
  night = false,
): void {
  const from = s.queueAt ?? 0;
  if (part <= from) return;
  const share = workedIn(from, part);
  s.queueAt = part;
  if (share <= 0) return;
  let queue = s.queue;
  for (const r of s.building.rooms) {
    const m = makes(s, r);
    if (!m || m.perDay <= 0) continue;
    const cap = queueCap(r);
    const had = queue?.[r.id]?.[m.kind] ?? 0;
    const sum = had + m.perDay * share;
    const now = night ? sum : Math.min(cap, sum);
    if (now === had) continue;
    queue = { ...queue, [r.id]: { ...queue?.[r.id], [m.kind]: now } };
  }
  if (queue) s.queue = queue;
}

/** Sitio libre en los armarios para cada cosa. */
const space = (s: GameState, kind: Kind) =>
  Math.max(0, kind === 'food' ? foodCap(s.building) - s.food : beerCap(s.building) - s.beer);

/** Lo que se recogería ahora de una sala (lo entero de su cola que quepa en los armarios). */
export function readyIn(s: GameState, r: Room): { kind: Kind; n: number; full: boolean } | null {
  const q = queueOf(s, r);
  if (!q) return null;
  const whole = Math.floor(q.n + 1e-9);
  const n = Math.min(whole, space(s, q.kind));
  return { kind: q.kind, n, full: whole > 0 && n === 0 };
}

/** Las cocinas y bodegas cuya burbuja sale ahora (cola al 90 %). */
export function queuesShowing(
  s: GameState,
): { room: string; kind: Kind; n: number; full: boolean }[] {
  const out: { room: string; kind: Kind; n: number; full: boolean }[] = [];
  for (const r of s.building.rooms) {
    const q = queueOf(s, r);
    if (!q || q.cap <= 0 || q.n < q.cap * QUEUE_SHOW) continue;
    const ready = readyIn(s, r)!;
    out.push({ room: r.id, kind: q.kind, n: ready.n, full: ready.full });
  }
  return out;
}

/**
 * Recoge la cola de una sala en los armarios (lo que quepa). Devuelve lo recogido y de qué. Muta
 * `s`.
 */
export function takeQueue(s: GameState, roomId: string): { kind: Kind; n: number } | null {
  const r = s.building.rooms.find((x) => x.id === roomId);
  const ready = r && readyIn(s, r);
  if (!r || !ready || ready.n <= 0) return null;
  if (ready.kind === 'food') s.food += ready.n;
  else s.beer += ready.n;
  const left = Math.max(0, (s.queue?.[roomId]?.[ready.kind] ?? 0) - ready.n);
  s.queue = { ...s.queue, [roomId]: { ...s.queue?.[roomId], [ready.kind]: left } };
  return { kind: ready.kind, n: ready.n };
}

/**
 * Al irse a dormir (al cerrar el día, también con el juego cerrado): lo que quede del día y todo
 * lo de las colas entra en los armarios (el tope se aplica después de cenar, como siempre). Si el
 * día no ha pasado por el reloj (juego cerrado o simulador), entra lo de todo el día. Muta `s`.
 */
export function nightQueues(s: GameState): void {
  stepQueues(s, 1, true);
  for (const [room, q] of Object.entries(s.queue ?? {})) {
    if (!s.building.rooms.some((r) => r.id === room)) continue;
    s.food += Math.floor((q.food ?? 0) + 1e-9);
    s.beer += Math.floor((q.beer ?? 0) + 1e-9);
  }
  delete s.queue;
  s.queueAt = 0;
}

/** Si ya es la hora de recogerlo todo solo. */
export const pastDusk = (s: GameState) => dayPartOf(s) >= DUSK;
