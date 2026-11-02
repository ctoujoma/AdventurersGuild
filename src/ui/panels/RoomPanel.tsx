import { useState } from 'preact/hooks';
import { roomMax } from '../../core/balance';
import { appeal, neighborsOf, seatsOf, visitorList, visitorsOf } from '../../core/salon';
import { canWork, customOf, roster, type Action } from '../../core/game';
import { TINTS, TINT_FROM, TINT_IDS, type TintId } from '../../data/custom';
import { unlockSource } from '../../core/goals';
import type { UnlockId } from '../../data/unlocks';
import { beerCap, dailyYield, eatersOf, foodCap } from '../../core/larder';
import { ATTR_NAMES, trainCap } from '../../core/training';
import { LOCK_TIME, TRAIN_CAP, VAULT_STORE } from '../../core/balance';
import { raidRoute, routeTime } from '../../core/assault';
import { defense } from '../../core/raids';
import { doorTime, goldCap, lockTime } from '../../core/vault';
import type { GameState, Room } from '../../core/model';
import {
  beds,
  planDemolish,
  planExtend,
  roomBeds,
  upgradeCostOf,
  worksOpen,
  type ExtendDir,
} from '../../core/rooms';
import { FACILITY_INFO } from '../../data/labels';
import { ROOMS, TRAINS, type RoomType } from '../../data/rooms';
import { listNames, plural } from '../../core/text';
import { hasPosts, isTrainRoom, staffBeds, workerCap } from '../../core/workers';
import type { ComponentChildren } from 'preact';
import { help } from '../HoldHelp';
import { Icon, type IconName } from '../icons';
import { CrewGroup } from './CrewList';
import { WorkshopInfo } from './WorkshopInfo';
import { isWorkshop } from '../../core/crafting';
import { crewGroups } from '../crew';
import { GUARD, type Task } from '../drop';
import { left as timeLeft } from '../when';

/** A dónde lleva cada sala: los paneles de siempre que tienen que ver con ella. */
export type RoomLink =
  | 'tablon'
  | 'candidatos'
  | 'casa'
  | 'heroes'
  | 'trabajadores'
  | 'libro'
  | 'fuera'
  | 'equipo'
  | 'tesoros';

const WORK = { to: 'trabajadores', label: 'Tareas', icon: 'martillo' } as const;

const LINKS: Partial<Record<RoomType, { to: RoomLink; label: string; icon: IconName }[]>> = {
  salon: [
    { to: 'tablon', label: 'Tablón', icon: 'tablon' },
    { to: 'candidatos', label: 'Barra', icon: 'jarra' },
    { to: 'casa', label: 'Adornos', icon: 'banderin' },
    WORK,
  ],
  cocina: [WORK],
  bodega: [WORK],
  enfermeria: [WORK],
  servicio: [WORK],
  dormitorio: [{ to: 'heroes', label: 'Héroes', icon: 'heroe' }],
  veteranos: [{ to: 'heroes', label: 'Héroes', icon: 'heroe' }],
  mapas: [
    { to: 'fuera', label: 'Mapa', icon: 'mapa' },
    { to: 'libro', label: 'Libro', icon: 'libro' },
  ],
  armeria: [{ to: 'equipo', label: 'Equipo', icon: 'espadas' }],
  forja: [{ to: 'equipo', label: 'Equipo', icon: 'espadas' }],
  tesoro: [{ to: 'tesoros', label: 'Tesoros', icon: 'coin' }],
};

/** Una cifra de la sala en una chapa; lo que significa, manteniendo pulsado. */
function Fact({
  children,
  info,
  warn,
}: {
  children: ComponentChildren;
  info?: string;
  warn?: boolean;
}) {
  return (
    <span class={`fact ${warn ? 'fact-alert' : ''}`} {...(info ? help(info) : {})}>
      {children}
    </span>
  );
}

interface Props {
  game: GameState;
  roomId: string;
  onUpgrade: (id: string) => void;
  onLink: (to: RoomLink) => void;
  /** Obras de verdad (ampliar, destruir) y elegir en la escena a dónde mover la sala. */
  onWork?: (a: Action) => void;
  onMove?: (id: string) => void;
  /** Cambiar la tarea de alguien (ponerlo en un hueco de la sala o sacarlo). */
  onTask?: (who: string, task: Task) => void;
  /** Abrir la ficha de un héroe. */
  onOpen?: (id: string) => void;
  /** Elegir el tema de color de sus telas (`null`: los de la casa). */
  onTint?: (room: string, tint: TintId | null) => void;
  /** Si se tiene una pieza (los temas de color que faltan salen con candado). */
  has?: (id: UnlockId) => boolean;
  /** Lo que se hace en la sala (crear y desmontar en los talleres). Sin él, solo se mira. */
  onAct?: (a: Action) => void;
}

