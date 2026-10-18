import { useState } from 'preact/hooks';
import { NURSE_WORK, roomMax } from '../../core/balance';
import { appeal, neighborsOf, seatsOf, visitorList, visitorsOf } from '../../core/salon';
import { canWork, type Action } from '../../core/game';
import { beerCap, brewAt, cookAt, dailyYield, eatersOf, foodCap } from '../../core/larder';
import { ATTR_NAMES, gainText, skillGain, trainCap, trainState } from '../../core/training';
import { TRAIN_CAP } from '../../core/balance';
import { dayPart } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import {
  planDemolish,
  planExtend,
  upgradeCostOf,
  worksOpen,
  type ExtendDir,
} from '../../core/rooms';
import { FACILITY_INFO } from '../../data/labels';
import { ROOMS, TRAINS, type RoomType } from '../../data/rooms';
import { plural } from '../../core/text';
import {
  canAssign,
  crewOf,
  hasPosts,
  isTrainRoom,
  slotsOf,
  staffBeds,
  workIn,
  workerCap,
  workerTitle,
} from '../../core/workers';
import { Icon } from '../icons';
import { jobRoomName } from '../JobPicker';

/** A dónde lleva cada sala: los paneles de siempre que tienen que ver con ella. */
export type RoomLink =
  'tablon' | 'candidatos' | 'casa' | 'heroes' | 'trabajadores' | 'libro' | 'equipo' | 'tesoros';

const WORK = { to: 'trabajadores', label: 'Trabajadores' } as const;

const LINKS: Partial<Record<RoomType, { to: RoomLink; label: string }[]>> = {
  salon: [
    { to: 'tablon', label: 'Tablón de encargos' },
    { to: 'candidatos', label: 'Candidatos' },
    { to: 'casa', label: 'Tu taberna' },
    WORK,
  ],
  cocina: [WORK],
  bodega: [WORK],
  enfermeria: [WORK],
  servicio: [WORK],
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
  /** Poner a alguien a trabajar en la sala o quitarlo. */
  onAssign?: (who: string, room: string | null) => void;
}

/** Lo que hace hoy la gente que trabaja en una sala. */
function crewEffect(game: GameState, room: Room): string {
  switch (room.type) {
    case 'salon': {
      const v = visitorsOf(game, game.day);
      return `Hoy se atiende a ${v.served} de ${v.total} visitantes.`;
    }
    case 'bodega':
      return `Saca ${Math.round(brewAt(game, room))} jarras al día.`;
    case 'cocina':
      return `Hace ${Math.round(cookAt(game, room))} raciones al día.`;
    case 'enfermeria':
      return workIn(game, 'enfermeria') >= NURSE_WORK
        ? 'Los heridos se curan un día antes.'
        : 'Con más mano, los heridos se curarían un día antes.';
    default:
      return '';
  }
}

/** El salón por dentro: su Atractivo, las plazas y quién viene hoy. */
function SalonInfo({ game }: { game: GameState }) {
  const v = visitorsOf(game, game.day);
  return (
    <span class="salon-info">
      <span>
        <b>Atractivo {appeal(game)}</b> · {seatsOf(game.building)} plazas
      </span>
      <span class="muted">
        Hoy {v.total ? `vienen ${visitorList(v)}` : 'no viene nadie'}.
        {v.served < v.total
          ? ` Solo se puede atender a ${v.served}: hace falta más gente en la barra.`
          : ''}
      </span>
      <span class="tiny">
        Más Atractivo (decoración, fachada, trofeos y el nivel del salón) trae más gente; la
        reputación también.
      </span>
    </span>
  );
}

/** Lo guardado y lo que se gasta: raciones en la cocina y la despensa, jarras en la bodega. */
function LarderInfo({ game, room }: { game: GameState; room: Room }) {
  const beer = room.type === 'bodega';
  const v = visitorsOf(game, game.day);
  const e = eatersOf(game);
  const home = e.heroes.length + e.workers.length;
  const made = dailyYield(game)[beer ? 'beer' : 'food'];
  const need = beer ? v.served : v.served + home;
  return (
    <span class="salon-info">
      <span>
        <b>
          {beer ? 'Jarras' : 'Raciones'} {beer ? game.beer : game.food}/
          {beer ? beerCap(game.building) : foodCap(game.building)}
        </b>{' '}
        · se hacen {made} al día
      </span>
      <span class="muted">
        {beer
          ? `Hoy beberán ${v.served} visitantes.`
          : `Hoy comen ${v.served} visitantes y cenan ${home} de casa.`}
        {made < need ? ' Se gasta más de lo que se hace.' : ''}
      </span>
      <span class="tiny">
        {beer
          ? 'Cada jarra deja una moneda. Lo que no cabe en la bodega se echa a perder.'
          : 'Sin raciones, los visitantes solo beben y los de casa se acuestan sin cenar. Lo que no cabe se echa a perder: la despensa guarda mucho más.'}
      </span>
    </span>
  );
}

/** «Le faltan unos 3 días» (o «Sube esta noche»). */
function daysLeft(frac: number, perDay: number): string {
  const d = Math.ceil((1 - frac) / perDay - 1e-9);
  return d <= 1 ? 'Sube esta noche' : `Le faltan unos ${d} días`;
}

