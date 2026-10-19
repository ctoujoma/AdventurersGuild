import { Rng } from '../core/rng';
import { P, darker, type Ramp } from '../art/palette';
import { PixelBuffer, alpha, bayer, toHex } from '../art/pixel';

/**
 * Pinceles del edificio: piedra, madera, yeso, oclusión ambiental… Todo trabaja sobre un
 * PixelBuffer, con la paleta y tramados ordenados para que se lea como pixel art pintado a mano.
 */

/** Sillería: bloques con luz arriba-izquierda, sombra abajo-derecha, juntas y desconchones. */
export function stoneWall(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  opts: { ramp?: Ramp; bw?: number; bh?: number; moss?: number } = {},
): void {
  const ramp = opts.ramp ?? [P.black, P.navy, P.slate, P.steel, P.fog];
  const bw = opts.bw ?? 10;
  const bh = opts.bh ?? 6;
  const rng = new Rng(seed);
  b.rect(x, y, w, h, ramp[1]!);
  for (let row = 0, by = y; by < y + h; row++, by += bh) {
    const off = row % 2 ? -Math.floor(bw / 2) : 0;
    for (let bx = x + off; bx < x + w; bx += bw) {
      const x0 = Math.max(bx + 1, x);
      const x1 = Math.min(bx + bw, x + w);
      const y0 = by + 1;
      const y1 = Math.min(by + bh, y + h);
      if (x1 <= x0 || y1 <= y0) continue;
      const tone = rng.weighted([
        [2, 5],
        [3, 2],
        [1, 1],
      ] as const);
      const base = ramp[tone]!;
      const light = ramp[Math.min(ramp.length - 1, tone + 1)]!;
      const dark = ramp[Math.max(0, tone - 1)]!;
      b.rect(x0, y0, x1 - x0, y1 - y0, base);
      b.hline(x0, y0, x1 - x0, light);
      b.vline(x0, y0, y1 - y0, light);
      b.hline(x0, y1 - 1, x1 - x0, dark);
      b.vline(x1 - 1, y0 + 1, y1 - y0 - 1, dark);
      // Desconchones y grietas.
      if (rng.chance(0.25))
        b.set(
          x0 + rng.int(1, Math.max(1, x1 - x0 - 2)),
          y0 + rng.int(1, Math.max(1, y1 - y0 - 2)),
          dark,
        );
      if (rng.chance(0.12)) b.set(x0 + rng.int(1, Math.max(1, x1 - x0 - 2)), y0 + 1, light);
      // Musgo en las hileras bajas.
      if (opts.moss && by > y + h - opts.moss && rng.chance(0.45)) {
        const mx = x0 + rng.int(0, Math.max(0, x1 - x0 - 3));
        b.hline(mx, y1 - 1, rng.int(2, 4), P.forest);
        if (rng.chance(0.5)) b.set(mx + 1, y1 - 2, P.leaf);
      }
    }
  }
}

/** Tablones verticales con veta, nudos y clavos. */
export function planksV(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  ramp: Ramp = [P.plum, P.bark, P.rust, P.oak],
  pw = 7,
): void {
  const rng = new Rng(seed);
  for (let px = x, i = 0; px < x + w; px += pw, i++) {
    const ww = Math.min(pw, x + w - px);
    const tone = 1 + ((i * 7 + rng.int(0, 1)) % 2);
    b.rect(px, y, ww, h, ramp[tone]!);
    b.vline(px, y, h, ramp[0]!);
    if (ww > 2) b.vline(px + 1, y, h, ramp[Math.min(ramp.length - 1, tone + 1)]!);
    // Veta.
    for (let k = 0; k < Math.floor(h / 6); k++) {
      const gx = px + 2 + rng.int(0, Math.max(0, ww - 4));
      const gy = y + rng.int(0, h - 1);
      b.vline(gx, gy, rng.int(2, 6), ramp[Math.max(0, tone - 1)]!);
    }
    if (rng.chance(0.35) && h > 8) {
      const kx = px + 2 + rng.int(0, Math.max(0, ww - 5));
      const ky = y + rng.int(2, h - 4);
      b.rect(kx, ky, 2, 2, ramp[0]!);
      b.set(kx, ky - 1, ramp[Math.max(0, tone - 1)]!);
    }
    b.set(px + Math.floor(ww / 2), y + 1, P.black);
    b.set(px + Math.floor(ww / 2), y + h - 2, P.black);
  }
}

/** Tablones horizontales escalonados (suelos, paredes de dormitorio, desván). */
export function planksH(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  ramp: Ramp = [P.plum, P.bark, P.rust, P.oak],
  ph = 5,
): void {
  const rng = new Rng(seed);
  for (let py = y, row = 0; py < y + h; py += ph, row++) {
    const hh = Math.min(ph, y + h - py);
    let px = x - rng.int(0, 30);
    while (px < x + w) {
      const len = rng.int(18, 40);
      const tone = rng.weighted([
        [1, 2],
        [2, 3],
      ] as const);
      const x0 = Math.max(px, x);
      const x1 = Math.min(px + len, x + w);
      if (x1 > x0) {
        b.rect(x0, py, x1 - x0, hh, ramp[tone]!);
        b.hline(x0, py, x1 - x0, ramp[Math.min(ramp.length - 1, tone + 1)]!);
        b.hline(x0, py + hh - 1, x1 - x0, ramp[0]!);
        if (px >= x) b.vline(px, py, hh, ramp[0]!);
        for (let k = 0; k < len / 9; k++)
          b.hline(
            x0 + rng.int(0, Math.max(0, x1 - x0 - 4)),
            py + rng.int(1, Math.max(1, hh - 2)),
            rng.int(2, 5),
            ramp[Math.max(0, tone - 1)]!,
          );
        if (px >= x) {
          b.set(px + 2, py + 1, P.black);
          b.set(px + 2, py + hh - 2, P.black);
        }
      }
      px += len;
    }
  }
}

