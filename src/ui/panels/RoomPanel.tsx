import { MatShelf } from '../mats';
import { useState } from 'preact/hooks';
import { roomMax } from '../../core/balance';
import { appeal, neighborsOf, seatsOf, visitorList, visitorsOf } from '../../core/salon';
import { canWork, roster, type Action } from '../../core/game';
import type { DecorId, TintId } from '../../data/custom';
import { beerCap, dailyYield, eatersOf, foodCap } from '../../core/larder';
import { potionIcon } from '../../art/items';
import { BufferImage } from '../BufferImage';
import { ATTR_NAMES, trainCap } from '../../core/training';
import {
  NURSE_WORK,
  TRAIN_HERO_BASE,
  TRAIN_MAIN_BONUS,
  TRAIN_PER_LEVEL,
  healRate,
} from '../../core/balance';
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
import { listNames } from '../../core/text';
import {
  hasPosts,
  isTrainRoom,
  nurseBonus,
  staffBeds,
  workIn,
  workerCap,
} from '../../core/workers';
import { handText } from '../crew';
import type { ComponentChildren } from 'preact';
import { help } from '../HoldHelp';
import { Icon, type IconName } from '../icons';
import { CrewGroup, Face } from './CrewList';
import { WorkshopInfo, workshopTabs, type WorkTab } from './WorkshopInfo';
import { DormList } from './DormList';
import { isWorkshop, potionCap } from '../../core/crafting';
import { crewGroups } from '../crew';
import { GUARD, type Task } from '../drop';
import { dawnIn } from '../when';
import { RoomCustom, canCustomize, feastPending } from './RoomCustom';
import { Tabs, type TabItem } from '../Tabs';
import { t } from '../../textos';
import { NO_GOLD } from '../works';

/** A dónde lleva cada sala: los paneles de siempre que tienen que ver con ella. */
export type RoomLink =
  'tablon' | 'candidatos' | 'heroes' | 'trabajadores' | 'libro' | 'fuera' | 'equipo' | 'tesoros';

const WORK = { to: 'trabajadores', label: t('paneles.room.tareas'), icon: 'martillo' } as const;

