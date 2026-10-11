/**
 * Sprites como datos: cada sprite es una cuadrícula de caracteres y un mapa carácter → color.
 * '.' es transparente. Así el arte del prototipo vive en el código, se versiona con git
 * y se puede recolorear por capas (piel, pelo, ropa de cada clase).
 *
 * Más adelante, los PNG de un artista pueden sustituir estas cuadrículas sin cambiar
 * quién los dibuja: todo acaba siendo un `Pixels`.
 */

export type Grid = readonly string[];
export type ColorMap = Readonly<Record<string, string>>;

/** Imagen en memoria: un color hex por píxel o null si es transparente. Sin DOM: testeable. */
export interface Pixels {
  readonly w: number;
  readonly h: number;
  readonly data: (string | null)[];
}

export function createPixels(w: number, h: number): Pixels {
  return { w, h, data: new Array<string | null>(w * h).fill(null) };
}

export function getPixel(p: Pixels, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return null;
  return p.data[y * p.w + x] ?? null;
}

export function setPixel(p: Pixels, x: number, y: number, color: string | null): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  p.data[y * p.w + x] = color;
}

/** Pinta una cuadrícula encima de `target` en (dx, dy). Lanza si falta un color en el mapa. */
export function stamp(target: Pixels, grid: Grid, colors: ColorMap, dx = 0, dy = 0): void {
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const color = colors[ch];
      if (!color) throw new Error(`Color sin definir para '${ch}'`);
      setPixel(target, dx + x, dy + y, color);
    }
  });
}

/** Devuelve una copia con 1 px de margen y contorno exterior: el borde típico del pixel art. */
export function outline(src: Pixels, color: string): Pixels {
  const out = createPixels(src.w + 2, src.h + 2);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) setPixel(out, x + 1, y + 1, getPixel(src, x, y));
  }
  const filled = (x: number, y: number) => getPixel(src, x - 1, y - 1) !== null;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        setPixel(out, x, y, color);
      }
    }
  }
  return out;
}

/** Recorta un rectángulo (para pintar solo la cabeza de un héroe tumbado en la cama, por ejemplo). */
export function crop(src: Pixels, x0: number, y0: number, w: number, h: number): Pixels {
  const out = createPixels(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) setPixel(out, x, y, getPixel(src, x0 + x, y0 + y));
  }
  return out;
}

/** Comprueba que todas las filas miden lo mismo y que cada carácter tiene color. */
export function validateGrid(grid: Grid, colors: ColorMap, width?: number): string[] {
  const errors: string[] = [];
  const w = width ?? grid[0]?.length ?? 0;
  grid.forEach((row, y) => {
    if (row.length !== w) errors.push(`fila ${y}: mide ${row.length}, se esperaba ${w}`);
    for (const ch of row) {
      if (ch !== '.' && !colors[ch]) errors.push(`fila ${y}: carácter '${ch}' sin color`);
    }
  });
  return errors;
}
