/**
 * Incidentes de la taberna: a lo largo del día, con el juego abierto, pasa algo en una sala (una
 * pelea, ratas, el recaudador…) y hay un rato para resolverlo: arrastrando a alguien, pagando,
 * tocando o eligiendo. Si no se resuelve a tiempo, sale mal. Con el juego cerrado no pasan (la
 * simulación de `away.ts` no los llama). Los datos están en `data/incidents.ts`.
 */
import { INCIDENTS, type IncidentKind } from '../data/incidents';
import {
  INCIDENT_WALK,
  DAY_SECONDS,
  DUSK,
  INCIDENT_EVERY,
  INCIDENT_FROM_DAY,
  INCIDENT_REACT,
  INCIDENT_RANK_COST,
  rankIndex,
} from './balance';
import type { ChipKind, DawnEvent, GameState, Incident } from './model';
import { Rng } from './rng';
import { active } from './rooms';
import { onWay } from './workers';

/** Lo último que ha pasado con los incidentes, para el aviso de la interfaz. */
export type IncidentNews = { t: string; k: ChipKind };

const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

/** Lo que cuesta pagar un incidente (sube con el rango). */
export function incidentCost(s: GameState, inc: Incident): number {
  const d = INCIDENTS[inc.kind];
  return (d.cost ?? 0) + INCIDENT_RANK_COST * rankIndex(s.rep);
}

/** Incidente de una sala, si hay. */
export const incidentIn = (s: GameState, roomId: string) =>
  (s.incidents ?? []).find((i) => i.room === roomId) ?? null;

/** Salas donde puede pasar cada incidente ahora mismo (en uso). */
function places(s: GameState, kind: IncidentKind): string[] {
  const types = INCIDENTS[kind].rooms;
  return (
    s.building.rooms
      .filter((r) => types.includes(r.type) && active(r).level > 0)
      // Donde ya hay quien lo arreglaría solo, no pasa (ahí se nota tener la sala atendida).
      .filter((r) => !presentFor(s, { kind, room: r.id }))
      .map((r) => r.id)
  );
}

/**
 * Avanza los incidentes del reloj `from` al `to` (segundos del día): los que no se han resuelto a
 * tiempo salen mal y, de vez en cuando, empieza uno nuevo. Muta `s` (una copia).
 */
export function stepIncidents(s: GameState, from: number, to: number): IncidentNews[] {
  const news: IncidentNews[] = [];
  for (const inc of [...(s.incidents ?? [])]) {
    const c = inc.coming;
    if (c) {
      // Quien iba de camino ya no puede ir (ha salido, se ha herido, se ha ido): vuelve a correr.
      if (!canGo(s, inc, c.who)) {
        s.incidents = s.incidents!.map((i) => (i === inc ? { ...i, coming: undefined } : i));
        continue;
      }
      // Si nadie dice que ha llegado (sin escena o con la app cerrada), se da por llegado.
      if (to >= c.at) {
        done(s, inc);
        news.push(win(s, inc, nameOf(s, c.who)));
      }
      continue;
    }
    // Quien ya está en la sala y sabe arreglarlo se pone a ello solo (sin que haya que arrastrarlo).
    if (to < inc.from + INCIDENT_REACT) continue;
    const who = presentFor(s, inc);
    if (who) {
      done(s, inc);
      news.push(win(s, inc, who));
    }
  }
  // Sale mal al acabarse el tiempo, salvo que alguien vaya ya de camino.
  const list = s.incidents ?? [];
  const late = (i: Incident) => i.until <= to && !i.coming;
  for (const inc of list.filter(late)) news.push(lose(s, inc));
  s.incidents = list.filter((i) => !late(i));
  // Uno a la vez, desde el segundo día y con tiempo de resolverlo antes de que anochezca.
  if (s.day < INCIDENT_FROM_DAY || s.incidents.length || s.over) return news;
  const rng = new Rng(s.rng);
  const chance = Math.max(0, to - from) / INCIDENT_EVERY;
  if (rng.chance(chance)) {
    const kinds = (Object.keys(INCIDENTS) as IncidentKind[]).filter(
      (k) => places(s, k).length && to + INCIDENTS[k].secs < DUSK * DAY_SECONDS,
    );
    if (kinds.length) {
      const kind = rng.pick(kinds);
      const d = INCIDENTS[kind];
      const inc: Incident = {
        id: `inc${s.uid++}`,
        kind,
        room: rng.pick(places(s, kind)),
        from: to,
        until: to + d.secs,
        taps: d.taps,
      };
      s.incidents = [inc];
      news.push({ t: `${d.title}. ${d.ask}`, k: 'warn' });
    }
  }
  s.rng = rng.save();
  return news;
}

/**
 * Quien está ya en la sala del incidente y lo puede arreglar (su nombre), o null: un héroe en
 * casa con su tarea en esa sala, o, si vale cualquiera, también el personal de la sala.
 */
export function presentFor(s: GameState, inc: Pick<Incident, 'kind' | 'room'>): string | null {
  const how = INCIDENTS[inc.kind].how;
  if (how !== 'heroe' && how !== 'alguien') return null;
  // Quien aún va de camino a su sala no está allí.
  const hero = s.heroes.find((h) => h.status === 'ok' && h.job === inc.room && !onWay(s, h));
  if (hero) return hero.name;
  if (how === 'alguien')
    return s.workers.find((w) => w.room === inc.room && !onWay(s, w))?.name ?? null;
  return null;
}

/** El nombre de alguien de la casa (héroe o trabajador). */
const nameOf = (s: GameState, id: string) =>
  s.heroes.find((h) => h.id === id)?.name ?? s.workers.find((w) => w.id === id)?.name ?? 'Alguien';

