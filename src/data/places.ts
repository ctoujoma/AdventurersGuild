/**
 * Geografía de la comarca para el mapa: dónde está cada lugar de los encargos (en una
 * rejilla de MAP_W × MAP_H píxeles) y de qué tipo es su terreno.
 */

/**
 * El mapa es más grande que la comarca que se conoce al empezar: alrededor quedan tierras
 * por descubrir (la sierra del norte, el este, las marismas y la costa) para lugares futuros.
 */
export const MAP_W = 400;
export const MAP_H = 280;

/** El Jarro Partido, en el cruce de caminos. */
export const TAVERN = { x: 198, y: 146 } as const;

export type Terrain =
  'rio' | 'pueblo' | 'monte' | 'bosque' | 'costa' | 'pantano' | 'campo' | 'ruina';

export const PLACE_INFO: Record<string, { x: number; y: number; terrain: Terrain }> = {
  'el molino': { x: 176, y: 130, terrain: 'rio' },
  'el puente de los ahorcados': { x: 220, y: 112, terrain: 'rio' },
  Valdeloro: { x: 258, y: 168, terrain: 'pueblo' },
  'la casa del canal': { x: 150, y: 158, terrain: 'rio' },
  'el vado': { x: 204, y: 94, terrain: 'rio' },
  'la posada del Cuervo': { x: 276, y: 138, terrain: 'pueblo' },
  'los riscos': { x: 166, y: 82, terrain: 'monte' },
  'las salinas': { x: 108, y: 182, terrain: 'costa' },
  Hondogrís: { x: 280, y: 90, terrain: 'monte' },
  'el bosque de Sotomuro': { x: 124, y: 120, terrain: 'bosque' },
  'la mina vieja': { x: 238, y: 78, terrain: 'monte' },
  'el cementerio de Ormaz': { x: 188, y: 192, terrain: 'ruina' },
  'la torre caída': { x: 116, y: 84, terrain: 'ruina' },
  'el pantano de las ranas': { x: 140, y: 200, terrain: 'pantano' },
  'la ermita': { x: 294, y: 192, terrain: 'ruina' },
  'el granero de los Cardo': { x: 232, y: 202, terrain: 'campo' },
};

/** Posición de un lugar (los desconocidos, cerca de la taberna). */
export function placeAt(name: string): { x: number; y: number } {
  return PLACE_INFO[name] ?? TAVERN;
}

/** Lo que se ve sin explorar: lo que queda a menos de esta distancia de la taberna. */
export const KNOWN_RADIUS = 46;
/** Lo que descubre cada lugar visitado alrededor suyo. */
export const REVEAL_RADIUS = 30;

/** Nombres de las regiones, rotulados en el mapa cuando se conoce la zona. */
export const REGIONS: readonly { name: string; x: number; y: number }[] = [
  { name: 'Sierra Parda', x: 236, y: 30 },
  { name: 'Mar del Poniente', x: 40, y: 150 },
  { name: 'Las Marismas', x: 118, y: 236 },
  { name: 'Tierras del Este', x: 352, y: 128 },
  { name: 'Llanos del Sur', x: 276, y: 250 },
  { name: 'Montes de la Niebla', x: 74, y: 40 },
];
