/**
 * Objetivos siempre activos: siempre tres; al cumplir uno se cobra, se apunta en el Libro y sale
 * otro. Se miran con el juego abierto (en cada `tick`) y al amanecer. Los datos están en
 * `data/goals.ts`; las piezas que se ganan, en `data/unlocks.ts`.
 */
import { GOALS, GOAL_LOG, GOAL_SLOTS, type GoalDef } from '../data/goals';
import { ROOMS } from '../data/rooms';
import { FEATS } from '../data/feats';
import { FREE, unlockName, type UnlockId } from '../data/unlocks';
import { levelRank, rankIndex, roomMax } from './balance';
import { grant, statValue } from './feats';
import type { ActiveGoal, ChipKind, GameState, Goals, Reward } from './model';
import { Rng } from './rng';
import { active } from './rooms';

const defOf = (id: string) => GOALS.find((g) => g.id === id);

/** Nivel más alto en uso de un tipo de sala (0 si no hay). */
const roomLevel = (s: GameState, type: string) =>
  Math.max(0, ...s.building.rooms.filter((r) => r.type === type).map((r) => active(r).level));

/** Lo que vale ahora lo que mide un objetivo (sin restar la base). */
function measure(s: GameState, d: GoalDef): number {
  if ('stat' in d) return statValue(s, d.stat);
  if ('room' in d) return roomLevel(s, d.room);
  if (d.have === 'beer') return s.beer;
  if (d.have === 'food') return s.food;
  if (d.have === 'workers') return s.workers.length;
  if (d.have === 'rep') return s.rep;
  return s.heroes.filter((h) => h.status !== 'muerto' && h.status !== 'desaparecido').length;
}

/** Cuánto lleva un objetivo en curso (de 0 a lo que pide). */
export function goalProgress(s: GameState, g: ActiveGoal): number {
  const d = defOf(g.id);
  if (!d) return 0;
  return Math.max(0, Math.min(g.target, measure(s, d) - g.base));
}

/** Si un objetivo puede salir ahora: no repetido (salvo los de contar) y que aún no esté hecho. */
function available(s: GameState, d: GoalDef, goals: Goals): boolean {
  if (goals.active.some((g) => g.id === d.id)) return false;
  if ('stat' in d) return true;
  if (goals.done[d.id]) return false;
  if ('room' in d) {
    // La sala ya está, un nivel por debajo, y el siguiente se puede hacer con el rango de ahora.
    return (
      roomLevel(s, d.room) === d.level - 1 &&
      d.level <= roomMax(d.room) &&
      levelRank(d.room, d.level) <= rankIndex(s.rep)
    );
  }
  if (d.after && !goals.done[d.after]) return false;
  return measure(s, d) < d.n;
}

/** Saca un objetivo nuevo con lo que pide y su premio (los que se repiten piden y dan más). */
function make(s: GameState, d: GoalDef, goals: Goals): ActiveGoal {
  const times = goals.done[d.id] ?? 0;
  if ('stat' in d) {
    const target = d.n + d.step * times;
    const r = d.reward;
    const reward: Reward = { ...r };
    if (r.gold) reward.gold = Math.round((r.gold * (1 + 0.5 * times)) / 5) * 5;
    if (r.rep) reward.rep = r.rep + Math.floor(times / 2);
    return {
      id: d.id,
      text: d.text.replace('{n}', String(target)),
      base: measure(s, d),
      target,
      reward,
    };
  }
  if ('room' in d)
    return {
      id: d.id,
      text: d.text.replace('{sala}', ROOMS[d.room].name),
      base: 0,
      target: d.level,
      reward: d.reward,
    };
  return {
    id: d.id,
    text: d.text.replace('{n}', String(d.n)),
    base: 0,
    target: d.n,
    reward: d.reward,
  };
}

/** Si hay algo que hacer con los objetivos (faltan, o alguno está cumplido). */
export function goalsPending(s: GameState): boolean {
  const g = s.goals;
  if (!g || g.active.length < GOAL_SLOTS) return true;
  return g.active.some((a) => goalProgress(s, a) >= a.target);
}

/**
 * Cobra los objetivos cumplidos, los apunta en el Libro y rellena hasta tres. Muta `s` (una
 * copia entera: el premio toca la caja, el arcón y las piezas) y deja lo que se cuenta en `out`.
 */
export function checkGoals(s: GameState, rng: Rng, out: { t: string; k?: ChipKind }[]): void {
  const goals: Goals = s.goals ?? { active: [], done: {}, log: [] };
  s.goals = goals;
  for (const g of [...goals.active]) {
    if (goalProgress(s, g) < g.target) continue;
    const what = grant(s, rng, g.reward);
    goals.active = goals.active.filter((a) => a !== g);
    goals.done[g.id] = (goals.done[g.id] ?? 0) + 1;
    goals.log.unshift({ day: s.day, text: g.text, reward: what });
    goals.log.length = Math.min(goals.log.length, GOAL_LOG);
    out.push({ t: `Objetivo cumplido: ${g.text}. Premio: ${what}.`, k: 'good' });
  }
  while (goals.active.length < GOAL_SLOTS) {
    const pool = GOALS.filter((d) => available(s, d, goals));
    if (!pool.length) break;
    // Las salas pesan más: es lo que hace crecer la taberna.
    const d = rng.weighted(pool.map((x) => [x, 'room' in x ? 3 : 'stat' in x ? 2 : 1] as const));
    goals.active.push(make(s, d, goals));
  }
}

/** Mira los objetivos con el juego abierto (en el `tick`): copia y cobra solo si hace falta. */
export function tickGoals(s: GameState): { next: GameState; news: { t: string; k?: ChipKind }[] } {
  if (!goalsPending(s)) return { next: s, news: [] };
  const next = structuredClone(s);
  const rng = new Rng(next.rng);
  const news: { t: string; k?: ChipKind }[] = [];
  checkGoals(next, rng, news);
  next.rng = rng.save();
  return { next, news };
}

// ---------- Lo que se ve y se gana ----------

/** Si la partida tiene una pieza (las de serie, siempre). */
export const hasUnlock = (s: GameState, id: UnlockId) =>
  FREE.includes(id) || (s.unlocks ?? []).includes(id);

/** De dónde sale una pieza, para decirlo junto al candado. */
export function unlockSource(id: UnlockId): string | null {
  for (const f of FEATS) {
    const i = f.rewards.findIndex((r) => r.unlock === id);
    if (i >= 0) return `Hazaña «${f.name}» ${['I', 'II', 'III', 'IV', 'V'][i]}`;
  }
  const g = GOALS.find((x) => x.reward.unlock === id);
  if (g)
    return `Objetivo: ${g.text
      .replace('{n}', 'n' in g ? String(g.n) : '')
      .replace('{sala}', 'room' in g ? ROOMS[g.room].name : '')}`;
  return null;
}

export { unlockName };
