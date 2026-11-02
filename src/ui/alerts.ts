/**
 * Los avisos de la campanita: lo que pide atención y se olvida. Los de la casa (`crewAlerts`),
 * los encargos que caducan, los grupos que vuelven, los heridos sin quien los cure, el pago que
 * no llega, las obras recién acabadas y quien entrena sin poder subir más. Los incidentes no:
 * ya flotan sobre su sala.
 */
import { nextPayment, salaries } from '../core/game';
import type { ChipKind, GameState } from '../core/model';
import { listNames, plural } from '../core/text';
import { ATTR_NAMES, trainState, trainingOf } from '../core/training';
import { nurseBonus } from '../core/workers';
import { crewAlerts } from './crew';
import type { IconName } from './icons';
import { jobRoomName } from './roomName';

/** Adónde lleva tocar el aviso: una sala (con la cámara), Tareas, un encargo o un panel. */
export type Go =
  | { room: string }
  | { crew: string | null }
  /** La barra: quien busca trabajo (héroes y trabajadores). */
  | { barra: true }
  | { quest: string }
  | { trip: string }
  | { panel: 'tablon' | 'fuera' | 'gremio' };

export interface Notice {
  /** Fijo mientras dure lo mismo: así se sabe qué aviso es nuevo. */
  id: string;
  text: string;
  k: ChipKind;
  icon: IconName;
  go: Go;
}

/** Cuánto pesa cada tipo, para ordenar (lo malo arriba). */
const WEIGHT: Record<ChipKind, number> = { bad: 0, warn: 1, good: 2, info: 3 };

/** Todos los avisos de ahora. `done`: salas cuya obra acaba de terminar (los guarda la interfaz). */
export function gatherAlerts(game: GameState, done: string[] = []): Notice[] {
  const out: Notice[] = [];
  const rooms = game.building.rooms;

  // El pago: si llega en dos días o menos y la caja no alcanza.
  const pay = nextPayment(game);
  if (pay) {
    const due = pay.amount + salaries(game);
    const left = pay.day - game.day;
    if (left <= 2 && game.gold < due)
      out.push({
        id: `pago:${pay.day}`,
        text: `${left <= 0 ? 'Hoy' : left === 1 ? 'Mañana' : 'Pasado mañana'} toca pagar ${due} y en la caja hay ${game.gold}: faltan ${due - game.gold}.`,
        k: 'bad',
        icon: 'pergamino',
        go: { panel: 'gremio' },
      });
  }

  // Heridos sin quien los cure.
  const hurt = game.heroes.filter((h) => h.status === 'herido');
  const inf = rooms.find((r) => r.type === 'enfermeria');
  if (hurt.length && inf && !nurseBonus(game)) {
    const n = hurt.length;
    const who =
      n === 1
        ? `${hurt[0]!.name} está ${hurt[0]!.sex === 'f' ? 'herida' : 'herido'}`
        : `${n} heridos`;
    out.push({
      id: 'heridos',
      text:
        inf.level > 0
          ? `${who} y nadie trabaja en la enfermería: ${plural(n, 'cura', 'curan')} más despacio.`
          : `${who} y la enfermería está rota: arreglada, ${plural(n, 'curaría', 'curarían')} antes.`,
      k: 'warn',
      icon: 'cruz',
      go: { room: inf.id },
    });
  }

  // Encargos del tablón que se van esta noche (las historias no caducan).
  const going = game.quests.filter((q) => q.expires <= 1 && !q.chain);
  if (going.length === 1)
    out.push({
      id: `caduca:${going[0]!.id}`,
      text: `«${going[0]!.title}» se va del tablón esta noche y nadie lo ha cogido.`,
      k: 'warn',
      icon: 'tablon',
      go: { quest: going[0]!.id },
    });
  else if (going.length > 1)
    out.push({
      id: `caducan:${going.map((q) => q.id).join(',')}`,
      text: `${going.length} encargos se van del tablón esta noche: ${listNames(going.map((q) => `«${q.title}»`))}.`,
      k: 'warn',
      icon: 'tablon',
      go: { panel: 'tablon' },
    });

  // Trabajadores que piden trabajo: se contratan en la barra.
  const n = game.seekers.length;
  if (n)
    out.push({
      id: 'piden',
      text: `${n} ${n === 1 ? 'trabajador pide' : 'trabajadores piden'} trabajo en la barra.`,
      k: 'info',
      icon: 'jarra',
      go: { barra: true },
    });

  // La casa: salas sin nadie, gente sin tarea o fuera de su oficio.
  for (const a of crewAlerts(game))
    out.push({
      id: a.room ? `vacia:${a.room}` : a.who ? `tarea:${a.who}` : 'piden',
      text: a.text,
      k: a.room ? 'warn' : 'info',
      icon: a.room ? 'olla' : 'heroe',
      go: a.room ? { room: a.room } : { crew: a.who ?? null },
    });

  // Quien entrena y ya no sube: hace falta mejorar la sala o cambiarle la tarea.
  for (const h of game.heroes) {
    const t = trainState(game, h);
    const at = trainingOf(game, h);
    if (!t?.capped || !at) continue;
    out.push({
      id: `tope:${h.id}`,
      text: `${h.name} ya no sube ${ATTR_NAMES[t.attr]} en ${jobRoomName(game, at.room)}: mejora la sala o cámbiale la tarea.`,
      k: 'info',
      icon: 'diana',
      go: { room: at.room.id },
    });
  }

  // Grupos ante su jefe, esperando a que se diga.
  for (const m of game.missions)
    if (m.waiting)
      out.push({
        id: `jefe:${m.id}`,
        text: `El grupo de «${m.quest.title}» está ante el jefe: ¿ves la pelea?`,
        k: 'warn',
        icon: 'calavera',
        go: { trip: m.id },
      });

  // Grupos que vuelven al amanecer.
  for (const m of game.missions)
    if (m.daysLeft <= 1 && !m.waiting)
      out.push({
        id: `vuelve:${m.id}`,
        text: `El grupo de «${m.quest.title}» vuelve esta noche.`,
        k: 'good',
        icon: 'banderin',
        go: { trip: m.id },
      });

  // Obras recién acabadas.
  for (const id of done) {
    const r = rooms.find((x) => x.id === id);
    if (r && !r.works)
      out.push({
        id: `obra:${id}`,
        text: `¡Terminada la obra de ${jobRoomName(game, r)}! Ya funciona.`,
        k: 'good',
        icon: 'martillo',
        go: { room: id },
      });
  }

  return out.sort((a, b) => WEIGHT[a.k] - WEIGHT[b.k]);
}

