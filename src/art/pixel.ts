/**
 * Búfer de píxeles sin DOM (Uint32Array, el mismo formato que ImageData).
 * Todo el arte se pinta aquí: es rápido, determinista y se puede testear en Node.
 */

export type Color = string | number;

const cache = new Map<string, number>();

/** '#rrggbb' → entero ABGR (orden de ImageData en little-endian). */
export function rgba(color: Color): number {
  if (typeof color === 'number') return color;
  let n = cache.get(color);
  if (n === undefined) {
    const v = parseInt(color.slice(1, 7), 16);
    n = ((255 << 24) | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)) >>> 0;
    cache.set(color, n);
  }
  return n;
}

export function toHex(c: number): string {
  const r = c & 255;
  const g = (c >> 8) & 255;
  const b = (c >> 16) & 255;
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export function alpha(c: number): number {
  return (c >>> 24) & 255;
}

/** Matriz de Bayer 4×4: el tramado ordenado clásico del pixel art. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Umbral de tramado en [0, 1) para el píxel (x, y). */
export function bayer(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
}

/** Elige un color de una rampa para un valor t ∈ [0, 1], tramando entre escalones. */
export function rampAt(
  ramp: readonly string[],
  t: number,
  x: number,
  y: number,
  dither = 1,
): string {
  const n = ramp.length - 1;
  const v = Math.max(0, Math.min(1, t)) * n;
  const base = Math.floor(v);
  const frac = v - base;
  const step = frac > 1 - (bayer(x, y) * dither + (1 - dither) * 0.5) ? 1 : 0;
  return ramp[Math.min(n, base + step)]!;
}

export class PixelBuffer {
  readonly data: Uint32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(w * h);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.data[y * this.w + x]! : 0;
  }

  set(x: number, y: number, color: Color): void {
    x |= 0;
    y |= 0;
    if (this.inside(x, y)) this.data[y * this.w + x] = rgba(color);
  }

  clear(x: number, y: number): void {
    if (this.inside(x, y)) this.data[y * this.w + x] = 0;
  }

  /** Pinta solo si el píxel ya está ocupado (para sombrear dentro de una forma). */
  setIfFilled(x: number, y: number, color: Color): void {
    if (alpha(this.get(x, y))) this.set(x, y, color);
  }

  rect(x: number, y: number, w: number, h: number, color: Color): void {
    const c = rgba(color);
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let j = y0; j < y1; j++) this.data.fill(c, j * this.w + x0, j * this.w + Math.max(x0, x1));
  }

  hline(x: number, y: number, w: number, color: Color): void {
    this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: Color): void {
    this.rect(x, y, 1, h, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: Color): void {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Elipse rellena (centro y radios en píxeles, admite medios). */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: Color | ((x: number, y: number, t: number) => Color),
  ): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1) this.set(x, y, typeof color === 'function' ? color(x, y, d) : color);
      }
    }
  }

  /** Polígono relleno por líneas de barrido. */
  poly(
    points: readonly (readonly [number, number])[],
    color: Color | ((x: number, y: number) => Color),
  ): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const cy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[(i + 1) % points.length]!;
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy))
          xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) {
          this.set(x, y, typeof color === 'function' ? color(x, y) : color);
        }
      }
    }
  }

  /** Copia otro búfer encima (respeta la transparencia). */
  blit(src: PixelBuffer, dx: number, dy: number, flip = false): void {
    dx |= 0;
    dy |= 0;
    for (let y = 0; y < src.h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + (flip ? src.w - 1 - x : x)]!;
        if (!alpha(c)) continue;
        const tx = dx + x;
        if (tx >= 0 && tx < this.w) this.data[ty * this.w + tx] = c;
      }
    }
  }

  clone(): PixelBuffer {
    const b = new PixelBuffer(this.w, this.h);
    b.data.set(this.data);
    return b;
  }

  crop(x: number, y: number, w: number, h: number): PixelBuffer {
    const b = new PixelBuffer(w, h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) b.data[j * w + i] = this.get(x + i, y + j);
    return b;
  }

  /** Recolorea píxel a píxel. */
  map(fn: (c: number, x: number, y: number) => number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        this.data[i] = fn(this.data[i]!, x, y);
      }
    }
  }

  /**
   * Contorno exterior de 1 px (devuelve un búfer 2 px más grande).
   * `colorFor` recibe el color vecino: permite contorno selectivo (sel-out).
   */
  outlined(colorFor: (neighbor: number) => Color): PixelBuffer {
    const out = new PixelBuffer(this.w + 2, this.h + 2);
    out.blit(this, 1, 1);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        if (alpha(out.get(x, y))) continue;
        const n =
          this.get(x - 1, y - 1 + 1) ||
          this.get(x - 1 + 1, y - 1) ||
          this.get(x - 2, y - 1) ||
          this.get(x - 1, y - 2);
        if (alpha(n)) out.set(x, y, colorFor(n));
      }
    }
    return out;
  }

  isEmpty(): boolean {
    return !this.data.some((c) => alpha(c) > 0);
  }

  countFilled(): number {
    let n = 0;
    for (const c of this.data) if (alpha(c)) n++;
    return n;
  }
}
