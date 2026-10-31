import { guardsFull, type Action } from '../core/game';
import type { GameState } from '../core/model';
import { ATTR_NAMES, trainCap } from '../core/training';
import { canAssign, hasPosts, isTrainRoom } from '../core/workers';
import { TRAINS } from '../data/rooms';
import { jobRoomName } from './roomName';

/** Lo que pasa si se suelta a alguien en una sala: lo que se hará (y cómo se dice) o por qué no. */
export type Drop = { ok: true; text: string; actions: Action[] } | { ok: false; text: string };

/** La tarea de alguien: el id de una sala, la guardia o nada (descansa). */
export const GUARD = 'guardia';
export type Task = string | null;

/** Se puede coger a quien está en casa: los trabajadores y los héroes que no han salido. */
export function canDrag(game: GameState, who: string): boolean {
  if (game.workers.some((w) => w.id === who)) return true;
  return game.heroes.some((h) => h.id === who && h.status === 'ok');
}

/**
 * Cambiar la tarea de alguien (trabajar o entrenar en una sala, la guardia o descansar): lo que
 * se hará o por qué no. Lo usan arrastrar en la escena y la lista de la casa.
 */
export function planTask(game: GameState, who: string, task: Task): Drop {
  const w = game.workers.find((x) => x.id === who);
  if (w) {
    if (task === null) {
      if (!w.room) return { ok: false, text: `${w.name} ya está descansando.` };
      return {
        ok: true,
        text: `${w.name} deja el trabajo y descansa.`,
        actions: [{ type: 'assign', who, room: null }],
      };
    }
    if (task === GUARD) return { ok: false, text: 'La guardia es cosa de los héroes.' };
    const room = game.building.rooms.find((r) => r.id === task);
    if (!room) return { ok: false, text: 'Esa sala ya no está.' };
    const name = jobRoomName(game, room);
    if (!hasPosts(room.type)) return { ok: false, text: `En ${name} no hay trabajo.` };
    if (w.room === task) return { ok: false, text: `${w.name} ya trabaja aquí.` };
    const why = canAssign(game, who, task);
    if (why) return { ok: false, text: why };
    return {
      ok: true,
      text: `${w.name} trabajará en ${name}.`,
      actions: [{ type: 'assign', who, room: task }],
    };
  }
  const h = game.heroes.find((x) => x.id === who);
  if (!h) return { ok: false, text: 'Ya no está en la taberna.' };
  if (h.status !== 'ok') return { ok: false, text: `${h.name} no está en casa.` };
  if (task === GUARD) {
    if (h.guard) return { ok: false, text: `${h.name} ya está de guardia.` };
    if (guardsFull(game)) return { ok: false, text: 'Ya hay dos de guardia en la puerta.' };
    return {
      ok: true,
      text: `${h.name} se pone de guardia en la puerta.`,
      actions: [{ type: 'guard', id: who, on: true }],
    };
  }
  if (task === null) {
    if (!h.job && !h.guard) return { ok: false, text: `${h.name} ya está descansando.` };
    const actions: Action[] = [];
    if (h.guard) actions.push({ type: 'guard', id: who, on: false });
    if (h.job) actions.push({ type: 'assign', who, room: null });
    return { ok: true, text: `${h.name} se va a descansar.`, actions };
  }
  const room = game.building.rooms.find((r) => r.id === task);
  if (!room) return { ok: false, text: 'Esa sala ya no está.' };
  const name = jobRoomName(game, room);
  if (!hasPosts(room.type)) return { ok: false, text: `En ${name} no hay nada que hacer.` };
  if (h.job === task) return { ok: false, text: `${h.name} ya está aquí.` };
  // Quien está de guardia la deja para ponerse a otra cosa.
  const free = h.guard
    ? { ...game, heroes: game.heroes.map((x) => (x === h ? { ...x, guard: undefined } : x)) }
    : game;
  const why = canAssign(free, who, task);
  if (why) return { ok: false, text: why };
  const actions: Action[] = [];
  if (h.guard) actions.push({ type: 'guard', id: who, on: false });
  actions.push({ type: 'assign', who, room: task });
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

/**
 * Soltar a alguien en una sala, como en un refugio: a trabajar en las que producen, a entrenar
 * en las de entrenamiento, de guardia en el recibidor y a descansar en los dormitorios.
 */
export function planDrop(game: GameState, who: string, roomId: string): Drop {
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, text: 'Ahí no hay ninguna sala.' };
  const worker = game.workers.some((x) => x.id === who);
  const rest = worker
    ? room.type === 'servicio' || room.type === 'dormitorio'
    : room.type === 'dormitorio' || room.type === 'veteranos';
  if (rest) return planTask(game, who, null);
  if (room.type === 'recibidor' && !worker) return planTask(game, who, GUARD);
  return planTask(game, who, roomId);
}
