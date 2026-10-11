import { P, R } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';
import type { Flame, Glow, Light, RGB } from './build';
import { GROUND, WORLD_X0, type Facilities } from './geometry';
import { piece } from './props';

/**
 * Lo que el gremio construye fuera del corte: a la derecha, la forja y el establo; a la
 * izquierda, el patio de entrenamiento, la empalizada y la torre del vigía. Se pintan en
 * el búfer exterior (origen WORLD_X0); las coordenadas son las del mundo.
 */

const W = R.wood; // [black, plum, bark, rust, oak, clay, tan]
const FIRE: RGB = [255, 140, 60];
const LANTERN: RGB = [255, 196, 120];

interface Ctx {
  b: PixelBuffer;
  X: (x: number) => number;
  put: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void;
  lights: Light[];
  flames: Flame[];
  glows: Glow[];
}

/** Tejadillo de tablas inclinado. */
function shedRoof(c: Ctx, x0: number, x1: number, yHigh: number, yLow: number): void {
  for (let x = x0 - 3; x <= x1 + 3; x++) {
    const t = (x - x0 + 3) / (x1 - x0 + 6);
    const y = Math.round(yHigh + (yLow - yHigh) * t);
    for (let k = 0; k < 5; k++)
      c.b.set(c.X(x), y + k, k === 0 ? W[5]! : (x + k) % 6 === 0 ? W[2]! : W[3]!);
    c.b.set(c.X(x), y + 5, W[1]!);
  }
}

function post(c: Ctx, x: number, top: number): void {
  c.b.rect(c.X(x), top, 3, GROUND - top, W[3]!);
  c.b.vline(c.X(x), top, GROUND - top, W[4]!);
}

// ---------- Forja ----------

function forge(c: Ctx, level: number): void {
  const x0 = 518;
  const x1 = 566;
  const top = GROUND - 44;
  // Pared del fondo de piedra.
  for (let y = top + 4; y < GROUND; y++)
    for (let x = x0; x <= x1; x++) {
      const brick = ((y >> 2) + ((x + ((y >> 2) % 2) * 3) >> 3)) % 2;
      c.b.set(c.X(x), y, bayer(x, y) < 0.1 ? P.navy : brick ? P.slate : P.steel);
    }
  post(c, x0, top + 2);
  post(c, x1 - 2, top + 8);
  shedRoof(c, x0, x1, top, top + 8);
  // Fragua con la boca encendida.
  const fx = x0 + 6;
  c.b.rect(c.X(fx), GROUND - 20, 18, 20, P.slate);
  c.b.hline(c.X(fx), GROUND - 20, 18, P.fog);
  c.b.rect(c.X(fx + 4), GROUND - 13, 10, 7, P.black);
  c.b.rect(c.X(fx + 5), GROUND - 10, 8, 4, P.orange);
  c.b.hline(c.X(fx + 6), GROUND - 9, 6, P.lemon);
  c.b.rect(c.X(fx + 5), top + 8, 8, GROUND - 20 - top - 8, P.slate);
  c.b.vline(c.X(fx + 5), top + 8, GROUND - 28 - top, P.steel);
  c.glows.push({ x: fx + 9, y: GROUND - 9, r: 14, color: FIRE });
  c.lights.push({ x: fx + 9, y: GROUND - 12, r: 46, color: FIRE, intensity: 1, flicker: 0.18 });
  // Yunque sobre el tocón y fuelle.
  c.b.rect(c.X(x0 + 32), GROUND - 7, 7, 7, W[3]!);
  c.b.rect(c.X(x0 + 29), GROUND - 12, 13, 3, P.slate);
  c.b.hline(c.X(x0 + 29), GROUND - 12, 13, P.fog);
  c.b.rect(c.X(x0 + 27), GROUND - 12, 3, 2, P.slate);
  c.b.rect(c.X(x0 + 24), GROUND - 18, 6, 4, W[4]!);
  c.b.set(c.X(x0 + 27), GROUND - 16, P.bark);
  if (level >= 2) {
    // Chimenea alta y armero con espadas recién forjadas.
    c.b.rect(c.X(fx + 6), top - 22, 6, 26, P.slate);
    c.b.vline(c.X(fx + 6), top - 22, 26, P.steel);
    c.b.rect(c.X(fx + 5), top - 24, 8, 2, P.navy);
    c.b.rect(c.X(x1 - 9), GROUND - 26, 2, 26, W[3]!);
    for (const dx of [-6, -3]) {
      c.b.vline(c.X(x1 + dx), GROUND - 24, 16, P.mist);
      c.b.set(c.X(x1 + dx), GROUND - 25, P.white);
      c.b.hline(c.X(x1 + dx - 1), GROUND - 9, 3, P.gold);
    }
  }
}

