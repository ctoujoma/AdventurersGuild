/**
 * Los avisos de la campanita: lo que pide atención y se olvida. Los de la casa (`crewAlerts`),
 * los encargos que caducan, los grupos que vuelven, los heridos sin quien los cure, el pago que
 * no llega, las obras recién acabadas, quien entrena sin poder subir más y lo que salió de
 * desmontar un objeto. Los incidentes no: ya flotan sobre su sala.
 */
import { nextPayment, salaries, tiredLine } from '../core/game';
import { MORALE_LOW } from '../core/party';
import type { ChipKind, GameState } from '../core/model';
import { ATTR_NAMES, cappedTrainees } from '../core/training';
import { infirmaryPlan, staffing } from '../core/infirmary';
import { RECIPES } from '../data/recipes';
import { storeLevel } from '../core/materials';
import { sleepPlan } from '../core/beds';
import { nightmareNow } from '../core/nightmare';
import { crewAlerts } from './crew';
import type { IconName } from './icons';
import { jobRoomName } from './roomName';
import { t, tx } from '../textos';

/** Adónde lleva tocar el aviso: una sala (con la cámara), Tareas, un encargo o un panel. */
export type Go =
  | { room: string }
  | { crew: string | null }
  /** La barra: quien busca trabajo (héroes y trabajadores). */
  | { barra: true }
  | { quest: string }
  | { trip: string }
  /** El modo obras con una sala elegida para construir (el almacén). */
  | { build: 'almacen' }
  | { panel: 'tablon' | 'fuera' | 'gremio' }
  /** La oferta del forastero de la tormenta. */
  | { stranger: true };

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
        text: t('barra.alerts.toca_pagar_y_en', {
          dias: Math.max(0, left),
          pago: due,
          oro: game.gold,
          faltan: due - game.gold,
        }),
        k: 'bad',
        icon: 'pergamino',
        go: { panel: 'gremio' },
      });
  }

  // Heridos sin quien los cure.
  const hurt = game.heroes.filter((h) => h.status === 'herido');
  const inf = rooms.find((r) => r.type === 'enfermeria');
  // Sin nadie trabajando, sus catres curan como una cama: avisa si alguna con heridos está vacía.
  const cots = infirmaryPlan(game);
  const idle = rooms.some(
    (r) => r.type === 'enfermeria' && [...cots.values()].includes(r.id) && staffing(game, r) === 0,
  );
  if (hurt.length && inf && (inf.level === 0 || idle)) {
    const n = hurt.length;
    const who = { n, nombre: hurt[0]!.name, sexo: hurt[0]!.sex };
    out.push({
      id: 'heridos',
      text:
        inf.level > 0
          ? t('barra.alerts.y_nadie_trabaja_en', who)
          : t('barra.alerts.y_la_enfermeria_esta', who),
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
      text: t('barra.alerts.se_va_del_tablon', { titulo: tx(going[0]!.title) }),
      k: 'warn',
      icon: 'tablon',
      go: { quest: going[0]!.id },
    });
  else if (going.length > 1)
    out.push({
      id: `caducan:${going.map((q) => q.id).join(',')}`,
      text: t('barra.alerts.encargos_se_van_del', {
        n: going.length,
        titulos: going.map((q) => t('barra.alerts.titulo', { titulo: q.title })),
      }),
      k: 'warn',
      icon: 'tablon',
      go: { panel: 'tablon' },
    });

  // Trabajadores que piden trabajo: se contratan en la barra.
  const n = game.seekers.length;
  if (n)
    out.push({
      id: 'piden',
      text: t('barra.alerts.trabajo_en_la_barra', { n }),
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

  // Quien entrena y ya no sube: sale al llegar (la campanita lo enseña) y lleva a sus tareas,
  // para mandarle a otra cosa. Quedarse no le sirve: al amanecer se va a descansar solo.
  for (const { hero: h, room, attr, by } of cappedTrainees(game))
    out.push({
      id: `tope:${h.id}:${room.id}`,
      text: t('barra.alerts.ya_no_aprende_mas', {
        nombre: h.name,
        atributo: ATTR_NAMES[attr],
        sala: jobRoomName(game, room),
        por: by,
      }),
      k: 'warn',
      icon: 'diana',
      go: { crew: h.id },
    });

  // Grupos ante su jefe, esperando a que se diga.
  for (const m of game.missions)
    if (m.waiting)
      out.push({
        id: `jefe:${m.id}`,
        text: t('barra.alerts.el_grupo_de_esta', { titulo: tx(m.quest.title) }),
        k: 'warn',
        icon: 'calavera',
        go: { trip: m.id },
      });

  // Grupos que vuelven al amanecer.
  for (const m of game.missions)
    if (m.daysLeft <= 1 && !m.waiting)
      out.push({
        id: `vuelve:${m.id}`,
        text: t('barra.alerts.el_grupo_de_vuelve', { titulo: tx(m.quest.title) }),
        k: 'good',
        icon: 'banderin',
        go: { trip: m.id },
      });

  // Lo que ha salido de desmontar un objeto (hoy o anoche): si se aprendió a hacerlo o no.
  for (const e of game.craftLog ?? []) {
    if (!e.undo || e.undo.day < game.day - 1) continue;
    const rc = RECIPES[e.undo.recipe];
    const learnt = e.how === 'receta';
    out.push({
      id: `desmonta:${e.id}`,
      text: learnt
        ? t('barra.alerts.desmontando_han_sacado_como', { objeto: tx(e.undo.item), many: rc.many })
        : t('barra.alerts.han_desmontado_pero_no', { objeto: tx(e.undo.item) }),
      k: learnt ? 'good' : 'info',
      icon: 'yunque',
      go: rooms.some((r) => r.id === e.room) ? { room: e.room } : { panel: 'gremio' },
    });
  }

  // El rincón de los materiales se llenó y se vendió algo: la primera vez, que lleve a construir
  // el almacén (o que diga que se podrá al pagar la deuda). Descartado, no vuelve.
  if (
    !storeLevel(game) &&
    game.reports.some((r) =>
      r.chips.some((c) => typeof c.t === 'object' && c.t.k === 'materiales.no_cabe'),
    )
  )
    out.push({
      id: 'almacen-lleno',
      text:
        game.mode === 'libre'
          ? t('barra.alerts.en_el_rincon_de')
          : t('barra.alerts.en_el_rincon_de_2'),
      k: 'warn',
      icon: 'cofre',
      go: game.mode === 'libre' ? { build: 'almacen' } : { panel: 'gremio' },
    });

  // El forastero de la tormenta espera junto al fuego (hasta mañana a mediodía).
  if (game.stranger)
    out.push({
      id: `forastero:${game.stranger.day}`,
      text: t('barra.alerts.un_forastero_encapuchado_espera', {
        hoy: game.day > game.stranger.day,
      }),
      k: 'warn',
      icon: 'vela',
      go: { stranger: true },
    });

  // De guardia y agotado (moral baja): de noche se duerme mucho. Uno por guardia, fijo mientras
  // dure (no vuelve a sonar cada noche).
  for (const h of game.heroes)
    if (h.guard && h.status === 'ok' && h.morale < MORALE_LOW)
      out.push({
        id: `agotado:${h.id}`,
        text: tiredLine([h]),
        k: 'warn',
        icon: 'moon',
        go: { crew: h.id },
      });

  // La pesadilla: alguien da vueltas en la cama (tocándole se le lleva un trago).
  const nm = nightmareNow(game);
  if (nm && !nm.n.eased) {
    // Los heridos, en los catres de la enfermería (si está en uso); los demás, en su dormitorio.
    const bed = (nm.h.status === 'herido' && cots.get(nm.h.id)) || sleepPlan(game).get(nm.h.id);
    out.push({
      id: `pesadilla:${nm.n.day}`,
      text: t('barra.alerts.da_vueltas_en_la', {
        nombre: nm.h.name,
        sexo: nm.h.sex,
      }),
      k: 'warn',
      icon: 'moon',
      go: bed ? { room: bed } : { crew: null },
    });
  }

  // Obras recién acabadas.
  for (const id of done) {
    const r = rooms.find((x) => x.id === id);
    if (r && !r.works)
      out.push({
        id: `obra:${id}`,
        text: t('barra.alerts.terminada_la_obra_de', { job_room_name: jobRoomName(game, r) }),
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
