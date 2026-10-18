import { useState } from 'preact/hooks';
import { roomMax } from '../../core/balance';
import { canWork, type Action } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import {
  planDemolish,
  planExtend,
  upgradeCostOf,
  worksOpen,
  type ExtendDir,
} from '../../core/rooms';
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
  /** Obras de verdad (ampliar, destruir) y elegir en la escena a dónde mover la sala. */
  onWork?: (a: Action) => void;
  onMove?: (id: string) => void;
}

const DIRS: { dir: ExtendDir; label: string }[] = [
  { dir: 'left', label: 'Ampliar a la izquierda' },
  { dir: 'right', label: 'Ampliar a la derecha' },
  { dir: 'up', label: 'Subir una planta' },
];

/** Ampliar, mover y destruir: lo que se puede hacer con la sala una vez pagada la deuda. */
function RoomWorks({
  game,
  room,
  onWork,
  onMove,
}: {
  game: GameState;
  room: Room;
  onWork: (a: Action) => void;
  onMove?: (id: string) => void;
}) {
  const [sure, setSure] = useState(false);
  const def = ROOMS[room.type];
  if (!worksOpen(game))
    return <span class="muted">Ampliar, mover o tirar salas: al pagar la deuda.</span>;
  if (room.works) return null;
  const grow = DIRS.filter(
    ({ dir }) => (dir === 'up' ? room.h < def.maxH : room.w < def.maxW) && room.level > 0,
  ).map((d) => ({ ...d, plan: planExtend(game, room.id, d.dir) }));
  const open = grow.filter((g) => !('error' in g.plan));
  // Si falta oro se dice; si no, es que al lado no hay hueco.
  const growWhy =
    grow
      .map((g) => ('error' in g.plan ? g.plan.error : ''))
      .find((e) => e.startsWith('Te faltan')) ?? 'no hay hueco libre al lado.';
  const demolish = planDemolish(game, room.id);
  const refund = 'error' in demolish ? 0 : -demolish.cost;
  return (
    <div class="room-works">
      {open.map((g) => (
        <button
          key={g.dir}
          class="btn btn-wood"
          onClick={() => onWork({ type: 'extend', id: room.id, dir: g.dir })}
        >
          {g.label} <Icon name="coin" size={10} /> {'cost' in g.plan ? g.plan.cost : ''}
        </button>
      ))}
      {grow.length > 0 && !open.length && <span class="muted">Ampliar: {growWhy}</span>}
      {!def.fixed && onMove && (
        <button class="btn btn-wood" onClick={() => onMove(room.id)}>
          Mover
        </button>
      )}
      {!def.keep &&
        (sure ? (
          <span class="room-sure">
            <span>
              {refund > 0
                ? `¿Tirarla? Recuperas ${refund} monedas.`
                : '¿Tirarla? No recuperas nada.'}
            </span>
            <button class="btn btn-red" onClick={() => onWork({ type: 'demolish', id: room.id })}>
              Tirar
            </button>
            <button class="btn btn-wood" onClick={() => setSure(false)}>
              No
            </button>
          </span>
        ) : (
          <button class="btn btn-wood" onClick={() => setSure(true)}>
            Tirar
          </button>
        ))}
    </div>
  );
}

/** Ficha de una sala: para qué sirve, su nivel, arreglarla o mejorarla y sus obras. */
export function RoomPanel({ game, roomId, onUpgrade, onLink, onWork, onMove }: Props) {
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
        {onWork && <RoomWorks game={game} room={room} onWork={onWork} onMove={onMove} />}
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
