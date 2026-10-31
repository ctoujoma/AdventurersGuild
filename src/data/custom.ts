/**
 * Personalización de la taberna: escudo, decoración, fachada, personal y mascota. Los efectos
 * son pequeños; lo importante es que la taberna se parezca a quien la lleva.
 */

import { P } from '../art/palette';
import type { RoomType } from './rooms';

export type CrestColor = 'vino' | 'mar' | 'bosque' | 'oro' | 'noche';
export type CrestSymbol = 'jarra' | 'espada' | 'llave' | 'estrella' | 'dragon' | 'luna';
export type StaffId = 'cocinera' | 'bardo' | 'mozo';

export const DEFAULT_NAME = 'El Jarro Partido';

export const CREST_COLORS: Record<CrestColor, { name: string; field: string; dark: string }> = {
  vino: { name: 'Vino', field: '#a22633', dark: '#3e2731' },
  mar: { name: 'Mar', field: '#124e89', dark: '#262b44' },
  bosque: { name: 'Bosque', field: '#3e8948', dark: '#193c3e' },
  oro: { name: 'Oro', field: '#d77643', dark: '#733e39' },
  noche: { name: 'Noche', field: '#3a4466', dark: '#181425' },
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
  vino: { name: 'Vino', ramp: [P.plum, P.wine, P.red, P.coral] },
  mar: { name: 'Mar', ramp: [P.navy, P.ocean, P.sky, P.mist] },
  bosque: { name: 'Bosque', ramp: [P.deep, P.forest, P.leaf, P.lime] },
  ocre: { name: 'Ocre', ramp: [P.plum, P.rust, P.amber, P.gold] },
  morado: { name: 'Morado', ramp: [P.plum, P.grape, P.rose, P.coral] },
  ceniza: { name: 'Ceniza', ramp: [P.navy, P.slate, P.steel, P.fog] },
  lino: { name: 'Lino', ramp: [P.rust, P.clay, P.tan, P.sand] },
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
  jarra: 'Jarra partida',
  espada: 'Espada',
  llave: 'Llave',
  estrella: 'Estrella',
  dragon: 'Dragón',
  luna: 'Luna',
};

export type DecorId = 'naipes' | 'tarima' | 'tapices' | 'barril' | 'lampara' | 'chimenea';

/**
 * Decoración del salón: huecos limitados, cada pieza con su Atractivo (trae visitantes) y a
 * veces un efecto pequeño con su pega.
 */
