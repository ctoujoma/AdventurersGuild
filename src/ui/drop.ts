import type { Action } from '../core/game';
import type { GameState } from '../core/model';
import { ATTR_NAMES, trainCap } from '../core/training';
import { canAssign, hasPosts, isTrainRoom } from '../core/workers';
import { TRAINS } from '../data/rooms';
import { jobRoomName } from './JobPicker';

/** Lo que pasa si se suelta a alguien en una sala: lo que se hará (y cómo se dice) o por qué no. */
export type Drop = { ok: true; text: string; actions: Action[] } | { ok: false; text: string };

/** Se puede coger a quien está en casa: los trabajadores y los héroes que no han salido. */
export function canDrag(game: GameState, who: string): boolean {
  if (game.workers.some((w) => w.id === who)) return true;
  return game.heroes.some((h) => h.id === who && h.status === 'ok');
}

/**
 * Soltar a alguien en una sala, como en un refugio: a trabajar en las que producen, a entrenar
 * en las de entrenamiento, de guardia en el recibidor y a descansar en los dormitorios.
 */
export function planDrop(game: GameState, who: string, roomId: string): Drop {
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, text: 'Ahí no hay ninguna sala.' };
  const name = jobRoomName(game, room);
  const w = game.workers.find((x) => x.id === who);
  if (w) {
    if (room.type === 'servicio' || room.type === 'dormitorio') {
      if (!w.room) return { ok: false, text: `${w.name} ya está descansando.` };
      return {
        ok: true,
        text: `${w.name} deja el trabajo y descansa.`,
        actions: [{ type: 'assign', who, room: null }],
      };
    }
    if (!hasPosts(room.type)) return { ok: false, text: `En ${name} no hay trabajo.` };
    if (w.room === roomId) return { ok: false, text: `${w.name} ya trabaja aquí.` };
    const why = canAssign(game, who, roomId);
    if (why) return { ok: false, text: why };
    return {
      ok: true,
      text: `${w.name} trabajará en ${name}.`,
      actions: [{ type: 'assign', who, room: roomId }],
    };
  }
  const h = game.heroes.find((x) => x.id === who);
  if (!h) return { ok: false, text: 'Ya no está en la taberna.' };
  if (h.status !== 'ok') return { ok: false, text: `${h.name} no está en casa.` };
  if (room.type === 'recibidor') {
    if (h.guard) return { ok: false, text: `${h.name} ya está de guardia.` };
    return {
      ok: true,
      text: `${h.name} se pone de guardia en la puerta.`,
      actions: [{ type: 'guard', id: who, on: true }],
    };
  }
  if (room.type === 'dormitorio' || room.type === 'veteranos') {
    if (!h.job && !h.guard) return { ok: false, text: `${h.name} ya está descansando.` };
    const actions: Action[] = [];
    if (h.guard) actions.push({ type: 'guard', id: who, on: false });
    if (h.job) actions.push({ type: 'assign', who, room: null });
    return { ok: true, text: `${h.name} se va a descansar.`, actions };
  }
  if (!hasPosts(room.type)) return { ok: false, text: `En ${name} no hay nada que hacer.` };
  if (h.job === roomId) return { ok: false, text: `${h.name} ya está aquí.` };
  // Quien está de guardia la deja para ponerse a otra cosa.
  const free = h.guard
    ? { ...game, heroes: game.heroes.map((x) => (x === h ? { ...x, guard: undefined } : x)) }
    : game;
  const why = canAssign(free, who, roomId);
  if (why) return { ok: false, text: why };
  const actions: Action[] = [];
  if (h.guard) actions.push({ type: 'guard', id: who, on: false });
  actions.push({ type: 'assign', who, room: roomId });
  if (isTrainRoom(room.type)) {
    const attr = TRAINS[room.type]!;
    const cap = trainCap(room);
    if (h.attrs[attr] >= cap)
      return {
        ok: false,
        text: `${h.name} ya tiene ${ATTR_NAMES[attr]} ${h.attrs[attr]}: aquí no aprende más. Mejora la sala.`,
      };
    return { ok: true, text: `${h.name} entrenará ${ATTR_NAMES[attr]} aquí.`, actions };
  }
  return { ok: true, text: `${h.name} echará una mano en ${name}.`, actions };
}
