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

export const STAFF: Record<StaffId, { name: string; desc: string; fee: number; salary: number }> = {
  cocinera: {
    name: 'Cocinera',
    desc: 'El plato de la casa anima el doble.',
    fee: 30,
    salary: 6,
  },
  bardo: {
    name: 'Bardo',
    desc: '+8 monedas al día: la gente se queda a escucharle.',
    fee: 30,
    salary: 6,
  },
  mozo: {
    name: 'Mozo',
    desc: 'Atiende a los heridos: curan un día más rápido.',
    fee: 30,
    salary: 6,
  },
};

export type DecorId = 'naipes' | 'tarima' | 'tapices' | 'barril';

/** Decoración del salón: huecos limitados, cada pieza con un efecto pequeño y su pega. */
export const DECOR: Record<DecorId, { name: string; desc: string; price: number }> = {
  naipes: {
    name: 'Mesa de naipes',
    desc: '+6 monedas al día, pero a veces acaba en pelea (alguien pierde moral).',
    price: 50,
  },
  tarima: {
    name: 'Tarima del bardo',
    desc: '+2 de moral por noche; con bardo, trae 8 monedas más.',
    price: 60,
  },
  tapices: {
    name: 'Tapices con el escudo',
    desc: '+1 de reputación cada 7 días: la taberna luce.',
    price: 45,
  },
  barril: {
    name: 'Barril de cerveza especial',
    desc: '+1 de moral por noche y +2 monedas al día.',
    price: 35,
  },
};
/** Huecos de decoración: dos, y uno más con el salón grande. */
export const decorSlots = (tab: number) => (tab >= 3 ? 3 : 2);
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
