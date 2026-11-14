/**
 * La galería del salón de dos alturas (boceto E1): un suelo de madera pegado a la pared del
 * fondo a la altura de la planta de arriba, con su canto, sus pies derechos y su barandilla, y
 * tres mesas encima. Debajo queda la barra, a resguardo (y en sombra). Se sube por una escalera
 * de caracol dentro del salón, en el hueco de entre la galería y la chimenea (la eligió el
 * usuario entre esta y una recta contra la pared).
 *
 * Todo en coordenadas de la sala (x desde la pared de la izquierda, z hacia el fondo, y desde el
 * suelo hacia arriba). Lógica pura: dice dónde va cada cosa y su dibujo; la escena monta el suelo
 * de la galería (arriba, abajo y el extremo) y la escalera de caracol en 3D (`RoomScene.gallery`),
 * y la gente sube y baja por los peldaños (`steps`, ver `insides` en `people.ts`), mirando hacia
 * donde va en cada tramo de la vuelta (`stepView`).
 */
import { P, R } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import type { Room } from '../../core/model';
import { gallerySeats } from '../../core/salon';
import * as Prop from '../props';
import { DEPTH, PITCH } from './layout';
import { CANDLE, type Thing } from './salas/kit';
import { cloth } from './salas/tintes';
import { tableSet } from './salon';
import { BACK, scaleAt } from './view3d';

const W = R.wood; // [black, plum, bark, rust, oak, clay, tan]
const VINO = [P.plum, P.wine, P.red, P.coral] as const;

/** Canto de la galería (lo que sale de la pared hacia delante) y grueso de su suelo. */
export const EDGE = 24;
export const DECK = 8;
/** Peldaños de la escalera (el último es ya el suelo de la galería). */
export const GAL_STEPS = 12;
const RISE = PITCH / GAL_STEPS;
/** Radio de la escalera, fondo de su eje y radio por el que se pisa (algo fuera de la mitad). */
export const SPIRAL_R = 18;
const SPIRAL_Z = 40;
const WALK_R = 12;
/** Lo que gira cada peldaño (en grados) y su medio ancho en radianes. */
export const TURN = 24;
export const HALF = ((TURN / 2) * Math.PI) / 180;

export interface Step {
  x: number;
  /** Alto sobre el suelo del salón. */
  y: number;
  z: number;
}

export interface Gallery {
  /** El suelo de arriba va de la pared de la izquierda a `x1`, de `EDGE` a la pared del fondo. */
  x1: number;
  /** Por dónde se anda arriba (x). */
  walk: [number, number];
  posts: number[];
  tables: { x: number; z: number }[];
  seats: { x: number; z: number }[];
  /** Dónde se pisa cada peldaño, del suelo (0) a la galería (`GAL_STEPS`). */
  steps: Step[];
  /** El eje de la escalera de caracol. */
  axis: { x: number; z: number };
  /** Dónde queda sitio para la lámpara grande (x), fuera de la galería y la escalera. */
  lamp: number;
}

/** Si el salón tiene galería: el de dos alturas y tres huecos, en uso. */
export function hasGallery(room: Room): boolean {
  return (
    room.type === 'salon' &&
    room.h > 1 &&
    room.level > 0 &&
    !(room.works && room.works.kind !== 'extend') &&
    gallerySeats(room) > 0
  );
}

/** La galería de un salón de ancho interior `w` (null si no tiene). */
export function galleryOf(room: Room, w: number): Gallery | null {
  if (!hasGallery(room)) return null;
  const n = gallerySeats(room) / 2;
  // Casi una vuelta: empieza de cara (delante del eje), sube hacia la derecha, pasa por detrás
  // y sale arriba por la izquierda, a la galería.
  const cx = w - 106;
  const axis = { x: cx, z: SPIRAL_Z };
  const x1 = cx - SPIRAL_R - 2;
  const steps: Step[] = Array.from({ length: GAL_STEPS + 1 }, (_, i) => {
    if (i === 0) return { x: cx - 4, y: 0, z: SPIRAL_Z - SPIRAL_R - 3 };
    if (i === GAL_STEPS) return { x: x1 - 4, y: PITCH, z: SPIRAL_Z };
    const a = spiralAngle(i);
    return { x: cx + WALK_R * Math.sin(a), y: i * RISE, z: SPIRAL_Z - WALK_R * Math.cos(a) };
  });
  const lamp = cx + 34;
  // Las mesas de arriba, repartidas, contra la pared (con sus dos taburetes).
  const a = 26;
  const b = x1 - 26;
  const tables = Array.from({ length: n }, (_, i) => ({
    x: a + ((i + 0.5) * (b - a)) / n,
    z: DEPTH - 12,
  }));
  return {
    x1,
    walk: [18, x1 - 2],
    posts: [6, Math.round(x1 / 2), Math.round(x1 - 5)],
    tables,
    seats: tables.flatMap((t) => [
      { x: t.x - 18, z: t.z - 2 },
      { x: t.x + 18, z: t.z + 2 },
    ]),
    steps,
    axis,
    lamp,
  };
}

