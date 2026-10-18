/**
 * La partida: estado inicial, acciones del jugador (reducer puro) y avance de día.
 * `reduce(state, action)` nunca muta el estado que recibe: copia y devuelve uno nuevo.
 */
import { earn, spill, vaultNews } from './vault';
import { FLAVOR } from '../data/stories';
import {
  MAX_GUARDS,
  BOARD_SIZE,
  CANDIDATE_EVERY,
  DAYS,
  DAY_SECONDS,
  DELIVERIES,
  DUSK,
  DEBT,
  DESERT_CHANCE,
  MAX_CANDIDATES,
  RAISE_AMOUNT,
  RAISE_CHANCE,
  RAISE_MORALE,
  CACHE,
  CACHE_REFUSE_MORALE,
  RANKS,
  REFUSE_MORALE,
  SALARY_EVERY,
  TRAINING_XP,
  VET_CAP,
  VET_LEVEL,
  VET_REST,
  UNPAID_LIMIT,
  UNPAID_MORALE,
  SCHEDULE,
  START,
  START_BEER,
  START_FOOD,
  chapelRest,
  healRate,
  rankIndex,
  restCap,
  restMorale,
  returnChance,
} from './balance';
import { tripDays } from './classes';
import {
  DECOR,
  FACADE,
  DEFAULT_NAME,
  DOG_PRICE,
  FEAST_MORALE,
  FEAST_PRICE,
  RAVEN_EVERY,
  RAVEN_PRICE,
  decorSlots,
  isFeastDay,
  type DecorId,
  type FacadeId,
} from '../data/custom';
import type { RoomType } from '../data/rooms';
import { arrival, checkFeats, checkMonth, emptyStats, startMonth } from './feats';
import { stepRaids } from './raids';
import { advanceChain, bossOf, fightRoster, offerChain } from './chains';
import { choose, maybeEvent, scaredClients, stepThreat } from './events';
import { generateHero, generateQuest } from './generate';
import {
  SAVE_VERSION,
  type DawnEvent,
  type Facilities,
  type GameState,
  type Hero,
  type Custom,
  type Quest,
  type Report,
} from './model';
import { MORALE_LOW, MORALE_QUIT } from './party';
import { levelUp, resolveMission } from './resolve';
import {
  applyPlan,
  beds,
  facOf,
  facilityCost,
  planBuild,
  planDemolish,
  planDig,
  planExtend,
  planFacility,
  planMove,
  planPlot,
  planStair,
  planUpgrade,
  laxly,
  problem,
  stepWorks,
  uncleBuilding,
  type ExtendDir,
  type Plan,
} from './rooms';
import { Rng } from './rng';
import { listNames, plural } from './text';
import { stepLarder } from './larder';
import { stepTraining } from './training';
import { brawlChance, noisyBeds, visitorList, visitorsOf } from './salon';
import {
  addSeeker,
  assign,
  bardPlaying,
  canAssign,
  canHireWorker,
  freeRoomFor,
  nurseBonus,
  stepWorkers,
  tidyJobs,
  villageCrew,
} from './workers';

export type Action =
  | { type: 'hire'; id: string }
  | { type: 'fire'; id: string }
  | { type: 'hireWorker'; id: string }
  | { type: 'fireWorker'; id: string }
  /** Poner a trabajar a un trabajador o a un héroe en una sala (null: deja de trabajar). */
  | { type: 'assign'; who: string; room: string | null }
  | { type: 'send'; questId: string; heroIds: string[] }
  | { type: 'upgrade'; fac: keyof Facilities }
  | { type: 'upgradeRoom'; id: string }
  | { type: 'build'; room: RoomType; col: number; floor: number }
  | { type: 'extend'; id: string; dir: ExtendDir }
  | { type: 'move'; id: string; col: number; floor: number }
  | { type: 'demolish'; id: string }
  | { type: 'dig'; col: number; floor: number }
  | { type: 'buyPlot' }
  | { type: 'addStair'; at: number }
  /** Varias obras seguidas (las del modo plano): se hacen todas o ninguna. */
  | { type: 'works'; steps: Action[] }
  | { type: 'sell'; itemId: string }
  | { type: 'read'; reportId: string }
  | { type: 'answer'; id: string; yes: boolean }
  | { type: 'equip'; heroId: string; itemId: string }
  | { type: 'unequip'; heroId: string }
  | { type: 'sellTrophy'; id: string }
  | { type: 'tip'; id: string }
  | { type: 'ackOpening' }
  | { type: 'guard'; id: string; on: boolean }
  | { type: 'choose'; index: number }
  | { type: 'custom'; patch: Partial<Pick<Custom, 'name' | 'color' | 'symbol'>> }
  | { type: 'buyDog' }
  | { type: 'decor'; id: DecorId; on: boolean }
  | { type: 'facade'; id: FacadeId }
  | { type: 'buyRaven' }
  | { type: 'feast' }
  /** El reloj del día avanza hasta `to` segundos (y la caja entrega lo que toque). */
  | { type: 'tick'; to: number }
  /** Saltar al anochecer. */
  | { type: 'dusk' }
  | { type: 'endDay' };

