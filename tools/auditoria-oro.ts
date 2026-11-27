/**
 * Auditoría del oro: de dónde sale, cuánto y contra qué gastos. Saca un JSON con todo (para la
 * página de resultados) y un resumen por consola. No se usa en el juego.
 * Uso: `npm run auditoria -- <salida.json> [partidas] [días de modo libre]`.
 */
import { writeFileSync } from 'node:fs';
import * as B from '../src/core/balance';
import { CHAINS } from '../src/data/chains';
import { GOALS } from '../src/data/goals';
import { FEATS } from '../src/data/feats';
import { DECOR, FACADE, RAVEN_PRICE, FEAST_PRICE, DOG_PRICE } from '../src/data/custom';
import { RECIPES } from '../src/data/recipes';
import { GEAR, TREASURES } from '../src/data/items';
import { VISITORS } from '../src/data/visitors';
import { generateHero, generateQuest } from '../src/core/generate';
import { Rng } from '../src/core/rng';
import { idText } from '../src/textos';
import { priceOf, slotOf } from '../src/core/gear';
import { crafted } from '../src/core/crafting';
import { MAIN_ATTR, questEstimate } from '../src/core/resolve';
import { emptyStats } from '../src/core/feats';
import {
  canHire,
  canUpgrade,
  dayIncome,
  nextPayment,
  newGame,
  reduce,
  roster,
  salaries,
  upgradeCost,
} from '../src/core/game';
import { catchUp } from '../src/core/away';
import { settleWalks } from '../src/core/workers';
import { vaultFull, vaultOf, goldCap } from '../src/core/vault';
import {
  HEADINGS,
  HOUR,
  callBack,
  canExpedition,
  distAt,
  expSlots,
  headingOpen,
  partyCap,
  sendExpedition,
  stepExpeditions,
} from '../src/core/expedition';
import type { GameState, Hero, Heading, Item } from '../src/core/model';

declare const process: { argv: string[] };

const OUT = process.argv[2] ?? 'auditoria-oro.json';
const GAMES = Number(process.argv[3] ?? 40);
const FREE_DAYS = Number(process.argv[4] ?? 120);

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const r1 = (x: number) => Math.round(x * 10) / 10;
const txt = (x: unknown) => (x && typeof x === 'object' ? idText(x as never) : String(x ?? ''));

// ---------------------------------------------------------------------------------------------
// 1. Catálogo: lo que está escrito a mano (historias, objetivos, hazañas, tienda, sucesos).
// ---------------------------------------------------------------------------------------------

const chains = CHAINS.map((c) => ({
  id: c.id,
  name: txt(c.name),
  rep: c.rep,
  steps: c.steps.map((st) => ({
    title: txt(st.title),
    type: st.type,
    danger: st.danger,
    boss: st.boss ?? null,
  })),
  gold: c.reward.gold,
  repReward: c.reward.rep,
  item: txt(c.reward.item),
  trophy: c.reward.trophy ? txt(c.reward.trophy.name) : null,
}));

const goals = GOALS.map((g) => ({
  id: g.id,
  kind: 'stat' in g ? 'contar' : 'room' in g ? 'sala' : 'llegar',
  what: 'stat' in g ? g.stat : 'room' in g ? `${g.room} a nivel ${g.level}` : `${g.have} ${g.n}`,
  n: 'n' in g ? g.n : null,
  step: 'step' in g ? g.step : null,
  gold: g.reward.gold ?? 0,
  rep: g.reward.rep ?? 0,
  item: g.reward.item ?? null,
  repeats: 'stat' in g,
}));

const feats = FEATS.map((f) => ({
  id: f.id,
  name: txt(f.name),
  stat: f.stat,
  tiers: f.tiers,
  rewards: f.rewards.map((r) => ({ gold: r.gold ?? 0, rep: r.rep ?? 0, item: r.item ?? null })),
}));

const shop = {
  decor: Object.entries(DECOR).map(([id, d]) => ({
    id,
    name: d.name,
    price: d.price,
    appeal: d.appeal,
  })),
  facade: Object.entries(FACADE).map(([id, d]) => ({
    id,
    name: d.name,
    price: d.price,
    appeal: d.appeal,
  })),
  raven: RAVEN_PRICE,
  feast: FEAST_PRICE,
  dog: DOG_PRICE,
};

