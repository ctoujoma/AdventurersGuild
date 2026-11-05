/**
 * Las paredes de fuera, de dos maneras:
 *
 * - **De frente** (`wallFace`: los hastiales y los costados que dan al aire): la cara del muro,
 *   sin repetirse. Tablas de ancho y tono desiguales con tapajuntas, empalmes, nudos y clavos;
 *   entramado con postes a distancias distintas y cada paño a su aire (sin riostra, diagonal,
 *   cruz de San Andrés o en uve), con el yeso manchado; sillería en hiladas de alto distinto,
 *   con sillares de largo variado, biselados y con desconchones.
 * - **En corte** (`wallSection`: el grueso del muro alrededor de cada sala, donde el edificio está
 *   abierto): lo de dentro del muro. Tablas: dos forros y la cámara con los travesaños vistos
 *   por la testa; entramado: el revoco, el barro con el zarzo y las carreras por la testa;
 *   piedra: dos caras de sillar y el relleno de mampuesto.
 *
 * Troncos, ladrillo, tapial, lajas y encalado, en `materiales.ts`.
 */
import { Rng } from '../../core/rng';
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import type { WallId } from '../../data/custom';
import {
  brickFace,
  brickSection,
  limeFace,
  limeSection,
  logsFace,
  logsSection,
  rammedFace,
  rammedSection,
  slateFace,
  slateSection,
} from './materiales';

/** Ruido fijo por píxel (0–1). */
const hash = (x: number, y: number, s = 0) => {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483, 1274126177);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 1000) / 1000;
};

// ---------- De frente ----------

export function wallFace(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  walls: WallId = 'tablas',
): void {
  if (w <= 0 || h <= 0) return;
  if (walls === 'piedra') ashlarFace(b, x, y, w, h, seed);
  else if (walls === 'entramado') timberFace(b, x, y, w, h, seed);
  else if (walls === 'troncos') logsFace(b, x, y, w, h, seed);
  else if (walls === 'ladrillo') brickFace(b, x, y, w, h, seed);
  else if (walls === 'tapial') rammedFace(b, x, y, w, h, seed);
  else if (walls === 'pizarra') slateFace(b, x, y, w, h, seed);
  else if (walls === 'encalado') limeFace(b, x, y, w, h, seed);
  else boardFace(b, x, y, w, h, seed);
}

/** Tonos de las tablas (sombra, cuerpo, luz), de la más gastada a la más nueva. */
const BOARDS: readonly (readonly [string, string, string])[] = [
  [P.black, P.plum, P.bark],
  [P.plum, P.bark, P.umber],
  [P.plum, P.umber, P.mocha],
  [P.plum, P.bark, P.rust],
  [P.bark, P.rust, P.cocoa],
];

