import { bayer } from '../art/pixel';

/** Color de una luz, de 0 a 255. */
export type RGB = readonly [number, number, number];

/**
 * Luz en clave de pixel art: cada foco es un círculo con escalones tramados (no un
 * degradado suave). Lo usan el cielo de la escena (halos) y la pelea contra el jefe.
 */

const cache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Foco tramado: `levels` escalones de intensidad, sumable con 'lighter'. */
export function lightSprite(
  r: number,
  color: RGB,
  intensity: number,
  levels = 6,
): HTMLCanvasElement {
  const key = `l:${r}:${color.join(',')}:${intensity}:${levels}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = r * 2 + 1;
  const [c, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d >= 1) continue;
      const f = Math.pow(1 - d, 1.25);
      const q = Math.min(levels, Math.floor(f * levels + bayer(x, y))) / levels;
      const i = (y * size + x) * 4;
      img.data[i] = color[0] * q * intensity;
      img.data[i + 1] = color[1] * q * intensity;
      img.data[i + 2] = color[2] * q * intensity;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/** Halo pequeño para llamas y faroles (brillo aditivo encima de la escena ya iluminada). */
export function glowSprite(r: number, color: RGB, strength = 0.5): HTMLCanvasElement {
  return lightSprite(r, color, strength, 3);
}
