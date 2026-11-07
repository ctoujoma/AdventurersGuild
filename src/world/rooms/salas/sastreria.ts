/**
 * Arte de la sastrería: tiñe y viste a los héroes, y cose botas y capas. En el primer hueco, el
 * maniquí con la prenda a medio hacer (al lado se pone el héroe al que visten) y la mesa de
 * cortar con la tela extendida, las tijeras y la tiza; bajo la ventana, la tina de tinte con su
 * vapor. En la pared, el estante de los rollos de tela de colores (los tintes) y, colgadas del
 * techo, telas tendidas a secar. Más nivel, más telas y, en el 3, el espejo de cuerpo entero.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { TINTS, TINT_IDS, type TintId } from '../../../data/custom';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FREE,
  MID,
  WALL,
  W,
  at,
  bx,
  cellsOf,
  emits,
  hung,
  stretchesOf,
  task,
  thick,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { shelf, web } from './piezas';
import { cloth, type Cloth } from './tintes';

/** La tela de la casa (sin tema de color): la de vino, que se distinga del maniquí crudo. */
const HOUSE: Cloth = TINTS.vino.ramp;
/** Los tintes, por orden, para los rollos, las tinas y las telas tendidas. */
const RAMPS = TINT_IDS.map((id: TintId) => TINTS[id].ramp);

/** Dónde va cada cosa en el primer hueco (en el mundo). */
const DUMMY_X = 12;
const TABLE_X = 46;

// ---------- Piezas ----------

/**
 * Mesa de cortar: la tela extendida con el patrón en tiza, las tijeras y la cinta; con nivel,
 * el acerico con los alfileres y un segundo retal doblado.
 */
function cuttingTable(level: number, c: Cloth): PixelBuffer {
  return Prop.piece(34, 22, (p) => {
    // Tablero y patas con su travesaño.
    p.rect(0, 9, 34, 3, W[4]!);
    p.hline(0, 9, 34, W[5]!);
    p.hline(0, 11, 34, W[2]!);
    p.rect(2, 12, 3, 10, W[3]!);
    p.rect(29, 12, 3, 10, W[3]!);
    p.vline(2, 12, 10, W[4]!);
    p.hline(5, 17, 24, W[2]!);
    // La tela extendida, que cuelga un poco por el borde.
    p.rect(4, 7, 22, 2, c[2]);
    p.hline(4, 7, 22, c[3]);
    p.rect(22, 9, 4, 4, c[1]);
    p.vline(25, 9, 4, c[0]);
    // El patrón en tiza.
    for (let x = 6; x < 20; x += 2) p.set(x, 8, P.white);
    p.set(20, 7, P.white);
    // Las tijeras abiertas y la cinta de medir enrollada.
    p.line(8, 4, 12, 6, P.mist);
    p.line(8, 6, 12, 4, P.fog);
    p.set(7, 3, P.red);
    p.set(7, 7, P.red);
    p.ellipse(29, 7, 2.5, 2, P.gold);
    p.set(29, 7, P.amber);
    p.hline(26, 8, 3, P.lemon);
    if (level >= 2) {
      // El acerico (un tomate de tela con alfileres).
      p.ellipse(17, 5, 2.5, 2, P.red);
      p.set(16, 4, P.coral);
      for (const [x, y] of [
        [15, 3],
        [17, 2],
        [19, 3],
      ])
        p.set(x!, y!, P.mist);
      p.vline(17, 3, 1, P.fog);
    }
    if (level >= 3) {
      // Otro retal, doblado, de otro color.
      const o = RAMPS[1]!;
      p.rect(0, 5, 5, 4, o[2]);
      p.hline(0, 5, 5, o[3]);
      p.hline(0, 7, 5, o[1]);
    }
  });
}

/**
 * El maniquí en su pie de tres patas, con la prenda a medio hacer: el torso de tela cruda y la
 * pieza hilvanada por una mitad (entera y con su ribete dorado en el nivel 3).
 */
