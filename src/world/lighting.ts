import { bayer } from '../art/pixel';
import type { Ambient, RGB, Shaft } from './build';
import { WORLD_H, WORLD_W } from './geometry';

/**
 * Luz en clave de pixel art: cada foco es un círculo con escalones tramados (no un
 * degradado suave) que se suma sobre la luz ambiente de cada habitación; luego todo se
 * multiplica sobre la escena. Los rayos de luna entran en diagonal por las ventanas.
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

/** Rayo de luna: la ventana barrida en diagonal hasta el suelo, tramado y cada vez más débil. */
export function shaftSprite(s: Shaft): { canvas: HTMLCanvasElement; x: number; y: number } {
  const key = `s:${s.x}:${s.y}:${s.w}:${s.h}:${s.floor}`;
  const slope = 0.6;
  const len = s.floor - s.y;
  const w = Math.ceil(s.w + len * slope) + 1;
  const h = len;
  let c = cache.get(key);
  if (!c) {
    const [canvas, ctx] = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const tMin = Math.max(0, py - s.h, (px - s.w) / slope);
        const tMax = Math.min(py, px / slope);
        if (tMin > tMax) continue;
        const f = 1 - tMin / len;
        const q = Math.floor(f * 4 + bayer(px + s.x, py + s.y) * 0.9) / 4;
        if (q <= 0) continue;
        const i = (py * w + px) * 4;
        img.data[i] = 46 * q;
        img.data[i + 1] = 58 * q;
        img.data[i + 2] = 96 * q;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    c = canvas;
    cache.set(key, c);
  }
  return { canvas: c, x: s.x, y: s.y };
}

/** Luz ambiente de todo el mundo: blanco (sin efecto) fuera, penumbra tintada dentro. */
export function ambientCanvas(ambient: readonly Ambient[]): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(WORLD_W, WORLD_H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (const a of ambient) {
    ctx.fillStyle = `rgb(${a.color[0]}, ${a.color[1]}, ${a.color[2]})`;
    ctx.beginPath();
    a.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  return c;
}