/** Una sala de entrenamiento: qué se entrena, hasta dónde y cómo va cada uno. */
function TrainInfo({ game, room }: { game: GameState; room: Room }) {
  const attr = TRAINS[room.type]!;
  const cap = trainCap(room);
  const next = TRAIN_CAP[room.level + 1];
  const part = dayPart(game);
  const here = game.heroes.filter((h) => h.job === room.id);
  return (
    <span class="salon-info">
      <span>
        <b>
          {ATTR_NAMES[attr]} hasta {cap}
        </b>
      </span>
      {here.map((h) => {
        const t = trainState(game, h, part);
        const gain = gainText(skillGain(h, attr));
        return (
          <span key={h.id} class="train-row">
            <span>
              {h.name} · {ATTR_NAMES[attr]} {h.attrs[attr]}
              {t?.capped ? ' (en el tope)' : ''}
            </span>
            {t && !t.capped && (
              <span class="train-bar" aria-label={`${Math.round(t.frac * 100)} %`}>
                <i style={{ width: `${Math.round(t.frac * 100)}%` }} />
              </span>
            )}
            {!t && <span class="muted">fuera hoy</span>}
            {t && !t.capped && (
              <span class="tiny">
                {daysLeft(t.frac, t.perDay)}.{' '}
                {gain
                  ? `Con ese punto: ${gain}.`
                  : 'Ese punto aún no se notará en las habilidades.'}
              </span>
            )}
          </span>
        );
      })}
      <span class="tiny">
        Arrastra aquí a un héroe que esté en casa para que entrene. Las habilidades suben solas
        según su clase.
        {next ? ` Mejorada, se llega hasta ${next} y se entrena más rápido.` : ''}
      </span>
    </span>
  );
}

/** Quién trabaja en la sala, quitar a alguien y poner a otro (trabajador o héroe en casa). */
function RoomCrew({
  game,
  room,
  onAssign,
}: {
  game: GameState;
  room: Room;
  onAssign: (who: string, room: string | null) => void;
}) {
  const slots = slotsOf(room);
  if (!slots) return null;
  const train = isTrainRoom(room.type);
  const crew = crewOf(game, room.id);
  const here = [
    ...crew.workers.map((w) => ({ id: w.id, name: workerTitle(w), note: `Maña ${w.skill}` })),
    ...crew.heroes.map((h) => ({
      id: h.id,
      name: h.name,
      note: h.status === 'ok' && !h.guard ? (train ? 'entrena' : 'echa una mano') : 'fuera hoy',
    })),
  ];
  const free = [
    ...(train ? [] : game.workers)
      .filter((w) => w.room !== room.id)
      .map((w) => {
        const now = game.building.rooms.find((r) => r.id === w.room);
        return {
          id: w.id,
          name: `${workerTitle(w)}${now ? ` (en ${jobRoomName(game, now)})` : ''}`,
        };
      }),
    ...game.heroes
      .filter((h) => h.job !== room.id && !canAssign(game, h.id, room.id))
      .map((h) => ({ id: h.id, name: `${h.name} (héroe)` })),
  ];
  return (
    <div class="room-crew">
      <span>
        <b>
          {train ? 'Entrenan' : 'Trabajan'} aquí · {here.length}/{slots}
        </b>{' '}
        <span class="muted">{crewEffect(game, room)}</span>
      </span>
      {here.map((p) => (
        <span key={p.id} class="crew-chip">
          <span>
            {p.name} <span class="muted">· {p.note}</span>
          </span>
          <button
            class="btn btn-wood"
            aria-label={`Quitar a ${p.name}`}
            onClick={() => onAssign(p.id, null)}
          >
            Quitar
          </button>
        </span>
      ))}
      {here.length < slots && free.length > 0 && (
        <select
          class="job-select"
          value=""
          aria-label="Poner a trabajar aquí"
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            if (v) onAssign(v, room.id);
          }}
        >
          <option value="">{train ? 'Poner a entrenar aquí…' : 'Poner a trabajar aquí…'}</option>
          {free.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
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
export function RoomPanel({ game, roomId, onUpgrade, onLink, onWork, onMove, onAssign }: Props) {
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
        {room.type === 'salon' && room.level > 0 && <SalonInfo game={game} />}
        {(room.type === 'cocina' || room.type === 'despensa' || room.type === 'bodega') &&
          room.level > 0 && <LarderInfo game={game} room={room} />}
        {isTrainRoom(room.type) && room.level > 0 && <TrainInfo game={game} room={room} />}
        {neighborsOf(game.building, room).map((n) => (
          <span key={n.text} class={n.good ? 'next-level' : 'muted room-bad'}>
            {n.text}
          </span>
        ))}
        {room.type === 'servicio' && room.level > 0 && (
          <span class="muted">
            Camas del servicio: {staffBeds(game.building)} · trabajadores {game.workers.length}/
            {workerCap(game)}
          </span>
        )}
        {hasPosts(room.type) && room.level === 0 && (
          <span class="muted">
            Arreglada, tendrá {room.w * 2}{' '}
            {isTrainRoom(room.type) ? 'sitios para entrenar' : 'puestos de trabajo'}.
          </span>
        )}
        {onAssign && <RoomCrew game={game} room={room} onAssign={onAssign} />}
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