// ---------- Consultas ----------

const has = (h: Hero, id: string) => h.traits.some((t) => t.id === id);

/** Héroes que siguen en el gremio (ocupan cama aunque estén fuera). */
export const roster = (s: GameState) =>
  s.heroes.filter((h) => h.status !== 'muerto' && h.status !== 'desaparecido');
export const salaries = (s: GameState) =>
  roster(s).reduce((a, h) => a + h.salary, 0) + s.workers.reduce((a, w) => a + w.salary, 0);

/** La taberna tal como la ha dejado el jugador (o como la dejó el tío). */
export const customOf = (s: GameState): Custom =>
  s.custom ?? {
    name: DEFAULT_NAME,
    color: 'vino',
    symbol: 'jarra',
    dog: false,
  };
export const rankOf = (s: GameState) => RANKS[rankIndex(s.rep)]!;
export const nextRank = (s: GameState) => RANKS[rankIndex(s.rep) + 1] ?? null;
/** Próximo pago: cuota de la deuda más salarios, o solo salarios en modo libre. */
export const nextPayment = (s: GameState) =>
  s.mode === 'libre'
    ? { day: (Math.floor(s.day / SALARY_EVERY) + 1) * SALARY_EVERY, amount: 0 }
    : (SCHEDULE.find((p) => p.day > s.day) ?? null);

/** Lo que pide un héroe con petición pendiente. */
export const requestAmount = (h: Hero) =>
  h.request === 'cache' ? (CACHE[h.lvl] ?? CACHE[5]!) : RAISE_AMOUNT;
export const upgradeCost = (s: GameState, k: keyof Facilities) => facilityCost(s, k);

export function canHire(s: GameState, id: string): string | null {
  const c = s.candidates.find((x) => x.id === id);
  if (!c) return 'Ese candidato ya no está.';
  if (roster(s).length >= beds(s.building))
    return 'No queda sitio: mejora o amplía los dormitorios, o abre los cuartos de veteranos.';
  if (s.gold < c.fee) return `Te faltan ${c.fee - s.gold} monedas para la prima de fichaje.`;
  return null;
}

export function canSend(s: GameState, questId: string, heroIds: readonly string[]): string | null {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return 'Ese encargo ya no está en el tablón.';
  if (!heroIds.length) return 'Elige al menos un héroe.';
  if (heroIds.length > q.slots) return `Este encargo admite ${q.slots} como máximo.`;
  const party = heroIds.map((id) => s.heroes.find((h) => h.id === id));
  if (party.some((h) => !h || h.status !== 'ok')) return 'Alguien del grupo no está disponible.';
  const guard = party.find((h) => h!.guard);
  if (guard) return `${guard.name} está de guardia en la taberna.`;
  const proud = party.find((h) => h!.traits.some((t) => t.id === 'arrogante' && !t.hidden));
  if (proud && party.some((h) => h!.lvl < proud.lvl))
    return `${proud.name} no va con héroes de menor nivel.`;
  return null;
}

/** En el recibidor caben dos de guardia. */
export const guardsFull = (s: GameState) =>
  s.heroes.filter((h) => h.status === 'ok' && h.guard).length >= MAX_GUARDS;

/** Equipo del arcón que se puede poner (los tesoros solo se venden). */
export const gearInStock = (s: GameState) =>
  s.inventory.filter((i) => i.kind && i.kind !== 'tesoro');

export function canEquip(s: GameState, heroId: string, itemId: string): string | null {
  const h = s.heroes.find((x) => x.id === heroId);
  const it = s.inventory.find((x) => x.id === itemId);
  if (!h || !it) return 'Ese objeto ya no está.';
  if (!it.kind || it.kind === 'tesoro') return 'Esto no se equipa: se vende.';
  if (h.status !== 'ok' && h.status !== 'herido') return `${h.name} no está en el gremio.`;
  return null;
}

export function canUpgrade(s: GameState, k: keyof Facilities): string | null {
  const plan = planFacility(s, k);
  return 'error' in plan ? plan.error : null;
}

/** Obra pedida por el jugador: el plan dice si se puede y cómo queda el edificio. */
function planOf(s: GameState, a: Action): Plan | null {
  switch (a.type) {
    case 'upgrade':
      return planFacility(s, a.fac);
    case 'upgradeRoom':
      return planUpgrade(s, a.id);
    case 'build':
      return planBuild(s, a.room, a.col, a.floor);
    case 'extend':
      return planExtend(s, a.id, a.dir);
    case 'move':
      return planMove(s, a.id, a.col, a.floor);
    case 'demolish':
      return planDemolish(s, a.id);
    case 'dig':
      return planDig(s, a.col, a.floor);
    case 'buyPlot':
      return planPlot(s);
    case 'addStair':
      return planStair(s, a.at);
    default:
      return null;
  }
}

/** Por qué no se puede hacer una obra (o null si se puede). */
export function canWork(s: GameState, a: Action): string | null {
  const plan = planOf(s, a);
  return plan && 'error' in plan ? plan.error : null;
}

