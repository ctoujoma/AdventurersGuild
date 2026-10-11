import type { PixelBuffer } from './pixel';

/** Convierte un PixelBuffer en canvas, con caché: cada imagen se rasteriza una sola vez. */
const cache = new WeakMap<PixelBuffer, HTMLCanvasElement>();

export function bufferCanvas(b: PixelBuffer): HTMLCanvasElement {
  const hit = cache.get(b);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = b.w;
  canvas.height = b.h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(b.w, b.h);
  img.data.set(new Uint8Array(b.data.buffer, b.data.byteOffset, b.data.byteLength));
  ctx.putImageData(img, 0, 0);
  cache.set(b, canvas);
  return canvas;
}

export function drawBuffer(
  ctx: CanvasRenderingContext2D,
  b: PixelBuffer,
  x: number,
  y: number,
  flip = false,
): void {
  const img = bufferCanvas(b);
  if (!flip) {
    ctx.drawImage(img, Math.round(x), Math.round(y));
    return;
  }
  ctx.save();
  ctx.translate(Math.round(x) + b.w, Math.round(y));
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