/** Las salas cuya obra ha terminado entre dos momentos de la partida. */
export function finishedWorks(before: GameState, after: GameState): string[] {
  return before.building.rooms
    .filter((r) => r.works && after.building.rooms.some((x) => x.id === r.id && !x.works))
    .map((r) => r.id);
}

// ---------- Descartar avisos ----------

/** Los avisos descartados: su `id` y el día en que se descartaron. */
export type Hushed = Record<string, number>;

/**
 * Qué pasa al descartar: lo normal no vuelve mientras dure lo mismo (mismo `id`); el pago que no
 * llega vuelve al día siguiente; el grupo ante su jefe no se descarta (espera a que se diga).
 */
export function hushRule(a: Notice): 'never' | 'day' | 'while' {
  if (a.id.startsWith('jefe:')) return 'never';
  return a.k === 'bad' ? 'day' : 'while';
}

/** Los avisos que se ven: sin los descartados (los del pago, solo el mismo día). */
export function shownAlerts(alerts: Notice[], hushed: Hushed, day: number): Notice[] {
  return alerts.filter((a) => {
    const at = hushed[a.id];
    if (at === undefined) return true;
    const rule = hushRule(a);
    return rule === 'never' || (rule === 'day' && at < day);
  });
}

/**
 * Olvida los descartes de avisos que ya no están: si vuelve a pasar lo mismo más adelante,
 * vuelve a avisar. Devuelve el mismo objeto si no cambia nada.
 */
export function pruneHushed(hushed: Hushed, alerts: Notice[]): Hushed {
  const now = new Set(alerts.map((a) => a.id));
  const keys = Object.keys(hushed);
  if (keys.every((id) => now.has(id))) return hushed;
  return Object.fromEntries(keys.filter((id) => now.has(id)).map((id) => [id, hushed[id]!]));
}
