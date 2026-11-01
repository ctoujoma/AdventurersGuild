/**
 * La hierba del patio que mueve el viento: matas de briznas, hierba alta con espigas y matas con
 * flores. Cada una es una tira de `GRASS_FRAMES` fotogramas, de echada atrás a doblada por la
 * racha; la escena escoge el fotograma según el viento que pasa por su sitio (ver `RoomScene`).
 * Y el suelo: tierra apisonada con piedras y hierba con briznas y florecillas.
 */
import { Rng } from '../core/rng';
import { P } from './palette';
import { PixelBuffer } from './pixel';

export const GRASS_FRAMES = 4;
/** Cuánto se doblan las puntas en cada fotograma (en píxeles, a la derecha). */
const LEAN = [-1, 0, 1.4, 2.8];

export type TuftKind = 'mata' | 'alta' | 'flores' | 'trebol';

const FLOWERS = [
  [P.lemon, P.gold],
  [P.white, P.mist],
  [P.coral, P.rose],
  [P.sky, P.ocean],
] as const;

/** Una mata, en tira de fotogramas (cada uno de `w` × `h`). */
export function grassTuft(
  kind: TuftKind,
  seed: string,
): { img: PixelBuffer; w: number; h: number } {
  const rng = new Rng(`hierba-${kind}-${seed}`);
  const w = kind === 'alta' ? 13 : kind === 'trebol' ? 9 : 11;
  const h = kind === 'alta' ? 13 : kind === 'flores' ? 9 : kind === 'trebol' ? 5 : 8;
  const img = new PixelBuffer(w * GRASS_FRAMES, h);
  const blades = Array.from({ length: kind === 'trebol' ? 4 : kind === 'alta' ? 7 : 6 }, () => ({
    x: rng.int(2, w - 4),
    h: rng.int(Math.round(h * 0.45), h - 1),
    bend: rng.next() * 0.6 + 0.7,
    tone: rng.int(0, 2),
  }));
  const flower = FLOWERS[rng.int(0, FLOWERS.length - 1)]!;
  for (let f = 0; f < GRASS_FRAMES; f++) {
    const ox = f * w;
    for (const bl of blades) {
      for (let j = 0; j < bl.h; j++) {
        const u = j / bl.h;
        const x = Math.round(bl.x + LEAN[f]! * bl.bend * u * u);
        const y = h - 1 - j;
        // Abajo, oscuro; en la punta, la luz.
        const c =
          u < 0.3
            ? P.forest
            : u < 0.7
              ? bl.tone
                ? P.leaf
                : P.forest
              : bl.tone === 2
                ? P.lime
                : P.leaf;
        if (kind === 'trebol') {
          // Trébol: hojas redondas pegadas al suelo.
          if (j === bl.h - 1) {
            img.set(ox + x - 1, y, P.leaf);
            img.set(ox + x + 1, y, P.leaf);
            img.set(ox + x, y - 1, P.lime);
          }
          img.set(ox + x, y, j === bl.h - 1 ? P.lime : P.forest);
          continue;
        }
        img.set(ox + x, y, c);
      }
      // La espiga de la hierba alta y la flor.
      const tipX = Math.round(bl.x + LEAN[f]! * bl.bend);
      const tipY = h - bl.h;
      if (kind === 'alta' && bl.tone !== 0) {
        img.set(ox + tipX, tipY, P.gold);
        img.set(ox + tipX, tipY + 1, P.tan);
      }
      if (kind === 'flores' && bl.h > h * 0.6) {
        img.set(ox + tipX, tipY, flower[0]);
        img.set(ox + tipX - 1, tipY + 1, flower[0]);
        img.set(ox + tipX + 1, tipY + 1, flower[1]);
        img.set(ox + tipX, tipY + 1, P.lemon);
      }
    }
    // La base, algo más tupida.
    for (let x = 2; x < w - 2; x++) if (rng.chance(0.5)) img.set(ox + x, h - 1, P.forest);
  }
  return { img, w, h };
}

/**
 * El suelo: tierra apisonada (con guijarros, rodadas y alguna mata en el borde) o hierba (con
 * briznas claras, tréboles y florecillas). `road`: una franja empedrada a la izquierda.
 */
export function groundTex(
  w: number,
  d: number,
  patio: boolean,
  seed: string,
  road = patio,
): PixelBuffer {
  const b = new PixelBuffer(w, d);
  const rng = new Rng(seed);
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      const n = rng.next();
      let c: string;
      // El patio: hierba con un camino de tierra pisada de lado a lado (por delante) y calvas.
      const path =
        patio &&
        y > 3 + Math.sin(x * 0.09) * 1.5 &&
        y < 13 + Math.sin(x * 0.05 + 1) * 2 + (n > 0.8 ? 1 : 0);
      const bald = patio && Math.sin(x * 0.13) * Math.sin(y * 0.21 + x * 0.02) > 0.82;
      if (path || bald) {
        c = n < 0.14 ? P.umber : n > 0.95 ? P.cocoa : n > 0.9 ? P.mocha : P.bark;
        if (n > 0.985) c = P.steel;
      } else {
        // Hierba: base verde con briznas claras, matas oscuras y algún brillo.
        c = n < 0.12 ? P.deep : n > 0.86 ? P.leaf : P.forest;
        if (n > 0.975) c = P.lime;
      }
      b.set(x, y, c);
    }
  for (let i = 0; i < (w * d) / 60; i++) {
    // Florecillas y tréboles sueltos.
    const x = rng.int(0, w - 1);
    const y = rng.int(0, d - 1);
    const r = rng.next();
    if (r < 0.25) b.set(x, y, P.lemon);
    else if (r < 0.4) b.set(x, y, P.white);
    else if (r < 0.48) b.set(x, y, P.coral);
    else {
      b.set(x, y, P.leaf);
      b.set(x + 1, y, P.lime);
    }
  }
  if (road)
    // El empedrado: piedras grises con su junta, en hiladas.
    for (let y = 0; y < d; y++)
      for (let x = 0; x < Math.min(w, 26); x++) {
        const off = Math.floor(y / 2) % 2 ? 3 : 0;
        const joint = (x + off) % 6 === 0 || y % 2 === 0;
        b.set(
          x,
          y,
          joint ? P.umber : (x + y) % 5 === 0 ? P.fog : (x * 3 + y) % 7 === 0 ? P.slate : P.steel,
        );
      }
  return b;
}
