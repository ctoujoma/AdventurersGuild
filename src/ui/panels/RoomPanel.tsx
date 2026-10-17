import { roomMax } from '../../core/balance';
import { canWork } from '../../core/game';
import type { GameState } from '../../core/model';
import { upgradeCostOf } from '../../core/rooms';
import { FACILITY_INFO } from '../../data/labels';
import { ROOMS, type RoomType } from '../../data/rooms';
import { plural } from '../../core/text';
import { Icon } from '../icons';

/** A dónde lleva cada sala: los paneles de siempre que tienen que ver con ella. */
export type RoomLink = 'tablon' | 'candidatos' | 'casa' | 'heroes' | 'libro' | 'equipo' | 'tesoros';

const LINKS: Partial<Record<RoomType, { to: RoomLink; label: string }[]>> = {
  salon: [
    { to: 'tablon', label: 'Tablón de encargos' },
    { to: 'candidatos', label: 'Candidatos' },
    { to: 'casa', label: 'Tu taberna' },
  ],
  recibidor: [{ to: 'heroes', label: 'Guardia' }],
  dormitorio: [{ to: 'heroes', label: 'Héroes' }],
  veteranos: [{ to: 'heroes', label: 'Héroes' }],
  mapas: [{ to: 'libro', label: 'Libro de hazañas' }],
  armeria: [{ to: 'equipo', label: 'Equipo' }],
  forja: [{ to: 'equipo', label: 'Equipo' }],
  tesoro: [{ to: 'tesoros', label: 'Tesoros' }],
};

interface Props {
  game: GameState;
  roomId: string;
  onUpgrade: (id: string) => void;
  onLink: (to: RoomLink) => void;
}

/** Ficha de una sala: para qué sirve, su nivel y arreglarla o mejorarla. */
export function RoomPanel({ game, roomId, onUpgrade, onLink }: Props) {
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return <p class="muted">Esa sala ya no está.</p>;
  const def = ROOMS[room.type];
  const info = def.fac ? FACILITY_INFO[def.fac] : null;
  const max = roomMax(room.type);
  const cost = upgradeCostOf(room);
  const why = canWork(game, { type: 'upgradeRoom', id: room.id });
  const size = room.w * room.h;
  const state = room.works
    ? `En obras: estará ${room.works.kind === 'move' ? 'en su sitio' : 'lista'} en ${room.works.nights} ${plural(room.works.nights, 'noche', 'noches')}.`
    : room.level === 0
      ? room.type === 'torre'
        ? 'Solar vacío: hay que levantarla.'
        : 'Rota: hay que arreglarla para que sirva.'
      : null;
  return (
    <article class="card-paper facility is-focus" data-help={info?.levels[room.level]}>
      <div class="facility-info">
        <span class="facility-name">
          <b>{def.name}</b>
          <span class="pips" aria-label={`Nivel ${room.level} de ${max}`}>
            {Array.from({ length: max }, (_, i) => (
              <i key={i} class={i < room.level ? 'on' : ''} />
            ))}
          </span>
        </span>
        <span class="muted">{def.desc}</span>
        {state && <span class="muted">{state}</span>}
        {size > 1 && (
          <span class="muted">
            Ocupa {size} {plural(size, 'hueco', 'huecos')}.
          </span>
        )}
        {info && room.level > 0 && <span class="muted">{info.effect(room.level)}</span>}
        {info && cost !== null && (
          <span class="next-level">Mejora: {info.effect(room.level + 1)}</span>
        )}
        <span class="room-links">
          {(LINKS[room.type] ?? []).map((l) => (
            <button key={l.to} class="btn btn-wood" onClick={() => onLink(l.to)}>
              {l.label}
            </button>
          ))}
        </span>
      </div>
      {cost !== null ? (
        <button
          class="btn btn-gold"
          aria-label={`${room.level === 0 ? 'Arreglar' : 'Mejorar'} ${def.name} por ${cost} monedas`}
          disabled={!!why}
          title={why ?? undefined}
          onClick={() => onUpgrade(room.id)}
        >
          <Icon name="coin" size={12} /> {cost}
        </button>
      ) : (
        <span class="pill pill-ok">Máximo</span>
      )}
    </article>
  );
}
