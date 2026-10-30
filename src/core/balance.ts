/**
 * Todas las constantes de equilibrio en un solo sitio, para ajustarlas con el simulador
 * (`npm run sim`) sin tocar la lógica.
 */
import type { RoomType } from '../data/rooms';
import type { Facilities, Outcome } from './model';
import type { SkillId } from './party';

export const DAYS = 30;
export const DEBT = 1000;
/** Pagos mínimos al prestamista. Cada pago incluye los salarios de la semana. */
export const SCHEDULE: readonly { day: number; amount: number }[] = [
  { day: 7, amount: 110 },
  { day: 14, amount: 200 },
  { day: 21, amount: 260 },
  { day: 28, amount: 430 },
];

export const START = {
  gold: 160,
  fac: {
    dorm: 1,
    enf: 0,
    tab: 1,
    mapas: 0,
    arm: 0,
    cap: 0,
    forja: 0,
    establo: 0,
    patio: 0,
    empal: 0,
    torre: 0,
    vet: 0,
  } as Facilities,
  heroes: 2,
  candidates: 3,
  quests: 4,
};

/** Coste de subir a cada nivel (índice = nivel nuevo); el nivel máximo es el último. */
export const UPGRADE_COST: Record<keyof Facilities, readonly number[]> = {
  dorm: [0, 80, 170, 420, 750],
  enf: [0, 100, 230, 450],
  tab: [0, 90, 250, 450, 750],
  mapas: [0, 120, 340, 620],
  arm: [0, 150, 380, 650],
  cap: [0, 110, 320, 600],
  forja: [0, 180, 360, 640],
  establo: [0, 140, 300],
  patio: [0, 160, 340],
  empal: [0, 120, 260],
  torre: [0, 200, 380, 600],
  vet: [0, 220, 420, 700],
};

/** Ala de veteranos: a partir de este nivel de héroe se cuenta como veterano. */
export const VET_LEVEL = 4;
/** Moral extra por noche y tope de moral extra de los veteranos, por nivel del ala. */
export const VET_REST = [0, 4, 8, 12] as const;
export const VET_CAP = [0, 10, 15, 20] as const;

/** Dormitorio de nivel 4 (dosel y alfombras): moral extra por noche para todos los de casa. */
export const DORM_REST = [0, 0, 0, 0, 2] as const;
/** Torre de nivel 3 (almenara encendida): las bandas se lo piensan más. */
export const TOWER_DETER = 0.75;

/** Patio de entrenamiento: experiencia por noche descansando, por nivel. */
export const TRAINING_XP = [0, 6, 12] as const;
export const facilityMax = (k: keyof Facilities) => UPGRADE_COST[k].length - 1;

/**
 * Salas: coste de cada nivel (índice = nivel nuevo; el 1 es construirla o arreglarla). Las
 * que sustituyen a una instalación de antes cuestan lo mismo que ella.
 */
export const ROOM_COST: Record<RoomType, readonly number[]> = {
  recibidor: [0, 100, 150, 320],
  salon: UPGRADE_COST.tab,
  cocina: [0, 100, 220, 400, 750],
  bodega: [0, 100, 220, 400, 750],
  tesoro: [0, 120, 260, 480, 900],
  dormitorio: UPGRADE_COST.dorm,
  enfermeria: UPGRADE_COST.enf,
  capilla: UPGRADE_COST.cap,
  mapas: UPGRADE_COST.mapas,
  armeria: UPGRADE_COST.arm,
  forja: UPGRADE_COST.forja,
  veteranos: UPGRADE_COST.vet,
  torre: UPGRADE_COST.torre,
  servicio: [0, 80, 170, 380],
  despensa: [0, 80, 180, 360],
  armas: [0, 150, 320, 520, 850],
  tiro: [0, 150, 320, 520, 850],
  biblioteca: [0, 150, 320, 520, 850],
};
export const roomMax = (t: RoomType) => ROOM_COST[t].length - 1;
/** Mejorar una sala más ancha que la de serie cuesta este recargo por hueco de más. */
export const ROOM_SIZE_COST = 0.5;
/** Ampliar: cada hueco nuevo cuesta esta parte de lo que costó subir un hueco a su nivel. */
export const EXTEND_RATE = 0.6;
/** Mover una sala: por hueco. */
export const MOVE_COST = 15;
/** Al destruir una sala se devuelve esta parte de lo gastado en ella. */
export const DEMOLISH_REFUND = 0.5;
/** Excavar un hueco, según la profundidad (índice = plantas bajo tierra). */
export const DIG_COST = [0, 60, 90, 130, 180, 240, 310] as const;
/** Ancho del edificio en huecos: al empezar y como mucho, comprando solares a la derecha. */
export const START_COLS = 4;
export const MAX_COLS = 7;
/** Precio de cada solar nuevo (índice = solares ya comprados). */
export const PLOT_COST = [150, 250, 400] as const;
/** Plantas como máximo sobre el suelo (con el rango más alto) y bajo tierra. */
export const MAX_UP = 6;
export const MAX_DOWN = DIG_COST.length - 1;
/** Precio de un tramo de escalera: el primero y lo que sube con cada tramo que ya hay. */
export const STAIR_COST = 50;
export const STAIR_STEP = 10;

