/**
 * Partidas de la versión 6 a la 7: la escalera nueva de los héroes (veterano a 8, maestro a 12,
 * nivel máximo 15; ver `VET_LEVEL` en `balance.ts`). Decidido con el usuario (22 de noviembre):
 * - quien ya era veterano (nivel 4 a 7) lo sigue siendo (`vet`) y no pierde su cuarto;
 * - lo pagado cuenta: quien pidió el caché del 5 o del 8 no vuelve a pedir el del 8 (sí el del 12);
 * - quien pase del 15 se queda en 15, con el sueldo de ese nivel.
 */
import { LEVEL_MAX, VET_LEVEL, levelRaise } from './balance';
import type { GameState } from './model';

/** Veterano y primer caché con la regla de antes. */
const OLD_VET = 4;
const OLD_CACHE = 5;
/** La subida de sueldo de antes (para quitar la de los niveles que pasan del máximo). */
const oldRaise = (lvl: number) => (lvl <= 5 ? 2 * lvl : 4 * lvl);

export function newLadder(s: GameState): void {
  for (const h of s.heroes) {
    if (h.lvl >= OLD_VET && h.lvl < VET_LEVEL) h.vet = true;
    if (h.lvl >= OLD_CACHE && h.lvl < LEVEL_MAX) h.cacheAt = Math.max(h.cacheAt ?? 0, VET_LEVEL);
    if (h.lvl > LEVEL_MAX) {
      for (let l = LEVEL_MAX + 1; l <= h.lvl; l++) h.salary -= oldRaise(l);
      h.salary = Math.max(levelRaise(1), h.salary);
      h.lvl = LEVEL_MAX;
      h.xp = 0;
      // Lo que pidiera por un nivel que ya no existe, fuera.
      if (h.request === 'cache') delete h.request;
      h.cacheAt = LEVEL_MAX;
    }
  }
  if (s.stats) s.stats.maxLvl = Math.min(s.stats.maxLvl, LEVEL_MAX);
}
