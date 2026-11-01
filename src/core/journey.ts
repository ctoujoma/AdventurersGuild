/**
 * El viaje de un grupo fuera, por partes y con sus sucesos, para la ficha «Encargo en curso» y
 * la tira animada. Sale fijo de una semilla (el mismo al cerrar y abrir) y no cambia la partida:
 * lo que de verdad pasa llega con el informe al volver.
 *
 * El tiempo del viaje va de 0 (sale) a 1 (vuelve, al acabar el último día): cada día es 1/días.
 */
import { BOSSES, type BossKind } from '../data/bosses';
import {
  ARRIVE,
  CAMP,
  FIGHT,
  FOE_BY_TYPE,
  FOE_NAMES,
  FOE_WORDS,
  LEAVE,
  LEGS,
  ROAD,
  WORK,
  type FoeKind,
  type LegId,
} from '../data/journey';
import { PLACE_INFO, type Terrain } from '../data/places';
import { DAY_SECONDS, DUSK } from './balance';
import { bossOf, fightRoster } from './chains';
import type { BossFight, GameState, Mission, Outcome, QuestType } from './model';
import { Rng } from './rng';

export type { FoeKind, LegId };
export { LEGS };

export type JourneyKind =
  'camino' | 'llegada' | 'faena' | 'pelea' | 'jefe' | 'aviso' | 'noche' | 'vuelta';

/** Un suceso del viaje: en qué parte, en qué punto de ella (0–1) y en qué punto del total. */
export interface JourneyEvent {
  leg: LegId;
  at: number;
  t: number;
  kind: JourneyKind;
  text: string;
  /** El héroe que sale en la frase, si sale alguno. */
  heroId?: string;
}

/** Todo lo que la tira necesita, fijo para un grupo fuera. */
export interface Journey {
  /** Semilla para el paisaje y los detalles de la tira. */
  seed: string;
  type: QuestType;
  terrain: Terrain;
  place: string;
  days: number;
  boss?: BossKind;
  /** Contra qué se pelea (la familia de enemigos que dibuja la tira). */
  foe: FoeKind;
  /** Cuándo se pelea (del total, 0–1): la tira pone ahí a los enemigos. Sin pelea, nada. */
  fight?: { from: number; to: number };
  events: JourneyEvent[];
}

/** Dónde va ahora: el viaje y el momento. */
export interface JourneyNow {
  journey: Journey;
  /** Del total (0–1). */
  t: number;
  leg: LegId;
  /** De la parte de ahora (0–1). */
  legT: number;
  night: boolean;
  /** Si ahora están peleando (la tira pone a los enemigos y las poses de pelea; con jefe, no). */
  fighting: boolean;
  /** Parados ante el jefe, esperando a que el jugador diga. */
  waiting: boolean;
  /** Ya resuelto: cómo fue (la vuelta lo enseña; con jefe, caído o en retirada). */
  outcome?: Outcome;
  /** Quién va, con su aspecto (como en la pelea contra un jefe) y su estado. */
  crew: BossFight['heroes'];
  /** Lo que ya ha pasado, por orden. */
  past: JourneyEvent[];
}

/**
 * Cuándo se sabe cómo ha ido (del total): al acabar lo suyo. Ahí se resuelve el encargo y llega
 * el informe; la vuelta ya enseña cómo viene cada uno.
 */
export const RESOLVE_T = LEGS[2].from + (LEGS[2].to - LEGS[2].from) * 0.95;

/** Cuándo llega un grupo ante su jefe (del total): ahí se para hasta que el jugador diga. */
export const BOSS_T = LEGS[2].from + (LEGS[2].to - LEGS[2].from) * 0.6;

/**
 * Cuándo se resuelve un grupo (del total): con jefe, al llegar a él (y espera al jugador); con
 * pelea, al acabarla (así la tira enseña cómo acaba de verdad); si no, al acabar lo suyo.
 */
export function resolveAt(m: Mission): number {
  const j = journey(m);
  return j.boss ? BOSS_T : j.fight ? j.fight.to : RESOLVE_T;
}

const legOf = (t: number) => LEGS.find((l) => t < l.to) ?? LEGS[LEGS.length - 1]!;
const legAt = (leg: LegId, at: number) => {
  const l = LEGS.find((x) => x.id === leg)!;
  return l.from + (l.to - l.from) * at;
};

/** Contra qué se pelea en un encargo: lo que diga su texto o, si no, lo propio del tipo. */
export function foeOf(q: Mission['quest']): FoeKind {
  const text = `${q.title} ${q.text}`;
  return FOE_WORDS.find(([re]) => re.test(text))?.[1] ?? FOE_BY_TYPE[q.type];
}

/** Los tipos en que siempre hay pelea; en los demás, según el peligro. */
const FIGHTY = new Set(['Cazar', 'Limpiar', 'Escoltar']);