const LINKS: Partial<Record<RoomType, { to: RoomLink; label: string; icon: IconName }[]>> = {
  salon: [
    { to: 'tablon', label: t('paneles.room.tablon'), icon: 'tablon' },
    { to: 'candidatos', label: t('paneles.room.barra'), icon: 'jarra' },
    WORK,
  ],
  cocina: [WORK],
  bodega: [WORK],
  enfermeria: [WORK],
  servicio: [WORK],
  dormitorio: [{ to: 'heroes', label: t('paneles.room.heroes'), icon: 'heroe' }],
  veteranos: [{ to: 'heroes', label: t('paneles.room.heroes'), icon: 'heroe' }],
  mapas: [
    { to: 'fuera', label: t('paneles.room.mapa'), icon: 'mapa' },
    { to: 'libro', label: t('paneles.room.libro'), icon: 'libro' },
  ],
  armeria: [{ to: 'equipo', label: t('paneles.room.equipo'), icon: 'espadas' }],
  forja: [{ to: 'equipo', label: t('paneles.room.equipo'), icon: 'espadas' }],
  tesoro: [{ to: 'tesoros', label: t('paneles.room.tesoros'), icon: 'coin' }],
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
        <Fact info={t('paneles.room.mas_atractivo_decoracion_fachada')}>
          <Icon name="star" size={12} /> {t('paneles.room.atractivo', { appeal: appeal(game) })}
        </Fact>
        <Fact info={t('paneles.room.sitios_para_sentarse_en')}>
          {t('paneles.room.plazas', { seats_of: seatsOf(game.building) })}
        </Fact>
        <Fact info={t('paneles.room.visitantes_de_hoy_y')} warn={v.served < v.total}>
          <Icon name="heroes" size={12} /> {v.served}/{v.total}
        </Fact>
      </div>
      <span class="row-sub">
        {t('paneles.room.hoy_vienen', {
          n: v.total,
          quienes: visitorList(v),
          faltan: v.served < v.total,
          atendidos: v.served,
        })}
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
              ? t('paneles.room.jarras_guardadas_y_cuantas')
              : t('paneles.room.raciones_guardadas_y_cuantas')
          }
        >
          <Icon name={beer ? 'jarra' : 'pan'} size={12} /> {beer ? game.beer : game.food}/
          {beer ? beerCap(game.building) : foodCap(game.building)}
        </Fact>
        <Fact info={t('paneles.room.lo_que_se_hace')} warn={made < need}>
          {t('paneles.room.al_dia', { made })}
        </Fact>
        {/* Junto a las raciones, las pociones de la alquimia (las dos se llevan de expedición). */}
        {!beer && (potionCap(game) > 0 || (game.potions ?? 0) > 0) && (
          <Fact info={t('talleres.pocion.ayuda')}>
            <BufferImage buf={potionIcon()} scale={1} /> {game.potions ?? 0}/{potionCap(game)}
          </Fact>
        )}
      </div>
      <span class="row-sub">
        {beer
          ? t('paneles.room.hoy_beberan_visitantes', { served: v.served })
          : t('paneles.room.hoy_comen_visitantes_y', { served: v.served, home })}
        {made < need && <> {t('paneles.room.se_gasta_mas_de')}</>}
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
        <Fact info={t('paneles.room.oro_guardado_y_cuanto')} warn={game.gold >= cap}>
          <Icon name="coin" size={12} /> {game.gold}/{cap}
        </Fact>
        <Fact info={t('paneles.room.cuanto_aguanta_la_cerradura')}>
          {t('paneles.room.cerradura_s', { lock_time: lockTime(game) })}
        </Fact>
        <Fact
          info={t('paneles.room.lo_que_tardarian_los', {
            hay: names.length > 0,
            salas: listNames(names),
          })}
        >
          {t('paneles.room.camino_s', { route_time: routeTime(game.building) })}
        </Fact>
        <Fact
          info={t('paneles.room.si_asaltaran_esta_noche', {
            odds,
          })}
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
      <Fact info={t('paneles.room.cuanto_aguanta_la_puerta')}>
        {t('paneles.room.puerta_s', { door_time: doorTime(game) })}
      </Fact>
    </div>
  );
}

/**
 * La enfermería: cuánto cura cada noche (el nivel y, con mano suficiente, un día más: las
 * cuentas de `endDay`), la mano que hay hoy y los heridos.
 */