/** Tablas en vertical con tapajuntas: cada una con su ancho, su tono, su veta y sus empalmes. */
function boardFace(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: string) {
  const rng = new Rng(`tablas-${seed}`);
  // Las carreras de detrás (donde van los clavos), cada 26–34.
  const rails: number[] = [];
  for (let ry = y + 6 + rng.int(0, 8); ry < y + h; ry += 26 + rng.int(0, 8)) rails.push(ry);
  let px = x;
  let i = 0;
  while (px < x + w) {
    const bw = Math.min(5 + rng.int(0, 3), x + w - px);
    // La mayoría gastadas; alguna cambiada hace poco, más clara.
    const tone = rng.weighted([
      [0, 2],
      [1, 5],
      [2, 3],
      [3, 2],
      [4, i % 7 === 3 ? 4 : 0.4],
    ] as const);
    const [dk, mid, lt] = BOARDS[tone]!;
    // La tabla, por trozos: se empalma a alturas distintas.
    let ty = y;
    while (ty < y + h) {
      const len = Math.min(30 + rng.int(0, 60), y + h - ty);
      b.rect(px, ty, bw, len, mid);
      // Veta larga.
      for (let k = 0; k < Math.ceil(len / 10); k++) {
        const gx = px + 1 + rng.int(0, Math.max(0, bw - 2));
        const gy = ty + rng.int(0, Math.max(0, len - 4));
        b.vline(gx, gy, Math.min(4 + rng.int(0, 12), ty + len - gy), rng.chance(0.5) ? dk : lt);
      }
      // Nudo.
      if (rng.chance(0.25) && bw > 4 && len > 10) {
        const kx = px + 1 + rng.int(1, bw - 3);
        const ky = ty + rng.int(3, len - 4);
        b.set(kx, ky, P.black);
        b.set(kx + 1, ky, dk);
        b.set(kx, ky - 1, dk);
        b.set(kx, ky + 1, lt);
      }
      if (ty + len < y + h) {
        b.hline(px, ty + len - 1, bw, P.black);
        b.hline(px, ty + len, bw, lt);
      }
      ty += len + 1;
    }
    // La luz por la izquierda y la junta por la derecha.
    b.vline(px, y, h, lt);
    b.vline(px + bw - 1, y, h, dk);
    // Abajo, más oscura (le salpica la lluvia).
    for (let yy = Math.max(y, y + h - 10); yy < y + h; yy++)
      for (let xx = px; xx < px + bw; xx++)
        if (hash(xx, yy) < (yy - (y + h - 10)) / 14) b.set(xx, yy, dk);
    px += bw;
    i++;
    // El tapajuntas, encima de la junta (no en todas: unas van solo a tope).
    if (px < x + w - 1 && i % 3 !== 0) {
      b.vline(px - 1, y, h, P.rust);
      b.vline(px, y, h, P.bark);
      b.vline(px + 1, y, h, P.black);
      for (const ry of rails) {
        b.set(px - 1, ry, P.fog);
        b.set(px - 1, ry + 1, P.black);
      }
      px += 1;
    } else for (const ry of rails) b.set(px - 2, ry, P.slate);
  }
}

/** Tonos del yeso de cada paño: unos más blancos, otros tostados por el sol o el humo. */
const LIME: readonly (readonly [string, string, string])[] = [
  [P.skinS, P.skin, P.sand],
  [P.skinS, P.sand, P.white],
  [P.clay, P.skinS, P.skin],
  [P.skinS, P.skin, P.skin],
];

