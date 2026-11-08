import type { Rarity } from '../core/model';
import { P } from './palette';

/**
 * La escala de niveles del equipo, de cara al dibujo: común (gris), bueno (verde), raro (azul),
 * épico (morado) y legendario (oro). El metal es siempre metal de verdad (hierro mate, acero,
 * acero pulido, ennegrecido, oro); el color del nivel va donde es natural: gemas, runas, telas,
 * el campo del escudo y el marco. Cuanto más alto, más adornos.
 *
 * Cada rareza del juego (0–4) es su nivel: `tierOf` las coloca en la escala.
 */
export type Tier = 0 | 1 | 2 | 3 | 4;

const BY_RARITY: Record<Rarity, Tier> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
export const tierOf = (r: Rarity | undefined): Tier => BY_RARITY[r ?? 0] ?? 0;

/** Metal (oscuro, medio, claro, brillo). */
export const METAL: readonly (readonly [string, string, string, string])[] = [
  [P.slate, P.steel, P.fog, P.fog],
  [P.slate, P.steel, P.fog, P.mist],
  [P.steel, P.fog, P.mist, P.white],
  [P.navy, P.slate, P.steel, P.mist],
  [P.orange, P.gold, P.lemon, P.white],
];
/** Remates (oscuro, claro): cuero, bronce, plata, hierro negro, oro. */
export const TRIM: readonly (readonly [string, string])[] = [
  [P.bark, P.oak],
  [P.rust, P.clay],
  [P.steel, P.mist],
  [P.navy, P.slate],
  [P.amber, P.lemon],
];
/** El color del nivel en gemas y runas (el común, una piedra apagada). */
export const ACCENT: readonly (readonly [string, string])[] = [
  [P.rust, P.clay],
  [P.leaf, P.lime],
  [P.sky, P.cyan],
  [P.grape, P.rose],
  [P.wine, P.red],
];
/** Telas (oscura, media, clara). */
export const CLOTH: readonly (readonly [string, string, string])[] = [
  [P.bark, P.mocha, P.cocoa],
  [P.deep, P.forest, P.leaf],
  [P.navy, P.ocean, P.sky],
  [P.plum, P.grape, P.rose],
  [P.plum, P.wine, P.red],
];
/** El campo del escudo (oscuro, claro). */
export const FIELD: readonly (readonly [string, string])[] = [
  [P.oak, P.clay],
  [P.forest, P.leaf],
  [P.ocean, P.sky],
  [P.grape, P.rose],
  [P.wine, P.red],
];
/** El cuero de las botas. */
export const BOOT: readonly string[] = [P.umber, P.umber, P.bark, P.ebony, P.cocoa];
/** El marco del icono en la interfaz. */
export const FRAME: readonly string[] = [P.fog, P.lime, P.sky, P.rose, P.gold];
