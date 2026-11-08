/**
 * Arte del taller del pintor: pinta las salas del color que se elige. En el primer tramo, el
 * caballete con un cuadro a medio pintar y, al lado, los botes de pintura con el palo de
 * remover; bajo la ventana, los rollos de tela y la lona de proteger. En la pared, las muestras
 * de cada color (las que se enseñan antes de pintar), el estante de los pigmentos con las
 * brochas en un bote y, con nivel, cuadros colgados. En el suelo, la lona y manchas por todas
 * partes. La escalera, apoyada en la pared, para cuando no está pintando fuera.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { TINTS, TINT_IDS, type TintId } from '../../../data/custom';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FLOOR_D,
  FREE,
  WALL,
  W,
  at,
  bx,
  cellsOf,
  stretchesOf,
  task,
  thick,
  type Cell,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { jar, shelf, web } from './piezas';
import type { Cloth } from './tintes';

/** Los colores del pintor: los de los temas, por orden. */
const RAMPS: Cloth[] = TINT_IDS.map((id: TintId) => TINTS[id].ramp);

/** Dónde va cada cosa en el primer hueco (en el mundo). */
const EASEL_X = 14;
const POTS_X = 44;

// ---------- Piezas ----------

/**
 * Un bote de pintura abierto (6 de ancho), con la base en `base`: la lata con su aro, la
 * pintura arriba y un chorrete por el lado.
 */
function pot(p: PixelBuffer, x: number, base: number, c: Cloth, h = 6) {
  const top = base - h;
  p.rect(x, top, 6, h, P.fog);
  p.vline(x, top, h, P.white);
  p.vline(x + 5, top, h, P.steel);
  p.hline(x, base - 1, 6, P.steel);
  // La pintura, asomando por arriba con su brillo, y los chorretes por delante.
  p.hline(x, top, 6, c[2]);
  p.set(x + 1, top, c[3]);
  p.hline(x, top + 1, 6, c[1]);
  p.vline(x + 1, top + 2, 1 + (x % 3), c[2]);
  p.vline(x + 4, top + 2, 2 + ((x + 1) % 2), c[1]);
}

/**
 * El caballete de tres patas con un cuadro a medio pintar: el paisaje (cielo, monte y prado)
 * por una mitad; la otra, aún el lienzo crudo con el boceto. En el 3, ya entero y con marco.
 */
function easel(level: number): PixelBuffer {
  return Prop.piece(20, 40, (p) => {
    // Las patas: dos delante abiertas y la de atrás, y el travesaño donde se apoya el cuadro.
    p.line(9, 0, 2, 39, W[3]!);
    p.line(10, 0, 17, 39, W[3]!);
    p.line(10, 0, 3, 39, W[4]!);
    p.vline(9, 0, 38, W[2]!);
    p.hline(2, 27, 16, W[4]!);
    p.hline(2, 28, 16, W[2]!);
    // El lienzo.
    const x0 = 2;
    const y0 = 6;
    const cw = 16;
    const ch = 20;
    const done = level >= 3;
    p.rect(x0, y0, cw, ch, P.sand);
    p.hline(x0, y0, cw, P.white);
    for (let y = y0 + 1; y < y0 + ch; y++)
      for (let x = x0 + 1; x < x0 + cw - 1; x++) {
        // Pintado hasta la mitad (o entero): cielo, sol, el monte y el prado.
        if (!done && x > x0 + 9 - (y % 3 === 0 ? 1 : 0)) continue;
        const hill = y0 + 11 + Math.round(Math.sin((x - x0) * 0.5) * 2);
        const c = y > y0 + 15 ? P.leaf : y > hill ? P.forest : y < y0 + 6 ? P.sky : P.mist;
        p.set(x, y, c);
      }
    p.ellipse(x0 + 4, y0 + 4, 1.5, 1.5, P.lemon);
    if (!done) {
      // El boceto a carboncillo en lo que falta.
      p.line(x0 + 10, y0 + 12, x0 + 14, y0 + 10, P.tan);
      p.set(x0 + 12, y0 + 6, P.tan);
    } else {
      p.rect(x0 - 1, y0 - 1, cw + 2, 1, P.gold);
      p.rect(x0 - 1, y0 + ch, cw + 2, 1, P.amber);
      p.vline(x0 - 1, y0, ch, P.gold);
      p.vline(x0 + cw, y0, ch, P.amber);
    }
    // La paleta colgada de la pata, con sus pegotes.
    p.ellipse(16, 33, 3.5, 2.5, W[5]!);
    p.set(15, 32, P.red);
    p.set(17, 33, P.sky);
    p.set(15, 34, P.lemon);
    p.set(18, 32, P.lime);
  });
}

