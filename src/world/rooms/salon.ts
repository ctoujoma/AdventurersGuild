/**
 * Arte del salón (la sala de muestra del estilo definitivo): la pared del fondo con la alacena
 * de botellas detrás de la barra, las vigas, los trofeos y los tapices; y los muebles de delante:
 * la barra con sus jarras, las mesas con velas, la chimenea con el escudo, los barriles y la
 * leña. Crece con el nivel del salón y con la decoración que se compra.
 */
import type { Material } from '../../core/materials';
import type { GearView } from '../scene';
import { trophyIcon } from '../../art/items';
import { P, R, type Ramp } from '../../art/palette';
import { PixelBuffer, rgba } from '../../art/pixel';
import type { Room, TrophyIcon } from '../../core/model';
import { Rng } from '../../core/rng';
import { gallerySeats } from '../../core/salon';
import { stoneWall } from '../paint';
import * as Prop from '../props';
import { CELL_W, DEPTH, PITCH, ROOM_H } from './layout';
import { markWall, sconce as wallSconce, windowX } from './salas/kit';
import { BACK, scaleAt } from './view3d';

const W = R.wood; // [black, plum, bark, rust, oak, clay, tan]
const DARK: Ramp = [P.black, P.ebony, P.plum, P.bark];

/**
 * Lo que las salas enseñan de la partida además de su nivel: decoración, escudo y trofeos, y el
 * equipo sin dueño con la sala donde se guarda (ver `gearRoom`). (El perro va aparte: `pets.ts`.)
 */
export interface SalonLook {
  decor: readonly string[];
  crest: { field: string; dark: string; symbol: string };
  trophies: readonly TrophyIcon[];
  gear: readonly GearView[];
  gearRoom: string | null;
  /** Lo llena que está la cámara del tesoro (0–1, en octavos para no repintar a cada moneda). */
  vault: number;
  /**
   * Los materiales guardados: lo lleno de cada uno (0–1 de su tope, en décimos; solo los que caben)
   * y si hay almacén (si no, se amontonan en un rincón de la bodega).
   */
  mats: MatsLook;
}

export interface MatsLook {
  fill: Partial<Record<Material, number>>;
  store: boolean;
}

export const NO_LOOK: SalonLook = {
  decor: [],
  crest: { field: P.wine, dark: P.plum, symbol: 'jarra' },
  trophies: [],
  gear: [],
  gearRoom: null,
  vault: 0,
  mats: { fill: {}, store: false },
};

// ---------- Pared del fondo (a la escala del fondo) ----------

/** Alacena de detrás de la barra: estantes de botellas, jarras colgadas y dos barricas con espita. */
export function backBar(level: number, seed: string): PixelBuffer {
  return Prop.piece(46, 46, (b) => {
    const rng = new Rng(`alacena-${seed}`);
    // Mueble: fondo oscuro, laterales y remate.
    b.rect(0, 2, 46, 44, W[1]!);
    b.rect(2, 4, 42, 40, W[2]!);
    for (let y = 6; y < 44; y += 3) b.hline(3, y, 40, W[1]!);
    b.rect(0, 0, 46, 3, W[4]!);
    b.hline(0, 0, 46, W[5]!);
    b.hline(0, 2, 46, W[2]!);
    b.rect(0, 2, 2, 44, W[3]!);
    b.rect(44, 2, 2, 44, W[3]!);
    b.vline(0, 2, 44, W[4]!);
    if (level >= 4) {
      // Gran salón: remate y cantos dorados.
      b.hline(0, 0, 46, P.lemon);
      b.hline(0, 1, 46, P.gold);
      b.vline(1, 3, 42, P.gold);
      b.vline(44, 3, 42, P.gold);
    }
    if (level >= 5) {
      // Un espejo con marco dorado sobre el primer estante.
      b.rect(6, 4, 34, 8, P.gold);
      b.rect(7, 5, 32, 6, P.fog);
      b.line(9, 10, 14, 5, P.mist);
      b.line(12, 10, 17, 5, P.white);
      b.line(28, 10, 32, 6, P.mist);
    }
    // Estantes con botellas (más cuanto mejor es el salón).
    const shelves = [13, 23, 33];
    const full = [Math.min(8, 3 + level * 2), level >= 2 ? 7 : 2, level >= 3 ? 6 : 0];
    shelves.forEach((y, k) => {
      b.rect(2, y, 42, 2, W[4]!);
      b.hline(2, y, 42, W[5]!);
      b.hline(2, y + 1, 42, W[3]!);
      let x = 4;
      for (let i = 0; i < full[k]! && x < 40; i++) {
        Prop.bottleOn(b, x, y, rng.int(0, 11));
        x += rng.int(4, 6);
      }
    });
    // Jarras colgadas bajo el primer estante.
    for (let i = 0; i < Math.min(5, 2 + level); i++) {
      const x = 5 + i * 8;
      b.set(x + 2, 15, P.slate);
      b.rect(x, 16, 4, 4, P.oak);
      b.hline(x, 16, 4, P.sand);
      b.vline(x + 4, 17, 2, P.oak);
      b.set(x, 17, P.tan);
    }
    // Dos barricas tumbadas con su espita.
    for (const cx of [11, 33]) {
      b.ellipse(cx, 40, 8, 5.5, W[3]!);
      b.ellipse(cx, 40, 6.5, 4.5, W[4]!);
      b.ellipse(cx - 1, 39, 3, 2, W[5]!);
      b.vline(cx - 5, 36, 9, P.slate);
      b.vline(cx + 5, 36, 9, P.slate);
      b.rect(cx - 1, 44, 3, 2, P.steel);
      b.set(cx, 45, P.gold);
    }
  });
}

