/**
 * Arte del recibidor: la entrada desde el patio y el puesto de los de guardia. En la pared del
 * fondo, el perchero junto a la puerta, los carteles de «Se busca», el armero de lanzas con su
 * escudo; delante, el banco, el atril con el libro de visitas, el baúl o
 * la armadura y la campana de aviso. Su nivel es la puerta de la calle: de tablas sueltas a
 * herrada y atrancada.
 */
import { P, type Ramp } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { planksV } from '../../paint';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { FLOOR_D, MID, W, WALL, at, bx, hung, type RoomArt, type Thing, type WallCtx } from './kit';

const CLOAKS: Ramp[] = [
  [P.plum, P.wine, P.red, P.coral],
  [P.black, P.deep, P.forest, P.leaf],
  [P.black, P.navy, P.ocean, P.sky],
];

/**
 * Dónde va cada cosa (x en el interior de la sala, en el mundo). El banco, bajo el perchero;
 * los dos de guardia, delante del armero (que va en la pared, sin muebles delante); el atril y
 * lo del rincón, bajo la ventana (más bajos que el alféizar); la campana, junto a la puerta.
 */
export const SPOT = { bench: 17, lectern: 71, corner: 96, bell: 12, guards: [38, 57] } as const;

// ---------- Pared del fondo (a la escala del fondo) ----------

/** Perchero de tablas con capas colgadas y un sombrero (más cosas cuanto más nivel). */
export function coatRack(level: number): PixelBuffer {
  return Prop.piece(22, 24, (b) => {
    b.rect(0, 0, 22, 3, W[4]!);
    b.hline(0, 0, 22, W[5]!);
    b.hline(0, 2, 22, W[3]!);
    for (const x of [4, 11, 18]) {
      b.set(x, 3, W[1]!);
      b.set(x, 1, P.black);
    }
    cloak(b, 4, 4, CLOAKS[0]!, level >= 3);
    if (level >= 2) cloak(b, 18, 4, CLOAKS[1]!, level >= 3);
    // Sombrero de fieltro de ala ancha (con pluma, con nivel), colgado de su clavija.
    b.hline(9, 4, 4, W[4]!);
    b.rect(8, 5, 6, 3, W[4]!);
    b.hline(9, 5, 3, W[5]!);
    b.vline(13, 5, 3, W[3]!);
    b.hline(8, 8, 6, level >= 3 ? P.gold : P.wine);
    b.hline(6, 9, 10, W[4]!);
    b.hline(6, 10, 10, W[3]!);
    b.hline(7, 9, 4, W[5]!);
    if (level >= 3) {
      b.line(12, 6, 15, 3, P.red);
      b.set(15, 2, P.coral);
    }
  });
}

/** Capa con capucha colgada de una clavija en `x` (centro), de `y` hacia abajo. */
function cloak(b: PixelBuffer, x: number, y: number, ramp: Ramp, brooch: boolean) {
  // Capucha doblada.
  b.rect(x - 2, y, 4, 3, ramp[1]!);
  b.hline(x - 1, y, 2, ramp[2]!);
  for (let j = 3; j < 19; j++) {
    const w = 4 + Math.floor(j / 5);
    const x0 = x - Math.floor(w / 2);
    b.hline(x0, y + j, w, ramp[1]!);
    b.set(x0, y + j, ramp[2]!);
    b.set(x0 + w - 1, y + j, ramp[0]!);
    if (j > 5 && j % 4 !== 0) b.set(x0 + Math.floor(w / 2), y + j, ramp[0]!);
  }
  b.hline(x - 3, y + 18, 7, ramp[0]!);
  if (brooch) b.set(x, y + 3, P.gold);
}

/** Cartel de «Se busca» con una cara dibujada (7×9), clavado en `x, y`. */
function wanted(b: PixelBuffer, x: number, y: number, face: string) {
  b.rect(x, y, 7, 9, P.sand);
  b.vline(x + 6, y + 1, 8, P.tan);
  b.hline(x, y + 8, 7, P.tan);
  b.hline(x + 1, y + 1, 5, P.wine);
  b.ellipse(x + 3.5, y + 4.5, 1.6, 1.6, face);
  b.set(x + 3, y + 4, P.sand);
  b.hline(x + 2, y + 7, 3, P.oak);
  b.set(x + 3, y, P.slate);
}

