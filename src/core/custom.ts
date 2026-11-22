/** La personalización de la taberna, con lo de serie si aún no se ha tocado nada. */
import { DEFAULT_NAME, isDefaultName } from '../data/custom';
import type { Custom, GameState } from './model';

/**
 * La taberna tal como la ha dejado el jugador (o como la dejó el tío). Sin bautizar, el nombre de
 * serie sale en el idioma de ahora (aunque la partida se empezara en otro).
 */
export const customOf = (s: GameState): Custom =>
  s.custom
    ? isDefaultName(s.custom.name)
      ? { ...s.custom, name: DEFAULT_NAME }
      : s.custom
    : { name: DEFAULT_NAME, color: 'vino', symbol: 'jarra', dog: false };