/** Tapiz con los colores del escudo y un fleco dorado. */
function tapestry(field: string, dark: string): PixelBuffer {
  return Prop.piece(12, 26, (b) => {
    b.hline(0, 0, 12, W[3]!);
    b.rect(1, 1, 10, 21, field);
    b.vline(1, 1, 21, dark);
    b.vline(10, 1, 21, dark);
    for (let y = 4; y < 20; y += 4) b.hline(3, y, 6, dark);
    b.rect(4, 8, 4, 5, P.gold);
    b.rect(5, 13, 2, 1, P.gold);
    for (let x = 1; x < 11; x++) b.vline(x, 22, x % 2 ? 3 : 4, x % 2 ? P.gold : P.orange);
  });
}

/** Pendón largo con los colores del escudo, colgado de una vara (en el salón de dos alturas). */
function banner(field: string, dark: string, h: number): PixelBuffer {
  return Prop.piece(14, h, (b) => {
    b.hline(0, 0, 14, W[3]!);
    b.set(0, 1, P.gold);
    b.set(13, 1, P.gold);
    const body = h - 6;
    b.rect(2, 1, 10, body, field);
    b.vline(2, 1, body, dark);
    b.vline(11, 1, body, dark);
    // Cola de golondrina abajo.
    for (let k = 0; k < 5; k++) {
      b.hline(2, body + 1 + k, 5 - k, field);
      b.hline(7 + k, body + 1 + k, 5 - k, field);
    }
    // El emblema en medio: un rombo dorado.
    const cy = Math.round(body * 0.4);
    for (let k = 0; k < 4; k++) b.hline(7 - k, cy - 3 + k, 2 * k, P.gold);
    for (let k = 0; k < 4; k++) b.hline(4 + k, cy + 1 + k, 6 - 2 * k, P.gold);
    b.hline(3, 3, 8, P.gold);
  });
}

/** Ristras de ajos, hierbas y un jamón colgando de una vara del techo (delante de la barra). */
export function larder(): PixelBuffer {
  return Prop.piece(26, 16, (b) => larderOn(b, 2, 0));
}

function larderOn(b: PixelBuffer, x: number, y: number) {
  b.hline(x - 1, y, 24, P.slate);
  // Jamón.
  b.vline(x + 2, y + 1, 2, P.black);
  b.ellipse(x + 2, y + 8, 3, 5, P.brick);
  b.ellipse(x + 2, y + 7, 1, 2, P.coral);
  b.set(x + 2, y + 12, P.sand);
  // Hierbas.
  b.vline(x + 9, y + 1, 2, P.black);
  for (let k = 0; k < 8; k++) b.vline(x + 8 + (k % 3), y + 3 + k, 2, k % 2 ? P.leaf : P.forest);
  // Ristra de ajos.
  b.vline(x + 16, y + 1, 12, P.tan);
  for (let k = 0; k < 4; k++) {
    b.ellipse(x + 16 + (k % 2 ? 1 : -1), y + 4 + k * 3, 1.5, 1.5, P.sand);
    b.set(x + 16, y + 4 + k * 3, P.white);
  }
  // Otro manojo, de laurel.
  b.vline(x + 21, y + 1, 2, P.black);
  for (let k = 0; k < 6; k++) b.vline(x + 20 + (k % 2), y + 3 + k, 2, k % 2 ? P.lime : P.leaf);
}

/** Tornapuntas en cruz en los paños de yeso que no tienen ventana. */
function braces(b: PixelBuffer, x0: number, x1: number, top: number, bottom: number) {
  const ramp = DARK;
  for (let x = x0; x < x1; x++) {
    const k = (x - x0) / (x1 - x0);
    const ya = Math.round(top + k * (bottom - top));
    const yb = Math.round(bottom - k * (bottom - top));
    for (const y of [ya, yb]) {
      b.set(x, y, ramp[2]!);
      b.set(x, y + 1, ramp[3]!);
      b.set(x, y + 2, ramp[1]!);
    }
  }
}

/**
 * Lo propio del salón en la pared del fondo (`b` ya lleva el yeso, el zócalo y las ventanas):
 * la alacena detrás de la barra, el tablón, tornapuntas, trofeos, tapices, apliques y ristras.
 * `windows` son las x (en el fondo) de las ventanas de cada planta, de arriba abajo; `cell` lo
 * que mide un hueco en el fondo. Devuelve lo que va encima de la cenefa pintada (pendones y trofeos).
 */
