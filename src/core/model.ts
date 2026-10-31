/**
 * Modelo de la partida. Todo es JSON serializable: guardar es `JSON.stringify(state)`.
 * El núcleo no conoce el DOM ni el arte; el aspecto de cada héroe sale de su `seed`.
 */
import type { IncidentKind } from '../data/incidents';
import type { BossKind } from '../data/bosses';
import type {
  CrestColor,
  CrestSymbol,
  DecorId,
  Dress,
  FacadeId,
  FacadeLook,
  StaffId,
  TintId,
} from '../data/custom';
import type { Trade } from '../data/workers';
import type { RoomType } from '../data/rooms';
import type { UnlockId } from '../data/unlocks';
import type { Tutorial } from './tutorial';
import type { Attrs, Challenge, ClassId, SkillId, Trait } from './party';

export const SAVE_VERSION = 4;

export type Sex = 'm' | 'f';

export type HeroStatus = 'ok' | 'mision' | 'herido' | 'desaparecido' | 'muerto';

export interface Hero {
  id: string;
  /** Semilla del aspecto (retrato y sprite). */
  seed: string;
  /** Tinte y prenda de la sastrería (solo se ven). */
  dress?: Dress;
  name: string;
  nick?: string;
  sex: Sex;
  cls: ClassId;
  lvl: number;
  xp: number;
  attrs: Attrs;
  traits: Trait[];
  morale: number;
  salary: number;
  /** Prima de fichaje (solo cuenta mientras es candidato). */
  fee: number;
  status: HeroStatus;
  /** Días que le quedan fuera o en cama. */
  days: number;
  quote: string;
  history: string[];
  /** Petición pendiente: aumento (desanimado) o caché de veterano (al subir de nivel). */
  request?: 'raise' | 'cache';
  /** Objeto equipado (una ranura). Se pierde si cae o deserta. */
  item?: Item;
  /** De guardia: no sale de misión y defiende mejor la taberna. */
  guard?: boolean;
  /** Dónde se le perdió la pista (si está desaparecido). */
  lostAt?: string;
  /** Sala en la que echa una mano o entrena mientras está en casa (id). */
  job?: string;
  /** Progreso de entrenamiento hacia el siguiente punto de cada atributo. */
  train?: Partial<Attrs>;
}

/** Quien trabaja en la taberna: no sale de misión, cobra poco y rinde más en su oficio. */
export interface Worker {
  id: string;
  /** Semilla del aspecto. */
  seed: string;
  name: string;
  sex: Sex;
  /** Maña, de 1 a 10: lo que rinde. Sube trabajando. */
  skill: number;
  trade: Trade;
  /** Noches trabajadas hacia la siguiente subida de Maña. */
  xp: number;
  salary: number;
  /** Prima por empezar (solo cuenta mientras pide trabajo). */
  fee: number;
  /** Sala en la que trabaja (id); sin sala, descansa. */
  room?: string;
  /** Uno de los tres del pueblo que ya trabajaban para tu tío. */
  village?: StaffId;
  quote: string;
}

export type QuestType = 'Cazar' | 'Escoltar' | 'Explorar' | 'Recuperar' | 'Investigar' | 'Limpiar';
export type Danger = 0 | 1 | 2 | 3;

export type ItemKind = 'arma' | 'armadura' | 'amuleto' | 'herramienta' | 'tesoro';
/** Dibujo del objeto en la escena y en las fichas. */
export type ItemIcon =
  'espada' | 'hacha' | 'escudo' | 'coraza' | 'amuleto' | 'ganzua' | 'botas' | 'capa' | 'varita';
/**
 * Efectos especiales: guard (quien lo lleva se hiere la mitad), luck (repite una tirada
 * fallida), ward (anula al gafe del grupo), ambush (esquiva la mitad de las emboscadas).
 */
export type ItemPerk = 'guard' | 'luck' | 'ward' | 'ambush';
export type Rarity = 0 | 1 | 2;

