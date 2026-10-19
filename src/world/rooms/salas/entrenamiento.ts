/**
 * Arte de las salas de entrenamiento: la sala de armas (Fuerza), la galería de tiro (Destreza)
 * y la biblioteca (Mente). Lo alto va a la izquierda de cada ventana (el muñeco y el armero de
 * palos, las dianas, las estanterías); bajo la ventana, lo bajo (pesas, el barril de flechas,
 * el pupitre); a su derecha, algo colgado. Con el nivel llegan más cosas y mejores.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FLOOR_D,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  candle,
  cellsOf,
  row,
  sconceOn,
  stretchesOf,
  wallLight,
  type Cell,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, web } from './piezas';

// ---------- Sala de armas ----------

/** Muñeco de paja en su poste; el del nivel 3, con yelmo y peto. */
function dummy(level: number): PixelBuffer {
  return Prop.piece(16, 36, (p) => {
    p.rect(7, 12, 2, 22, W[3]!);
    p.rect(3, 33, 10, 3, W[2]!);
    p.hline(3, 33, 10, W[4]!);
    // Brazos de palo.
    p.rect(0, 13, 16, 2, W[4]!);
    // Cuerpo de saco relleno de paja, atado.
    p.ellipse(8, 19, 5, 6.5, P.tan);
    p.ellipse(7, 18, 3, 4.5, P.sand);
    p.hline(3, 19, 10, P.clay);
    // Cabeza.
    p.ellipse(8, 6, 4, 4, P.tan);
    p.ellipse(7, 5, 2, 2, P.sand);
    p.hline(5, 9, 6, P.clay);
    if (level >= 3) {
      // Yelmo y peto de hierro.
      p.ellipse(8, 5, 4.5, 4, P.steel);
      p.rect(4, 5, 9, 2, P.steel);
      p.hline(5, 6, 7, P.black);
      p.set(6, 3, P.fog);
      p.ellipse(8, 19, 5, 5.5, P.slate);
      p.ellipse(7, 17.5, 3, 3.5, P.steel);
      p.set(6, 16, P.fog);
    } else {
      // Una cruz pintada donde se golpea.
      p.set(7, 18, P.wine);
      p.set(9, 20, P.wine);
      p.set(9, 18, P.wine);
      p.set(7, 20, P.wine);
      p.set(8, 19, P.red);
    }
  });
}

/** Armero de pie con espadas de madera, palos y un escudo de prácticas. */
function stickRack(level: number): PixelBuffer {
  return Prop.piece(18, 30, (p) => {
    p.rect(0, 26, 18, 4, W[3]!);
    p.hline(0, 26, 18, W[5]!);
    p.rect(1, 8, 16, 2, W[4]!);
    p.vline(1, 8, 20, W[2]!);
    p.vline(16, 8, 20, W[2]!);
    const n = Math.min(4, level + 1);
    for (let k = 0; k < n; k++) {
      const x = 4 + k * 3;
      p.vline(x, 1 + (k % 2) * 2, 25, k % 2 ? W[5]! : W[4]!);
      if (k % 2 === 0) p.hline(x - 1, 9, 3, W[2]!);
    }
    if (level >= 2) {
      // Escudo redondo de prácticas.
      p.ellipse(9, 18, 5, 5, W[4]!);
      p.ellipse(9, 18, 3.5, 3.5, W[5]!);
      p.ellipse(9, 18, 1, 1, P.slate);
    }
  });
}

/** Pesas: piedras, la barra con discos y, en el nivel 3, pesas rusas. */
function weights(level: number): PixelBuffer {
  return Prop.piece(28, 14, (p) => {
    // Dos piedras de levantar.
    p.ellipse(4, 10.5, 4, 3.5, P.steel);
    p.ellipse(3.5, 10, 2.5, 2, P.fog);
    p.ellipse(11, 11, 3, 3, P.slate);
    p.ellipse(10.5, 10.5, 1.8, 1.5, P.steel);
    if (level >= 2) {
      // Barra con dos discos de piedra.
      p.hline(13, 7, 15, P.slate);
      for (const x of [15, 25]) {
        p.ellipse(x, 7, 2, 5, P.navy);
        p.ellipse(x - 0.5, 6.5, 1, 3.5, P.steel);
      }
    }
    if (level >= 3) {
      for (const x of [16, 23]) {
        p.ellipse(x, 12, 2.5, 2.2, P.black);
        p.set(x - 1, 11, P.slate);
        p.rect(x - 1, 8, 3, 1, P.black);
        p.set(x - 2, 9, P.black);
        p.set(x + 2, 9, P.black);
      }
    }
  });
}

