/**
 * Calibrado de la pelea contra jefes (copia del simulador): compara la probabilidad de antes
 * con la de la pelea nueva para los grupos que el simulador manda a por un jefe. No se usa en el juego.
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
import type { GameState, Hero } from '../src/core/model';
import { equip, questEstimate } from '../src/core/resolve';
import { bossOf } from '../src/core/chains';
import { rankIndex } from '../src/core/balance';
import {
  Combat,
  FOE_TUNE,
  heroUnit,
  questFoes,
  runCombat,
  setupCombat,
  type CombatSetup,
} from '../src/core/combat';

/** Un jugador que sabe: cura a tiempo, provoca si alguien flojo sufre, bola con varios enemigos, puñalada al jefe. */
function smart(setup: CombatSetup): boolean {
  const c = new Combat(setup, [], false);
  while (!c.result) {
    const first = c.heroes().find((h) => h.hp > 0);
    if (first) c.order({ who: first.id, kind: 'cover' });
    for (const u of c.heroes()) {
      if (u.hp <= 0 || u.charge! > 0) continue;
      const hs = c.heroes().filter((h) => h.hp > 0);
      const fs = c.foes().filter((f) => f.hp > 0);
      const low = hs.some((h) => h.hp < h.max * 0.5);
      if (u.ability === 'curar' && low) c.order({ who: u.id, kind: 'skill' });
      else if (u.ability === 'provocar' && hs.some((h) => h !== u && h.hp < h.max * 0.6))
        c.order({ who: u.id, kind: 'skill' });
      else if (u.ability === 'bola' && fs.length >= 2) c.order({ who: u.id, kind: 'skill' });
      else if (u.ability === 'bola' && fs.length === 1 && (u.readyFor ?? 0) > 0)
        c.order({ who: u.id, kind: 'skill' });
      else if (u.ability === 'punalada' || u.ability === 'andanada')
        c.order({ who: u.id, kind: 'skill' });
    }
    c.tick();
  }
  return c.result!.won;
}
/** Un jugador que mira y no toca nada (las habilidades salen solas, tarde). */
function idle(setup: CombatSetup): boolean {
  return new Combat(setup, [], false).run().won;
}
import type { Facilities, Quest } from '../src/core/model';
const BOSS_SENDS: { q: Quest; party: Hero[]; p: number; rank: number; fac: Facilities }[] = [];
import { vaultFull, vaultOf } from '../src/core/vault';

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
      if (pick && bossOf(q))
        BOSS_SENDS.push({ q, party: pick, p: bestP, rank: rankIndex(s.rep), fac: s.fac });
      if (pick) s = reduce(s, { type: 'send', questId: q.id, heroIds: pick.map((h) => h.id) });
    }
  }
  return reduce(s, { type: 'endDay' });
}

const value = (h: Hero) => h.attrs.F + h.attrs.D + h.attrs.M + h.lvl * 3;

const N = Number(process.argv[2] ?? 100);
const st = STRATEGIES[2]!;
for (let i = 0; i < N; i++) {
  let s = newGame(`calib-${i}`);
  for (let d = 0; d < 80 && !s.over; d++) {
    for (const h of s.heroes) if (h.request) s = reduce(s, { type: 'answer', id: h.id, yes: true });
    s = playDay(s, st);
  }
}

// Uso: npm run calib -- [partidas] [escalas separadas por comas, p. ej. 0.9,1,1.1]
const BASE = { ...FOE_TUNE };
for (const k of (process.argv[3] ?? '1').split(',').map(Number)) {
  FOE_TUNE.hp = BASE.hp * k;
  FOE_TUNE.atk = BASE.atk * k;
  FOE_TUNE.minionHp = BASE.minionHp * k;
  FOE_TUNE.minionAtk = BASE.minionAtk * k;
  console.log(`— escala ${k}`);
  const rows = new Map<
    string,
    {
      n: number;
      before: number;
      after: number;
      lvl: number;
      size: number;
      d: number;
      c: number;
      sm: number;
      id: number;
    }
  >();
  for (const b of BOSS_SENDS) {
    const boss = bossOf(b.q)!;
    const heroes = equip(b.party, b.fac).map((h) => heroUnit(h));
    let won = 0;
    let sm = 0;
    let id = 0;
    const R = 20;
    for (let k = 0; k < R; k++) {
      const setup = setupCombat(`c${k}`, boss, heroes, questFoes(boss, b.q.challenges));
      if (runCombat(setup).won) won++;
      if (smart(setup)) sm++;
      if (idle(setup)) id++;
    }
    const r = rows.get(boss) ?? {
      n: 0,
      before: 0,
      after: 0,
      lvl: 0,
      size: 0,
      d: 0,
      c: 0,
      sm: 0,
      id: 0,
    };
    r.d += b.q.challenges.reduce((a, c) => a + c.diff, 0) / b.q.challenges.length;
    r.c += b.q.challenges.length;
    r.n++;
    r.before += b.p;
    r.after += won / R;
    r.sm += sm / R;
    r.id += id / R;
    r.lvl += b.party.reduce((a, h) => a + h.lvl, 0) / b.party.length;
    r.size += b.party.length;
    rows.set(boss, r);
  }
  for (const [boss, r] of rows)
    console.log(
      `${boss}: ${r.n} grupos · nivel ${(r.lvl / r.n).toFixed(1)} · ${(r.size / r.n).toFixed(1)} héroes · dif ${(r.d / r.n).toFixed(1)} x${(r.c / r.n).toFixed(1)} · antes ${((100 * r.before) / r.n).toFixed(0)} % · sola ${((100 * r.after) / r.n).toFixed(0)} % · sin tocar ${((100 * r.id) / r.n).toFixed(0)} % · jugando bien ${((100 * r.sm) / r.n).toFixed(0)} %`,
    );
}