/** Los colores de las telas de la sala: los de la casa o uno de los temas. */
function RoomTint({
  game,
  room,
  onTint,
  has,
}: {
  game: GameState;
  room: Room;
  onTint: (room: string, tint: TintId | null) => void;
  has: (id: UnlockId) => boolean;
}) {
  const cur = customOf(game).colors?.[room.id] ?? null;
  const [locked, setLocked] = useState<string | null>(null);
  const swatch = (id: TintId | null, label: string, bg?: string) => {
    const why = id && cur !== id && !has(`tint:${id}`) ? unlockSource(`tint:${id}`) : null;
    const text = why ? `${label}. Se gana con: ${why}` : label;
    return (
      <button
        key={id ?? 'casa'}
        role="radio"
        aria-checked={cur === id}
        aria-disabled={!!why}
        aria-label={text}
        title={text}
        class={`tav-swatch room-swatch ${id ? '' : 'house'} ${cur === id ? 'on' : ''} ${why ? 'locked' : ''}`}
        style={bg ? { background: bg } : undefined}
        onClick={() => {
          if (why) return setLocked(`${label}: se gana con ${why}.`);
          setLocked(null);
          onTint(room.id, id);
        }}
      />
    );
  };
  return (
    <div class="room-tint">
      <span class="row-sub">Colores de las telas</span>
      <div class="tav-swatches" role="radiogroup" aria-label="Colores de las telas">
        {swatch(null, 'De la casa')}
        {TINT_IDS.map((id) => {
          const [, d, m, l] = TINTS[id].ramp;
          return swatch(id, TINTS[id].name, `linear-gradient(${l} 0 30%, ${m} 30% 70%, ${d} 70%)`);
        })}
      </div>
      {locked && <small class="lock-why">{locked}</small>}
    </div>
  );
}

/** El salón por dentro: su Atractivo, las plazas y quién viene hoy. */
function SalonInfo({ game }: { game: GameState }) {
  const v = visitorsOf(game, game.day);
  return (
    <>
      <div class="chips">
        <Fact info="Más Atractivo (decoración, fachada, trofeos y el nivel del salón) trae más gente; la reputación también.">
          <Icon name="star" size={12} /> Atractivo {appeal(game)}
        </Fact>
        <Fact info="Sitios para sentarse en el salón.">{seatsOf(game.building)} plazas</Fact>
        <Fact info="Visitantes de hoy y cuántos se pueden atender." warn={v.served < v.total}>
          <Icon name="heroes" size={12} /> {v.served}/{v.total}
        </Fact>
      </div>
      <span class="row-sub">
        Hoy {v.total ? `vienen ${visitorList(v)}` : 'no viene nadie'}.
        {v.served < v.total ? ` Solo se atiende a ${v.served}: falta gente en la barra.` : ''}
      </span>
    </>
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
    <>
      <div class="chips">
        <Fact
          info={
            beer
              ? 'Jarras guardadas y cuántas caben. Cada jarra deja una moneda; lo que no cabe se echa a perder.'
              : 'Raciones guardadas y cuántas caben. Sin raciones, los visitantes solo beben y los de casa se acuestan sin cenar. Lo que no cabe se echa a perder: la despensa guarda mucho más.'
          }
        >
          <Icon name={beer ? 'jarra' : 'pan'} size={12} /> {beer ? game.beer : game.food}/
          {beer ? beerCap(game.building) : foodCap(game.building)}
        </Fact>
        <Fact info="Lo que se hace al día." warn={made < need}>
          +{made} al día
        </Fact>
      </div>
      <span class="row-sub">
        {beer
          ? `Hoy beberán ${v.served} visitantes.`
          : `Hoy comen ${v.served} visitantes y cenan ${home} de casa.`}
        {made < need ? ' Se gasta más de lo que se hace.' : ''}
      </span>
    </>
  );
}

