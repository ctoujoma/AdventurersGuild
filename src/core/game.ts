/**
 * La partida: estado inicial, acciones del jugador (reducer puro) y avance de día.
 * `reduce(state, action)` nunca muta el estado que recibe: copia y devuelve uno nuevo.
 */
import { FLAVOR } from '../data/stories';
import {
  BOARD_SIZE,
  CANDIDATE_EVERY,
  DAYS,
  DEBT,
  DESERT_CHANCE,
  MAX_CANDIDATES,
  RAISE_AMOUNT,
  RAISE_CHANCE,
  RAISE_MORALE,
  RANKS,
  REFUSE_MORALE,
  SCHEDULE,
  START,
  UPGRADE_COST,
  capacity,
  chapelRest,
  facilityMax,
  healRate,
  rankIndex,
  restCap,
  restMorale,
  returnChance,
  tavernIncome,
} from './balance';
import { tripDays } from './classes';
import { generateHero, generateQuest } from './generate';
import {
  SAVE_VERSION,
  type DawnEvent,
  type Facilities,
  type GameState,
  type Hero,
  type Quest,
} from './model';
import { MORALE_LOW, MORALE_QUIT } from './party';
import { resolveMission } from './resolve';
import { Rng } from './rng';
import { listNames, plural } from './text';

export type Action =
  | { type: 'hire'; id: string }
  | { type: 'fire'; id: string }
  | { type: 'send'; questId: string; heroIds: string[] }
  | { type: 'upgrade'; fac: keyof Facilities }
  | { type: 'sell'; itemId: string }
  | { type: 'read'; reportId: string }
  | { type: 'answer'; id: string; yes: boolean }
  | { type: 'equip'; heroId: string; itemId: string }
  | { type: 'unequip'; heroId: string }
  | { type: 'sellTrophy'; id: string }
  | { type: 'endDay' };

// ---------- Consultas ----------

const has = (h: Hero, id: string) => h.traits.some((t) => t.id === id);

/** Héroes que siguen en el gremio (ocupan cama aunque estén fuera). */
export const roster = (s: GameState) =>
  s.heroes.filter((h) => h.status !== 'muerto' && h.status !== 'desaparecido');
export const salaries = (s: GameState) => roster(s).reduce((a, h) => a + h.salary, 0);
export const rankOf = (s: GameState) => RANKS[rankIndex(s.rep)]!;
export const nextRank = (s: GameState) => RANKS[rankIndex(s.rep) + 1] ?? null;
export const nextPayment = (s: GameState) => SCHEDULE.find((p) => p.day > s.day) ?? null;
export const upgradeCost = (s: GameState, k: keyof Facilities) =>
  s.fac[k] >= facilityMax(k) ? null : UPGRADE_COST[k][s.fac[k] + 1]!;

export function canHire(s: GameState, id: string): string | null {
  const c = s.candidates.find((x) => x.id === id);
  if (!c) return 'Ese candidato ya no está.';
  if (roster(s).length >= capacity(s.fac.dorm))
    return 'No queda sitio en los dormitorios. Mejóralos en Gremio.';
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
  const proud = party.find((h) => h!.traits.some((t) => t.id === 'arrogante' && !t.hidden));
  if (proud && party.some((h) => h!.lvl < proud.lvl))
    return `${proud.name} no va con héroes de menor nivel.`;
  return null;
}

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
  const cost = upgradeCost(s, k);
  if (cost === null) return 'Ya está al máximo.';
  if (s.gold < cost) return `Te faltan ${cost - s.gold} monedas.`;
  return null;
}

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
    fac: { ...START.fac },
    heroes: [],
    candidates: [],
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
      { name: 'Fausto, tu tío', epitaph: 'No murió en una misión. Murió debiendo mil monedas.' },
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
        t: 'Toca el tablón de la sala para mandar grupos a los encargos. Vuelven con oro… si vuelven.',
      },
      { t: 'En la barra esperan candidatos. «Terminar día» hace pasar la noche.' },
      { t: `Paga la deuda en ${DAYS} días y el gremio será tuyo.`, k: 'good' },
    ],
    flavor:
      '«Sobrino: la taberna es tuya. Las deudas también. No te fíes de Merlo, ni del gato.» — Fausto',
    over: null,
  };
  // Un guerrero veterano de tu tío y alguien más; candidatos y encargos para empezar.
  for (let i = 0; i < START.heroes; i++) {
    const h = hero(s, rng, i === 0 ? 'guerrero' : undefined);
    h.history.push(i === 0 ? 'Ya trabajaba para tu tío' : 'Día 1 · Se queda en el gremio');
    s.heroes.push(h);
  }
  for (let i = 0; i < START.candidates; i++) s.candidates.push(hero(s, rng));
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
  return generateQuest(rng, `q${s.uid++}`, rankIndex(s.rep), `i${s.uid++}`);
}

// ---------- Acciones ----------