/** Saco de golpear colgado de su horca de madera (de pie, contra la pared). */
function punchBag(): PixelBuffer {
  return Prop.piece(11, 36, (p) => {
    // Poste, brazo y pie.
    p.rect(8, 1, 2, 33, W[3]!);
    p.vline(8, 1, 33, W[4]!);
    p.rect(2, 1, 8, 2, W[4]!);
    p.hline(2, 1, 8, W[5]!);
    p.rect(4, 33, 7, 3, W[2]!);
    // Cuerda y saco.
    p.vline(4, 3, 4, P.tan);
    p.rect(1, 7, 6, 18, P.umber);
    p.vline(1, 7, 18, P.cocoa);
    p.vline(6, 8, 17, P.ebony);
    p.ellipse(4, 25, 3, 1.5, P.umber);
    for (const y of [10, 22]) p.hline(1, y, 6, P.tan);
  });
}

/** Rollo de cuerda colgado de un clavo (sin tocar la pared de dentro del aro). */
function rope(b: PixelBuffer, x: number, y: number) {
  b.set(x + 3, y, P.black);
  for (let j = 0; j < 9; j++)
    for (let i = 0; i < 8; i++) {
      const nx = (i + 0.5 - 4) / 4;
      const ny = (j + 0.5 - 5) / 4.2;
      const d = nx * nx + ny * ny;
      if (d <= 1 && d > 0.35) b.set(x + i, y + 1 + j, j > 5 ? P.clay : P.tan);
    }
  b.vline(x + 1, y + 8, 4, P.clay);
}

function armasWall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const last = cells.at(-1)!;
  const winR = bx(last.win + WIN_HALF);
  if (bx(last.x1) - winR >= 9) {
    // La cuerda de trepar; desde el nivel 2, en su sitio, un aplique.
    if (room.level < 2) rope(b, winR + 1, 16);
    else sconceOn(b, winR + 5, 16);
  }
  // Sin ventana: la pizarra con las marcas de cada uno.
  for (const c of cells)
    if (!c.glass) {
      const x = bx(c.win) - 8;
      b.rect(x, 14, 16, 12, W[3]!);
      b.rect(x + 1, 15, 14, 10, P.black);
      for (let k = 0; k < 3; k++) {
        b.hline(x + 2, 17 + k * 3, 3, P.mist);
        b.hline(x + 7, 17 + k * 3, 1 + ((k * 3 + room.level + c.i) % 6), P.fog);
      }
    }
}

function armasFloor(b: PixelBuffer, room: Room): void {
  if (room.level < 2) return;
  // Estera de lucha delante de cada tramo.
  for (const s of stretchesOf(room, b.w)) {
    if (s.kind === 'right') continue;
    const x0 = Math.round(s.x0 + 6);
    const x1 = Math.round(s.x1 - 6);
    b.rect(x0, 8, x1 - x0, FLOOR_D - 16, P.clay);
    b.rect(x0 + 1, 9, x1 - x0 - 2, FLOOR_D - 18, room.level >= 3 ? P.wine : P.tan);
    b.hline(x0 + 3, FLOOR_D / 2, x1 - x0 - 6, P.sand);
  }
}

/** Soporte de barras con discos de piedra (de pie). */
function barbellRack(level: number): PixelBuffer {
  return Prop.piece(24, 30, (p) => {
    p.rect(1, 2, 2, 28, W[3]!);
    p.rect(21, 2, 2, 28, W[3]!);
    p.rect(0, 27, 24, 3, W[2]!);
    for (const y of [6, 16]) p.rect(0, y, 24, 2, W[4]!);
    const n = Math.min(2, level);
    for (let k = 0; k < n; k++) {
      const y = 5 + k * 10;
      p.hline(0, y, 24, P.slate);
      for (const x of [4, 19]) {
        p.ellipse(x, y, 1.6, 4, P.navy);
        p.ellipse(x - 0.4, y - 0.5, 0.8, 2.6, P.steel);
      }
    }
  });
}

/** Piedras de levantar, de menor a mayor. */
function atlasStones(): PixelBuffer {
  return Prop.piece(30, 14, (p) => {
    for (const [x, r] of [
      [4, 3.5],
      [12, 4.5],
      [23, 6.5],
    ] as const) {
      p.ellipse(x, 14 - r, r, r, P.slate);
      p.ellipse(x - r / 3, 14 - r * 1.2, r / 2, r / 2.5, P.steel);
      p.set(Math.round(x - r / 2), Math.round(14 - r * 1.5), P.fog);
    }
  });
}