/** Ángulo del peldaño `i` de la de caracol (0 = de cara, hacia la derecha, detrás, izquierda). */
export const spiralAngle = (i: number) => (((i - 1) * TURN + TURN / 2) * Math.PI) / 180;

/** Hacia dónde mira quien pisa un tramo de la escalera: de lado, de espaldas o de frente. */
export type StepView = 'right' | 'left' | 'back' | 'front';

/**
 * La vista de quien va del peldaño `p` al `q` (subiendo; al bajar, al revés): si se aleja de la
 * cámara, de espaldas; si viene hacia ella, de frente; si no, de lado hacia donde va.
 */
export function stepView(
  p: { x: number; z: number },
  q: { x: number; z: number },
  up: boolean,
): StepView {
  const k = up ? 1 : -1;
  const dx = (q.x - p.x) * k;
  const dz = (q.z - p.z) * k;
  if (Math.abs(dz) > Math.abs(dx) * 1.2) return dz > 0 ? 'back' : 'front';
  return dx >= 0 ? 'right' : 'left';
}

// ---------- Dibujos ----------

/** El canto del suelo de arriba: una viga con las cabezas de las viguetas. */
function fascia(px: number, h: number): PixelBuffer {
  return Prop.piece(px, h + 3, (b) => {
    b.rect(0, 0, px, h, W[3]!);
    b.hline(0, 0, px, W[6]!);
    b.hline(0, 1, px, W[5]!);
    b.hline(0, h - 1, px, W[1]!);
    for (let x = 6; x < px - 4; x += 14) {
      // Cabeza de vigueta, con la cuña que la sujeta debajo.
      b.rect(x, 2, 4, h - 3, W[4]!);
      b.vline(x, 2, h - 3, W[5]!);
      b.vline(x + 3, 2, h - 3, W[2]!);
      b.hline(x, h, 4, W[2]!);
      b.hline(x + 1, h + 1, 2, W[1]!);
    }
  });
}

/** Barandilla de balaustres torneados con un pilar cada tanto. */
function railing(px: number): PixelBuffer {
  return Prop.piece(px, 13, (b) => {
    for (let x = 4; x < px - 3; x += 6) {
      b.vline(x, 3, 7, W[3]!);
      b.vline(x + 1, 3, 7, W[2]!);
      b.set(x, 6, W[5]!);
      b.set(x + 1, 6, W[4]!);
      b.set(x - 1, 6, W[3]!);
      b.set(x + 2, 6, W[2]!);
    }
    b.rect(0, 10, px, 3, W[3]!);
    b.hline(0, 10, px, W[4]!);
    for (let x = 0; x < px; x += 64) {
      const xx = Math.min(x, px - 5);
      b.rect(xx, 0, 5, 13, W[3]!);
      b.vline(xx, 0, 13, W[5]!);
      b.vline(xx + 4, 0, 13, W[2]!);
    }
    b.rect(0, 1, px, 3, W[4]!);
    b.hline(0, 1, px, W[6]!);
    b.hline(0, 3, px, W[2]!);
    for (let x = 0; x < px; x += 64) b.rect(Math.min(x, px - 5) - 1, 0, 7, 2, W[5]!);
    // El pilar del final, donde llega la escalera.
    b.rect(px - 5, 0, 5, 13, W[3]!);
    b.vline(px - 5, 0, 13, W[5]!);
  });
}

/** Pie derecho con su zapata arriba y la basa de piedra. */
function post(h: number): PixelBuffer {
  return Prop.piece(14, h, (b) => {
    b.rect(4, 0, 6, h, W[3]!);
    b.vline(4, 0, h, W[5]!);
    b.vline(5, 0, h, W[4]!);
    b.vline(9, 0, h, W[2]!);
    b.rect(0, 0, 14, 3, W[4]!);
    b.hline(0, 0, 14, W[5]!);
    for (let i = 0; i < 4; i++) {
      b.hline(1 + i, 3 + i, 3 - Math.min(2, i), W[3]!);
      b.hline(10, 3 + i, 3 - Math.min(2, i), W[2]!);
    }
    b.rect(3, h - 4, 8, 4, P.steel);
    b.hline(3, h - 4, 8, P.fog);
  });
}

