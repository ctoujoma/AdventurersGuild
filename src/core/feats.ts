/**
 * Hazañas (logros con niveles) y resumen de llegada. Se evalúa al amanecer sobre el estado ya
 * copiado (aquí se muta) y deja su línea en el resumen. Los objetivos están en `goals.ts`.
 */
import { FEATS } from '../data/feats';
import { GEAR } from '../data/items';
import { unlockName } from '../data/unlocks';
import type { Arrival, DawnEvent, GameState, Rarity, Reward, Stats } from './model';
import type { Rng } from './rng';

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
  if (r.unlock) parts.push(unlockName(r.unlock));
  return parts.join(' y ');
}

/** Cobra un premio: oro, fama y, si toca, una pieza de equipo al arcón. */
export function grant(s: GameState, rng: Rng, r: Reward): string {
  if (r.gold) s.gold += r.gold;
  if (r.rep) s.rep += r.rep;
  if (r.unlock && !(s.unlocks ?? []).includes(r.unlock))
    s.unlocks = [...(s.unlocks ?? []), r.unlock];
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
