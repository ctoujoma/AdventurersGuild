/**
 * Arte de la enfermería: los heridos se curan antes. Los catres, repartidos por la sala (donde
 * se acuestan los heridos); bajo la ventana, la mesa del curandero con el mortero y las vendas;
 * a su derecha, la jofaina. En la pared, hierbas secándose y, desde el nivel 2, el botiquín
 * (que brilla en el 3) y la lámina del cuerpo.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { scaleAt } from '../view3d';
import {
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  candle,
  cellsOf,
  lampOver,
  type Bed,
  type Glow,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, herbs, jar, shelf, web } from './piezas';

// ---------- Dónde van los catres ----------

/** Ancho de un catre en el mundo, contra la pared. */
const COT_W = Prop.cot().w / scaleAt(WALL);

/**
 * Catres: uno por nivel y hueco de más (tres como mucho), contra la pared y repartidos a lo
 * ancho (son bajos: caben bajo las ventanas). Los muebles del curandero van en los huecos.
 */
export function cotsOf(room: Room, w: number): Bed[] {
  const n = Math.min(3, room.level + room.w - 1);
  // Uno solo, en medio; si no, de pared a pared (lo de en medio queda para el curandero).
  const a = COT_W / 2 + 1;
  const b = w - COT_W / 2 - 1;
  return Array.from({ length: n }, (_, i) => ({
    kind: 'catre' as const,
    x: n === 1 ? w / 2 : a + ((b - a) * i) / (n - 1),
    z: WALL,
    top: 3,
    level: room.level,
  }));
}

/**
 * Pone cada mueble (por orden de importancia) en el hueco libre más ancho que quede entre los
 * catres y las paredes, si cabe. Devuelve los que caben, con su x.
 */
function fit(w: number, cots: number[], items: { img: PixelBuffer; light?: Glow }[]): Thing[] {
  const gaps: [number, number][] = [];
  let x = 0;
  for (const c of [...cots].sort((a, b) => a - b)) {
    gaps.push([x, c - COT_W / 2]);
    x = c + COT_W / 2;
  }
  gaps.push([x, w]);
  const out: Thing[] = [];
  for (const it of items) {
    const iw = it.img.w / scaleAt(WALL) + 2;
    gaps.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    const g = gaps[0]!;
    if (g[1] - g[0] < iw) continue;
    // Pegado al catre de su izquierda (o a la pared), y lo que sobra queda para otro.
    const cx = g[0] === 0 ? g[1] - iw / 2 : g[0] + iw / 2;
    out.push(at(it.img, cx, WALL, 0, it.light));
    if (g[0] === 0) g[1] -= iw;
    else g[0] += iw;
  }
  return out;
}

// ---------- Piezas ----------

/** Mesa del curandero: jofaina y paños; con nivel, el mortero, frascos, el libro y una vela. */
function healerTable(level: number): PixelBuffer {
  return Prop.piece(24, 18, (p) => {
    p.rect(0, 8, 24, 3, W[4]!);
    p.hline(0, 8, 24, W[5]!);
    p.hline(0, 10, 24, W[2]!);
    p.rect(2, 11, 3, 7, W[3]!);
    p.rect(19, 11, 3, 7, W[3]!);
    // Vendas enrolladas y un paño.
    p.ellipse(3, 6.5, 2, 1.6, P.white);
    p.set(3, 6, P.mist);
    p.ellipse(7, 6.5, 2, 1.6, P.mist);
    if (level < 3) p.rect(10, 7, 5, 1, P.sand);
    if (level >= 2) {
      // Mortero con su mano y un frasco.
      p.rect(15, 5, 4, 3, P.steel);
      p.hline(15, 5, 4, P.fog);
      p.line(17, 1, 19, 5, W[4]!);
      jar(p, 20, 8, 2);
    }
    if (level >= 3) {
      // Libro abierto y una vela.
      p.rect(9, 5, 5, 2, P.white);
      p.vline(11, 5, 2, P.fog);
      p.hline(9, 7, 5, P.wine);
      candleOn(p, 1, 4, 3);
      p.rect(0, 4, 4, 1, P.steel);
    }
  });
}

/** Lámina del cuerpo humano en un pergamino clavado. */
function chart(): PixelBuffer {
  return Prop.piece(12, 16, (p) => {
    p.rect(0, 0, 12, 16, P.sand);
    p.vline(11, 1, 15, P.tan);
    p.hline(0, 15, 12, P.tan);
    // Figura.
    p.ellipse(6, 3, 1.6, 1.6, P.rust);
    p.vline(6, 5, 5, P.rust);
    p.line(3, 6, 9, 6, P.rust);
    p.line(6, 10, 4, 14, P.rust);
    p.line(6, 10, 8, 14, P.rust);
    p.set(5, 7, P.red);
    p.set(1, 1, P.slate);
    p.set(10, 1, P.slate);
  });
}