/** Yeso: tono plano con motas sueltas y pinceladas cortas; en ruinas, grietas y boquetes. */
export function plaster(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  ramp: Ramp,
  ruined = false,
): void {
  const rng = new Rng(seed);
  const mid = Math.min(ramp.length - 2, Math.floor(ramp.length / 2));
  b.rect(x, y, w, h, ramp[mid]!);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const n = hash(x + i, y + j);
      if (n > 0.965) b.set(x + i, y + j, ramp[mid - 1]!);
      else if (n < 0.02) b.set(x + i, y + j, ramp[mid + 1]!);
    }
  }
  // Pinceladas horizontales cortas, más claras.
  for (let k = 0; k < (w * h) / 90; k++) {
    const px = x + rng.int(0, w - 6);
    const py = y + rng.int(0, h - 1);
    b.hline(px, py, rng.int(2, 5), ramp[mid + 1]!);
  }
  // Manchas de humedad abajo.
  for (let k = 0; k < w / 30; k++) {
    const px = x + rng.int(0, w - 8);
    for (let j = 0; j < rng.int(2, 5); j++)
      b.hline(px + rng.int(0, 2), y + h - 1 - j, rng.int(3, 7), ramp[mid - 1]!);
  }
  if (!ruined) return;
  for (let c = 0; c < 4; c++) {
    let cx = x + rng.int(4, w - 4);
    let cy = y + rng.int(1, 6);
    for (let s2 = 0; s2 < rng.int(8, 16); s2++) {
      b.set(cx, cy, ramp[0]!);
      cx += rng.int(-1, 1);
      cy += 1;
    }
  }
  for (let k = 0; k < 2; k++) {
    const hx = x + rng.int(4, Math.max(5, w - 22));
    const hy = y + rng.int(4, Math.max(5, h - 18));
    const hw = rng.int(10, 18);
    const hh = rng.int(7, 11);
    b.ellipse(hx + hw / 2, hy + hh / 2, hw / 2 + 1, hh / 2 + 1, ramp[0]!);
    b.ellipse(hx + hw / 2, hy + hh / 2, hw / 2, hh / 2, P.plum);
    for (let r = 1; r < hh; r += 2) b.hline(hx + 2, hy + r, hw - 3, P.bark);
  }
}

function hash(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 10000) / 10000;
}

/** Viga con brillo arriba y sombra abajo. */
export function beam(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp = [P.black, P.plum, P.bark, P.rust],
): void {
  b.rect(x, y, w, h, ramp[2]!);
  b.hline(x, y, w, ramp[3]!);
  b.hline(x, y + h - 1, w, ramp[0]!);
  if (h > 3) b.hline(x, y + h - 2, w, ramp[1]!);
}

export function post(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp = [P.black, P.plum, P.bark, P.rust],
): void {
  b.rect(x, y, w, h, ramp[2]!);
  b.vline(x, y, h, ramp[3]!);
  b.vline(x + w - 1, y, h, ramp[0]!);
  if (w > 3) b.vline(x + w - 2, y, h, ramp[1]!);
}

/** Oscurece hacia los bordes de una habitación con tramado (oclusión ambiental). */
export function ambientOcclusion(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  depth = 6,
  sides = { top: true, bottom: true, left: true, right: true },
): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let d = Infinity;
      if (sides.top) d = Math.min(d, j);
      if (sides.bottom) d = Math.min(d, h - 1 - j);
      if (sides.left) d = Math.min(d, i);
      if (sides.right) d = Math.min(d, w - 1 - i);
      if (d >= depth) continue;
      const p = (1 - d / depth) * 0.85;
      const px = x + i;
      const py = y + j;
      if (bayer(px, py) < p) {
        const c = b.get(px, py);
        if (alpha(c)) b.set(px, py, darker(toHex(c)));
      }
    }
  }
}

/** Sombra de contacto bajo un objeto (elipse oscura tramada). */
export function contactShadow(
  b: PixelBuffer,
  cx: number,
  y: number,
  rx: number,
  strength = 0.7,
): void {
  for (let i = -rx; i <= rx; i++) {
    for (let j = -1; j <= 1; j++) {
      const t = 1 - Math.abs(i) / (rx + 1) - Math.abs(j) * 0.35;
      if (t <= 0) continue;
      const px = Math.round(cx + i);
      const py = y + j;
      if (bayer(px, py) < t * strength) {
        const c = b.get(px, py);
        if (alpha(c)) b.set(px, py, darker(toHex(c)));
      }
    }
  }
}

/** Telaraña en una esquina (sup-izq si dir=1; sup-der si dir=-1). */
export function cobweb(b: PixelBuffer, x: number, y: number, size: number, dir: 1 | -1): void {
  const c = P.fog;
  for (let i = 0; i <= size; i++) {
    b.set(x + dir * i, y, c);
    b.set(x, y + i, c);
  }
  for (let r = 3; r <= size; r += 3) {
    for (let t = 0; t <= r; t++) {
      if ((t + r) % 2) continue;
      b.set(x + dir * t, y + (r - t) - Math.floor((t * (r - t)) / (r * 2)), c);
    }
  }
  for (let i = 0; i < size; i += 2) b.set(x + dir * i, y + i, c);
}