/** Si alguien puede ir a arreglar un incidente (héroe en casa o, si vale cualquiera, trabajador). */
function canGo(s: GameState, inc: Incident, who: string): boolean {
  const how = INCIDENTS[inc.kind].how;
  if (s.heroes.some((h) => h.id === who && h.status === 'ok')) return true;
  return how === 'alguien' && s.workers.some((w) => w.id === who);
}

/**
 * La escena dice que alguien ha llegado a una sala: si iba a arreglar el incidente de allí, lo
 * arregla. El estado ya es una copia (se copia la lista). Devuelve la noticia, si la hay.
 */
export function arriveIncident(s: GameState, who: string, room: string): IncidentNews | null {
  const inc = s.incidents?.find((i) => i.room === room && i.coming?.who === who);
  if (!inc) return null;
  done(s, inc);
  return win(s, inc, nameOf(s, who));
}

/** Sale mal: se pierde lo que diga y se cuenta. */
function lose(s: GameState, inc: Incident): IncidentNews {
  const d = INCIDENTS[inc.kind];
  const l = d.loss;
  let n = 0;
  if (l.gold) n = Math.min(s.gold, l.gold);
  if (l.goldShare) n = Math.floor(s.gold * l.goldShare);
  s.gold -= n;
  if (l.food) s.food = Math.max(0, s.food - (n = Math.min(s.food, l.food)));
  if (l.beer) s.beer = Math.max(0, s.beer - (n = Math.min(s.beer, l.beer)));
  if (l.rep) s.rep = Math.max(0, s.rep - l.rep);
  return { t: fill(d.lose, { n }), k: 'bad' };
}

/** Sale bien: la fama que dé y se cuenta, con quien lo ha arreglado. */
function win(s: GameState, inc: Incident, who: string): IncidentNews {
  const d = INCIDENTS[inc.kind];
  if (d.rep) s.rep += d.rep;
  if (s.stats) s.stats = { ...s.stats, incidents: (s.stats.incidents ?? 0) + 1 };
  return { t: fill(d.win, { h: who }) + (d.rep ? ` (+${d.rep} reputación)` : ''), k: 'good' };
}

const done = (s: GameState, inc: Incident) => {
  s.incidents = (s.incidents ?? []).filter((i) => i.id !== inc.id);
};

/** Lo que hace el jugador con un incidente: quién va, pagar, tocar o qué elige. */
export type IncidentAct =
  { by: 'who'; who: string } | { by: 'pagar' } | { by: 'tocar' } | { by: 'elegir'; option: number };

/** Por qué no se puede hacer eso con el incidente (o null). */
export function incidentIssue(s: GameState, id: string, act: IncidentAct): string | null {
  const inc = (s.incidents ?? []).find((i) => i.id === id);
  if (!inc) return 'Eso ya se ha resuelto.';
  const d = INCIDENTS[inc.kind];
  if (act.by === 'who') {
    if (d.how !== 'heroe' && d.how !== 'alguien') return d.ask;
    if (!canGo(s, inc, act.who))
      return d.how === 'heroe'
        ? 'Para esto hace falta un héroe.'
        : 'Tiene que ser alguien de casa.';
    if (inc.coming) return `Ya va ${nameOf(s, inc.coming.who)}.`;
    return null;
  }
  if (act.by === 'pagar') {
    if (d.how !== 'pagar') return d.ask;
    const cost = incidentCost(s, inc);
    return s.gold < cost ? `Te faltan ${cost - s.gold} monedas.` : null;
  }
  if (act.by === 'tocar') return d.how === 'tocar' ? null : d.ask;
  if (d.how !== 'elegir' || !d.choices?.[act.option]) return d.ask;
  const c = d.choices[act.option]!;
  return c.gold && s.gold < -c.gold ? `Te faltan ${-c.gold - s.gold} monedas.` : null;
}

/** Resuelve (o avanza, si es de tocar) un incidente. Muta `s` (una copia). */
export function actOnIncident(s: GameState, id: string, act: IncidentAct): IncidentNews | null {
  if (incidentIssue(s, id, act)) return null;
  const inc = (s.incidents ?? []).find((i) => i.id === id)!;
  const d = INCIDENTS[inc.kind];
  if (act.by === 'who') {
    // Va andando: se arregla cuando llega (`arriveIncident`); mientras, no sale mal.
    s.incidents = s.incidents!.map((i) =>
      i === inc ? { ...i, coming: { who: act.who, at: (s.clock ?? 0) + INCIDENT_WALK } } : i,
    );
    return null;
  }
  if (act.by === 'pagar') {
    s.gold -= incidentCost(s, inc);
    done(s, inc);
    return win(s, inc, '');
  }
  if (act.by === 'tocar') {
    inc.taps = Math.max(0, (inc.taps ?? 1) - 1);
    if (inc.taps > 0) return null;
    done(s, inc);
    return win(s, inc, '');
  }
  const c = d.choices![act.option]!;
  s.gold += c.gold ?? 0;
  s.rep = Math.max(0, s.rep + (c.rep ?? 0));
  done(s, inc);
  const rep = c.rep ? ` (${c.rep > 0 ? '+' : ''}${c.rep} reputación)` : '';
  return { t: c.text + rep, k: (c.rep ?? 0) >= 0 ? 'good' : 'warn' };
}

/**
 * Al caer la noche, lo que quede sin resolver sale mal y va a la carta del amanecer (si alguien
 * iba ya de camino, llega y lo arregla).
 */
export function failIncidents(s: GameState, events: DawnEvent[]): void {
  for (const inc of s.incidents ?? [])
    events.push(
      inc.coming && canGo(s, inc, inc.coming.who)
        ? win(s, inc, nameOf(s, inc.coming.who))
        : lose(s, inc),
    );
  s.incidents = [];
}