export function salonWall(
  b: PixelBuffer,
  room: Room,
  look: SalonLook,
  windows: number[][],
  cell: number,
  wain: number,
): () => void {
  const lvl = room.level;
  const floor = b.h;
  // Arriba de la planta de abajo (en el de dos alturas, la de arriba queda para lucir).
  const low = floor - Math.round(ROOM_H * BACK);
  const tall = room.h > 1;
  // Lo que no se tapa con una ventana de la planta `j` (por defecto, la de abajo).
  const free = (x: number, w: number, j = room.h - 1) =>
    windows[j]!.every((wx) => x + w < wx - 14 || x > wx + 14);
  // Dónde empieza la chimenea (y su tiro) vista en el fondo: lo de la pared no se pone detrás.
  const { hearthLeft, flueLeft } = hearthSpan(b.w);
  // Tornapuntas en los paños sin ventana (entre los postes de cada 36), planta a planta: solo
  // en el salón sencillo del nivel 1 (luego la pared va encalada o forrada).
  for (let j = 0; j < (lvl <= 1 ? room.h : 0); j++) {
    const top = Math.round(j * PITCH * BACK) + 5;
    const bottom = j === room.h - 1 ? floor - wain - 4 : Math.round((j * PITCH + ROOM_H) * BACK);
    for (let x = 0; x + 36 <= b.w; x += 36)
      if (free(x + 3, 30, j)) braces(b, x + 3, x + 36, top, bottom);
  }
  // Alacena detrás de la barra.
  b.blit(backBar(lvl, room.id), 4, floor - 46);
  // El tablón de anuncios, en el segundo hueco (o tras la alacena, si solo hay uno).
  const board = Prop.noticeBoard(Math.min(4, lvl + 1), lvl >= 2);
  const bx = Math.min(Math.round(cell + 6), hearthLeft - board.w - 3);
  const boardOn = room.w > 1 && free(bx, board.w);
  if (boardOn) {
    const by = Math.round(floor - 30 - board.h);
    b.blit(board, bx, by);
    markWall({ act: 'tablon', x: bx, y: by, w: board.w, h: board.h });
  }
  // Apliques con vela en los postes libres (desde el nivel 2; los de la chimenea van con ella).
  for (const x of salonSconces(room, b.w)) b.blit(sconceArt(lvl), x - 3, low + 22);
  // Encima de la alacena, una sola cosa: la diana con su pizarra (2) o, desde el 3, la cabeza
  // de ciervo (el trofeo).
  const above = floor - 46;
  const spots: { x: number; y: number; w: number; h: number }[] = [];
  if (lvl === 2) {
    b.blit(Prop.dartboard(), 22, above - 15);
    b.blit(chalkboard(), 8, above - 16);
    spots.push({ x: 8, y: above - 16, w: 28, h: 13 });
  } else if (lvl >= 3) {
    b.blit(stagHead(lvl), 11, above - 19);
    spots.push({ x: 11, y: above - 19, w: 26, h: 19 });
  }
  // En el de dos alturas, pendones del gremio en los postes de arriba (sin tapar ventanas).
  const flags: number[] = [];
  if (tall)
    for (let x = 36; x < b.w - 30; x += 36)
      if (free(x - 7, 14, 0) && x + 7 < flueLeft && x - (flags.at(-1) ?? -99) >= 60) flags.push(x);
  // Con galería, más cortos: acaban por encima de la cabeza de los de arriba.
  const long = low - 24 - (tall && gallerySeats(room) > 0 ? 22 : 0);
  const hang = () => {
    for (const x of flags) b.blit(banner(look.crest.field, look.crest.dark, long), x - 7, 4);
  };
  hang();
  // Altura de la fila de trofeos (en el de dos alturas, a media pared de arriba).
  const ty = tall ? Math.round(low * 0.45) : 4;
  const clear = (x: number, w: number) =>
    free(x, w, 0) &&
    x + w < flueLeft &&
    flags.every((f) => x + w < f - 8 || x > f + 8) &&
    // En el de una planta, la fila de arriba no pisa el tablón.
    (tall || !boardOn || x + w < bx || x > bx + board.w) &&
    // Ni lo de encima de la alacena.
    spots.every((s) => x + w < s.x || x > s.x + s.w || ty + 14 < s.y || ty > s.y + s.h);
  // Tapices con el escudo.
  if (look.decor.includes('tapices')) {
    const spots = [];
    for (let x = 36; x < b.w - 20 && spots.length < 2; x += 36)
      if (free(x - 6, 12) && Math.abs(x - bx - 19) > 26) spots.push(x);
    for (const x of spots) b.blit(tapestry(look.crest.field, look.crest.dark), x - 5, 4);
  }
  // Trofeos de las misiones, en fila arriba (en el de dos alturas, a media pared de arriba).
  const shelf: number[] = [];
  let x = 8;
  for (let i = 0; i < Math.min(6, look.trophies.length); i++) {
    while (x < b.w - 70 && !clear(x, 14)) x += 6;
    if (x >= b.w - 70) break;
    shelf.push(x);
    x += 18;
  }
  const hangTrophies = () => shelf.forEach((x, i) => b.blit(trophyIcon(look.trophies[i]!), x, ty));
  hangTrophies();
  // Pendones y trofeos cuelgan por delante de la cenefa (que se pinta después).
  return () => {
    hang();
    hangTrophies();
  };
}