/**
 * Los botes de pintura en el suelo, unos encima de otros, con el palo de remover y unas
 * brochas en un bote; con nivel, más botes.
 */
function pots(level: number): PixelBuffer {
  return Prop.piece(26, 18, (p) => {
    // Abajo, la fila de botes; encima de los del medio, otros dos.
    const n = 3 + Math.min(1, level - 1);
    for (let k = 0; k < n; k++) pot(p, 1 + k * 6, 17, RAMPS[(k * 2) % RAMPS.length]!, 7);
    pot(p, 4, 10, RAMPS[1]!);
    if (level >= 2) pot(p, 10, 10, RAMPS[3]!);
    // El palo de remover, metido en el primero, manchado de su color.
    p.line(3, 0, 4, 10, W[4]!);
    p.set(4, 9, RAMPS[0]![2]);
    // Las brochas en un bote de barro.
    const bx0 = n * 6 + 1;
    p.rect(bx0, 11, 5, 6, P.clay);
    p.vline(bx0, 11, 6, P.tan);
    p.hline(bx0, 11, 5, P.rust);
    for (const [x, c] of [
      [bx0 + 1, P.red],
      [bx0 + 3, P.sky],
    ] as const) {
      p.vline(x, 5, 6, W[4]!);
      p.rect(x - 1 + (x % 2), 3, 2, 2, c);
      p.set(x, 5, P.mist);
    }
  });
}

/**
 * Los rollos de tela de pie en una cesta (la lona de proteger y los lienzos sin estrenar):
 * crudos y alguno manchado.
 */
function rolls(level: number): PixelBuffer {
  return Prop.piece(18, 26, (p) => {
    const n = 3 + Math.min(2, level - 1);
    for (let k = 0; k < n; k++) {
      const x = 2 + k * 3;
      const h = 18 + ((k * 5) % 7);
      const top = 26 - h;
      const c = k % 2 ? [P.tan, P.sand, P.white] : [P.clay, P.tan, P.sand];
      p.rect(x, top, 3, h, c[1]!);
      p.vline(x, top, h, c[2]!);
      p.vline(x + 2, top, h, c[0]!);
      // La boca del rollo, con la espiral de la tela.
      p.hline(x, top, 3, c[2]!);
      p.set(x + 1, top, c[0]!);
      if (k % 3 === 1) p.set(x + 1, top + 6, RAMPS[k % RAMPS.length]![2]);
    }
    // La cesta de mimbre.
    p.rect(0, 18, 18, 8, W[4]!);
    for (let x = 0; x < 18; x += 2) p.vline(x, 18, 8, W[5]!);
    p.hline(0, 18, 18, W[3]!);
    p.hline(0, 25, 18, W[2]!);
  });
}

/** La escalera de tijera, cerrada y apoyada en la pared (con gotas de pintura en los peldaños). */
export function ladder(h = 40, open = false): PixelBuffer {
  const w = open ? 14 : 10;
  return Prop.piece(w, h, (p) => {
    // Los largueros: cerrada, casi juntos arriba; abierta, en A.
    const s = open ? 5 : 2;
    p.line(s, 0, 0, h - 1, W[4]!);
    p.line(w - 1 - s, 0, w - 1, h - 1, W[3]!);
    if (open) p.line(w / 2, 0, w / 2, h - 1, W[2]!);
    // Los peldaños, cada 7.
    for (let y = 5; y < h - 2; y += 7) {
      const k = y / (h - 1);
      const x0 = Math.round(s - s * k);
      const x1 = Math.round(w - 1 - s + s * k);
      p.hline(x0, y, x1 - x0 + 1, W[5]!);
      p.hline(x0 + 1, y + 1, x1 - x0 - 1, W[2]!);
    }
    // La tapa de arriba y unas gotas.
    p.rect(s - 1, 0, w - 2 * s + 2, 2, W[5]!);
    p.set(s + 1, 12, P.red);
    p.set(w - s - 2, 19, P.sky);
    p.set(s + 2, 26, P.lemon);
  });
}

/** Lo alto (en píxeles) de la tabla de la escalera de tijera, donde se sube el pintor. */
export const STEP_UP = 12;

/**
 * La escalera de tijera abierta, con la que pinta en las salas (la escena la pone a sus pies):
 * los largueros en A, dos peldaños, la tabla de arriba a `STEP_UP` del suelo y el cubo colgado.
 */