export interface Item {
  id: string;
  name: string;
  desc: string;
  value: number;
  /** Sin tipo (partidas antiguas) cuenta como tesoro: solo se vende. */
  kind?: ItemKind;
  rarity?: Rarity;
  icon?: ItemIcon;
  bonus?: Partial<Record<SkillId, number>>;
  perk?: ItemPerk;
}

export type TrophyIcon = 'cabeza' | 'colmillos' | 'estandarte' | 'calavera' | 'idolo' | 'mascara';

/** Recuerdo de una gran hazaña: se exhibe en la sala y atrae clientela. */
export interface Trophy {
  id: string;
  name: string;
  desc: string;
  icon: TrophyIcon;
  /** Quién lo consiguió, dónde y cuándo. */
  who: string;
  place: string;
  day: number;
  value: number;
}

export interface Quest {
  id: string;
  title: string;
  client: string;
  type: QuestType;
  text: string;
  place: string;
  challenges: Challenge[];
  slots: number;
  days: number;
  reward: number;
  danger: Danger;
  /** El cliente no dice la verdad sobre el peligro. */
  dangerHidden?: boolean;
  /** Días que sigue en el tablón. */
  expires: number;
  item?: Item;
  /** Giro oculto: más duro de lo que parece. Un mago en el grupo lo detecta. */
  twist?: string;
  fresh?: boolean;
  /** Rescate de un héroe desaparecido (su id). */
  rescue?: string;
  /** Paso de una cadena de misiones (no caduca ni cuenta para el tablón). */
  chain?: { id: string; step: number };
  /** Salió de un rumor de la barra (no cuenta para el tablón; botín bueno o legendario). */
  rumor?: boolean;
}

/** Un rumor en la barra: se oye un rato y, si se toca a tiempo, abre un encargo especial. */
export interface Rumor {
  id: string;
  text: string;
  /** Reloj del día (s) en que empieza y en que se pierde. */
  from: number;
  until: number;
}

export interface Mission {
  id: string;
  quest: Quest;
  heroIds: string[];
  daysLeft: number;
}

export type Outcome = 'Éxito brillante' | 'Éxito' | 'Éxito parcial' | 'Fracaso' | 'Desastre';

export type ChipKind = 'good' | 'bad' | 'warn' | 'info';

export interface Report {
  id: string;
  day: number;
  title: string;
  heroIds: string[];
  who: string;
  outcome: Outcome;
  body: string[];
  chips: { t: string; k: ChipKind }[];
  read: boolean;
  /** Informe de un asalto a la taberna (con su propio titular). */
  raid?: { won: boolean };
  /** Titular propio (cartas de clientes, finales de cadena). */
  heading?: string;
  /** Pelea contra un jefe, guardada para verla (y repetirla). */
  fight?: BossFight;
}

/** Quién peleó contra el jefe y cómo acabó cada uno (para pintar la pelea más tarde). */
export interface BossFight {
  boss: BossKind;
  place: string;
  won: boolean;
  heroes: {
    id: string;
    name: string;
    seed: string;
    cls: ClassId;
    sex: Sex;
    eyepatch?: boolean;
    scar?: boolean;
    gear?: { icon: ItemIcon; rarity: Rarity };
    /** Cómo quedó tras la pelea. */
    fate: HeroStatus;
  }[];
}

export interface Fallen {
  name: string;
  epitaph: string;
}

export interface Facilities {
  dorm: number;
  enf: number;
  tab: number;
  /** Sala de mapas (desván): más encargos y, a nivel 2, el peligro real a la vista. */
  mapas: number;
  /** Armería (bodega): equipo para todos. */
  arm: number;
  /** Capilla (anexo): moral, desaparecidos y una vela por cada caído. */
  cap: number;
  /** Forja (derecha): mejora el equipo que llevan puesto. */
  forja: number;
  /** Establo (derecha): viajes más cortos y escoltas mejor pagadas. */
  establo: number;
  /** Patio de entrenamiento (izquierda): experiencia mientras descansan. */
  patio: number;
  /** Empalizada (izquierda): defensa contra asaltos. */
  empal: number;
  /** Torre del vigía (izquierda): avisa de los asaltos y trae encargos. */
  torre: number;
  /** Ala de veteranos (colgada de la fachada derecha): moral para los de nivel alto. */
  vet: number;
}