// ---------- Muebles de delante ----------

/**
 * La barra con lo de encima: jarras, una jarra grande, el barrilito especial y la luz. Cambia
 * con el nivel: tablas sin más (1), paneles y barra de latón para los pies con una vela (2), un
 * candelabro de hierro (3), remates de oro y grifos de latón (4) y tablero de mármol (5).
 */
export function bar(level: number, special: boolean): PixelBuffer {
  return Prop.piece(66, 28, (b) => {
    b.blit(level <= 1 ? plainCounter() : Prop.counter(Math.min(4, level)), 0, 10);
    if (level >= 5) {
      // Tablero de mármol con su filete de oro.
      b.rect(0, 10, 66, 4, P.mist);
      b.hline(0, 10, 66, P.white);
      b.hline(0, 13, 66, P.fog);
      b.hline(0, 14, 66, P.gold);
      for (let x = 5; x < 62; x += 13) b.line(x, 11, x + 3, 12, P.fog);
    }
    // Jarras de cerveza con espuma (en la barra sencilla, una).
    const mugs: [number, boolean][] =
      level <= 1
        ? [[10, true]]
        : [
            [8, true],
            [14, false],
            [46, true],
          ];
    for (const [x, full] of mugs) {
      b.rect(x, 5, 4, 5, level >= 5 ? P.gold : P.oak);
      b.vline(x + 4, 6, 3, level >= 5 ? P.gold : P.oak);
      b.hline(x, 5, 4, full ? P.white : P.tan);
      b.set(x, 6, level >= 5 ? P.lemon : P.tan);
    }
    // Jarra de barro.
    b.ellipse(25, 7, 3, 3, P.clay);
    b.rect(24, 2, 3, 3, P.clay);
    b.set(28, 6, P.clay);
    b.set(23, 7, P.tan);
    if (level === 4)
      // Dos grifos de latón con su mango.
      for (const x of [30, 33]) {
        b.rect(x, 4, 2, 6, P.gold);
        b.vline(x, 4, 6, P.lemon);
        b.rect(x, 1, 2, 3, P.wine);
        b.set(x + 1, 6, P.amber);
      }
    if (level === 2) {
      // Vela en su palmatoria.
      b.rect(36, 8, 5, 2, P.steel);
      b.rect(37, 4, 2, 4, P.white);
      b.set(38, 3, P.lemon);
    } else if (level === 3) candelabrum(b, 39, 10, false);
    if (special) {
      // Barrilito especial con espita.
      b.ellipse(57, 5, 5, 5, W[3]!);
      b.ellipse(57, 5, 3.5, 3.5, W[4]!);
      b.vline(54, 1, 9, P.slate);
      b.vline(60, 1, 9, P.slate);
      b.rect(56, 9, 2, 2, P.gold);
    }
  });
}

/** La barra del salón sencillo: tablas de pie clavadas, sin paneles ni latón. */
function plainCounter(): PixelBuffer {
  return Prop.piece(66, 18, (b) => {
    b.rect(0, 3, 66, 15, W[3]!);
    for (let x = 0; x < 66; x += 6) {
      b.vline(x, 4, 14, W[2]!);
      b.vline(x + 1, 4, 14, W[4]!);
      b.set(x + 3, 6, W[1]!);
      b.set(x + 3, 15, W[1]!);
    }
    b.rect(0, 0, 66, 4, W[4]!);
    b.hline(0, 0, 66, W[5]!);
    b.hline(0, 3, 66, W[2]!);
    b.hline(0, 17, 66, W[1]!);
  });
}

/** Candelabro de tres brazos (de hierro o dorado) con la base en (`x`, `base`). */
function candelabrum(b: PixelBuffer, x: number, base: number, gold: boolean) {
  const m = gold ? P.gold : P.slate;
  const hi = gold ? P.lemon : P.steel;
  b.rect(x - 2, base - 1, 5, 1, m);
  b.hline(x - 1, base - 2, 3, hi);
  b.vline(x, base - 6, 4, m);
  b.hline(x - 3, base - 6, 7, m);
  b.set(x - 3, base - 7, hi);
  b.set(x + 3, base - 7, hi);
  for (const cx of [x - 3, x, x + 3]) {
    const top = cx === x ? base - 10 : base - 9;
    b.vline(cx, top, cx === x ? 3 : 2, P.white);
    b.set(cx, top - 1, P.lemon);
  }
}
/**
 * Una mesa redonda con lo que haya encima: jarras, un plato, una vela, o naipes. Con el nivel:
 * vela (2), mantel (3) y, en el gran salón, mantel blanco con palmatoria dorada y, en el 5, copas
 * de oro.
 */
