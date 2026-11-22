/**
 * Personalización de la taberna: escudo, decoración, fachada, personal y mascota. Los efectos
 * son pequeños; lo importante es que la taberna se parezca a quien la lleva.
 */

import { P } from '../art/palette';
import type { RoomType } from './rooms';
import { t, tl } from '../textos';

export type CrestColor = 'vino' | 'mar' | 'bosque' | 'oro' | 'noche';
export type CrestSymbol = 'jarra' | 'espada' | 'llave' | 'estrella' | 'dragon' | 'luna';
export type StaffId = 'cocinera' | 'bardo' | 'mozo';

export const DEFAULT_NAME = t('personalizar.nombre_inicial');

export const CREST_COLORS: Record<CrestColor, { name: string; field: string; dark: string }> = {
  vino: {
    name: t('personalizar.escudo_colores.vino.nombre'),
    field: t('personalizar.escudo_colores.vino.field'),
    dark: t('personalizar.escudo_colores.vino.dark'),
  },
  mar: {
    name: t('personalizar.escudo_colores.mar.nombre'),
    field: t('personalizar.escudo_colores.mar.field'),
    dark: t('personalizar.escudo_colores.mar.dark'),
  },
  bosque: {
    name: t('personalizar.escudo_colores.bosque.nombre'),
    field: t('personalizar.escudo_colores.bosque.field'),
    dark: t('personalizar.escudo_colores.bosque.dark'),
  },
  oro: {
    name: t('personalizar.escudo_colores.oro.nombre'),
    field: t('personalizar.escudo_colores.oro.field'),
    dark: t('personalizar.escudo_colores.oro.dark'),
  },
  noche: {
    name: t('personalizar.escudo_colores.noche.nombre'),
    field: t('personalizar.escudo_colores.noche.field'),
    dark: t('personalizar.escudo_colores.noche.dark'),
  },
};

/**
 * Temas de color de las telas de una sala (mantas, alfombras, cojines, paños y paredes
 * enteladas): cuatro tonos de la paleta, de la sombra a la luz. Sin tema, cada sala lleva los
 * suyos de siempre («de la casa»). Solo se ven: no dan ninguna ventaja.
 */
export type TintId = 'vino' | 'mar' | 'bosque' | 'ocre' | 'morado' | 'ceniza' | 'lino';

export const TINTS: Record<
  TintId,
  { name: string; ramp: readonly [string, string, string, string] }
> = {
  vino: { name: t('personalizar.tintes.vino.nombre'), ramp: [P.plum, P.wine, P.red, P.coral] },
  mar: { name: t('personalizar.tintes.mar.nombre'), ramp: [P.navy, P.ocean, P.sky, P.mist] },
  bosque: {
    name: t('personalizar.tintes.bosque.nombre'),
    ramp: [P.deep, P.forest, P.leaf, P.lime],
  },
  ocre: { name: t('personalizar.tintes.ocre.nombre'), ramp: [P.plum, P.rust, P.amber, P.gold] },
  morado: {
    name: t('personalizar.tintes.morado.nombre'),
    ramp: [P.plum, P.grape, P.rose, P.coral],
  },
  ceniza: { name: t('personalizar.tintes.ceniza.nombre'), ramp: [P.navy, P.slate, P.steel, P.fog] },
  lino: { name: t('personalizar.tintes.lino.nombre'), ramp: [P.rust, P.clay, P.tan, P.sand] },
};
export const TINT_IDS = Object.keys(TINTS) as TintId[];

/** Desde qué nivel lleva telas cada sala (las que no salen aquí no tienen tema de color). */
export const TINT_FROM: Partial<Record<RoomType, number>> = {
  salon: 1,
  recibidor: 2,
  dormitorio: 1,
  veteranos: 1,
  servicio: 2,
  enfermeria: 1,
  capilla: 1,
  biblioteca: 2,
  armas: 2,
};

export const CREST_SYMBOLS: Record<CrestSymbol, string> = {
  jarra: t('personalizar.escudo_simbolos.jarra'),
  espada: t('personalizar.escudo_simbolos.espada'),
  llave: t('personalizar.escudo_simbolos.llave'),
  estrella: t('personalizar.escudo_simbolos.estrella'),
  dragon: t('personalizar.escudo_simbolos.dragon'),
  luna: t('personalizar.escudo_simbolos.luna'),
};

export type DecorId = 'naipes' | 'tarima' | 'tapices' | 'barril' | 'lampara' | 'chimenea';

/**
 * Decoración del salón: huecos limitados, cada pieza con su Atractivo (trae visitantes) y a
 * veces un efecto pequeño con su pega.
 */
