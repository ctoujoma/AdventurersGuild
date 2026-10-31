import type { GameState, Room } from '../core/model';
import { ROOMS } from '../data/rooms';

/** Planta de una sala, para distinguir dos salas iguales. */
const floorName = (f: number) => (f === 0 ? 'planta baja' : f > 0 ? `planta ${f}` : `sótano ${-f}`);

/** Nombre de una sala con trabajo («Cocina», o «Cocina · sótano 1» si hay más de una). */
export function jobRoomName(game: GameState, r: Room): string {
  const name = ROOMS[r.type].name;
  const twins = game.building.rooms.filter((x) => x.type === r.type).length;
  return twins > 1 ? `${name} · ${floorName(r.floor)}` : name;
}