export function tableSet(
  seed: string,
  cloth: readonly string[] | undefined,
  candle: boolean,
  cards: boolean,
  level = 3,
): PixelBuffer {
  return Prop.piece(26, 22, (b) => {
    if (cards) {
      // Mesa de naipes: tapete verde y monedas.
      b.blit(Prop.roundTable(), 0, 8);
      b.ellipse(13, 10.5, 12, 2.5, P.forest);
      b.hline(3, 10, 20, P.leaf);
      b.rect(6, 7, 3, 4, P.white);
      b.set(7, 8, P.red);
      b.rect(10, 6, 3, 4, P.white);
      b.set(11, 7, P.black);
      b.rect(17, 8, 3, 2, P.gold);
      b.hline(17, 8, 3, P.lemon);
      b.rect(19, 7, 2, 2, P.gold);
      return;
    }
    const linen = level >= 4;
    b.blit(Prop.roundTable(linen ? [P.fog, P.mist, P.white, P.white] : cloth), 0, 8);
    const rng = new Rng(`mesa-${seed}`);
    const left = rng.chance(0.5);
    // Jarra (en el 5, copa de oro).
    const jx = left ? 4 : 18;
    if (level >= 5) {
      b.rect(jx, 5, 4, 3, P.gold);
      b.hline(jx, 5, 4, P.lemon);
      b.vline(jx + 1, 8, 2, P.gold);
      b.hline(jx, 9, 4, P.amber);
    } else {
      b.rect(jx, 5, 4, 5, P.oak);
      b.vline(jx + 4, 6, 3, P.oak);
      b.hline(jx, 5, 4, P.white);
    }
    // Plato con pan.
    const px = left ? 15 : 6;
    b.ellipse(px + 2, 10, 3, 1, P.mist);
    b.ellipse(px + 2, 9, 2, 1.2, P.tan);
    b.set(px + 1, 9, P.sand);
    if (candle) {
      b.rect(11, 8, 3, 2, linen ? P.gold : P.steel);
      b.rect(12, 4, 1, 4, P.white);
      b.set(12, 3, P.lemon);
    }
  });
}

/** Taburete: de madera (1–2) o con cojín (del color `c`, de la sombra a la luz) desde el 3. */
export function seat(level: number, c: readonly string[] = [P.wine, P.red, P.coral]): PixelBuffer {
  if (level <= 2) return Prop.stool();
  return Prop.piece(9, 11, (b) => {
    b.rect(1, 4, 2, 7, W[3]!);
    b.rect(6, 4, 2, 7, W[3]!);
    b.hline(2, 8, 5, W[2]!);
    b.rect(0, 2, 9, 2, W[4]!);
    b.hline(0, 3, 9, W[2]!);
    b.rect(0, 0, 9, 3, c[1]!);
    b.hline(1, 0, 7, c[2]!);
    b.hline(0, 2, 9, c[0]!);
    if (level >= 4) for (const x of [1, 4, 7]) b.set(x, 2, P.gold);
  });
}
/**
 * Lo de junto a la puerta de la izquierda, delante de todo (la gente pasa por detrás): un
 * barril y una caja (1), los barriles de la cerveza (2), un tonel con su grifo (3), un aparador
 * con licoreras (4) y un pedestal de mármol con un jarrón de flores (5). Poco alto y estrecho.
 */