// Valor de venta medio del equipo por rareza (lo que se saca vendiendo).
const salePerRarity = [0, 1, 2, 3, 4].map((r) => {
  const xs = GEAR.filter((g) => g.rarity === r).map((g) => priceOf({ ...g, id: 'x' } as Item));
  return {
    rarity: r,
    n: xs.length,
    mean: r1(mean(xs)),
    min: Math.min(...xs),
    max: Math.max(...xs),
  };
});
const treasureValue = r1(mean(TREASURES.map((g) => g.value)));

// Sucesos de día que mueven oro (sacado del código de `core/events.ts`).
const evNoble = mean(
  [2, 3, 4].map((r) => (r === 4 ? 0.1 : r === 3 ? 0.9 * 0.2 : 0.9 * 0.8) * salePerRarity[r]!.mean),
);
const events = [
  {
    id: 'buhonero',
    cost: 60,
    ev: r1(0.65 * salePerRarity[2]!.mean + 0.35 * salePerRarity[0]!.mean),
    note: '65 % raro, 35 % común',
  },
  { id: 'noble', cost: 100, ev: r1(evNoble / 1), note: '72 % raro, 18 % épico, 10 % legendario' },
  { id: 'apuesta', cost: 30, ev: 30, note: '50 % gana 30, 50 % pierde 30 (EV 0)' },
  { id: 'pelea', cost: 10, ev: 0, note: 'moral +6 a dos héroes' },
  { id: 'bardo', cost: 5, ev: 0, note: 'moral +6 a todos' },
];

// ---------------------------------------------------------------------------------------------
// 2. Encargos generados: paga por rango, modo, plazas, peligro y días.
// ---------------------------------------------------------------------------------------------

/** Fuerza típica de un héroe en su habilidad fuerte, según el rango (copia de `generate.ts`). */
const perHero = (rank: number) => 4.4 + rank * 1.7;
const N_Q = 6000;
const quests = B.RANKS.map((rk, rank) => {
  const out: Record<string, unknown> = { rank, name: rk.name, at: rk.at };
  for (const free of [false, true]) {
    const rng = new Rng(`aud-q-${rank}-${free}`);
    const pays: number[] = [];
    const perHD: number[] = [];
    const bySlots: number[][] = [[], [], [], [], []];
    const byDanger: number[][] = [[], [], [], []];
    const byDays: number[][] = [[], [], [], [], []];
    let items = 0;
    let itemVal = 0;
    let shady = 0;
    for (let i = 0; i < N_Q; i++) {
      // Con la fuerza de casa a la altura del rango (el techo del tablón).
      const q = generateQuest(rng, `q${i}`, rank, `i${i}`, free, undefined, perHero(rank));
      pays.push(q.reward);
      perHD.push(q.reward / (q.slots * q.days));
      bySlots[q.slots]!.push(q.reward);
      byDanger[q.danger]!.push(q.reward);
      byDays[q.days]!.push(q.reward);
      if (q.dangerHidden) shady++;
      if (q.item) {
        items++;
        itemVal += priceOf(q.item);
      }
    }
    out[free ? 'libre' : 'deuda'] = {
      mean: r1(mean(pays)),
      p10: pct(pays, 0.1),
      p50: pct(pays, 0.5),
      p90: pct(pays, 0.9),
      max: Math.max(...pays),
      perHeroDay: r1(mean(perHD)),
      bySlots: bySlots.map((xs) => (xs.length ? r1(mean(xs)) : null)),
      byDanger: byDanger.map((xs) => (xs.length ? r1(mean(xs)) : null)),
      byDays: byDays.map((xs) => (xs.length ? r1(mean(xs)) : null)),
      itemChance: r1((100 * items) / N_Q),
      itemSale: r1(items ? itemVal / items : 0),
      shady: r1((100 * shady) / N_Q),
      chain: r1(mean(pays) * 1.6),
      messenger: r1(mean(pays) * B.MESSENGER_PAY),
      rumor: r1(
        mean(
          pays.map((p) =>
            Math.max(B.RUMOR_MIN_PAY * (1 + rank), Math.round((p * B.RUMOR_PAY) / 5) * 5),
          ),
        ),
      ),
    };
  }
  return out;
});

// ---------------------------------------------------------------------------------------------
// 3. Sueldos: la curva de un héroe y de un trabajador.
// ---------------------------------------------------------------------------------------------