/** La cámara del tesoro: cuánto oro cabe, cuánto aguanta la cerradura y por dónde vendrían. */
function VaultInfo({ game, room }: { game: GameState; room: Room }) {
  const cap = goldCap(game);
  const better = room.level < VAULT_STORE.length - 1;
  const route = raidRoute(game.building).slice(1, -1);
  const names = route.map((id) => {
    const r = game.building.rooms.find((x) => x.id === id);
    return r ? ROOMS[r.type].name.toLowerCase() : '';
  });
  const odds = Math.round(defense(game) * 10);
  return (
    <>
      <div class="chips">
        <Fact info="Oro guardado y cuánto cabe. Lo que no cabe se pierde." warn={game.gold >= cap}>
          <Icon name="coin" size={12} /> {game.gold}/{cap}
        </Fact>
        <Fact info="Cuánto aguanta la cerradura a los bandidos.">Cerradura {lockTime(game)} s</Fact>
        <Fact
          info={`Lo que tardarían los bandidos en llegar desde la puerta${names.length ? `, pasando por ${listNames(names)}` : ''}: el camino rojo de la escena. Cuanto más lejos de la puerta y mejor cerrada, más tiempo para que los nuestros se despierten y les corten el paso.`}
        >
          Camino {routeTime(game.building)} s
        </Fact>
        <Fact
          info={`Si asaltaran esta noche, se ${odds === 1 ? 'pararía' : 'pararían'} ${odds} de cada 10 asaltos como el que podría venir.`}
        >
          <Icon name="escudo" size={12} /> {odds}/10
        </Fact>
      </div>
      {better && (
        <span class="next-level">
          Mejorada: cabrían {VAULT_STORE[room.level + 1] * room.w * room.h} y la cerradura
          aguantaría {LOCK_TIME[room.level + 1]} s.
        </span>
      )}
    </>
  );
}

/** El recibidor: cuánto aguanta la puerta (los de guardia, en sus huecos). */
function DoorInfo({ game }: { game: GameState }) {
  return (
    <div class="chips">
      <Fact info="Cuánto aguanta la puerta a los bandidos.">Puerta {doorTime(game)} s</Fact>
    </div>
  );
}

/** Una sala de entrenamiento: qué se entrena y hasta dónde (cómo va cada uno, en sus huecos). */
function TrainInfo({ room }: { room: Room }) {
  const attr = TRAINS[room.type]!;
  const next = TRAIN_CAP[room.level + 1];
  return (
    <div class="chips">
      <Fact
        info={`Pon aquí a un héroe que esté en casa para que entrene. Las habilidades suben solas según su clase.${next ? ` Mejorada, se llega hasta ${next} y se entrena más rápido.` : ''}`}
      >
        {ATTR_NAMES[attr]} hasta {trainCap(room)}
      </Fact>
    </div>
  );
}

/**
 * Los puestos de la sala como huecos (los mismos de Héroes › Tareas): quién está, lo que pone y
 * los libres para poner a alguien. En el recibidor, los dos de guardia.
 */
