/**
 * Simulador de balance sin interfaz: juega muchas partidas de «La deuda» con estrategias
 * sencillas y saca estadísticas. Uso: `npm run sim -- [partidas]`.
 */
import { capacity } from '../src/core/balance';
import {
  canHire,
  canUpgrade,
  dayIncome,
  nextPayment,
  reduce,
  newGame,
  roster,
  salaries,
  upgradeCost,
} from '../src/core/game';
import type { GameState, Hero, Outcome } from '../src/core/model';
import { questEstimate } from '../src/core/resolve';
import { vaultFull, vaultOf } from '../src/core/vault';
import { settleWalks } from '../src/core/workers';
import { roughNight } from '../src/core/sky';
import { slotOf } from '../src/core/gear';
import { idText } from '../src/textos';
import { canExpedition, distAt, expSlots, partyCap } from '../src/core/expedition';

declare const process: { argv: string[] };

interface Strategy {
  name: string;
  /** Probabilidad mínima de éxito para mandar un grupo (null: nunca manda). */
  threshold: number | null;
  hire: boolean;
  upgrade: boolean;
  /** Equipa los objetos en vez de venderlos. */
  equip: boolean;
}

const STRATEGIES: Strategy[] = [
  { name: 'pasiva (no manda a nadie)', threshold: null, hire: false, upgrade: false, equip: false },
  { name: 'temeraria (≥ 30 %)', threshold: 0.3, hire: true, upgrade: true, equip: true },
  { name: 'normal (≥ 55 %)', threshold: 0.55, hire: true, upgrade: true, equip: true },
  { name: 'cauta (≥ 75 %)', threshold: 0.75, hire: true, upgrade: true, equip: true },
  { name: 'sin contratar (≥ 55 %)', threshold: 0.55, hire: false, upgrade: false, equip: false },
];

function* combos<T>(items: T[], max: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length) yield acc;
  if (acc.length === max) return;
  for (let i = start; i < items.length; i++) yield* combos(items, max, i + 1, [...acc, items[i]!]);
}

/** Dinero que conviene guardar para el próximo pago. */
function reserve(s: GameState): number {
  const p = nextPayment(s);
  if (!p) return 0;
  const need = p.amount + salaries(s);
  return p.day - s.day <= 3 ? need : need * 0.5;
}

