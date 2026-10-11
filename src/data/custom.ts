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
  pan: { name: 'Pan y queso', desc: 'Gratis. Nadie se queja… mucho.', cost: 0, morale: 0 },
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
