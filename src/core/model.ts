/**
 * Modelo de la partida. Todo es JSON serializable: guardar es `JSON.stringify(state)`.
 * El núcleo no conoce el DOM ni el arte; el aspecto de cada héroe sale de su `seed`.
 */
import type { Attrs, Challenge, ClassId, Trait } from './party';

export const SAVE_VERSION = 1;

export type Sex = 'm' | 'f';

export type HeroStatus = 'ok' | 'mision' | 'herido' | 'desaparecido' | 'muerto';

export interface Hero {
  id: string;
  /** Semilla del aspecto (retrato y sprite). */
  seed: string;
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
  /** Petición pendiente: un héroe desanimado pide aumento. */
  request?: 'raise';
}

export type QuestType = 'Cazar' | 'Escoltar' | 'Explorar' | 'Recuperar' | 'Investigar' | 'Limpiar';
export type Danger = 0 | 1 | 2 | 3;

export interface Item {
  id: string;
  name: string;
  desc: string;
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
}

export interface Fallen {
  name: string;
  epitaph: string;
}

export interface Facilities {
  dorm: number;
  enf: number;
  tab: number;
}

/** Lo que pasó al terminar un día: se enseña en la transición del amanecer. */
export interface DawnEvent {
  t: string;
  k?: ChipKind;
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
  fac: Facilities;
  heroes: Hero[];
  candidates: Hero[];
  quests: Quest[];
  missions: Mission[];
  reports: Report[];
  inventory: Item[];
  fallen: Fallen[];
  /** Resumen del último amanecer (vacío el primer día). */
  dawn: DawnEvent[];
  flavor: string;
  over: GameOver;
}
