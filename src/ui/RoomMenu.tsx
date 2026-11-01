import { useEffect, useRef } from 'preact/hooks';
import { upgradeCostOf } from '../core/rooms';
import type { GameState } from '../core/model';
import { ROOMS } from '../data/rooms';
import type { RoomScene } from '../world/rooms/RoomScene';
import { Icon } from './icons';

interface Props {
  scene: RoomScene;
  game: GameState;
  roomId: string;
  onUpgrade: (id: string) => void;
  onMove: (id: string) => void;
  onDemolish: (id: string) => void;
  onInfo: (id: string) => void;
  onClose: () => void;
}

/**
 * Menú de obras de la sala elegida, pegado encima de ella en la escena (la sigue al mover la
 * cámara): mejorar, mover, tirar e info. Para ampliarla están las casillas «+» de la escena.
 */
export function RoomMenu({
  scene,
  game,
  roomId,
  onUpgrade,
  onMove,
  onDemolish,
  onInfo,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const r = scene.roomRect(roomId);
      if (el && r) {
        const p = scene.screenOf(r.x + r.w / 2, r.y);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [scene, roomId]);
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const def = ROOMS[room.type];
  const cost = upgradeCostOf(room);
  return (
    <div ref={ref} class="room-menu" role="toolbar" aria-label={`Obras: ${def.name}`}>
      <b class="room-menu-name">
        {def.name} · nivel {room.level}
      </b>
      <div class="room-menu-row">
        <button
          class="room-menu-btn"
          disabled={cost === null}
          aria-label={
            cost === null
              ? 'Ya está al máximo'
              : `${room.level ? 'Mejorar' : 'Arreglar'} por ${cost}`
          }
          onClick={() => onUpgrade(roomId)}
        >
          <Icon name="mejorar" size={20} />
          <span>
            {cost === null ? (
              'Máx.'
            ) : (
              <>
                <Icon name="coin" size={8} /> {cost}
              </>
            )}
          </span>
        </button>
        {!def.fixed && (
          <button
            class="room-menu-btn"
            aria-label="Mover"
            data-tut="mover"
            onClick={() => onMove(roomId)}
          >
            <Icon name="mover" size={20} />
            <span>Mover</span>
          </button>
        )}
        {!def.fixed && (
          <button
            class="room-menu-btn"
            aria-label={def.keep ? 'Quitar (hay que ponerla en otro sitio)' : 'Tirar'}
            onClick={() => onDemolish(roomId)}
          >
            <Icon name="papelera" size={20} />
            <span>{def.keep ? 'Quitar' : 'Tirar'}</span>
          </button>
        )}
        <button class="room-menu-btn" aria-label="Información" onClick={() => onInfo(roomId)}>
          <Icon name="info" size={20} />
          <span>Info</span>
        </button>
        <button class="room-menu-btn" data-tut="cerrar" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={16} />
          <span>Cerrar</span>
        </button>
      </div>
    </div>
  );
}