/** Banco de pesas con su barra encima (bajo, cabe bajo una ventana). */
function pressBench(): PixelBuffer {
  return Prop.piece(30, 16, (p) => {
    p.rect(4, 9, 22, 3, W[4]!);
    p.hline(4, 9, 22, W[5]!);
    p.rect(6, 12, 2, 4, W[3]!);
    p.rect(22, 12, 2, 4, W[3]!);
    for (const x of [3, 27]) p.vline(x, 2, 14, W[3]!);
    p.hline(0, 3, 30, P.slate);
    for (const x of [1, 29]) {
      p.ellipse(x, 3, 1.4, 3.5, P.navy);
      p.set(x, 2, P.steel);
    }
  });
}

/** Poste de prácticas con brazos de madera (para parar golpes). */
function armPost(): PixelBuffer {
  return Prop.piece(18, 36, (p) => {
    p.rect(3, 33, 12, 3, W[2]!);
    p.rect(7, 2, 5, 31, W[3]!);
    p.vline(7, 2, 31, W[4]!);
    p.vline(11, 2, 31, W[2]!);
    p.ellipse(9.5, 2, 2.5, 1.5, W[5]!);
    for (const [y, dir] of [
      [9, -1],
      [12, 1],
      [20, -1],
    ] as const) {
      p.line(dir < 0 ? 7 : 12, y, dir < 0 ? 1 : 17, y - 2, W[4]!);
      p.line(dir < 0 ? 7 : 12, y + 1, dir < 0 ? 1 : 17, y - 1, W[2]!);
    }
    // Vendas en el tronco, donde más se pega.
    for (const y of [15, 17]) p.hline(7, y, 5, P.sand);
  });
}

/** Tronco de levantar en sus dos borriquetas. */
function logLift(): PixelBuffer {
  return Prop.piece(32, 14, (p) => {
    for (const x of [5, 25]) {
      p.line(x - 3, 13, x, 6, W[3]!);
      p.line(x + 3, 13, x, 6, W[3]!);
    }
    p.rect(1, 3, 30, 5, W[3]!);
    p.hline(1, 3, 30, W[5]!);
    p.hline(1, 7, 30, W[1]!);
    p.ellipse(1, 5.5, 1.5, 2.5, W[5]!);
    p.ellipse(31, 5.5, 1.5, 2.5, W[4]!);
    for (const x of [9, 22]) p.vline(x, 3, 5, P.tan);
  });
}

/**
 * La pequeña: el muñeco, el armero de palos, las pesas y el saco. Las anchas suman el
 * soporte de barras con las piedras de levantar (primer tramo de en medio) y el poste con
 * brazos con el tronco en sus borriquetas (segundo); bajo las otras ventanas, el banco.
 */
function armasThings(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left')
      t.push(
        ...row(s, [
          [dummy(lvl), WALL],
          [stickRack(lvl), WALL],
        ]),
      );
    else if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          [barbellRack(lvl), WALL],
          [atlasStones(), WALL - 2],
        ]),
      );
    else if (s.kind === 'mid')
      t.push(
        ...row(s, [
          [armPost(), WALL],
          [logLift(), WALL - 2],
        ]),
      );
    else if (lvl >= 2) t.push(at(punchBag(), Math.min(s.x0 + 8, w - 8), WALL));
  }
  const cells = cellsOf(room, w);
  cells.forEach((c, j) => t.push(at(j === 1 ? pressBench() : weights(lvl), c.win, WALL)));
  // La luz del aplique (ver armasWall).
  const winR = bx(cells.at(-1)!.win + WIN_HALF);
  if (lvl >= 2 && bx(cells.at(-1)!.x1) - winR >= 9) t.push(wallLight(room, winR + 5, 16));
  return t;
}

function armasRuin(room: Room, w: number): Thing[] {
  const broken = dummy(1);
  web(broken, 1, 0, 1);
  for (let y = 14; y < 26; y += 2) broken.set(8 + (y % 4), y, P.black);
  return cellsOf(room, w).flatMap((c) => [
    at(broken, c.x0 + 18, WALL),
    at(Prop.crate(), c.win, WALL),
  ]);
}

export const armas: RoomArt = {
  wall: armasWall,
  things: armasThings,
  ruin: armasRuin,
  floor: armasFloor,
};