export const DECOR: Record<DecorId, { name: string; desc: string; price: number; appeal: number }> =
  {
    naipes: {
      name: t('personalizar.adornos.naipes.nombre'),
      desc: t('personalizar.adornos.naipes.desc'),
      price: 50,
      appeal: 1,
    },
    tarima: {
      name: t('personalizar.adornos.tarima.nombre'),
      desc: t('personalizar.adornos.tarima.desc'),
      price: 60,
      appeal: 1,
    },
    tapices: {
      name: t('personalizar.adornos.tapices.nombre'),
      desc: t('personalizar.adornos.tapices.desc'),
      price: 45,
      appeal: 2,
    },
    barril: {
      name: t('personalizar.adornos.barril.nombre'),
      desc: t('personalizar.adornos.barril.desc'),
      price: 35,
      appeal: 1,
    },
    lampara: {
      name: t('personalizar.adornos.lampara.nombre'),
      desc: t('personalizar.adornos.lampara.desc'),
      price: 70,
      appeal: 3,
    },
    chimenea: {
      name: t('personalizar.adornos.chimenea.nombre'),
      desc: t('personalizar.adornos.chimenea.desc'),
      price: 90,
      appeal: 3,
    },
  };
/** Huecos de decoración: dos con el salón a nivel 1 y uno más por cada nivel. */
export const decorSlots = (tab: number) => Math.max(2, tab + 1);

/** La fachada: lo que se ve desde el camino y atrae gente antes de entrar. */
export type FacadeId = 'flores' | 'faroles' | 'banderines' | 'letrero';
export const FACADE: Record<
  FacadeId,
  { name: string; desc: string; price: number; appeal: number }
> = {
  flores: {
    name: t('personalizar.fachada.flores.nombre'),
    desc: t('personalizar.fachada.flores.desc'),
    price: 30,
    appeal: 1,
  },
  faroles: {
    name: t('personalizar.fachada.faroles.nombre'),
    desc: t('personalizar.fachada.faroles.desc'),
    price: 50,
    appeal: 2,
  },
  banderines: {
    name: t('personalizar.fachada.banderines.nombre'),
    desc: t('personalizar.fachada.banderines.desc'),
    price: 40,
    appeal: 1,
  },
  letrero: {
    name: t('personalizar.fachada.letrero.nombre'),
    desc: t('personalizar.fachada.letrero.desc'),
    price: 80,
    appeal: 3,
  },
};
/**
 * El aspecto de la fachada por partes (solo se ve; los adornos que atraen gente son `FACADE`).
 * Sin elegir, lo de siempre: teja roja, tablas y el tablero colgado.
 */
export type RoofId = 'teja' | 'pizarra' | 'paja' | 'verde' | 'tablilla';
export type WallId =
  'tablas' | 'entramado' | 'piedra' | 'troncos' | 'ladrillo' | 'tapial' | 'pizarra' | 'encalado';
export type SignId = 'tablero' | 'hierro' | 'pintado';

export interface FacadeLook {
  roof?: RoofId;
  walls?: WallId;
  sign?: SignId;
  /** Jardineras con flores bajo los ventanucos de los hastiales. */
  boxes?: boolean;
}

export const ROOFS: Record<RoofId, string> = {
  teja: t('personalizar.tejados.teja'),
  pizarra: t('personalizar.tejados.pizarra'),
  paja: t('personalizar.tejados.paja'),
  verde: t('personalizar.tejados.verde'),
  tablilla: t('personalizar.tejados.tablilla'),
};
export const WALLS: Record<WallId, string> = {
  tablas: t('personalizar.paredes.tablas'),
  entramado: t('personalizar.paredes.entramado'),
  piedra: t('personalizar.paredes.piedra'),
  troncos: t('personalizar.paredes.troncos'),
  ladrillo: t('personalizar.paredes.ladrillo'),
  tapial: t('personalizar.paredes.tapial'),
  pizarra: t('personalizar.paredes.pizarra'),
  encalado: t('personalizar.paredes.encalado'),
};
export const SIGNS: Record<SignId, string> = {
  tablero: t('personalizar.rotulos.tablero'),
  hierro: t('personalizar.rotulos.hierro'),
  pintado: t('personalizar.rotulos.pintado'),
};

/**
 * El jardín de entre el edificio y el anexo (al comprar el patio trasero). Solo se ve: el
 * suelo, una pieza en cada hueco del jardín (de izquierda a derecha, `GARDEN_W` como mucho),
 * el borde de delante, faroles y, con `cloister`, soportales con arcos pegados a las dos
 * fachadas que dan al jardín (el claustro). Sin elegir, hierba y nada más.
 */
