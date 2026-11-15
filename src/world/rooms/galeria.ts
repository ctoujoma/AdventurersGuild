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
export const SPIRAL_R = 20;
const SPIRAL_Z = 40;
const WALK_R = 13;
/** Lo que gira cada peldaño (en grados) y su medio ancho en radianes. */
export const TURN = 24;
export const HALF = ((TURN / 2) * Math.PI) / 180;
/**
 * Lo que se achata la vuelta vista un poco desde arriba (como las mesas redondas): la huella de
 * los peldaños de delante se ve entera y la de los de los lados, de canto.
 */
const FLAT = 0.3;

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
    // (Más bajo delante y más alto detrás: la huella se dibuja vista un poco desde arriba.)
    const y = i * RISE - WALK_R * Math.cos(a) * FLAT;
    return { x: cx + WALK_R * Math.sin(a), y, z: SPIRAL_Z - WALK_R * Math.cos(a) };
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

/**
 * Cómo se ve a quien pisa un tramo de la escalera: de lado, de tres cuartos (de espaldas o de
 * frente con la cabeza vuelta), de espaldas o de frente; y hacia qué lado mira (1, derecha).
 */
export interface StepView {
  view: 'side' | 'back3' | 'back' | 'front3' | 'front';
  dir: 1 | -1;
}

/**
 * La vista de quien va del peldaño `p` al `q` (subiendo; al bajar, al revés), según el ángulo de
 * lo que avanza en el suelo: si se aleja de la cámara, de espaldas; si viene hacia ella, de
 * frente; en medio, de tres cuartos; y si va de lado a lado, de perfil.
 */
export function stepView(
  p: { x: number; z: number },
  q: { x: number; z: number },
  up: boolean,
): StepView {
  const k = up ? 1 : -1;
  const dx = (q.x - p.x) * k;
  const dz = (q.z - p.z) * k;
  const deg = (Math.atan2(Math.abs(dz), Math.abs(dx)) * 180) / Math.PI;
  const dir = dx >= 0 ? 1 : -1;
  if (deg <= 30) return { view: 'side', dir };
  if (deg >= 66) return { view: dz > 0 ? 'back' : 'front', dir };
  return { view: dz > 0 ? 'back3' : 'front3', dir };
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
  return Prop.piece(5, h, (b) => {
    b.rect(1, 3, 3, h - 3, W[2]!);
    b.vline(1, 3, h - 3, W[4]!);
    b.vline(3, 3, h - 3, W[1]!);
    b.rect(0, 0, 5, 3, W[4]!);
    b.hline(0, 0, 5, W[6]!);
    b.rect(0, h - 3, 5, 3, P.steel);
  });
}

/** Un tramo dibujado de la de caracol: su dibujo, a qué fondo va y dónde cae el eje en él. */
export interface SpiralPiece {
  img: PixelBuffer;
  z: number;
  /** El eje, a la altura de la huella del peldaño, en píxeles del dibujo. */
  ox: number;
  oy: number;
  /** Alto de esa huella sobre el suelo del salón. */
  h: number;
}

/**
 * El peldaño `i` de la de caracol con su tramo de zanca, de barrote y de pasamanos, dibujado como
 * pixel art (la vuelta, algo achatada: vista un poco desde arriba). Cada uno va a su fondo: los
 * de delante del eje, por delante de quien sube; los de detrás, por detrás (y el eje los tapa).
 * Peldaño en cuña: la huella clara con su canto de delante más claro aún, y debajo el grueso de
 * la tabla, oscuro (de lado solo se ve eso: el canto fino). La zanca, una cinta continua por
 * fuera (por delante se le ve la cara; por detrás, la de dentro, oscura), y el pasamanos.
 * `x1` es el extremo de la galería respecto al eje (el último tramo del pasamanos llega a ella).
 */