// ---------- Galería de tiro ----------

/** Diana de paja en su caballete, con flechas clavadas (más cuanto más nivel). */
function target(arrows: number, seed: number): PixelBuffer {
  return Prop.piece(22, 30, (p) => {
    // Caballete.
    p.line(3, 29, 7, 12, W[3]!);
    p.line(18, 29, 14, 12, W[3]!);
    p.hline(5, 24, 12, W[2]!);
    // Bala de paja con la diana pintada.
    p.ellipse(11, 12, 10, 10, P.gold);
    p.ellipse(11, 12, 9, 9, P.sand);
    p.ellipse(11, 12, 7, 7, P.red);
    p.ellipse(11, 12, 5, 5, P.sand);
    p.ellipse(11, 12, 3, 3, P.red);
    p.ellipse(11, 12, 1.3, 1.3, P.lemon);
    for (let k = 0; k < 6; k++) p.set(3 + k * 3, 3 + ((k * 7) % 5), P.tan);
    // Flechas: el astil sale hacia nosotros (un punto y la pluma).
    const spots: [number, number][] = [
      [10, 11],
      [14, 8],
      [7, 15],
      [13, 15],
      [8, 7],
    ];
    for (let k = 0; k < Math.min(arrows, spots.length); k++) {
      const [x, y] = spots[(k + seed) % spots.length]!;
      p.set(x, y, W[1]!);
      p.line(x, y, x + 2, y - 2, W[5]!);
      p.set(x + 2, y - 3, k % 2 ? P.white : P.red);
      p.set(x + 3, y - 2, k % 2 ? P.white : P.red);
    }
  });
}

/** Barril de flechas con un arco apoyado (más bajo que el alféizar). */
function arrowBarrel(level: number): PixelBuffer {
  return Prop.piece(18, 28, (p) => {
    // Flechas asomando.
    for (let k = 0; k < 4 + level; k++) {
      const x = 3 + ((k * 3) % 9);
      p.vline(x, 4 + (k % 3), 10, W[5]!);
      p.set(x, 3 + (k % 3), k % 2 ? P.white : P.red);
      p.set(x + 1, 3 + (k % 3), k % 2 ? P.red : P.white);
    }
    p.blit(Prop.barrel(), 0, 13);
    // El arco apoyado a la derecha.
    for (let y = 0; y < 26; y++) {
      const dx = Math.round(Math.sin((y / 25) * Math.PI) * 4);
      p.set(13 + dx, y, W[4]!);
    }
    p.vline(13, 0, 26, P.mist);
  });
}

/** Tablón de cuchillos (nivel 3): una silueta pintada con dagas clavadas. */
function knifeBoard(): PixelBuffer {
  return Prop.piece(16, 22, (p) => {
    p.rect(0, 0, 16, 22, W[4]!);
    for (let x = 0; x < 16; x += 4) p.vline(x, 0, 22, W[3]!);
    p.ellipse(8, 5, 2.5, 2.5, P.black);
    p.rect(5, 8, 6, 8, P.black);
    p.rect(6, 16, 2, 5, P.black);
    p.rect(9, 16, 2, 5, P.black);
    for (const [x, y] of [
      [3, 4],
      [13, 7],
      [3, 13],
      [13, 16],
    ]) {
      p.set(x!, y!, P.mist);
      p.set(x! + 1, y!, W[2]!);
    }
  });
}

/** Arco y aljaba colgados de la pared. */
function bowPeg(b: PixelBuffer, x: number, y: number, level: number) {
  b.set(x + 4, y, P.black);
  for (let k = 0; k < 20; k++) {
    const dx = Math.round(Math.sin((k / 19) * Math.PI) * 3);
    b.set(x + 1 + dx, y + 1 + k, W[4]!);
  }
  b.vline(x + 1, y + 1, 20, P.mist);
  if (level >= 2) {
    b.rect(x + 6, y + 3, 3, 12, P.umber);
    b.vline(x + 6, y + 3, 12, P.cocoa);
    for (let k = 0; k < 3; k++) b.set(x + 6 + k, y + 2, k % 2 ? P.white : P.red);
  }
}

function tiroWall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const last = cells.at(-1)!;
  const winR = bx(last.win + WIN_HALF);
  if (bx(last.x1) - winR >= 10) bowPeg(b, winR + 1, 14, room.level);
  // Desde el nivel 2, un aplique a la izquierda de la primera ventana (encima de las dianas).
  if (room.level >= 2) sconceOn(b, bx(cells[0]!.win - WIN_HALF) - 8, 18);
  for (const c of cells) if (!c.glass) b.blit(Prop.dartboard(), bx(c.win) - 7, 14);
}