/** Camas: las de los dormitorios y, con el ala de veteranos, dos más por nivel. */
export const capacity = (dorm: number, vet = 0) => 2 + 2 * dorm + 2 * vet;
/** Segundos que dura un día con el juego abierto (a velocidad normal). */
export const DAY_SECONDS = 300;
/**
 * «Tiempo que corre solo» (en prueba, Ajustes › Modo prueba): con el juego cerrado o en segundo
 * plano el día dura esto en segundos reales (abierto, `DAY_SECONDS`). Al volver se simula de
 * golpe, hasta `AWAY_MAX_DAYS` días; los asaltos, menos probables (`AWAY_RAID`) y resueltos
 * solos. Menos de `AWAY_MIN_SECONDS` fuera no cuenta.
 */
export const AWAY_DAY_SECONDS = 3600;
export const AWAY_MAX_DAYS = 8;
export const AWAY_RAID = 0.4;
export const AWAY_MIN_SECONDS = 20;
/** Parte del día desde la que es anochecer y se puede cerrar la taberna. */
export const DUSK = 0.8;
/** Entregas en que llega la caja del día, repartidas hasta el anochecer. */
export const DELIVERIES = 8;
/** Trofeos: cuántos caben en la pared del salón, el Atractivo de cada uno y la fama al conseguirlos. */
export const TROPHY_SLOTS = 4;
export const TROPHY_APPEAL = 2;
export const TROPHY_REP = 3;
/** Días de cama que se recuperan cada noche. */
export const healRate = (enf: number) => 1 + enf;

export const RANKS: readonly { name: string; at: number }[] = [
  { name: 'cobre', at: 0 },
  { name: 'hierro', at: 40 },
  { name: 'plata', at: 100 },
  { name: 'oro', at: 180 },
  { name: 'leyenda', at: 300 },
];

/**
 * Lo que abre cada rango del gremio (índice de `RANKS`): las plantas sobre la baja y los niveles
 * de sala que llegaron después. Los de antes no piden nada, para no quitarle nada a nadie.
 */
export const FLOORS_BY_RANK = [4, 4, 5, 6, 6] as const;
export const LEVEL_RANK: Partial<Record<RoomType, Partial<Record<number, number>>>> = {
  capilla: { 3: 1 },
  mapas: { 3: 1 },
  armeria: { 3: 1 },
  forja: { 3: 1 },
  veteranos: { 3: 2 },
  torre: { 3: 2 },
  tesoro: { 4: 3 },
  dormitorio: { 4: 3 },
  cocina: { 4: 3 },
  bodega: { 4: 3 },
  armas: { 4: 4 },
  tiro: { 4: 4 },
  biblioteca: { 4: 4 },
};
/** Rango que pide un nivel de sala (0: ninguno). */
export const levelRank = (t: RoomType, level: number) => LEVEL_RANK[t]?.[level] ?? 0;
/** Plantas sobre la baja que se pueden ocupar con ese rango. */
export const floorsFor = (rank: number) =>
  FLOORS_BY_RANK[Math.max(0, Math.min(rank, FLOORS_BY_RANK.length - 1))]!;
