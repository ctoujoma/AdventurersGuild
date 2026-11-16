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
  CAT_EVERY,
  CAT_FIRST,
  CAT_MAX,
  GUARD_HOLD,
  GUARD_NAP,
  NIGHT_NAP_CYCLE,
  NIGHT_NAP_SHARE,
  NIGHT_NAP_TURN,
  NIGHT_THIEF_RUN,
  THIEF_ESCAPE,
  WORK_END,
  THIEF_HP,
  THIEF_HP_RANK,
  rankIndex,
} from './balance';
import { clockDuel, heroUnit, type FightEvent } from './fight';
import type {
  Building,
  ChipKind,
  DawnEvent,
  Duel,
  DuelHit,
  GameState,
  Incident,
  IncidentEnd,
} from './model';
import { equip } from './resolve';
import { Rng } from './rng';
import { active } from './rooms';
import { onWay } from './workers';
import { bump } from './feats';
import { guardsAt } from './guards';

/** Lo último que ha pasado con los incidentes, para el aviso de la interfaz. */
export type IncidentNews = { t: string; k: ChipKind };

/** Los dos ladrones (el de la cámara, de día, y el nocturno) pelean con quien llega. */
export const isThief = (k: IncidentKind) => k === 'ladron' || k === 'nocturno';

/**
 * Lo de la noche no sale en avisos sueltos: se guarda para contarlo al amanecer, en la carta (ver
 * `endDay`). Muta `s` (una copia).
 */