/** Entramado: postes y carreras de roble con yeso entre medias; cada paño, a su manera. */
function timberFace(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: string) {
  const rng = new Rng(`entramado-${seed}`);
  const rails: number[] = [y];
  for (let ry = y + 26 + rng.int(0, 8); ry < y + h - 6; ry += 28 + rng.int(0, 8)) rails.push(ry);
  rails.push(y + h);
  const posts: number[] = [x];
  for (let px = x + 16 + rng.int(0, 10); px < x + w - 8; px += 16 + rng.int(0, 12)) posts.push(px);
  posts.push(x + w);
  // Los paños: yeso con su tono, una sombra junto a la madera de arriba y alguna mancha.
  for (let r = 0; r + 1 < rails.length; r++)
    for (let c = 0; c + 1 < posts.length; c++) {
      const x0 = posts[c]!;
      const x1 = posts[c + 1]!;
      const y0 = rails[r]!;
      const y1 = rails[r + 1]!;
      const [dk, mid, lt] =
        LIME[
          rng.weighted([
            [0, 4],
            [1, 2],
            [2, 1],
            [3, 2],
          ] as const)
        ]!;
      b.rect(x0, y0, x1 - x0, y1 - y0, mid);
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const n = hash(xx, yy);
          if (n > 0.97) b.set(xx, yy, dk);
          else if (n < 0.04) b.set(xx, yy, lt);
        }
      // Sombra bajo la carrera y junto al poste de la izquierda.
      b.hline(x0, y0 + 3, x1 - x0, dk);
      b.vline(x0 + 3, y0, y1 - y0, dk);
      // Churretes bajo la carrera.
      if (rng.chance(0.4)) {
        const sx = x0 + 4 + rng.int(0, Math.max(0, x1 - x0 - 8));
        b.vline(sx, y0 + 4, 2 + rng.int(0, 6), dk);
      }
      // Grieta o desconchón con el ladrillo de dentro.
      if (rng.chance(0.15) && x1 - x0 > 10 && y1 - y0 > 12) {
        const cx = x0 + 5 + rng.int(0, x1 - x0 - 10);
        const cy = y0 + 6 + rng.int(0, y1 - y0 - 12);
        b.rect(cx, cy, 3, 2, P.clay);
        b.set(cx + 1, cy, P.rust);
        b.set(cx, cy + 2, dk);
      }
      // La riostra del paño.
      const kind = rng.weighted([
        ['none', 5],
        ['/', 2],
        ['\\', 2],
        ['x', 1.2],
        ['v', 1],
      ] as const);
      const brace = (ax: number, ay: number, bx: number, by: number) => {
        b.line(ax, ay, bx, by, P.bark);
        b.line(ax + 1, ay, bx + 1, by, P.rust);
        b.line(ax + 2, ay, bx + 2, by, P.plum);
      };
      const ix0 = x0 + 3;
      const ix1 = x1 - 3;
      const iy0 = y0 + 3;
      const iy1 = y1 - 1;
      if (ix1 - ix0 < 6) continue;
      if (kind === '/' || kind === 'x') brace(ix0, iy1, ix1 - 2, iy0);
      if (kind === '\\' || kind === 'x') brace(ix0, iy0, ix1 - 2, iy1);
      if (kind === 'v') {
        const mx = Math.round((ix0 + ix1) / 2) - 1;
        brace(ix0, iy0, mx, iy1);
        brace(mx, iy1, ix1 - 2, iy0);
      }
    }
  // La madera, encima: postes y carreras con su luz, su veta y las clavijas en los cruces.
  for (const px of posts) {
    if (px >= x + w) continue;
    b.rect(px, y, 3, h, P.bark);
    b.vline(px, y, h, P.rust);
    b.vline(px + 2, y, h, P.plum);
    for (let yy = y; yy < y + h; yy++) if (hash(px, yy, 3) < 0.12) b.set(px + 1, yy, P.plum);
  }
  for (const ry of rails) {
    if (ry >= y + h) continue;
    b.rect(x, ry, w, 3, P.bark);
    b.hline(x, ry, w, P.rust);
    b.hline(x, ry + 2, w, P.plum);
    for (let xx = x; xx < x + w; xx++) if (hash(xx, ry, 5) < 0.12) b.set(xx, ry + 1, P.plum);
    for (const px of posts) if (px < x + w) b.set(px + 1, ry + 1, P.black);
  }
}

/** Tonos de los sillares (sombra, cuerpo, luz). */
const STONES: readonly (readonly [string, string, string])[] = [
  [P.slate, P.steel, P.fog],
  [P.slate, P.steel, P.fog],
  [P.steel, P.fog, P.mist],
  [P.navy, P.slate, P.steel],
  [P.plum, P.rust, P.clay],
];