function tiroFloor(b: PixelBuffer, room: Room): void {
  // La raya de tiro, delante, de pared a pared.
  for (let x = 2; x < b.w - 2; x += 4)
    b.hline(x, FLOOR_D - 6, 2, room.level >= 2 ? P.white : P.sand);
}

/** Soporte de ballestas: dos ballestas colgadas y los virotes. */
function crossbowRack(): PixelBuffer {
  return Prop.piece(22, 34, (p) => {
    p.rect(0, 30, 22, 4, W[2]!);
    p.rect(1, 2, 2, 28, W[3]!);
    p.rect(19, 2, 2, 28, W[3]!);
    p.rect(0, 2, 22, 2, W[4]!);
    for (const y of [9, 21]) {
      p.hline(4, y, 14, W[4]!);
      p.line(4, y - 2, 11, y + 1, P.slate);
      p.line(18, y - 2, 11, y + 1, P.slate);
      p.vline(11, y, 6, W[4]!);
      p.set(11, y - 1, P.fog);
    }
    for (let k = 0; k < 4; k++) p.vline(5 + k * 4, 26, 4, W[5]!);
  });
}

/** Bala de paja con un jabalí pintado y flechas clavadas. */
function boarTarget(arrows: number): PixelBuffer {
  return Prop.piece(30, 22, (p) => {
    p.rect(0, 6, 30, 16, P.gold);
    p.rect(1, 7, 28, 14, P.sand);
    for (let x = 2; x < 28; x += 3) p.vline(x, 8, 12, P.tan);
    p.hline(0, 14, 30, P.clay);
    // El jabalí.
    p.ellipse(15, 13, 8, 4, P.umber);
    p.rect(7, 12, 3, 3, P.umber);
    p.set(6, 13, P.black);
    p.rect(10, 16, 2, 3, P.umber);
    p.rect(19, 16, 2, 3, P.umber);
    p.set(8, 11, P.white);
    // Flechas.
    for (let k = 0; k < arrows; k++) {
      const x = 12 + k * 4;
      const y = 11 + (k % 2) * 3;
      p.set(x, y, W[1]!);
      p.line(x, y, x + 2, y - 3, W[5]!);
      p.set(x + 2, y - 4, P.red);
    }
    // Patas del caballete.
    p.line(4, 21, 2, 0, W[3]!);
    p.line(26, 21, 28, 0, W[3]!);
    p.hline(2, 0, 27, W[3]!);
  });
}

/** Mesa de emplumar: plumas, astiles y la cola (cabe bajo una ventana). */
function fletchBench(): PixelBuffer {
  return Prop.piece(26, 16, (p) => {
    p.rect(0, 7, 26, 3, W[4]!);
    p.hline(0, 7, 26, W[5]!);
    p.rect(2, 10, 3, 6, W[3]!);
    p.rect(21, 10, 3, 6, W[3]!);
    for (let k = 0; k < 4; k++) p.hline(2, 6 - k, 12, W[5]!);
    for (const [x, c] of [
      [17, P.red],
      [19, P.white],
      [21, P.red],
    ] as const)
      p.rect(x, 4, 1, 3, c);
    p.rect(23, 4, 2, 3, P.slate);
  });
}

/** Soporte de arcos de pie. */
function bowRack(): PixelBuffer {
  return Prop.piece(18, 32, (p) => {
    p.rect(0, 28, 18, 4, W[2]!);
    p.rect(0, 4, 18, 2, W[4]!);
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 6;
      for (let y = 0; y < 26; y++)
        p.set(x + Math.round(Math.sin((y / 25) * Math.PI) * 2), y + 2, W[4]!);
      p.vline(x, 2, 26, P.mist);
    }
  });
}

/**
 * La pequeña: las dianas, el barril de flechas y el arco colgado. Las anchas suman las
 * ballestas con el jabalí de paja (primer tramo de en medio) y el soporte de arcos con otra
 * diana (segundo); bajo la ventana de en medio, la mesa de emplumar.
 */