export type GardenGroundId = 'hierba' | 'grava' | 'losas';
export type GardenPieceId = 'fuente' | 'pozo' | 'arbol' | 'estatua' | 'banco' | 'huerto' | 'flores';
export type GardenEdgeId = 'seto' | 'flores' | 'verja';

export interface GardenLook {
  ground?: GardenGroundId;
  /** Lo que hay en cada hueco del jardín, de izquierda a derecha (null: nada). */
  slots?: (GardenPieceId | null)[];
  edge?: GardenEdgeId;
  lamps?: boolean;
  /**
   * El claustro: `true`, entero (partidas de antes); o por partes, las plantas hechas de cada
   * lado desde la baja (`edificio`, `anexo`; 0 o sin poner, ese lado nada).
   */
  cloister?: boolean | CloisterLook;
}

export interface CloisterLook {
  edificio?: number;
  anexo?: number;
}

export const GARDEN_GROUNDS: Record<GardenGroundId, string> = {
  hierba: t('personalizar.jardin_suelos.hierba'),
  grava: t('personalizar.jardin_suelos.grava'),
  losas: t('personalizar.jardin_suelos.losas'),
};
export const GARDEN_PIECES: Record<GardenPieceId, string> = {
  fuente: t('personalizar.jardin_piezas.fuente'),
  pozo: t('personalizar.jardin_piezas.pozo'),
  arbol: t('personalizar.jardin_piezas.arbol'),
  estatua: t('personalizar.jardin_piezas.estatua'),
  banco: t('personalizar.jardin_piezas.banco'),
  huerto: t('personalizar.jardin_piezas.huerto'),
  flores: t('personalizar.jardin_piezas.flores'),
};
export const GARDEN_EDGES: Record<GardenEdgeId, string> = {
  seto: t('personalizar.jardin_bordes.seto'),
  flores: t('personalizar.jardin_bordes.flores'),
  verja: t('personalizar.jardin_bordes.verja'),
};

/**
 * La sastrería (preparada; la sala vendrá después): un tinte para la ropa del héroe (los temas
 * de `TINTS`) y una prenda encima del traje. Solo se ve.
 */
export type GarmentId = 'capa' | 'tabardo' | 'faja' | 'bufanda';
export const GARMENTS: Record<GarmentId, { name: string; tint: TintId }> = {
  capa: { name: t('personalizar.prendas.capa.nombre'), tint: 'vino' },
  tabardo: { name: t('personalizar.prendas.tabardo.nombre'), tint: 'mar' },
  faja: { name: t('personalizar.prendas.faja.nombre'), tint: 'ocre' },
  bufanda: { name: t('personalizar.prendas.bufanda.nombre'), tint: 'bosque' },
};

/** Lo que el héroe lleva de la sastrería. */
export interface Dress {
  dye?: TintId;
  garment?: GarmentId;
}

/** El cuervo mensajero lleva la fama del gremio a otros pueblos. */
export const RAVEN_PRICE = 80;
export const RAVEN_EVERY = 15;
/** Los tapices: +1 de fama cada tantos días (la fama sale sobre todo de los encargos). */
export const TAPESTRY_EVERY = 14;
/** Los nobles que cenan en el salón hablan del gremio, pero solo cuenta uno de cada tantos días. */
export const NOBLE_REP_EVERY = 10;

/** Fiesta de la comarca: cada 10 días se puede montar en la taberna. */
export const FEAST_EVERY = 10;
export const FEAST_PRICE = 30;
export const FEAST_MORALE = 10;
export const isFeastDay = (day: number) => day % FEAST_EVERY === 0;

export const DOG_PRICE = 60;
/** El perro guardián: olfato para los asaltos (y de noche, ladra y despierta a todos antes). */
export const DOG_TIPOFF = 0.25;

/** Lo que pasa al tocar a los animales del salón (se elige una al azar). */
export const PET_LINES: Record<
  'gato' | 'perro' | 'cuervo' | 'rata' | 'murcielago',
  readonly string[]
> = {
  gato: tl('personalizar.mascota.gato'),
  perro: tl('personalizar.mascota.perro'),
  cuervo: tl('personalizar.mascota.cuervo'),
  rata: tl('personalizar.mascota.rata'),
  murcielago: tl('personalizar.mascota.murcielago'),
};

/** Inicial del lacre: la primera palabra que no sea un artículo («El Jarro Partido» → J). */
export function sealInitial(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const w = words.find((x) => !/^(el|la|los|las|un|una|del|de)$/i.test(x)) ?? words[0] ?? 'G';
  return w[0]!.toUpperCase();
}