export function stepladder(): PixelBuffer {
  const w = 14;
  const h = STEP_UP + 5;
  const top = h - 1 - STEP_UP;
  return Prop.piece(w, h, (p) => {
    // Los largueros de delante y de detrás, en A, que asoman por encima de la tabla.
    p.line(5, 0, 1, h - 1, W[4]!);
    p.line(8, 0, 12, h - 1, W[3]!);
    // Los peldaños y la tabla de arriba.
    for (const y of [top + 5, top + 10]) {
      const k = y / (h - 1);
      const x0 = Math.round(5 - 4 * k);
      const x1 = Math.round(8 + 4 * k);
      p.hline(x0, y, x1 - x0 + 1, W[5]!);
    }
    p.rect(3, top, 8, 2, W[5]!);
    p.hline(3, top + 1, 8, W[2]!);
    // El cubo de pintura colgado del larguero, con su gota.
    p.rect(9, top + 3, 4, 3, P.fog);
    p.hline(9, top + 3, 4, P.red);
    p.set(10, top + 6, P.red);
  });
}

/** Mesa de mezclar (en las anchas, con nivel): el tablero con la paleta grande, morteros y trapos. */
function mixTable(): PixelBuffer {
  return Prop.piece(30, 22, (p) => {
    p.rect(0, 10, 30, 3, W[4]!);
    p.hline(0, 10, 30, W[5]!);
    p.hline(0, 12, 30, W[2]!);
    p.rect(2, 13, 3, 9, W[3]!);
    p.rect(25, 13, 3, 9, W[3]!);
    p.hline(5, 18, 20, W[2]!);
    // La losa de moler con un montón de pigmento y la moleta.
    p.rect(3, 8, 10, 2, P.fog);
    p.hline(3, 8, 10, P.mist);
    p.ellipse(7, 7, 2.5, 1.5, P.amber);
    p.rect(10, 5, 2, 3, P.steel);
    // Unos tarros y el trapo manchado colgando.
    p.rect(16, 5, 3, 5, RAMPS[1]![2]);
    p.hline(16, 4, 3, P.mist);
    p.rect(21, 6, 3, 4, RAMPS[4]![2]);
    p.hline(21, 5, 3, P.mist);
    p.rect(25, 9, 4, 6, P.sand);
    p.set(26, 11, P.red);
    p.set(27, 13, P.sky);
  });
}

// ---------- Pared ----------

/**
 * Las muestras de color: un brochazo de cada tema (de dos tonos, de arriba abajo) sobre la
 * pared, como se enseñan antes de pintar. Con `n`, cuántas.
 */
function swatches(b: PixelBuffer, x: number, y: number, n: number) {
  for (let k = 0; k < n; k++) {
    const c = RAMPS[k % RAMPS.length]!;
    const sx = x + k * 5;
    for (let yy = 0; yy < 9; yy++) {
      // Borde de brochazo: los extremos mellados.
      const ragged = yy === 0 || yy === 8 ? (k + yy) % 2 : 0;
      b.hline(sx + ragged, y + yy, 4 - ragged, yy < 3 ? c[3] : yy < 7 ? c[2] : c[1]);
    }
    // Un chorrete que ha caído de la muestra.
    if (k % 2 === 0) b.vline(sx + 1 + (k % 3), y + 9, 2 + (k % 2), c[1]);
  }
}

/** Un cuadro pequeño colgado, con su marco: un paisaje o un bodegón. */
function painting(b: PixelBuffer, x: number, y: number, kind: number) {
  b.rect(x, y, 14, 11, P.gold);
  b.rect(x + 1, y + 1, 12, 9, P.amber);
  if (kind % 2) {
    // El mar con una barca.
    b.rect(x + 2, y + 2, 10, 4, P.sky);
    b.rect(x + 2, y + 6, 10, 3, P.ocean);
    b.hline(x + 5, y + 6, 4, P.bark);
    b.vline(x + 7, y + 3, 3, P.white);
  } else {
    // Un bodegón: la jarra y unas manzanas.
    b.rect(x + 2, y + 2, 10, 7, P.bark);
    b.rect(x + 4, y + 3, 3, 5, P.clay);
    b.set(x + 9, y + 7, P.red);
    b.set(x + 10, y + 7, P.red);
    b.set(x + 9, y + 6, P.lime);
  }
}

