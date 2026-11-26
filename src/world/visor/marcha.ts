/** Lo que pinta el visor de una expedición (lo rellena `ui/expedition.ts`, `marchNow`). */
import type { FoeKind } from '../../core/journey';
import type { BossFight, ExpKind, ExpWeather, Heading } from '../../core/model';
import type { Terrain } from '../../data/places';
import type { Dress } from '../../data/custom';
import type { ExpEvent } from '../../data/expEvents';

/** Lo que hacen ahora. */
/** Lo que hacen: andar, pelear, acampar o esperar parados (un suceso, un jefe a la vista). */
export type MarchMode = 'walk' | 'fight' | 'camp' | 'wait';

export interface MarchNow {
  seed: string;
  terrain: Terrain;
  crew: BossFight['heroes'];
  mode: MarchMode;
  night: boolean;
  /** De vuelta a casa (andan hacia la izquierda). */
  home: boolean;
  /** Contra qué pelean, si pelean. */
  foe: FoeKind;
  /** Lo salvaje del sitio (0 cerca de casa, 1 muy lejos). */
  wild: number;
  /** El último suceso, si es reciente (sale en un bocadillo). */
  last?: ExpKind;
  /**
   * Hora del día para la luz (0–24, con decimales; 0 medianoche): andan de 7 a 19 y acampan de
   * 19 a 7, así el alba cae en el campamento y la niebla de la mañana al echar a andar.
   */
  hour?: number;
  /** El tiempo del día en el rumbo (`expWeather`). */
  weather?: ExpWeather;
  /** Día de la expedición (para la luna y la semilla del tiempo). */
  day?: number;
  /** Lo de la sastrería de cada héroe (por id): el traje y el color, como en la taberna. */
  dress?: Record<string, Dress>;
  /** El rumbo (el guardián que sale a la vista es el suyo). */
  heading?: Heading;
  /** El enemigo de verdad (rumbo y número en `expediciones.enemigos`): su dibujo propio. */
  rival?: { heading: Heading; idx: number };
  /** El suceso que tienen delante mientras esperan a que elijas (con un jefe, cuál). */
  event?: { kind: ExpEvent; foe?: number };
}
