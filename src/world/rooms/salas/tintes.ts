/**
 * Temas de color de las telas de cada sala: la escena viste cada sala con el tema que ha
 * elegido el jugador (`dress`) y cada pieza de tela pide sus tonos con `cloth`, dando los de
 * siempre («de la casa»). Sin tema, todo se pinta igual que antes.
 */
import type { Room } from '../../../core/model';
import { TINTS, type TintId } from '../../../data/custom';

/** Cuatro tonos de una tela, de la sombra a la luz. */
export type Cloth = readonly [string, string, string, string];

type Dressed = Room & { tint?: TintId };

/** La sala con su tema (una copia; si no tiene, la misma). */
export function dress(room: Room, tints?: Readonly<Record<string, TintId>>): Room {
  const tint = tints?.[room.id];
  return tint && TINTS[tint] ? ({ ...room, tint } as Dressed) : room;
}

export const tintOf = (room: Room): TintId | undefined => (room as Dressed).tint;

/** Los tonos de una tela de la sala: los del tema elegido o, sin él, los de la casa. */
export function cloth(room: Room, house: Cloth): Cloth {
  const t = tintOf(room);
  return t ? TINTS[t].ramp : house;
}
