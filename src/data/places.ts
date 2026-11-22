import { has, msg, t, tx, type Txt } from '../textos';
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
  // Tierras de más allá, que se abren con las historias.
  'el mesón de Levante': { x: 322, y: 150, terrain: 'pueblo' },
  'el desfiladero de las Cabras': { x: 350, y: 112, terrain: 'monte' },
  'el campamento de los Tuertos': { x: 372, y: 82, terrain: 'bosque' },
  'la aldea de Juncal': { x: 176, y: 238, terrain: 'costa' },
  'el islote del Fraile': { x: 148, y: 258, terrain: 'ruina' },
  'la laguna Negra': { x: 128, y: 246, terrain: 'pantano' },
  'el paso del Lobo': { x: 182, y: 62, terrain: 'monte' },
  'el monasterio de Peñalta': { x: 248, y: 48, terrain: 'ruina' },
  'la cueva de la Sierpe': { x: 300, y: 34, terrain: 'monte' },
  // Las historias de oro y leyenda, en los bordes de la comarca.
  'la aldea de Carbonera': { x: 96, y: 112, terrain: 'pueblo' },
  'los pinares quemados': { x: 78, y: 78, terrain: 'bosque' },
  'la loma de Ceniza': { x: 92, y: 42, terrain: 'monte' },
  'el priorato de Sanvela': { x: 328, y: 204, terrain: 'ruina' },
  'las catacumbas de Sanvela': { x: 356, y: 230, terrain: 'ruina' },
  'la cripta de la Reina': { x: 384, y: 256, terrain: 'ruina' },
  'el refugio de Nevaza': { x: 330, y: 60, terrain: 'monte' },
  'el lago Helado': { x: 358, y: 38, terrain: 'rio' },
  'la Corona Blanca': { x: 386, y: 16, terrain: 'monte' },
};

/**
 * Clave del nombre de un lugar: el id es su nombre en español («el molino»), el que va en las
 * partidas; el nombre que se enseña sale de `lugares.sitios.<clave>` («el_molino»).
 */
export const placeKey = (id: string) =>
  id
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/** El nombre de un lugar como mensaje (para los huecos `{lugar}`); uno desconocido, tal cual. */
export const placeMsg = (id: string): Txt =>
  has(`lugares.sitios.${placeKey(id)}`) ? msg(`lugares.sitios.${placeKey(id)}`) : id;

/** El nombre de un lugar, escrito. */
export const placeName = (id: string) => tx(placeMsg(id));

/** Lugares de los encargos del tablón (ids, por orden: el generador elige por posición). */
export const PLACES: readonly string[] = [
  'el molino',
  'el puente de los ahorcados',
  'Valdeloro',
  'la casa del canal',
  'el vado',
  'la posada del Cuervo',
  'los riscos',
  'las salinas',
  'Hondogrís',
  'el bosque de Sotomuro',
  'la mina vieja',
  'el cementerio de Ormaz',
  'la torre caída',
  'el pantano de las ranas',
  'la ermita',
  'el granero de los Cardo',
];

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
  { name: t('lugares.regiones.sierra_parda.nombre'), x: 214, y: 24 },
  { name: t('lugares.regiones.mar_del_poniente.nombre'), x: 40, y: 150 },
  { name: t('lugares.regiones.las_marismas.nombre'), x: 118, y: 236 },
  { name: t('lugares.regiones.tierras_del_este.nombre'), x: 352, y: 128 },
  { name: t('lugares.regiones.llanos_del_sur.nombre'), x: 276, y: 250 },
  { name: t('lugares.regiones.montes_de_la_niebla.nombre'), x: 74, y: 40 },
];