function playDay(s: GameState, st: Strategy): GameState {
  // El equipo se reparte entre quien no lleva nada; lo demás se vende.
  for (const it of s.inventory) {
    const bare =
      st.equip && it.kind && it.kind !== 'tesoro' && slotOf(it)
        ? s.heroes.find((h) => h.status === 'ok' && !h.worn?.[slotOf(it)!])
        : undefined;
    s = bare
      ? reduce(s, { type: 'equip', heroId: bare.id, itemId: it.id })
      : reduce(s, { type: 'sell', itemId: it.id });
  }

  if (st.upgrade && roster(s).length >= capacity(s.fac.dorm) && !canUpgrade(s, 'dorm')) {
    if (s.gold - 150 > reserve(s)) s = reduce(s, { type: 'upgrade', fac: 'dorm' });
  }
  // Con dinero de sobra, ampliar el edificio: armería, mapas y capilla.
  if (st.upgrade)
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
        s = reduce(s, { type: 'upgrade', fac: k });
    }
  // La cámara casi llena: mejorarla antes de que se pierda el oro.
  const vault = vaultOf(s);
  if (st.upgrade && vault && vaultFull(s)) {
    // Primero subirla de nivel; al máximo, ampliarla (ya en el modo libre).
    for (const a of [
      { type: 'upgradeRoom', id: vault.id },
      { type: 'extend', id: vault.id, dir: 'right' },
      { type: 'extend', id: vault.id, dir: 'left' },
    ] as const) {
      const next = reduce(s, a);
      if (next !== s && next.gold > reserve(s)) {
        s = next;
        break;
      }
    }
  }
  if (st.hire) {
    const best = [...s.candidates].sort((a, b) => value(b) / b.fee - value(a) / a.fee)[0];
    if (best && !canHire(s, best.id) && s.gold - best.fee > reserve(s))
      s = reduce(s, { type: 'hire', id: best.id });
  }

  if (st.threshold !== null) {
    for (const q of [...s.quests].sort((a, b) => b.reward - a.reward)) {
      const ready = s.heroes.filter((h) => h.status === 'ok');
      let pick: Hero[] | null = null;
      let bestP = 0;
      for (const party of combos(ready, q.slots)) {
        const p = questEstimate(q, party, s.fac).total;
        if (p < st.threshold) continue;
        // El grupo más pequeño que llega; a igualdad, el más seguro.
        if (!pick || party.length < pick.length || (party.length === pick.length && p > bestP)) {
          pick = party;
          bestP = p;
        }
      }
      if (pick) s = reduce(s, { type: 'send', questId: q.id, heroIds: pick.map((h) => h.id) });
    }
  }
  // Expediciones: con hueco, salen los que se quedan sin encargo (con raciones para unos días y
  // dejando la cena de casa).
  if (st.threshold !== null && (s.expeditions?.length ?? 0) < expSlots(s)) {
    const idle = s.heroes.filter((h) => h.status === 'ok' && !h.guard).slice(0, partyCap(s));
    const rations = Math.min(idle.length * EXP_RATIONS, s.food - s.heroes.length);
    const ids = idle.map((h) => h.id);
    if (ids.length && !canExpedition(s, 'bosque', ids, rations)) {
      s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: ids, rations });
      EXP.sent++;
    }
  }
  const out = new Map((s.expeditions ?? []).map((e) => [e.id, e]));
  // La simulación no tiene escena que diga quién llega a su sala: llegan a su hora (como con el
  // juego cerrado, ver `settleWalks`).
  s = structuredClone(s);
  settleWalks(s);
  const next = reduce(s, { type: 'endDay' });
  EXP.sites += (next.stats?.expSites ?? 0) - (s.stats?.expSites ?? 0);
  EXP.found += (next.stats?.expBundles ?? 0) - (s.stats?.expBundles ?? 0);
  EXP.lost += Math.max(
    0,
    (next.expBundles?.length ?? 0) -
      (s.expBundles?.length ?? 0) +
      (next.stats?.expBundles ?? 0) -
      (s.stats?.expBundles ?? 0),
  );
  for (const [id, e] of out) {
    if (next.expeditions?.some((x) => x.id === id)) continue;
    const last = e;
    EXP.back++;
    EXP.days += last.hours / 24;
    EXP.far += last.turn?.dist ?? distAt(last);
    EXP.dead += last.heroIds.filter(
      (h) => next.heroes.find((x) => x.id === h)?.status === 'muerto',
    ).length;
    EXP.heroes += last.heroIds.length;
  }
  return next;
}

/** Raciones por héroe que lleva una expedición del simulador, y lo que se cuenta de ellas. */
const EXP_RATIONS = 8;
const EXP = { sent: 0, back: 0, days: 0, far: 0, dead: 0, heroes: 0, sites: 0, found: 0, lost: 0 };

const value = (h: Hero) => h.attrs.F + h.attrs.D + h.attrs.M + h.lvl * 3;

