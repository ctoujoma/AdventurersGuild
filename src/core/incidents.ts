/**
 * Incidentes de la taberna: a lo largo del día, con el juego abierto, pasa algo en una sala (una
 * pelea, ratas, el recaudador…) y hay un rato para resolverlo: arrastrando a alguien, pagando,
 * tocando o eligiendo. Si no se resuelve a tiempo, sale mal. Con el juego cerrado no pasan (la
 * simulación de `away.ts` no los llama). Los datos están en `data/incidents.ts`.
 */
import { INCIDENTS, type IncidentKind } from '../data/incidents';
import {
  DAY_SECONDS,
  DUSK,
  INCIDENT_EVERY,
  INCIDENT_FROM_DAY,
  INCIDENT_RANK_COST,
  rankIndex,
} from './balance';
import type { ChipKind, DawnEvent, GameState, Incident } from './model';
import { Rng } from './rng';
import { active } from './rooms';

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
  return s.building.rooms
    .filter((r) => types.includes(r.type) && active(r).level > 0)
    .map((r) => r.id);
}

/**
 * Avanza los incidentes del reloj `from` al `to` (segundos del día): los que no se han resuelto a
 * tiempo salen mal y, de vez en cuando, empieza uno nuevo. Muta `s` (una copia).
 */
export function stepIncidents(s: GameState, from: number, to: number): IncidentNews[] {
  const news: IncidentNews[] = [];
  const list = s.incidents ?? [];
  for (const inc of list.filter((i) => i.until <= to)) news.push(lose(s, inc));
  s.incidents = list.filter((i) => i.until > to);
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
    const hero = s.heroes.find((h) => h.id === act.who && h.status === 'ok');
    const worker = s.workers.find((w) => w.id === act.who);
    if (!hero && !(worker && d.how === 'alguien'))
      return d.how === 'heroe'
        ? 'Para esto hace falta un héroe.'
        : 'Tiene que ser alguien de casa.';
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
    const name =
      s.heroes.find((h) => h.id === act.who)?.name ??
      s.workers.find((w) => w.id === act.who)?.name ??
      'Alguien';
    done(s, inc);
    return win(s, inc, name);
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

/** Al caer la noche, lo que quede sin resolver sale mal y va a la carta del amanecer. */
export function failIncidents(s: GameState, events: DawnEvent[]): void {
  for (const inc of s.incidents ?? []) events.push(lose(s, inc));
  s.incidents = [];
}
