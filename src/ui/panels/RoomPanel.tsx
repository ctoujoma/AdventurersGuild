import { useState } from 'preact/hooks';
import { NURSE_WORK, roomMax } from '../../core/balance';
import { appeal, neighborsOf, seatsOf, visitorList, visitorsOf } from '../../core/salon';
import { canWork, roster, type Action } from '../../core/game';
import { beerCap, brewAt, cookAt, dailyYield, eatersOf, foodCap } from '../../core/larder';
import { ATTR_NAMES, gainText, skillGain, trainCap, trainState } from '../../core/training';
import { LOCK_TIME, MAX_GUARDS, TRAIN_CAP, VAULT_STORE } from '../../core/balance';
import { raidRoute, routeTime } from '../../core/assault';
import { defense } from '../../core/raids';
import { doorTime, goldCap, lockTime } from '../../core/vault';
import { dayPart } from '../../core/game';
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
import type { ComponentChildren } from 'preact';
import { help } from '../HoldHelp';
import { Icon, type IconName } from '../icons';
import { jobRoomName } from '../JobPicker';

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

const WORK = { to: 'trabajadores', label: 'Trabajo', icon: 'martillo' } as const;

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
  recibidor: [{ to: 'heroes', label: 'Guardia', icon: 'escudo' }],
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

/** El recibidor: la puerta y los de guardia. */
function DoorInfo({ game }: { game: GameState }) {
  const guards = game.heroes.filter((h) => h.status === 'ok' && h.guard).length;
  return (
    <div class="chips">
      <Fact info="Con gente de guardia, la primera pelea es en el patio y dan la voz de alarma en cuanto ven las antorchas. Sin nadie, los bandidos rompen la puerta y entran.">
        <Icon name="escudo" size={12} /> Guardia {guards}/{MAX_GUARDS}
      </Fact>
      <Fact info="Cuánto aguanta la puerta a los bandidos.">Puerta {doorTime(game)} s</Fact>
    </div>
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
    <>
      <div class="chips">
        <Fact
          info={`Arrastra aquí a un héroe que esté en casa para que entrene. Las habilidades suben solas según su clase.${next ? ` Mejorada, se llega hasta ${next} y se entrena más rápido.` : ''}`}
        >
          {ATTR_NAMES[attr]} hasta {cap}
        </Fact>
      </div>
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
            {!t && <span class="row-sub">fuera hoy</span>}
            {t && !t.capped && (
              <span class="row-sub">
                {daysLeft(t.frac, t.perDay)}.{' '}
                {gain
                  ? `Con ese punto: ${gain}.`
                  : 'Ese punto aún no se notará en las habilidades.'}
              </span>
            )}
          </span>
        );
      })}
    </>
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
    <section class="room-crew">
      <h3 class="sec-title">
        {train ? 'Entrenan' : 'Trabajan'} aquí{' '}
        <span class="row-sub">
          {here.length}/{slots}
        </span>
      </h3>
      {crewEffect(game, room) && <span class="row-sub">{crewEffect(game, room)}</span>}
      {here.map((p) => (
        <span key={p.id} class="crew-chip">
          <span>
            {p.name} <span class="row-sub">· {p.note}</span>
          </span>
          <button
            class="btn-icon"
            aria-label={`Quitar a ${p.name}`}
            {...help(`Quitar a ${p.name} de aquí`)}
            onClick={() => onAssign(p.id, null)}
          >
            <Icon name="papelera" size={14} />
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
    </section>
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
export function RoomPanel({ game, roomId, onUpgrade, onLink, onWork, onMove, onAssign }: Props) {
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return <p class="panel-note">Esa sala ya no está.</p>;
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
      {isTrainRoom(room.type) && room.level > 0 && <TrainInfo game={game} room={room} />}
      {room.type === 'tesoro' && <VaultInfo game={game} room={room} />}
      {room.type === 'recibidor' && <DoorInfo game={game} />}
      {(room.type === 'dormitorio' || room.type === 'veteranos') && room.level > 0 && (
        <div class="chips">
          <Fact info="Camas de esta sala.">
            <Icon name="cama" size={12} /> {roomBeds(room)} aquí
          </Fact>
          <Fact info="Héroes en el gremio y camas en total: quien está fuera o herido también ocupa cama.">
            <Icon name="heroe" size={12} /> {roster(game).length}/{beds(game.building)}
          </Fact>
        </div>
      )}
      {room.type === 'servicio' && room.level > 0 && (
        <div class="chips">
          <Fact info="Camas del servicio: una por cada trabajador de más de tres.">
            <Icon name="cama" size={12} /> {staffBeds(game.building)}
          </Fact>
          <Fact info="Trabajadores y cuántos puede haber.">
            <Icon name="martillo" size={12} /> {game.workers.length}/{workerCap(game)}
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
      {onAssign && <RoomCrew game={game} room={room} onAssign={onAssign} />}
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
