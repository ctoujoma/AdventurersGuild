import { hpOf, isLight } from '../core/health';
import type { GameState } from '../core/model';
import { t } from '../textos';

/**
 * Aviso al formar un grupo con heridos leves: pueden ir, pero empiezan las peleas con la vida
 * que les queda (`core/health.ts`). Null si no va ninguno.
 */
export function hurtNote(game: GameState, ids: readonly string[]): string | null {
  const hurt = game.heroes.filter((h) => ids.includes(h.id) && isLight(h));
  if (!hurt.length) return null;
  return t('ficha.herocard.van_heridos', {
    quien: hurt.map((h) => `${h.name} (${Math.round(hpOf(h) * 100)} %)`),
    n: hurt.length,
  });
}