export function reduce(state: GameState, action: Action): GameState {
  if (state.over && action.type !== 'read') return state;
  switch (action.type) {
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
      s.gold += t.value;
      s.trophies = s.trophies.filter((x) => x.id !== t.id);
      return s;
    }
    case 'send': {
      if (canSend(state, action.questId, action.heroIds)) return state;
      const s = structuredClone(state);
      const q = s.quests.find((x) => x.id === action.questId)!;
      const party = action.heroIds.map((id) => s.heroes.find((x) => x.id === id)!);
      const days = tripDays(q, party);
      for (const h of party) {
        h.status = 'mision';
        h.days = days;
      }
      s.missions.push({
        id: `m${s.uid++}`,
        quest: { ...q, days, fresh: false },
        heroIds: [...action.heroIds],
        daysLeft: days,
      });
      s.quests = s.quests.filter((x) => x.id !== q.id);
      return s;
    }
    case 'upgrade': {
      if (canUpgrade(state, action.fac)) return state;
      const s = structuredClone(state);
      s.gold -= upgradeCost(s, action.fac)!;
      s.fac[action.fac]++;
      return s;
    }
    case 'sell': {
      const it = state.inventory.find((i) => i.id === action.itemId);
      if (!it) return state;
      const s = structuredClone(state);
      s.gold += it.value;
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
      delete x.request;
      if (action.yes) {
        x.salary += RAISE_AMOUNT;
        x.morale = Math.min(100, x.morale + RAISE_MORALE);
        x.history.push(`Día ${s.day} · Le subiste el sueldo`);
      } else {
        x.morale = Math.max(0, x.morale + REFUSE_MORALE);
        x.history.push(`Día ${s.day} · Le negaste el aumento`);
      }
      return s;
    }
    case 'endDay':
      return endDay(state);
  }
}

// ---------- Avance de día ----------

export function endDay(state: GameState): GameState {
  if (state.over) return state;
  const s = structuredClone(state);
  const rng = new Rng(s.rng);
  const events: DawnEvent[] = [];
  s.day++;

  const income = tavernIncome(s.fac.tab, s.rep, s.trophies.length);
  if (income) {
    s.gold += income;
    events.push({ t: `La taberna deja ${income} monedas.`, k: 'good' });
  }

  // Regresos.
  for (const m of s.missions) {
    m.daysLeft--;
    for (const id of m.heroIds) {
      const h = s.heroes.find((x) => x.id === id);
      if (h) h.days = m.daysLeft;
    }
  }
  for (const m of s.missions.filter((x) => x.daysLeft <= 0)) {
    const r = resolveMission(s, m, rng);
    s.reports.unshift(r);
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
      h.days -= healRate(s.fac.enf);
      if (h.days <= 0) {
        h.status = 'ok';
        h.days = 0;
        events.push({ t: `${h.name} vuelve a estar ${h.sex === 'f' ? 'lista' : 'listo'}.` });
      }
    } else if (h.status === 'desaparecido') {
      h.days--;
      if (h.days > 0) continue;
      if (rng.chance(returnChance(s.fac.cap))) {
        h.status = 'herido';
        h.days = 2;
        h.morale = Math.max(0, h.morale - 10);
        h.history.push(`Día ${s.day} · Volvió cuando ya nadie lo esperaba`);
        events.push({
          t: `¡${h.name} ha vuelto! Flaco, sucio y con una historia que nadie se cree.`,
          k: 'good',
        });
      } else {
        h.status = 'muerto';
        s.fallen.unshift({
          name: h.name + (h.nick ? ` «${h.nick}»` : ''),
          epitaph: `${h.sex === 'f' ? 'Desaparecida' : 'Desaparecido'}. Encontraron su capa el día ${s.day}.`,
        });
        events.push({ t: `Han encontrado la capa de ${h.name}. No volverá.`, k: 'bad' });
        delete h.item;
      }
    }
  }

  // Moral: se descansa en la taberna; quien está harto se va, quien está desanimado pide más.
  const deserters: Hero[] = [];
  for (const h of s.heroes) {
    if (h.status !== 'ok') continue;
    const cap = restCap(s.fac.tab) + (has(h, 'bebedor') && s.fac.tab >= 2 ? 10 : 0);
    const gain = restMorale(s.fac.tab) + chapelRest(s.fac.cap);
    if (h.morale < cap) h.morale = Math.min(cap, h.morale + gain);
    if (h.morale < MORALE_QUIT && !has(h, 'leal') && rng.chance(DESERT_CHANCE)) {
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

  // Tablón: caducan los viejos y llegan nuevos.
  for (const q of s.quests) {
    q.expires--;
    q.fresh = false;
  }
  const gone = s.quests.filter((q) => q.expires <= 0);
  if (gone.length) events.push({ t: `Caduca: ${listNames(gone.map((q) => q.title))}.` });
  s.quests = s.quests.filter((q) => q.expires > 0);
  let fresh = 0;
  while (s.quests.length < BOARD_SIZE(s.fac.tab, s.fac.mapas)) {
    s.quests.push(quest(s, rng));
    fresh++;
  }
  if (fresh)
    events.push({
      t: `${fresh} ${plural(fresh, 'encargo nuevo', 'encargos nuevos')} en el tablón.`,
    });

  // Candidatos.
  if (s.day % CANDIDATE_EVERY === 0) {
    const c = hero(s, rng);
    if (s.candidates.length >= MAX_CANDIDATES) {
      const left = s.candidates.shift()!;
      events.push({ t: `${left.name} se cansó de esperar en la barra.` });
    }
    s.candidates.push(c);
    events.push({ t: `En la barra hay alguien nuevo buscando trabajo: ${c.name}.` });
  }

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

  if (!s.over && s.day > DAYS) {
    const alive = roster(s).length;
    const score = s.gold + s.rep * 5 + alive * 50 + s.inventory.reduce((a, i) => a + i.value, 0);
    s.over = {
      kind: s.paid >= DEBT ? 'victoria' : 'derrota',
      text:
        s.paid >= DEBT
          ? `La deuda de tu tío está pagada. El Jarro Partido es tuyo: gremio de ${rankOf(s).name}, ${alive} ${plural(alive, 'héroe', 'héroes')} y ${s.gold} monedas en la caja.`
          : 'Se acabó el plazo y la deuda sigue ahí.',
      score,
    };
  }

  s.flavor = rng.pick(FLAVOR);
  s.dawn = events;
  s.rng = rng.save();
  return s;
}
