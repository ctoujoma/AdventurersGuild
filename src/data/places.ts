/**
 * Geografía de la comarca para el mapa: dónde está cada lugar de los encargos (en una
 * rejilla de MAP_W × MAP_H píxeles) y de qué tipo es su terreno.
 */

export const MAP_W = 240;
export const MAP_H = 160;

/** El Jarro Partido, en el cruce de caminos. */
export const TAVERN = { x: 118, y: 86 } as const;

export type Terrain =
  'rio' | 'pueblo' | 'monte' | 'bosque' | 'costa' | 'pantano' | 'campo' | 'ruina';

export const PLACE_INFO: Record<string, { x: number; y: number; terrain: Terrain }> = {
  'el molino': { x: 96, y: 70, terrain: 'rio' },
  'el puente de los ahorcados': { x: 140, y: 52, terrain: 'rio' },
  Valdeloro: { x: 178, y: 108, terrain: 'pueblo' },
  'la casa del canal': { x: 70, y: 98, terrain: 'rio' },
  'el vado': { x: 124, y: 34, terrain: 'rio' },
  'la posada del Cuervo': { x: 196, y: 78, terrain: 'pueblo' },
  'los riscos': { x: 86, y: 22, terrain: 'monte' },
  'las salinas': { x: 28, y: 122, terrain: 'costa' },
  Hondogrís: { x: 200, y: 30, terrain: 'monte' },
  'el bosque de Sotomuro': { x: 44, y: 60, terrain: 'bosque' },
  'la mina vieja': { x: 158, y: 18, terrain: 'monte' },
  'el cementerio de Ormaz': { x: 108, y: 132, terrain: 'ruina' },
  'la torre caída': { x: 36, y: 24, terrain: 'ruina' },
  'el pantano de las ranas': { x: 60, y: 140, terrain: 'pantano' },
  'la ermita': { x: 214, y: 132, terrain: 'ruina' },
  'el granero de los Cardo': { x: 152, y: 142, terrain: 'campo' },
};

/** Posición de un lugar (los desconocidos, cerca de la taberna). */
export function placeAt(name: string): { x: number; y: number } {
  return PLACE_INFO[name] ?? TAVERN;
}

/** Lo que se ve sin explorar: lo que queda a menos de esta distancia de la taberna. */
export const KNOWN_RADIUS = 46;
/** Lo que descubre cada lugar visitado alrededor suyo. */
export const REVEAL_RADIUS = 30;