/** Lo que pasa con las salas: caja del salón, sueldos, cenas, asaltos y oro que no cabe. */
interface Rooms {
  /** Por tramo (días 1–10, 11–20, 21–30 y modo libre): suma y días contados. */
  till: number[];
  wages: number[];
  days: number[];
  hungry: number;
  raids: number;
  raidsWon: number;
  /** Asaltos y ganados por tramo (como `till`). */
  raidsBy: number[];
  wonBy: number[];
  stolen: number;
  spilt: number[];
  /** Resultados de todos los informes (el correo guarda solo los últimos). */
  outcomes: Record<Outcome, number>;
  /** Bajas según el peligro (0: fácil, peligro 0–1; 1: difícil, 2–3): encargos, muertos, perdidos. */
  sentBy: number[];
  deadBy: number[];
  lostBy: number[];
  /** Encargos que salen mal (fracaso o desastre) y éxitos parciales, igual. */
  badBy: number[];
  partialBy: number[];
  /** Desaparecidos que vuelven (solos o rescatados) y los que se dan por muertos. */
  back: number;
  gone: number;
  /** Peligro de cada encargo por su título (el informe no guarda el encargo). */
  danger: Map<string, number>;
  /**
   * La noche (fase 7): noches jugadas y con algún suceso; ladrones (pillados y oro que se llevan)
   * y mensajeros (con el recado recogido por el de guardia).
   */
  nights: number;
  eventful: number;
  /** Las de niebla o tormenta (más sucesos), aparte. */
  rough: number;
  roughEventful: number;
  /** Cuántas veces sale cada suceso. */
  byEvent: Record<string, number>;
  thieves: number;
  caught: number;
  thiefGold: number;
  messengers: number;
  taken: number;
}
const newRooms = (): Rooms => ({
  till: [0, 0, 0, 0],
  wages: [0, 0, 0, 0],
  days: [0, 0, 0, 0],
  hungry: 0,
  raids: 0,
  raidsWon: 0,
  raidsBy: [0, 0, 0, 0],
  wonBy: [0, 0, 0, 0],
  stolen: 0,
  spilt: [0, 0, 0, 0],
  outcomes: { 'Éxito brillante': 0, Éxito: 0, 'Éxito parcial': 0, Fracaso: 0, Desastre: 0 },
  sentBy: [0, 0],
  deadBy: [0, 0],
  lostBy: [0, 0],
  badBy: [0, 0],
  partialBy: [0, 0],
  back: 0,
  gone: 0,
  danger: new Map(),
  nights: 0,
  eventful: 0,
  rough: 0,
  roughEventful: 0,
  byEvent: {},
  thieves: 0,
  caught: 0,
  thiefGold: 0,
  messengers: 0,
  taken: 0,
});

/** Juega un día apuntando lo que interesa de las salas. */
function tracked(s: GameState, st: Strategy, acc: Rooms): GameState {
  // Sin escena, cada uno llega a su sala a su hora (ver `settleWalks`).
  s = structuredClone(s);
  settleWalks(s);
  const phase = s.mode === 'libre' ? 3 : Math.min(2, Math.floor((s.day - 1) / 10));
  acc.till[phase]! += dayIncome(s, s.day);
  acc.wages[phase]! += salaries(s);
  acc.days[phase]!++;
  const seen = new Set(s.reports.map((r) => r.id));
  for (const q of s.quests) acc.danger.set(idText(q.title), q.danger);
  const next = playDay(s, st);
  acc.nights++;
  const fired = Object.entries(next.nights?.last ?? {}).filter(([, d]) => d === next.day - 1);
  const rough = roughNight(s.seed, s.day);
  if (rough) acc.rough++;
  if (fired.length) {
    acc.eventful++;
    if (rough) acc.roughEventful++;
  }
  for (const [id] of fired) acc.byEvent[id] = (acc.byEvent[id] ?? 0) + 1;
  for (const ev of next.dawn) {
    const e = { ...ev, t: idText(ev.t) };
    if (e.t.startsWith('Anoche entró un ladrón')) {
      acc.thieves++;
      if (e.k === 'good') acc.caught++;
      const m = /(\d+) monedas de/.exec(e.t);
      if (m) acc.thiefGold += Number(m[1]);
    }
    if (/^Anoche llamó una? mensajer/.test(e.t)) {
      acc.messengers++;
      if (e.t.includes('recogió')) acc.taken++;
    }
    if (e.t.startsWith('No hubo comida')) acc.hungry++;
    if (/ha vuelto!|ha rescatado a/.test(e.t)) acc.back++;
    if (e.t.startsWith('Han encontrado la capa')) acc.gone++;
    const lost = /(\d+) monedas no cabían/.exec(e.t);
    if (lost) acc.spilt[phase]! += Number(lost[1]);
  }
  for (const r of next.reports.filter((x) => !seen.has(x.id))) {
    acc.outcomes[r.outcome]++;
    if (!r.raid) {
      const hard = (acc.danger.get(idText(r.title)) ?? 0) >= 2 ? 1 : 0;
      acc.sentBy[hard]!++;
      if (r.outcome === 'Fracaso' || r.outcome === 'Desastre') acc.badBy[hard]!++;
      if (r.outcome === 'Éxito parcial') acc.partialBy[hard]!++;
      for (const c of r.chips) {
        if (/: caíd[oa]$/.test(idText(c.t))) acc.deadBy[hard]!++;
        if (/: desaparecid[oa]$/.test(idText(c.t))) acc.lostBy[hard]!++;
      }
    }
    if (!r.raid) continue;
    acc.raids++;
    acc.raidsBy[phase]!++;
    if (r.raid.won) {
      acc.raidsWon++;
      acc.wonBy[phase]!++;
    }
    for (const c of r.chips) {
      const m = /Saqueo: −(\d+)/.exec(idText(c.t));
      if (m) acc.stolen += Number(m[1]);
    }
  }
  return next;
}

