import { Rng } from '../core/rng';
import { P, R } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';
import type { Flame, Glow, Light } from './build';
import { outbuildings } from './outbuildings';
import { GROUND, SPAN, WORLD_H, WORLD_W, WORLD_X0, type Facilities } from './geometry';
import { bush, lanternBody, piece } from './props';

/**
 * Lo que hay fuera del corte del edificio: a la izquierda, el patio y el camino real por
 * donde salen los grupos (y llegan los asaltos); a la derecha, terreno para crecer.
 * Se pinta en búferes de SPAN de ancho cuyo píxel 0 está en WORLD_X0.
 */

const W = R.wood;

export interface Outer {
  back: PixelBuffer;
  front: PixelBuffer;
}

/** Pino oscuro, más cerca que la arboleda del fondo. */
function pine(b: PixelBuffer, cx: number, h: number): void {
  const base = GROUND + 1;
  for (let y = 0; y < h; y++) {
    const w = Math.floor((y / h) * 13) + (y % 7 < 3 ? 1 : 0);
    for (let x = cx - w; x <= cx + w; x++) {
      const lit = x < cx - w / 3 && y % 7 > 1;
      b.set(x, base - h + y, lit ? P.forest : (x + y) % 9 === 0 ? P.black : P.deep);
    }
  }
  b.rect(cx - 2, base - 6, 5, 7, P.bark);
}

/** El roble detrás de la casa (a la derecha). Se pinta en un búfer de 0..WORLD_W + 128. */
function oak(b: PixelBuffer, cx: number): void {
  const rng = new Rng('roble');
  // Tronco con corteza.
  for (let y = 180; y < GROUND + 2; y++) {
    const w = 7 + Math.floor(Math.max(0, y - 270) / 5);
    for (let x = cx - w; x <= cx + w; x++) {
      const e = (x - (cx - w)) / (2 * w);
      const c = e < 0.25 ? P.rust : e < 0.6 ? P.bark : P.plum;
      b.set(x, y, (x * 3 + Math.floor(y / 4)) % 7 === 0 ? P.plum : c);
    }
  }
  // Ramas.
  for (const [dx, dy, len] of [
    [-1, -1, 26],
    [1, -1, 24],
    [-1, -0.4, 20],
  ] as const) {
    for (let i = 0; i < len; i++) {
      const x = Math.round(cx + dx * i);
      const y = Math.round(210 + dy * i);
      b.rect(x - 1, y, 3, 2, P.bark);
    }
  }
  // Copa: racimos con luz de luna arriba a la izquierda.
  const clusters: [number, number, number][] = [];
  for (let i = 0; i < 26; i++)
    clusters.push([cx + rng.int(-52, 46), rng.int(108, 214), rng.int(10, 18)]);
  clusters.sort((a, b2) => a[1] - b2[1]);
  for (const [x0, y0, r] of clusters) {
    b.ellipse(x0, y0, r, r * 0.85, (x, y, t) => {
      const lx = (x - x0) / r;
      const ly = (y - y0) / r;
      const lit = -lx * 0.6 - ly * 0.8;
      if (t > 0.85) return P.black;
      if (lit > 0.45 + bayer(x, y) * 0.2) return P.forest;
      if (lit < -0.3 - bayer(x, y) * 0.2) return P.black;
      return P.deep;
    });
    for (let k = 0; k < 6; k++) {
      const a = rng.next() * Math.PI;
      const px = Math.round(x0 - Math.cos(a) * r * 0.6);
      const py = Math.round(y0 - Math.sin(a) * r * 0.6);
      b.set(px, py, P.leaf);
      b.set(px + 1, py, P.forest);
    }
  }
}

function signpost(): PixelBuffer {
  return piece(26, 34, (b) => {
    b.rect(11, 6, 3, 28, W[3]!);
    // Tabla con flecha hacia el camino.
    b.rect(0, 6, 24, 9, W[4]!);
    b.hline(0, 6, 24, W[5]!);
    b.poly(
      [
        [0, 10],
        [4, 5],
        [4, 15],
      ],
      W[4]!,
    );
    for (let x = 6; x < 21; x += 3) b.hline(x, 10, 2, W[2]!);
    b.rect(13, 18, 12, 6, W[4]!);
    b.hline(13, 18, 12, W[5]!);
    for (let x = 15; x < 23; x += 3) b.hline(x, 21, 2, W[2]!);
  });
}

function rock(w: number, h: number): PixelBuffer {
  return piece(w, h, (b) => {
    b.ellipse(w / 2, h / 2 + 1, w / 2, h / 2, (x, y) =>
      y < h / 2 - 1 + bayer(x, y) ? P.steel : P.slate,
    );
    b.set(Math.floor(w / 3), Math.floor(h / 3), P.fog);
  });
}

