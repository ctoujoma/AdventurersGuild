/**
 * Las salas del gremio: cómo se llaman, cuánto pueden crecer y dónde pueden ir. Los costes
 * están en core/balance.ts (ROOM_COST) y las reglas de obra en core/rooms.ts.
 */
import type { Facilities } from '../core/model';
import type { AttrId } from '../core/party';
import { t } from '../textos';

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
  | 'biblioteca'
  | 'sastreria'
  | 'alquimia'
  | 'pintor'
  | 'almacen';

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
    name: t('salas.salas.recibidor.nombre'),
    desc: t('salas.salas.recibidor.desc'),
    maxW: 1,
    maxH: 1,
    place: 'baja',
    unique: true,
    keep: true,
    fixed: true,
  },
  salon: {
    name: t('salas.salas.salon.nombre'),
    desc: t('salas.salas.salon.desc'),
    maxW: 3,
    maxH: 2,
    place: 'baja',
    unique: true,
    keep: true,
    fac: 'tab',
    base: 2,
  },
  cocina: {
    name: t('salas.salas.cocina.nombre'),
    desc: t('salas.salas.cocina.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  bodega: {
    name: t('salas.salas.bodega.nombre'),
    desc: t('salas.salas.bodega.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  tesoro: {
    name: t('salas.salas.tesoro.nombre'),
    desc: t('salas.salas.tesoro.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    keep: true,
  },
  dormitorio: {
    name: t('salas.salas.dormitorio.nombre'),
    desc: t('salas.salas.dormitorio.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    fac: 'dorm',
    base: 2,
  },
  enfermeria: {
    name: t('salas.salas.enfermeria.nombre'),
    desc: t('salas.salas.enfermeria.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'enf',
  },
  capilla: {
    name: t('salas.salas.capilla.nombre'),
    desc: t('salas.salas.capilla.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'cap',
  },
  mapas: {
    name: t('salas.salas.mapas.nombre'),
    desc: t('salas.salas.mapas.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'mapas',
  },
  armeria: {
    name: t('salas.salas.armeria.nombre'),
    desc: t('salas.salas.armeria.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'arm',
  },
  forja: {
    name: t('salas.salas.forja.nombre'),
    desc: t('salas.salas.forja.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'forja',
  },
  veteranos: {
    name: t('salas.salas.veteranos.nombre'),
    desc: t('salas.salas.veteranos.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
    fac: 'vet',
  },
  torre: {
    name: t('salas.salas.torre.nombre'),
    desc: t('salas.salas.torre.desc'),
    maxW: 1,
    maxH: 1,
    place: 'tejado',
    unique: true,
    fac: 'torre',
  },
  servicio: {
    name: t('salas.salas.servicio.nombre'),
    desc: t('salas.salas.servicio.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  despensa: {
    name: t('salas.salas.despensa.nombre'),
    desc: t('salas.salas.despensa.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  armas: {
    name: t('salas.salas.armas.nombre'),
    desc: t('salas.salas.armas.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  tiro: {
    name: t('salas.salas.tiro.nombre'),
    desc: t('salas.salas.tiro.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  biblioteca: {
    name: t('salas.salas.biblioteca.nombre'),
    desc: t('salas.salas.biblioteca.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
  },
  sastreria: {
    name: t('salas.salas.sastreria.nombre'),
    desc: t('salas.salas.sastreria.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
  },
  alquimia: {
    name: t('salas.salas.alquimia.nombre'),
    desc: t('salas.salas.alquimia.desc'),
    maxW: 3,
    maxH: 1,
    place: 'libre',
    unique: true,
  },
  pintor: {
    name: t('salas.salas.pintor.nombre'),
    desc: t('salas.salas.pintor.desc'),
    maxW: 2,
    maxH: 1,
    place: 'libre',
    unique: true,
  },
  almacen: {
    name: t('salas.salas.almacen.nombre'),
    desc: t('salas.salas.almacen.desc'),
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
