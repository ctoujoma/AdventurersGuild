import type { GameState, Room } from '../core/model';
import { ROOMS } from '../data/rooms';
import { t } from '../textos';

/** Planta de una sala, para distinguir dos salas iguales. */
const floorName = (f: number) =>
  f === 0
    ? t('barra.roomname.planta_baja')
    : f > 0
      ? t('barra.roomname.planta', { n: f })
      : t('barra.roomname.sotano', { n: -f });

/** Nombre de una sala con trabajo («Cocina», o «Cocina · sótano 1» si hay más de una). */
export function jobRoomName(game: GameState, r: Room): string {
  const name = ROOMS[r.type].name;
  const twins = game.building.rooms.filter((x) => x.type === r.type).length;
  return twins > 1 ? `${name} · ${floorName(r.floor)}` : name;
}
