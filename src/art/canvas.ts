import type { Pixels } from './sprite';

/** Convierte `Pixels` en un canvas, con caché: cada sprite se rasteriza una sola vez. */
const cache = new WeakMap<Pixels, HTMLCanvasElement>();

export function toCanvas(p: Pixels): HTMLCanvasElement {
  const hit = cache.get(p);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = p.w;
  canvas.height = p.h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(p.w, p.h);
  p.data.forEach((color, i) => {
    if (!color) return;
    const n = parseInt(color.slice(1), 16);
    img.data[i * 4] = (n >> 16) & 255;
    img.data[i * 4 + 1] = (n >> 8) & 255;
    img.data[i * 4 + 2] = n & 255;
    img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);
  cache.set(p, canvas);
  return canvas;
}

export function drawPixels(
  ctx: CanvasRenderingContext2D,
  p: Pixels,
  x: number,
  y: number,
  flip = false,
): void {
  const img = toCanvas(p);
  if (!flip) {
    ctx.drawImage(img, Math.round(x), Math.round(y));
    return;
  }
  ctx.save();
  ctx.translate(Math.round(x) + p.w, Math.round(y));
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