/** El eje de la de caracol: un tronco torneado que asoma por encima de la galería. */
function spiralPost(): PixelBuffer {
  const k = scaleAt(SPIRAL_Z);
  const h = Math.round((PITCH + 18) * k);
  return Prop.piece(7, h, (b) => {
    b.rect(1, 3, 5, h - 3, W[3]!);
    b.vline(1, 3, h - 3, W[5]!);
    b.vline(2, 3, h - 3, W[4]!);
    b.vline(5, 3, h - 3, W[1]!);
    b.rect(0, 0, 7, 3, W[4]!);
    b.hline(0, 0, 7, W[6]!);
    for (let y = 12; y < h - 4; y += 9) b.hline(1, y, 5, W[2]!);
    b.rect(0, h - 3, 7, 3, P.steel);
  });
}

/**
 * Un peldaño de la de caracol visto de canto (`w` de ancho): la tabla con su canto, más clara
 * cuanto más de cara está (`front`, de -1, detrás del eje, a 1, delante).
 */
export function spiralTread(w: number, front: number): PixelBuffer {
  const lit = front > 0.3 ? W[6]! : front > -0.3 ? W[5]! : W[4]!;
  return Prop.piece(Math.max(2, w), 5, (b) => {
    b.hline(0, 0, b.w, lit);
    b.hline(0, 1, b.w, W[5]!);
    b.hline(0, 2, b.w, W[4]!);
    b.hline(0, 3, b.w, W[3]!);
    // La ménsula de debajo, junto al eje.
    b.hline(1, 4, b.w - 2, W[1]!);
  });
}

/** La huella de un peldaño de la de caracol, vista desde arriba: tabla con su canto claro fuera. */
export function treadTop(): PixelBuffer {
  const b = new PixelBuffer(8, 8);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      b.set(x, y, y === 0 ? W[6]! : x === 0 || x === 7 ? W[2]! : y % 3 === 2 ? W[3]! : W[4]!);
  return b;
}

/** La zanca de la de caracol: tablas en vertical, con el canto de arriba claro. */
export function stringerTex(): PixelBuffer {
  const b = new PixelBuffer(6, 7);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 6; x++)
      b.set(x, y, y === 0 ? W[5]! : y === 6 ? W[1]! : x % 3 === 0 ? W[2]! : W[3]!);
  return b;
}

/** Faroles colgados bajo la galería (alumbran la barra). */
function lampLow(): PixelBuffer {
  return Prop.piece(
    7,
    12,
    (p) => {
      p.vline(3, 0, 4, P.black);
      p.rect(1, 4, 5, 7, P.black);
      p.rect(2, 5, 3, 5, P.gold);
      p.set(3, 6, P.lemon);
      p.hline(0, 11, 7, P.black);
    },
    'none',
  );
}

/** Los muebles de la galería: canto, barandilla, pies derechos, mesas y la escalera. */
export function galleryThings(room: Room, g: Gallery, lvl: number, ceiling: number): Thing[] {
  const t: Thing[] = [];
  const ke = scaleAt(EDGE);
  const px = Math.round(g.x1 * ke);
  // El canto: va a ras del suelo de arriba (el suelo, debajo y el extremo los pone la escena).
  const fa = fascia(px, Math.round(DECK * ke));
  t.push({ img: fa, x: g.x1 / 2, z: EDGE, y: PITCH - fa.h / ke, mat: 'madera' });
  const kr = scaleAt(EDGE + 1);
  const ra = railing(Math.round(g.x1 * kr));
  t.push({ img: ra, x: g.x1 / 2, z: EDGE + 1, y: PITCH });
  const kp = scaleAt(EDGE + 2);
  const ph = Math.round((PITCH - DECK) * kp) + 1;
  for (const x of g.posts)
    t.push({ img: post(ph), x, z: EDGE + 2, y: 0, box: true, thick: 5, mat: 'madera', dim: 0.8 });
  // Bajo la galería, dos faroles colgados de las viguetas, que alumbran la barra.
  for (const x of [40, g.x1 * 0.62])
    t.push({
      img: lampLow(),
      x,
      z: EDGE + 6,
      y: ceiling - (PITCH - DECK),
      hang: true,
      light: { dy: 3, r: 46, color: [255, 190, 110], power: 0.55, flicker: 0.08 },
    });
  // Las mesas de arriba (con manteles desde el nivel 3, como abajo).
  g.tables.forEach(({ x, z }, i) => {
    t.push({
      img: tableSet(`${room.id}-g${i}`, lvl >= 3 ? cloth(room, VINO) : undefined, lvl >= 2, false),
      x,
      z,
      y: PITCH,
      light: lvl >= 2 ? { dy: 18, r: 34, color: CANDLE, power: 0.45, flicker: 0.12 } : undefined,
    });
    t.push({ img: Prop.stool(), x: x - 18, z: z - 2, y: PITCH });
    t.push({ img: Prop.stool(), x: x + 18, z: z + 2, y: PITCH });
  });
  const sp = spiralPost();
  t.push({ img: sp, x: g.axis.x, z: g.axis.z, y: 0, box: true, thick: 3, mat: 'madera' });
  return t;
}

