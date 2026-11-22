import type { Action } from '../core/game';
import { postIssue, postOf, type Post } from '../core/guards';
import { incidentIn, incidentIssue } from '../core/incidents';
import type { GameState } from '../core/model';
import { INCIDENTS } from '../data/incidents';
import { ATTR_NAMES, capFor } from '../core/training';
import { canAssign, hasPosts, isTrainRoom } from '../core/workers';
import { tutorialVeto } from '../core/tutorial';
import { TRAINS } from '../data/rooms';
import { jobRoomName } from './roomName';
import { t } from '../textos';

/** Lo que pasa si se suelta a alguien en una sala: lo que se hará (y cómo se dice) o por qué no. */
export type Drop = { ok: true; text: string; actions: Action[] } | { ok: false; text: string };

/** La tarea de alguien: el id de una sala, la guardia (en la puerta o en la cámara) o nada. */
export const GUARD = 'guardia';
export const GUARD_VAULT = 'guardia-tesoro';
export type Task = string | null;

/** El puesto de guardia de una tarea (o null si no es de guardia). */
export const postOfTask = (t: Task): Post | null =>
  t === GUARD ? 'puerta' : t === GUARD_VAULT ? 'tesoro' : null;

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
      if (!w.room)
        return { ok: false, text: t('ficha.drop.ya_esta_descansando', { nombre: w.name }) };
      return {
        ok: true,
        text: t('ficha.drop.deja_el_trabajo_y', { nombre: w.name }),
        actions: [{ type: 'assign', who, room: null }],
      };
    }
    if (postOfTask(task)) return { ok: false, text: t('ficha.drop.la_guardia_es_cosa') };
    const room = game.building.rooms.find((r) => r.id === task);
    if (!room) return { ok: false, text: t('ficha.drop.esa_sala_ya_no') };
    const name = jobRoomName(game, room);
    if (!hasPosts(room.type))
      return { ok: false, text: t('ficha.drop.en_no_hay_trabajo', { nombre: name }) };
    if (w.room === task)
      return { ok: false, text: t('ficha.drop.ya_trabaja_aqui', { nombre: w.name }) };
    const why = tutorialVeto(game, who, task) ?? canAssign(game, who, task);
    if (why) return { ok: false, text: why };
    return {
      ok: true,
      text: t('ficha.drop.trabajara_en', { nombre: w.name, nombre2: name }),
      actions: [{ type: 'assign', who, room: task }],
    };
  }
  const h = game.heroes.find((x) => x.id === who);
  if (!h) return { ok: false, text: t('ficha.drop.ya_no_esta_en') };
  if (h.status !== 'ok')
    return { ok: false, text: t('ficha.drop.no_esta_en_casa', { nombre: h.name }) };
  const post = postOfTask(task);
  if (post) {
    if (h.guard && postOf(h) === post)
      return { ok: false, text: t('ficha.drop.ya_esta_de_guardia', { nombre: h.name }) };
    const why = postIssue(game, post);
    if (why) return { ok: false, text: why };
    // De un puesto a otro: deja el de antes.
    const actions: Action[] = h.guard ? [{ type: 'guard', id: who, on: false }] : [];
    actions.push({ type: 'guard', id: who, on: true, ...(post === 'tesoro' ? { post } : {}) });
    return {
      ok: true,
      text:
        post === 'tesoro'
          ? t('ficha.drop.se_pone_de_guardia', { nombre: h.name })
          : t('ficha.drop.se_pone_de_guardia_2', { nombre: h.name }),
      actions,
    };
  }
  if (task === null) {
    if (!h.job && !h.guard)
      return { ok: false, text: t('ficha.drop.ya_esta_descansando', { nombre: h.name }) };
    const actions: Action[] = [];
    if (h.guard) actions.push({ type: 'guard', id: who, on: false });
    if (h.job) actions.push({ type: 'assign', who, room: null });
    return { ok: true, text: t('ficha.drop.se_va_a_descansar', { nombre: h.name }), actions };
  }
  const room = game.building.rooms.find((r) => r.id === task);
  if (!room) return { ok: false, text: t('ficha.drop.esa_sala_ya_no') };
  const name = jobRoomName(game, room);
  if (!hasPosts(room.type))
    return { ok: false, text: t('ficha.drop.en_no_hay_nada', { nombre: name }) };
  if (h.job === task) return { ok: false, text: t('ficha.drop.ya_esta_aqui', { nombre: h.name }) };
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
    const { cap, by } = capFor(h, room);
    if (h.attrs[attr] >= cap)
      return {
        ok: false,
        text:
          by === 'sala'
            ? t('ficha.drop.ya_tiene_aqui_no', {
                nombre: h.name,
                atributo: ATTR_NAMES[attr],
                n: h.attrs[attr],
              })
            : t('ficha.drop.ya_tiene_no_aprende', {
                nombre: h.name,
                atributo: ATTR_NAMES[attr],
                n: h.attrs[attr],
              }),
      };
    return {
      ok: true,
      text: t('ficha.drop.entrenara_aqui', { nombre: h.name, atributo: ATTR_NAMES[attr] }),
      actions,
    };
  }
  return {
    ok: true,
    text: t('ficha.drop.echara_una_mano_en', { nombre: h.name, nombre2: name }),
    actions,
  };
}

/**
 * Soltar a alguien en una sala, como en un refugio: a trabajar en las que producen, a entrenar
 * en las de entrenamiento, de guardia en el recibidor y a descansar en los dormitorios.
 */
export function planDrop(game: GameState, who: string, roomId: string): Drop {
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, text: t('ficha.drop.ahi_no_hay_ninguna') };
  // Si en la sala pasa algo que se arregla mandando a alguien, primero eso.
  const inc = incidentIn(game, roomId);
  const how = inc && INCIDENTS[inc.kind].how;
  if (inc && (how === 'heroe' || how === 'alguien')) {
    const act = { by: 'who' as const, who };
    const why = incidentIssue(game, inc.id, act);
    const name =
      game.heroes.find((h) => h.id === who)?.name ?? game.workers.find((w) => w.id === who)?.name;
    return why
      ? { ok: false, text: why }
      : {
          ok: true,
          text: `${name} va: ${INCIDENTS[inc.kind].title.toLowerCase()}.`,
          actions: [{ type: 'incident', id: inc.id, act }],
        };
  }
  const worker = game.workers.some((x) => x.id === who);
  const rest = worker
    ? room.type === 'servicio' || room.type === 'dormitorio'
    : room.type === 'dormitorio' || room.type === 'veteranos';
  if (rest) return planTask(game, who, null);
  if (room.type === 'recibidor' && !worker) return planTask(game, who, GUARD);
  if (room.type === 'tesoro' && !worker) return planTask(game, who, GUARD_VAULT);
  return planTask(game, who, roomId);
}
