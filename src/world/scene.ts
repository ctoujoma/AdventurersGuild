import type { HeroLook, HeroMarks } from '../art/heroes/look';
import type { Building, ItemIcon, Rarity, TrophyIcon } from '../core/model';
import type { FacadeLook, TintId } from '../data/custom';
import type { BattleSound } from './battle';

/**
 * Lo que la escena de salas recibe del juego (`SceneModel`, armado en `ui/view.ts`), lo que
 * avisa a la interfaz (`SceneCallbacks`) y los sonidos que pide.
 */

export type HeroStatus = 'ok' | 'herido' | 'mision' | 'candidato';

export interface SceneHero {
  id: string;
  name: string;
  /** Lo que se lee debajo del nombre al pasar el ratón (clase y nivel, oficio…). */
  title?: string;
  status: HeroStatus;
  look: HeroLook;
  marks: HeroMarks;
  /** De guardia en el recibidor (la vista de salas lo enseña). */
  guard?: boolean;
  /** Sala en la que trabaja de día (id). */
  work?: string;
  /** Trabajador: duerme en el dormitorio del servicio o se va a dormir al pueblo. */
  staff?: 'casa' | 'pueblo';
  /** Visitante del salón: entra, se sienta un rato y se va. */
  visitor?: boolean;
  /** Bandido de un asalto (solo de noche, mientras dura). */
  bandit?: boolean;
  /** Entrenando: cómo va la barra al empezar el día (0–1) y cuánto sube en un día entero. */
  train?: { at: number; perDay: number };
}

/** Los visitantes de hoy, en orden de llegada (la escena los hace entrar a lo largo del día). */
export interface SceneVisitors {
  day: number;
  kinds: string[];
}

export interface SceneModel {
  /** El edificio por salas. */
  building: Building;
  /** Escudo del gremio (letrero y tapices) y perro guardián. */
  crest: { field: string; dark: string; symbol: string };
  dog: boolean;
  /** Decoración del salón, adornos de la fachada y visitantes de hoy. */
  decor: string[];
  facade?: string[];
  /** Tejado, paredes, rótulo y jardineras de la fachada. */
  look?: FacadeLook;
  /** Tema de color de las telas de cada sala (por id). */
  tints?: Record<string, TintId>;
  visitors?: SceneVisitors;
  /** Equipo sin dueño (armería o arcones) y trofeos del salón. */
  gear: GearView[];
  /** Lo llena que está la cámara del tesoro, de 0 a 1 (el oro que se ve en ella). */
  vault?: number;
  trophies: TrophyIcon[];
  heroes: SceneHero[];
}

/** Equipo sin dueño, con su rareza (se cuelga en la armería o va en arcones). */
export interface GearView {
  icon: ItemIcon;
  rarity: Rarity;
}

export type SoundName =
  | 'click'
  | 'purr'
  | 'bark'
  | 'hoot'
  | 'sparks'
  | 'lute'
  | 'splash'
  | 'creak'
  | 'squeak'
  | 'bats'
  | 'build'
  | 'hammer'
  | 'drip'
  | 'cheer'
  | BattleSound;

export interface Point {
  x: number;
  y: number;
  /** Punto del mundo (para anclar bocadillos a lo que se ha tocado). */
  wx?: number;
  wy?: number;
}

export interface SceneCallbacks {
  onHotspot?(id: string, label: string, at: Point): void;
  onHero?(id: string, at: Point): void;
  onHover?(label: string | null, at: Point | null): void;
  /** Arrastrar a alguien a una sala: si se le puede coger, qué pasaría al soltarlo ahí y soltarlo. */
  canDrag?(id: string): boolean;
  onDragOver?(id: string, room: string | null, at: Point): { ok: boolean } | null;
  /** Al soltar: la sala (si vale) o null si se suelta en un sitio que no sirve. */
  onDrop?(id: string, room: string | null): void;
  /** Modo obras: se empieza a arrastrar la sala elegida (para moverla) y se suelta fuera de sitio. */
  onRoomDrag?(id: string): void;
  onRoomDrop?(): void;
  onSound?(name: SoundName, volume?: number): void;
  onFrame?(listener: Point): void;
}