// ---------- Establo ----------

function horse(c: Ctx, x: number, y: number, coat: string): void {
  c.b.rect(c.X(x), y, 6, 9, coat);
  c.b.rect(c.X(x - 3), y + 2, 4, 4, coat);
  c.b.set(c.X(x - 3), y + 4, P.black);
  c.b.set(c.X(x - 1), y + 2, P.white);
  c.b.vline(c.X(x + 5), y - 1, 6, P.black);
  c.b.set(c.X(x + 1), y - 1, coat);
}

function stable(c: Ctx, level: number): void {
  const x0 = 574;
  const x1 = 634;
  const top = GROUND - 40;
  for (let y = top + 6; y < GROUND; y++)
    for (let x = x0; x <= x1; x++) {
      const plank = Math.floor((x - x0) / 5);
      c.b.set(c.X(x), y, (x - x0) % 5 === 0 ? W[2]! : plank % 2 ? W[3]! : W[4]!);
    }
  // Tejado a dos aguas.
  const mid = (x0 + x1) / 2;
  for (let x = x0 - 4; x <= x1 + 4; x++) {
    const y = Math.round(top - 10 + Math.abs(x - mid) * 0.5);
    for (let k = 0; k < 5; k++)
      c.b.set(c.X(x), y + k, k === 0 ? P.amber : (x + k) % 4 === 0 ? P.rust : P.brick);
  }
  // Media puerta con un caballo asomado y paja.
  c.b.rect(c.X(mid - 9), GROUND - 22, 18, 22, P.black);
  c.b.rect(c.X(mid - 9), GROUND - 10, 18, 10, W[3]!);
  c.b.line(c.X(mid - 9), GROUND - 10, c.X(mid + 8), GROUND - 1, W[5]!);
  horse(c, mid - 2, GROUND - 22, P.cocoa);
  c.b.rect(c.X(x0 + 3), GROUND - 7, 10, 7, P.gold);
  c.b.hline(c.X(x0 + 3), GROUND - 7, 10, P.lemon);
  if (level >= 2) {
    horse(c, x1 - 12, GROUND - 22, P.sand);
    // Rueda de carro apoyada.
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      c.b.set(
        c.X(x1 - 2) + Math.round(Math.cos(ang) * 5),
        GROUND - 7 + Math.round(Math.sin(ang) * 5),
        W[4]!,
      );
    }
    c.b.line(c.X(x1 - 8), GROUND - 7, c.X(x1 + 4), GROUND - 7, W[3]!);
    c.b.line(c.X(x1 - 2), GROUND - 13, c.X(x1 - 2), GROUND - 1, W[3]!);
  }
}

// ---------- Empalizada ----------

function palisade(c: Ctx, level: number): void {
  const rows = level >= 2 ? 2 : 1;
  for (let r = 0; r < rows; r++)
    for (let x = WORLD_X0 + 1 + r * 3; x < -60; x += 6) {
      const h = 26 + ((x * 7) % 5) + r * 4;
      const top = GROUND - h;
      c.b.rect(c.X(x), top + 2, 5, h - 2, r ? W[2]! : W[3]!);
      c.b.vline(c.X(x), top + 2, h - 2, r ? W[3]! : W[4]!);
      c.b.set(c.X(x + 1), top, W[4]!);
      c.b.hline(c.X(x), top + 1, 4, W[4]!);
      c.b.hline(c.X(x), GROUND - 12, 5, W[1]!);
    }
  if (level >= 2) {
    // Pasarela para vigilar desde arriba.
    c.b.rect(c.X(WORLD_X0 + 2), GROUND - 22, -60 - WORLD_X0 - 2, 3, W[4]!);
    c.b.hline(c.X(WORLD_X0 + 2), GROUND - 22, -60 - WORLD_X0 - 2, W[5]!);
  }
}

