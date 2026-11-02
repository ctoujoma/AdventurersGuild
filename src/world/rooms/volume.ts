/**
 * Volumen de las figuras planas grandes (hogares, fraguas): de su silueta salen los lados y la
 * parte de arriba hacia el fondo, hasta la pared, como una caja de verdad. Al mover la cámara se
 * les ve el costado. Lógica pura: dice qué caras hay y de qué color; la escena las monta.
 */
import { alpha, type PixelBuffer } from '../../art/pixel';

export type FaceSide = 'left' | 'right' | 'top';

export interface Face {
  side: FaceSide;
  /**
   * Borde en píxeles del dibujo: la columna a cuya izquierda va la cara (lados; en la derecha,
   * la de después del último píxel) o la fila sobre la que va (arriba).
   */
  at: number;
  /** Tramo a lo largo del borde: filas (lados) o columnas (arriba), de `from` a `to` sin incluir. */
  from: number;
  to: number;
  /** Color (ABGR, como el búfer) de cada píxel del tramo, ya en sombra. */
  colors: number[];
}

/** Lo mínimo que mide un tramo recto para llevar cara. */
const MIN_RUN = 3;
/** Cuánto se mete hacia dentro para coger el color (el borde es la línea oscura del contorno). */
const INSET = 3;

/** Las caras de la silueta de `img`: lados izquierdo y derecho, y la de arriba. */
export function faces(img: PixelBuffer): Face[] {
  const solid = (x: number, y: number) => alpha(img.get(x, y)) > 0;
  const lefts: (number | null)[] = [];
  const rights: (number | null)[] = [];
  for (let y = 0; y < img.h; y++) {
    let l: number | null = null;
    let r: number | null = null;
    for (let x = 0; x < img.w; x++)
      if (solid(x, y)) {
        if (l === null) l = x;
        r = x;
      }
    lefts.push(l);
    rights.push(r === null ? null : r + 1);
  }
  const tops: (number | null)[] = [];
  for (let x = 0; x < img.w; x++) {
    let t: number | null = null;
    for (let y = 0; y < img.h && t === null; y++) if (solid(x, y)) t = y;
    tops.push(t);
  }
  const out: Face[] = [];
  // Color de dentro del contorno, en el sentido que entra en la figura.
  const inner = (x: number, y: number, dx: number, dy: number) => {
    let c = img.get(x, y);
    for (let i = 1; i <= INSET; i++) {
      const n = img.get(x + dx * i, y + dy * i);
      if (!alpha(n)) break;
      c = n;
    }
    return c;
  };
  for (const r of runs(lefts))
    out.push({
      side: 'left',
      ...r,
      colors: span(r, (y) => shade(inner(lefts[y] ?? r.at, y, 1, 0), 0.8)),
    });
  for (const r of runs(rights))
    out.push({
      side: 'right',
      ...r,
      colors: span(r, (y) => shade(inner((rights[y] ?? r.at) - 1, y, -1, 0), 0.7)),
    });
  for (const r of runs(tops))
    out.push({
      side: 'top',
      ...r,
      colors: span(r, (x) => shade(inner(x, tops[x] ?? r.at, 0, 1), 0.95)),
    });
  return out;
}

/**
 * Tramos seguidos con el mismo borde. Un tramo corto entre dos iguales es un diente del contorno
 * y se rellena; los demás cortos (los escalones de un borde inclinado) se quedan sin cara: en
 * escalera se verían como dientes oscuros.
 */
function runs(edge: (number | null)[]): { at: number; from: number; to: number }[] {
  const raw: { at: number; from: number; to: number }[] = [];
  for (let i = 0; i < edge.length; i++) {
    const e = edge[i];
    if (e === null || e === undefined) continue;
    const last = raw.at(-1);
    if (last && last.at === e && last.to === i) last.to = i + 1;
    else raw.push({ at: e, from: i, to: i + 1 });
  }
  const merged: typeof raw = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]!;
    const last = merged.at(-1);
    const next = raw[i + 1];
    const tooth =
      r.to - r.from < MIN_RUN &&
      last &&
      next &&
      last.at === next.at &&
      last.to === r.from &&
      r.to === next.from;
    if (tooth) {
      last.to = next.to;
      i++;
      continue;
    }
    if (last && last.at === r.at && last.to === r.from) last.to = r.to;
    else merged.push({ ...r });
  }
  return merged.filter((r) => r.to - r.from >= MIN_RUN);
}

function span(r: { from: number; to: number }, color: (i: number) => number): number[] {
  const out: number[] = [];
  for (let i = r.from; i < r.to; i++) out.push(color(i));
  return out;
}

/** El mismo color más oscuro (la escena lo pasa luego a la paleta). */
function shade(c: number, k: number): number {
  const r = Math.round((c & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round(((c >> 16) & 255) * k);
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** De qué es un mueble: su costado (y su tapa) se pinta según eso, no se estira el dibujo. */
export type Mat = 'madera' | 'oro' | 'piedra' | 'metal';

const hash = (a: number, b: number) => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};

/** Un color (ABGR) aclarado hacia el blanco (`k` > 0). */
function light(c: number, k: number): number {
  const f = (v: number) => Math.round(v + (255 - v) * k);
  return ((255 << 24) | (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255)) >>> 0;
}

/**
 * Un téxel del costado de un mueble: `c` es el color del borde del dibujo en esa fila (o
 * columna), `i` su posición a lo largo del borde y `j` (de `n`) lo hondo hacia el fondo. Hacia el
 * fondo se oscurece algo (la sombra junto a la pared) y, según el material, lleva lo suyo: las
 * juntas de las tablas, las monedas sueltas, los sillares o los remaches.
 */
export function sideTexel(c: number, i: number, j: number, n: number, mat?: Mat): number {
  let k = 1 - (j / Math.max(1, n)) * 0.2;
  switch (mat) {
    case 'madera':
      if (j % 3 === 2) k *= 0.8;
      else if (hash(i >> 1, j) < 0.08) k *= 0.88;
      break;
    case 'oro': {
      const h = hash(i, j);
      if (h < 0.1) return light(shade(c, 1), 0.45);
      if (h < 0.22) k *= 0.82;
      break;
    }
    case 'piedra':
      if (j % 4 === 0 || (i + (j >> 2) * 3) % 6 === 0) k *= 0.78;
      break;
    case 'metal':
      if (j % 4 === 1 && i % 4 === 1) return light(shade(c, 1), 0.35);
      break;
  }
  return shade(c, k);
}
