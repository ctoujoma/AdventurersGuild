/** La personalización de la taberna, con lo de serie si aún no se ha tocado nada. */
import { DEFAULT_NAME } from '../data/custom';
import type { Custom, GameState } from './model';

/** La taberna tal como la ha dejado el jugador (o como la dejó el tío). */
export const customOf = (s: GameState): Custom =>
  s.custom ?? {
    name: DEFAULT_NAME,
    color: 'vino',
    symbol: 'jarra',
    dog: false,
  };