function dummy(level: number, c: Cloth): PixelBuffer {
  return Prop.piece(16, 36, (p) => {
    // Pie: el palo y las tres patas.
    p.vline(7, 20, 12, W[3]!);
    p.vline(8, 20, 12, W[2]!);
    p.line(7, 31, 2, 35, W[3]!);
    p.line(8, 31, 13, 35, W[3]!);
    p.vline(7, 31, 5, W[2]!);
    // Remate del cuello.
    p.rect(6, 0, 4, 2, W[4]!);
    p.hline(6, 0, 4, W[5]!);
    // El torso de tela cruda: hombros, cintura y cadera.
    for (let y = 2; y < 21; y++) {
      const hw = y < 5 ? 3 + (y - 2) * 1.6 : y < 13 ? 7 - (y - 5) * 0.3 : 4.6 + (y - 13) * 0.35;
      const x0 = Math.round(8 - hw);
      const x1 = Math.round(8 + hw);
      p.hline(x0, y, x1 - x0, P.sand);
      p.set(x0, y, P.tan);
      p.set(x1 - 1, y, P.clay);
    }
    // La prenda: por una mitad (o entera, con nivel) y con los alfileres del hilván.
    const whole = level >= 3;
    for (let y = 4; y < 20; y++)
      for (let x = 0; x < 16; x++) {
        if (!p.get(x, y)) continue;
        if (!whole && x > 8) continue;
        p.set(x, y, x < 4 || y > 17 ? c[1] : x === 8 && !whole ? c[0] : c[2]);
      }
    p.hline(3, 4, 10, c[3]);
    if (whole) {
      p.hline(2, 19, 12, P.gold);
      p.vline(8, 5, 14, P.gold);
    } else for (let y = 6; y < 19; y += 3) p.set(9, y, P.mist);
    // La cinta colgada del cuello.
    p.vline(5, 2, 9, P.lemon);
    p.vline(11, 2, 6, P.lemon);
    if (level >= 2) p.set(5, 11, P.gold);
  });
}

/** Tina de tinte: cuba de duelas con el agua del color y el palo apoyado (con vapor). */
function dyeTub(c: Cloth): PixelBuffer {
  return Prop.piece(24, 20, (p) => {
    p.rect(2, 6, 20, 14, W[3]!);
    for (let x = 2; x < 22; x += 4) p.vline(x, 6, 14, W[2]!);
    p.vline(3, 6, 14, W[4]!);
    for (const y of [8, 17]) {
      p.hline(1, y, 22, P.slate);
      p.hline(1, y + 1, 22, P.navy);
    }
    // El agua del tinte, con una tela que asoma.
    p.ellipse(12, 6, 10, 2, c[1]);
    p.hline(5, 5, 9, c[2]);
    p.set(8, 5, c[3]);
    p.rect(14, 4, 4, 2, c[2]);
    p.hline(14, 4, 4, c[3]);
    // El palo de remover, apoyado en el borde.
    p.line(18, 0, 15, 6, W[4]!);
    p.line(19, 0, 16, 6, W[2]!);
    p.set(15, 6, c[0]);
  });
}

/**
 * Telas tendidas a secar en una cuerda, colgada del techo por los extremos (`n` telas, de los
 * colores de los tintes).
 */
function line(n: number, w: number, first: number): PixelBuffer {
  return Prop.piece(
    w,
    18,
    (p) => {
      // La cuerda, que cuelga un poco por el medio.
      for (let x = 0; x < w; x++) {
        const sag = Math.round(Math.sin((x / (w - 1)) * Math.PI) * 2);
        p.set(x, 2 + sag, P.tan);
      }
      p.vline(0, 0, 3, P.bark);
      p.vline(w - 1, 0, 3, P.bark);
      const gap = w / (n + 1);
      for (let k = 0; k < n; k++) {
        const c = RAMPS[(first + k * 2) % RAMPS.length]!;
        const cx = Math.round(gap * (k + 1));
        const top = 3 + Math.round(Math.sin((cx / (w - 1)) * Math.PI) * 2);
        const tw = 7;
        const th = 6 + (k % 2) * 2;
        p.rect(cx - 3, top, tw, th, c[2]);
        p.vline(cx - 3, top, th, c[3]);
        p.vline(cx + 3, top, th, c[1]);
        p.hline(cx - 3, top + th - 1, tw, c[1]);
        // Pinza de madera y una raya del tejido.
        p.set(cx - 2, top, W[5]!);
        p.set(cx + 2, top, W[5]!);
        p.hline(cx - 2, top + 3, 5, c[1]);
      }
    },
    'none',
  );
}

/**
 * Espejo de cuerpo entero en su bastidor, con el reflejo y su brillo en diagonal. El bastidor
 * mide 4 píxeles por los lados y por arriba: el volumen (`thick`) toma el color de sus costados
 * de 3 píxeles hacia dentro, y así sale de la madera y no del cristal.
 */