export function buildOuter(
  glows: Glow[],
  fac: Facilities,
  lights: Light[],
  flames: Flame[],
): Outer {
  const back = new PixelBuffer(SPAN, WORLD_H);
  const front = new PixelBuffer(SPAN, WORLD_H);
  const rng = new Rng('afueras');
  const X = (x: number) => x - WORLD_X0; // de coordenada del mundo a píxel del búfer
  const put = (p: PixelBuffer, x: number, y: number, flip = false) => back.blit(p, X(x), y, flip);
  const putFront = (p: PixelBuffer, x: number, y: number) => front.blit(p, X(x), y);

  // Árboles del fondo a los dos lados.
  pine(back, X(-104), 78);
  pine(back, X(-58), 56);
  pine(back, X(560), 70);
  pine(back, X(612), 90);
  // El roble de detrás de la casa: su copa sobresale por la derecha del edificio.
  const tree = new PixelBuffer(WORLD_W + 128, WORLD_H);
  oak(tree, 470);
  back.blit(tree, X(0), 0);

  // Suelo continuo (mismo dibujo que bajo el edificio, en coordenadas del mundo).
  for (let y = GROUND; y < WORLD_H; y++) {
    const depth = y - GROUND;
    for (let px = 0; px < SPAN; px++) {
      const x = px + WORLD_X0;
      if (x >= 0 && x < WORLD_W) continue;
      const band = depth < 6 ? 3 : depth < 18 ? 2 : 1;
      const t = depth + Math.sin(x * 0.11) * 2 + Math.sin(x * 0.037) * 3;
      const idx = t < 5 ? 3 : t < 16 + bayer(x, y) * 3 ? 2 : 1;
      back.set(px, y, R.dirt[Math.min(band, idx)]!);
    }
  }
  for (let px = 0; px < SPAN; px++) {
    const x = px + WORLD_X0;
    if (x >= 0 && x < WORLD_W) continue;
    back.set(px, GROUND, P.leaf);
    back.set(px, GROUND + 1, P.forest);
    back.set(px, GROUND + 2, bayer(x, 0) > 0.5 ? P.forest : P.deep);
    const h = Math.floor((Math.sin(x * 0.9) + Math.sin(x * 0.31) + 2) * 1.2);
    for (let k = 1; k <= h; k++) back.set(px, GROUND - k, k === h ? P.lime : P.leaf);
  }
  for (let i = 0; i < 40; i++) {
    const x = rng.chance(0.6) ? rng.int(WORLD_X0, -4) : rng.int(WORLD_W + 2, WORLD_X0 + SPAN - 4);
    back.ellipse(X(x), rng.int(GROUND + 8, WORLD_H - 4), rng.int(2, 4), 1.6, P.slate);
  }

  // Camino real: tierra pisada con rodadas que llega hasta las losas de la puerta.
  for (let x = WORLD_X0; x < 4; x++) {
    const px = X(x);
    for (let k = 0; k < 3; k++) back.set(px, GROUND + k, k === 1 ? P.umber : P.cocoa);
    if ((x * 7) % 11 === 0) back.set(px, GROUND - 1, P.cocoa);
  }
  for (let x = WORLD_X0 + 4; x < 0; x += 13) back.hline(X(x), GROUND + 1, 5, P.bark);

  // Poste indicador, farol de camino, piedras y matorrales.
  put(signpost(), -46, GROUND - 33);
  back.rect(X(-16), GROUND - 34, 2, 34, W[3]!);
  back.rect(X(-19), GROUND - 36, 8, 2, W[3]!);
  put(lanternBody(), -18, GROUND - 34);
  glows.push({ x: -13, y: GROUND - 28, r: 18, color: [255, 196, 120] });
  put(rock(12, 8), -86, GROUND - 6);
  put(rock(8, 6), -30, GROUND - 4);
  put(rock(14, 9), 590, GROUND - 7);
  putFront(bush('lejos-a', 22, 12), -126, GROUND - 10);
  putFront(bush('lejos-b', 18, 10), -70, GROUND - 8);
  putFront(bush('lejos-c', 24, 12), 528, GROUND - 10);
  putFront(bush('lejos-d', 20, 11), 620, GROUND - 9);

  // Lo que el gremio ha construido fuera.
  outbuildings(back, fac, lights, flames, glows);

  // Valla de la derecha, que sigue a la del huerto (si no hay obras ahí).
  if (fac.forja || fac.establo) return { back, front };
  for (let x = WORLD_W + 4; x < WORLD_X0 + SPAN; x += 9) {
    putFront(
      piece(3, 18, (p) => {
        p.rect(0, 0, 3, 18, P.rust);
        p.vline(0, 0, 18, P.oak);
      }),
      x,
      GROUND - 17,
    );
  }
  for (let x = WORLD_W; x < WORLD_X0 + SPAN; x++) {
    front.set(X(x), GROUND - 13, P.oak);
    front.set(X(x), GROUND - 7, P.rust);
  }
  return { back, front };
}
