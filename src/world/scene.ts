import type { Material } from '../core/materials';
import type { HeroLook, HeroMarks } from '../art/heroes/look';
import type { Building, Duel, IncidentEnd, ItemIcon, Rarity, TrophyIcon } from '../core/model';
import type { FacadeLook, GardenLook, TintId } from '../data/custom';
import type { IncidentKind } from '../data/incidents';
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
  /** De guardia en la cámara del tesoro: patrulla dentro, día y noche. */
  vault?: boolean;
  /** El dormitorio (o cuarto del servicio) en el que duerme (id), según `core/beds.ts`. */
  dorm?: string;
  /** Sala en la que trabaja de día (id). */
  work?: string;
  /** Va corriendo a esta sala (id) a arreglar algo (un incidente); manda sobre `work`. */
  goTo?: string;
  /** Puede ir al incidente que espera a que se arrastre a alguien: se le resalta la silueta. */
  callout?: boolean;
  /**
   * El núcleo aún espera que llegue a su sala de trabajo (no cuenta hasta entonces): la escena
   * avisa al verle en ella (`onArrive`), y repite el aviso mientras siga esperándole.
   */
  due?: boolean;
  /** Trabajador: duerme en el dormitorio del servicio o se va a dormir al pueblo. */
  staff?: 'casa' | 'pueblo';
  /** Visitante del salón: entra, se sienta un rato y se va. */
  visitor?: boolean;
  /** Bandido de un asalto (solo de noche, mientras dura). */
  bandit?: boolean;
  /**
   * Entrenando: cómo va la barra al empezar el día (0–1) y cuánto sube en un día entero. Con
   * `max`, ya no aprende más ahí (tope de la sala o de su nivel): barra llena y una marca.
   */
  train?: { at: number; perDay: number; max?: boolean };
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
  /** El cuervo mensajero, posado en el rótulo. */
  raven?: boolean;
  /** Decoración del salón, adornos de la fachada y visitantes de hoy. */
  decor: string[];
  facade?: string[];
  /** Tejado, paredes, rótulo y jardineras de la fachada. */
  look?: FacadeLook;
  /** El jardín de entre el edificio y el anexo (si lo hay: `building.wing`). */
  garden?: GardenLook;
  /** Tema de color de las telas de cada sala (por id). */
  tints?: Record<string, TintId>;
  visitors?: SceneVisitors;
  /** Equipo sin dueño (armería o arcones) y trofeos del salón. */
  gear: GearView[];
  /** Lo llena que está la cámara del tesoro, de 0 a 1 (el oro que se ve en ella). */
  vault?: number;
  /** Los materiales: lo lleno de cada uno (0–1 de su tope, solo los que caben) y si hay almacén. */
  mats?: { fill: Partial<Record<Material, number>>; store: boolean };
  trophies: TrophyIcon[];
  heroes: SceneHero[];
  /** Los incidentes en marcha: se ven en su sala mientras duran (solo dibujo). */
  incidents?: SceneIncident[];
  /** El día y el reloj (segundos): si un incidente se va con el reloj en su `until`, salió mal. */
  clock?: { day: number; secs: number };
  /** La semilla de la partida: de ella sale el tiempo que hace (ver `weather.ts`). */
  seed?: string;
  /**
   * Lo que se está creando o desmontando en los talleres (solo dibujo; cambia en cada tick, así
   * que no va en la clave que rehace la escena).
   */
  crafts?: SceneCraft[];
  /**
   * Cómo acabaron los últimos trabajos (por `id`): cuando uno sale de `crafts`, aquí está si se
   * hizo (y de qué rareza salió), si se sacó la receta al desmontar, si se vistió al héroe o si
   * se canceló. Se guardan los últimos ocho.
   */
  craftEnds?: SceneCraftEnd[];
  /** Cómo acabaron los últimos incidentes: bien, mal, el de guardia le paró o se le coló. */
  incidentEnds?: readonly IncidentEnd[];
  /**
   * Las salas que se están pintando (solo dibujo; cambia en cada tick, así que no va entero en la
   * clave que rehace la escena: solo la sala y el color).
   */
  paints?: ScenePaint[];
}

