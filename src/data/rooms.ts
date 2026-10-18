/**
 * Las salas del gremio: cómo se llaman, cuánto pueden crecer y dónde pueden ir. Los costes
 * están en core/balance.ts (ROOM_COST) y las reglas de obra en core/rooms.ts.
 */
import type { Facilities } from '../core/model';
import type { AttrId } from '../core/party';

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
  /** Para qué sirve, en una línea (las que sustituyen a una instalación usan su ficha de siempre). */
  desc: string;
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
    desc: 'La entrada desde el patio. Aquí se ponen los héroes de guardia.',
    maxW: 1,
    maxH: 1,
    place: 'baja',
    unique: true,
    keep: true,
    fixed: true,
  },
  salon: {
    name: 'Salón',
    desc: 'El corazón de la taberna: aquí comen, beben y pagan los que vienen.',
    maxW: 3,
    maxH: 2,
    place: 'baja',
    unique: true,
    keep: true,
    fac: 'tab',
    base: 2,
  },
  cocina: {
    name: 'Cocina',
    desc: 'Hace la comida para los visitantes y para los nuestros.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  bodega: {
    name: 'Bodega',
    desc: 'Hace y guarda la cerveza. Bajo tierra sale mejor.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  tesoro: {
    name: 'Cámara del tesoro',
    desc: 'Guarda el oro del gremio. Es lo que buscan los bandidos.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    keep: true,
  },
  dormitorio: {
    name: 'Dormitorio',
    desc: 'Camas para los héroes.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    fac: 'dorm',
    base: 2,
  },
  enfermeria: {
    name: 'Enfermería',
    desc: 'Los heridos se curan antes.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'enf',
  },
  capilla: {
    name: 'Capilla',
    desc: 'Moral para todos y una vela por cada caído.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'cap',
  },
  mapas: {
    name: 'Sala de mapas',
    desc: 'Más encargos en el tablón y, con nivel, el peligro real.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'mapas',
  },
  armeria: {
    name: 'Armería',
    desc: 'Equipo para todos los que salen de misión.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'arm',
  },
  forja: {
    name: 'Forja',
    desc: 'Mejora el objeto que lleva cada héroe.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'forja',
  },
  veteranos: {
    name: 'Cuartos de veteranos',
    desc: 'Cuartos para los héroes de nivel alto.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'vet',
  },
  torre: {
    name: 'Torre del vigía',
    desc: 'Avisa de los asaltos que vienen.',
    maxW: 1,
    maxH: 1,
    place: 'tejado',
    unique: true,
    fac: 'torre',
  },
  servicio: {
    name: 'Dormitorio del servicio',
    desc: 'Camas para los trabajadores.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  despensa: { name: 'Despensa', desc: 'Guarda la comida.', maxW: 3, maxH: 1, place: 'libre' },
  armas: { name: 'Sala de armas', desc: 'Se entrena la Fuerza.', maxW: 3, maxH: 1, place: 'libre' },
  tiro: {
    name: 'Galería de tiro',
    desc: 'Se entrena la Destreza.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  biblioteca: {
    name: 'Biblioteca',
    desc: 'Se entrena la Mente.',
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
};

/** Salas de entrenamiento y el atributo que se entrena en cada una. */
export const TRAINS: Partial<Record<RoomType, AttrId>> = { armas: 'F', tiro: 'D', biblioteca: 'M' };

/** Instalaciones que no son salas: van en el patio, delante de la taberna. */
export type YardKey = 'establo' | 'patio' | 'empal';
export const YARD: readonly YardKey[] = ['establo', 'patio', 'empal'];
