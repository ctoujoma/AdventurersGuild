/**
 * Arte del taller de alquimia: crea amuletos y varitas. En el primer hueco, la mesa del alambique
 * (el matraz burbujeando sobre su hornillo, el serpentín y la retorta que gotea, con su luz de
 * color) y el caldero en sus trébedes con el fuego debajo; bajo la ventana, el atril con el libro
 * abierto. En la pared, estantes de frascos de colores y manojos de hierbas colgados a secar.
 * Más nivel, más frascos, otra retorta y más luz.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FREE,
  WALL,
  W,
  at,
  bx,
  cellsOf,
  emits,
  stretchesOf,
  task,
  thick,
  type Glow,
  type RGB,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, herbs, jar, shelf, web } from './piezas';

/** Los líquidos: verde del alambique, azul de la retorta y morado del caldero. */
const GREEN = [P.deep, P.forest, P.lime, P.lemon] as const;
const BLUE = [P.navy, P.ocean, P.cyan, P.white] as const;
const PURPLE = [P.plum, P.grape, P.rose, P.coral] as const;
type Brew = readonly [string, string, string, string];

const GLOW_GREEN: RGB = [120, 240, 120];
const GLOW_BLUE: RGB = [90, 210, 255];

/** La luz de un líquido que burbujea: tiembla un poco (y se aviva con trabajo, ver `workshop`). */
const brew = (dy: number, color: RGB, level: number): Glow => ({
  dy,
  r: 40 + level * 10,
  color,
  power: 0.45 + level * 0.12,
  flicker: 0.15,
});

/** Dónde va cada cosa en el primer hueco (en el mundo). */
const STILL_X = 20;
const POT_X = 52;

// ---------- Piezas ----------

/**
 * La mesa del alambique: el matraz redondo sobre el hornillo, el capitel y el tubo que baja a
 * la retorta pequeña, que gotea en un frasco; con nivel, una segunda retorta azul y el mortero.
 */
function still(level: number): PixelBuffer {
  return Prop.piece(34, 34, (p) => {
    // La mesa.
    p.rect(0, 22, 34, 3, W[4]!);
    p.hline(0, 22, 34, W[5]!);
    p.hline(0, 24, 34, W[2]!);
    p.rect(2, 25, 3, 9, W[3]!);
    p.rect(29, 25, 3, 9, W[3]!);
    p.hline(5, 30, 24, W[2]!);
    // El hornillo con su llamita.
    p.rect(4, 18, 10, 4, P.slate);
    p.hline(4, 18, 10, P.fog);
    p.rect(6, 19, 6, 2, P.black);
    p.set(8, 19, P.orange);
    p.set(9, 19, P.lemon);
    // El matraz: vidrio con el líquido verde dentro y el brillo.
    p.ellipse(9, 13, 5, 5, P.mist);
    p.ellipse(9, 14, 4, 3.5, GREEN[1]);
    p.ellipse(9, 13.5, 3, 2.2, GREEN[2]);
    p.set(7, 11, P.white);
    p.set(10, 15, GREEN[3]);
    p.rect(8, 5, 3, 4, P.mist);
    p.vline(8, 5, 4, P.white);
    // El capitel y el tubo que baja a la retorta.
    p.ellipse(9, 4, 2.5, 2, P.amber);
    p.line(11, 3, 22, 9, P.amber);
    p.line(11, 4, 22, 10, P.rust);
    // La retorta pequeña y el frasco que recoge las gotas.
    p.ellipse(24, 15, 3.5, 3.5, P.mist);
    p.ellipse(24, 16, 2.5, 2, GREEN[2]);
    p.rect(22, 18, 5, 4, W[3]!);
    p.rect(21, 9, 2, 4, P.mist);
    p.rect(28, 17, 3, 5, P.mist);
    p.hline(28, 20, 3, GREEN[2]);
    p.set(29, 16, GREEN[3]);
    if (level >= 2) {
      // Una segunda retorta, azul, de cuello largo.
      p.ellipse(16, 18, 2.5, 2.5, P.mist);
      p.ellipse(16, 18.5, 1.8, 1.5, BLUE[2]);
      p.line(17, 16, 20, 12, P.mist);
      p.set(15, 17, P.white);
    }
    if (level >= 3) {
      // El mortero con la maja, y una vela.
      p.rect(0, 19, 4, 3, P.fog);
      p.hline(0, 19, 4, P.mist);
      p.line(2, 14, 3, 19, W[4]!);
      candleOn(p, 31, 22, 3);
    }
  });
}