function RoomCrew({
  game,
  room,
  onTask,
  onOpen,
}: {
  game: GameState;
  room: Room;
  onTask: (who: string, task: Task) => void;
  onOpen: (id: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const key = room.type === 'recibidor' ? GUARD : room.id;
  const g = crewGroups(game).find((x) => x.key === key);
  if (!g) return null;
  const title =
    key === GUARD ? 'De guardia' : isTrainRoom(room.type) ? 'Entrenan aquí' : 'Trabajan aquí';
  return (
    <CrewGroup
      game={game}
      g={g}
      title={title}
      sel={sel}
      setSel={setSel}
      onOpen={onOpen}
      onTask={onTask}
    />
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
      {!def.fixed &&
        (sure ? (
          <span class="room-sure">
            <span>
              {def.keep
                ? '¿Quitarla del plano? Antes de pagar tendrás que ponerla en otro sitio.'
                : refund > 0
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
export function RoomPanel({
  game,
  roomId,
  onUpgrade,
  onLink,
  onWork,
  onMove,
  onTask,
  onOpen,
  onTint,
  has,
  onAct,
}: Props) {
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return <p class="panel-note">Esa sala ya no está.</p>;
  const def = ROOMS[room.type];
  const info = def.fac ? FACILITY_INFO[def.fac] : null;
  const max = roomMax(room.type);
  const cost = upgradeCostOf(room);
  const why = canWork(game, { type: 'upgradeRoom', id: room.id });
  const size = room.w * room.h;
  const state = room.works
    ? `En obras: estará ${room.works.kind === 'move' ? 'en su sitio' : 'lista'} en ${timeLeft(room.works.nights, game.clock ?? 0, 'noche', 'noches')}.`
    : room.level === 0
      ? room.type === 'torre'
        ? 'Solar vacío: hay que levantarla.'
        : 'Rota: hay que arreglarla para que sirva.'
      : null;
  const links = LINKS[room.type] ?? [];
  return (
    <>
      <div class="room-head" {...(info ? help(info.levels[room.level]) : {})}>
        <span class="pips" aria-label={`Nivel ${room.level} de ${max}`}>
          {Array.from({ length: max }, (_, i) => (
            <i key={i} class={i < room.level ? 'on' : ''} />
          ))}
        </span>
        <span class="row-sub">
          {room.level ? `Nivel ${room.level} de ${max}` : 'Sin arreglar'}
          {size > 1 ? ` · ${size} ${plural(size, 'hueco', 'huecos')}` : ''}
        </span>
      </div>
      {state && <p class="room-state">{state}</p>}
      <p class="room-desc">{def.desc}</p>
      {info && room.level > 0 && <span class="row-sub">{info.effect(room.level)}</span>}
      {info && cost !== null && (
        <span class="next-level">Mejora: {info.effect(room.level + 1)}</span>
      )}
      {room.type === 'salon' && room.level > 0 && <SalonInfo game={game} />}
      {(room.type === 'cocina' || room.type === 'despensa' || room.type === 'bodega') &&
        room.level > 0 && <LarderInfo game={game} room={room} />}
      {isTrainRoom(room.type) && room.level > 0 && <TrainInfo room={room} />}
      {room.type === 'tesoro' && <VaultInfo game={game} room={room} />}
      {room.type === 'recibidor' && <DoorInfo game={game} />}
      {(room.type === 'dormitorio' || room.type === 'veteranos') && room.level > 0 && (
        <div class="chips">
          <Fact info="Camas de esta sala.">
            <Icon name="cama" size={12} /> {roomBeds(room)}{' '}
            {plural(roomBeds(room), 'cama', 'camas')} aquí
          </Fact>
          <Fact info="Héroes en el gremio y camas en total: quien está fuera o herido también ocupa cama.">
            <Icon name="heroe" size={12} /> {roster(game).length} de {beds(game.building)} héroes
          </Fact>
        </div>
      )}
      {room.type === 'servicio' && room.level > 0 && (
        <div class="chips">
          <Fact info="Camas del servicio: una por cada trabajador de más de tres.">
            <Icon name="cama" size={12} /> {staffBeds(game.building)}{' '}
            {plural(staffBeds(game.building), 'cama', 'camas')}
          </Fact>
          <Fact info="Trabajadores y cuántos puede haber.">
            <Icon name="martillo" size={12} /> {game.workers.length} de {workerCap(game)}{' '}
            trabajadores
          </Fact>
        </div>
      )}
      {hasPosts(room.type) && room.level === 0 && (
        <span class="row-sub">
          Arreglada, tendrá {room.w * 2}{' '}
          {isTrainRoom(room.type) ? 'sitios para entrenar' : 'puestos de trabajo'}.
        </span>
      )}
      {neighborsOf(game.building, room).map((n) => (
        <span key={n.text} class={n.good ? 'next-level' : 'row-sub room-bad'}>
          {n.text}
        </span>
      ))}
      {onTask && onOpen && (hasPosts(room.type) || room.type === 'recibidor') && (
        <RoomCrew game={game} room={room} onTask={onTask} onOpen={onOpen} />
      )}
      {isWorkshop(room.type) && room.level > 0 && !room.works && (
        <WorkshopInfo game={game} room={room} onAct={onAct} />
      )}
      {onTint && !room.works && room.level >= (TINT_FROM[room.type] ?? Infinity) && (
        <RoomTint game={game} room={room} onTint={onTint} has={has ?? (() => true)} />
      )}
      {onWork && <RoomWorks game={game} room={room} onWork={onWork} onMove={onMove} />}
      {links.length > 0 && (
        <div class="room-links">
          {links.map((l) => (
            <button key={l.to} class="btn btn-wood" onClick={() => onLink(l.to)}>
              <Icon name={l.icon} size={14} /> {l.label}
            </button>
          ))}
        </div>
      )}
      {cost !== null ? (
        <button
          class="btn btn-gold room-act"
          data-tut={`mejorar-${room.type}`}
          aria-label={`${room.level === 0 ? 'Arreglar' : 'Mejorar'} ${def.name} por ${cost} monedas`}
          disabled={!!why}
          title={why ?? undefined}
          onClick={() => onUpgrade(room.id)}
        >
          <Icon name="mejorar" size={16} /> {room.level === 0 ? 'Arreglar' : 'Mejorar'} ·{' '}
          <Icon name="coin" size={12} /> {cost}
        </button>
      ) : (
        <span class="pill pill-ok room-max">Al máximo</span>
      )}
      {why && cost !== null && <p class="qs-warn">{why}</p>}
    </>
  );
}