/** Hace una obra sobre una copia del estado, o dice por qué no se puede. */
export function tryWork(s: GameState, a: Action): GameState | { error: string } {
  const plan = planOf(s, a);
  if (!plan) return { error: 'Eso no es una obra.' };
  if ('error' in plan) return plan;
  const next = structuredClone(s);
  applyPlan(next, plan);
  tidyJobs(next);
  return next;
}

/**
 * Las obras de una lista (el plano), una tras otra; la primera que falla lo para todo. Por el
 * camino la casa puede quedar a medias (salas sin paso): eso solo se mira al final,
 * con `planIssue`, y el reducer no deja pagar hasta que cuadre.
 */
export function tryWorks(s: GameState, steps: readonly Action[]): GameState | { error: string } {
  return laxly(() => {
    let cur = s;
    for (const a of steps) {
      const next = tryWork(cur, a);
      if ('error' in next) return next;
      cur = next;
    }
    return cur;
  });
}

/** Lo que impide pagar el plano tal como está (salas sin paso desde el recibidor). */
export const planIssue = (s: GameState) => problem(s.building);

/** Una obra que solo se puede hacer en el plano (deja la casa a medias hasta otra obra). */
export const needsPlan = (s: GameState, a: Action) =>
  !!canWork(s, a) && !laxly(() => canWork(s, a));

// ---------- Partida nueva ----------

export function newGame(seed: string): GameState {
  const rng = new Rng(seed);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: 0,
    uid: 1,
    day: 1,
    gold: START.gold,
    rep: 0,
    paid: 0,
    clock: 0,
    till: 0,
    food: START_FOOD,
    beer: START_BEER,
    building: uncleBuilding(),
    fac: facOf(uncleBuilding()),
    heroes: [],
    candidates: [],
    workers: [],
    seekers: [],
    quests: [],
    missions: [],
    reports: [],
    inventory: [],
    trophies: [],
    fallen: [
      {
        name: 'Aldric «Medio Pan»',
        epitaph: 'Mina de Hondogrís, en tiempos de tu tío. Pidió media ración hasta el final.',
      },
      { name: 'Fausto, tu tío', epitaph: 'Murió en su cama, debiendo mil monedas a medio pueblo.' },
    ],
    dawn: [
      {
        t: 'Tu tío Fausto te ha dejado El Jarro Partido… y mil monedas de deuda con Merlo, el prestamista.',
        k: 'warn',
      },
      {
        t: `Cada 7 días toca pagar: ${SCHEDULE.map((p) => p.amount).join(', ')}, más los salarios de tus héroes.`,
        k: 'bad',
      },
      {
        t: 'Toca el tablón de la sala para mandar grupos a los encargos. Si sale bien, vuelven con oro.',
      },
      { t: 'En la barra esperan candidatos. «Terminar día» hace pasar la noche.' },
      { t: `Paga la deuda en ${DAYS} días y el gremio será tuyo.`, k: 'good' },
    ],
    mode: 'deuda',
    stats: emptyStats(),
    feats: {},
    flavor:
      '«Sobrino: la taberna es tuya, con sus deudas. A Merlo págale a tiempo, que no perdona. El gato viene con la casa.» — Fausto',
    over: null,
  };
  // Un guerrero veterano de tu tío y alguien más; candidatos y encargos para empezar.
  for (let i = 0; i < START.heroes; i++) {
    const h = hero(s, rng, i === 0 ? 'guerrero' : undefined);
    h.history.push(i === 0 ? 'Ya trabajaba para tu tío' : 'Día 1 · Se queda en el gremio');
    s.heroes.push(h);
  }
  for (let i = 0; i < START.candidates; i++) s.candidates.push(hero(s, rng));
  // Los tres del pueblo, cada uno en lo suyo.
  for (const w of villageCrew(s)) {
    w.room = freeRoomFor(s, w.trade)?.id;
    s.workers.push(w);
  }
  for (let i = 0; i < START.quests; i++) s.quests.push(quest(s, rng));
  s.rng = rng.save();
  return s;
}

function hero(s: GameState, rng: Rng, cls?: Hero['cls']): Hero {
  return generateHero(rng, `h${s.uid++}`, {
    rank: rankIndex(s.rep),
    tab: s.fac.tab,
    cls,
    usedNames: [...s.heroes, ...s.candidates].map((h) => h.name),
  });
}

function quest(s: GameState, rng: Rng): Quest {
  return generateQuest(rng, `q${s.uid++}`, rankIndex(s.rep), `i${s.uid++}`, s.mode === 'libre');
}

// ---------- Acciones ----------