function tiroThings(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      const items: [PixelBuffer, number][] = [[target(1 + lvl, 0), WALL]];
      if (lvl >= 3) items.push([knifeBoard(), WALL]);
      else if (lvl >= 2) items.push([target(lvl, 2), WALL]);
      t.push(...row(s, items));
    } else if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          [crossbowRack(), WALL],
          [boarTarget(1 + lvl), WALL],
        ]),
      );
    else if (s.kind === 'mid')
      t.push(
        ...row(s, [
          [bowRack(), WALL],
          [target(lvl + 1, 3), WALL],
        ]),
      );
  }
  const cells = cellsOf(room, w);
  cells.forEach((c, j) => t.push(at(j === 1 ? fletchBench() : arrowBarrel(lvl), c.win, WALL)));
  // La luz del aplique (ver tiroWall).
  if (lvl >= 2) t.push(wallLight(room, bx(cells[0]!.win - WIN_HALF) - 8, 18));
  return t;
}

function tiroRuin(room: Room, w: number): Thing[] {
  const broken = target(0, 0);
  web(broken, 1, 2, 1);
  return cellsOf(room, w).flatMap((c) => [
    at(broken, c.x0 + 30, WALL),
    at(Prop.crate(), c.win, WALL),
  ]);
}

export const tiro: RoomArt = {
  wall: tiroWall,
  things: tiroThings,
  ruin: tiroRuin,
  floor: tiroFloor,
};

// ---------- Biblioteca ----------

/** Estantería de libros: medio vacía al principio, llena y con remate con nivel. */
function bookcase(level: number, seed: number): PixelBuffer {
  return Prop.piece(24, 44, (p) => {
    p.rect(0, 2, 24, 42, W[2]!);
    p.rect(2, 4, 20, 38, W[1]!);
    p.rect(0, 0, 24, 3, W[4]!);
    p.hline(0, 0, 24, W[5]!);
    if (level >= 3) {
      p.hline(4, 0, 16, P.gold);
      p.set(12, 0, P.lemon);
    }
    const spines = [P.wine, P.ocean, P.forest, P.rust, P.grape, P.amber, P.slate, P.brick];
    let k = seed * 3;
    [14, 28, 42].forEach((sy, row) => {
      p.rect(0, sy, 24, 2, W[4]!);
      p.hline(0, sy, 24, W[5]!);
      // Cuántos libros caben en la balda según el nivel.
      const fill = level >= 2 ? 19 : level === 1 ? (row === 1 ? 9 : 14) : row === 2 ? 5 : 0;
      let x = 3;
      while (x < 3 + fill) {
        const h = 7 + ((k * 5) % 4);
        const w = 2 + (k % 2);
        if (x + w > 22) break;
        p.rect(x, sy - h, w, h, spines[k % spines.length]!);
        p.set(x, sy - h + 2, P.gold);
        x += w + (k % 7 === 0 ? 1 : 0);
        k++;
      }
      // Un libro tumbado o una calavera al final de la balda.
      if (row === 0 && level >= 3) {
        p.ellipse(19, sy - 3, 2.5, 2.5, P.mist);
        p.set(18, sy - 3, P.black);
        p.set(20, sy - 3, P.black);
      }
    });
  });
}

/** Pupitre de lectura con un libro abierto (y la vela desde el nivel 2). */
function readingDesk(level: number): PixelBuffer {
  return Prop.piece(24, 20, (p) => {
    p.rect(0, 9, 24, 3, W[4]!);
    p.hline(0, 9, 24, W[5]!);
    p.hline(0, 11, 24, W[2]!);
    p.rect(2, 12, 3, 8, W[3]!);
    p.rect(19, 12, 3, 8, W[3]!);
    // Libro abierto.
    p.rect(7, 6, 10, 3, P.white);
    p.vline(12, 6, 3, P.fog);
    p.hline(8, 7, 3, P.fog);
    p.hline(13, 7, 3, P.fog);
    p.hline(6, 9, 12, P.wine);
    // Pila de libros.
    p.rect(1, 6, 5, 2, P.ocean);
    p.rect(2, 4, 4, 2, P.forest);
    if (level >= 2) {
      p.rect(19, 7, 4, 2, P.steel);
      candleOn(p, 20, 7, 4);
    }
    if (level >= 3) {
      // Reloj de arena.
      p.hline(1, 0, 4, W[3]!);
      p.set(2, 1, P.sand);
      p.set(3, 1, P.sand);
      p.set(2, 2, P.mist);
      p.set(3, 3, P.sand);
    }
  });
}