export function nook(level: number): PixelBuffer {
  if (level >= 5)
    return Prop.piece(16, 34, (b) => {
      // Pedestal.
      b.rect(3, 16, 10, 18, P.mist);
      b.vline(3, 16, 18, P.white);
      b.vline(12, 16, 18, P.fog);
      b.rect(1, 14, 14, 3, P.white);
      b.hline(1, 16, 14, P.fog);
      b.rect(1, 31, 14, 3, P.fog);
      b.hline(1, 31, 14, P.gold);
      // Jarrón y flores.
      b.ellipse(8, 10, 4, 4, P.ocean);
      b.rect(6, 4, 4, 3, P.ocean);
      b.set(6, 9, P.sky);
      b.hline(5, 13, 6, P.gold);
      for (const [x, y, c] of [
        [4, 1, P.red],
        [8, 0, P.lemon],
        [12, 2, P.coral],
        [6, 3, P.leaf],
        [10, 3, P.forest],
        [2, 4, P.leaf],
        [14, 5, P.lime],
      ] as const)
        b.rect(x - 1, y, 2, 2, c);
    });
  if (level === 4)
    return Prop.piece(24, 26, (b) => {
      // Aparador oscuro con tiradores de oro y dos licoreras encima.
      b.rect(0, 10, 24, 14, W[2]!);
      b.rect(0, 9, 24, 2, W[4]!);
      b.hline(0, 9, 24, P.gold);
      for (const x of [2, 13]) {
        b.rect(x, 13, 9, 9, W[1]!);
        b.rect(x + 1, 14, 7, 7, W[3]!);
        b.set(x + 4, 17, P.gold);
      }
      b.rect(1, 24, 2, 2, W[1]!);
      b.rect(21, 24, 2, 2, W[1]!);
      for (const [x, c] of [
        [6, P.wine],
        [16, P.amber],
      ] as const) {
        b.ellipse(x, 6, 3, 3, c);
        b.rect(x - 1, 0, 2, 3, P.mist);
        b.set(x - 1, 5, P.white);
      }
      b.rect(10, 6, 2, 3, P.mist);
    });
  if (level === 3)
    return Prop.piece(22, 26, (b) => {
      // Tonel tumbado en su burro, con el grifo de latón y un cubo debajo.
      b.rect(2, 20, 3, 6, W[2]!);
      b.rect(17, 20, 3, 6, W[2]!);
      b.hline(0, 20, 22, W[3]!);
      b.ellipse(11, 10, 10, 10, W[3]!);
      b.ellipse(11, 10, 8.5, 8.5, W[4]!);
      b.ellipse(10, 9, 4.5, 4.5, W[5]!);
      for (const r of [9.5, 6]) b.ellipse(11, 10, r, r, W[2]!);
      b.ellipse(11, 10, 5.5, 5.5, W[4]!);
      b.ellipse(11, 10, 9, 9, W[3]!);
      b.ellipse(11, 10, 8, 8, W[4]!);
      b.ellipse(11, 10, 3.5, 3.5, W[5]!);
      b.rect(10, 18, 3, 3, P.gold);
      b.set(11, 21, P.lemon);
      b.rect(8, 23, 7, 3, P.slate);
      b.hline(8, 23, 7, P.steel);
    });
  if (level === 2) return barrels();
  return Prop.piece(28, 16, (b) => {
    b.blit(Prop.barrel(), 0, 1);
    b.blit(Prop.crate(), 13, 4);
  });
}

/** Barriles apilados: dos abajo y uno encima. */
export function barrels(): PixelBuffer {
  return Prop.piece(26, 28, (b) => {
    const one = Prop.barrel();
    b.blit(one, 0, 13);
    b.blit(one, 13, 13);
    b.blit(one, 7, 0);
  });
}

/** Leña apilada junto a la chimenea. */
export function logPile(): PixelBuffer {
  return Prop.piece(18, 12, (b) => {
    const ends: [number, number][] = [
      [3, 9],
      [8, 9],
      [13, 9],
      [5, 5],
      [10, 5],
      [8, 1.5],
    ];
    for (const [x, y] of ends) {
      b.ellipse(x + 0.5, y + 1, 2.5, 2.2, W[3]!);
      b.ellipse(x + 0.5, y + 1, 1.5, 1.4, W[5]!);
      b.set(Math.round(x), Math.round(y + 1), W[4]!);
    }
  });
}

/** La tarima del bardo, con el laúd apoyado en su atril. */
export function stage(): PixelBuffer {
  return Prop.piece(44, 30, (b) => {
    b.rect(0, 24, 44, 6, W[3]!);
    b.hline(0, 24, 44, W[5]!);
    b.hline(0, 25, 44, W[4]!);
    for (let x = 4; x < 44; x += 10) b.vline(x, 26, 4, W[2]!);
    b.hline(0, 29, 44, W[1]!);
    // Atril y laúd.
    b.vline(30, 10, 14, W[2]!);
    b.hline(27, 23, 7, W[2]!);
    b.blit(Prop.lute(), 18, 0);
  });
}

/**
 * La chimenea del salón: la de siempre con el tiro más alto y, encima de la repisa, el escudo del
 * gremio entre dos espadas (desde el nivel 2) y lo que se va juntando en la repisa.
 */
/**
 * La chimenea: a cuánto de la pared de la derecha va su centro y a qué fondo (separada de la
 * pared, con volumen hasta ella: ver `volume.ts`).
 */
export const HEARTH_RIGHT = 40;
export const HEARTH_Z = DEPTH - 16;

/**
 * Dónde empiezan la chimenea y su tiro vistos en la pared del fondo (de `bw` de ancho), para no
 * poner nada detrás. Las piezas miden 56 de ancho y el tiro va de 16 a 40.
 */
export function hearthSpan(bw: number): {
  hearthLeft: number;
  flueLeft: number;
  flueRight: number;
} {
  const k = scaleAt(HEARTH_Z);
  const mid = bw / BACK - HEARTH_RIGHT;
  return {
    hearthLeft: Math.round((mid - 28 / k) * BACK),
    flueLeft: Math.round((mid - 12 / k) * BACK),
    flueRight: Math.round((mid + 12 / k) * BACK),
  };
}