/** Sillería: hiladas de alto desigual, sillares de largo variado y biselados, con su mella. */
function ashlarFace(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: string) {
  const rng = new Rng(`sillar-${seed}`);
  b.rect(x, y, w, h, P.plum);
  let by = y;
  while (by < y + h) {
    const ch = rng.weighted([
      [5, 2],
      [6, 3],
      [7, 3],
      [9, 1],
    ] as const);
    let bx = x - rng.int(0, 10);
    while (bx < x + w) {
      const bw = rng.weighted([
        [7, 2],
        [10, 3],
        [13, 3],
        [17, 2],
        [22, 1],
      ] as const);
      const x0 = Math.max(x, bx + 1);
      const x1 = Math.min(x + w, bx + bw);
      const y0 = by + 1;
      const y1 = Math.min(y + h, by + ch);
      bx += bw;
      if (x1 <= x0 || y1 <= y0) continue;
      const [dk, mid, lt] =
        STONES[
          rng.weighted([
            [0, 5],
            [1, 2],
            [2, 1.4],
            [3, 1.2],
            [4, 0.1],
          ] as const)
        ]!;
      b.rect(x0, y0, x1 - x0, y1 - y0, mid);
      // Grano de la piedra.
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const n = hash(xx, yy, 7);
          if (n < 0.07) b.set(xx, yy, dk);
          else if (n > 0.95) b.set(xx, yy, lt);
        }
      // Bisel: luz arriba e izquierda, sombra abajo y derecha.
      b.hline(x0, y0, x1 - x0, lt);
      b.vline(x0, y0, y1 - y0, lt);
      b.hline(x0 + 1, y1 - 1, x1 - x0 - 1, dk);
      b.vline(x1 - 1, y0 + 1, y1 - y0 - 1, dk);
      // Una esquina mellada.
      if (rng.chance(0.3)) {
        const cx = rng.chance(0.5) ? x0 : x1 - 1;
        const cy = rng.chance(0.5) ? y0 : y1 - 1;
        b.set(cx, cy, P.plum);
        b.set(cx + (cx === x0 ? 1 : -1), cy, dk);
      }
      // Una grieta fina.
      if (rng.chance(0.08) && x1 - x0 > 8) {
        const gx = x0 + 3 + rng.int(0, x1 - x0 - 6);
        for (let yy = y0 + 1; yy < y1 - 1; yy++) b.set(gx + ((yy - y0) % 2), yy, dk);
      }
    }
    by += ch;
  }
}

// ---------- En corte ----------

/**
 * El grueso del muro cortado: una franja de `w` × `h` con la cara de fuera a la izquierda
 * (`outLeft`) o a la derecha. `cellar` para los muros de los sótanos (piedra más oscura).
 */
export function wallSection(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  outLeft: boolean,
  walls: WallId | 'sotano' = 'tablas',
): void {
  if (w <= 0 || h <= 0) return;
  // Cada columna de la franja, contada desde la cara de fuera.
  const col = (i: number) => (outLeft ? x + i : x + w - 1 - i);
  if (walls === 'piedra' || walls === 'sotano') rubbleSection(b, x, y, w, h, col, walls);
  else if (walls === 'entramado') daubSection(b, x, y, w, h, col);
  else if (walls === 'troncos') logsSection(b, x, y, w, h);
  else if (walls === 'ladrillo') brickSection(b, x, y, w, h);
  else if (walls === 'tapial') rammedSection(b, x, y, w, h, col);
  else if (walls === 'pizarra') slateSection(b, x, y, w, h);
  else if (walls === 'encalado') limeSection(b, x, y, w, h, col);
  else boardSection(b, y, w, h, col);
}

/** Testa de un madero (los anillos): `w` × `h` en (x, y). */
function endGrain(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  b.rect(x, y, w, h, P.rust);
  b.rect(x + 1, y + 1, w - 2, h - 2, P.oak);
  if (w > 4 && h > 4) b.rect(x + 2, y + 2, w - 4, h - 4, P.clay);
  b.set(x + Math.floor(w / 2), y + Math.floor(h / 2), P.rust);
  // La raja de secado.
  b.set(x + Math.floor(w / 2) + 1, y + Math.floor(h / 2) - 1, P.bark);
  b.hline(x, y + h - 1, w, P.bark);
}

