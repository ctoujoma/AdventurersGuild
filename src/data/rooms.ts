/**
 * Las salas del gremio: cómo se llaman, cuánto pueden crecer y dónde pueden ir. Los costes
 * están en core/balance.ts (ROOM_COST) y las reglas de obra en core/rooms.ts.
 */
import type { Facilities } from '../core/model';

export type RoomType =
  | 'recibidor'
  | 'salon'
  | 'cocina'
  | 'bodega'
  | 'tesoro'
  | 'dormitorio'
  | 'enfermeria'
  | 'capilla'
  | 'mapas'
  | 'armeria'
  | 'forja'
  | 'veteranos'
  | 'torre'
  | 'servicio'
  | 'despensa'
  | 'armas'
  | 'tiro'
  | 'biblioteca';

/** Dónde puede ir: en la planta baja, encima de otra sala (la torre) o en cualquier planta. */
export type RoomPlace = 'baja' | 'tejado' | 'libre';

export interface RoomDef {
  name: string;
  /** Huecos de ancho como máximo, ampliándola. */
  maxW: number;
  /** Plantas de alto como máximo: solo el salón llega a 2. */
  maxH: number;
  place: RoomPlace;
  /** Solo puede haber una. */
  unique?: boolean;
  /** No se puede destruir (sí mover). */
  keep?: boolean;
  /** Tampoco se puede mover. */
  fixed?: boolean;
  /** Instalación de antes a la que sustituye: su nivel es el de esta sala. */
  fac?: keyof Facilities;
  /** Huecos con los que se cuenta el coste de mejora sin recargo (las que empiezan anchas). */
  base?: number;
}

export const ROOMS: Record<RoomType, RoomDef> = {
  recibidor: {
    name: 'Recibidor',
    maxW: 1,
    maxH: 1,
    place: 'baja',
    unique: true,
    keep: true,
    fixed: true,
  },
  salon: {
    name: 'Salón',
    maxW: 3,
    maxH: 2,
    place: 'baja',
    unique: true,
    keep: true,
    fac: 'tab',
    base: 2,
  },
  cocina: { name: 'Cocina', maxW: 3, maxH: 1, place: 'libre' },
  bodega: { name: 'Bodega', maxW: 3, maxH: 1, place: 'libre' },
  tesoro: { name: 'Cámara del tesoro', maxW: 3, maxH: 1, place: 'libre', unique: true, keep: true },
  dormitorio: { name: 'Dormitorio', maxW: 3, maxH: 1, place: 'libre', fac: 'dorm', base: 2 },
  enfermeria: { name: 'Enfermería', maxW: 3, maxH: 1, place: 'libre', unique: true, fac: 'enf' },
  capilla: { name: 'Capilla', maxW: 3, maxH: 1, place: 'libre', unique: true, fac: 'cap' },
  mapas: { name: 'Sala de mapas', maxW: 3, maxH: 1, place: 'libre', unique: true, fac: 'mapas' },
  armeria: { name: 'Armería', maxW: 3, maxH: 1, place: 'libre', unique: true, fac: 'arm' },
  forja: { name: 'Forja', maxW: 3, maxH: 1, place: 'libre', unique: true, fac: 'forja' },
  veteranos: {
    name: 'Cuartos de veteranos',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'vet',
  },
  torre: { name: 'Torre del vigía', maxW: 1, maxH: 1, place: 'tejado', unique: true, fac: 'torre' },
  servicio: { name: 'Dormitorio del servicio', maxW: 3, maxH: 1, place: 'libre' },
  despensa: { name: 'Despensa', maxW: 3, maxH: 1, place: 'libre' },
  armas: { name: 'Sala de armas', maxW: 3, maxH: 1, place: 'libre' },
  tiro: { name: 'Galería de tiro', maxW: 3, maxH: 1, place: 'libre' },
  biblioteca: { name: 'Biblioteca', maxW: 3, maxH: 1, place: 'libre' },
};

/** Instalaciones que no son salas: van en el patio, delante de la taberna. */
export type YardKey = 'establo' | 'patio' | 'empal';
export const YARD: readonly YardKey[] = ['establo', 'patio', 'empal'];