function InfirmaryInfo({ game, onOpen }: { game: GameState; onOpen?: (id: string) => void }) {
  const base = healRate(game.fac.enf);
  const bonus = nurseBonus(game);
  const hand = workIn(game, 'enfermeria');
  const patients = game.heroes.filter((h) => h.status === 'herido').sort((a, b) => a.days - b.days);
  const hurt = patients.length;
  const rate = base + bonus;
  return (
    <>
      <div class="chips">
        <Fact
          info={t('paneles.room.dias_de_cama_que', {
            base,
            mano: bonus > 0,
          })}
        >
          <Icon name="cama" size={12} /> {t('paneles.room.dias_por_noche', { n: base + bonus })}
        </Fact>
        <Fact
          info={t('paneles.room.con_de_mano_entre', { nurse_work: NURSE_WORK })}
          warn={!bonus && hurt > 0}
        >
          <Icon name="martillo" size={12} />{' '}
          {t('paneles.room.mano_de', {
            hand_text: handText(hand),
            nurse_work: NURSE_WORK,
            mano: bonus > 0,
          })}
        </Fact>
        <Fact info={t('paneles.room.heroes_heridos_ahora_mismo')}>
          <Icon name="cruz" size={12} /> {t('paneles.room.heridos', { n: hurt })}
        </Fact>
      </div>
      {/* Quien está en cama y cuántas noches le quedan (con lo que se cura ahora cada noche). */}
      {patients.length > 0 && (
        <div class="crew-slots infirmary-list">
          {patients.map((h) => (
            <button
              key={h.id}
              class="crew-slot is-hero"
              aria-label={t('paneles.room.en_cama_de', { nombre: h.name })}
              onClick={() => onOpen?.(h.id)}
            >
              <Face game={game} id={h.id} />
              <span class="crew-who">
                <b>{h.name}</b>
                <small>
                  {t('paneles.room.noches_para_curarse', {
                    n: Math.max(1, Math.ceil(h.days / Math.max(1, rate))),
                  })}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Una sala de entrenamiento: qué se entrena y hasta dónde (cómo va cada uno, en sus huecos). */
function TrainInfo({ room }: { room: Room }) {
  const attr = TRAINS[room.type]!;
  return (
    <div class="chips">
      <Fact
        info={t('paneles.room.pon_aqui_a_un', {
          train_hero_base: TRAIN_HERO_BASE,
          train_per_level: TRAIN_PER_LEVEL,
          train_main_bonus: TRAIN_MAIN_BONUS,
        })}
      >
        {t('paneles.room.hasta', { atributo: ATTR_NAMES[attr], train_cap: trainCap(room) })}
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
    key === GUARD
      ? t('paneles.room.de_guardia')
      : isTrainRoom(room.type)
        ? t('paneles.room.entrenan_aqui')
        : t('paneles.room.trabajan_aqui');
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
  { dir: 'left', label: t('paneles.room.ampliar_a_la_izquierda') },
  { dir: 'right', label: t('paneles.room.ampliar_a_la_derecha') },
  { dir: 'up', label: t('paneles.room.subir_una_planta') },
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
  if (!worksOpen(game)) return <span class="muted">{t('paneles.room.ampliar_mover_o_tirar')}</span>;
  if (room.works) return null;
  const grow = DIRS.filter(
    ({ dir }) => (dir === 'up' ? room.h < def.maxH : room.w < def.maxW) && room.level > 0,
  ).map((d) => ({ ...d, plan: planExtend(game, room.id, d.dir) }));
  const open = grow.filter((g) => !('error' in g.plan));
  // Si falta oro se dice; si no, es que al lado no hay hueco.
  const growWhy =
    grow.map((g) => ('error' in g.plan ? g.plan.error : '')).find((e) => e.startsWith(NO_GOLD)) ??
    t('paneles.room.no_hay_hueco_libre');
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
      {grow.length > 0 && !open.length && (
        <span class="muted">{t('paneles.room.ampliar', { grow_why: growWhy })}</span>
      )}
      {!def.fixed && onMove && (
        <button class="btn btn-wood" onClick={() => onMove(room.id)}>
          {t('paneles.room.mover')}
        </button>
      )}
      {!def.fixed &&
        (sure ? (
          <span class="room-sure">
            <span>
              {def.keep
                ? t('paneles.room.quitarla_del_plano_antes')
                : refund > 0
                  ? t('paneles.room.tirarla_recuperas_monedas', { refund })
                  : t('paneles.room.tirarla_no_recuperas_nada')}
            </span>
            <button class="btn btn-red" onClick={() => onWork({ type: 'demolish', id: room.id })}>
              {t('paneles.room.tirar')}
            </button>
            <button class="btn btn-wood" onClick={() => setSure(false)}>
              {t('paneles.room.no')}
            </button>
          </span>
        ) : (
          <button class="btn btn-wood" onClick={() => setSure(true)}>
            {t('paneles.room.tirar')}
          </button>
        ))}
    </div>
  );
}

/** Las pestañas de la ficha: «Sala» siempre; las del taller y «Personalizar», según la sala. */
type RoomTab = 'sala' | WorkTab | 'custom';

/**
 * Ficha de una sala. Arriba de todo, bajo el título, sus pestañas (si tiene más de una): «Sala»
 * (nivel y mejorar, para qué sirve, quién trabaja, lo que está en marcha y sus obras), las del
 * taller (Crear · Templar · Vestir) y «Personalizar» (colores y, en el salón, fiesta y adornos).
 */
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
  // La pestaña elegida es de esta sala: al abrir otra, se vuelve a «Sala».
  const [pick, setPick] = useState<{ room: string; tab: RoomTab }>({ room: roomId, tab: 'sala' });
  const room = game.building.rooms.find((r) => r.id === roomId);
  if (!room) return <p class="panel-note">{t('paneles.room.esa_sala_ya_no')}</p>;
  const def = ROOMS[room.type];
  const info = def.fac ? FACILITY_INFO[def.fac] : null;
  const max = roomMax(room.type);
  const cost = upgradeCostOf(room);
  const why = canWork(game, { type: 'upgradeRoom', id: room.id });
  const size = room.w * room.h;
  const state = room.works
    ? t('paneles.room.en_obras_estara', {
        mudanza: room.works.kind === 'move',
        dawn_in: dawnIn(room.works.nights),
      })
    : room.level === 0
      ? room.type === 'torre'
        ? t('paneles.room.solar_vacio_hay_que')
        : t('paneles.room.rota_hay_que_arreglarla')
      : null;
  const links = LINKS[room.type] ?? [];
  const cells = room.w * room.h;
  const look = { onAct, onTint, onPreview, onDecor, onFeast };
  const customizable = canCustomize(room, look);
  const feast = customizable && feastPending(game, room);
  const workshop = isWorkshop(room.type) && room.level > 0 && !room.works;
  const tabs: TabItem<RoomTab>[] = [
    { id: 'sala', label: t('paneles.room.sala'), icon: 'puerta' },
    ...(workshop ? workshopTabs(game, room) : []),
    ...(customizable
      ? [
          {
            id: 'custom',
            label: t('paneles.room.personalizar'),
            icon: 'brocha',
            alert: feast ? 1 : 0,
          } as const,
        ]
      : []),
  ];
  const want = pick.room === roomId ? pick.tab : 'sala';
  const tab = tabs.some((t) => t.id === want) ? want : 'sala';
  const bar = tabs.length > 1 && (
    <div class="room-tabs">
      <Tabs
        tabs={tabs}
        value={tab}
        onChange={(t) => setPick({ room: roomId, tab: t })}
        label={`Ficha: ${def.name}`}
      />
    </div>
  );
  if (tab === 'custom')
    return (
      <>
        {bar}
        <RoomCustom game={game} room={room} {...look} />
      </>
    );
  if (tab !== 'sala')
    return (
      <>
        {bar}
        <WorkshopInfo key={room.id} game={game} room={room} tab={tab} onAct={onAct} />
      </>
    );
  return (
    <>
      {bar}
      <div class="room-top">
        <div class="room-head" {...(info ? help(info.levels[room.level]) : {})}>
          <span class="pips" aria-label={t('paneles.room.nivel_de', { nivel: room.level, max })}>
            {Array.from({ length: max }, (_, i) => (
              <i key={i} class={i < room.level ? 'on' : ''} />
            ))}
          </span>
          <span class="row-sub">
            {room.level
              ? t('paneles.room.nivel_de', { nivel: room.level, max })
              : t('paneles.room.sin_arreglar')}
            {size > 1 && <> · {t('paneles.room.huecos', { n: size })}</>}
          </span>
        </div>
        {cost !== null ? (
          <button
            class="btn btn-gold room-up"
            data-tut={`mejorar-${room.type}`}
            aria-label={t('paneles.room.mejorar_por', {
              arreglar: room.level === 0,
              sala: def.name,
              coste: cost,
            })}
            disabled={!!why}
            title={why ?? undefined}
            onClick={() => onUpgrade(room.id)}
          >
            <Icon name="mejorar" size={14} />{' '}
            {room.level === 0 ? t('paneles.room.arreglar') : t('paneles.room.mejorar')} ·{' '}
            <Icon name="coin" size={10} /> {cost}
          </button>
        ) : (
          <span class="pill pill-ok room-max">{t('paneles.room.al_maximo')}</span>
        )}
      </div>
      <div class="room-levels">
        {room.level > 0 && (
          <p class="room-now">
            <b>{t('paneles.room.ahora')}</b> {roomEffect(room.type, room.level, cells)}.
          </p>
        )}
        {cost !== null && (
          <p class="next-level">
            <b>
              {room.level > 0
                ? t('paneles.room.mejora')
                : room.type === 'torre'
                  ? t('paneles.room.levantada')
                  : t('paneles.room.arreglada')}
            </b>{' '}
            {roomEffect(room.type, room.level + 1, cells)}.
          </p>
        )}
      </div>
      {why && cost !== null && <p class="qs-warn">{why}</p>}
      {state && <p class="room-state">{state}</p>}
      <p class="room-desc">{def.desc}</p>
      {links.length > 0 && (
        <div class="room-links" role="group" aria-label={t('paneles.room.ir_a')}>
          {links.map((l) => (
            <button key={l.to} class="btn btn-wood" onClick={() => onLink(l.to)}>
              <Icon name={l.icon} size={14} /> {l.label}
            </button>
          ))}
        </div>
      )}
      {room.type === 'almacen' && room.level > 0 && <MatShelf game={game} room={room} />}
      {room.type === 'salon' && room.level > 0 && <SalonInfo game={game} />}
      {(room.type === 'cocina' || room.type === 'despensa' || room.type === 'bodega') &&
        room.level > 0 && <LarderInfo game={game} room={room} />}
      {isTrainRoom(room.type) && room.level > 0 && <TrainInfo room={room} />}
      {room.type === 'enfermeria' && room.level > 0 && (
        <InfirmaryInfo game={game} onOpen={onOpen} />
      )}
      {room.type === 'tesoro' && <VaultInfo game={game} />}
      {room.type === 'recibidor' && <DoorInfo game={game} />}
      {(room.type === 'dormitorio' || room.type === 'veteranos') && room.level > 0 && (
        <div class="chips">
          <Fact info={t('paneles.room.camas_de_esta_sala')}>
            <Icon name="cama" size={12} /> {t('paneles.room.aqui', { n: roomBeds(room) })}
          </Fact>
          <Fact info={t('paneles.room.heroes_en_el_gremio')}>
            <Icon name="heroe" size={12} />{' '}
            {t('paneles.room.de_heroes', {
              length: roster(game).length,
              beds: beds(game.building),
            })}
          </Fact>
        </div>
      )}
      {room.type === 'servicio' && room.level > 0 && (
        <div class="chips">
          <Fact info={t('paneles.room.camas_del_servicio_una')}>
            <Icon name="cama" size={12} />{' '}
            {t('paneles.room.camas', { n: staffBeds(game.building) })}
          </Fact>
          <Fact info={t('paneles.room.trabajadores_y_cuantos_puede')}>
            <Icon name="martillo" size={12} />{' '}
            {t('paneles.room.de_trabajadores', {
              length: game.workers.length,
              worker_cap: workerCap(game),
            })}
          </Fact>
        </div>
      )}
      {hasPosts(room.type) && room.level === 0 && (
        <span class="row-sub">
          {t('paneles.room.arreglada_tendra', { n: room.w * 2, entrenar: isTrainRoom(room.type) })}
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
      {workshop && <WorkshopInfo key={room.id} game={game} room={room} onAct={onAct} />}
      {onWork && <RoomWorks game={game} room={room} onWork={onWork} onMove={onMove} />}
    </>
  );
}