/** Obra en curso: la sala nueva o movida no funciona hasta que acaba; la ampliada, sí. */
export interface Works {
  kind: 'build' | 'extend' | 'move';
  nights: number;
  /** Al ampliar: el tamaño de antes, que es el que cuenta hasta que acaba la obra. */
  from?: { col: number; w: number; h: number };
}

/** Una sala del corte del edificio. Ocupa `w` huecos de ancho y `h` plantas de alto. */
export interface Room {
  id: string;
  type: RoomType;
  /** Hueco de la izquierda (0 = junto al patio). */
  col: number;
  /** Planta de abajo (0 = planta baja; las negativas, bajo tierra). */
  floor: number;
  w: number;
  h: number;
  /** 0 = rota o sin levantar. */
  level: number;
  /** Monedas gastadas en ella: al destruirla se devuelve una parte. */
  spent: number;
  works?: Works;
}

/**
 * Un tramo de escalera: une la planta `floor` con la de encima en la columna de escalera que va
 * justo a la izquierda del hueco `at`. La columna existe (y ensancha el edificio) si tiene algún
 * tramo; en las plantas a las que no llega ninguno, es muro.
 */
export interface Stair {
  at: number;
  floor: number;
}

/** El edificio: salas, escaleras, lo excavado y lo que hay en el patio. */
export interface Building {
  /** Ancho en huecos, sin contar las escaleras. */
  cols: number;
  /** Tramos de escalera, sin límite (como los ascensores de Fallout Shelter). */
  stairs: Stair[];
  /** Huecos excavados bajo tierra, como «hueco,planta». */
  dug: string[];
  rooms: Room[];
  /** Establo, muñecos de entrenamiento y empalizada, por nivel. */
  yard: Record<'establo' | 'patio' | 'empal', number>;
}

/** Lo que da una sala al terminar el día. */
export interface RoomYield {
  room: string;
  food?: number;
  beer?: number;
}

/** Lo que pasó al terminar un día: se enseña en la transición del amanecer. */
/** Un incidente en marcha en una sala (ver `core/incidents.ts`). */
export interface Incident {
  id: string;
  kind: IncidentKind;
  /** Id de la sala. */
  room: string;
  /** Reloj del día (s) en que empezó y en que sale mal si nadie hace nada. */
  from: number;
  until: number;
  /** Los de tocar: toques que faltan. */
  taps?: number;
}

export interface DawnEvent {
  t: string;
  k?: ChipKind;
  /** Encabezado (el día, en la carta de «Mientras no estabas»). */
  head?: boolean;
}

export interface Custom {
  name: string;
  color: CrestColor;
  symbol: CrestSymbol;
  dog: boolean;
  decor?: DecorId[];
  /** Lo que adorna la fachada (atrae visitantes). */
  facade?: FacadeId[];
  raven?: boolean;
  /** Día en que se montó la fiesta de la comarca. */
  feast?: number;
  /** Tema de color de las telas de cada sala (por id); sin él, los de la casa. */
  colors?: Record<string, TintId>;
  /** Tejado, paredes, rótulo y jardineras de la fachada (solo se ve). */
  look?: FacadeLook;
}

export interface PendingEvent {
  id: string;
  /** Héroes que aparecen en el suceso. */
  who: string[];
  text: string;
  options: { label: string; hint: string }[];
}

export interface ChainState {
  id: string;
  step: number;
  status: 'activa' | 'hecha';
  /** Veces que la historia se ha torcido (cada una, el paso vuelve más difícil). */
  twists: number;
  /** Quién fue al último paso (para mandar al mismo grupo al siguiente). */
  party?: string[];
}

export interface Raid {
  day: number;
  band: string;
  strength: number;
  warned: boolean;
}

