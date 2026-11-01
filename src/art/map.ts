/**
 * El mapa de la comarca, según la sala de mapas: rota o a nivel 1, el pergamino ilustrado
 * (`mapInk.ts`); desde el nivel 2, la comarca a color (`mapColor.ts`). Las dos salen de la misma
 * comarca (`mapTerrain.ts`). Los marcadores (encargos, grupos) se ponen encima desde la interfaz.
 */
import { colorFog, colorMap } from './mapColor';
import { inkFog, inkMap } from './mapInk';
import type { PixelBuffer } from './pixel';

export { coastAt } from './mapTerrain';

export type MapStyle = 'pergamino' | 'color';

/** La versión del dibujo según el nivel de la sala de mapas (0 = rota o sin levantar). */
export const mapStyleFor = (mapas: number): MapStyle => (mapas >= 2 ? 'color' : 'pergamino');

/** El dibujo de la comarca. */
export function mapBuffer(style: MapStyle): PixelBuffer {
  return style === 'color' ? colorMap() : inkMap();
}

/** Lo no explorado, a juego: rayado de «tierra ignota» o un mar de nubes. */
export function fogBuffer(
  known: readonly { x: number; y: number; r: number }[],
  style: MapStyle,
): PixelBuffer {
  return style === 'color' ? colorFog(known) : inkFog(known);
}
