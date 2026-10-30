import { Rng } from '../core/rng';
import { P } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';
import { GROUND, SPAN, WORLD_H, WORLD_X0 } from './geometry';

/**
 * Ancho de las capas lejanas: más que el mundo, porque con el zoom más alejado y el
 * paralaje (se mueven menos que la cámara) tienen que seguir cubriendo la vista.
 */
export const LAYER_W = SPAN + 512;

/**
 * Todas las capas miden LAYER_W de ancho y su píxel 0 está en WORLD_X0 (se pintan desplazadas).
 *
 * Capas lejanas de la noche: cielo, montañas, colinas con aldea y castillo, y una
 * hilera de árboles. Cada una se desplaza a una fracción de la cámara (paralaje).
 */

export interface ParallaxLayer {
  buf: PixelBuffer;
  /** Fracción del movimiento de cámara (0 = fijo, 1 = como el mundo). */
  fx: number;
  fy: number;
}

export interface Star {
  x: number;
  y: number;
  bright: boolean;
}

const SKY = [P.black, P.navy, P.slate, P.steel];

export function buildSky(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (let y = 0; y < WORLD_H; y++) {
    const t = Math.min(1, Math.max(0, (y - 20) / 210));
    const v = t * (SKY.length - 1.3);
    for (let x = 0; x < LAYER_W; x++) {
      const base = Math.floor(v);
      const f = v - base;
      const step = f > 0.7 ? (f - 0.7) / 0.3 > bayer(x, y) : false;
      b.set(x, y, SKY[Math.min(SKY.length - 1, base + (step ? 1 : 0))]!);
    }
  }
  return b;
}

/**
 * La luna con su halo tramado y cráteres, aparte del cielo: se pinta solo de noche, en lo
 * alto de la vista, y se desvanece con la luz del día.
 */
export const MOON_R = 34;
export function buildMoon(): PixelBuffer {
  const b = new PixelBuffer(MOON_R * 2 + 1, MOON_R * 2 + 1);
  const mx = MOON_R;
  const my = MOON_R;
  for (let y = my - 34; y <= my + 34; y++) {
    for (let x = mx - 34; x <= mx + 34; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d > 15 && d < 34 && bayer(x, y) < ((34 - d) / 19) * 0.35)
        b.set(x, y, d < 22 ? P.steel : P.slate);
    }
  }
  b.ellipse(mx, my, 13, 13, (x, y) => {
    const lit = (x - mx) * -0.5 + (y - my) * -0.4;
    return lit < -5 + bayer(x, y) * 2 ? P.fog : lit > 4 ? P.white : P.mist;
  });
  for (const [cx, cy, r] of [
    [mx - 4, my - 3, 2.6],
    [mx + 4, my + 4, 3.2],
    [mx + 5, my - 6, 1.6],
    [mx - 5, my + 6, 1.4],
  ] as const) {
    b.ellipse(cx, cy, r, r, P.fog);
    b.set(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), P.mist);
  }
  return b;
}

export function stars(): Star[] {
  const rng = new Rng('estrellas');
  return Array.from({ length: 130 }, () => ({
    x: rng.int(0, LAYER_W - 1),
    y: rng.int(0, 230),
    bright: rng.chance(0.2),
  }));
}

/** Silueta de montañas: masa oscura, filo iluminado por la luna y nieve en las cumbres. */
export function buildMountains(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  const ridge = (x: number) => {
    // Picos marcados: valor absoluto de senos (crestas) más detalle.
    const a = Math.abs(Math.sin(x * 0.013 + 0.4)) * 58;
    const c = Math.abs(Math.sin(x * 0.029 + 2.1)) * 22;
    return 238 - a - c - Math.sin(x * 0.11) * 3;
  };
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(ridge(x));
    const slope = ridge(x + 1) - ridge(x - 1); // > 0: la cresta baja hacia la derecha (cara a la luna)
    for (let y = top; y < GROUND; y++) {
      const depth = y - top;
      let c: string = P.navy;
      if (depth > 18 && bayer(x, y) < Math.min(1, (depth - 18) / 30)) c = P.black;
      // Filo iluminado (2–4 px) en las caras que miran a la luna.
      if (slope < -0.25 && depth < 2 + Math.min(3, -slope * 2)) c = P.slate;
      if (slope < -0.6 && depth === 0) c = P.steel;
      // Nieve en las cumbres altas.
      if (top < 176 && depth < 7 - Math.floor((top - 150) / 6) && (x + depth) % 4 !== 0)
        c = slope < 0 ? P.mist : P.fog;
      b.set(x, y, c);
    }
  }
  return b;
}