export function hearth(
  level: number,
  crest: SalonLook['crest'],
  big: boolean,
  rise = 0,
): PixelBuffer {
  // El caldero, en el 2; del 3 en adelante, fuego grande sin caldero.
  const fire = Prop.fireplace(level === 2 ? 2 : 1).clone();
  if (level >= 3) blaze(fire, big);
  // El tiro sube hasta el techo: `rise` de más en el salón de dos alturas.
  const top = 18 + rise;
  return Prop.piece(fire.w, fire.h + top, (b) => {
    stoneWall(b, 16, 0, 24, top + 2, 'tiro-salon', { bw: 8, bh: 5 });
    b.blit(fire, 0, top);
    // Gran salón: la chimenea de arenisca (4) o de mármol (5), sin tocar la boca.
    if (level >= 4) {
      const to = level >= 5 ? MARBLE_STONE : SANDSTONE;
      b.map((c, x, y) => {
        const fy = y - top;
        const dx = (x + 0.5 - 28) / 16;
        const dy = (fy + 0.5 - 38) / 14;
        const mouth = x >= 12 && x < 44 && fy >= 24 && (fy >= 38 || dx * dx + dy * dy <= 1);
        return mouth ? c : (to.get(c) ?? c);
      });
    }
    const mantle = top + 10;
    if (level >= 4) {
      // Repisa con canto dorado.
      b.hline(0, mantle, fire.w, P.lemon);
      b.hline(0, mantle + 1, fire.w, P.gold);
      b.hline(0, mantle + 4, fire.w, P.amber);
    }
    // Repisa: una jarra; con nivel, velas y una copa dorada (del 3, a la izquierda: a la
    // derecha cuelga el laúd).
    const side = level >= 3 ? 2 : 44;
    const jx = level >= 3 ? 13 : 7;
    if (level <= 3) {
      b.ellipse(jx, mantle - 3, 2, 2, P.clay);
      b.rect(jx - 1, mantle - 6, 2, 2, P.clay);
    }
    if (level === 2 || level === 3)
      for (const x of [side + 2, side + 6]) {
        b.rect(x, mantle - 5, 2, 5, P.white);
        b.set(x, mantle - 6, P.lemon);
      }
    if (level >= 3) {
      b.rect(26, mantle - 3, 4, 1, P.gold);
      b.rect(27, mantle - 6, 2, 3, P.gold);
      b.rect(26, mantle - 8, 4, 2, P.lemon);
      // El laúd colgado de un clavo, a la derecha del tiro.
      b.blit(Prop.lute(), 42, mantle - 27);
      b.line(45, mantle - 27, 48, mantle - 30, P.wine);
      b.line(51, mantle - 27, 48, mantle - 30, P.wine);
      b.set(48, mantle - 31, P.slate);
    }
    // Dos candelabros dorados en la repisa, a los lados de la copa (gran salón).
    if (level >= 4) for (const x of [21, 35]) candelabrum(b, x, mantle, true);
    if (level >= 2) {
      // Espadas cruzadas y el escudo del gremio.
      const y = rise;
      b.line(17, y + 2, 39, top + 4, P.fog);
      b.line(39, y + 2, 17, top + 4, P.fog);
      b.set(17, y + 2, P.gold);
      b.set(39, y + 2, P.gold);
      b.rect(22, y + 3, 12, 11, crest.dark);
      b.rect(23, y + 3, 10, 11, crest.field);
      b.rect(24, y + 14, 8, 2, crest.field);
      b.rect(26, y + 16, 4, 1, crest.field);
      b.hline(23, y + 3, 10, P.gold);
      b.rect(26, y + 6, 4, 5, P.sand);
      b.set(27, y + 7, crest.dark);
    }
    // Apliques a los lados de la boca (2 y 3): alumbran también en el salón pequeño.
    if (level === 2 || level === 3)
      for (const x of HEARTH_SCONCES) b.blit(sconceArt(level), x - 3, top + HEARTH_SCONCE_TOP);
  });
}

/** Dónde van (en x del dibujo de la chimenea) los apliques de sus lados y a qué alto. */
export const HEARTH_SCONCES = [5, 51] as const;
const HEARTH_SCONCE_TOP = 17;
/** A qué altura sobre el suelo queda la llama de esos apliques (en píxeles del dibujo). */
export const HEARTH_SCONCE_Y = 54 - HEARTH_SCONCE_TOP - 1;

/** Fuego grande: troncos apilados más alto y brasas. */
function blaze(f: PixelBuffer, big: boolean) {
  f.rect(18, 43, 20, 3, W[2]!);
  f.hline(18, 43, 20, W[3]!);
  f.ellipse(19, 44.5, 1.5, 1.5, W[5]!);
  f.ellipse(37, 44.5, 1.5, 1.5, W[5]!);
  f.rect(22, 40, 12, 3, W[3]!);
  f.ellipse(33, 41.5, 1.5, 1.5, W[6]!);
  if (big) f.rect(25, 37, 7, 3, W[2]!);
  for (let x = 15; x < 41; x += 2) f.set(x, 53, x % 4 ? P.orange : P.gold);
  for (let x = 17; x < 40; x += 5) f.set(x, 48, P.amber);
}

const recolor = (pairs: [string, string][]) =>
  new Map(pairs.map(([a, b]) => [rgba(a), rgba(b)] as [number, number]));