/** El viaje de un grupo, siempre igual para el mismo grupo. */
export function journey(m: Mission): Journey {
  const q = m.quest;
  const seed = `viaje-${m.id}-${q.id}`;
  const rng = new Rng(seed);
  const terrain = PLACE_INFO[q.place]?.terrain ?? 'campo';
  const boss = bossOf(q);
  const days = Math.max(1, q.days);
  const foe = foeOf(q);
  const events: JourneyEvent[] = [];
  const say = (leg: LegId, at: number, kind: JourneyKind, pool: readonly string[]) => {
    let text = rng
      .pick(pool)
      .replace('{sitio}', q.place)
      .replace('{foe}', FOE_NAMES[foe])
      .replace(/\b(a|de) el\b/g, (_, p: string) => (p === 'a' ? 'al' : 'del'));
    let heroId: string | undefined;
    if (text.includes('{h}')) {
      heroId = rng.pick(m.heroIds);
      text = text.replace('{h}', `{${heroId}}`);
    }
    events.push({ leg, at, t: legAt(leg, at), kind, text, heroId });
  };

  // Por el camino, sin repetir frase.
  const road = [...ROAD[terrain]];
  const take = () => road.splice(rng.int(0, road.length - 1), 1);
  say('ida', 0.25 + rng.next() * 0.2, 'camino', take());
  if (days > 1 || rng.chance(0.5)) say('ida', 0.65 + rng.next() * 0.2, 'camino', take());
  say('llegada', 0.3, 'llegada', ARRIVE);
  const work = WORK[q.type];
  say('faena', 0.15, 'faena', [work[0]!]);
  let fight: Journey['fight'];
  if (boss) {
    events.push({
      leg: 'faena',
      at: 0.6,
      t: legAt('faena', 0.6),
      kind: 'jefe',
      text: `Aparece ${BOSSES[boss].name.replace(/^El /, 'el ').replace(/^La /, 'la ')}.`,
    });
    fight = { from: legAt('faena', 0.6), to: legAt('faena', 0.95) };
  } else if (FIGHTY.has(q.type) || rng.chance(0.25 + 0.2 * q.danger)) {
    const at = 0.45 + rng.next() * 0.15;
    say('faena', at, 'pelea', FIGHT);
    fight = { from: legAt('faena', at), to: legAt('faena', at + 0.3) };
  } else say('faena', 0.6, 'faena', [work[1]!]);
  say('vuelta', 0.1, 'vuelta', LEAVE);
  if (road.length) say('vuelta', 0.55 + rng.next() * 0.2, 'camino', road);

  // Las noches fuera (las de antes de la última, que es la de volver).
  for (let d = 1; d < days; d++) {
    const t = (d - 1 + DUSK) / days;
    const l = legOf(t);
    say(l.id, (t - l.from) / (l.to - l.from), 'noche', CAMP);
  }
  events.sort((a, b) => a.t - b.t);
  return { seed, type: q.type, terrain, place: q.place, days, boss, foe, fight, events };
}

/** Del total del viaje, cuánto lleva ahora (0–1). */
export function journeyT(s: GameState, m: Mission): number {
  const days = Math.max(1, m.quest.days);
  const part = Math.min(1, (s.clock ?? 0) / DAY_SECONDS);
  return Math.max(0, Math.min(1, (days - m.daysLeft + part) / days));
}

/** El viaje de un grupo en este momento de la partida. */
export function journeyNow(s: GameState, m: Mission): JourneyNow {
  const j = journey(m);
  // Ante el jefe, el viaje se para hasta que se resuelva.
  const t = m.waiting ? Math.min(BOSS_T, journeyT(s, m)) : journeyT(s, m);
  const l = legOf(t);
  const heroes = m.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const crew = fightRoster(heroes);
  const past = j.events.filter((e) => e.t <= t);
  if (m.done) {
    // Ya se sabe: cada uno, como vuelve (los que no vuelven, como quedaron).
    for (const c of crew)
      c.fate = m.done.fates[c.id]?.status ?? heroes.find((h) => h.id === c.id)!.status;
    const bad = m.done.outcome === 'Fracaso' || m.done.outcome === 'Desastre';
    past.push({
      leg: 'faena',
      at: 0.95,
      t: Math.min(t, resolveAt(m)),
      kind: 'aviso',
      text: `Mandan aviso: ${m.done.outcome.toLowerCase()}.${bad ? '' : ' Ya vienen.'}`,
    });
    past.sort((a, b) => a.t - b.t);
  }
  return {
    journey: j,
    t,
    leg: l.id,
    legT: Math.max(0, Math.min(1, (t - l.from) / (l.to - l.from))),
    night: (s.clock ?? 0) >= DUSK * DAY_SECONDS,
    fighting: !m.waiting && !j.boss && !!j.fight && t >= j.fight.from && t < j.fight.to,
    waiting: !!m.waiting,
    outcome: m.done?.outcome,
    crew,
    past,
  };
}

/** La frase de un suceso con el nombre del héroe en su sitio. */
export function eventText(s: GameState, e: JourneyEvent): string {
  if (!e.heroId) return e.text;
  const name = s.heroes.find((h) => h.id === e.heroId)?.name ?? 'Alguien';
  return e.text.replace(`{${e.heroId}}`, name);
}
