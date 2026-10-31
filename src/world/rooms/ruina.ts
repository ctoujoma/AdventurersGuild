/**
 * Las salas rotas, por reparar: que se vea el daño y lo que serán. Encima de lo que deja cada
 * sala (`ruin` de su arte o los trastos de siempre) van una viga caída, un montón de escombro y,
 * sobre el suelo, un rayo de luz fría por un agujero del techo con su polvo (bajo tierra, una
 * gotera). En el suelo, un boquete con las tablas partidas; y en la pared del fondo, el plano en
 * tiza de los muebles que tendrá al repararla (`chalkPlan`). La luz de la sala, fría y apagada,
 * la pone la escena (`ROOM_RUIN`).
 */
import { P } from '../../art/palette';
import { PixelBuffer, alpha } from '../../art/pixel';
import { Rng } from '../../core/rng';
import type { Room } from '../../core/model';
import { piece } from '../props';
import { PITCH, ROOM_H } from './layout';
import { COLD, FRONT, MID, type Thing } from './salas/kit';
import { scaleAt } from './view3d';

/** Profundidad del rayo de luz (en medio de la sala). */
export const SHAFT_Z = MID + 4;

/** Una viga del techo caída en diagonal, con la punta astillada. */
function fallenBeam(flip: boolean): PixelBuffer {
  return piece(46, 40, (b) => {
    const W = [P.black, P.plum, P.bark, P.rust, P.oak];
    for (let k = 0; k < 4; k++) b.line(2, 3 + k, 40, 36 + k, W[k === 0 ? 4 : k === 3 ? 1 : 3]!);
    // La punta de arriba, rota a astillas; la de abajo, apoyada.
    b.set(1, 2, W[3]!);
    b.set(0, 4, W[2]!);
    b.set(2, 1, W[4]!);
    b.line(40, 37, 44, 39, W[2]!);
    // Clavos que asoman.
    b.set(14, 13, P.fog);
    b.set(15, 12, P.steel);
    b.set(28, 25, P.fog);
    if (flip) {
      const m = new PixelBuffer(b.w, b.h);
      m.blit(b, 0, 0, true);
      b.data.set(m.data);
    }
  });
}

/** Un montón de escombro: piedras, cascotes y tablas partidas, con polvo alrededor. */
function rubble(seed: string): PixelBuffer {
  return piece(30, 13, (b) => {
    const rng = new Rng(seed);
    for (let i = 0; i < 14; i++) {
      const x = 4 + rng.int(0, 21);
      const top = 11 - Math.round(7 * Math.sin(((x - 2) / 26) * Math.PI)) + rng.int(0, 2);
      const w = rng.int(2, 4);
      const c = rng.pick([P.steel, P.slate, P.fog, P.clay, P.rust]);
      b.rect(x, top, w, 12 - top, c);
      b.hline(x, top, w, c === P.slate ? P.steel : c === P.rust ? P.clay : P.mist);
    }
    // Una tabla partida y el polvo del suelo.
    b.line(1, 11, 12, 6, P.oak);
    b.line(1, 12, 12, 7, P.bark);
    for (let x = 0; x < 30; x += 3) b.set(x, 12, P.sand);
  });
}

/**
 * El rayo de luz que entra por el techo: arriba, el agujero con las tablas partidas; luego, la
 * luz tramada (más clara arriba) que se ensancha hasta el suelo.
 */
function shaft(h: number): PixelBuffer {
  const w = 30;
  const b = new PixelBuffer(w, h);
  for (let y = 4; y < h; y++) {
    const t = y / h;
    const half = 6 + t * 8;
    const cx = w / 2 + (t - 0.5) * 6;
    for (let x = Math.ceil(cx - half); x < cx + half; x++) {
      // Más denso en el centro y arriba; un pixel de cada pocos (tramado).
      const edge = Math.abs(x - cx) / half;
      const keep = (x + y * 3) % (edge < 0.4 ? 4 : 7) === 0 && y % 2 === 0;
      if (keep && x >= 0 && x < w) b.set(x, y, t < 0.25 && edge < 0.4 ? P.mist : P.fog);
    }
  }
  // El agujero del techo: tablas partidas y negro detrás.
  b.rect(8, 0, 14, 3, P.black);
  for (const [x, len] of [
    [7, 4],
    [12, 2],
    [17, 5],
    [21, 3],
  ] as const) {
    b.vline(x, 0, len, P.oak);
    b.set(x, len, P.bark);
  }
  return b;
}

