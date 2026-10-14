import { Rng } from '../core/rng';
import type { Terrain } from '../data/places';
import { P } from './palette';
import { PixelBuffer, bayer, rampAt } from './pixel';

/**
 * Escenarios de las peleas contra jefes, de noche: el vado con su río y sus piedras, la
 * boca de la cueva en la sierra, la orilla de la laguna con árboles muertos y niebla… Cada
 * uno es un único búfer del tamaño de la pelea; el suelo queda en `ARENA.ground`.
 */

export const ARENA = { w: 224, h: 126, ground: 108 } as const;

const SKY = [P.black, P.navy, P.slate];

function sky(b: PixelBuffer, rng: Rng, horizon: number): void {
  for (let y = 0; y < horizon; y++)
    for (let x = 0; x < b.w; x++) b.set(x, y, rampAt(SKY, (y / horizon) * 0.8, x, y));
  for (let i = 0; i < 46; i++) {
    const x = rng.int(0, b.w - 1);
    const y = rng.int(0, horizon - 20);
    b.set(x, y, rng.chance(0.25) ? P.white : P.fog);
  }
  // Luna con halo tramado.
  const mx = 176;
  const my = 20;
  for (let y = my - 18; y <= my + 18; y++)
    for (let x = mx - 18; x <= mx + 18; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d > 8 && d < 18 && bayer(x, y) < ((18 - d) / 10) * 0.35) b.set(x, y, P.steel);
    }
  b.ellipse(mx, my, 7, 7, (x, y) => ((x - mx) * -0.5 + (y - my) * -0.4 < -2 ? P.fog : P.mist));
  b.set(mx - 2, my - 1, P.fog);
  b.set(mx + 2, my + 2, P.fog);
}

/** Silueta lejana: una línea de altura por columna, rellena hasta abajo. */
function ridge(
  b: PixelBuffer,
  top: (x: number) => number,
  bottom: number,
  color: string | ((x: number, y: number) => string),
): void {
  for (let x = 0; x < b.w; x++)
    for (let y = Math.round(top(x)); y < bottom; y++)
      b.set(x, y, typeof color === 'string' ? color : color(x, y));
}

function tree(b: PixelBuffer, x: number, base: number, h: number, c: string, dead = false): void {
  b.vline(x, base - h, h, c);
  b.vline(x + 1, base - h + 2, h - 2, c);
  if (dead) {
    for (const [dy, len, dir] of [
      [h * 0.4, 6, -1],
      [h * 0.6, 5, 1],
      [h * 0.8, 4, -1],
    ] as const) {
      const y = Math.round(base - dy);
      b.line(x, y, x + dir * len, y - len * 0.6, c);
    }
    return;
  }
  b.ellipse(x + 0.5, base - h, 5, 7, c);
  b.ellipse(x - 2, base - h + 4, 4, 4, c);
  b.ellipse(x + 3, base - h + 4, 4, 4, c);
}

function reeds(b: PixelBuffer, rng: Rng, x0: number, x1: number, base: number): void {
  for (let x = x0; x < x1; x += rng.int(1, 3)) {
    const h = rng.int(6, 13);
    b.line(x, base, x + rng.int(-1, 1), base - h, rng.chance(0.5) ? P.forest : P.deep);
    if (rng.chance(0.35)) {
      b.rect(x, base - h - 1, 1, 3, P.bark);
    }
  }
}

/** Suelo en primer plano con textura (hierba, roca o barro). */
function ground(b: PixelBuffer, top: number, ramp: readonly string[], rng: Rng): void {
  for (let y = top; y < b.h; y++)
    for (let x = 0; x < b.w; x++) b.set(x, y, rampAt(ramp, 0.75 - (y - top) / 40, x, y));
  for (let i = 0; i < 60; i++) {
    const x = rng.int(0, b.w - 1);
    const y = rng.int(top + 1, b.h - 1);
    b.set(x, y, ramp[ramp.length - 1]!);
  }
}

function riverArena(rng: Rng): PixelBuffer {
  const { w, h, ground: g } = ARENA;
  const b = new PixelBuffer(w, h);
  sky(b, rng, 86);
  ridge(b, (x) => 66 + Math.sin(x * 0.04) * 6 + Math.sin(x * 0.11) * 2, 86, P.navy);
  for (let x = 6; x < w; x += rng.int(10, 22)) tree(b, x, 80, rng.int(8, 14), P.black);
  // Orilla de enfrente y el río, con el reflejo de la luna.
  b.rect(0, 82, w, 3, P.deep);
  for (let y = 85; y < g - 8; y++)
    for (let x = 0; x < w; x++) b.set(x, y, rampAt([P.navy, P.ocean, P.navy], (y - 85) / 16, x, y));
  for (let y = 86; y < g - 9; y += 2)
    for (let x = 170 + ((y * 7) % 5) - 3; x < 182 - ((y * 5) % 4); x++)
      if (bayer(x, y) < 0.6) b.set(x, y, y % 4 ? P.fog : P.mist);
  for (let i = 0; i < 18; i++)
    b.hline(rng.int(0, w - 8), rng.int(86, g - 10), rng.int(3, 7), P.sky);
  // Las piedras del vado.
  for (const [x, y, r] of [
    [40, 96, 4],
    [66, 93, 3],
    [96, 97, 5],
    [130, 94, 3],
    [158, 97, 4],
    [196, 95, 3],
  ] as const) {
    b.ellipse(x, y, r + 1, r * 0.6, P.slate);
    b.ellipse(x - 1, y - 1, r, r * 0.4, P.steel);
  }
  ground(b, g - 8, [P.black, P.deep, P.forest, P.leaf], rng);
  reeds(b, rng, 0, 26, g - 7);
  reeds(b, rng, 200, w, g - 7);
  return b;
}