/** Colinas con una aldea dormida y un castillo con una ventana encendida. */
export function buildHills(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  const rng = new Rng('aldea');
  const hill = (x: number) => 252 - Math.sin(x * 0.017 + 0.6) * 16 - Math.sin(x * 0.043) * 6;
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(hill(x));
    for (let y = top; y < GROUND + 4; y++) b.set(x, y, y - top < 1 ? P.forest : P.deep);
  }
  // Casas: tejado, muro y ventanas encendidas.
  for (let i = 0; i < Math.ceil(LAYER_W / 52); i++) {
    const x = 30 + i * 52 + rng.int(-10, 10);
    const base = Math.round(hill(x + 5)) + 3;
    const w = rng.int(9, 14);
    const h = rng.int(6, 9);
    b.rect(x, base - h, w, h, P.black);
    b.poly(
      [
        [x - 1, base - h],
        [x + w / 2, base - h - 6],
        [x + w + 1, base - h],
      ],
      P.black,
    );
    if (rng.chance(0.8)) b.set(x + 3, base - h + 3, P.gold);
    if (rng.chance(0.5)) b.set(x + w - 4, base - h + 3, P.lemon);
    if (rng.chance(0.4)) b.rect(x + w - 3, base - h - 6, 2, 4, P.black);
  }
  // Castillo en la loma de la derecha.
  const cx = 420 - WORLD_X0;
  const cb = Math.round(hill(cx)) + 2;
  b.rect(cx, cb - 22, 26, 22, P.black);
  for (const tx of [cx - 4, cx + 24]) {
    b.rect(tx, cb - 32, 7, 32, P.black);
    for (let k = 0; k < 7; k += 2) b.rect(tx + k, cb - 34, 1, 2, P.black);
  }
  for (let k = 0; k < 26; k += 3) b.rect(cx + k, cb - 24, 2, 2, P.black);
  b.set(cx + 27, cb - 26, P.gold);
  b.set(cx + 12, cb - 14, P.lemon);
  b.vline(cx + 1, cb - 42, 10, P.black);
  b.rect(cx + 2, cb - 42, 4, 2, P.wine);
  return b;
}

/**
 * Bosque lejano: muchos abetos pequeños y apretados, en tonos de niebla (lo lejano se ve más
 * claro). Va entre las colinas y la hilera de árboles.
 */
export function buildForest(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  const rng = new Rng('bosque lejano');
  for (let i = 0; i < 150; i++) {
    const x = rng.int(-6, LAYER_W + 6);
    const h = rng.int(10, 22);
    const base = GROUND + 1;
    for (let y = 0; y < h; y++) {
      const w = Math.floor((y / h) * 5) + (y % 4 < 2 ? 1 : 0);
      for (let dx = -w; dx <= w; dx++)
        b.set(x + dx, base - h + y, dx < 0 && y % 4 !== 3 ? P.steel : P.slate);
    }
  }
  return b;
}

/**
 * Arboleda cercana: pocos árboles grandes y oscuros, en grupos, con el filo de la copa
 * iluminado por la luna. Es la capa que más se mueve (casi como el mundo).
 */
export function buildGrove(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  const rng = new Rng('arboleda cercana');
  for (let g = 0; g < Math.ceil(LAYER_W / 260); g++) {
    const gx = g * 260 + rng.int(0, 120);
    for (let i = 0; i < rng.int(2, 4); i++) {
      const x = gx + rng.int(-30, 30);
      const h = rng.int(55, 95);
      const base = GROUND + 4;
      if (rng.chance(0.6)) {
        for (let y = 0; y < h; y++) {
          const w = Math.floor((y / h) * 15) + (y % 8 < 4 ? 2 : 0);
          for (let dx = -w; dx <= w; dx++) {
            const rim = dx === -w && y % 8 < 4;
            b.set(x + dx, base - h + y, rim ? P.deep : P.black);
          }
        }
      } else {
        const r = Math.round(h * 0.3);
        b.ellipse(x, base - h + r, r, r * 0.9, (px, py) =>
          px - x + (py - (base - h + r)) < -r * 1.05 + bayer(px, py) * 3 ? P.deep : P.black,
        );
        b.rect(x - 2, base - h + r * 1.6, 5, h - r * 1.6, P.black);
      }
    }
  }
  return b;
}

/** Hilera de árboles oscuros justo detrás del edificio. */
export function buildTreeline(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  const rng = new Rng('arboleda');
  for (let i = 0; i < 60; i++) {
    const x = rng.int(-10, LAYER_W + 10);
    const h = rng.int(30, 60);
    const base = GROUND + 2;
    const conifer = rng.chance(0.55);
    if (conifer) {
      for (let y = 0; y < h; y++) {
        const w = Math.floor((y / h) * 9) + (y % 6 < 3 ? 1 : 0);
        b.hline(x - w, base - h + y, w * 2 + 1, y % 6 === 0 && y > 4 ? P.deep : P.black);
      }
    } else {
      b.ellipse(x, base - h + 14, 14, 14, (px, py) =>
        px - x + (py - (base - h + 14)) < -12 + bayer(px, py) * 4 ? P.deep : P.black,
      );
      b.rect(x - 1, base - h + 24, 3, h - 24, P.black);
    }
  }
  return b;
}

/** Las capas del fondo, de la más lejana (la que menos se mueve) a la más cercana. */
export function parallaxLayers(): ParallaxLayer[] {
  return [
    { buf: buildMountains(), fx: 0.25, fy: 0.5 },
    { buf: buildHills(), fx: 0.45, fy: 0.65 },
    { buf: buildForest(), fx: 0.6, fy: 0.78 },
    { buf: buildTreeline(), fx: 0.75, fy: 0.88 },
    { buf: buildGrove(), fx: 0.9, fy: 0.95 },
  ];
}
