import { roomMax } from '../../core/balance';
import type { GameState, Room } from '../../core/model';
import { LOCKED, worksOpen } from '../../core/rooms';
import { ROOMS } from '../../data/rooms';
import { Icon } from '../icons';

interface Props {
  game: GameState;
  planning: boolean;
  onRoom: (id: string) => void;
  onPlan: () => void;
}

const FLOOR_NAME = (f: number) =>
  f === 0 ? 'Planta baja' : f > 0 ? `Planta ${f}` : f === -1 ? 'Sótano' : `Sótano ${-f}`;

/** Estado corto de una sala para la lista. */
function stateOf(r: Room): string {
  if (r.works)
    return r.works.kind === 'build'
      ? 'en obras'
      : r.works.kind === 'move'
        ? 'mudándose'
        : 'ampliándose';
  if (r.level === 0) return r.type === 'torre' ? 'sin levantar' : 'rota';
  return `nivel ${r.level}`;
}

/**
 * Las salas del gremio por planta (toca una para ver su ficha) y la entrada al modo obras. Lo de
 * construir, excavar, el solar y las escaleras se hace en el modo obras, sobre la escena.
 */
export function ObrasPanel({ game, planning, onRoom, onPlan }: Props) {
  const open = worksOpen(game);
  const b = game.building;
  const floors = [...new Set(b.rooms.map((r) => r.floor))].sort((x, y) => y - x);

  return (
    <>
      {!open && <p class="panel-note">{LOCKED}</p>}
      {open && !planning && (
        <button class="btn btn-gold obras-plan" onClick={onPlan}>
          <Icon name="martillo" size={16} /> Modo obras
        </button>
      )}
      <section class="obras-floors">
        {floors.map((f) => (
          <div key={f} class="obras-floor">
            <span class="row-sub">{FLOOR_NAME(f)}</span>
            <div class="obras-rooms">
              {b.rooms
                .filter((r) => r.floor === f)
                .sort((x, y) => x.col - y.col)
                .map((r) => (
                  <button
                    key={r.id}
                    class={`obras-room ${r.level === 0 || r.works ? 'is-off' : ''}`}
                    aria-label={`${ROOMS[r.type].name}, ${stateOf(r)}`}
                    onClick={() => onRoom(r.id)}
                  >
                    <b>{ROOMS[r.type].name}</b>
                    <span class="pips" aria-hidden="true">
                      {Array.from({ length: roomMax(r.type) }, (_, i) => (
                        <i key={i} class={i < r.level ? 'on' : ''} />
                      ))}
                    </span>
                    <span class="row-sub">{stateOf(r)}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