function caveArena(rng: Rng): PixelBuffer {
  const { w, h, ground: g } = ARENA;
  const b = new PixelBuffer(w, h);
  sky(b, rng, 90);
  // Sierra con nieve.
  const peak = (x: number) => 50 + Math.abs(((x * 0.9) % 70) - 35) * 0.9 + Math.sin(x * 0.2) * 2;
  ridge(b, peak, 90, (x, y) =>
    y < peak(x) + 5 && bayer(x, y) < 0.55 ? P.fog : bayer(x, y) < 0.4 ? P.slate : P.navy,
  );
  ridge(b, (x) => 76 + Math.sin(x * 0.07) * 5, g - 6, P.black);
  // La peña con la boca de la cueva a la derecha.
  const rock = (x: number) => 22 + Math.pow(Math.max(0, 160 - x) / 6, 2) + Math.sin(x * 0.3) * 2;
  for (let x = 110; x < w; x++)
    for (let y = Math.round(rock(x)); y < g; y++)
      b.set(
        x,
        y,
        rampAt(
          [P.black, P.navy, P.slate, P.steel],
          0.75 - (x - 110) / 200 - (y - rock(x)) / 260,
          x,
          y,
        ),
      );
  b.ellipse(186, g - 4, 26, 36, P.steel);
  b.ellipse(186, g - 4, 24, 34, (x, y) => (bayer(x, y) < 0.08 ? P.navy : P.black));
  // Grietas en la roca.
  for (let i = 0; i < 9; i++) {
    const x = rng.int(124, w - 4);
    const y = rng.int(Math.round(rock(x)) + 4, g - 20);
    b.line(x, y, x + rng.int(-3, 3), y + rng.int(3, 7), P.black);
  }
  ground(b, g - 6, [P.black, P.navy, P.slate, P.steel], rng);
  // Huesos y chamusquinas.
  for (let i = 0; i < 7; i++) {
    const x = rng.int(20, 200);
    const y = rng.int(g - 3, h - 4);
    b.hline(x, y, rng.int(3, 5), P.mist);
    b.set(x - 1, y - 1, P.mist);
  }
  for (let i = 0; i < 5; i++) {
    const x = rng.int(60, 200);
    const y = rng.int(g - 2, h - 6);
    b.ellipse(x, y, rng.int(5, 9), 2, (px, py) => (bayer(px, py) < 0.55 ? P.black : P.navy));
  }
  return b;
}

function marshArena(rng: Rng): PixelBuffer {
  const { w, h, ground: g } = ARENA;
  const b = new PixelBuffer(w, h);
  sky(b, rng, 84);
  ridge(b, (x) => 72 + Math.sin(x * 0.05) * 3, 84, P.navy);
  for (let x = 4; x < w; x += rng.int(14, 26)) tree(b, x, 82, rng.int(12, 22), P.black, true);
  // La laguna, oscura y verdosa, con nenúfares y el reflejo de la luna.
  for (let y = 82; y < g - 6; y++)
    for (let x = 0; x < w; x++) b.set(x, y, rampAt([P.black, P.deep, P.navy], (y - 82) / 22, x, y));
  for (let y = 84; y < g - 8; y += 2)
    for (let x = 172; x < 181; x++) if (bayer(x, y) < 0.45) b.set(x, y, P.fog);
  for (let i = 0; i < 9; i++) {
    const x = rng.int(10, w - 10);
    const y = rng.int(86, g - 10);
    b.ellipse(x, y, 3, 1.2, P.forest);
    b.set(x + 1, y, P.deep);
  }
  // Niebla baja sobre el agua.
  for (let y = 88; y < 100; y++)
    for (let x = 0; x < w; x++)
      if (bayer(x, y) < 0.18 * (1 - Math.abs(y - 94) / 7) * (1 + Math.sin(x * 0.05)))
        b.set(x, y, P.steel);
  ground(b, g - 6, [P.black, P.ebony, P.plum, P.umber], rng);
  for (let i = 0; i < 6; i++) {
    const x = rng.int(10, w - 20);
    const y = rng.int(g, h - 4);
    b.ellipse(x, y, rng.int(4, 8), 1.5, P.navy);
  }
  reeds(b, rng, 0, 30, g - 5);
  reeds(b, rng, 150, 168, g - 5);
  return b;
}

function fieldArena(rng: Rng): PixelBuffer {
  const { w, h } = ARENA;
  const b = new PixelBuffer(w, h);
  sky(b, rng, 90);
  ridge(b, (x) => 70 + Math.sin(x * 0.03) * 8, 90, P.navy);
  for (let x = 4; x < w; x += rng.int(12, 24)) tree(b, x, 92, rng.int(10, 18), P.black);
  ground(b, 92, [P.black, P.deep, P.forest, P.leaf], rng);
  return b;
}

const cache = new Map<string, PixelBuffer>();

/** Escenario según el terreno del lugar. */
export function arenaBuffer(terrain: Terrain): PixelBuffer {
  let b = cache.get(terrain);
  if (!b) {
    const rng = new Rng(`arena-${terrain}`);
    b =
      terrain === 'rio'
        ? riverArena(rng)
        : terrain === 'monte'
          ? caveArena(rng)
          : terrain === 'pantano' || terrain === 'costa'
            ? marshArena(rng)
            : fieldArena(rng);
    cache.set(terrain, b);
  }
  return b;
}
