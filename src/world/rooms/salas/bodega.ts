/**
 * Arte de la bodega: hace y guarda la cerveza. Bajo cada ventana (o donde iría), una cuba en su
 * caballete, más baja que el alféizar. En el primer hueco, los barriles apilados y, desde el
 * nivel 2, la caldera de cobre con su fuego y su tiro hasta el techo; en los demás, sacos de
 * cebada y, con nivel, barriles y el botellero. En la pared, jarras colgadas y lúpulo.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { stoneWall } from '../../paint';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FIRE,
  WALL,
  W,
  at,
  bx,
  candle,
  cellsOf,
  fire,
  row,
  stretchesOf,
  type RoomArt,
  type Thing,
  type WallCtx,
  task,
  emits,
  thick,
} from './kit';
import { candleOn, sack, shelf, web } from './piezas';

// ---------- Piezas ----------

/** Cuba en su caballete; con nivel, con la espita de latón y la marca de tiza. */
export function vat(level: number, seed: number): PixelBuffer {
  const b = Prop.cask();
  if (level >= 2) {
    b.rect(12, 21, 4, 3, P.gold);
    b.set(13, 24, P.lemon);
  }
  if (level >= 4) {
    // Cuba de la casa: aros de latón y, tallado en la tapa, el medallón con la jarra.
    for (let a = 0; a < 90; a++) {
      const t = (a / 90) * Math.PI * 2;
      b.set(
        Math.round(14 + Math.cos(t) * 12 - 0.5),
        Math.round(13 + Math.sin(t) * 12 - 0.5),
        P.amber,
      );
    }
    b.ellipse(14, 12, 4.5, 4.5, P.gold);
    b.ellipse(14, 12, 3.5, 3.5, W[2]!);
    b.rect(13, 10, 3, 4, P.gold);
    b.set(16, 11, P.gold);
    b.hline(13, 10, 3, P.sand);
  } else if (level >= 3) {
    // Rayas de tiza: las que se llevan sacadas.
    for (let k = 0; k < 3 + (seed % 2); k++) b.vline(16 + k * 2, 9, 4, P.mist);
    b.line(15, 12, 23, 9, P.mist);
  }
  return b;
}

/** Caldera de cobre sobre su hornillo de ladrillo, con el tiro hasta el techo. */
export function kettle(level: number): PixelBuffer {
  const w = 32;
  const h = 64;
  return Prop.piece(w, h, (p) => {
    // Tiro.
    p.rect(13, 0, 6, 30, P.slate);
    p.vline(13, 0, 30, P.steel);
    p.vline(18, 0, 30, P.navy);
    for (const y of [8, 20]) p.hline(12, y, 8, P.fog);
    // Caldera: cúpula de cobre con remaches.
    p.ellipse(16, 38, 14, 10, P.rust);
    p.ellipse(16, 37, 13, 9, P.brick);
    p.ellipse(13, 34, 6, 4, P.amber);
    p.ellipse(11, 33, 2.5, 1.5, P.gold);
    for (let x = 5; x < 28; x += 4) p.set(x, 41, P.rust);
    p.hline(2, 44, 28, P.rust);
    p.rect(3, 45, 26, 2, P.amber);
    p.hline(3, 45, 26, P.gold);
    // Grifo de salida.
    p.rect(27, 40, 4, 2, P.amber);
    p.set(30, 42, P.gold);
    // Hornillo de ladrillo con su boca encendida.
    stoneWall(p, 1, 47, 30, 17, 'hornillo-bodega', {
      ramp: [P.plum, P.rust, P.brick, P.amber],
      bw: 5,
      bh: 3,
    });
    p.rect(10, 53, 12, 11, P.black);
    p.hline(11, 63, 10, W[3]!);
    p.hline(12, 62, 8, P.orange);
    p.set(15, 61, P.gold);
    if (level >= 3) {
      // La pala de remover, apoyada.
      p.line(29, 22, 31, 46, W[4]!);
      p.rect(28, 18, 3, 5, W[5]!);
    }
  });
}

/** Mesa de cata (nivel 4): una vela, la botella abierta y dos copas. */
function tastingTable(): PixelBuffer {
  return Prop.piece(16, 16, (p) => {
    p.rect(0, 7, 16, 2, W[4]!);
    p.hline(0, 7, 16, W[5]!);
    p.rect(2, 9, 2, 7, W[3]!);
    p.rect(12, 9, 2, 7, W[3]!);
    p.hline(4, 13, 8, W[2]!);
    candleOn(p, 1, 7, 4);
    Prop.bottleOn(p, 6, 7, 2);
    for (const x of [10, 13]) {
      p.rect(x, 3, 2, 2, P.wine);
      p.set(x, 3, P.mist);
      p.vline(x, 5, 2, P.mist);
      p.hline(x - 1, 6, 3, P.mist);
    }
  });
}