/** El caldero de hierro en sus trébedes, con el fuego debajo y el brebaje morado. */
function cauldron(level: number): PixelBuffer {
  return Prop.piece(24, 24, (p) => {
    // Las trébedes.
    p.line(3, 23, 7, 8, P.slate);
    p.line(20, 23, 16, 8, P.slate);
    p.hline(5, 8, 14, P.steel);
    // El fuego y las brasas.
    p.ellipse(12, 22, 6, 2, P.black);
    for (let x = 8; x < 17; x += 2) p.set(x, 21, x % 4 ? P.orange : P.gold);
    p.set(11, 19, P.lemon);
    p.set(13, 20, P.orange);
    // El caldero: barriga negra con su brillo, el borde y las asas.
    p.ellipse(12, 12, 9, 7, P.black);
    p.ellipse(12, 12, 8, 6, P.navy);
    p.ellipse(9, 10, 3, 2, P.slate);
    p.set(8, 9, P.steel);
    p.rect(3, 5, 18, 2, P.slate);
    p.hline(3, 5, 18, P.fog);
    p.set(2, 6, P.slate);
    p.set(21, 6, P.slate);
    // El brebaje a punto de hervir.
    const c = level >= 3 ? GREEN : PURPLE;
    p.hline(4, 4, 16, c[1]);
    p.hline(6, 3, 12, c[2]);
    p.set(9, 3, c[3]);
    p.set(14, 2, c[3]);
    // El cucharón de palo dentro.
    p.line(16, 0, 13, 5, W[4]!);
  });
}

/** El atril con el libro de recetas abierto y la cinta del registro. */
function lectern(level: number): PixelBuffer {
  return Prop.piece(20, 30, (p) => {
    // Pie torneado y base.
    p.rect(8, 14, 4, 13, W[3]!);
    p.vline(8, 14, 13, W[4]!);
    p.hline(8, 19, 4, W[5]!);
    p.rect(4, 27, 12, 3, W[3]!);
    p.hline(4, 27, 12, W[5]!);
    // El tablero, inclinado hacia quien lee.
    p.rect(1, 11, 18, 3, W[4]!);
    p.hline(1, 11, 18, W[5]!);
    p.hline(1, 13, 18, W[2]!);
    // El libro abierto: tapas de cuero, dos páginas con renglones y el dibujo de un frasco.
    p.rect(1, 5, 18, 6, P.wine);
    p.rect(2, 4, 8, 6, P.sand);
    p.rect(10, 4, 8, 6, P.white);
    p.vline(10, 4, 6, P.tan);
    for (let k = 0; k < 3; k++) p.hline(3, 5 + k * 2, 6, P.clay);
    // El dibujo de un frasco redondo con su tapón.
    p.rect(13, 6, 3, 2, level >= 2 ? P.rose : P.leaf);
    p.set(14, 5, P.slate);
    p.set(14, 4, P.tan);
    p.hline(11, 9, 6, P.mist);
    // La cinta del registro, colgando por delante.
    p.vline(9, 10, 5, P.red);
  });
}

/** Banqueta con frascos (en el rincón de la derecha). */
function flaskStool(level: number): PixelBuffer {
  return Prop.piece(14, 16, (p) => {
    p.rect(0, 8, 14, 2, W[4]!);
    p.hline(0, 8, 14, W[5]!);
    p.rect(1, 10, 2, 6, W[3]!);
    p.rect(11, 10, 2, 6, W[3]!);
    const tones = [GREEN, BLUE, PURPLE];
    for (let k = 0; k < Math.min(3, level + 1); k++) {
      const c = tones[k]!;
      const x = 1 + k * 4;
      p.rect(x, 3, 3, 5, P.mist);
      p.rect(x, 5, 3, 3, c[2]);
      p.set(x + 1, 2, P.tan);
      p.set(x, 4, P.white);
    }
  });
}

// ---------- Pared ----------

/** Un frasco de vidrio de color (3 de ancho) con la base en `base`. */
function flask(b: PixelBuffer, x: number, base: number, c: Brew, tall: boolean) {
  const h = tall ? 7 : 5;
  b.rect(x, base - h, 3, h, P.mist);
  b.rect(x, base - h + 2, 3, h - 2, c[2]);
  b.set(x, base - h + 2, c[3]);
  b.vline(x + 2, base - h + 2, h - 2, c[1]);
  b.set(x + 1, base - h - 1, P.tan);
}

/** Estante de frascos y tarros (más con nivel, y otra tabla en el 2). */
function flaskShelf(b: PixelBuffer, x: number, y: number, w: number, level: number) {
  const tones: Brew[] = [GREEN, BLUE, PURPLE];
  const rows = level >= 2 ? 2 : 1;
  for (let r = 0; r < rows; r++) {
    const sy = y + r * 11;
    shelf(b, x, sy, w);
    const n = Math.floor((w - 2) / 5);
    for (let k = 0; k < n; k++) {
      const fx = x + 2 + k * 5;
      if ((k + r) % 3 === 2) jar(b, fx, sy, k + r);
      else flask(b, fx, sy, tones[(k + r) % 3]!, (k + r) % 2 === 0);
    }
  }
}

