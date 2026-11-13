import { MatShelf } from '../mats';
import { useState } from 'preact/hooks';
import { roomMax } from '../../core/balance';
import { appeal, neighborsOf, seatsOf, visitorList, visitorsOf } from '../../core/salon';
import { canWork, roster, type Action } from '../../core/game';
import type { DecorId, TintId } from '../../data/custom';
import { beerCap, dailyYield, eatersOf, foodCap } from '../../core/larder';
import { ATTR_NAMES, trainCap } from '../../core/training';
import { TRAIN_HERO_BASE, TRAIN_MAIN_BONUS, TRAIN_PER_LEVEL } from '../../core/balance';
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
import { roomEffect } from '../../data/roomInfo';
import { ROOMS, TRAINS, type RoomType } from '../../data/rooms';
import { listNames, plural } from '../../core/text';
import { hasPosts, isTrainRoom, staffBeds, workerCap } from '../../core/workers';
import type { ComponentChildren } from 'preact';
import { help } from '../HoldHelp';
import { Icon, type IconName } from '../icons';
import { CrewGroup } from './CrewList';
import { WorkshopInfo } from './WorkshopInfo';
import { DormList } from './DormList';
import { isWorkshop } from '../../core/crafting';
import { crewGroups } from '../crew';
import { GUARD, type Task } from '../drop';
import { dawnIn } from '../when';
import { RoomCustom, canCustomize, feastPending } from './RoomCustom';

/** A dónde lleva cada sala: los paneles de siempre que tienen que ver con ella. */
export type RoomLink =
  'tablon' | 'candidatos' | 'heroes' | 'trabajadores' | 'libro' | 'fuera' | 'equipo' | 'tesoros';

const WORK = { to: 'trabajadores', label: 'Tareas', icon: 'martillo' } as const;