function mirror(): PixelBuffer {
  return Prop.piece(14, 38, (p) => {
    // Bastidor y patas.
    p.rect(0, 2, 14, 30, W[3]!);
    p.hline(0, 2, 14, W[5]!);
    p.vline(0, 2, 30, W[4]!);
    p.rect(3, 5, 8, 25, W[2]!);
    p.rect(1, 32, 3, 6, W[3]!);
    p.rect(10, 32, 3, 6, W[3]!);
    p.hline(0, 37, 14, W[2]!);
    p.rect(5, 0, 4, 2, P.gold);
    // El cristal: frío arriba, con el suelo reflejado abajo.
    p.rect(4, 6, 6, 23, P.mist);
    p.rect(4, 6, 6, 7, P.white);
    p.rect(4, 24, 6, 5, P.fog);
    p.hline(4, 28, 6, P.steel);
    // El brillo.
    p.line(5, 13, 8, 9, P.white);
    p.line(5, 17, 9, 13, P.white);
    p.set(9, 22, P.white);
  });
}

/** Cesto de mimbre con carretes de hilo y un ovillo. */
function basket(): PixelBuffer {
  return Prop.piece(14, 10, (p) => {
    p.rect(1, 4, 12, 6, W[4]!);
    for (let x = 1; x < 13; x += 2) p.vline(x, 4, 6, W[5]!);
    p.hline(0, 4, 14, W[3]!);
    p.hline(1, 9, 12, W[2]!);
    const spools: [number, string][] = [
      [3, P.red],
      [6, P.sky],
      [9, P.lime],
    ];
    for (const [x, c] of spools) {
      p.rect(x, 1, 2, 3, c);
      p.hline(x, 0, 2, W[5]!);
    }
    p.ellipse(11, 2, 2, 2, P.rose);
    p.set(11, 1, P.coral);
  });
}

// ---------- Pared ----------

/** Un rollo de tela de pie, visto de frente (4 de ancho), con la base en `base`. */
function bolt(b: PixelBuffer, x: number, base: number, c: Cloth, h = 12) {
  b.rect(x, base - h, 4, h, c[2]);
  b.vline(x, base - h, h, c[3]);
  b.vline(x + 3, base - h, h, c[0]);
  for (let y = base - h + 2; y < base; y += 4) b.hline(x + 1, y, 2, c[1]);
  b.hline(x, base - h, 4, P.sand);
}

/** El estante de los rollos de tela: más rollos y otro estante con nivel. */
function boltShelf(b: PixelBuffer, x: number, y: number, w: number, level: number) {
  const n = Math.min(Math.floor((w - 2) / 5), [3, 5, 7][Math.min(2, level - 1)]!);
  shelf(b, x, y, w);
  for (let k = 0; k < n; k++) bolt(b, x + 2 + k * 5, y, RAMPS[k % RAMPS.length]!, 10 + (k % 3));
  if (level >= 2) {
    // Carretes de hilo en la tabla de abajo.
    shelf(b, x, y + 10, w);
    for (let k = 0; k < n + 1; k++) {
      const c = RAMPS[(k * 3) % RAMPS.length]!;
      b.rect(x + 2 + k * 4, y + 7, 2, 3, c[2]);
      b.hline(x + 2 + k * 4, y + 6, 2, W[5]!);
    }
  }
}

/** Un patrón de papel clavado en la pared, con su silueta de prenda en tiza. */
function pattern(b: PixelBuffer, x: number, y: number, kind: number) {
  b.rect(x, y, 12, 14, P.sand);
  b.hline(x, y, 12, P.white);
  b.vline(x + 11, y, 14, P.tan);
  b.set(x + 5, y, P.red);
  if (kind % 2) {
    // Una capa.
    b.line(x + 6, y + 3, x + 2, y + 12, P.clay);
    b.line(x + 6, y + 3, x + 10, y + 12, P.clay);
    b.hline(x + 2, y + 12, 9, P.clay);
  } else {
    // Una bota.
    b.vline(x + 4, y + 3, 7, P.clay);
    b.vline(x + 7, y + 3, 5, P.clay);
    b.line(x + 7, y + 8, x + 9, y + 10, P.clay);
    b.hline(x + 4, y + 11, 6, P.clay);
  }
}

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  if (ruin) return;
  const w = cells.at(-1)!.x1;
  const lvl = room.level;
  for (const s of stretchesOf(room, w)) {
    const x0 = bx(s.x0);
    const x1 = bx(s.x1);
    if (s.kind === 'left') {
      // Encima de la mesa, los rollos; con nivel, un patrón al lado.
      boltShelf(b, bx(TABLE_X) - 14, 34, 30, lvl);
      if (lvl >= 2) pattern(b, bx(DUMMY_X) - 2, 16, 0);
    } else if (s.kind === 'mid') {
      boltShelf(b, x0 + 4, 34, Math.max(14, x1 - x0 - 8), lvl);
      if (lvl >= 2) pattern(b, x0 + Math.round((x1 - x0) / 2) - 6, 14, s.i);
    }
  }
  // Sin ventana, en su sitio: un patrón (o, en la del medio, unas tijeras grandes de muestra).
  cells.forEach((c, j) => {
    if (c.glass) return;
    const x = bx(c.win);
    if (j % 2) {
      b.line(x - 6, 14, x + 4, 28, P.fog);
      b.line(x + 6, 14, x - 4, 28, P.mist);
      b.ellipse(x - 5, 30, 2.5, 2.5, (_x, _y, d) => (d > 0.3 ? P.red : 0));
      b.ellipse(x + 5, 30, 2.5, 2.5, (_x, _y, d) => (d > 0.3 ? P.red : 0));
    } else pattern(b, x - 6, 14, j + 1);
  });
}

