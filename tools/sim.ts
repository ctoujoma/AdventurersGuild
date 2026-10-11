/**
 * Simulador de balance sin interfaz: juega muchas partidas de «La deuda» con estrategias
 * sencillas y saca estadísticas. Uso: `npm run sim -- [partidas]`.
 */
import { capacity } from '../src/core/balance';
import {
  canHire,
  canUpgrade,
  nextPayment,
  reduce,
  newGame,
  roster,
  salaries,
  upgradeCost,
} from '../src/core/game';
import type { GameState, Hero, Outcome } from '../src/core/model';
import { questEstimate } from '../src/core/resolve';

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
      st.equip && it.kind && it.kind !== 'tesoro'
        ? s.heroes.find((h) => h.status === 'ok' && !h.item)
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
  return reduce(s, { type: 'endDay' });
}

const value = (h: Hero) => h.attrs.F + h.attrs.D + h.attrs.M + h.lvl * 3;

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
  const outcomes: Record<Outcome, number> = {
    'Éxito brillante': 0,
    Éxito: 0,
    'Éxito parcial': 0,
    Fracaso: 0,
    Desastre: 0,
  };
  for (let i = 0; i < N; i++) {
    let s = newGame(`sim-${i}`);
    const start = s.heroes.length;
    while (!s.over && s.mode !== 'libre') s = playDay(s, st);
    if (s.mode === 'libre') {
      wins++;
      golds.push(s.gold);
      // Modo libre: ¿aguanta el gremio otros días pagando a sus veteranos?
      for (let d = 0; d < FREE_DAYS && !s.over; d++) {
        for (const h of s.heroes)
          if (h.request) s = reduce(s, { type: 'answer', id: h.id, yes: true });
        s = playDay(s, st);
      }
      if (s.over) broke++;
      else freeGold.push(s.gold);
    } else lossDays.push(s.day);
    deaths.push(s.heroes.filter((h) => h.status === 'muerto').length);
    hired.push(s.heroes.length - start);
    sent.push(s.reports.length);
    for (const r of s.reports) outcomes[r.outcome]++;
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
  if (total)
    console.log(
      `  resultados: ${Object.entries(outcomes)
        .map(([k, v]) => `${k} ${pct(v, total)}`)
        .join(' · ')}`,
    );
  console.log('');
}
