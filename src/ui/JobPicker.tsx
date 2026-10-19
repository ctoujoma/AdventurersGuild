import type { GameState, Room } from '../core/model';
import { canAssign, crewOf, hasPosts, slotsOf } from '../core/workers';
import { ROOMS } from '../data/rooms';

/** Planta de una sala, para distinguir dos salas iguales. */
const floorName = (f: number) => (f === 0 ? 'planta baja' : f > 0 ? `planta ${f}` : `sótano ${-f}`);

/** Nombre de una sala con trabajo («Cocina», o «Cocina · sótano 1» si hay más de una). */
export function jobRoomName(game: GameState, r: Room): string {
  const name = ROOMS[r.type].name;
  const twins = game.building.rooms.filter((x) => x.type === r.type).length;
  return twins > 1 ? `${name} · ${floorName(r.floor)}` : name;
}

/** Salas en uso donde se puede trabajar, con sus puestos ocupados. */
export function jobRooms(game: GameState): { room: Room; used: number; slots: number }[] {
  return game.building.rooms
    .filter((r) => hasPosts(r.type) && slotsOf(r) > 0)
    .map((room) => {
      const c = crewOf(game, room.id);
      return { room, used: c.workers.length + c.heroes.length, slots: slotsOf(room) };
    });
}

interface Props {
  game: GameState;
  /** Trabajador o héroe. */
  who: string;
  current?: string;
  /** Texto de la opción «sin sala». */
  idle?: string;
  onAssign: (room: string | null) => void;
}

/** Desplegable para elegir dónde trabaja alguien. */
export function JobPicker({ game, who, current, idle = 'Descansa', onAssign }: Props) {
  return (
    <select
      class="job-select"
      value={current ?? ''}
      aria-label="Dónde trabaja"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        onAssign(v || null);
      }}
    >
      <option value="">{idle}</option>
      {jobRooms(game).map(({ room, used, slots }) => (
        <option
          key={room.id}
          value={room.id}
          disabled={room.id !== current && !!canAssign(game, who, room.id)}
        >
          {jobRoomName(game, room)} ({used}/{slots})
        </option>
      ))}
    </select>
  );
}