// ---------- Sala ----------

/**
 * La pequeña: el maniquí y la mesa de cortar en el primer tramo, la tina bajo la ventana y,
 * colgadas, las telas. Las anchas suman otra mesa (o el espejo, con nivel) y otra tina, con un
 * tinte distinto en cada una.
 */
function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const c = cloth(room, HOUSE);
  const t: Thing[] = [];
  const cells = cellsOf(room, w);
  let fit = DUMMY_X + 12;
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') {
      t.push(task(thick(at(dummy(lvl, c), DUMMY_X, FREE + 2), 4, 'madera'), 'maniqui'));
      t.push(task(thick(at(cuttingTable(lvl, c), TABLE_X, FREE), 9, 'madera'), 'corte'));
      // Las telas tendidas, de pared a pared del tramo, por encima de las cabezas.
      t.push(hung(line(Math.min(3, lvl + 1), 34, 0), DUMMY_X + 16, MID + 6, 2));
    } else if (s.kind === 'mid') {
      const mx = (s.x0 + s.x1) / 2;
      if (s.i === 1 && lvl >= 2) {
        // El espejo de cuerpo entero: el héroe se viste delante de él.
        t.push(thick(at(mirror(), mx + 14, WALL - 4), 3, 'madera'));
        fit = mx + 2;
        t.push(task(thick(at(cuttingTable(lvl, RAMPS[2]!), mx - 18, FREE), 9, 'madera'), 'corte'));
      } else {
        t.push(task(thick(at(cuttingTable(lvl, RAMPS[s.i + 2]!), mx, FREE), 9, 'madera'), 'corte'));
        t.push(hung(line(3, 40, s.i), mx, MID + 6, 2));
      }
    } else if (lvl >= 3 && cells.length === 1) {
      // En la pequeña, el espejo va en el rincón de la derecha.
      t.push(thick(at(mirror(), w - 9, WALL - 7), 3, 'madera'));
      fit = w - 18;
    } else t.push(thick(at(basket(), Math.min(s.x0 + 8, w - 9), FREE + 4), 5, 'madera'));
  }
  // Bajo cada ventana, una tina de tinte con su color (y su vapor).
  cells.forEach((cell, j) =>
    t.push(
      task(
        emits(
          thick(at(dyeTub(j ? RAMPS[j % 2 ? 0 : 2]! : RAMPS[1]!), cell.win, FREE), 8, 'madera'),
          {
            kind: 'steam',
            rate: 1.6,
            at: [4, 2, 20, 5],
          },
        ),
        'tinte',
      ),
    ),
  );
  // Donde se queda de pie el héroe al que visten: junto al maniquí o delante del espejo.
  t.push({ ...at(new PixelBuffer(1, 1), fit, FREE + 2), poi: 'probador' });
  return t;
}

/** Por reparar: el maniquí tirado, la mesa sin tela y unos rollos sueltos. */
function ruin(room: Room, w: number): Thing[] {
  const dead = Prop.piece(16, 36, (p) => {
    p.blit(dummy(1, [P.plum, P.bark, P.rust, P.clay]), 0, 0);
    web(p, 2, 4, 1);
  });
  const t: Thing[] = [at(dead, DUMMY_X, WALL), at(Prop.crate(), TABLE_X, WALL)];
  for (const c of cellsOf(room, w)) t.push(at(Prop.sack(), c.win, WALL));
  return t;
}

export const sastreria: RoomArt = { wall, things, ruin };