/**
 * Armero de lanzas: un panel de tablas oscuras (que tapa el poste y hace de fondo) con las
 * lanzas, la alabarda y el escudo (con los colores del gremio arriba). Las astas se pintan sin
 * contorno, que a un píxel de ancho las engordaría.
 */
export function spearRack(level: number, crest: SalonLook['crest']): PixelBuffer {
  const h = RACK_H;
  const slots = level >= 2 ? [4, 9, 14, 19] : [7, 16];
  const n = level >= 2 ? 3 : 2;
  const b = Prop.piece(24, h, (p) => {
    planksV(p, 1, 2, 22, h - 5, 'armero', [P.black, P.plum, P.bark, P.bark], 4);
    p.rect(0, 0, 24, 2, W[4]!);
    p.hline(0, 0, 24, W[5]!);
    p.rect(0, h - 4, 24, 4, W[3]!);
    p.hline(0, h - 4, 24, W[5]!);
    p.hline(0, h - 3, 24, W[4]!);
    p.hline(0, h - 1, 24, W[1]!);
  });
  for (let i = 0; i < n; i++) spear(b, slots[i]!, h);
  if (level >= 3) halberd(b, slots[3]!, h);
  // Barra con muescas que las sujeta.
  b.hline(1, 11, 22, W[4]!);
  b.hline(1, 12, 22, W[1]!);
  if (level >= 2) b.blit(shield(level >= 3 ? crest : null), 4, 15);
  return b;
}

/** Alto del armero (las puntas quedan por debajo del farol del techo). */
const RACK_H = 36;

function spear(b: PixelBuffer, x: number, h: number) {
  // Asta clara con su sombra y punta de hoja de laurel.
  b.vline(x, 9, h - 13, W[5]!);
  b.vline(x + 1, 9, h - 13, W[2]!);
  b.set(x, 2, P.white);
  b.hline(x - 1, 3, 3, P.mist);
  b.set(x + 1, 3, P.fog);
  b.hline(x - 1, 4, 3, P.fog);
  b.set(x - 1, 4, P.mist);
  b.set(x + 1, 4, P.steel);
  b.hline(x - 1, 5, 3, P.steel);
  b.set(x - 1, 5, P.fog);
  b.set(x, 6, P.steel);
  b.set(x, 7, P.slate);
  b.set(x, 8, P.slate);
}

function halberd(b: PixelBuffer, x: number, h: number) {
  spear(b, x, h);
  // Hoja de hacha a la izquierda y gancho a la derecha.
  b.rect(x - 3, 7, 3, 5, P.fog);
  b.vline(x - 3, 7, 5, P.mist);
  b.hline(x - 2, 11, 2, P.steel);
  b.set(x + 2, 8, P.fog);
  b.set(x + 3, 9, P.steel);
}

/** Escudo redondo (16×16): de tablas con borde de hierro o, si se da, con los colores del gremio. */
function shield(crest: SalonLook['crest'] | null): PixelBuffer {
  return Prop.piece(16, 16, (p) => {
    const cx = 7.5;
    if (crest)
      // Partido: medio campo de cada color del escudo, con el borde dorado.
      p.ellipse(8, 8, 7, 7, (x, _y, d) => (d > 0.72 ? P.gold : x > cx ? crest.dark : crest.field));
    else p.ellipse(8, 8, 7, 7, (x, _y, d) => (d > 0.72 ? P.steel : x % 3 ? W[4]! : W[3]!));
    p.ellipse(8, 8, 1.8, 1.8, crest ? P.lemon : P.fog);
    p.set(8, 8, crest ? P.gold : P.steel);
  });
}

/**
 * Lo propio del recibidor en la pared del fondo (`b` ya lleva el yeso, el zócalo y la ventana,
 * centrada en `windows[0][0]`): el perchero junto a la puerta (encima del banco), el armero en
 * el poste del medio y los carteles entre la ventana y la pared. Arriba a la izquierda no se
 * pone nada: ahí cuelga la campana.
 */