export function reduce(state: GameState, action: Action): GameState {
  if (state.over && action.type !== 'read' && action.type !== 'tip') return state;
  const plan = planOf(state, action);
  if (plan) {
    if ('error' in plan) return state;
    const s = structuredClone(state);
    applyPlan(s, plan);
    tidyJobs(s);
    return s;
  }
  switch (action.type) {
    case 'works': {
      const next = tryWorks(state, action.steps);
      return 'error' in next || planIssue(next) ? state : next;
    }
    case 'hire': {
      if (canHire(state, action.id)) return state;
      const s = structuredClone(state);
      const c = s.candidates.find((x) => x.id === action.id)!;
      s.gold -= c.fee;
      s.candidates = s.candidates.filter((x) => x !== c);
      c.history.push(`Día ${s.day} · ${c.sex === 'f' ? 'Contratada' : 'Contratado'}`);
      s.heroes.push(c);
      return s;
    }
    case 'fire': {
      const h = state.heroes.find((x) => x.id === action.id);
      if (!h || h.status !== 'ok') return state;
      const s = structuredClone(state);
      // Lo que llevaba es del gremio: vuelve al arcón.
      if (h.item) s.inventory.push(structuredClone(h.item));
      s.heroes = s.heroes.filter((x) => x.id !== action.id);
      return s;
    }
    case 'hireWorker': {
      if (canHireWorker(state, action.id)) return state;
      const s = structuredClone(state);
      const w = s.seekers.find((x) => x.id === action.id)!;
      s.gold -= w.fee;
      s.seekers = s.seekers.filter((x) => x !== w);
      w.room = freeRoomFor(s, w.trade)?.id;
      s.workers.push(w);
      return s;
    }
    case 'fireWorker': {
      if (!state.workers.some((w) => w.id === action.id)) return state;
      return { ...state, workers: state.workers.filter((w) => w.id !== action.id) };
    }
    case 'assign': {
      if (canAssign(state, action.who, action.room)) return state;
      const s = structuredClone(state);
      assign(s, action.who, action.room);
      return s;
    }
    case 'equip': {
      if (canEquip(state, action.heroId, action.itemId)) return state;
      const s = structuredClone(state);
      const h = s.heroes.find((x) => x.id === action.heroId)!;
      const it = s.inventory.find((x) => x.id === action.itemId)!;
      s.inventory = s.inventory.filter((x) => x !== it);
      if (h.item) s.inventory.push(h.item);
      h.item = it;
      return s;
    }
    case 'unequip': {
      const h = state.heroes.find((x) => x.id === action.heroId);
      if (!h?.item || (h.status !== 'ok' && h.status !== 'herido')) return state;
      const s = structuredClone(state);
      const x = s.heroes.find((y) => y.id === action.heroId)!;
      s.inventory.push(x.item!);
      delete x.item;
      return s;
    }
    case 'sellTrophy': {
      const t = state.trophies.find((x) => x.id === action.id);
      if (!t) return state;
      const s = structuredClone(state);
      earn(s, t.value);
      s.trophies = s.trophies.filter((x) => x.id !== t.id);
      return s;
    }
    case 'send': {
      if (canSend(state, action.questId, action.heroIds)) return state;
      const s = structuredClone(state);
      const q = s.quests.find((x) => x.id === action.questId)!;
      const party = action.heroIds.map((id) => s.heroes.find((x) => x.id === id)!);
      const days = tripDays(q, party, s.fac.establo);
      for (const h of party) {
        h.status = 'mision';
        h.days = days;
        delete h.job;
      }
      s.missions.push({
        id: `m${s.uid++}`,
        quest: { ...q, days, fresh: false },
        heroIds: [...action.heroIds],
        daysLeft: days,
      });
      s.quests = s.quests.filter((x) => x.id !== q.id);
      if (!(s.explored ??= []).includes(q.place)) s.explored.push(q.place);
      return s;
    }
    case 'sell': {
      const it = state.inventory.find((i) => i.id === action.itemId);
      if (!it) return state;
      const s = structuredClone(state);
      earn(s, it.value);
      s.inventory = s.inventory.filter((i) => i.id !== it.id);
      return s;
    }
    case 'read': {
      const r = state.reports.find((x) => x.id === action.reportId);
      if (!r || r.read) return state;
      const s = structuredClone(state);
      s.reports.find((x) => x.id === action.reportId)!.read = true;
      return s;
    }
    case 'answer': {
      const h = state.heroes.find((x) => x.id === action.id);
      if (!h?.request) return state;
      const s = structuredClone(state);
      const x = s.heroes.find((y) => y.id === action.id)!;
      const amount = requestAmount(x);
      const cache = x.request === 'cache';
      delete x.request;
      if (action.yes) {
        x.salary += amount;
        x.morale = Math.min(100, x.morale + RAISE_MORALE);
        x.history.push(`Día ${s.day} · ${cache ? 'Le pagaste su caché' : 'Le subiste el sueldo'}`);
      } else {
        x.morale = Math.max(0, x.morale + (cache ? CACHE_REFUSE_MORALE : REFUSE_MORALE));
        x.history.push(`Día ${s.day} · ${cache ? 'Le negaste el caché' : 'Le negaste el aumento'}`);
      }
      return s;
    }
    case 'custom': {
      const patch = { ...action.patch };
      if (patch.name !== undefined) patch.name = patch.name.trim().slice(0, 24) || DEFAULT_NAME;
      return { ...state, custom: { ...customOf(state), ...patch } };
    }
    case 'buyDog': {
      const c = customOf(state);
      if (c.dog || state.gold < DOG_PRICE) return state;
      return { ...state, gold: state.gold - DOG_PRICE, custom: { ...c, dog: true } };
    }
    case 'decor': {
      const c = customOf(state);
      const list = c.decor ?? [];
      if (list.includes(action.id) === action.on) return state;
      if (!action.on)
        return { ...state, custom: { ...c, decor: list.filter((x) => x !== action.id) } };
      const price = DECOR[action.id].price;
      if (state.gold < price || list.length >= decorSlots(state.fac.tab)) return state;
      return { ...state, gold: state.gold - price, custom: { ...c, decor: [...list, action.id] } };
    }
    case 'facade': {
      const c = customOf(state);
      const list = c.facade ?? [];
      const price = FACADE[action.id].price;
      if (list.includes(action.id) || state.gold < price) return state;
      return { ...state, gold: state.gold - price, custom: { ...c, facade: [...list, action.id] } };
    }
    case 'buyRaven': {
      const c = customOf(state);
      if (c.raven || state.gold < RAVEN_PRICE) return state;
      return { ...state, gold: state.gold - RAVEN_PRICE, custom: { ...c, raven: true } };
    }
    case 'feast': {
      const c = customOf(state);
      if (!isFeastDay(state.day) || c.feast === state.day || state.gold < FEAST_PRICE) return state;
      return { ...state, gold: state.gold - FEAST_PRICE, custom: { ...c, feast: state.day } };
    }
    case 'choose': {
      if (!state.event) return state;
      const s = structuredClone(state);
      const rng = new Rng(s.rng);
      choose(s, rng, action.index);
      s.rng = rng.save();
      return s;
    }
    case 'guard': {
      const h = state.heroes.find((x) => x.id === action.id);
      if (!h || h.status !== 'ok' || !!h.guard === action.on) return state;
      if (action.on && guardsFull(state)) return state;
      const s = structuredClone(state);
      const g = s.heroes.find((x) => x.id === action.id)!;
      g.guard = action.on || undefined;
      // De guardia no se puede estar a la vez en la cocina.
      if (action.on) delete g.job;
      return s;
    }
    case 'ackOpening': {
      if (!state.opening || state.opening.seen) return state;
      return { ...state, opening: { ...state.opening, seen: true } };
    }
    case 'tip': {
      if (state.tips?.includes(action.id)) return state;
      return { ...state, tips: [...(state.tips ?? []), action.id] };
    }
    case 'tick':
      return tick(state, action.to);
    case 'dusk':
      return tick(state, DUSK * DAY_SECONDS);
    case 'endDay':
      return endDay(state);
    default:
      return state;
  }
}