/** Primer rango que abre la planta `f` sobre la baja. */
export const floorRank = (f: number) => FLOORS_BY_RANK.findIndex((n) => n >= f);

export function rankIndex(rep: number): number {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (rep >= r.at) i = k;
  });
  return i;
}

export const BOARD_SIZE = (tab: number, mapas = 0) => 3 + Math.min(2, tab) + mapas;
/** Cada cuántos días llega un candidato nuevo. */
export const CANDIDATE_EVERY = 2;
export const MAX_CANDIDATES = 3;

export const XP_PER_LEVEL = 100;
export const XP: Record<Outcome, number> = {
  'Éxito brillante': 50,
  Éxito: 40,
  'Éxito parcial': 25,
  Fracaso: 15,
  Desastre: 15,
};
export const PAY: Record<Outcome, number> = {
  'Éxito brillante': 1.25,
  Éxito: 1,
  'Éxito parcial': 0.35,
  Fracaso: 0,
  Desastre: 0,
};
export const REP: Record<Outcome, number> = {
  'Éxito brillante': 8,
  Éxito: 5,
  'Éxito parcial': 1,
  Fracaso: -3,
  Desastre: -6,
};
/** Probabilidad base de herida por héroe según el resultado (un clérigo la reduce a la mitad). */
export const INJURY: Record<Outcome, number> = {
  'Éxito brillante': 0.04,
  Éxito: 0.1,
  'Éxito parcial': 0.25,
  Fracaso: 0.45,
  Desastre: 0.7,
};
export const MORALE: Record<Outcome, number> = {
  'Éxito brillante': 10,
  Éxito: 6,
  'Éxito parcial': 0,
  Fracaso: -8,
  Desastre: -15,
};
/** Monedas por punto de dificultad de un encargo (antes de peligro y duración). */
export const REWARD_PER_POINT = 5;
/** Probabilidad de que un fracaso acabe en desastre, por nivel de peligro. */
export const DISASTER = [0.05, 0.3, 0.6, 0.9] as const;
/** Probabilidad de una baja (herida grave, muerte o desaparición) en un fracaso, por peligro. */
export const FAIL_CASUALTY = [0, 0.05, 0.15, 0.3] as const;
/** El giro oculto sube así la dificultad del primer desafío. */
export const TWIST_DIFF = 3;
/** Parte del oro que se queda un codicioso. */
export const GREED = 0.1;

// ---------- Clases ----------
/** Explorador: días que ahorra en viajes largos (desde SCOUT_MIN días) y cuánto reduce el desastre. */
export const SCOUT_MIN = 3;
export const SCOUT_DAYS = 1;
export const SCOUT_AMBUSH = 0.5;
/** Pícaro: oro extra cuando se cobra; además trae el objeto aunque el éxito sea parcial. */
export const ROGUE_GOLD = 0.1;
/** Guerrero: multiplica el riesgo de herida de sus compañeros. */
export const WARRIOR_GUARD = 0.5;
/** Clérigo: multiplica las pérdidas de moral del grupo (y además evita muertes). */
export const CLERIC_SOLACE = 0.5;

// ---------- Moral ----------
/** Cansancio: moral que cuesta cada día fuera, sea cual sea el resultado. */
export const TRIP_FATIGUE = 4;
/** Moral que se recupera cada noche descansando en el gremio, según la taberna. */
export const restMorale = (tab: number) => 2 + tab;
/** Hasta dónde llega la moral solo descansando: una taberna mejor anima más. */
export const restCap = (tab: number) => 55 + 6 * tab;
/** Capilla: moral extra por noche y probabilidad de que vuelva un desaparecido. */
export const chapelRest = (cap: number) => 2 * cap;
export const RETURN_CHANCE = [0.5, 0.7, 0.85, 0.95] as const;
export const returnChance = (cap: number) =>
  RETURN_CHANCE[Math.min(cap, RETURN_CHANCE.length - 1)]!;

