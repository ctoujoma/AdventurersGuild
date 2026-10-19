/**
 * Arte de la enfermería: los heridos se curan antes. Los catres (donde se acuestan los heridos),
 * contra la pared; la mesa del curandero con el mortero y las vendas, la jofaina y, desde el
 * nivel 2, el botiquín (que brilla en el 3). En la pared, hierbas secándose, frascos y la lámina
 * del cuerpo. Las anchas ponen un catre bajo cada ventana y llenan los tramos de en medio: la
 * botica (frascos y el botiquín), y la tina de los baños con el emblema del sanador encima.
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
  row,
  stretchesOf,
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
 * Catres: uno por nivel y hueco de más (tres como mucho), contra la pared (son bajos: caben
 * bajo las ventanas). En la de un hueco, repartidos a lo ancho (lo de en medio queda para el
 * curandero); en las anchas, uno bajo cada ventana (y el que sobre, contra la pared de la
 * izquierda), y los muebles del curandero en los tramos de pared de entre medias.
 */
export function cotsOf(room: Room, w: number): Bed[] {
  const n = Math.min(3, room.level + room.w - 1);
  const cot = (x: number): Bed => ({ kind: 'catre', x, z: WALL, top: 3, level: room.level });
  if (room.w > 1) {
    const wins = cellsOf(room, w).map((c) => c.win);
    const xs = n > wins.length ? [COT_W / 2 + 1, ...wins] : wins.slice(0, n);
    return xs.map(cot);
  }
  const a = COT_W / 2 + 1;
  const b = w - COT_W / 2 - 1;
  return Array.from({ length: n }, (_, i) => cot(n === 1 ? w / 2 : a + ((b - a) * i) / (n - 1)));
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
    // Desde el nivel 2, una vela; en el 3, también el libro abierto.
    if (level >= 2) {
      candleOn(p, 1, 4, 3);
      p.rect(0, 4, 4, 1, P.steel);
    }
    if (level >= 3) {
      p.rect(9, 5, 5, 2, P.white);
      p.vline(11, 5, 2, P.fog);
      p.hline(9, 7, 5, P.wine);
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

/** Biombo de tres hojas de lienzo (o de dos, si no hay sitio) para separar los catres. */
function screen(leaves = 3): PixelBuffer {
  return Prop.piece(leaves * 9 + 1, 30, (p) => {
    for (let k = 0; k < leaves; k++) {
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

/** Tina de madera con agua (los baños para la fiebre) y un paño en el borde. */
function tub(): PixelBuffer {
  return Prop.piece(24, 12, (p) => {
    p.rect(1, 3, 22, 9, W[3]!);
    for (let x = 4; x < 22; x += 5) p.vline(x, 4, 8, W[2]!);
    p.hline(1, 5, 22, P.steel);
    p.hline(1, 10, 22, P.steel);
    p.hline(1, 3, 22, W[5]!);
    p.rect(3, 2, 18, 1, P.sky);
    p.hline(5, 2, 4, P.white);
    // El paño, colgando por fuera.
    p.rect(17, 1, 4, 7, P.white);
    p.vline(20, 2, 6, P.mist);
  });
}

/** Taburete con un cubo y un cazo. */
function bucketStool(): PixelBuffer {
  return Prop.piece(12, 14, (p) => {
    p.rect(0, 7, 12, 2, W[4]!);
    p.hline(0, 7, 12, W[5]!);
    p.rect(1, 9, 2, 5, W[3]!);
    p.rect(9, 9, 2, 5, W[3]!);
    p.rect(3, 2, 6, 5, W[3]!);
    p.hline(3, 3, 6, P.steel);
    p.hline(3, 2, 6, P.sky);
    p.line(8, 0, 10, 3, P.fog);
  });
}

/**
 * Estante de la botica, para encima de un mueble: hierbas secándose y una balda de frascos; con
 * nivel, sin las hierbas y con dos baldas llenas.
 */
function apothecary(b: PixelBuffer, x0: number, x1: number, level: number): void {
  const w = x1 - x0;
  if (level < 2) {
    b.hline(x0, 10, w, P.slate);
    const bunches = Math.floor((w - 2) / 7);
    for (let k = 0; k < bunches; k++) herbs(b, x0 + 1 + k * 7, 11, k % 3 === 1);
  }
  const rows = level >= 2 ? [26, 36] : [36];
  for (const [r, y] of rows.entries()) {
    shelf(b, x0, y, w);
    for (let k = 0; k * 5 + 4 < w - 1; k++)
      jar(b, x0 + 1 + k * 5, y, k + r * 2 + 1, (k + r) % 3 === 0);
  }
}

/** El emblema del sanador (la copa y la serpiente): pintado, en un paño o en un tapiz con oro. */
function emblem(b: PixelBuffer, x: number, level: number): void {
  if (level >= 2) {
    const cloth = level >= 3 ? P.leaf : P.white;
    b.hline(x - 10, 9, 21, W[2]!);
    b.rect(x - 9, 10, 19, 24, cloth);
    if (level >= 3) {
      b.rect(x - 9, 10, 19, 1, P.gold);
      b.rect(x - 9, 33, 19, 1, P.gold);
      b.vline(x - 9, 10, 24, P.gold);
      b.vline(x + 9, 10, 24, P.gold);
    } else b.vline(x + 9, 10, 24, P.mist);
    // Flecos abajo.
    for (let k = -8; k <= 8; k += 2) b.set(x + k, 34, level >= 3 ? P.gold : P.mist);
  } else {
    b.ellipse(x, 22, 9, 9, W[3]!);
    b.ellipse(x, 22, 8, 8, P.sand);
  }
  // La copa.
  const cup = level >= 3 ? P.gold : P.steel;
  b.rect(x - 3, 18, 7, 3, cup);
  b.rect(x - 2, 21, 5, 1, cup);
  b.vline(x, 22, 4, cup);
  b.hline(x - 2, 26, 5, cup);
  // La serpiente, enroscada al pie y asomando por el borde.
  const snake = level >= 3 ? P.white : P.leaf;
  for (const [dx, dy] of [
    [-2, 23],
    [-1, 24],
    [1, 24],
    [2, 23],
    [1, 22],
    [-1, 21],
    [-3, 19],
    [-4, 17],
    [-3, 16],
  ])
    b.set(x + dx!, dy!, snake);
  b.set(x - 2, 16, P.red);
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  const lvl = room.level;
  const w = cells.at(-1)!.x1;
  // En las anchas, cada tramo de en medio tiene lo suyo: la botica y el emblema.
  if (!ruin && room.w > 1)
    for (const s of stretchesOf(room, w))
      if (s.kind === 'mid') {
        if (s.i === 1) apothecary(b, bx(s.x0) + 4, bx(s.x1) - 4, lvl);
        else emblem(b, bx((s.x0 + s.x1) / 2), lvl);
      }
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
    if (c.i === 0) {
      // Hierbas secándose de una barra, arriba (encima del botiquín).
      // (En el nivel 3, menos: a su derecha va la lámina.)
      const chartHere = lvl >= 3;
      const bunches = Math.min(Math.floor((winL - left - 4) / 7), chartHere ? 3 : 2 + lvl);
      b.hline(left, 12, bunches * 7 + 2, P.slate);
      for (let k = 0; k < bunches; k++) herbs(b, left + 1 + k * 7, 13, k % 3 === 2);
      // Desde el nivel 2: estante de frascos (y la lámina en el 3) entre el botiquín y la ventana.
      if (lvl >= 2) {
        const sx = bx(c.x0 + 36);
        shelf(b, sx, 36, winL - sx - 2);
        for (let k = 0; k * 5 + 4 < winL - sx - 3; k++)
          jar(b, sx + 1 + k * 5, 36, k + 1, k % 2 === 0);
        if (chartHere) b.blit(chart(), sx + 2, 11);
      }
    }
    // A la derecha de la última ventana, un paño colgado de un clavo.
    const winR = bx(c.win + WIN_HALF);
    if (c.i === cells.length - 1 && bx(c.x1) - winR >= 8) {
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
  const cotBeds = cotsOf(room, w);
  const cots = cotBeds.map((b) => b.x);
  const table = healerTable(lvl);
  const tableLight = lvl >= 2 ? candle(16) : undefined;
  const cab = Prop.cabinet(lvl >= 3);
  const cabLight: Glow | undefined =
    lvl >= 3 ? { dy: 20, r: 36, color: [140, 255, 200], power: 0.35, flicker: 0.04 } : undefined;
  const t: Thing[] = [lampOver(cells, w, lvl), ...cots.map((x) => at(Prop.cot(), x, WALL))];
  if (room.w === 1) {
    const items: { img: PixelBuffer; light?: Glow }[] = [{ img: table, light: tableLight }];
    if (lvl >= 2) items.push({ img: cab, light: cabLight });
    items.push({ img: Prop.washbasin() });
    if (lvl >= 3) items.push({ img: screen() });
    return [...t, ...fit(w, cots, items)];
  }
  // Las anchas: lo del curandero por tramos. Si sobra un catre, va contra la pared de la
  // izquierda y la mesa sube al tramo de en medio.
  const extra = cotBeds.length > cells.length;
  for (const s of stretchesOf(room, w)) {
    let items: [PixelBuffer, number, Glow?][] = [];
    if (s.kind === 'left')
      items = extra
        ? [[Prop.washbasin(), WALL]]
        : [
            [table, WALL, tableLight],
            [Prop.washbasin(), WALL],
          ];
    else if (s.kind === 'mid' && s.i === 1)
      items = extra
        ? [
            [table, WALL, tableLight],
            [cab, WALL, cabLight],
            [lvl >= 3 ? screen(2) : linenChest(), WALL],
          ]
        : room.w === 2
          ? [
              [linenChest(), WALL],
              [tub(), WALL],
            ]
          : lvl >= 2
            ? [
                [cab, WALL, cabLight],
                [linenChest(), WALL],
              ]
            : [[linenChest(), WALL]];
    else if (s.kind === 'mid')
      items =
        lvl >= 3
          ? [
              [screen(), WALL],
              [tub(), WALL],
            ]
          : lvl >= 2
            ? [
                [tub(), WALL],
                [bucketStool(), WALL],
              ]
            : [[tub(), WALL]];
    if (s.kind === 'left' && extra) {
      // Entre el catre de la pared y el de la ventana.
      const x0 = cots[0]! + COT_W / 2;
      t.push(...row({ x0, x1: s.x1 }, items));
    } else t.push(...row(s, items));
  }
  return t;
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