/** Biombo de tres hojas de lienzo (para separar los catres). */
function screen(): PixelBuffer {
  return Prop.piece(28, 30, (p) => {
    for (let k = 0; k < 3; k++) {
      const x = k * 9;
      p.rect(x, 0, 10, 30, W[3]!);
      p.rect(x + 1, 2, 8, 24, k % 2 ? P.mist : P.white);
      p.vline(x + 1, 2, 24, k % 2 ? P.fog : P.mist);
      p.rect(x + 1, 27, 1, 3, W[2]!);
      p.rect(x + 8, 27, 1, 3, W[2]!);
    }
  });
}

/** Arcón de la ropa de cama con sábanas dobladas encima. */
function linenChest(): PixelBuffer {
  return Prop.piece(22, 18, (p) => {
    p.blit(Prop.trunk(), 0, 4);
    for (let k = 0; k < 3; k++) p.rect(4, 3 - k, 14, 1, k % 2 ? P.mist : P.white);
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  const lvl = room.level;
  for (const c of cells) {
    const left = bx(c.x0) + 4;
    const winL = bx(c.win - WIN_HALF);
    if (ruin) {
      // Las hierbas de siempre, ya secas y negras.
      b.hline(left, 12, 20, P.slate);
      for (let k = 0; k < 3; k++) {
        b.vline(left + 3 + k * 7, 13, 2, P.black);
        b.vline(left + 3 + k * 7, 15, 5, P.umber);
      }
      continue;
    }
    // Hierbas secándose de una barra, arriba (encima del botiquín).
    // (En el primer hueco del nivel 3, menos: a su derecha va la lámina.)
    const chartHere = c.i === 0 && lvl >= 3;
    const bunches = Math.min(Math.floor((winL - left - 4) / 7), chartHere ? 3 : 2 + lvl);
    b.hline(left, 12, bunches * 7 + 2, P.slate);
    for (let k = 0; k < bunches; k++) herbs(b, left + 1 + k * 7, 13, k % 3 === 2);
    // Desde el nivel 2: estante de frascos (y la lámina en el 3) entre el botiquín y la ventana.
    if (c.i === 0 && lvl >= 2) {
      const sx = bx(c.x0 + 36);
      shelf(b, sx, 36, winL - sx - 2);
      for (let k = 0; k * 5 + 4 < winL - sx - 3; k++)
        jar(b, sx + 1 + k * 5, 36, k + 1, k % 2 === 0);
      if (chartHere) b.blit(chart(), sx + 2, 11);
    }
    // A la derecha de la ventana, un paño colgado de un clavo.
    const winR = bx(c.win + WIN_HALF);
    if (bx(c.x1) - winR >= 8) {
      b.set(winR + 4, 20, P.black);
      b.rect(winR + 2, 21, 5, 8, P.white);
      b.vline(winR + 6, 21, 8, P.mist);
      b.hline(winR + 2, 26, 5, P.sky);
    }
    // Sin ventana: la cruz verde de la botica, donde iría.
    if (!c.glass) {
      const x = bx(c.win);
      b.rect(x - 7, 14, 14, 14, W[3]!);
      b.rect(x - 6, 15, 12, 12, P.sand);
      b.rect(x - 1, 16, 3, 10, P.leaf);
      b.rect(x - 4, 19, 9, 3, P.leaf);
    }
  }
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const cells = cellsOf(room, w);
  const cots = cotsOf(room, w).map((b) => b.x);
  const items: { img: PixelBuffer; light?: Glow }[] = [
    { img: healerTable(lvl), light: lvl >= 3 ? candle(16) : undefined },
  ];
  if (lvl >= 2)
    items.push({
      img: Prop.cabinet(lvl >= 3),
      light:
        lvl >= 3
          ? { dy: 20, r: 36, color: [140, 255, 200], power: 0.35, flicker: 0.04 }
          : undefined,
    });
  items.push({ img: Prop.washbasin() });
  if (room.w > 1) items.push({ img: linenChest() });
  if (lvl >= 3) items.push({ img: screen() });
  return [lampOver(cells, w), ...cots.map((x) => at(Prop.cot(), x, WALL)), ...fit(w, cots, items)];
}

/** Por reparar: un catre volcado, la jofaina rota y telarañas. */
function ruin(room: Room, w: number): Thing[] {
  const cot = Prop.cot();
  const broken = new PixelBuffer(cot.w, cot.h);
  broken.blit(cot, 0, 0, true);
  web(broken, 1, 0, 1);
  return cellsOf(room, w).flatMap((c) => [
    at(broken, c.x0 + 30, WALL),
    at(Prop.crate(), c.win, WALL),
  ]);
}

export const enfermeria: RoomArt = { wall, things, ruin, ownLamp: true };