const LINKS: Partial<Record<RoomType, { to: RoomLink; label: string; icon: IconName }[]>> = {
  salon: [
    { to: 'tablon', label: 'Tablón', icon: 'tablon' },
    { to: 'candidatos', label: 'Barra', icon: 'jarra' },
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
  /** Modo prueba: cambiar el color de sus telas gratis y al momento (`null`: los de la casa). */
  onTint?: (room: string, tint: TintId | null) => void;
  /** Lo que se hace en la sala (crear y desmontar en los talleres). Sin él, solo se mira. */
  onAct?: (a: Action) => void;
  /** Enseñar en la escena cómo quedaría la sala con un color, unos segundos. */
  onPreview?: (room: string, tint: TintId | null) => void;
  /** Poner o quitar un adorno del salón (en «Personalizar»). */
  onDecor?: (id: DecorId, on: boolean) => void;
  /** Montar la fiesta de la comarca (en «Personalizar» del salón). */
  onFeast?: () => void;
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
function VaultInfo({ game }: { game: GameState }) {
  const cap = goldCap(game);
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
  return (
    <div class="chips">
      <Fact
        info={`Pon aquí a un héroe que esté en casa para que entrene. Las habilidades suben solas según su clase. Cada héroe llega como mucho a ${TRAIN_HERO_BASE} más ${TRAIN_PER_LEVEL} por nivel (${TRAIN_MAIN_BONUS} más en el atributo principal de su clase).`}
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

/** Ficha de una sala: arriba su nivel y el botón de arreglarla o mejorarla; luego para qué sirve y sus obras. */
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
  onAct,
  onPreview,
  onDecor,
  onFeast,
}: Props) {
  const [custom, setCustom] = useState(false);
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return <p class="panel-note">Esa sala ya no está.</p>;
  const def = ROOMS[room.type];
  const info = def.fac ? FACILITY_INFO[def.fac] : null;
  const max = roomMax(room.type);
  const cost = upgradeCostOf(room);
  const why = canWork(game, { type: 'upgradeRoom', id: room.id });
  const size = room.w * room.h;
  const state = room.works
    ? `En obras: estará ${room.works.kind === 'move' ? 'en su sitio' : 'lista'} ${dawnIn(room.works.nights)}.`
    : room.level === 0
      ? room.type === 'torre'
        ? 'Solar vacío: hay que levantarla.'
        : 'Rota: hay que arreglarla para que sirva.'
      : null;
  const links = LINKS[room.type] ?? [];
  const cells = room.w * room.h;
  const look = { onAct, onTint, onPreview, onDecor, onFeast };
  const customizable = canCustomize(room, look);
  const feast = customizable && feastPending(game, room);
  return (
    <>
      <div class="room-top">
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
        {cost !== null ? (
          <button
            class="btn btn-gold room-up"
            data-tut={`mejorar-${room.type}`}
            aria-label={`${room.level === 0 ? 'Arreglar' : 'Mejorar'} ${def.name} por ${cost} monedas`}
            disabled={!!why}
            title={why ?? undefined}
            onClick={() => onUpgrade(room.id)}
          >
            <Icon name="mejorar" size={14} /> {room.level === 0 ? 'Arreglar' : 'Mejorar'} ·{' '}
            <Icon name="coin" size={10} /> {cost}
          </button>
        ) : (
          <span class="pill pill-ok room-max">Al máximo</span>
        )}
      </div>
      <div class="room-levels">
        {room.level > 0 && (
          <p class="room-now">
            <b>Ahora:</b> {roomEffect(room.type, room.level, cells)}.
          </p>
        )}
        {cost !== null && (
          <p class="next-level">
            <b>{room.level > 0 ? 'Mejora' : room.type === 'torre' ? 'Levantada' : 'Arreglada'}:</b>{' '}
            {roomEffect(room.type, room.level + 1, cells)}.
          </p>
        )}
      </div>
      {why && cost !== null && <p class="qs-warn">{why}</p>}
      {state && <p class="room-state">{state}</p>}
      <p class="room-desc">{def.desc}</p>
      {room.type === 'almacen' && room.level > 0 && <MatShelf game={game} />}
      {room.type === 'salon' && room.level > 0 && <SalonInfo game={game} />}
      {(room.type === 'cocina' || room.type === 'despensa' || room.type === 'bodega') &&
        room.level > 0 && <LarderInfo game={game} room={room} />}
      {isTrainRoom(room.type) && room.level > 0 && <TrainInfo room={room} />}
      {room.type === 'tesoro' && <VaultInfo game={game} />}
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
      {onAct &&
        (room.type === 'dormitorio' || room.type === 'veteranos' || room.type === 'servicio') &&
        room.level > 0 &&
        (!room.works || room.works.kind === 'extend') && (
          <DormList game={game} room={room} onAct={onAct} onOpen={onOpen} />
        )}
      {onTask && onOpen && (hasPosts(room.type) || room.type === 'recibidor') && (
        <RoomCrew game={game} room={room} onTask={onTask} onOpen={onOpen} />
      )}
      {isWorkshop(room.type) && room.level > 0 && !room.works && (
        <WorkshopInfo key={room.id} game={game} room={room} onAct={onAct} />
      )}
      {onWork && <RoomWorks game={game} room={room} onWork={onWork} onMove={onMove} />}
      {(links.length > 0 || customizable) && (
        <div class="room-links">
          {customizable && (
            <button
              class={`btn ${feast ? 'btn-gold' : 'btn-wood'}`}
              aria-haspopup="dialog"
              onClick={() => setCustom(true)}
            >
              <Icon name="brocha" size={14} /> Personalizar
              {feast && <span class="room-custom-dot" aria-label="Hoy es la fiesta" />}
            </button>
          )}
          {links.map((l) => (
            <button key={l.to} class="btn btn-wood" onClick={() => onLink(l.to)}>
              <Icon name={l.icon} size={14} /> {l.label}
            </button>
          ))}
        </div>
      )}
      {custom && customizable && (
        <RoomCustom game={game} room={room} onClose={() => setCustom(false)} {...look} />
      )}
    </>
  );
}
