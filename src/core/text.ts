import { list } from '../textos';

/** «Lysa», «Lysa y Maren», «Lysa, Maren y Brom» (en el idioma de la partida). */
export const listNames = (names: readonly string[]): string => list(names);
