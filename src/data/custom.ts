/**
 * Personalización de la taberna: escudo, plato de la casa, personal y mascota. Los efectos
 * son pequeños; lo importante es que la taberna se parezca a quien la lleva.
 */

export type CrestColor = 'vino' | 'mar' | 'bosque' | 'oro' | 'noche';
export type CrestSymbol = 'jarra' | 'espada' | 'llave' | 'estrella' | 'dragon' | 'luna';
export type Dish = 'pan' | 'guiso' | 'asado';
export type StaffId = 'cocinera' | 'bardo' | 'mozo';

export const DEFAULT_NAME = 'El Jarro Partido';

export const CREST_COLORS: Record<CrestColor, { name: string; field: string; dark: string }> = {
  vino: { name: 'Vino', field: '#a22633', dark: '#3e2731' },
  mar: { name: 'Mar', field: '#124e89', dark: '#262b44' },
  bosque: { name: 'Bosque', field: '#3e8948', dark: '#193c3e' },
  oro: { name: 'Oro', field: '#d77643', dark: '#733e39' },
  noche: { name: 'Noche', field: '#3a4466', dark: '#181425' },
};

export const CREST_SYMBOLS: Record<CrestSymbol, string> = {
  jarra: 'Jarra partida',
  espada: 'Espada',
  llave: 'Llave',
  estrella: 'Estrella',
  dragon: 'Dragón',
  luna: 'Luna',
};

export const DISHES: Record<Dish, { name: string; desc: string; cost: number; morale: number }> = {
  pan: { name: 'Pan y queso', desc: 'Gratis. Se quejan, pero se lo comen.', cost: 0, morale: 0 },
  guiso: {
    name: 'Guiso de la casa',
    desc: '+2 de moral por noche a quien descansa.',
    cost: 4,
    morale: 2,
  },
  asado: {
    name: 'Asado del domingo',
    desc: '+4 de moral por noche a quien descansa.',
    cost: 10,
    morale: 4,
  },
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
export const BRAWL_CHANCE = 0.1;

/** El cuervo mensajero lleva la fama del gremio a otros pueblos. */
export const RAVEN_PRICE = 80;
export const RAVEN_EVERY = 5;

/** Fiesta de la comarca: cada 10 días se puede montar en la taberna. */
export const FEAST_EVERY = 10;
export const FEAST_PRICE = 30;
export const FEAST_MORALE = 10;
export const isFeastDay = (day: number) => day % FEAST_EVERY === 0;

export const DOG_PRICE = 60;
/** El perro guardián: defensa y olfato para los asaltos. */
export const DOG_DEFENSE = 3;
export const DOG_TIPOFF = 0.25;

/** Inicial del lacre: la primera palabra que no sea un artículo («El Jarro Partido» → J). */
export function sealInitial(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const w = words.find((x) => !/^(el|la|los|las|un|una|del|de)$/i.test(x)) ?? words[0] ?? 'G';
  return w[0]!.toUpperCase();
}