function wall(b: PixelBuffer, room: Room, look: SalonLook, { cells, top, ruin }: WallCtx): void {
  if (ruin) return;
  const lvl = room.level;
  // El armero, en el poste del medio (algo a la derecha, para dejar sitio al perchero), apoyado
  // en el zócalo; el perchero, a su izquierda, con la barra a la misma altura que su remate.
  const spears = spearRack(lvl, look.crest);
  const sy = top - spears.h + 1;
  b.blit(spears, 25, sy);
  b.blit(coatRack(lvl), 1, sy);
  // Carteles de «Se busca», uno encima de otro a la derecha de la ventana (por encima de la
  // armadura del rincón).
  const wx = bx(cells[0]!.win);
  const px = Math.round((wx + 13 + b.w - 7) / 2);
  const faces = [P.oak, P.umber];
  if (px + 7 <= b.w - 1)
    for (let i = 0; i < Math.min(2, lvl); i++) wanted(b, px, 11 + i * 13, faces[i]!);
}

// ---------- La puerta de la calle (en la pared de la izquierda, por dentro) ----------

/**
 * La puerta de la calle vista por dentro, de 17×54, con la esquina en `x, y`. Rota, de tablas
 * desencajadas; luego con más herrajes cuanto más nivel, y al final con mirilla y tranca.
 */
export function streetDoor(b: PixelBuffer, x: number, y: number, level: number, seed: string) {
  b.rect(x, y, 17, 54, P.plum);
  b.rect(x + 1, y + 2, 15, 52, P.bark);
  const wood: Ramp =
    level === 0 ? [P.black, P.plum, P.bark, P.rust] : [P.plum, P.rust, P.oak, P.clay];
  planksV(b, x + 2, y + 3, 13, 51, `${seed}puerta`, wood, 4);
  if (level === 0) {
    // Una tabla que falta (se ve la noche por la rendija) y el herraje de abajo suelto.
    b.rect(x + 6, y + 10, 2, 30, P.black);
    b.hline(x + 2, y + 9, 13, P.slate);
    b.line(x + 2, y + 36, x + 13, y + 40, P.slate);
    b.line(x + 2, y + 37, x + 13, y + 41, P.navy);
    b.hline(x - 1, y + 53, 19, P.steel);
    return;
  }
  const bands = level >= 2 ? [y + 8, y + 26, y + 44] : [y + 10, y + 38];
  for (const by of bands) {
    b.hline(x + 2, by, 13, P.steel);
    b.hline(x + 2, by + 1, 13, P.navy);
    if (level >= 2) for (let i = x + 3; i < x + 15; i += 3) b.set(i, by, P.mist);
  }
  if (level >= 3) {
    // Clavos de hierro entre los herrajes.
    for (let j = y + 14; j < y + 42; j += 6)
      for (let i = x + 4 + ((j / 6) % 2) * 2; i < x + 15; i += 4) b.set(i, j, P.fog);
    // Mirilla con rejilla.
    b.rect(x + 6, y + 15, 5, 4, P.black);
    b.vline(x + 8, y + 15, 4, P.steel);
    b.rect(x + 5, y + 14, 7, 1, P.slate);
  }
  // Aldaba.
  b.ellipse(x + 12, y + 30, 1.5, 1.5, P.gold);
  b.set(x + 12, y + 32, P.amber);
  if (level >= 3) {
    // La tranca, cruzada en sus dos soportes.
    for (const sx of [x - 1, x + 15]) b.rect(sx, y + 33, 3, 5, P.slate);
    b.rect(x - 2, y + 34, 21, 3, W[4]!);
    b.hline(x - 2, y + 34, 21, W[5]!);
    b.hline(x - 2, y + 36, 21, W[2]!);
  } else if (level >= 2) {
    // Los soportes de la tranca, aún sin ella.
    for (const sx of [x - 1, x + 15]) b.rect(sx, y + 33, 3, 5, P.slate);
  }
  b.hline(x - 1, y + 53, 19, P.steel);
}

// ---------- Muebles de delante ----------

/** Banco de esperar; con nivel, con cojín y unas botas debajo. */
export function bench(level: number): PixelBuffer {
  return Prop.piece(26, 10, (p) => {
    if (level >= 2) {
      p.rect(9, 6, 3, 4, P.umber);
      p.rect(9, 9, 5, 1, P.umber);
      p.rect(14, 6, 3, 4, P.mocha);
      p.rect(14, 9, 5, 1, P.mocha);
      p.vline(9, 6, 3, P.cocoa);
    }
    p.rect(0, 1, 26, 3, W[4]!);
    p.hline(0, 1, 26, W[5]!);
    p.hline(0, 3, 26, W[3]!);
    p.rect(2, 4, 3, 6, W[2]!);
    p.rect(21, 4, 3, 6, W[2]!);
    if (level >= 2) {
      p.rect(3, 0, 10, 2, level >= 3 ? P.wine : P.forest);
      p.hline(3, 0, 10, level >= 3 ? P.red : P.leaf);
    }
  });
}

