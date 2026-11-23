/**
 * Ayudas para componer el fotograma del visor en un `PixelBuffer`: copiar tiras que dan la vuelta,
 * pegar muñecos teñidos con la luz (con caché), girados (las armas) o con destello, y cifras.
 */
import { PixelBuffer, bayer, rgba } from '../../art/pixel';
import { tintColor, type Luz } from './luz';

/** Pega `src` con la x de su tira desplazada `off` (da la vuelta) en la fila `y` de `dst`. */
export function blitStrip(dst: PixelBuffer, src: PixelBuffer, off: number, y: number): void {
  const L = src.w;
  const o = ((Math.round(off) % L) + L) % L;
  for (let yy = 0; yy < src.h; yy++) {
    const ty = y + yy;
    if (ty < 0 || ty >= dst.h) continue;
    const row = yy * L;
    const out = ty * dst.w;
    let sx = o;
    for (let x = 0; x < dst.w; x++) {
      const c = src.data[row + sx]!;
      if (c >>> 24) dst.data[out + x] = c;
      if (++sx === L) sx = 0;
    }
  }
}

/** Una clave de la luz para las cachés de muñecos teñidos (cambia poco). */
export const luzKey = (l: Luz) =>
  `${l.tint.map((v) => v.toFixed(2)).join(',')}:${l.night.toFixed(1)}:${l.clima.cloud.toFixed(1)}`;

const tintCache = new WeakMap<PixelBuffer, { key: string; out: PixelBuffer }>();

/** El muñeco teñido con la luz de ahora (se calcula una vez por luz). */
export function tinted(src: PixelBuffer, l: Luz, key: string): PixelBuffer {
  const hit = tintCache.get(src);
  if (hit && hit.key === key) return hit.out;
  const out = new PixelBuffer(src.w, src.h);
  for (let i = 0; i < src.data.length; i++) out.data[i] = tintColor(src.data[i]!, l);
  tintCache.set(src, { key, out });
  return out;
}

/** Pega un muñeco por el centro de sus pies (`fx`, `fy` dentro del dibujo). */
export function put(
  dst: PixelBuffer,
  src: PixelBuffer,
  x: number,
  feet: number,
  fx: number,
  fy: number,
  left = false,
  flash?: number,
): void {
  const ox = Math.round(left ? x - (src.w - 1 - fx) : x - fx);
  const oy = Math.round(feet - fy);
  for (let y = 0; y < src.h; y++) {
    const ty = oy + y;
    if (ty < 0 || ty >= dst.h) continue;
    for (let xx = 0; xx < src.w; xx++) {
      const c = src.data[y * src.w + (left ? src.w - 1 - xx : xx)]!;
      if (!(c >>> 24)) continue;
      const tx = ox + xx;
      if (tx < 0 || tx >= dst.w) continue;
      dst.data[ty * dst.w + tx] = flash ?? c;
    }
  }
}

/**
 * Pega `src` girado `deg` grados (sentido del reloj) con su punto (`px`, `py`) en (`x`, `y`);
 * con `left`, en espejo.
 */
export function putRot(
  dst: PixelBuffer,
  src: PixelBuffer,
  x: number,
  y: number,
  px: number,
  py: number,
  deg: number,
  left = false,
  map?: (c: number) => number,
): void {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const R = Math.ceil(Math.hypot(Math.max(px, src.w - px), Math.max(py, src.h - py))) + 1;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const sx = Math.round(px + dx * c + dy * s);
      const sy = Math.round(py - dx * s + dy * c);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const col = src.data[sy * src.w + sx]!;
      if (!(col >>> 24)) continue;
      const tx = Math.round(x + (left ? -dx : dx));
      const ty = Math.round(y + dy);
      if (dst.inside(tx, ty)) dst.data[ty * dst.w + tx] = map ? map(col) : col;
    }
}

const DIGITS = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001001001001',
  '111101111101111',
  '111101111001111',
];

/** Cifras de 3×5 con su borde oscuro (las del daño), centradas en `x`. */
export function digits(
  dst: PixelBuffer,
  text: string,
  x: number,
  y: number,
  color: string,
  edge: string,
) {
  const c = rgba(color);
  const k = rgba(edge);
  const w = text.length * 4 - 1;
  const x0 = Math.round(x - w / 2);
  const on = (i: number, j: number) => {
    const ch = text[Math.floor(i / 4)];
    const g = ch === undefined ? undefined : DIGITS[Number(ch)];
    const col = i % 4;
    return !!g && col < 3 && j >= 0 && j < 5 && g[j * 3 + col] === '1';
  };
  for (let j = -1; j <= 5; j++)
    for (let i = -1; i <= w; i++) {
      if (on(i, j)) continue;
      if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))
        dst.set(x0 + i, Math.round(y) + j, k);
    }
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < w; i++) if (on(i, j)) dst.set(x0 + i, Math.round(y) + j, c);
}

/** Pone `color` en (x, y) si `a` supera el umbral de tramado (para fundidos de pocos píxeles). */
export function dith(dst: PixelBuffer, x: number, y: number, color: number, a: number) {
  if (a > bayer(x, y)) dst.set(x, y, color);
}
