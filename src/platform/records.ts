import type { Arrival, GameState } from '../core/model';

/** Récords entre partidas: se guardan aparte de la partida, en este navegador. */
export interface Records {
  bestArrival: Arrival | null;
  maxDays: number;
  maxGold: number;
  maxTrophies: number;
}

const KEY = 'jarro:records';
const EMPTY: Records = { bestArrival: null, maxDays: 0, maxGold: 0, maxTrophies: 0 };

export function loadRecords(): Records {
  try {
    return { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Records | null) };
  } catch {
    return { ...EMPTY };
  }
}

/** Récords actualizados con el estado de una partida (el mismo objeto si nada mejora). */
export function mergeRecords(r: Records, s: GameState): Records {
  const a = s.opening;
  const next: Records = {
    bestArrival: a && (!r.bestArrival || a.score > r.bestArrival.score) ? a : r.bestArrival,
    maxDays: Math.max(r.maxDays, s.day),
    maxGold: Math.max(r.maxGold, s.gold),
    maxTrophies: Math.max(r.maxTrophies, s.trophies.length),
  };
  const same =
    next.bestArrival === r.bestArrival &&
    next.maxDays === r.maxDays &&
    next.maxGold === r.maxGold &&
    next.maxTrophies === r.maxTrophies;
  return same ? r : next;
}

export function saveRecords(r: Records): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Sin almacenamiento: los récords duran lo que dure la sesión.
  }
}