/** Bola del mundo en su pie (nivel 3) o una pila de libros en el suelo. */
function globe(): PixelBuffer {
  return Prop.piece(10, 24, (p) => {
    p.rect(2, 22, 6, 2, W[3]!);
    p.vline(5, 12, 10, W[3]!);
    p.ellipse(5, 7, 4.8, 4.8, P.gold);
    p.ellipse(5, 7, 4, 4, P.ocean);
    p.rect(3, 4, 3, 3, P.leaf);
    p.rect(6, 8, 2, 2, P.leaf);
    p.set(2, 8, P.lime);
  });
}

function bookPile(): PixelBuffer {
  return Prop.piece(8, 9, (p) => {
    const c = [P.wine, P.forest, P.ocean, P.rust];
    for (let k = 0; k < 4; k++) {
      p.rect(k % 2, 7 - k * 2, 7 - (k % 2), 2, c[k]!);
      p.hline(k % 2, 7 - k * 2, 7 - (k % 2), P.sand);
    }
  });
}

/** Lámina de estrellas (un mapa del cielo) colgada. */
function starChart(): PixelBuffer {
  return Prop.piece(10, 14, (p) => {
    p.rect(0, 0, 10, 14, P.navy);
    p.rect(1, 1, 8, 12, P.black);
    for (const [x, y] of [
      [2, 3],
      [6, 2],
      [4, 6],
      [7, 8],
      [3, 10],
    ]) {
      p.set(x!, y!, P.lemon);
    }
    p.line(2, 3, 4, 6, P.slate);
    p.line(4, 6, 7, 8, P.slate);
    p.hline(0, 0, 10, P.gold);
  });
}

function bibliotecaWall(b: PixelBuffer, room: Room, _look: SalonLook, ctx: WallCtx): void {
  if (ctx.ruin) return;
  const last = ctx.cells.at(-1)!;
  const winR = bx(last.win + WIN_HALF);
  if (room.level >= 2 && bx(last.x1) - winR >= 11) b.blit(starChart(), winR + 1, 14);
  for (const c of ctx.cells)
    if (!c.glass) {
      // Un retrato del fundador donde iría la ventana.
      const x = bx(c.win) - 7;
      b.rect(x, 12, 14, 18, P.gold);
      b.rect(x + 1, 13, 12, 16, P.plum);
      b.ellipse(x + 7, 19, 3, 3.5, P.skinS);
      b.rect(x + 3, 23, 8, 6, c.i % 2 ? P.ocean : P.wine);
      b.hline(x + 4, 16, 6, c.i % 2 ? P.umber : P.mist);
    }
}

function bibliotecaFloor(b: PixelBuffer, room: Room, cells: Cell[]): void {
  if (room.level < 2) return;
  for (const c of cells) {
    const x0 = Math.round(c.win - 22);
    b.rect(x0, 9, 44, FLOOR_D - 18, P.deep);
    b.rect(x0 + 1, 10, 42, FLOOR_D - 20, room.level >= 3 ? P.grape : P.forest);
    for (let x = x0 + 3; x < x0 + 42; x += 4) b.set(x, FLOOR_D / 2, P.gold);
  }
}

/** Atril grande con el libro gordo abierto (y su cadena, como en las bibliotecas de antes). */
function bigLectern(): PixelBuffer {
  return Prop.piece(20, 30, (p) => {
    p.rect(4, 27, 12, 3, W[3]!);
    p.rect(8, 12, 4, 15, W[3]!);
    p.vline(8, 12, 15, W[4]!);
    for (let i = 0; i < 20; i++) p.vline(i, 10 - Math.floor(i / 4), 3, W[4]!);
    p.rect(1, 2, 8, 6, P.white);
    p.rect(11, 1, 8, 6, P.white);
    for (let y = 3; y < 7; y += 2) {
      p.hline(2, y, 6, P.fog);
      p.hline(12, y - 1, 6, P.fog);
    }
    p.vline(10, 1, 7, P.wine);
    p.hline(0, 8, 20, P.wine);
    for (let y = 12; y < 26; y += 2) p.set(16, y, P.slate);
  });
}

/** Casillero de pergaminos enrollados. */
function scrollCabinet(level: number): PixelBuffer {
  return Prop.piece(24, 36, (p) => {
    p.rect(0, 0, 24, 36, W[2]!);
    p.rect(0, 0, 24, 2, W[4]!);
    let k = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        const x = 2 + c * 7;
        const y = 3 + r * 8;
        p.rect(x, y, 6, 6, W[1]!);
        if (k++ < 6 + level * 2) {
          p.ellipse(x + 2, y + 3, 1.8, 1.8, (r + c) % 2 ? P.sand : P.tan);
          p.ellipse(x + 4, y + 4, 1.8, 1.8, (r + c) % 2 ? P.tan : P.sand);
          p.set(x + 2, y + 3, P.clay);
        }
      }
  });
}