/** Sueldo semanal de un héroe contratado a nivel `from` (calidad media 15) al llegar a `lvl`. */
function wageAt(lvl: number, from = 1, cache = true): number {
  let w = 6 + from * 4;
  for (let l = from + 1; l <= lvl; l++) {
    w += B.levelRaise(l);
    if (cache && B.CACHE[l]) w += B.CACHE[l]!;
  }
  return w;
}
const wages = Array.from({ length: B.LEVEL_MAX }, (_, i) => {
  const lvl = i + 1;
  return {
    lvl,
    hero: wageAt(lvl),
    heroNoCache: wageAt(lvl, 1, false),
    perDay: r1(wageAt(lvl) / B.SALARY_EVERY),
    raise: lvl > 1 ? B.levelRaise(lvl) + (B.CACHE[lvl] ?? 0) : 0,
  };
});
const workerWages = { village: 6, seekerMin: 3 + 2, seekerMax: 3 + 6, perSkill: '3 + Maña (2–6)' };

// ---------------------------------------------------------------------------------------------
// 4. El salón: lo que deja la caja según el salón, la fama, el trabajo y la decoración.
// ---------------------------------------------------------------------------------------------

/**
 * Copia de `visitorsOf` sin semilla (la media del ±1): visitantes, atendidos y monedas con comida
 * y cerveza de sobra. `work`: trabajo en el salón (Maña × oficio × nivel; ver `workAt`).
 */
function salonDay(o: {
  level: number;
  w: number;
  h?: number;
  rep: number;
  work: number;
  kitchen?: boolean;
  decorAppeal?: number;
  trophies?: number;
}): { total: number; served: number; coins: number; appeal: number } {
  const h = o.h ?? 1;
  const appeal =
    B.salonAppeal(o.level) +
    (h > 1 ? 2 : 0) +
    (o.decorAppeal ?? 0) +
    Math.min(o.trophies ?? 0, B.TROPHY_SLOTS) * B.TROPHY_APPEAL;
  const seats = Math.max(1, o.w * 2 - 1) * 2 + (h > 1 && o.w >= 3 ? 6 : 0);
  let coins = 0;
  let total = 0;
  let served = 0;
  for (const d of [-1, 0, 1]) {
    const want = B.VISIT_BASE + o.rep * B.VISIT_PER_REP + appeal * B.VISIT_PER_APPEAL + d;
    const t = Math.max(1, Math.min(Math.round(seats * B.SEAT_TURNS), Math.round(want)));
    const cap = B.SERVE_BASE + o.work * B.SERVE_PER_WORK + (o.kitchen ? 2 : 0);
    const sv = Math.min(t, Math.round(cap));
    // Reparto medio de visitantes (sin espías): nobles con Atractivo, mercaderes con fama.
    const noble =
      appeal >= B.NOBLE_APPEAL ? Math.min(1, 0.08 + (appeal - B.NOBLE_APPEAL) * 0.02) : 0;
    const merch = Math.max(0, 0.25 + Math.min(0.25, o.rep / 1600) - noble);
    const spend =
      noble * VISITORS.noble.spend +
      merch * VISITORS.mercader.spend +
      (1 - noble - merch) * VISITORS.campesino.spend;
    // Se atiende antes a quien más gasta: con pocos atendidos, la media sube; se aproxima.
    coins += sv * (spend + B.BEER_COIN);
    total += t;
    served += sv;
  }
  return { total: r1(total / 3), served: r1(served / 3), coins: r1(coins / 3), appeal };
}
/** Trabajo de un trabajador de Maña `m` en su oficio en un salón de nivel `lvl`. */
const salonWork = (n: number, m: number, lvl: number) =>
  n * m * B.TRADE_BONUS * (0.75 + 0.25 * lvl);

const salonGrid: {
  label: string;
  level: number;
  w: number;
  h: number;
  workers: number;
  rep: number;
  coins: number;
  served: number;
  total: number;
  appeal: number;
}[] = [];
for (const [label, level, w, h, workers, rep, decor] of [
  ['Inicio (salón 1, 1 hueco, sin camarero, fama 0)', 1, 1, 1, 0, 0, 0],
  ['Salón 1, 2 huecos, 1 camarero', 1, 2, 1, 1, 0, 0],
  ['Salón 2, 2 huecos, 1 camarero, fama 40 (hierro)', 2, 2, 1, 1, 40, 4],
  ['Salón 3, 3 huecos, 2 camareros, fama 100 (plata)', 3, 3, 1, 2, 100, 8],
  ['Salón 4, 3 huecos, 2 alturas, 3 camareros, fama 180 (oro)', 4, 3, 2, 3, 180, 12],
  ['Salón 5 (banquetes), 3×2, 4 camareros, fama 300 (leyenda)', 5, 3, 2, 4, 300, 16],
  ['Salón 5, 3×2, 6 camareros, fama 1100 (lo que alcanza el simulador)', 5, 3, 2, 6, 1100, 16],
] as const) {
  const d = salonDay({
    level,
    w,
    h,
    rep,
    work: salonWork(workers, 4, level),
    kitchen: true,
    decorAppeal: decor,
    trophies: level,
  });
  salonGrid.push({ label, level, w, h, workers, rep, ...d });
}
// La caja por fama (salón máximo, plazas de sobra) para ver dónde topa.
const salonByRep = [0, 40, 100, 180, 300, 500, 800, 1100].map((rep) => ({
  rep,
  ...salonDay({
    level: 5,
    w: 3,
    h: 2,
    rep,
    work: salonWork(6, 6, 5),
    kitchen: true,
    decorAppeal: 16,
    trophies: 4,
  }),
}));