export interface RaidResult {
  day: number;
  band: string;
  bandits: number;
  defenders: string[];
  won: boolean;
  /** Defensores que acabaron heridos. */
  hurt: string[];
  stolen: number;
  /** Oro que cargaban los bandidos que cayeron antes de salir (vuelve a la cámara). */
  recovered?: number;
  /** La pelea sala a sala, segundo a segundo, para verla en la escena. */
  plan?: RaidPlan;
}

/**
 * Lo que pasa en un asalto, en segundos desde que se oyen las botas. Los sitios son salas (por
 * id), el patio ('patio') o el camino ('fuera'). Las figuras son héroes, trabajadores o
 * bandidos ('b0', 'b1'…).
 */
export type RaidStep =
  /** Echan a andar hacia una sala vecina y llegan en `dur` segundos. */
  | { t: number; k: 'move'; ids: string[]; to: string; dur: number }
  /** Se despierta y sale corriendo (los que duermen). */
  | { t: number; k: 'wake'; id: string }
  /** Empiezan a pelear en una sala. */
  | { t: number; k: 'fight'; at: string }
  /** Cae un defensor (herido, no muerto). */
  | { t: number; k: 'fall'; id: string }
  /** Cae un bandido; si cargaba oro, se recupera. */
  | { t: number; k: 'down'; id: string; gold: number }
  /** Empiezan a romper la puerta, y la rompen. */
  | { t: number; k: 'door'; dur: number }
  | { t: number; k: 'broke' }
  /** Empiezan con la cerradura de la cámara, y la abren. */
  | { t: number; k: 'lock'; dur: number }
  | { t: number; k: 'open' }
  /** Un bandido carga su saco. */
  | { t: number; k: 'loot'; id: string; gold: number }
  /** Un bandido se pierde por el camino con lo que lleva. */
  | { t: number; k: 'escape'; id: string; gold: number };

export interface RaidPlan {
  /** Camino de los bandidos: del recibidor a la cámara (ids de sala). */
  route: string[];
  /** Dónde está cada uno al empezar. */
  start: Record<string, string>;
  steps: RaidStep[];
  /** Segundo en el que acaba todo. */
  end: number;
}

/** Contadores de la partida: hazañas, desafíos y récords. */
export interface Stats {
  missions: number;
  wins: number;
  brilliant: number;
  trophies: number;
  goldEarned: number;
  maxLvl: number;
  /** Último día con una baja (muerte); para «días sin bajas». */
  lastDeath: number;
  raids: number;
  chains?: number;
  /** Incidentes de la taberna resueltos. */
  incidents?: number;
  byType: Partial<Record<QuestType, number>>;
}

/** Cómo se llega a la apertura del gremio: se compara entre intentos. */
export interface Arrival {
  day: number;
  heroes: number;
  gold: number;
  rep: number;
  trophies: number;
  facilities: number;
  fallen: number;
  score: number;
}

/** Un objetivo en curso: el contador al salir (los de contar), lo que pide y su premio. */
export interface ActiveGoal {
  id: string;
  text: string;
  base: number;
  target: number;
  reward: Reward;
}

/** Objetivos: los tres en curso, cuántas veces se ha cumplido cada uno y el historial. */
export interface Goals {
  active: ActiveGoal[];
  done: Record<string, number>;
  log: { day: number; text: string; reward: string }[];
}

export interface Reward {
  gold?: number;
  rep?: number;
  /** Rareza del equipo de regalo. */
  item?: Rarity;
  /** Algo que se ve (pieza de fachada o tema de color). */
  unlock?: UnlockId;
}

export type GameOver = { kind: 'victoria' | 'derrota'; text: string; score: number } | null;