/** Atril con el libro de visitas abierto (y la pluma en su tintero, con nivel). */
export function lectern(level: number): PixelBuffer {
  return Prop.piece(16, 24, (p) => {
    // Libro abierto: dos páginas con renglones, el lomo en medio y la cinta colgando.
    p.rect(0, 0, 7, 5, P.white);
    p.rect(9, 0, 7, 5, P.white);
    p.hline(0, 4, 7, P.mist);
    p.hline(9, 4, 7, P.mist);
    for (const y of [1, 3]) {
      p.hline(1, y, 5, P.fog);
      p.hline(10, y, 4 + (y % 2), P.fog);
    }
    p.vline(7, 0, 5, P.mist);
    p.vline(8, 0, 5, P.fog);
    p.hline(0, 5, 16, P.wine);
    p.vline(8, 5, 4, P.red);
    // Tablero, pie y base.
    p.rect(0, 6, 16, 3, W[4]!);
    p.hline(0, 6, 16, W[5]!);
    p.hline(0, 8, 16, W[2]!);
    p.rect(6, 9, 4, 12, W[3]!);
    p.vline(6, 9, 12, W[4]!);
    p.vline(9, 9, 12, W[2]!);
    p.rect(2, 21, 12, 3, W[3]!);
    p.hline(2, 21, 12, W[4]!);
    p.hline(2, 23, 12, W[1]!);
    if (level >= 3) {
      // Tintero con su pluma.
      p.rect(12, 3, 2, 2, P.black);
      p.line(13, 2, 15, 0, P.white);
    }
  });
}

/** Campana de aviso colgada de su soporte, con la cuerda para tocarla. */
export function alarmBell(): PixelBuffer {
  return Prop.piece(9, 14, (p) => {
    p.hline(1, 0, 7, P.slate);
    p.vline(4, 1, 2, P.slate);
    for (let j = 0; j < 6; j++) {
      const w = 3 + j;
      const x0 = 4 - Math.floor(w / 2);
      p.hline(x0, 3 + j, w, j < 2 ? P.gold : P.orange);
      p.set(x0, 3 + j, P.lemon);
      p.set(x0 + w - 1, 3 + j, P.brick);
    }
    p.hline(0, 9, 9, P.brick);
    p.set(4, 10, P.slate);
    p.vline(5, 10, 4, P.tan);
  });
}

/**
 * Suelo del recibidor: un felpudo de esparto en la puerta y, con nivel, una alfombra que entra
 * hasta los de guardia (roja y con fleco dorado al final).
 */
function floor(b: PixelBuffer, room: Room) {
  const level = room.level;
  if (level >= 2) {
    const [edge, base, dot] = level >= 3 ? [P.wine, P.red, P.gold] : [P.deep, P.forest, P.leaf];
    b.rect(18, 8, 70, FLOOR_D - 16, edge);
    b.rect(19, 9, 68, FLOOR_D - 18, base);
    for (let x = 22; x < 86; x += 5) b.set(x, FLOOR_D / 2, dot);
    if (level >= 3) for (let y = 8; y < FLOOR_D - 8; y += 2) b.set(88, y, P.gold);
  }
  b.rect(1, 8, 18, FLOOR_D - 16, P.oak);
  b.rect(2, 9, 16, FLOOR_D - 18, P.tan);
  for (let y = 10; y < FLOOR_D - 9; y += 2) b.hline(3, y, 14, P.clay);
}

// ---------- En la sala ----------

/** Todo pegado a la pared: el suelo de delante es el paso de la puerta y el de los de guardia. */
function things(room: Room): Thing[] {
  const lvl = room.level;
  const t: Thing[] = [at(bench(lvl), SPOT.bench, WALL - 4)];
  if (lvl >= 2) t.push(at(lectern(lvl), SPOT.lectern, WALL));
  t.push(
    at(lvl >= 3 ? Prop.armorStand() : lvl >= 2 ? Prop.trunk() : Prop.crate(), SPOT.corner, WALL),
  );
  if (lvl >= 2) t.push(hung(alarmBell(), SPOT.bell, MID));
  return t;
}

export const recibidor: RoomArt = { wall, things, floor };