const N = Number(process.argv[2] ?? 300);
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(0)} %`;
const FREE_DAYS = Number(process.argv[3] ?? 40);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`Simulando ${N} partidas por estrategia…\n`);
for (const st of STRATEGIES) {
  let wins = 0;
  const lossDays: number[] = [];
  let broke = 0;
  const freeGold: number[] = [];
  const golds: number[] = [];
  const deaths: number[] = [];
  const hired: number[] = [];
  const sent: number[] = [];
  const reps: number[] = [];
  const stories: number[] = [];
  const rooms = newRooms();
  const outcomes = rooms.outcomes;
  for (let i = 0; i < N; i++) {
    let s = newGame(`sim-${i}`);
    const start = s.heroes.length;
    while (!s.over && s.mode !== 'libre') s = tracked(s, st, rooms);
    if (s.mode === 'libre') {
      wins++;
      golds.push(s.gold);
      // Modo libre: ¿aguanta el gremio otros días pagando a sus veteranos?
      for (let d = 0; d < FREE_DAYS && !s.over; d++) {
        for (const h of s.heroes)
          if (h.request) s = reduce(s, { type: 'answer', id: h.id, yes: true });
        s = tracked(s, st, rooms);
      }
      if (s.over) broke++;
      else freeGold.push(s.gold);
    } else lossDays.push(s.day);
    deaths.push(s.heroes.filter((h) => h.status === 'muerto').length);
    hired.push(s.heroes.length - start);
    sent.push(s.stats?.missions ?? 0);
    reps.push(s.rep);
    stories.push((s.chains ?? []).filter((c) => c.status === 'hecha').length);
  }
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
  console.log(`■ ${st.name}`);
  console.log(`  victorias ${pct(wins, N)} · oro final medio ${avg(golds).toFixed(0)}`);
  if (lossDays.length) console.log(`  derrota media el día ${avg(lossDays).toFixed(1)}`);
  if (wins)
    console.log(
      `  modo libre (${FREE_DAYS} días más): quiebra ${pct(broke, wins)} · oro medio al final ${avg(freeGold).toFixed(0)}`,
    );
  console.log(
    `  misiones por partida ${avg(sent).toFixed(1)} · contratados ${avg(hired).toFixed(1)} · muertos ${avg(deaths).toFixed(2)}`,
  );
  console.log(
    `  reputación final media ${avg(reps).toFixed(0)} · historias completadas ${avg(stories).toFixed(1)}`,
  );
  if (total)
    console.log(
      `  resultados: ${Object.entries(outcomes)
        .map(([k, v]) => `${k} ${pct(v, total)}`)
        .join(' · ')}`,
    );
  const per100 = (x: number, k: number) => ((100 * x) / Math.max(1, rooms.sentBy[k]!)).toFixed(1);
  console.log(
    `  bajas cada 100 encargos (fácil 0–1 / difícil 2–3): muertos ${per100(rooms.deadBy[0]!, 0)} / ${per100(rooms.deadBy[1]!, 1)} · desaparecidos ${per100(rooms.lostBy[0]!, 0)} / ${per100(rooms.lostBy[1]!, 1)} · encargos ${rooms.sentBy.map((x) => (x / N).toFixed(1)).join(' / ')} por partida`,
  );
  console.log(
    `  salen mal (fácil / difícil): ${per100(rooms.badBy[0]!, 0)} % / ${per100(rooms.badBy[1]!, 1)} % · éxito parcial ${per100(rooms.partialBy[0]!, 0)} % / ${per100(rooms.partialBy[1]!, 1)} %`,
  );
  console.log(
    `  desaparecidos que vuelven ${pct(rooms.back, rooms.back + rooms.gone)} (${rooms.back} vuelven, ${rooms.gone} no)`,
  );
  const per = (xs: number[]) =>
    xs.map((x, k) => (rooms.days[k] ? (x / rooms.days[k]!).toFixed(0) : '–')).join(' / ');
  console.log(`  caja del salón al día (1–10 / 11–20 / 21–30 / libre): ${per(rooms.till)}`);
  console.log(`  nómina semanal media (igual): ${per(rooms.wages)}`);
  console.log(
    `  por partida: noches sin cenar ${(rooms.hungry / N).toFixed(1)} · asaltos ${(rooms.raids / N).toFixed(1)} (ganados ${pct(rooms.raidsWon, rooms.raids)}, saqueo ${(rooms.stolen / N).toFixed(0)})`,
  );
  console.log(
    `  asaltos por tramo (11–20 / 21–30 / libre): ${[1, 2, 3].map((k) => `${(rooms.raidsBy[k]! / N).toFixed(1)} (ganados ${pct(rooms.wonBy[k]!, rooms.raidsBy[k]!)})`).join(' / ')}`,
  );
  console.log(
    `  oro perdido por la cámara llena, por partida (igual): ${rooms.spilt.map((x) => (x / N).toFixed(0)).join(' / ')}`,
  );
  console.log(
    `  noches con suceso ${pct(rooms.eventful, rooms.nights)} (con niebla o tormenta ${pct(rooms.roughEventful, rooms.rough)}; por partida: ${Object.entries(
      rooms.byEvent,
    )
      .map(([id, n]) => `${id} ${(n / N).toFixed(1)}`)
      .join(
        ', ',
      )}) · ladrones ${(rooms.thieves / N).toFixed(1)} por partida (pillados ${pct(rooms.caught, rooms.thieves)}, se llevan ${(rooms.thiefGold / N).toFixed(0)} monedas) · mensajeros ${(rooms.messengers / N).toFixed(1)} (recado recogido ${pct(rooms.taken, rooms.messengers)})`,
  );
  console.log(
    `  expediciones por partida ${(EXP.sent / N).toFixed(1)} · días fuera ${(EXP.days / Math.max(1, EXP.back)).toFixed(1)} · lejanía ${(EXP.far / Math.max(1, EXP.back)).toFixed(1)} días · muertos cada 100 héroes ${((100 * EXP.dead) / Math.max(1, EXP.heroes)).toFixed(1)} · parajes ${(EXP.sites / N).toFixed(1)} · fardos perdidos ${(EXP.lost / N).toFixed(2)} (recuperados ${(EXP.found / N).toFixed(2)}) por partida`,
  );
  Object.assign(EXP, {
    sent: 0,
    back: 0,
    days: 0,
    far: 0,
    dead: 0,
    heroes: 0,
    sites: 0,
    found: 0,
    lost: 0,
  });
  if (lossDays.length) {
    const at = (d: number) => lossDays.filter((x) => x === d).length;
    console.log(
      `  derrotas en cada pago (días 7 / 14 / 21 / 28): ${[7, 14, 21, 28].map((d) => pct(at(d), N)).join(' / ')}`,
    );
  }
  console.log('');
}