/** Una calavera de adorno (en el estante del nivel 3). */
function skull(b: PixelBuffer, x: number, base: number) {
  b.ellipse(x + 3, base - 4, 3, 3, P.sand);
  b.rect(x + 1, base - 2, 4, 2, P.sand);
  b.set(x + 2, base - 4, P.black);
  b.set(x + 4, base - 4, P.black);
  b.set(x + 3, base - 2, P.tan);
}

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const w = cells.at(-1)!.x1;
  const lvl = room.level;
  for (const s of stretchesOf(room, w)) {
    const x0 = bx(s.x0);
    const x1 = bx(s.x1);
    // Las hierbas colgadas de una vara, a lo largo del tramo (más manojos con nivel).
    const step = lvl >= 2 ? 6 : 9;
    if (x1 - x0 > 12) {
      b.hline(x0 + 2, 6, x1 - x0 - 4, W[3]!);
      for (let x = x0 + 4; x < x1 - 6; x += step) herbs(b, x, 6, (x / step) % 4 === 3);
    }
    if (s.kind === 'left') {
      flaskShelf(b, bx(STILL_X) - 12, 30, 26, lvl);
      if (lvl >= 3) skull(b, bx(STILL_X) + 14, 30);
    } else if (s.kind === 'mid') flaskShelf(b, x0 + 4, 30, Math.max(14, x1 - x0 - 8), lvl);
  }
  // Sin ventana, en su sitio: un pentáculo pintado en la pared.
  cells.forEach((c) => {
    if (c.glass) return;
    const x = bx(c.win);
    b.ellipse(x, 24, 9, 9, (_x, _y, d) => (d > 0.82 ? P.wine : 0));
    for (let k = 0; k < 5; k++) {
      const a0 = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
      const a1 = -Math.PI / 2 + ((k + 1) * 4 * Math.PI) / 5;
      b.line(
        Math.round(x + Math.cos(a0) * 8),
        Math.round(24 + Math.sin(a0) * 8),
        Math.round(x + Math.cos(a1) * 8),
        Math.round(24 + Math.sin(a1) * 8),
        P.wine,
      );
    }
  });
}

// ---------- Sala ----------

/**
 * La pequeña: el alambique y el caldero en el primer tramo y el atril bajo la ventana. Las
 * anchas suman otra mesa de alambique (azul) y los frascos de la banqueta; bajo las demás
 * ventanas, otro caldero o el atril.
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  const stillAt = (x: number, color: RGB) =>
    task(
      emits(thick(at(still(lvl), x, FREE, 0, brew(14, color, lvl)), 9, 'madera'), {
        kind: 'bubble',
        rate: 1.2 + lvl * 0.4,
        at: [6, 10, 12, 15],
      }),
      'alambique',
    );
  const potAt = (x: number) =>
    task(
      emits(
        thick(at(cauldron(lvl), x, FREE + 2, 0, brew(8, GLOW_GREEN, lvl - 1)), 8, 'metal'),
        { kind: 'bubble', rate: 2 + lvl * 0.5, at: [6, 2, 18, 4] },
        { kind: 'steam', rate: 1.5, at: [6, 0, 18, 3] },
      ),
      'caldero',
    );
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      t.push(stillAt(STILL_X, GLOW_GREEN));
      t.push(potAt(POT_X));
    } else if (s.kind === 'mid') t.push(stillAt((s.x0 + s.x1) / 2, GLOW_BLUE));
    else t.push(thick(at(flaskStool(lvl), Math.min(s.x0 + 8, w - 9), FREE + 4), 5, 'madera'));
  }
  // Bajo las ventanas, el atril y, en la de en medio, otro caldero.
  cellsOf(room, w).forEach((c, j) =>
    t.push(
      j % 2 === 0 ? task(thick(at(lectern(lvl), c.win, FREE), 5, 'madera'), 'atril') : potAt(c.win),
    ),
  );
  return t;
}

/** Por reparar: el caldero volcado, frascos rotos y unas cajas. */
function ruin(room: Room, w: number): Thing[] {
  const pot = Prop.piece(24, 16, (p) => {
    p.ellipse(12, 10, 9, 6, P.black);
    p.ellipse(12, 10, 8, 5, P.navy);
    p.ellipse(4, 12, 3, 4, P.plum);
    web(p, 16, 4, -1);
  });
  const t: Thing[] = [at(pot, POT_X, WALL), at(Prop.crate(), STILL_X, WALL)];
  for (const c of cellsOf(room, w)) t.push(at(Prop.crate(), c.win, WALL));
  return t;
}

export const alquimia: RoomArt = { wall, things, ruin };