export interface GameState {
  version: number;
  seed: string;
  /** Estado del generador aleatorio: la partida es reproducible. */
  rng: number;
  uid: number;
  day: number;
  gold: number;
  rep: number;
  /** Deuda ya pagada al prestamista. */
  paid: number;
  /** Segundos que lleva el día de hoy (el reloj se para con el juego cerrado). */
  clock?: number;
  /** Lo que la caja de hoy ya ha entregado durante el día. */
  till?: number;
  /** Raciones en la cocina y la despensa, y jarras en la bodega. */
  food: number;
  beer: number;
  /** Lo que hizo cada sala anoche (para enseñarlo flotando al amanecer). */
  yields?: RoomYield[];
  /** Las salas y el patio. */
  building: Building;
  /** Nivel de cada instalación de antes, sacado del edificio (ver core/rooms.ts). */
  fac: Facilities;
  heroes: Hero[];
  candidates: Hero[];
  /** Trabajadores de la casa y gente que ha venido a pedir trabajo. */
  workers: Worker[];
  seekers: Worker[];
  quests: Quest[];
  missions: Mission[];
  reports: Report[];
  inventory: Item[];
  trophies: Trophy[];
  fallen: Fallen[];
  /** Resumen del último amanecer (vacío el primer día). */
  dawn: DawnEvent[];
  flavor: string;
  over: GameOver;
  /** Notas del tutorial ya leídas ('*' = sin consejos). */
  tips?: string[];
  /** «La deuda» (30 días) o modo libre tras pagarla. */
  mode?: 'deuda' | 'libre';
  /** Resumen de la llegada a la apertura; se enseña una vez al pagar la deuda. */
  opening?: Arrival & { seen: boolean };
  stats?: Stats;
  /** Hazañas: cuántos niveles se han cobrado de cada una. */
  feats?: Record<string, number>;
  /** Objetivos siempre activos (sustituyen a los desafíos del mes). */
  goals?: Goals;
  /** Cosas que se ven ganadas con hazañas y objetivos (las de serie no se apuntan). */
  unlocks?: UnlockId[];
  /** Días de pago seguidos sin poder pagar los salarios (modo libre). */
  unpaid?: number;
  /** Asalto en camino (si `warned`, el jugador lo sabe). */
  raid?: Raid | null;
  /** Sin asaltos hasta este día (tras repeler uno, se corre la voz). */
  truce?: number;
  /** Cómo es la taberna: nombre, escudo, decoración, personal y mascota. */
  custom?: Custom;
  /** Amenaza regional (0–100): crece si se ignoran o fallan las historias. */
  threat?: number;
  /** Suceso de la taberna esperando una decisión. */
  event?: PendingEvent | null;
  /** Lo que pasó con la última decisión (para avisar). */
  lastChoice?: string | null;
  /** Cadenas de misiones empezadas. */
  chains?: ChainState[];
  /** El último grupo que salió de misión («Como la última vez» en la hoja del encargo). */
  lastParty?: string[];
  /** Lugares de la comarca ya visitados (levantan la niebla del mapa). */
  explored?: string[];
  /** Día en que un espía de los bandidos estudió la casa (más riesgo de asalto unos días). */
  scout?: number;
  /** Oro que no cabía en la cámara y se ha perdido desde el último amanecer. */
  spilt?: number;
  /** Último asalto, para verlo en la escena al amanecer. */
  lastRaid?: RaidResult | null;
  /** Informe de la pelea contra un jefe de esta noche (para el aviso del amanecer). */
  lastFight?: string | null;
  /** Incidentes en marcha (uno a la vez). */
  incidents?: Incident[];
  /** Tutorial guiado (fase 2a): sin él, no hay (partidas viejas o saltado). */
  tutorial?: Tutorial;
  /** Rumor que se oye ahora en la barra (solo con el juego abierto). */
  rumor?: Rumor;
  /** Lo último que ha pasado con los incidentes, para el aviso de la interfaz (de paso). */
  incidentNews?: { t: string; k: ChipKind }[];
  /** Rango más alto ya anunciado (para avisar al subir; ver `core/ranks.ts`). */
  rankSeen?: number;
  /** Hora real (ms) de la última vez que se guardó con el juego abierto (tiempo que corre solo). */
  lastSeen?: number;
}