/** La piedra gris de la chimenea, en arenisca (nivel 4) o en mármol (nivel 5). */
const SANDSTONE = recolor([
  [P.navy, P.umber],
  [P.slate, P.cocoa],
  [P.steel, P.clay],
  [P.fog, P.tan],
  [P.mist, P.sand],
]);
const MARBLE_STONE = recolor([
  [P.navy, P.steel],
  [P.slate, P.fog],
  [P.steel, P.mist],
  [P.fog, P.white],
  [P.mist, P.white],
]);
/** El hierro de los apliques, dorado (gran salón). */
const GILT = recolor([
  [P.slate, P.amber],
  [P.steel, P.gold],
  [P.fog, P.lemon],
]);

/** El aplique de pared (de hierro; del 4, dorado). */
export function sconceArt(level: number): PixelBuffer {
  const s = wallSconce();
  if (level < 4) return s;
  const g = s.clone();
  g.map((c) => GILT.get(c) ?? c);
  return g;
}

/**
 * Dónde van (en x del fondo) los apliques de la pared del salón: en los postes que no caen en
 * la alacena, en una ventana, en el tablón ni detrás de la chimenea.
 */
export function salonSconces(room: Room, bw: number): number[] {
  // (Del 4 en adelante alumbran la lámpara y los candelabros: sin apliques.)
  if (room.level < 2 || room.level > 3) return [];
  const { hearthLeft } = hearthSpan(bw);
  const wins = Array.from({ length: room.w }, (_, i) => windowX(i)).filter(
    (x) => x + 14 < hearthLeft,
  );
  const bx = Math.min(Math.round(CELL_W * BACK + 6), hearthLeft - 41);
  const board = room.w > 1 && wins.every((wx) => bx + 38 < wx - 14 || bx > wx + 14);
  const out: number[] = [];
  for (let x = 72; x + 6 < hearthLeft; x += 36) {
    if (wins.some((wx) => Math.abs(wx - x) < 19)) continue;
    if (board && x > bx - 6 && x < bx + 44) continue;
    out.push(x);
  }
  return out;
}

/** Pizarra con las cuentas de la diana (nivel 2). */
function chalkboard(): PixelBuffer {
  return Prop.piece(10, 12, (b) => {
    b.rect(0, 0, 10, 12, W[4]!);
    b.rect(1, 1, 8, 10, P.navy);
    for (const [x, y] of [
      [2, 3],
      [3, 3],
      [4, 3],
      [2, 6],
      [3, 6],
      [2, 9],
    ])
      b.vline(x!, y! - 1, 2, P.mist);
    b.line(2, 4, 5, 2, P.fog);
    b.set(7, 9, P.white);
  });
}

/** La cabeza de ciervo en su escudete (el trofeo del nivel 3; del 4, con canto dorado). */
function stagHead(level: number): PixelBuffer {
  return Prop.piece(26, 19, (b) => {
    const rim = level >= 4 ? P.gold : W[2]!;
    b.ellipse(13, 13, 6, 5.5, rim);
    b.ellipse(13, 13, 5, 4.5, W[3]!);
    b.rect(10, 17, 7, 2, rim);
    b.blit(Prop.antlers(), 0, 1);
  });
}

/** La lámpara de araña de cristal del nivel 5: dos pisos de velas y lágrimas de cristal. */
export function crystalChandelier(chain: number): PixelBuffer {
  const c = chain;
  return Prop.piece(
    31,
    c + 19,
    (p) => {
      for (let y = 0; y < c; y++) p.set(15, y, y % 2 ? P.gold : P.amber);
      p.rect(14, c, 3, 3, P.gold);
      p.set(15, c, P.lemon);
      // Piso de arriba: tres velas.
      p.hline(9, c + 6, 13, P.gold);
      for (const x of [9, 15, 21]) {
        p.vline(x, c + 3, 3, P.white);
        p.set(x, c + 2, P.lemon);
      }
      p.vline(15, c + 3, 9, P.gold);
      // Piso de abajo: seis velas en un aro.
      p.hline(1, c + 11, 29, P.gold);
      p.hline(3, c + 12, 25, P.amber);
      for (const x of [1, 6, 11, 19, 24, 29]) {
        p.vline(x, c + 8, 3, P.white);
        p.set(x, c + 7, P.lemon);
      }
      // Lágrimas de cristal colgando del aro y la gota grande del centro.
      for (let x = 2; x < 29; x += 3) {
        p.set(x, c + 13, P.mist);
        p.set(x, c + 14, x % 2 ? P.white : P.cyan);
        if (x % 6 === 2) p.set(x, c + 15, P.mist);
      }
      for (let x = 11; x < 21; x += 2) p.set(x, c + 7, P.mist);
      p.rect(14, c + 13, 3, 3, P.mist);
      p.set(15, c + 14, P.white);
      p.set(15, c + 16, P.cyan);
      p.set(15, c + 17, P.mist);
    },
    'none',
  );
}