// ---------- Texturas del suelo de la galería ----------

/** El suelo de arriba visto desde arriba: tablas a lo largo (fila 0, junto a la pared). */
export function deckTop(w: number, rows: number): PixelBuffer {
  const b = new PixelBuffer(w, rows);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < w; x++) {
      const seam = (x + (y % 3) * 11) % 23 === 0;
      const c = y % 3 === 2 ? W[2]! : seam ? W[3]! : y % 3 === 0 ? W[5]! : W[4]!;
      b.set(x, y, c);
    }
  // El borde de delante, más claro (el canto gastado).
  for (let x = 0; x < w; x++) b.set(x, rows - 1, W[5]!);
  return b;
}

/** La cara de abajo: tablas oscuras y las viguetas que van de la pared al canto. */
export function deckUnder(w: number, rows: number): PixelBuffer {
  const b = new PixelBuffer(w, rows);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < w; x++) b.set(x, y, x % 7 === 0 ? P.black : y % 2 ? W[1]! : W[2]!);
  for (let x = 6; x < w - 4; x += 14 * (1 / scaleAt(EDGE))) {
    const xx = Math.round(x);
    for (let y = 0; y < rows; y++) {
      b.set(xx, y, W[3]!);
      b.set(xx + 1, y, W[3]!);
      b.set(xx + 2, y, W[1]!);
    }
  }
  return b;
}

/** El extremo del suelo de la galería (lo que se ve al mirar desde el lado de la escalera). */
export function deckEnd(rows: number, h: number): PixelBuffer {
  const b = new PixelBuffer(rows, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows; x++)
      b.set(x, y, y === 0 ? W[5]! : y === h - 1 ? W[1]! : x % 4 === 0 ? W[2]! : W[3]!);
  return b;
}

// ---------- Sombra bajo la galería ----------

/** Oscurece un color (ABGR) por `k`. */
const dark = (c: number, k: number) => {
  if (!(c >>> 24)) return c;
  const r = Math.round((c & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const bl = Math.round(((c >> 16) & 255) * k);
  return ((c & 0xff000000) | (bl << 16) | (g << 8) | r) >>> 0;
};

/**
 * La sombra de la galería en la pared del fondo (`back`, a la escala del fondo, para una sala de
 * `w` × `h` por dentro): bajo el suelo de arriba, más oscura junto a él.
 */
export function shadeWall(back: PixelBuffer, g: Gallery, h: number): void {
  const x1 = Math.round(g.x1 * BACK);
  const top = Math.round((h - (PITCH - DECK)) * BACK);
  for (let y = top; y < back.h; y++) {
    const t = (y - top) / Math.max(1, back.h - top);
    for (let x = 0; x < Math.min(back.w, x1 + 6); x++) {
      // Hacia el extremo de la galería, se aclara (la luz entra de lado).
      const edge = Math.max(0, Math.min(1, (x1 + 6 - x) / 10));
      const k = 1 - (0.55 - 0.25 * t) * edge;
      back.set(x, y, dark(back.get(x, y), k));
    }
  }
  // Y una línea más oscura justo debajo (donde el suelo toca la pared).
  for (let x = 0; x < Math.min(back.w, x1); x++)
    for (let d = 0; d < 3; d++) back.set(x, top + d, dark(back.get(x, top + d), 0.55 + d * 0.12));
}

/** La sombra en el suelo del salón (`tex`, con la fila 0 junto a la pared del fondo). */
export function shadeFloor(tex: PixelBuffer, g: Gallery): void {
  const rows = Math.round(((DEPTH - EDGE) / DEPTH) * tex.h);
  for (let y = 0; y < Math.min(tex.h, rows + 2); y++) {
    const soft = y >= rows ? 0.5 : 1;
    for (let x = 0; x < Math.min(tex.w, Math.round(g.x1) + 4); x++) {
      const edge = Math.max(0, Math.min(1, (g.x1 + 4 - x) / 8));
      tex.set(x, y, dark(tex.get(x, y), 1 - 0.45 * soft * edge));
    }
  }
}