// ---------- Patio de entrenamiento ----------

function dummy(): PixelBuffer {
  return piece(14, 30, (b) => {
    b.rect(6, 6, 2, 24, W[3]!);
    b.rect(1, 10, 12, 2, W[3]!);
    b.ellipse(7, 5, 4, 4, P.gold);
    b.set(6, 4, P.bark);
    b.set(8, 4, P.bark);
    b.rect(3, 12, 8, 9, P.tan);
    b.hline(3, 15, 8, P.gold);
    b.hline(3, 18, 8, P.gold);
    b.line(4, 13, 9, 19, P.wine);
  });
}

function target(): PixelBuffer {
  return piece(16, 26, (b) => {
    b.line(3, 25, 7, 10, W[3]!);
    b.line(12, 25, 8, 10, W[3]!);
    b.ellipse(8, 8, 7, 7, (x, y) => {
      const d = Math.hypot(x - 8, y - 8);
      return d < 2 ? P.red : d < 4 ? P.white : d < 6 ? P.red : P.sand;
    });
  });
}

function training(c: Ctx, level: number): void {
  c.put(dummy(), -100, GROUND - 30);
  c.put(dummy(), -84, GROUND - 30, true);
  if (level >= 2) c.put(target(), -68, GROUND - 26);
}

// ---------- Torre del vigía ----------

function tower(c: Ctx, level: number): void {
  const cx = -116;
  const deck = GROUND - (level >= 2 ? 128 : 108);
  // Patas abiertas con travesaños en aspa.
  for (let y = deck; y < GROUND; y++) {
    const spread = Math.round(5 + ((y - deck) / (GROUND - deck)) * 5);
    c.b.rect(c.X(cx - spread), y, 2, 1, W[3]!);
    c.b.rect(c.X(cx + spread), y, 2, 1, W[2]!);
  }
  for (let y = deck + 12; y < GROUND - 8; y += 22) {
    c.b.line(c.X(cx - 6), y, c.X(cx + 8), y + 18, W[3]!);
    c.b.line(c.X(cx + 8), y, c.X(cx - 6), y + 18, W[2]!);
  }
  // Plataforma con barandilla y tejadillo.
  c.b.rect(c.X(cx - 9), deck - 2, 20, 3, W[4]!);
  c.b.hline(c.X(cx - 9), deck - 2, 20, W[5]!);
  for (const x of [cx - 9, cx + 9]) c.b.rect(c.X(x), deck - 14, 2, 12, W[3]!);
  c.b.hline(c.X(cx - 9), deck - 8, 20, W[4]!);
  for (let k = 0; k < 8; k++)
    c.b.hline(c.X(cx - 11 + k), deck - 16 - k, 24 - 2 * k, k === 0 ? P.amber : P.brick);
  // Farol del vigía.
  c.b.rect(c.X(cx), deck - 10, 3, 4, P.lemon);
  c.b.set(c.X(cx + 1), deck - 9, P.white);
  c.glows.push({ x: cx + 1, y: deck - 8, r: 12, color: LANTERN });
  c.lights.push({ x: cx + 1, y: deck - 8, r: 40, color: LANTERN, intensity: 0.85, flicker: 0.1 });
  if (level >= 2) {
    // Campana y estandarte del gremio.
    c.b.rect(c.X(cx - 5), deck - 6, 4, 4, P.gold);
    c.b.vline(c.X(cx + 1), deck - 38, 14, W[2]!);
    c.b.rect(c.X(cx + 2), deck - 38, 9, 6, P.wine);
    c.b.set(c.X(cx + 5), deck - 36, P.gold);
  }
}

/** Pinta en el búfer exterior lo que el gremio haya construido fuera de la casa. */
export function outbuildings(
  b: PixelBuffer,
  fac: Facilities,
  lights: Light[],
  flames: Flame[],
  glows: Glow[],
): void {
  const X = (x: number) => x - WORLD_X0;
  const c: Ctx = { b, X, put: (p, x, y, flip) => b.blit(p, X(x), y, flip), lights, flames, glows };
  if (fac.empal) palisade(c, fac.empal);
  if (fac.patio) training(c, fac.patio);
  if (fac.torre) tower(c, fac.torre);
  if (fac.forja) forge(c, fac.forja);
  if (fac.establo) stable(c, fac.establo);
}
