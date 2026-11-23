/**
 * Los hallazgos que brillan (bloque 4; EX18): la misma escala en el visor, la mochila, los avisos y
 * el informe. Común, un «tac» y nada; bueno, destello; raro, brillo azul; legendario, rayo dorado,
 * pausa y fanfarria.
 */
import type { Sfx } from '../audio/audio';
import type { Glow } from '../core/model';

export type GlowLevel = 0 | Glow;

export const GLOW_SFX: Record<GlowLevel, Sfx> = {
  0: 'tac',
  1: 'glint',
  2: 'shimmer',
  3: 'fanfare',
};

/** La clase CSS del brillo (vacía para lo común). */
export const glowClass = (g: GlowLevel | undefined): string => (g ? `glow-${g}` : '');