export function spiralPiece(i: number, x1: number): SpiralPiece {
  const a = spiralAngle(i);
  const front = Math.cos(a);
  const z = SPIRAL_Z - SPIRAL_R * 0.8 * front - (front >= 0 ? 1 : -1);
  const k = scaleAt(z);
  const R0 = SPIRAL_R;
  const turn = (TURN * Math.PI) / 180;
  const last = i === GAL_STEPS - 1;
  const left = last ? Math.min(-R0, x1) - 2 : -R0 - 2;
  const ox = Math.ceil(-left * k) + 1;
  const oy = Math.ceil(22 * k);
  const w = ox + Math.ceil((R0 + 2) * k) + 1;
  const h = oy + Math.ceil((R0 * FLAT + 12) * k);
  const b = new PixelBuffer(w, h);
  // Un punto de la vuelta (radio, ángulo, alto sobre la huella) en píxeles del dibujo.
  const P = (r: number, f: number, up: number) => ({
    x: ox + r * Math.sin(f) * k,
    y: oy + (r * Math.cos(f) * FLAT - up) * k,
  });
  const set = (x: number, y: number, c: string) => {
    const [px, py] = [Math.round(x), Math.round(y)];
    if (px >= 0 && py >= 0 && px < w && py < h) b.set(px, py, c);
  };
  const [f0, f1] = [a - HALF, a + HALF];
  // La zanca: de la mitad del peldaño de antes a la del de después, por debajo de las huellas.
  const along = (f: number) => (RISE * (f - a)) / turn;
  for (let s = 0; s <= 40; s++) {
    const f = f0 - HALF * 0.1 + ((f1 - f0 + HALF * 0.2) * s) / 40;
    const p = P(R0, f, along(f) - 1);
    const out = Math.cos(f) >= -0.05;
    const band = Math.round(7 * k);
    for (let d = 0; d <= band; d++)
      set(
        p.x,
        p.y + d,
        d === 0
          ? out
            ? W[5]!
            : W[3]!
          : d === band
            ? W[0]!
            : out
              ? d < 3
                ? W[4]!
                : W[3]!
              : W[1]!,
      );
  }
  // El peldaño: el grueso (oscuro) y encima la huella, cuña del eje a la zanca.
  const inWedge = (px: number, py: number) => {
    const X = (px - ox) / k;
    const Zc = (py - oy) / k / FLAT;
    const r = Math.hypot(X, Zc);
    const f = Math.atan2(X, Zc);
    let df = f - a;
    while (df > Math.PI) df -= 2 * Math.PI;
    while (df < -Math.PI) df += 2 * Math.PI;
    return r >= 1.5 && r <= R0 - 0.3 && Math.abs(df) <= HALF ? df : null;
  };
  const thick = Math.max(2, Math.round(3 * k));
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      for (let t = thick; t >= 1; t--)
        if (inWedge(px, py - t) !== null) {
          b.set(px, py, t === thick ? W[1]! : W[2]!);
          break;
        }
    }
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const df = inWedge(px, py);
      if (df === null) continue;
      // El canto de delante (por donde se sube), claro; la veta, a lo largo.
      const nose = df < -HALF + 0.12;
      b.set(px, py, nose ? W[6]! : (px + py * 2) % 7 === 0 ? W[4]! : W[5]!);
    }
  // El barrote, en la punta del peldaño, y el pasamanos (más oscuro por detrás).
  const side = front >= -0.05;
  const foot = P(R0 - 1, a, 0);
  const top = P(R0 - 1, a, 15);
  for (let y = Math.round(top.y); y <= Math.round(foot.y); y++) {
    set(foot.x, y, side ? W[4]! : W[2]!);
    set(foot.x + 1, y, side ? W[2]! : W[1]!);
  }
  for (let s = 0; s <= 30; s++) {
    const f = f0 - HALF * 0.1 + ((f1 - f0 + HALF * 0.2) * s) / 30;
    const p = P(R0 - 1, f, along(f) + 15);
    const lit = Math.cos(f) >= -0.05;
    set(p.x, p.y, lit ? W[6]! : W[3]!);
    set(p.x, p.y + 1, lit ? W[3]! : W[1]!);
  }
  if (last) {
    // Hasta la barandilla de la galería (su pilar del final).
    const from = P(R0 - 1, f1, along(f1) + 15);
    const to = { x: ox + x1 * k, y: oy - (PITCH + 13 - i * RISE) * k };
    b.line(Math.round(from.x), Math.round(from.y), Math.round(to.x), Math.round(to.y), W[5]!);
    b.line(
      Math.round(from.x),
      Math.round(from.y) + 1,
      Math.round(to.x),
      Math.round(to.y) + 1,
      W[2]!,
    );
  }
  return { img: b, z, ox, oy, h: i * RISE };
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