/** Sacos de cebada con un manojo de lúpulo encima. */
function barley(level: number): PixelBuffer {
  return Prop.piece(17, 17, (p) => {
    sack(p, 0, 7);
    sack(p, 8, 7, [P.rust, P.clay, P.tan]);
    if (level >= 2) {
      sack(p, 4, 1, [P.clay, P.tan, P.sand]);
      for (let k = 0; k < 3; k++) p.ellipse(6 + k * 2, 1, 1.3, 1.3, k % 2 ? P.lime : P.leaf);
    }
  });
}

/** Jarras colgadas de una tabla (una más por nivel). */
function mugRack(level: number): PixelBuffer {
  return Prop.piece(11, 9, (p) => {
    p.hline(0, 0, 11, W[3]!);
    p.hline(0, 1, 11, W[2]!);
    for (let k = 0; k < Math.min(3, level + 1); k++) {
      const x = 1 + k * 3;
      p.set(x + 1, 2, P.black);
      p.rect(x, 3, 3, 4, k % 2 ? P.clay : P.oak);
      p.hline(x, 3, 3, P.tan);
      p.set(x + 1, 7, W[2]!);
    }
  });
}

/** Guirnalda de lúpulo colgando de un clavo (de 5 de ancho). */
function hops(b: PixelBuffer, x: number, y: number, n: number) {
  b.set(x + 2, y, P.black);
  b.vline(x + 2, y + 1, n * 3 + 1, P.forest);
  for (let k = 0; k < n; k++) {
    const cx = x + 2 + (k % 2 ? 1.5 : -1.5);
    b.ellipse(cx, y + 3 + k * 3, 1.5, 1.6, P.leaf);
    b.set(Math.round(cx), y + 2 + k * 3, P.lime);
  }
}

/** Tina de fermentar: cuba abierta de duelas con la escalera apoyada y espuma arriba. */
function fermentTub(level: number): PixelBuffer {
  return Prop.piece(32, 38, (p) => {
    p.rect(2, 8, 26, 30, W[3]!);
    for (let x = 2; x < 28; x += 4) p.vline(x, 8, 30, W[2]!);
    p.vline(3, 8, 30, W[4]!);
    for (const y of [12, 24, 34]) {
      p.hline(1, y, 28, P.slate);
      p.hline(1, y + 1, 28, P.navy);
    }
    p.ellipse(15, 8, 13, 2.5, W[4]!);
    p.ellipse(15, 8, 11, 1.5, level >= 2 ? P.sand : P.amber);
    if (level >= 2) for (let x = 6; x < 25; x += 3) p.set(x, 7, P.white);
    // Escalera apoyada a la derecha.
    p.line(26, 2, 31, 37, W[4]!);
    p.line(23, 4, 28, 37, W[4]!);
    for (let y = 8; y < 36; y += 6) p.hline(24 + Math.floor(y / 7), y, 4, W[5]!);
  });
}