// ---------- Avance de día ----------

/** Vuelve un grupo de rescate: si ha ido bien, traen a quien estaba perdido. */
function rescue(s: GameState, id: string, r: Report, events: DawnEvent[]): void {
  const h = s.heroes.find((x) => x.id === id);
  if (!h || h.status !== 'desaparecido') return;
  if (r.outcome === 'Fracaso' || r.outcome === 'Desastre') {
    r.body.push(`No encontraron ni rastro de ${h.name}.`);
    return;
  }
  h.status = 'herido';
  h.days = 2;
  h.morale = Math.min(100, h.morale + 10);
  h.history.push(`Día ${s.day} · Rescatado por ${r.who}`);
  r.heading = 'Rescate';
  r.body.push(
    `Encontraron a ${h.name} escondido en una cueva, con hambre y muchas ganas de volver.`,
  );
  r.chips.push({ t: `${h.name} vuelve a casa`, k: 'good' });
  events.push({ t: `¡${r.who} ha rescatado a ${h.name}!`, k: 'good' });
}

/** Lo que deja la taberna el día `day`: los visitantes atendidos, la decoración y la fiesta. */
export function dayIncome(s: GameState, day: number): number {
  const c = customOf(s);
  const decor = c.decor ?? [];
  const bard = s.fac.tab > 0 && bardPlaying(s);
  // La fiesta montada ese día dobla la caja.
  const feast = c.feast === day;
  return (
    (visitorsOf(s, day).coins +
      (bard && decor.includes('tarima') ? 8 : 0) +
      (decor.includes('naipes') ? 6 : 0) +
      (decor.includes('barril') ? 2 : 0)) *
    (feast ? 2 : 1)
  );
}

/** Parte del día que ha pasado (0 por la mañana, 1 de noche). */
export const dayPart = (s: GameState) => Math.min(1, (s.clock ?? 0) / DAY_SECONDS);

/** La taberna solo se cierra al anochecer. */
export const canClose = (s: GameState) => dayPart(s) >= DUSK;

/** Avanza el reloj y entrega la caja que toque a esa hora (en entregas iguales). */
function tick(state: GameState, to: number): GameState {
  const clock = Math.min(DAY_SECONDS, Math.max(state.clock ?? 0, to));
  if (clock === (state.clock ?? 0)) return state;
  const s = { ...state, clock };
  const n = Math.min(DELIVERIES, Math.floor((clock / (DUSK * DAY_SECONDS)) * DELIVERIES));
  const due = Math.floor((dayIncome(s, s.day) * n) / DELIVERIES);
  const till = s.till ?? 0;
  if (due > till) {
    earn(s, due - till);
    s.till = due;
  }
  return s;
}

