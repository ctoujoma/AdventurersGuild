/**
 * Muestras de los materiales de la fachada para los botones de Adornos: un trocito del tejado y
 * de la pared con el mismo dibujo que en la escena (no un color plano).
 */
import { P } from '../art/palette';
import { PixelBuffer } from '../art/pixel';
import type { RoofId, WallId } from '../data/custom';
import { roofAt } from '../world/rooms/fachada';
import { wallFace } from '../world/rooms/muros';

const N = 10;
const cache = new Map<string, PixelBuffer>();

/** Un marco oscuro de un píxel alrededor de la muestra. */
function frame(b: PixelBuffer): PixelBuffer {
  for (let i = 0; i < N; i++) {
    b.set(i, 0, P.black);
    b.set(i, N - 1, P.black);
    b.set(0, i, P.black);
    b.set(N - 1, i, P.black);
  }
  return b;
}

export function roofTile(roof: RoofId): PixelBuffer {
  const key = `roof:${roof}`;
  let b = cache.get(key);
  if (!b) {
    b = new PixelBuffer(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) b.set(x, y, roofAt(roof, x, y, 4));
    cache.set(key, frame(b));
  }
  return b;
}

export function wallTile(walls: WallId): PixelBuffer {
  const key = `walls:${walls}`;
  let b = cache.get(key);
  if (!b) {
    // Se pinta un paño más grande y se coge un trozo con un poste o una junta a la vista.
    const big = new PixelBuffer(40, 40);
    wallFace(big, 0, 0, 40, 40, 'muestra', walls);
    b = new PixelBuffer(N, N);
    const ox = walls === 'entramado' ? 20 : walls === 'tablas' ? 2 : 3;
    const oy = walls === 'entramado' ? 23 : 4;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) b.data[y * N + x] = big.get(x + ox, y + oy);
    cache.set(key, frame(b));
  }
  return b;
}