/** Mesa de embotellar: botellas, embudo y una caja de botellas llenas. */
function bottling(level: number): PixelBuffer {
  return Prop.piece(30, 22, (p) => {
    p.rect(0, 12, 30, 3, W[4]!);
    p.hline(0, 12, 30, W[5]!);
    p.rect(2, 15, 3, 7, W[3]!);
    p.rect(25, 15, 3, 7, W[3]!);
    for (let k = 0; k < 2 + level; k++) Prop.bottleOn(p, 2 + k * 5, 12, k + 3);
    // Embudo.
    p.rect(22, 6, 6, 2, P.steel);
    p.rect(24, 8, 2, 4, P.slate);
    p.hline(22, 6, 6, P.fog);
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const lvl = room.level;
  const w = cells.at(-1)!.x1;
  for (const s of stretchesOf(room, w)) {
    // Jarras colgadas en el tramo de la derecha; lúpulo en los de en medio.
    if (s.kind === 'right' && bx(s.x1) - bx(s.x0) >= 12) b.blit(mugRack(lvl), bx(s.x0) + 1, 22);
    if (s.kind === 'mid' && lvl >= 2) hops(b, bx(s.x1) - 8, 14, 3 + lvl);
  }
  // Sin ventana, en su sitio: la pizarra de las cuentas, el letrero de la casa y un estante de
  // botellas (uno distinto en cada sitio).
  cells.forEach((c, j) => {
    if (c.glass) return;
    const x = bx(c.win);
    if (j % 3 === 0) {
      b.rect(x - 8, 14, 16, 12, W[3]!);
      b.rect(x - 7, 15, 14, 10, P.black);
      for (let k = 0; k < 2 + lvl; k++) b.vline(x - 5 + k * 2, 17, 4, P.mist);
      b.line(x - 6, 20, x - 4 + (2 + lvl) * 2, 18, P.mist);
      b.hline(x - 5, 23, 8, P.fog);
    } else if (j % 3 === 1) b.blit(brewSign(), x - 9, 12);
    else {
      shelf(b, x - 10, 26, 20);
      for (let k = 0; k < 4; k++) Prop.bottleOn(b, x - 8 + k * 5, 26, k + 1);
    }
  });
}

/** Letrero de la casa: una tabla con un barril y una jarra pintados. */
function brewSign(): PixelBuffer {
  return Prop.piece(18, 16, (p) => {
    p.vline(4, 0, 3, P.slate);
    p.vline(13, 0, 3, P.slate);
    p.rect(0, 3, 18, 13, W[4]!);
    p.rect(1, 4, 16, 11, W[3]!);
    p.hline(0, 3, 18, W[5]!);
    p.ellipse(6, 9.5, 3.5, 3.5, W[5]!);
    p.vline(4, 7, 6, P.slate);
    p.vline(8, 7, 6, P.slate);
    p.rect(11, 7, 4, 5, P.gold);
    p.hline(11, 7, 4, P.white);
    p.vline(15, 8, 3, P.gold);
  });
}

/** Barriles apilados: dos abajo y uno encima. */
function barrels(): PixelBuffer {
  return Prop.piece(26, 28, (b) => {
    const one = Prop.barrel();
    b.blit(one, 0, 13);
    b.blit(one, 13, 13);
    b.blit(one, 7, 0);
  });
}

/**
 * La pequeña: la caldera (desde el nivel 2), los barriles y la cuba bajo la ventana. Las anchas
 * suman la tina de fermentar con la cebada (primer tramo de en medio) y la mesa de embotellar
 * con el botellero (segundo); bajo la ventana de en medio, barriles apilados.
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      if (lvl >= 2)
        t.push(
          task(
            thick(
              emits(
                at(kettle(lvl), s.x0 + 22, WALL + 2, 0, fire(4, 70, FIRE, false)),
                // Vapor de la cúpula y alguna ascua que salta de la boca del hornillo.
                { kind: 'steam', rate: 3, at: [8, 29, 24, 33] },
                { kind: 'ember', rate: 1.2, at: [11, 56, 21, 61] },
              ),
              10,
            ),
            'caldera',
          ),
        );
      if (lvl >= 4) t.push(thick(at(tastingTable(), s.x0 + 52, WALL, 0, candle(12, 36, 0.5)), 5));
      else
        t.push(
          task(
            thick(
              at(lvl >= 2 ? Prop.barrel() : barrels(), lvl >= 2 ? s.x0 + 51 : s.x0 + 22, WALL),
              8,
            ),
            'barril',
          ),
        );
    } else if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          [fermentTub(lvl), WALL],
          [barley(lvl), WALL - 2],
        ]).map((x, k) =>
          k === 0
            ? task(thick(emits(x, { kind: 'bubble', rate: 2.5, at: [5, 6, 25, 9] }), 10), 'cuba')
            : thick(x, 5),
        ),
      );
    else if (s.kind === 'mid')
      t.push(
        ...row(s, [
          [lvl >= 3 ? Prop.wineRack() : barrels(), WALL],
          [bottling(lvl), WALL - 2],
        ]).map((x, k) => (k === 1 ? task(thick(x, 5), 'barril') : thick(x, k === 0 ? 12 : 5))),
      );
  }
  cellsOf(room, w).forEach((c, j) =>
    t.push(
      task(
        thick(at(j === 1 ? barrels() : vat(lvl, j), c.win, WALL), 10),
        j === 1 ? 'barril' : 'cuba',
      ),
    ),
  );
  return t;
}

/** Por reparar: la cuba sin aros, barriles tirados y telarañas. */
function ruin(room: Room, w: number): Thing[] {
  const broken = Prop.cask();
  web(broken, 3, 1, 1);
  for (let y = 4; y < 22; y += 3) broken.set(14, y, P.black);
  const t: Thing[] = [];
  for (const c of cellsOf(room, w)) t.push(at(broken, c.win, WALL));
  for (const s of stretchesOf(room, w))
    if (s.kind !== 'right')
      t.push(at(Prop.barrel(), s.x0 + 20, WALL), at(Prop.brokenChair(), s.x0 + 44, 18));
  return t;
}

export const bodega: RoomArt = { wall, things, ruin };