/** Armería: lo que suma a cada héroe según su nivel. */
export const ARMORY: readonly Partial<Record<SkillId, number>>[] = [
  {},
  { Combate: 1 },
  { Combate: 1, Trampas: 1, Supervivencia: 1 },
  { Combate: 2, Trampas: 1, Supervivencia: 1 },
];

/** Probabilidad por noche de que alguien harto se vaya, y de que alguien desanimado pida aumento. */
export const DESERT_CHANCE = 0.35;
export const RAISE_CHANCE = 0.3;
export const RAISE_AMOUNT = 3;
export const RAISE_MORALE = 25;

// ---------- Veteranos y modo libre ----------
/** Lo que sube el salario al alcanzar un nivel: más cuanto más alto. */
/** Subida de sueldo al subir de nivel: los veteranos (nivel 6 o más) piden bastante más. */
export const levelRaise = (lvl: number) => (lvl <= 5 ? 2 * lvl : 5 * lvl);
/**
 * Modo libre: hay otros gremios pujando por los encargos y la comarca paga menos que en los
 * apuros de la deuda (multiplicador base, antes del descuento por rango).
 */
export const FREE_PAY = 0.5;
/** Caché de veterano: al llegar a estos niveles piden un plus fijo. */
export const CACHE: Readonly<Record<number, number>> = { 5: 15, 8: 30 };
export const CACHE_REFUSE_MORALE = -25;
/** En modo libre se pagan salarios cada SALARY_EVERY días; dos impagos seguidos, quiebra. */
export const SALARY_EVERY = 7;
export const UNPAID_LIMIT = 2;
export const UNPAID_MORALE = -20;
export const REFUSE_MORALE = -10;

// ---------- Asaltos ----------
/** Desde qué día pueden llegar asaltos y a partir de qué notoriedad empiezan a fijarse. */
export const RAID_FROM = 12;
export const RAID_NOTORIETY = 80;
/** Tope de probabilidad diaria de que una banda se fije en el gremio. */
export const RAID_MAX_CHANCE = 0.25;
/** Probabilidad base de chivatazo al programarse un asalto. */
export const RAID_BASE = 0.45;
/** Lo que suma cada héroe de guardia a la defensa. */
export const GUARD_BONUS = 3;
/** Como mucho, tantos de guardia en el recibidor. */
export const MAX_GUARDS = 2;

// ---------- Cámara del tesoro ----------
/** Oro que cabe por hueco de la cámara, según su nivel (el 0 es lo que se esconde sin cámara). */
export const VAULT_STORE = [300, 1500, 4000, 10000, 20000] as const;
/** A partir de esta parte del tope, el juego avisa de que la cámara está casi llena. */
export const VAULT_WARN = 0.85;
/** Segundos que tardan los bandidos en abrir la cerradura, según el nivel de la cámara. */
export const LOCK_TIME = [2, 6, 10, 15, 20] as const;
/** Segundos que aguanta la puerta, según el nivel del recibidor. */
export const DOOR_TIME = [2, 5, 8, 12] as const;

// ---------- Asalto por salas (segundos de la pelea que se ve) ----------
/** Andar de una sala a otra: por hueco de distancia, por planta de escalera y del patio a la puerta. */
export const RAID_CELL = 1.6;
export const RAID_FLOOR = 1.6;
export const RAID_YARD = 2.5;
/** Lo que tardan los bandidos en llegar al patio y en perderse de vista al huir. */
export const RAID_ARRIVE = 3;
export const RAID_EXIT = 2;
/** Lo que tardan en despertarse y salir corriendo los que duermen (con perro, menos). */
export const RAID_WAKE = 4;
export const RAID_WAKE_DOG = 1.5;
/** Con gente de guardia, dan la voz de alarma en cuanto ven las antorchas por el camino. */
export const RAID_ALARM = 1;
export const RAID_SPOT = 4;
/** Vida de cada uno: héroes, trabajadores y bandidos. */
export const HERO_HP = 12;
/** Los de guardia están vestidos y armados: aguantan más. */
export const GUARD_HP = 18;
export const WORKER_HP = 8;
export const BANDIT_HP = 12;
/** Daño por segundo por punto de fuerza, y fuerza de cada bandido por punto de la banda. */
export const FIGHT_RATE = 0.35;
export const BANDIT_POWER = 0.75;
/** Oro que carga cada bandido: unos fijos más la fuerza de la banda. */
export const BANDIT_CARRY = 40;
/** Lo que se tarda en cargar los sacos. */
export const LOAD_TIME = 1.5;
/** Lo que suma la empalizada a quien pelea en el patio, por nivel. */
export const PALISADE_FIGHT = 0.15;
/** Si en tanto tiempo no ha acabado, los bandidos se van con lo que tengan. */
export const RAID_MAX_T = 150;