export const DECOR: Record<DecorId, { name: string; desc: string; price: number; appeal: number }> =
  {
    naipes: {
      name: 'Mesa de naipes',
      desc: '+6 monedas al día, pero hay más peleas en el salón.',
      price: 50,
      appeal: 1,
    },
    tarima: {
      name: 'Tarima del bardo',
      desc: '+2 de moral por noche; con el bardo tocando en el salón, trae 8 monedas más.',
      price: 60,
      appeal: 1,
    },
    tapices: {
      name: 'Tapices con el escudo',
      desc: '+1 de reputación cada 7 días: la taberna luce.',
      price: 45,
      appeal: 2,
    },
    barril: {
      name: 'Barril de cerveza especial',
      desc: '+1 de moral por noche y +2 monedas al día.',
      price: 35,
      appeal: 1,
    },
    lampara: {
      name: 'Lámpara de hierro',
      desc: 'Mucha luz y ninguna esquina oscura: el salón parece más grande.',
      price: 70,
      appeal: 3,
    },
    chimenea: {
      name: 'Chimenea grande',
      desc: 'Fuego bueno toda la noche: +1 de moral a quien descansa.',
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
  flores: { name: 'Macetas con flores', desc: 'Geranios en la puerta.', price: 30, appeal: 1 },
  faroles: {
    name: 'Faroles en el patio',
    desc: 'De noche se ve la taberna desde el camino.',
    price: 50,
    appeal: 2,
  },
  banderines: {
    name: 'Banderines de colores',
    desc: 'Del letrero al pozo, con los colores del escudo.',
    price: 40,
    appeal: 1,
  },
  letrero: {
    name: 'Letrero pintado',
    desc: 'El nombre de la taberna en letras doradas.',
    price: 80,
    appeal: 3,
  },
};
/**
 * El aspecto de la fachada por partes (solo se ve; los adornos que atraen gente son `FACADE`).
 * Sin elegir, lo de siempre: teja roja, tablas y el tablero colgado.
 */
export type RoofId = 'teja' | 'pizarra' | 'paja' | 'verde' | 'tablilla';
export type WallId = 'tablas' | 'entramado' | 'piedra';
export type SignId = 'tablero' | 'hierro' | 'pintado';

export interface FacadeLook {
  roof?: RoofId;
  walls?: WallId;
  sign?: SignId;
  /** Jardineras con flores bajo los ventanucos de los hastiales. */
  boxes?: boolean;
}

export const ROOFS: Record<RoofId, string> = {
  teja: 'Teja roja',
  pizarra: 'Pizarra',
  paja: 'Paja',
  verde: 'Teja verde',
  tablilla: 'Tablillas',
};
export const WALLS: Record<WallId, string> = {
  tablas: 'Tablas',
  entramado: 'Entramado',
  piedra: 'Piedra',
};
export const SIGNS: Record<SignId, string> = {
  tablero: 'Tablero',
  hierro: 'De hierro',
  pintado: 'Pintado',
};

/**
 * La sastrería (preparada; la sala vendrá después): un tinte para la ropa del héroe (los temas
 * de `TINTS`) y una prenda encima del traje. Solo se ve.
 */
export type GarmentId = 'capa' | 'tabardo' | 'faja' | 'bufanda';
export const GARMENTS: Record<GarmentId, { name: string; tint: TintId }> = {
  capa: { name: 'Capa', tint: 'vino' },
  tabardo: { name: 'Tabardo', tint: 'mar' },
  faja: { name: 'Faja', tint: 'ocre' },
  bufanda: { name: 'Bufanda', tint: 'bosque' },
};

/** Lo que el héroe lleva de la sastrería. */
export interface Dress {
  dye?: TintId;
  garment?: GarmentId;
}

/** El cuervo mensajero lleva la fama del gremio a otros pueblos. */
export const RAVEN_PRICE = 80;
export const RAVEN_EVERY = 5;

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
  gato: [
    'Bigotes ronronea. Lleva aquí más años que tú.',
    'Bigotes abre un ojo, te mira y lo vuelve a cerrar.',
    'Bigotes se deja rascar detrás de la oreja. Solo un poco.',
    'Bigotes te da un cabezazo en la mano. Huele a la cocina.',
    'Bigotes se estira junto al fuego. El sitio es suyo.',
  ],
  perro: [
    '¡Guau, guau! Tizón mueve el rabo y vuelve a tumbarse.',
    'Tizón te lame la mano y suspira.',
    'Tizón ladra a la puerta. No hay nadie… de momento.',
    'Tizón se pone panza arriba. Menudo perro guardián.',
    'Tizón levanta las orejas: ha oído algo en el patio.',
  ],
  cuervo: [
    '¡Cra, cra! Carbón dice que trae noticias, pero no suelta prenda.',
    'Carbón te mira de lado y se atusa una pluma.',
    'Carbón ladea la cabeza: espera algo brillante a cambio.',
    'Carbón grazna tu nombre. O algo que se le parece.',
    'Carbón no se fía de los forasteros. De ti, a medias.',
  ],
  rata: [
    'Una rata. Ha salido por el boquete del suelo y por ahí se vuelve.',
    'La rata te mira, se lo piensa y echa a correr.',
    'Mientras no se arregle la sala, aquí mandan las ratas.',
    'Bigotes debería ocuparse de esto. Bigotes no opina lo mismo.',
  ],
  murcielago: [
    'Los murciélagos salen en desbandada y vuelven a colgarse de las vigas.',
    'Murciélagos en el techo. Con la sala arreglada, buscarían otra casa.',
    'Un aleteo, un chillido y otra vez quietos, boca abajo.',
  ],
};

/** Inicial del lacre: la primera palabra que no sea un artículo («El Jarro Partido» → J). */
export function sealInitial(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const w = words.find((x) => !/^(el|la|los|las|un|una|del|de)$/i.test(x)) ?? words[0] ?? 'G';
  return w[0]!.toUpperCase();
}