export function tellDawn(s: GameState, n: DawnEvent): void {
  s.nightLines = [...(s.nightLines ?? []), n];
}

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
  const out: IncidentNews[] = [];
  // Lo del ladrón nocturno va a la carta del amanecer, no a los avisos.
  let night = false;
  const news = {
    push: (n: IncidentNews) => (night ? tellDawn(s, n) : out.push(n)),
  };
  for (const inc of [...(s.incidents ?? [])]) {
    night = !!INCIDENTS[inc.kind].night;
    const c = inc.coming;
    if (c) {
      // Quien iba de camino ya no puede ir (ha salido, se ha herido, se ha ido): vuelve a correr.
      if (!canGo(s, inc, c.who)) {
        s.incidents = s.incidents!.map((i) => (i === inc ? { ...i, coming: undefined } : i));
        continue;
      }
      // Si nadie dice que ha llegado (sin escena o con la app cerrada), se da por llegado.
      if (to >= c.at) {
        const n = reach(s, inc, c.who);
        if (n) news.push(n);
      }
      continue;
    }
    // La pelea con el ladrón: al acabar, le pilla o se escapa.
    if (inc.duel) {
      if (to >= inc.duel.at + inc.duel.end) news.push(settleDuel(s, inc));
      continue;
    }
    // El nocturno: nadie le ve hasta que sale con el oro (entonces, el de guardia, si no cabecea).
    if (night) {
      if (to < inc.until) continue;
      const n = nightLate(s, inc, to, false);
      if (n) news.push(n);
      continue;
    }
    const help = helpers(s, inc, to);
    if (help) news.push(help);
    if (!s.incidents?.some((i) => i.id === inc.id && !i.coming)) continue;
    // Quien ya está en la sala y sabe arreglarlo se pone a ello solo (sin que haya que arrastrarlo).
    if (to < inc.from + INCIDENT_REACT) continue;
    const who = presentFor(s, inc);
    if (who) {
      done(s, inc, 'bien');
      news.push(win(s, inc, who));
    }
  }
  night = false;
  // Sale mal al acabarse el tiempo, salvo que alguien vaya ya de camino.
  const list = s.incidents ?? [];
  const late = (i: Incident) => i.until <= to && !i.coming && !i.duel && !INCIDENTS[i.kind].night;
  for (const inc of list.filter(late)) news.push(fail(s, inc));
  s.incidents = list.filter((i) => !late(i));
  // Uno a la vez, desde el segundo día y con tiempo de resolverlo antes de que anochezca.
  if (s.day < INCIDENT_FROM_DAY || s.incidents.length || s.over) return out;
  const rng = new Rng(s.rng);
  const chance = Math.max(0, to - from) / INCIDENT_EVERY;
  if (rng.chance(chance)) {
    const kinds = (Object.keys(INCIDENTS) as IncidentKind[]).filter(
      (k) =>
        !INCIDENTS[k].night && places(s, k).length && to + INCIDENTS[k].secs < DUSK * DAY_SECONDS,
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
  return out;
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

/** Quien está de guardia y despierto ahora (no cabecea), si hay alguien. */
function awakeGuard(s: GameState, to: number): string | null {
  const guards = guardsOf(s);
  const nap = nappers(guards, Math.min(1, to / DAY_SECONDS), s.day);
  return guards.find((g) => !nap.includes(g)) ?? null;
}

/**
 * Si el gato puede cazar en una sala: vive en el salón (en uso) y va a las salas de su misma
 * planta. Pura con el edificio para que la escena lo mande a la misma sala.
 */
export function catHunts(b: Building, roomId: string): boolean {
  const salon = b.rooms.find(
    (r) => r.type === 'salon' && r.level > 0 && !(r.works && r.works.kind !== 'extend'),
  );
  const room = b.rooms.find((r) => r.id === roomId);
  return !!salon && !!room && room.floor === salon.floor;
}

/**
 * La casa se ayuda sola: el de guardia (despierto) va a separar la pelea del salón y entretiene
 * al recaudador en la puerta; el de guardia en la cámara se echa encima del ladrón (se avisa
 * igual: si no puede con él, aún se le puede cerrar el paso); el gato caza algunas ratas de
 * las salas de su planta (no todas). Devuelve la
 * noticia, si la hay. Muta `s` (una copia).
 */
function helpers(s: GameState, inc: Incident, to: number): IncidentNews | null {
  const set = (patch: Partial<Incident>) => {
    s.incidents = s.incidents!.map((i) => (i.id === inc.id ? { ...i, ...patch } : i));
  };
  if (to < inc.from + INCIDENT_REACT) return null;
  if (inc.kind === 'pelea') {
    const g = awakeGuard(s, to);
    if (!g) return null;
    // Deja la puerta un momento: va andando y la separa al llegar (como si se le mandara).
    set({ coming: { who: g, at: to + INCIDENT_WALK } });
    return { t: `${nameOf(s, g)} deja la puerta un momento para ir a separarlos.`, k: 'info' };
  }
  if (inc.kind === 'ladron' && !inc.duel) {
    const g = guardsAt(s, 'tesoro')[0];
    if (!g) return null;
    const duel = thiefDuel(s, g.id, inc.id, to);
    if (!duel) return null;
    set({ duel });
    return { t: `${g.name}, de guardia en la cámara, se echa encima del ladrón.`, k: 'info' };
  }
  if (inc.kind === 'recaudador' && !inc.held) {
    const g = awakeGuard(s, to);
    if (!g) return null;
    set({ held: g, until: inc.until + GUARD_HOLD });
    return {
      t: `${nameOf(s, g)}, de guardia, entretiene al recaudador en la puerta: hay algo más de tiempo.`,
      k: 'info',
    };
  }
  if (inc.kind === 'ratas' && catHunts(s.building, inc.room)) {
    // El gato ayuda (quita alguna, sin avisar de cada una) pero no remata: la última, siempre
    // para el jugador.
    let at = inc.cat ?? inc.from + CAT_FIRST;
    let taps = inc.taps ?? 0;
    let caught = inc.caught ?? 0;
    while (to >= at && taps > 1 && caught < CAT_MAX) {
      taps--;
      caught++;
      at += CAT_EVERY;
    }
    if (taps !== inc.taps || at !== inc.cat) set({ taps, cat: at, caught });
  }
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
  return reach(s, inc, who);
}

/** Llega quien iba: lo arregla; al ladrón, primero hay que ganarle la pelea. */
function reach(s: GameState, inc: Incident, who: string): IncidentNews | null {
  const duel = isThief(inc.kind) ? thiefDuel(s, who, inc.id, s.clock ?? 0) : null;
  if (!duel) {
    done(s, inc, 'bien');
    return win(s, inc, nameOf(s, who));
  }
  s.incidents = (s.incidents ?? []).map((i) => (i === inc ? { ...i, coming: undefined, duel } : i));
  return null;
}

/** Acaba el duelo con el ladrón: le pilla o se escapa con el oro. */
function settleDuel(s: GameState, inc: Incident): IncidentNews {
  const d = inc.duel!;
  if (INCIDENTS[inc.kind].night) return settleNight(s, inc);
  if (d.won) {
    done(s, inc, 'bien');
    return win(s, inc, nameOf(s, d.who));
  }
  const n = fail(s, inc);
  return { ...n, t: `${nameOf(s, d.who)} no puede con él. ${n.t}` };
}

/**
 * El de guardia que mira la puerta ahora (parte del día `part`), si hay alguien despierto. A la
 * hora de la siesta, si está solo, cabecea; si son dos, se turnan (cabecea uno y luego el otro).
 * Pura con los ids para que la escena enseñe lo mismo.
 */
export function napping(guards: readonly string[], part: number): string | null {
  const [a, b] = GUARD_NAP;
  if (!guards.length || part < a || part >= b) return null;
  if (guards.length === 1) return guards[0]!;
  return part < (a + b) / 2 ? guards[0]! : guards[1]!;
}

/** Un número de 0 a 1 que solo depende del id (el desfase de las cabezadas de cada uno). */
function idPhase(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Los de guardia que cabecean ahora (parte del día `part`). De día, el de la siesta (`napping`).
 * De noche, mini-cabezadas en ciclo: cada uno la parte `NIGHT_NAP_SHARE` de cada
 * `NIGHT_NAP_CYCLE` segundos; con dos, se turnan (el segundo, desfasado), pero hay un rato en que
 * cabecean los dos. Pura con el reloj, el día y los ids: la escena enseña lo mismo.
 */
export function nappers(guards: readonly string[], part: number, day = 0): string[] {
  if (part < WORK_END) {
    const n = napping(guards, part);
    return n ? [n] : [];
  }
  if (!guards.length) return [];
  // El desfase cambia cada noche (el día), para que no cabeceen siempre a la misma hora.
  const turn = (part * DAY_SECONDS) / NIGHT_NAP_CYCLE + idPhase(guards[0]!) + day * 0.618;
  return guards.filter((_, i) => (turn + i * NIGHT_NAP_TURN) % 1 < NIGHT_NAP_SHARE);
}

/** Los de guardia ahora en la puerta (en el orden de la lista de héroes). */
const guardsOf = (s: GameState) => guardsAt(s, 'puerta').map((h) => h.id);

/**
 * Sale mal. El ladrón que se escapa tiene que salir por el recibidor: si hay alguien de guardia
 * despierto, le cierra el paso (pelea con él, con las mismas cuentas que el duelo) y, si gana,
 * no se pierde nada. Si cabecea, se le cuela.
 */
function fail(s: GameState, inc: Incident): IncidentNews {
  const guards = guardsOf(s);
  if (inc.kind !== 'ladron' || !guards.length) {
    done(s, inc, 'mal');
    return lose(s, inc);
  }
  const part = Math.min(1, (s.clock ?? 0) / DAY_SECONDS);
  const nap = napping(guards, part);
  const awake = guards.find((g) => g !== nap);
  if (!awake) {
    done(s, inc, 'cuela', nap!);
    const n = lose(s, inc);
    return { ...n, t: `${nameOf(s, nap!)} cabeceaba en la puerta y se le cuela. ${n.t}` };
  }
  const duel = thiefDuel(s, awake, `${inc.id}-puerta`, s.clock ?? 0);
  if (duel?.won) {
    done(s, inc, 'puerta', awake);
    const d = INCIDENTS[inc.kind];
    if (d.rep) s.rep += d.rep;
    bump(s, 'incidents');
    bump(s, 'thieves');
    return {
      t: `${nameOf(s, awake)}, de guardia, le cierra el paso en la puerta y recupera el botín.${d.rep ? ` (+${d.rep} reputación)` : ''}`,
      k: 'good',
    };
  }
  done(s, inc, 'mal');
  const n = lose(s, inc);
  return { ...n, t: `Ni ${nameOf(s, awake)}, de guardia, le para. ${n.t}` };
}

/**
 * La pelea con el ladrón, golpe a golpe (con el motor de las peleas, `core/fight.ts`): un bandido
 * que huye con reloj. Si el héroe lo tumba antes de que pasen `THIEF_ESCAPE` segundos, le pilla;
 * si no, se escapa. Más duro con cada rango. Determinista con la semilla del incidente.
 */
export function thiefDuel(s: GameState, who: string, seed: string, at: number): Duel | null {
  const h = s.heroes.find((x) => x.id === who && x.status === 'ok');
  if (!h) return null;
  const u = heroUnit({ ...equip([h], s.fac)[0]!, id: h.id, name: h.name });
  const rank = rankIndex(s.rep);
  const hp = THIEF_HP + THIEF_HP_RANK * rank;
  const every = 1.1;
  const thief = {
    id: 'ladron',
    side: 'e' as const,
    hp,
    max: hp,
    atk: 3 + 1.5 * rank,
    def: 1,
    every,
    cool: every * 0.8,
  };
  const d = clockDuel({ ...u, hp: u.max }, thief, `ladron-${seed}`, THIEF_ESCAPE);
  const hits: DuelHit[] = d.hits.map((x) => ({ ...x, by: x.by === 'a' ? 'h' : 'l' }));
  return { who, at, end: d.t + 0.6, won: d.won, hits, hp: { h: u.max, l: hp } };
}

/** Un golpe del registro común, con su segundo (el duelo solo tiene golpes). */
export type DuelEvent = Extract<FightEvent, { kind: 'hit' }> & { t: number };

/** Los golpes del duelo con el registro común, para la escena (el ladrón es `ladron`). */
export function duelLog(d: Duel): DuelEvent[] {
  return d.hits.map((x) => {
    const [from, to] = x.by === 'h' ? [d.who, 'ladron'] : ['ladron', d.who];
    return { t: x.t, kind: 'hit', from, to, amount: x.amount, dealt: x.amount, crit: !!x.crit };
  });
}

/** Sale mal: se pierde lo que diga y se cuenta. */
function lose(s: GameState, inc: Incident): IncidentNews {
  const d = INCIDENTS[inc.kind];
  const l = d.loss;
  let n = 0;
  if (l.gold) n = Math.min(s.gold, l.gold);
  if (l.goldShare) n = Math.floor(s.gold * l.goldShare);
  if (l.goldTop) n = Math.min(n, l.goldTop * (1 + rankIndex(s.rep)));
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
  bump(s, 'incidents');
  if (isThief(inc.kind)) bump(s, 'thieves');
  return { t: fill(d.win, { h: who }) + (d.rep ? ` (+${d.rep} reputación)` : ''), k: 'good' };
}

// ---------- El ladrón nocturno ----------

/** Si el ladrón ha ido a la cámara (si no, a la caja del recibidor). */
const toVault = (s: GameState, inc: Incident) =>
  s.building.rooms.find((r) => r.id === inc.room)?.type === 'tesoro';

/** Despiertos al reloj `at` entre los de guardia `ids`, y los que cabecean. */
function awakeAt(s: GameState, ids: string[], at: number) {
  const nap = nappers(ids, Math.min(1, at / DAY_SECONDS), s.day);
  return { awake: ids.filter((g) => !nap.includes(g)), nap };
}

const repText = (n?: number) => (n ? ` (+${n} reputación)` : '');

/** Le pillan: la fama y se cuenta (el ladrón de más). Muta `s`. */
function caughtNight(s: GameState, inc: Incident, how: 'bien' | 'puerta', guard?: string) {
  done(s, inc, how, guard);
  const def = INCIDENTS[inc.kind];
  if (def.rep) s.rep += def.rep;
  bump(s, 'incidents');
  bump(s, 'thieves');
  return repText(def.rep);
}

const NIGHT_HEAD = 'Anoche entró un ladrón con un farol tapado.';

/**
 * El ladrón nocturno sale con el oro (reloj `at`; las cabezadas, a su hora `until`): si el de
 * guardia de ese sitio (la cámara o la puerta) está despierto, le sale al paso (el duelo, que la
 * escena enseña; con `now`, sin escena, se resuelve ya); si cabecea o no hay nadie, se escapa por
 * la puerta (`slip`). Muta `s`.
 */
function nightLate(s: GameState, inc: Incident, at: number, now: boolean): IncidentNews | null {
  const vault = toVault(s, inc);
  const ids = guardsAt(s, vault ? 'tesoro' : 'puerta').map((h) => h.id);
  const { awake, nap } = awakeAt(s, ids, inc.until);
  const duel = awake[0] ? thiefDuel(s, awake[0], inc.id, at) : null;
  if (duel) {
    const withDuel = { ...inc, duel };
    s.incidents = (s.incidents ?? []).map((i) => (i.id === inc.id ? withDuel : i));
    return now ? settleNight(s, withDuel) : null;
  }
  // En la cámara: si cabeceaba el de guardia, no le ve; aún queda la puerta.
  if (vault) {
    const lead = nap[0] ? `${nameOf(s, nap[0])} cabeceaba en la cámara y no le vio.` : '';
    return slip(s, inc, inc.until + NIGHT_THIEF_RUN, [], lead);
  }
  return slip(s, inc, inc.until, [], '');
}

/** Acaba el duelo del nocturno: le pilla o se escapa (y aún puede pararle la puerta). */
function settleNight(s: GameState, inc: Incident): IncidentNews {
  const d = inc.duel!;
  if (d.won)
    return {
      t: `${NIGHT_HEAD} ${nameOf(s, d.who)} le salió al paso y le pilló con las manos en la bolsa.${caughtNight(s, inc, 'bien')}`,
      k: 'good',
    };
  return slip(
    s,
    inc,
    d.at + d.end + NIGHT_THIEF_RUN,
    [d.who],
    `${nameOf(s, d.who)} le salió al paso, pero no pudo con él.`,
  );
}

/**
 * El nocturno escapa por la puerta (reloj `at`): si hay alguien de guardia despierto (que no sea
 * quien ya ha peleado), le cierra el paso; si cabecean, se cuela; si no, se va con el oro.
 */
function slip(
  s: GameState,
  inc: Incident,
  at: number,
  fought: string[],
  lead: string,
): IncidentNews {
  const ids = guardsOf(s).filter((g) => !fought.includes(g));
  const head = `${NIGHT_HEAD}${lead ? ` ${lead}` : ''}`;
  const where = toVault(s, inc) ? 'la cámara' : 'la caja';
  const take = (how: IncidentEnd['how'], guard?: string) => {
    const before = s.gold;
    done(s, inc, how, guard);
    lose(s, inc);
    return before - s.gold;
  };
  const { awake, nap } = awakeAt(s, ids, at);
  if (awake[0]) {
    const g = awake[0];
    const duel = thiefDuel(s, g, `${inc.id}-puerta`, at);
    if (duel?.won)
      return {
        t: `${head} ${nameOf(s, g)}, de guardia, le cerró el paso en la puerta y recuperó el botín.${caughtNight(s, inc, 'puerta', g)}`,
        k: 'good',
      };
    const n = take('mal');
    return {
      t: `${head} Ni ${nameOf(s, g)}, de guardia en la puerta, pudo pararle: se llevó ${n} monedas de ${where}.`,
      k: 'bad',
    };
  }
  if (nap[0]) {
    const n = take('cuela', nap[0]);
    return {
      t: `${head} ${nameOf(s, nap[0])} cabeceaba en la puerta y se le coló con ${n} monedas de ${where}.`,
      k: 'bad',
    };
  }
  const n = take('mal');
  return { t: `${head} Nadie le vio salir: se llevó ${n} monedas de ${where}.`, k: 'bad' };
}

/** Se acaba: fuera de la lista y, para la escena, cómo acabó (los últimos). */
const done = (s: GameState, inc: Incident, how: IncidentEnd['how'] = 'bien', guard?: string) => {
  s.incidents = (s.incidents ?? []).filter((i) => i.id !== inc.id);
  const e: IncidentEnd = { id: inc.id, kind: inc.kind, room: inc.room, how };
  if (guard) e.guard = guard;
  s.incidentLog = [...(s.incidentLog ?? []), e].slice(-6);
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
  for (const inc of [...(s.incidents ?? [])]) {
    // El nocturno sin tocar: el de guardia (si no cabecea) le sale al paso, ya.
    const going = !!inc.coming && canGo(s, inc, inc.coming.who);
    if (INCIDENTS[inc.kind].night && !inc.duel && !going) {
      events.push(nightLate(s, inc, inc.until, true)!);
      continue;
    }
    if (inc.duel) {
      events.push(settleDuel(s, inc));
      continue;
    }
    if (inc.coming && canGo(s, inc, inc.coming.who)) {
      const n = reach(s, inc, inc.coming.who);
      const now = s.incidents?.find((i) => i.id === inc.id);
      events.push(n ?? settleDuel(s, now!));
      continue;
    }
    events.push(fail(s, inc));
  }
  s.incidents = [];
}