/** Una sala que se está pintando, tal como la ve la escena. */
export interface ScenePaint {
  id: string;
  /** La sala que se pinta y el pintor (un trabajador) que está en ella. */
  room: string;
  painter: string;
  /** El color nuevo (null: los de la casa). */
  tint: TintId | null;
  /** Lo que lleva, de 0 a 1: hasta ahí, la pared ya es del color nuevo (por franjas). */
  frac: number;
  /** Aún no ha empezado: el pintor va de camino (la sala no cambia). */
  walking: boolean;
}

/** Cómo acabó un trabajo de taller. */
export interface SceneCraftEnd {
  id: string;
  room: string;
  how: 'hecho' | 'receta' | 'nada' | 'vestido' | 'templado' | 'cancelado';
  /** Con `hecho`: 0 normal, 1 de las buenas. */
  rarity?: Rarity;
}

/** Un trabajo de taller tal como lo ve la escena. */
export interface SceneCraft {
  /** Para saber, cuando desaparece, cómo acabó (`SceneModel.craftEnds`). */
  id: string;
  /** El taller (id de sala). */
  room: string;
  /** Lo que sale (o lo que se desmonta). */
  icon: ItemIcon;
  rarity: Rarity;
  /** Lo que lleva, de 0 a 1. */
  frac: number;
  /** Parado: no hay nadie trabajando en la sala. */
  stalled: boolean;
  /** Desmontando un objeto (no creando). */
  undo: boolean;
  /** Vistiendo a un héroe (id): está en la sala mientras dura. */
  hero?: string;
  /** Aún no se cose: el héroe va de camino a la sala (el sastre le espera). */
  walking?: boolean;
}

/** Un incidente tal como lo ve la escena: qué pasa y en qué sala (id). */
export interface SceneIncident {
  /** Para saber, cuando desaparece, cómo acabó (`SceneModel.incidentEnds`). */
  id?: string;
  kind: IncidentKind;
  room: string;
  /** Los de tocar (las ratas): toques que faltan. */
  taps?: number;
  /** Segundo del día en que sale mal si nadie hace nada. */
  until?: number;
  /** La pelea con el ladrón, golpe a golpe (segundos del reloj desde `at`). */
  duel?: Duel;
}

/** Equipo sin dueño, con su rareza (se cuelga en la armería o va en arcones). */
export interface GearView {
  icon: ItemIcon;
  rarity: Rarity;
  /** Mejoras del taller (+1 a +3): sus galones en el icono. */
  plus?: number;
}

export type SoundName =
  | 'click'
  | 'purr'
  | 'bark'
  | 'caw'
  | 'hoot'
  | 'sparks'
  | 'lute'
  | 'splash'
  | 'creak'
  /** Las cadenas del rótulo, al darle un golpe. */
  | 'chain'
  | 'squeak'
  | 'bats'
  | 'build'
  | 'hammer'
  /** El siseo del temple: la pieza al rojo dentro del agua. */
  | 'hiss'
  /** La pieza acabada brilla en el yunque. */
  | 'coin'
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
  /** Alguien ha llegado andando a la sala de su tarea (la sastrería empieza a coser). */
  onArrive?(id: string, room: string): void;
  /** Modo obras: se empieza a arrastrar la sala elegida (para moverla) y se suelta fuera de sitio. */
  onRoomDrag?(id: string): void;
  onRoomDrop?(): void;
  onSound?(name: SoundName, volume?: number): void;
  onFrame?(listener: Point): void;
  /**
   * El tiempo que hace, unas veces por segundo (para el sonido): lluvia, viento y tormenta de 0
   * a 1, y cuánto de lo que se ve es fuera (0: mirando dentro de las salas).
   */
  onWeather?(w: { rain: number; wind: number; storm: number; outside: number }): void;
  /** Un relámpago: el trueno, dentro de `delay` segundos, con fuerza `power` (0–1). */
  onThunder?(delay: number, power: number): void;
  /** Entra o sale la cámara lenta (arrastrando a alguien en el asalto en directo). */
  onSlow?(on: boolean): void;
}