// ---------------------------------------------------------------------------------------------
// 5. Expediciones: oro medio por lejanía (el grupo se da la vuelta al llegar a esa lejanía).
// ---------------------------------------------------------------------------------------------

const PARTY: Hero['cls'][] = ['guerrero', 'clerigo', 'mago', 'explorador'];
function expeditionState(seed: string, lvl: number, n: number): GameState {
  const s = newGame(seed);
  const rng = new Rng(`${seed}-h`);
  s.heroes = PARTY.slice(0, n).map((cls, i) => {
    const h = generateHero(rng, `h${100 + i}`, { rank: 2, tab: 3, cls });
    for (let l = h.lvl + 1; l <= lvl; l++)
      h.attrs[MAIN_ATTR[h.cls]] = Math.min(B.ATTR_MAX, h.attrs[MAIN_ATTR[h.cls]] + 1);
    h.lvl = lvl;
    h.morale = 80;
    return h;
  });
  s.stats = { ...emptyStats(), maxLvl: lvl };
  s.food = 999;
  s.mats = {};
  s.expBest = { bosque: 20, sierra: 20, marismas: 20, ruinas: 20 };
  s.building.rooms.find((r) => r.type === 'mapas')!.level = 3;
  // Cámara grande: que no se pierda nada al volver.
  const v = vaultOf(s);
  if (v) v.level = 4;
  return s;
}
function runExpedition(seed: string, heading: Heading, target: number, lvl: number, n = 4) {
  const s = expeditionState(seed, lvl, n);
  const gold0 = s.gold;
  const inv0 = s.inventory.length;
  const ids = s.heroes.map((h) => h.id);
  const rations = n * Math.ceil(target * 1.8 + 3);
  const e = sendExpedition(s, heading, ids, rations);
  let maxDist = 0;
  let forced: string | null = null;
  for (let h = 1; h < 24 * 60; h++) {
    stepExpeditions(s, e.from + h * HOUR);
    if (!s.expeditions?.some((x) => x.id === e.id)) break;
    const d = distAt(e);
    if (!e.turn) maxDist = Math.max(maxDist, d);
    if (!e.turn && d >= target) callBack(s, e.id);
    if (e.turn && e.turn.why !== 'jugador' && !forced) forced = e.turn.why;
  }
  const mats = Object.values(s.mats ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const items = s.inventory.slice(inv0);
  const dead = s.heroes.filter((h) => h.status === 'muerto').length;
  return {
    gold: s.gold - gold0,
    mats,
    itemSale: items.reduce((a, it) => a + priceOf(it), 0),
    items: items.length,
    days: e.hours / 24,
    maxDist,
    forced,
    dead,
    hurt: s.heroes.filter((h) => (h.hp ?? 1) < B.HP_LIGHT).length,
    rationsUsed: rations - 0,
  };
}
const EXP_RUNS = Number(process.argv[5] ?? 120);
const expeditions: Record<string, unknown>[] = [];
for (const lvl of [8, 11, 14]) {
  for (const heading of HEADINGS) {
    if (lvl !== 11 && heading !== 'bosque') continue;
    for (const target of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]) {
      const runs = Array.from({ length: EXP_RUNS }, (_, i) =>
        runExpedition(`aud-x-${heading}-${target}-${lvl}-${i}`, heading, target, lvl),
      );
      const gold = runs.map((r) => r.gold);
      const total = runs.map((r) => r.gold + r.mats * B.MAT_SELL + r.itemSale);
      const days = runs.map((r) => r.days);
      expeditions.push({
        lvl,
        heading,
        target,
        gold: r1(mean(gold)),
        goldP10: pct(gold, 0.1),
        goldP90: pct(gold, 0.9),
        mats: r1(mean(runs.map((r) => r.mats))),
        itemSale: r1(mean(runs.map((r) => r.itemSale))),
        items: r1(mean(runs.map((r) => r.items))),
        total: r1(mean(total)),
        days: r1(mean(days)),
        reached: r1(mean(runs.map((r) => r.maxDist))),
        goldPerDay: r1(mean(gold) / Math.max(0.1, mean(days))),
        totalPerHeroDay: r1(mean(total) / Math.max(0.1, mean(days)) / 4),
        forced: r1((100 * runs.filter((r) => r.forced).length) / EXP_RUNS),
        deadPer100: r1((100 * runs.reduce((a, r) => a + r.dead, 0)) / (EXP_RUNS * 4)),
        wages4: Math.round((4 * wageAt(lvl) * mean(days)) / B.SALARY_EVERY),
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 6. Partidas completas (estrategia «normal» del simulador) con el oro atribuido a su fuente.
// ---------------------------------------------------------------------------------------------

function* combos<T>(items: T[], max: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length) yield acc;
  if (acc.length === max) return;
  for (let i = start; i < items.length; i++) yield* combos(items, max, i + 1, [...acc, items[i]!]);
}
function reserve(s: GameState): number {
  const p = nextPayment(s);
  if (!p) return 0;
  const need = p.amount + salaries(s);
  return p.day - s.day <= 3 ? need : need * 0.5;
}
const value = (h: Hero) => h.attrs.F + h.attrs.D + h.attrs.M + h.lvl * 3;
type Ledger = Record<
  | 'salon'
  | 'encargos'
  | 'expediciones'
  | 'ventas'
  | 'asaltos'
  | 'otros'
  | 'sueldos'
  | 'deuda'
  | 'obras'
  | 'contratos'
  | 'saqueos'
  | 'camara',
  number
>;
const zero = (): Ledger => ({
  salon: 0,
  encargos: 0,
  expediciones: 0,
  ventas: 0,
  asaltos: 0,
  otros: 0,
  sueldos: 0,
  deuda: 0,
  obras: 0,
  contratos: 0,
  saqueos: 0,
  camara: 0,
});
const keyOf = (t: unknown) =>
  t && typeof t === 'object' && 'k' in (t as object) ? (t as { k: string }).k : '';
const numOf = (t: unknown) => Number((t as { p?: { n?: number } })?.p?.n ?? 0);

interface DaySnap {
  day: number;
  libre: boolean;
  rank: number;
  rep: number;
  gold: number;
  heroes: number;
  avgLvl: number;
  maxLvl: number;
  workers: number;
  payroll: number;
  salonDay: number;
  led: Ledger;
}

function playDay(s: GameState, led: Ledger): GameState {
  const act = (a: Parameters<typeof reduce>[1], k: keyof Ledger) => {
    const before = s.gold;
    const next = reduce(s, a);
    if (next !== s) led[k] += Math.abs(next.gold - before);
    s = next;
  };
  for (const h of s.heroes) if (h.request) s = reduce(s, { type: 'answer', id: h.id, yes: true });
  for (const it of s.inventory) {
    const bare =
      it.kind && it.kind !== 'tesoro' && slotOf(it)
        ? s.heroes.find((h) => h.status === 'ok' && !h.worn?.[slotOf(it)!])
        : undefined;
    if (bare) s = reduce(s, { type: 'equip', heroId: bare.id, itemId: it.id });
    else act({ type: 'sell', itemId: it.id }, 'ventas');
  }
  if (roster(s).length >= B.capacity(s.fac.dorm) && !canUpgrade(s, 'dorm'))
    if (s.gold - 150 > reserve(s)) act({ type: 'upgrade', fac: 'dorm' }, 'obras');
  for (const k of [
    'arm',
    'empal',
    'mapas',
    'forja',
    'patio',
    'cap',
    'establo',
    'torre',
    'vet',
  ] as const) {
    const cost = upgradeCost(s, k);
    if (cost !== null && s.gold - cost > reserve(s) + 120)
      act({ type: 'upgrade', fac: k }, 'obras');
  }
  const vault = vaultOf(s);
  if (vault && vaultFull(s))
    for (const a of [
      { type: 'upgradeRoom', id: vault.id },
      { type: 'extend', id: vault.id, dir: 'right' },
      { type: 'extend', id: vault.id, dir: 'left' },
    ] as const) {
      const next = reduce(s, a);
      if (next !== s && next.gold > reserve(s)) {
        led.obras += s.gold - next.gold;
        s = next;
        break;
      }
    }
  const best = [...s.candidates].sort((a, b) => value(b) / b.fee - value(a) / a.fee)[0];
  if (best && !canHire(s, best.id) && s.gold - best.fee > reserve(s))
    act({ type: 'hire', id: best.id }, 'contratos');
  for (const q of [...s.quests].sort((a, b) => b.reward - a.reward)) {
    const ready = s.heroes.filter((h) => h.status === 'ok');
    let pick: Hero[] | null = null;
    let bestP = 0;
    for (const party of combos(ready, q.slots)) {
      const p = questEstimate(q, party, s.fac).total;
      if (p < 0.55) continue;
      if (!pick || party.length < pick.length || (party.length === pick.length && p > bestP)) {
        pick = party;
        bestP = p;
      }
    }
    if (pick) s = reduce(s, { type: 'send', questId: q.id, heroIds: pick.map((h) => h.id) });
  }
  if ((s.expeditions?.length ?? 0) < expSlots(s)) {
    const idle = s.heroes.filter((h) => h.status === 'ok' && !h.guard).slice(0, partyCap(s));
    const rations = Math.min(idle.length * 8, s.food - s.heroes.length);
    const ids = idle.map((h) => h.id);
    const open = HEADINGS.filter((h) => headingOpen(s, h));
    const heading = open[s.day % open.length]!;
    if (ids.length && !canExpedition(s, heading, ids, rations))
      s = reduce(s, { type: 'expedition', heading, heroIds: ids, rations });
  }
  s = structuredClone(s);
  settleWalks(s);
  // La noche: lo que entra y sale, por fuentes.
  const g0 = s.gold;
  const salon = dayIncome(s, s.day);
  const earned0 = s.stats?.goldEarned ?? 0;
  const seen = new Set(s.reports.map((r) => r.id));
  const next = reduce(s, { type: 'endDay' });
  let exp = 0;
  let raidIn = 0;
  let raidOut = 0;
  for (const r of next.reports.filter((x) => !seen.has(x.id)))
    for (const c of r.chips) {
      const k = keyOf(c.t);
      if (k === 'expediciones.informe.chip_oro') exp += numOf(c.t);
      if (k === 'asaltos.chip_botin') raidIn += numOf(c.t);
      if (k === 'asaltos.chip_saqueo') raidOut += numOf(c.t);
    }
  let spilt = 0;
  // La caja de verdad (la que se cuenta al amanecer, ya con la cena comida y la caravana).
  let till = 0;
  for (const ev of next.dawn) {
    if (keyOf(ev.t) === 'camara.llena') spilt += numOf(ev.t);
    if (keyOf(ev.t) === 'partida.noche.caja') till += numOf(ev.t);
  }
  void salon;
  const quests = (next.stats?.goldEarned ?? 0) - earned0 - exp;
  let wagesPaid = 0;
  let debt = 0;
  if (next.payday && next.payday.day === next.day) {
    wagesPaid = next.payday.wages;
    debt = next.payday.debt;
  }
  const known = till + quests + exp + raidIn - raidOut - wagesPaid - debt - spilt;
  const other = next.gold - g0 - known;
  led.salon += till;
  led.encargos += quests;
  led.expediciones += exp;
  led.asaltos += raidIn;
  led.saqueos += raidOut;
  led.sueldos += wagesPaid;
  led.deuda += debt;
  led.camara += spilt;
  if (other >= 0) led.otros += other;
  else led.saqueos += -other;
  return next;
}

const DAYS_TOTAL = 28 + FREE_DAYS;
const series: { led: Ledger; n: number; snaps: DaySnap[] }[] = Array.from(
  { length: DAYS_TOTAL + 2 },
  () => ({
    led: zero(),
    n: 0,
    snaps: [],
  }),
);
const totals = zero();
let wins = 0;
let broke = 0;
const offline: Record<string, number[]>[] = [];
const OFF_AT = [10, 20, 29, 45, 60, 90, 120, 148];
const offlineRes = OFF_AT.map(() => ({
  delta: [] as number[],
  wages: [] as number[],
  salon: [] as number[],
  days: [] as number[],
  waited: 0,
  n: 0,
}));
for (let g = 0; g < GAMES; g++) {
  let s = newGame(`aud-${g}`);
  while (!s.over && s.day <= DAYS_TOTAL) {
    const led = zero();
    s = playDay(s, led);
    const slot = series[s.day]!;
    slot.n++;
    for (const k of Object.keys(led) as (keyof Ledger)[]) {
      slot.led[k] += led[k];
      totals[k] += led[k];
    }
    const r = roster(s);
    slot.snaps.push({
      day: s.day,
      libre: s.mode === 'libre',
      rank: B.rankIndex(s.rep),
      rep: s.rep,
      gold: s.gold,
      heroes: r.length,
      avgLvl: mean(r.map((h) => h.lvl)),
      maxLvl: Math.max(0, ...r.map((h) => h.lvl)),
      workers: s.workers.length,
      payroll: salaries(s),
      salonDay: led.salon,
      led,
    });
    // Juego cerrado 8 días desde aquí (copia: la partida sigue igual).
    const oi = OFF_AT.indexOf(s.day);
    if (oi >= 0 && !s.over) {
      const away = catchUp(structuredClone(s), B.AWAY_MAX_DAYS * B.AWAY_DAY_SECONDS);
      const o = offlineRes[oi]!;
      o.n++;
      o.delta.push(away.state.gold - s.gold);
      o.days.push(away.days.length);
      let w = 0;
      let sal = 0;
      for (const d of away.days)
        for (const ev of d.events) {
          const k = keyOf(ev.t);
          if (k === 'partida.pago.salarios') w += numOf(ev.t);
          if (k === 'partida.noche.caja') sal += numOf(ev.t);
        }
      o.wages.push(w);
      o.salon.push(sal);
      if (away.waiting) o.waited++;
    }
  }
  if (s.mode === 'libre') wins++;
  if (s.over && s.mode === 'libre') broke++;
}
void offline;

// Series por día (medias entre partidas vivas ese día).
const daily = series
  .map((sl, day) => {
    if (!sl.n) return null;
    const sn = sl.snaps;
    const per = (k: keyof Ledger) => r1(sl.led[k] / sl.n);
    return {
      day,
      n: sl.n,
      libre: r1((100 * sn.filter((x) => x.libre).length) / sn.length),
      rank: r1(mean(sn.map((x) => x.rank))),
      rep: Math.round(mean(sn.map((x) => x.rep))),
      gold: Math.round(mean(sn.map((x) => x.gold))),
      goldP10: pct(
        sn.map((x) => x.gold),
        0.1,
      ),
      heroes: r1(mean(sn.map((x) => x.heroes))),
      avgLvl: r1(mean(sn.map((x) => x.avgLvl))),
      maxLvl: r1(mean(sn.map((x) => x.maxLvl))),
      workers: r1(mean(sn.map((x) => x.workers))),
      payroll: Math.round(mean(sn.map((x) => x.payroll))),
      salonDay: r1(mean(sn.map((x) => x.salonDay))),
      salon: per('salon'),
      encargos: per('encargos'),
      expediciones: per('expediciones'),
      ventas: per('ventas'),
      asaltos: per('asaltos'),
      otros: per('otros'),
      sueldos: per('sueldos'),
      deuda: per('deuda'),
      obras: per('obras'),
      contratos: per('contratos'),
      saqueos: per('saqueos'),
      camara: per('camara'),
    };
  })
  .filter((x) => x !== null);

const offlineOut = OFF_AT.map((day, i) => {
  const o = offlineRes[i]!;
  return {
    day,
    n: o.n,
    delta: Math.round(mean(o.delta)),
    deltaP10: pct(o.delta, 0.1),
    wages: Math.round(mean(o.wages)),
    salon: Math.round(mean(o.salon)),
    days: r1(mean(o.days)),
    waited: r1((100 * o.waited) / Math.max(1, o.n)),
  };
});

// ---------------------------------------------------------------------------------------------
// 7. Pruebas de exploits.
// ---------------------------------------------------------------------------------------------

// 7a. Talleres: ¿crear y vender da dinero?
const odds = (lvl: number, skill: number) => {
  let [comun, bueno, raro] = B.CRAFT_QUALITY[lvl]!;
  if (!skill) {
    comun += (bueno + raro) / 2;
    bueno /= 2;
    raro /= 2;
  } else {
    const shift = Math.max(-raro, Math.min(comun, B.CRAFT_GOOD_PER_SKILL * (skill - 4)));
    comun -= shift;
    raro += shift;
  }
  return { comun, bueno, raro };
};
const crafting = Object.entries(RECIPES).map(([id, rc]) => {
  const sale = (q: 'comun' | 'bueno' | 'raro') => priceOf({ ...crafted(rc, q), id: 'x' } as Item);
  const matsN = Object.values(rc.mats ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const cost = rc.gold + matsN * B.MAT_SELL;
  const row: Record<string, unknown> = {
    id,
    name: rc.name,
    room: rc.room,
    free: !!rc.free,
    gold: rc.gold,
    mats: matsN,
    cost,
    hours: rc.hours,
    sale: { comun: sale('comun'), bueno: sale('bueno'), raro: sale('raro') },
  };
  for (const [lvl, skill] of [
    [1, 0],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
    [4, 6],
    [4, 9],
  ] as const) {
    const o = odds(lvl, skill);
    const ev = o.comun * sale('comun') + o.bueno * sale('bueno') + o.raro * sale('raro');
    row[`n${lvl}m${skill}`] = r1(ev - cost);
  }
  return row;
});

// 7b. Templar y vender.
const temper = [0, 1, 2].map((rar) => {
  const base = GEAR.filter((g) => g.rarity === rar);
  const steps = [1, 2, 3].map((to) => {
    const gain = mean(
      base.map(
        (g) =>
          priceOf({ ...g, id: 'x', plus: to } as Item) -
          priceOf({ ...g, id: 'x', plus: to - 1 } as Item),
      ),
    );
    return { to, gain: r1(gain), cost: B.TEMPER_GOLD * to + to * B.MAT_SELL };
  });
  return { rarity: rar, steps };
});

// 7c. La caravana asaltada con la caja ya recogida: ¿oro negativo?
let caravanNeg = 'sin probar';
{
  // Se busca una partida con la amenaza alta: se fuerza la amenaza y se mira el oro tras la noche.
  let found = 0;
  let neg = 0;
  let minGold = 0;
  for (let i = 0; i < 400 && found < 50; i++) {
    let s = newGame(`aud-car-${i}`);
    s.day = 15;
    s.threat = 99;
    s.gold = 0;
    // Sin hazañas a punto de cumplirse (taparían la cuenta).
    s.stats = { ...emptyStats(), lastDeath: s.day };
    s.feats = Object.fromEntries(FEATS.map((f) => [f.id, f.tiers.length]));
    // La caja del día ya cobrada (como al anochecer), y gastada.
    const inc = dayIncome(s, s.day);
    if (inc <= 0) continue;
    s.till = inc;
    s.tillTaken = inc;
    s = reduce(s, { type: 'endDay' });
    if (s.dawn.some((e) => keyOf(e.t) === 'sucesos.amenaza.caravana')) {
      found++;
      if (s.gold < 0) neg++;
      minGold = Math.min(minGold, s.gold);
    }
  }
  caravanNeg = `${neg} de ${found} caravanas asaltadas (con la caja ya recogida y gastada) dejan el oro en negativo (mínimo ${minGold})`;
}

// 7d. Tope de la cámara: el oro de encargos y expediciones entra sin tope hasta la noche.
let vaultBypass = 'sin probar';
{
  const s = newGame('aud-vault');
  const cap = goldCap(s);
  vaultBypass = `Tope de la cámara al empezar: ${cap}. resolve.ts (encargos), expedition.ts (mochila), chains.ts, feats.ts y tutorial suman con «s.gold +=» (sin tope); solo la caja, las ventas y los trofeos usan «earn» (con tope). El sobrante se recorta al cerrar el día (spill): se puede gastar antes.`;
}

// ---------------------------------------------------------------------------------------------

const out = {
  meta: {
    games: GAMES,
    freeDays: FREE_DAYS,
    wins,
    broke,
    dayOpenSeconds: B.DAY_SECONDS,
    awayDaySeconds: B.AWAY_DAY_SECONDS,
    awayMaxDays: B.AWAY_MAX_DAYS,
    salaryEvery: B.SALARY_EVERY,
    freePay: B.FREE_PAY,
    vaultStore: B.VAULT_STORE,
    schedule: B.SCHEDULE,
    start: B.START.gold,
  },
  chains,
  goals,
  feats,
  shop,
  salePerRarity,
  treasureValue,
  events,
  quests,
  wages,
  workerWages,
  salonGrid,
  salonByRep,
  expeditions,
  daily,
  totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v / GAMES)])),
  offline: offlineOut,
  crafting,
  temper,
  exploits: { caravanNeg, vaultBypass },
};
writeFileSync(OUT, JSON.stringify(out, null, 1));

// Resumen por consola.
console.log(`Partidas: ${GAMES} · ganan la deuda ${wins} · quiebran en libre ${broke}`);
console.log('Totales por partida:', out.totals);
console.log('Juego cerrado 8 días:', offlineOut);
console.log('Caravana:', caravanNeg);
console.log(`Escrito ${OUT}`);
