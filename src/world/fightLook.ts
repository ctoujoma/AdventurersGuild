/**
 * Cómo se ve el registro común de las peleas (`FightEvent`) en todas las escenas: la arena del
 * jefe (`battle.ts`), el asalto (`rooms/raid.ts`) y el duelo con el ladrón (`RoomScene`). Así
 * los números, los críticos y sus sonidos son iguales en todas.
 */
import { P } from '../art/palette';
import type { FightEvent } from '../core/fight';

/** Daño a los de fuera, crítico, daño a los nuestros y cura. */
export type NumberKind = 'hit' | 'crit' | 'hurt' | 'heal';

export const NUMBER_COLOR: Record<NumberKind, string> = {
  hit: P.white,
  crit: P.lemon,
  hurt: P.red,
  heal: P.lime,
};

/** El sonido de un crítico que entra (además del golpe). */
export const CRIT_SOUND = { name: 'zap', volume: 0.7 } as const;

/**
 * El número que sale de un suceso, o null si no tiene: el golpe con lo que pega (`amount`) y la
 * cura con lo que cura de verdad (`dealt`).
 */
export function numberOf(
  e: FightEvent,
  isHero: (id: string) => boolean,
): { id: string; text: string; kind: NumberKind } | null {
  if (e.kind === 'hit')
    return {
      id: e.to,
      text: String(Math.max(0, Math.round(e.amount))),
      kind: e.crit ? 'crit' : isHero(e.to) ? 'hurt' : 'hit',
    };
  if (e.kind === 'heal') return { id: e.to, text: String(Math.round(e.dealt)), kind: 'heal' };
  return null;
}
