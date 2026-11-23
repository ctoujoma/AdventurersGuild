import type { PixelBuffer } from '../../art/pixel';
import type { Capa } from './capas';
import type { Encuadre } from './encuadre';
import type { Luz } from './luz';
import type { MarchNow } from './marcha';

/** Lo que reciben las piezas del visor para pintar un fotograma. */
export interface Ctx {
  b: PixelBuffer;
  e: Encuadre;
  l: Luz;
  /** Clave de la luz (para las cachés de muñecos teñidos). */
  lk: string;
  time: number;
  /** Lo andado (píxeles de suelo; de vuelta, hacia atrás). */
  travel: number;
  m: MarchNow;
  capas: Capa[];
  seed: number;
  walking: boolean;
}