// ---------- Trabajadores ----------
/** Puestos de trabajo por cada hueco de una sala que produce. */
export const JOB_SLOTS = 2;
/** En su oficio se rinde la mitad más. */
export const TRADE_BONUS = 1.5;
/** Lo que rinde un héroe echando una mano (menos que cualquier trabajador con maña). */
export const HERO_WORK = 2;
/** Trabajo en la enfermería con el que los heridos se curan un día antes. */
export const NURSE_WORK = 3;
/** Noches de trabajo por cada punto de Maña que ya se tiene para subir otro. */
export const SKILL_XP = 5;
/** Probabilidad base de que alguien pida trabajo cada día (desde que se paga la deuda) y cuántos esperan. */
export const SEEKER_CHANCE = 0.2;
export const MAX_SEEKERS = 3;

// ---------- Salón y visitantes ----------
/** Visitantes que quiere venir: unos fijos, más con la reputación y con el Atractivo. */
export const VISIT_BASE = 3;
export const VISIT_PER_REP = 1 / 25;
export const VISIT_PER_APPEAL = 0.7;
/** Cuántas veces se llena cada plaza del salón en un día. */
export const SEAT_TURNS = 1.5;
/** Visitantes que se atienden sin nadie en el salón, y cuántos más por punto de trabajo. */
export const SERVE_BASE = 2;
export const SERVE_PER_WORK = 0.8;
/** Atractivo mínimo para que vengan nobles. */
export const NOBLE_APPEAL = 8;
/** Días que dura el peligro tras la visita de un espía y cuánto sube el riesgo de asalto. */
export const SPY_DAYS = 5;
export const SPY_RISK = 0.06;
/** Peleas en el salón: una base, más con mucha gente y con la mesa de naipes. */
export const BRAWL_BASE = 0.03;
export const BRAWL_PER_VISITOR = 0.008;
export const BRAWL_NAIPES = 0.08;

// ---------- Comida y cerveza ----------
/** Raciones que hace la cocina y jarras que saca la bodega por punto de trabajo, cada día. */
export const COOK_PER_WORK = 2;
export const BREW_PER_WORK = 1;
/** La bodega bajo tierra, fresca, saca más cerveza. */
export const CELLAR_COOL = 1.25;
/** Lo que se guarda por hueco y nivel: la cocina un poco, la despensa mucho; la cerveza, en la bodega. */
export const KITCHEN_STORE = 12;
export const PANTRY_STORE = 30;
export const CELLAR_STORE = 20;
/** Lo que paga cada visitante por su jarra. */
export const BEER_COIN = 1;
/** Moral que pierde quien se acuesta sin cenar. */
export const HUNGER_MORALE = 8;
/** Raciones y jarras al empezar. */
export const START_FOOD = 12;
export const START_BEER = 10;

// ---------- Entrenamiento ----------
/** Progreso que da un día en una sala de entrenamiento de nivel 1 (algo más con cada nivel). */
export const TRAIN_RATE = 1;
/** Progreso que cuesta subir un punto: unos fijos más el valor que ya se tiene. */
export const TRAIN_COST_BASE = 2;
/** Hasta dónde se puede entrenar un atributo según el nivel de la sala. */
export const TRAIN_CAP = [0, 5, 7, 9, 11] as const;