/** Manchas de pintura en la pared, a salpicones (fijas por sitio). */
function splash(b: PixelBuffer, x: number, y: number, k: number) {
  const c = RAMPS[k % RAMPS.length]![2];
  const pts = [
    [0, 0],
    [1, 0],
    [0, 1],
    [3, -1],
    [-2, 2],
    [2, 3],
  ];
  pts.slice(0, 3 + (k % 4)).forEach(([dx, dy]) => b.set(x + dx!, y + dy!, c));
}

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin, top }: WallCtx): void {
  if (ruin) return;
  const w = cells.at(-1)!.x1;
  const lvl = room.level;
  for (const s of stretchesOf(room, w)) {
    const x0 = bx(s.x0);
    const x1 = bx(s.x1);
    if (s.kind === 'left') {
      // Encima de los botes, el estante de los pigmentos; las muestras, junto al caballete.
      const sx = bx(POTS_X) - 14;
      shelf(b, sx, 30, 28);
      for (let k = 0; k < 3 + lvl; k++) jar(b, sx + 2 + k * 4, 30, k);
      swatches(b, bx(EASEL_X) - 8, 12, Math.min(TINT_IDS.length, 3 + lvl));
      if (lvl >= 2) painting(b, sx + 6, 12, 0);
    } else if (s.kind === 'mid') {
      const mx = Math.round((x0 + x1) / 2);
      if (lvl >= 2) {
        painting(b, mx - 16, 12, s.i);
        painting(b, mx + 2, 16, s.i + 1);
      } else swatches(b, mx - 8, 14, 4);
    }
    // Salpicones por todas partes, más abajo en el zócalo.
    for (let k = 0; k < 2; k++) {
      const x = x0 + 4 + (((k * 37 + s.i * 13) % 97) / 97) * Math.max(4, x1 - x0 - 8);
      splash(b, Math.round(x), top + 2 + ((k * 7 + s.i) % 9), k + s.i);
    }
  }
  // Sin ventana, en su sitio: las muestras de todos los colores.
  cells.forEach((c: Cell) => {
    if (c.glass) return;
    swatches(b, bx(c.win) - 17, 14, TINT_IDS.length);
  });
}

/** El suelo: la lona de proteger bajo el caballete y manchas sueltas de pintura. */
function floor(b: PixelBuffer, room: Room, cells: Cell[]): void {
  const w = cells.at(-1)!.x1;
  // La lona cruda, con sus pliegues, bajo el caballete y los botes.
  const x0 = 2;
  const x1 = Math.min(w - 2, POTS_X + 14);
  b.rect(x0, 3, x1 - x0, FLOOR_D - 8, P.sand);
  for (let x = x0 + 5; x < x1; x += 9) b.vline(x, 3, FLOOR_D - 8, P.tan);
  b.hline(x0, 3, x1 - x0, P.white);
  // Manchas de todos los colores: un goterón con salpicaduras alrededor.
  for (let k = 0; k < 4 + room.level * 2; k++) {
    const x = Math.round((((k * 53 + 17) % 101) / 101) * (w - 10)) + 5;
    const y = ((k * 29 + 5) % (FLOOR_D - 8)) + 4;
    const c = RAMPS[(k * 3) % RAMPS.length]!;
    b.rect(x, y, 3, 2, c[2]);
    b.set(x + 1, y, c[3]);
    b.set(x - 1, y + 1, c[1]);
    b.set(x + 3, y + 1, c[1]);
    b.set(x + 5, y - 1, c[2]);
    b.set(x - 3, y + 2, c[2]);
  }
}

// ---------- Sala ----------

/**
 * La pequeña: el caballete y los botes en el primer tramo, los rollos bajo la ventana y la
 * escalera en el rincón. Las anchas suman la mesa de mezclar (con nivel) u otro caballete.
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [];
  const cells = cellsOf(room, w);
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      t.push(task(thick(at(easel(lvl), EASEL_X, FREE + 2), 4, 'madera'), 'caballete'));
      t.push(task(thick(at(pots(lvl), POTS_X, FREE + 4), 6, 'metal'), 'botes'));
    } else if (s.kind === 'mid') {
      const mx = (s.x0 + s.x1) / 2;
      if (lvl >= 2) t.push(task(thick(at(mixTable(), mx, FREE), 9, 'madera'), 'botes'));
      else t.push(task(thick(at(easel(1), mx, FREE + 2), 4, 'madera'), 'caballete'));
    } else {
      // En el rincón de la derecha, la escalera apoyada en la pared.
      t.push(thick(at(ladder(), Math.min(s.x0 + 8, w - 7), WALL - 2), 3, 'madera'));
    }
  }
  // Bajo cada ventana, los rollos de tela en su cesta.
  for (const c of cells) t.push(thick(at(rolls(lvl), c.win, FREE + 2), 7, 'madera'));
  return t;
}

/** Por reparar: el caballete tirado, botes secos y una escalera rota. */
function ruin(room: Room, w: number): Thing[] {
  const dead = Prop.piece(20, 40, (p) => {
    p.blit(easel(1), 0, 0);
    web(p, 2, 6, 1);
  });
  const t: Thing[] = [at(dead, EASEL_X, WALL), at(Prop.crate(), POTS_X, WALL)];
  for (const c of cellsOf(room, w)) t.push(at(Prop.sack(), c.win, WALL));
  return t;
}

export const pintor: RoomArt = { wall, things, ruin, floor };
