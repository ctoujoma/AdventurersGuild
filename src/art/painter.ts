import { Rng } from '../core/rng';
import { C } from './palette';
import { createPixels, outline, setPixel, type Pixels } from './sprite';

/** Pinta rectángulos en un canvas o en un `Pixels`: el mismo código sirve para ambos. */
export interface Painter {
  rect(x: number, y: number, w: number, h: number, color: string): void;
}

export function ctxPainter(ctx: CanvasRenderingContext2D): Painter {
  return {
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
  };
}

export function pixelsPainter(p: Pixels): Painter {
  return {
    rect(x, y, w, h, color) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setPixel(p, x + i, y + j, color);
    },
  };
}

/** Construye un mueble con rectángulos y le añade el contorno del resto del pixel art. */
export function shape(w: number, h: number, draw: (p: Painter) => void, outlined = true): Pixels {
  const p = createPixels(w, h);
  draw(pixelsPainter(p));
  return outlined ? outline(p, C.outline) : p;
}

/** Muro de piedra: hileras de bloques desplazadas, con algún bloque más claro. */
export function bricks(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: { base: string; mortar: string; light: string },
  seed: string,
): void {
  const rng = new Rng(seed);
  p.rect(x, y, w, h, colors.mortar);
  for (let row = 0, by = y; by < y + h; row++, by += 4) {
    const off = row % 2 ? -3 : 0;
    for (let bx = x + off; bx < x + w; bx += 7) {
      const x0 = Math.max(bx, x);
      const x1 = Math.min(bx + 6, x + w);
      const y1 = Math.min(by + 3, y + h);
      if (x1 <= x0 || y1 <= by) continue;
      p.rect(x0, by, x1 - x0, y1 - by, rng.chance(0.22) ? colors.light : colors.base);
    }
  }
}

/** Tablones verticales (paredes y frontales). */
export function planks(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  a: string,
  b: string,
  seam: string,
  width = 4,
): void {
  for (let i = 0, px = x; px < x + w; i++, px += width) {
    const ww = Math.min(width, x + w - px);
    p.rect(px, y, ww, h, i % 2 ? a : b);
    p.rect(px, y, 1, h, seam);
  }
}

/** Yeso con manchas; si está en ruinas, grietas y un boquete. */
export function plaster(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  stain: string,
  seed: string,
  ruined = false,
): void {
  const rng = new Rng(seed);
  p.rect(x, y, w, h, base);
  for (let i = 0; i < (w * h) / 40; i++)
    p.rect(x + rng.int(0, w - 1), y + rng.int(0, h - 1), 1, 1, stain);
  if (!ruined) return;
  for (let c = 0; c < 3; c++) {
    let cx = x + rng.int(4, w - 4);
    let cy = y + rng.int(2, 6);
    for (let s = 0; s < 10; s++) {
      p.rect(cx, cy, 1, 1, C.plaster0);
      cx += rng.int(-1, 1);
      cy += 1;
    }
  }
  const hx = x + rng.int(6, w - 18);
  const hy = y + rng.int(8, Math.max(9, h - 16));
  p.rect(hx, hy, 10, 7, C.wood0);
  for (let i = 0; i < 3; i++) p.rect(hx, hy + 1 + i * 2, 10, 1, C.wood1);
}

export function circle(p: Painter, cx: number, cy: number, r: number, color: string): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + r * 0.6) p.rect(cx + dx, cy + dy, 1, 1, color);
    }
  }
}