/** Sillón de orejas con su cojín. */
function armchair(): PixelBuffer {
  return Prop.piece(22, 24, (p) => {
    p.rect(2, 0, 18, 16, P.wine);
    p.rect(4, 2, 14, 12, P.red);
    p.rect(0, 10, 4, 10, P.wine);
    p.rect(18, 10, 4, 10, P.wine);
    p.rect(3, 14, 16, 5, P.red);
    p.hline(3, 14, 16, P.coral);
    p.rect(2, 19, 2, 5, W[2]!);
    p.rect(18, 19, 2, 5, W[2]!);
    p.rect(8, 11, 6, 3, P.gold);
  });
}

/** Mesita con una vela y una pila de libros (alumbra la lectura). */
function sideTable(): PixelBuffer {
  return Prop.piece(12, 22, (p) => {
    p.rect(0, 10, 12, 2, W[4]!);
    p.hline(0, 10, 12, W[5]!);
    p.rect(5, 12, 2, 8, W[3]!);
    p.rect(2, 20, 8, 2, W[3]!);
    p.rect(1, 8, 6, 2, P.ocean);
    p.rect(2, 6, 5, 2, P.wine);
    p.rect(8, 8, 3, 2, P.steel);
    candleOn(p, 9, 8, 4);
  });
}

/** Mesa del alquimista: matraces, un alambique y una calavera (bajo una ventana). */
function alchemyTable(): PixelBuffer {
  return Prop.piece(26, 18, (p) => {
    p.rect(0, 8, 26, 3, W[4]!);
    p.hline(0, 8, 26, W[5]!);
    p.rect(2, 11, 3, 7, W[3]!);
    p.rect(21, 11, 3, 7, W[3]!);
    p.ellipse(5, 6, 2.5, 2, P.lime);
    p.vline(5, 2, 3, P.mist);
    p.ellipse(12, 6, 2, 2, P.rose);
    p.rect(11, 2, 2, 3, P.mist);
    p.ellipse(19, 5.5, 3, 2.5, P.mist);
    p.set(18, 5, P.black);
    p.set(20, 5, P.black);
    p.hline(18, 7, 3, P.fog);
  });
}

/**
 * La pequeña: las estanterías, el pupitre y la bola del mundo. Las anchas suman el atril del
 * libro gordo con el casillero de pergaminos (primer tramo de en medio) y el rincón de leer,
 * con el sillón y la mesita con su vela (segundo); bajo la ventana de en medio, la mesa del
 * alquimista.
 */
function bibliotecaThings(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      if (lvl >= 2)
        t.push(at(bookcase(lvl, 0), s.x0 + 16.5, WALL), at(bookcase(lvl, 1), s.x0 + 48.5, WALL));
      else t.push(at(bookcase(lvl, 0), s.x0 + 30, WALL));
    } else if (s.kind === 'mid' && s.i === 1)
      t.push(
        ...row(s, [
          [scrollCabinet(lvl), WALL],
          [bigLectern(), WALL - 2],
        ]),
      );
    else if (s.kind === 'mid')
      t.push(
        ...row(s, [
          [bookcase(lvl, 5), WALL],
          [armchair(), WALL - 3],
          [sideTable(), WALL - 3, candle(16)],
        ]),
      );
    else t.push(at(lvl >= 3 ? globe() : bookPile(), Math.min(s.x0 + 8, w - 7.5), WALL - 2));
  }
  cellsOf(room, w).forEach((c, j) =>
    t.push(
      j === 1
        ? at(alchemyTable(), c.win, WALL)
        : at(readingDesk(lvl), c.win - 0.5, WALL, 0, lvl >= 2 ? candle(18) : undefined),
    ),
  );
  return t;
}

function bibliotecaRuin(room: Room, w: number): Thing[] {
  const empty = bookcase(0, 0);
  web(empty, 2, 4, 1);
  return cellsOf(room, w).flatMap((c) => [
    at(empty, c.x0 + 30, WALL),
    at(bookPile(), c.win, WALL),
    at(Prop.crate(), Math.min(c.win + WIN_HALF + 7, c.x1 - 8), WALL),
  ]);
}

export const biblioteca: RoomArt = {
  wall: bibliotecaWall,
  things: bibliotecaThings,
  ruin: bibliotecaRuin,
  floor: bibliotecaFloor,
};