/** Tablas en corte: forro de fuera, cámara oscura con los travesaños por la testa y forro de dentro. */
function boardSection(b: PixelBuffer, y: number, w: number, h: number, col: (i: number) => number) {
  const skin = Math.max(2, Math.round(w / 6));
  for (let yy = y; yy < y + h; yy++)
    for (let i = 0; i < w; i++) {
      const xx = col(i);
      const outer = i < skin;
      const inner = i >= w - skin;
      if (outer || inner) {
        // Canto de la tabla: veta a lo largo, con el empalme cada tanto.
        const joint = (yy - y + (outer ? 0 : 17)) % 41 === 0;
        const edge = outer ? i === 0 : i === w - 1;
        b.set(xx, yy, joint ? P.black : edge ? P.plum : hash(xx, yy, 2) < 0.2 ? P.rust : P.oak);
      } else b.set(xx, yy, hash(xx, yy, 4) < 0.08 ? P.plum : P.ebony);
    }
  // Travesaños (por la testa), cada 24.
  for (let ty = y + 8; ty + 6 < y + h; ty += 24) {
    const a = Math.min(col(skin), col(w - skin - 1));
    endGrain(b, a, ty, w - 2 * skin, 6);
  }
}

/** Entramado en corte: revoco a los dos lados, barro con el zarzo y las carreras por la testa. */
function daubSection(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  col: (i: number) => number,
) {
  for (let yy = y; yy < y + h; yy++)
    for (let i = 0; i < w; i++) {
      const xx = col(i);
      // El revoco: más grueso por fuera que por dentro.
      // Un tono por debajo de la cara (en el corte no da el sol: si no, deslumbra).
      if (i === 0 || i === w - 1) b.set(xx, yy, P.skinS);
      else if (i === 1 || i === w - 2 || (w > 10 && i === 2)) b.set(xx, yy, P.clay);
      else {
        // El barro con paja.
        const n = hash(xx, yy, 6);
        b.set(xx, yy, n < 0.1 ? P.clay : n > 0.88 ? P.bark : P.rust);
      }
    }
  // El zarzo: las varas, cortadas, en zigzag de un lado al otro.
  for (let k = 0, yy = y + 3; yy < y + h - 2; k++, yy += 5) {
    const i = 3 + (k % 2 ? w - 8 : 0) + (k % 4 === 1 ? 1 : 0);
    const xx = Math.min(col(i), col(i + 1));
    b.rect(xx, yy, 2, 2, P.plum);
    b.set(xx, yy, P.oak);
  }
  // Las carreras, por la testa, cada 30.
  for (let ty = y + 2; ty + 7 < y + h; ty += 30) endGrain(b, x, ty, w, 7);
}

/** Piedra en corte: dos hojas de sillar (de grueso alterno, se ve la traba) y mampuesto dentro. */
function rubbleSection(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  col: (i: number) => number,
  walls: 'piedra' | 'sotano',
) {
  const dark = walls === 'sotano';
  const mortar = dark ? P.navy : P.slate;
  const face = dark ? [P.slate, P.steel, P.navy] : [P.steel, P.fog, P.slate];
  const rubble = dark ? [P.slate, P.steel] : [P.steel, P.fog];
  b.rect(x, y, w, h, mortar);
  // El relleno: piedrecitas sueltas.
  for (let yy = y; yy < y + h; yy += 2)
    for (let i = 2; i < w - 2; i += 2) {
      const xx = col(i);
      const n = hash(xx, yy, 9);
      if (n < 0.55) {
        const c = rubble[n < 0.25 ? 1 : 0]!;
        b.set(xx, yy, c);
        b.set(xx + (hash(xx, yy, 1) < 0.5 ? 1 : -1), yy, c);
        b.set(xx, yy + 1, dark ? P.navy : P.steel);
      }
    }
  // Las hojas de sillar, por hiladas de 7: una más honda y otra menos.
  for (const side of [0, 1])
    for (let k = 0, yy = y; yy < y + h; k++, yy += 7) {
      const deep = Math.round(w * ((k + side) % 2 ? 0.36 : 0.22));
      const yh = Math.min(6, y + h - yy - 1);
      if (yh <= 0) continue;
      for (let i = 0; i < deep; i++) {
        const xx = col(side ? w - 1 - i : i);
        b.vline(xx, yy + 1, yh, i === 0 ? face[1]! : face[0]!);
        b.set(xx, yy + yh, face[2]!);
      }
    }
}