export function endDay(state: GameState): GameState {
  if (state.over) return state;
  const s = structuredClone(state);
  const rng = new Rng(s.rng);
  const events: DawnEvent[] = [];
  s.day++;
  stepWorks(s, events);
  tidyJobs(s);

  // La amenaza regional puede llevarse los ingresos del día (caravana asaltada).
  const c0 = customOf(s);
  const decor = c0.decor ?? [];
  const feast = c0.feast === s.day - 1;
  const income = dayIncome(s, s.day - 1);
  const visits = visitorsOf(s, s.day - 1);
  const lost = stepThreat(s, rng, events, income);
  // Lo que la caja ya entregó durante el día no se cobra otra vez.
  s.gold += income - lost - (s.till ?? 0);
  s.clock = 0;
  s.till = 0;
  if (income - lost > 0) {
    events.push({
      t: `${visits.total ? `Vinieron ${visitorList(visits)}${visits.served < visits.total ? ` (se atendió a ${visits.served})` : ''}. ` : ''}${visits.fed < visits.served ? `Faltó comida: ${visits.served - visits.fed} solo ${visits.served - visits.fed === 1 ? 'bebió' : 'bebieron'}. ` : ''}La taberna deja ${income - lost} monedas${feast ? ': ¡la fiesta ha llenado el salón!' : '.'}`,
      k: 'good',
    });
  }
  if (feast)
    for (const h of s.heroes)
      if (h.status === 'ok') h.morale = Math.min(100, h.morale + FEAST_MORALE);
  // Tapices y cuervo: la fama del gremio se extiende.
  if (decor.includes('tapices') && s.day % 7 === 0) s.rep += 1;
  if (c0.raven && s.day % RAVEN_EVERY === 0) {
    s.rep += 1;
    events.push({
      t: 'El cuervo vuelve de otro pueblo: allí ya se habla del gremio (+1 reputación).',
    });
  }
  // Lo que traen los visitantes: fama de los nobles, ojos de los espías y alguna pelea.
  if (visits.kinds.noble) {
    s.rep += visits.kinds.noble;
    events.push({
      t: `${visits.kinds.noble === 1 ? 'Un noble ha cenado' : 'Unos nobles han cenado'} en el salón: se hablará del gremio (+${visits.kinds.noble} reputación).`,
      k: 'good',
    });
  }
  if (visits.kinds.espia) {
    const guard = s.heroes.find((h) => h.status === 'ok' && h.guard);
    if (guard) {
      s.rep += 1;
      events.push({
        t: `${guard.name} caló a un forastero que miraba demasiado la puerta de la cámara: era un espía de los bandidos y salió corriendo.`,
        k: 'good',
      });
    } else s.scout = s.day - 1;
  }
  if (rng.chance(brawlChance(s, visits))) {
    const home = s.heroes.filter((h) => h.status === 'ok');
    const guard = home.find((h) => h.guard);
    if (guard)
      events.push({
        t: `Pelea en el salón${decor.includes('naipes') ? ' por una partida de naipes' : ''}: ${guard.name}, que estaba de guardia, la cortó en un momento.`,
      });
    else if (home.length) {
      const h = rng.pick(home);
      h.morale = Math.max(0, h.morale - 6);
      events.push({
        t: `Pelea en el salón${decor.includes('naipes') ? ' por una partida de naipes' : ''}: ${h.name} se llevó un par de golpes separando a los que se pegaban.`,
        k: 'warn',
      });
    } else {
      const broken = Math.min(s.gold, rng.int(6, 16));
      s.gold -= broken;
      events.push({
        t: `Pelea en el salón y nadie de los nuestros para pararla: ${broken} monedas en sillas y jarras rotas.`,
        k: 'bad',
      });
    }
  }
  if (isFeastDay(s.day))
    events.push({
      t: 'Hoy es la fiesta de la comarca: si montas la fiesta en la taberna, la caja lo notará.',
    });

  // Regresos.
  for (const m of s.missions) {
    m.daysLeft--;
    for (const id of m.heroIds) {
      const h = s.heroes.find((x) => x.id === id);
      if (h) h.days = m.daysLeft;
    }
  }
  s.lastFight = null;
  for (const m of s.missions.filter((x) => x.daysLeft <= 0)) {
    const boss = bossOf(m.quest);
    const roster = boss ? fightRoster(s.heroes.filter((h) => m.heroIds.includes(h.id))) : null;
    const r = resolveMission(s, m, rng);
    s.reports.unshift(r);
    if (boss && roster) {
      // La pelea contra el jefe queda en el informe para verla al amanecer o más tarde.
      for (const x of roster) x.fate = s.heroes.find((h) => h.id === x.id)?.status ?? 'muerto';
      r.fight = {
        boss,
        place: m.quest.place,
        won: r.outcome !== 'Fracaso' && r.outcome !== 'Desastre',
        heroes: roster,
      };
      s.lastFight = r.id;
    }
    if (m.quest.chain) advanceChain(s, rng, m.quest, r, events);
    if (m.quest.rescue) rescue(s, m.quest.rescue, r, events);
    const bad = r.outcome === 'Fracaso' || r.outcome === 'Desastre';
    events.push({
      t: `${plural(r.heroIds.length, 'Vuelve', 'Vuelven')} ${r.who}: ${r.outcome.toLowerCase()}.`,
      k: bad ? 'bad' : 'good',
    });
  }
  s.missions = s.missions.filter((x) => x.daysLeft > 0);

  // Curación y desaparecidos.
  for (const h of s.heroes) {
    if (h.status === 'herido') {
      h.days -= healRate(s.fac.enf) + nurseBonus(s);
      if (h.days <= 0) {
        h.status = 'ok';
        h.days = 0;
        events.push({ t: `${h.name} vuelve a estar ${h.sex === 'f' ? 'lista' : 'listo'}.` });
      }
    } else if (h.status === 'desaparecido') {
      // Mientras haya un grupo buscándole, no se le da por perdido.
      if (s.missions.some((m) => m.quest.rescue === h.id)) continue;
      h.days--;
      if (h.days > 0) continue;
      if (rng.chance(returnChance(s.fac.cap))) {
        h.status = 'herido';
        h.days = 2;
        h.morale = Math.max(0, h.morale - 10);
        h.history.push(`Día ${s.day} · Volvió cuando ya nadie lo esperaba`);
        const toughened = !h.traits.some((t) => t.id === 'curtido');
        if (toughened) h.traits.push({ id: 'curtido' });
        events.push({
          t: `¡${h.name} ha vuelto! Con hambre, lleno de barro y con ganas de contarlo todo.${toughened ? ` Ahora ${h.sex === 'f' ? 'es curtida' : 'es curtido'}: +2 Supervivencia.` : ''}`,
          k: 'good',
        });
      } else {
        h.status = 'muerto';
        s.fallen.unshift({
          name: h.name + (h.nick ? ` «${h.nick}»` : ''),
          epitaph: `${h.sex === 'f' ? 'Desaparecida' : 'Desaparecido'}. Encontraron su capa el día ${s.day}.`,
        });
        events.push({ t: `Han encontrado la capa de ${h.name}. No volverá.`, k: 'bad' });
        if (s.stats) s.stats.lastDeath = s.day;
        delete h.item;
      }
    }
  }

  // Patio de entrenamiento: quien descansa en casa también aprende.
  if (s.fac.patio > 0)
    for (const h of s.heroes) {
      if (h.status !== 'ok') continue;
      h.xp += TRAINING_XP[s.fac.patio] ?? 0;
      for (const t of levelUp(s, h))
        events.push({
          t: `${t} entrenando en el patio.`,
          k: t.includes('caché') ? 'warn' : 'good',
        });
    }

  // Salas de entrenamiento: quien entrena suma el día y quizá sube un punto.
  stepTraining(s, events);

  // Comida y cerveza: lo que tomaron los visitantes, lo que han hecho las salas y la cena.
  stepLarder(s, visits, events);
  const decorMorale =
    (decor.includes('tarima') ? 2 : 0) +
    (decor.includes('barril') ? 1 : 0) +
    (decor.includes('chimenea') ? 1 : 0) -
    (noisyBeds(s.building) ? 1 : 0);

  // Moral: se descansa en la taberna; quien está harto se va, quien está desanimado pide más.
  const deserters: Hero[] = [];
  for (const h of s.heroes) {
    if (h.status !== 'ok') continue;
    const vet = h.lvl >= VET_LEVEL ? s.fac.vet : 0;
    const cap = restCap(s.fac.tab) + (has(h, 'bebedor') && s.fac.tab >= 2 ? 10 : 0) + VET_CAP[vet]!;
    const gain = restMorale(s.fac.tab) + chapelRest(s.fac.cap) + decorMorale + VET_REST[vet]!;
    if (h.morale < cap) h.morale = Math.min(cap, h.morale + gain);
    if (h.morale < MORALE_QUIT && !has(h, 'leal') && vet < 2 && rng.chance(DESERT_CHANCE)) {
      deserters.push(h);
      continue;
    }
    if (h.morale < MORALE_LOW && !h.request && rng.chance(RAISE_CHANCE)) {
      h.request = 'raise';
      events.push({
        t: `${h.name} quiere hablar contigo: pide ${RAISE_AMOUNT} monedas más de sueldo.`,
        k: 'warn',
      });
    }
  }
  if (deserters.length) {
    s.heroes = s.heroes.filter((h) => !deserters.includes(h));
    for (const h of deserters)
      events.push({
        t: `${h.name} ha recogido sus cosas antes del alba. Estaba ${h.sex === 'f' ? 'harta' : 'harto'}.${h.item ? ` Se ha llevado ${h.item.name.toLowerCase()}.` : ''}`,
        k: 'bad',
      });
  }

  // Asaltos: chivatazos y, si toca esta noche, la pelea en el patio.
  s.lastRaid = null;
  const raidReport = stepRaids(s, rng, events);
  if (raidReport) s.reports.unshift(raidReport);

  // Rescates que ya no hacen falta (volvió o cayó).
  s.quests = s.quests.filter(
    (q) => !q.rescue || s.heroes.some((h) => h.id === q.rescue && h.status === 'desaparecido'),
  );

  // Tablón: caducan los viejos y llegan nuevos.
  for (const q of s.quests) {
    q.expires--;
    q.fresh = false;
  }
  const gone = s.quests.filter((q) => q.expires <= 0);
  if (gone.length) events.push({ t: `Caduca: ${listNames(gone.map((q) => q.title))}.` });
  s.quests = s.quests.filter((q) => q.expires > 0);
  let fresh = 0;
  while (
    s.quests.filter((q) => !q.chain && !q.rescue).length <
    BOARD_SIZE(s.fac.tab, s.fac.mapas) + (s.fac.torre >= 2 ? 1 : 0) - scaredClients(s)
  ) {
    s.quests.push(quest(s, rng));
    fresh++;
  }
  if (fresh)
    events.push({
      t: `${fresh} ${plural(fresh, 'encargo nuevo', 'encargos nuevos')} en el tablón.`,
    });

  // Candidatos: entre los visitantes viene algún aventurero (más cuanta más gente).
  if (rng.chance(Math.min(0.9, (0.5 + visits.total / 10) / CANDIDATE_EVERY))) {
    const c = hero(s, rng);
    if (s.candidates.length >= MAX_CANDIDATES) {
      const left = s.candidates.shift()!;
      events.push({ t: `${left.name} se cansó de esperar en la barra.` });
    }
    s.candidates.push(c);
    events.push({ t: `En la barra hay alguien nuevo buscando trabajo: ${c.name}.` });
  }

  // Trabajadores: cogen maña y, desde el día 30, viene gente a pedir trabajo.
  stepWorkers(s, rng, events, visits.total);

  // Cadenas de misiones: carta del siguiente cliente cuando toca.
  offerChain(s, rng, events);

  // Día de pago.
  const pay = SCHEDULE.find((p) => p.day === s.day);
  if (pay) {
    const wages = salaries(s);
    const total = wages + pay.amount;
    if (s.gold >= total) {
      s.gold -= total;
      s.paid += pay.amount;
      events.push({
        t: `Día de pago: ${wages} en salarios y ${pay.amount} al prestamista.`,
        k: 'warn',
      });
    } else {
      s.over = {
        kind: 'derrota',
        text: `Día ${s.day}: debías ${total} monedas (${pay.amount} de deuda y ${wages} de salarios) y solo tenías ${s.gold}. Merlo, el prestamista, se queda con la taberna.`,
        score: 0,
      };
      events.push({ t: 'No llegas al pago. El prestamista se queda con la taberna.', k: 'bad' });
    }
  }

  // Modo libre: cada semana, salarios. Dos impagos seguidos y el gremio quiebra.
  if (s.mode === 'libre' && s.day % SALARY_EVERY === 0) {
    const wages = salaries(s);
    if (s.gold >= wages) {
      s.gold -= wages;
      s.unpaid = 0;
      if (wages) events.push({ t: `Día de pago: ${wages} monedas en salarios.`, k: 'warn' });
    } else {
      s.unpaid = (s.unpaid ?? 0) + 1;
      for (const h of roster(s)) h.morale = Math.max(0, h.morale + UNPAID_MORALE);
      if (s.unpaid >= UNPAID_LIMIT)
        s.over = {
          kind: 'derrota',
          text: `Día ${s.day}: otra semana sin pagar salarios. Los héroes se marchan, los acreedores se llevan los muebles y ${customOf(s).name} cierra.`,
          score: arrival(s, roster(s).length).score,
        };
      else
        events.push({
          t: `No llegas a pagar los salarios (${wages}). Los héroes se quejan; si se repite la semana que viene, el gremio quiebra.`,
          k: 'bad',
        });
    }
  }

  // Fin de «La deuda»: si está pagada, el gremio es tuyo y empieza la aventura.
  if (!s.over && s.mode !== 'libre' && s.day > DAYS) {
    const alive = roster(s).length;
    if (s.paid >= DEBT) {
      s.mode = 'libre';
      s.opening = { ...arrival(s, alive), seen: false };
      startMonth(s, rng);
      // Con las obras llega también gente a pedir trabajo (y el dormitorio del servicio).
      for (let i = 0; i < 2; i++) addSeeker(s, rng, events);
      events.push({
        t: `La deuda de tu tío está pagada. ${customOf(s).name} es tuyo: gremio de ${rankOf(s).name}, ${alive} ${plural(alive, 'héroe', 'héroes')} y ${s.gold} monedas en la caja.`,
        k: 'good',
      });
    } else s.over = { kind: 'derrota', text: 'Se acabó el plazo y la deuda sigue ahí.', score: 0 };
  }

  if (!s.over) {
    checkFeats(s, rng, events);
    checkMonth(s, rng, events);
    maybeEvent(s, rng);
  }

  // Lo que no cabe en la cámara del tesoro se pierde.
  const kept = spill(s);
  s.gold = kept.gold;
  s.spilt = kept.spilt;
  vaultNews(s, events);

  s.flavor = rng.pick(FLAVOR);
  s.dawn = events;
  s.rng = rng.save();
  return s;
}