/** Lo que pone la ruina en una sala rota de `w` de ancho, además de lo suyo. */
export function ruinThings(room: Room, w: number): Thing[] {
  const rng = new Rng(`ruina${room.id}`);
  const left = rng.chance(0.5);
  const beamX = left ? w * 0.28 : w * 0.72;
  const out: Thing[] = [
    { img: fallenBeam(!left), x: beamX, z: MID - 6, y: 0 },
    { img: rubble(room.id), x: left ? w * 0.68 : w * 0.32, z: FRONT + 2, y: 0 },
  ];
  // Por encima del suelo, un agujero en el techo y la luz que entra; bajo tierra, no.
  if (room.floor >= 0) {
    const k = scaleAt(SHAFT_Z);
    const h = Math.round((room.h * PITCH - (PITCH - ROOM_H)) * k);
    out.push({
      img: shaft(h),
      x: w / 2 + (left ? 8 : -8),
      z: SHAFT_Z,
      y: 0,
      hang: true,
      light: { dy: h - 10, r: 60, color: COLD, power: 0.45, flicker: 0, steady: true },
    });
  }
  return out;
}

/**
 * El boquete del suelo: unas tablas que faltan (negro por debajo) con los cantos astillados, y
 * astillas y polvo alrededor. `b` es la textura del suelo (ancho por fondo).
 */
export function ruinFloor(b: PixelBuffer, seed: string): void {
  const rng = new Rng(`suelo${seed}`);
  const cx = Math.round(b.w * (0.35 + rng.next() * 0.3));
  const cy = Math.round(b.h * 0.55);
  for (let y = cy - 5; y <= cy + 5; y++)
    for (let x = cx - 12; x <= cx + 12; x++) {
      const d = ((x - cx) / 12) ** 2 + ((y - cy) / 5) ** 2;
      const jag = ((x * 7 + y * 13) % 5) / 20;
      if (d < 0.75 + jag) b.set(x, y, d < 0.5 ? P.black : P.ebony);
      else if (d < 1 + jag) b.set(x, y, P.oak);
    }
  for (let i = 0; i < 10; i++)
    b.set(cx + rng.int(-20, 20), cy + rng.int(-8, 8), rng.chance(0.5) ? P.oak : P.sand);
}

/**
 * El plano en tiza de lo que tendrá la sala al repararla: el contorno de cada mueble, a trazos,
 * en un lienzo del tamaño de la pared del fondo (`w`×`h` en el mundo, a la profundidad `z`).
 */
export function chalkPlan(things: readonly Thing[], w: number, h: number, z: number): PixelBuffer {
  const k = scaleAt(z);
  const b = new PixelBuffer(Math.round(w * k), Math.round(h * k));
  for (const th of things) {
    const img = th.img;
    // Fuera las luces sueltas (figuras de un píxel) y lo muy pequeño.
    if (img.w < 6 || img.h < 6) continue;
    const x0 = Math.round(th.x * k - img.w / 2);
    const y0 = th.hang ? Math.round(th.y * k) : Math.round(b.h - th.y * k - img.h);
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++) {
        if (!alpha(img.get(x, y))) continue;
        const edge =
          !alpha(img.get(x - 1, y)) ||
          !alpha(img.get(x + 1, y)) ||
          !alpha(img.get(x, y - 1)) ||
          !alpha(img.get(x, y + 1));
        // A trazos, como a mano: algún hueco en la línea.
        if (!edge || (x * 5 + y * 3) % 11 === 0) continue;
        b.set(x0 + x, y0 + y, (x + y) % 4 === 0 ? P.fog : P.mist);
      }
  }
  return b;
}
