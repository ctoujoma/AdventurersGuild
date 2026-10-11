/**
 * Hazañas (logros con niveles), desafíos del mes y resumen de llegada. Todo se evalúa al
 * amanecer sobre el estado ya copiado (aquí se muta) y deja su línea en el resumen.
 */
import { FEATS, MONTH_POOL } from '../data/feats';
import { GEAR } from '../data/items';
import type { Arrival, DawnEvent, GameState, Rarity, Reward, Stats } from './model';
import type { Rng } from './rng';

export const MONTH_DAYS = 30;
export const MONTH_GOALS = 3;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function emptyStats(): Stats {
  return {
    missions: 0,
    wins: 0,
    brilliant: 0,
    trophies: 0,
    goldEarned: 0,
    maxLvl: 1,
    lastDeath: 0,
    raids: 0,
    byType: {},
  };
}

/** Valor de un contador: un campo de Stats, 'safeDays' o 'byType:<tipo>'. */
export function statValue(s: GameState, key: string): number {
  const st = s.stats ?? emptyStats();
  if (key === 'safeDays') return s.day - st.lastDeath;
  if (key.startsWith('byType:')) return st.byType[key.slice(7) as keyof Stats['byType']] ?? 0;
  const v = st[key as keyof Stats];
  return typeof v === 'number' ? v : 0;
}

export function rewardText(r: Reward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`${r.gold} monedas`);
  if (r.rep) parts.push(`${r.rep} de reputación`);
  if (r.item !== undefined)
    parts.push(['equipo común', 'equipo bueno', 'equipo legendario'][r.item]!);
  return parts.join(' y ');
}

/** Cobra un premio: oro, fama y, si toca, una pieza de equipo al arcón. */
export function grant(s: GameState, rng: Rng, r: Reward): string {
  if (r.gold) s.gold += r.gold;
  if (r.rep) s.rep += r.rep;
  let extra = '';
  if (r.item !== undefined) {
    const base = rng.pick(GEAR.filter((g) => g.rarity === (r.item as Rarity)));
    s.inventory.push({ ...base, id: `i${s.uid++}` });
    extra = ` (${base.name})`;
  }
  return rewardText(r) + extra;
}

/** Cobra los niveles de hazaña recién cumplidos. */
export function checkFeats(s: GameState, rng: Rng, events: DawnEvent[]): void {
  s.feats ??= {};
  for (const f of FEATS) {
    let got = s.feats[f.id] ?? 0;
    while (got < f.tiers.length && statValue(s, f.stat) >= f.tiers[got]!) {
      const what = grant(s, rng, f.rewards[got]!);
      events.push({ t: `Hazaña: «${f.name}» ${ROMAN[got]}. Premio: ${what}.`, k: 'good' });
      got++;
    }
    s.feats[f.id] = got;
  }
}

/** Empieza un mes nuevo con desafíos distintos. */
export function startMonth(s: GameState, rng: Rng): void {
  const pool = [...MONTH_POOL];
  const goals = [];
  for (let i = 0; i < MONTH_GOALS && pool.length; i++) {
    const g = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    goals.push({ ...g, base: statValue(s, g.stat), done: false });
  }
  s.month = { start: s.day, end: s.day + MONTH_DAYS, goals };
}

/** Avanza los desafíos del mes: premia los cumplidos y renueva al acabar. */
export function checkMonth(s: GameState, rng: Rng, events: DawnEvent[]): void {
  if (s.mode !== 'libre') return;
  if (!s.month) return startMonth(s, rng);
  for (const g of s.month.goals) {
    if (g.done || statValue(s, g.stat) - g.base < g.target) continue;
    g.done = true;
    events.push({
      t: `Desafío del mes cumplido: ${g.text}. Premio: ${grant(s, rng, g.reward)}.`,
      k: 'good',
    });
  }
  if (s.day >= s.month.end) {
    const done = s.month.goals.filter((g) => g.done).length;
    events.push({
      t: `Se acaba el mes: ${done} de ${s.month.goals.length} desafíos cumplidos. Hay desafíos nuevos en el Libro de hazañas.`,
      k: 'info',
    });
    startMonth(s, rng);
  }
}

/** Progreso de un desafío del mes. */
export const goalProgress = (s: GameState, g: { stat: string; base: number; target: number }) =>
  Math.min(g.target, Math.max(0, statValue(s, g.stat) - g.base));

/** Cómo llega el gremio a la apertura (y su puntuación, para comparar intentos). */
export function arrival(s: GameState, alive: number): Arrival {
  const facilities = Object.values(s.fac).reduce((a, b) => a + b, 0);
  const trophies = s.trophies.length;
  const fallen = s.heroes.filter((h) => h.status === 'muerto').length;
  const score =
    s.gold +
    s.rep * 5 +
    alive * 50 +
    trophies * 60 +
    facilities * 25 -
    fallen * 40 +
    s.inventory.reduce((a, i) => a + i.value, 0);
  return {
    day: s.day,
    heroes: alive,
    gold: s.gold,
    rep: s.rep,
    trophies,
    facilities,
    fallen,
    score,
  };
}
