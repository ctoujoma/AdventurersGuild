import type { BossKind } from '../data/bosses';
import { P, darker } from './palette';
import { PixelBuffer, alpha, bayer, rampAt, toHex } from './pixel';

/**
 * Los jefes de las historias, grandes y dibujados a mano en código: la bestia de Hondogrís
 * (un jabalí del tamaño de un carro), el Rey Ahogado (un gigante con corona y ancla), la
 * sierpe de Sierra Parda (con alas, cuernos y fuego) y los tres de las historias nuevas: el
 * jabalí de ceniza (brasas en las grietas y humo), la Reina de la Cripta (de hueso, con corona y
 * cetro) y la dragona de la Corona Blanca (de hielo, con corona de cuernos). Miran a la derecha;
 * la pelea los voltea. Cada pose es un búfer aparte con contorno.
 */

export type BossPose = 'ready' | 'windup' | 'strike' | 'up' | 'thrust' | 'down';

export interface BossArt {
  poses: Record<BossPose, PixelBuffer>;
  /** Dónde pisa dentro del sprite: centro de los pies y fila del suelo. */
  foot: { x: number; y: number };
  /** Lo mismo para la pose de caído (tumbado, apoya en otra fila). */
  downFoot: { x: number; y: number };
  /** Cómo muere: 'sink' se lo traga el agua; si no, se encabrita y cae en su pose de caído. */
  fall?: 'sink';
  /** Altura del pecho sobre el suelo (donde se apuntan los golpes). */
  chest: number;
  /** Boca o arma respecto a los pies, mirando a la derecha, en cada pose. */
  mouth: Record<BossPose, { x: number; y: number }>;
  /** Hasta dónde llega el cuerpo por delante: ahí se plantan los que pelean cuerpo a cuerpo. */
  reach: number;
}

const outline = (b: PixelBuffer) => b.outlined((n) => darker(toHex(n), 3));

// ---------------------------------------------------------------------------------------
// La bestia de Hondogrís: jabalí enorme, cerdas de punta, colmillos y ojos rojos.
// ---------------------------------------------------------------------------------------

interface BeastPose {
  head: [number, number];
  body: number;
  jaw: number;
  lift: number;
  down?: boolean;
}

/** El pelaje y lo propio de cada jabalí (la bestia de siempre o el de ceniza). */
interface BeastLook {
  fur: readonly string[];
  /** Raya del lomo, hocico (arriba y abajo), patas (claro y oscuro) y ojo (y su brillo). */
  stripe: string;
  snout: [string, string];
  legs: [string, string];
  eye: [string, string];
  /** El de ceniza: grietas de brasa en el cuerpo, cerdas encendidas y humo. */
  embers?: boolean;
}

const FUR = [P.black, P.ebony, P.plum, P.umber, P.mocha, P.cocoa];
const BEAST: BeastLook = {
  fur: FUR,
  stripe: P.cocoa,
  snout: [P.clay, P.skinS],
  legs: [P.plum, P.ebony],
  eye: [P.red, P.hot],
};
/** El jabalí de ceniza: gris como lo quemado, con las brasas vivas en las grietas. */
const ASH: BeastLook = {
  fur: [P.black, P.navy, P.slate, P.steel, P.fog],
  stripe: P.mist,
  snout: [P.steel, P.slate],
  legs: [P.slate, P.navy],
  eye: [P.orange, P.lemon],
  embers: true,
};

/** Una grieta de brasa: línea quebrada naranja con el centro dorado. */
function crack(b: PixelBuffer, pts: readonly [number, number][], dim: boolean): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    b.line(x0, y0 + 1, x1, y1 + 1, dim ? P.plum : P.brick);
    b.line(x0, y0, x1, y1, dim ? P.rust : P.orange);
    if (!dim) b.set(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), P.gold);
  }
}

function beast(o: BeastPose, L: BeastLook = BEAST): PixelBuffer {
  const FUR = L.fur;
  const b = new PixelBuffer(62, 44);
  const g = 41; // suelo
  const [hx, hy] = o.head;
  const by = o.body;
  const shade = (y: number, top: number, h: number) => 1 - (y - top) / h;
  if (o.down) {
    // Tumbada de lado: patas hacia delante, la lengua fuera.
    for (const [x0, x1] of [
      [10, 4],
      [18, 12],
      [34, 44],
      [40, 52],
    ] as const) {
      b.line(x0, g - 6, x1, g - 2, L.legs[1]);
      b.line(x0, g - 5, x1, g - 1, L.legs[1]);
      b.set(x1, g - 1, P.black);
    }
    b.ellipse(26, g - 10, 21, 9, (x, y) => rampAt(FUR, 0.25 + shade(y, g - 19, 18) * 0.6, x, y));
    for (let x = 9; x < 42; x += 3) b.line(x, g - 18, x - 1, g - 21, L.legs[1]);
    if (L.embers)
      crack(
        b,
        [
          [12, g - 12],
          [18, g - 9],
          [24, g - 13],
          [31, g - 8],
          [37, g - 11],
        ],
        true,
      );
    b.ellipse(48, g - 7, 8, 6, (x, y) => rampAt(FUR, 0.3 + shade(y, g - 13, 12) * 0.5, x, y));
    b.ellipse(55, g - 5, 4, 3, L.snout[1]);
    b.line(52, g - 2, 55, g - 3, P.sand);
    b.set(56, g - 4, P.white);
    b.hline(46, g - 9, 3, P.black); // ojo cerrado
    b.rect(56, g - 2, 2, 2, P.coral);
    return outline(b);
  }
  // Patas: las de delante se levantan al embestir o al encabritarse.
  const legs: [number, number][] = [
    [14, 0],
    [20, 0],
    [36, o.lift],
    [42, o.lift],
  ];
  for (const [lx, up] of legs) {
    b.rect(lx - 2, by + 8, 5, g - by - 9 - up, L.legs[1]);
    b.rect(lx - 1, by + 8, 2, g - by - 10 - up, L.legs[0]);
    b.rect(lx - 2, g - 2 - up, 5, 2, P.black);
  }
  // Cuerpo con la joroba de los hombros y una raya clara por el lomo.
  b.ellipse(25, by, 21, 12, (x, y) => rampAt(FUR, 0.15 + shade(y, by - 12, 24) * 0.75, x, y));
  b.ellipse(36, by - 4, 12, 11, (x, y) => rampAt(FUR, 0.2 + shade(y, by - 15, 22) * 0.75, x, y));
  for (let x = 10; x < 44; x++) {
    const top = Math.round(by - 11 - Math.sin(((x - 10) / 34) * Math.PI) * 4);
    if (bayer(x, 0) < 0.6) b.set(x, top + 2, L.stripe);
  }
  // El de ceniza: grietas de brasa por el costado y la paletilla, como la tierra quemada.
  if (L.embers) {
    const cracks: [number, number][][] = [
      [
        [8, by - 1],
        [12, by + 3],
        [17, by + 1],
        [20, by + 5],
        [27, by + 2],
        [33, by + 4],
      ],
      [
        [17, by + 1],
        [19, by - 4],
      ],
      [
        [31, by - 10],
        [33, by - 6],
        [38, by - 7],
        [42, by - 2],
      ],
      [
        [12, by + 8],
        [18, by + 10],
        [22, by + 8],
      ],
    ];
    for (const c of cracks) crack(b, c, false);
  }
  // Cerdas de punta (en el de ceniza, más largas y con la punta encendida).
  for (let x = 8; x < 46; x += 2) {
    const top = Math.round(by - 11 - Math.sin(((x - 8) / 38) * Math.PI) * 5);
    const len = 2 + ((x * 7) % 3) + (L.embers ? 2 : 0);
    b.line(x, top, x - 1, top - len, x % 4 ? L.legs[1] : P.black);
    if (L.embers) b.set(x - 1, top - len, x % 6 ? P.orange : P.lemon);
  }
  // Rabo.
  b.line(4, by - 4, 1, by - 7, L.legs[1]);
  b.set(0, by - 8, P.black);
  // Cabeza, hocico y boca.
  b.ellipse(hx, hy, 9, 7.5, (x, y) => rampAt(FUR, 0.25 + shade(y, hy - 7, 15) * 0.6, x, y));
  b.poly(
    [
      [hx - 2, hy - 7],
      [hx + 1, hy - 12],
      [hx + 3, hy - 6],
    ],
    L.embers ? P.slate : P.umber,
  );
  if (L.embers) b.set(hx + 1, hy - 11, P.orange);
  b.ellipse(hx + 8, hy + 2, 4.5, 4, (_x, y) => (y < hy + 1 ? L.snout[0] : L.snout[1]));
  b.set(hx + 10, hy + 1, P.plum);
  b.set(hx + 10, hy + 3, P.plum);
  if (o.jaw > 0) {
    b.poly(
      [
        [hx + 1, hy + 4],
        [hx + 11, hy + 5],
        [hx + 9, hy + 5 + o.jaw],
      ],
      P.wine,
    );
    b.hline(hx + 3, hy + 5, 6, P.red);
  }
  // Colmillo: sale de la mandíbula por debajo del hocico y se curva hacia arriba por delante.
  for (const [x, y, c] of [
    [hx + 5, hy + 6, P.sand],
    [hx + 6, hy + 7, P.sand],
    [hx + 7, hy + 7, P.sand],
    [hx + 8, hy + 7, P.sand],
    [hx + 9, hy + 7, P.sand],
    [hx + 10, hy + 6, P.sand],
    [hx + 11, hy + 6, P.white],
    [hx + 12, hy + 5, P.white],
    [hx + 7, hy + 8, P.tan],
    [hx + 8, hy + 8, P.tan],
    [hx + 9, hy + 8, P.tan],
  ] as const)
    b.set(x, y, c);
  // El de ceniza: un segundo colmillo, más corto, por encima del primero.
  if (L.embers) {
    b.set(hx + 9, hy + 4, P.sand);
    b.set(hx + 10, hy + 3, P.sand);
    b.set(hx + 11, hy + 2, P.white);
  }
  // Ojo con brillo (rojo en la bestia; de brasa en el de ceniza).
  b.rect(hx + 2, hy - 3, 2, 2, L.eye[0]);
  b.set(hx + 3, hy - 3, L.eye[1]);
  const out = outline(b);
  if (L.embers) smoke(out, by, o.jaw);
  return out;
}

/**
 * El humo del lomo del jabalí de ceniza: bocanadas tramadas que suben, sin contorno y solo
 * donde no hay dibujo (distintas en cada pose). En el búfer ya contorneado (+1 de margen).
 */
function smoke(b: PixelBuffer, by: number, seed: number): void {
  for (let i = 0; i < 4; i++) {
    const sx = 15 + i * 9 + (seed % 3);
    const sy = by - 19 - (i % 2) * 3;
    for (let y = sy - 3; y <= sy + 3; y++)
      for (let x = sx - 4; x <= sx + 4; x++) {
        const d = ((x - sx) / 4) ** 2 + ((y - sy) / 2.5) ** 2;
        if (d > 1 || alpha(b.get(x, y)) || bayer(x, y) > 0.5 - d * 0.3) continue;
        b.set(x, y, y < sy ? P.fog : P.steel);
      }
  }
}

function beastArt(L: BeastLook = BEAST): Omit<BossArt, 'downFoot'> {
  const poses: Record<BossPose, PixelBuffer> = {
    ready: beast({ head: [46, 26], body: 24, jaw: 0, lift: 0 }, L),
    windup: beast({ head: [44, 30], body: 26, jaw: 0, lift: 0 }, L),
    strike: beast({ head: [49, 23], body: 24, jaw: 4, lift: 3 }, L),
    thrust: beast({ head: [50, 28], body: 25, jaw: 2, lift: 0 }, L),
    up: beast({ head: [47, 16], body: 21, jaw: 6, lift: 7 }, L),
    down: beast({ head: [0, 0], body: 0, jaw: 0, lift: 0, down: true }, L),
  };
  const m = (x: number, y: number) => ({ x: x - 27, y: y - 42 });
  return {
    poses,
    foot: { x: 27, y: 42 },
    chest: 18,
    mouth: {
      ready: m(56, 28),
      windup: m(54, 32),
      strike: m(59, 26),
      thrust: m(60, 30),
      up: m(57, 19),
      down: m(57, 38),
    },
    reach: 22,
  };
}

// ---------------------------------------------------------------------------------------
// El Rey Ahogado: gigante pálido y verdoso, corona, capa hecha jirones, algas y un ancla.
// ---------------------------------------------------------------------------------------

const DROWNED = [P.deep, P.forest, P.steel, P.fog];
const CLOAK = [P.black, P.navy, P.slate];

interface KingPose {
  /** Mano del ancla y punta del ancla. */
  hand: [number, number];
  tip: [number, number];
  /** Brazo libre: mano. */
  free: [number, number];
  lean: number;
}

function anchor(b: PixelBuffer, hx: number, hy: number, tx: number, ty: number): void {
  // Caña del ancla de la mano a la punta, con la cruz y los brazos en la punta.
  const len = Math.hypot(tx - hx, ty - hy);
  const ux = (tx - hx) / len;
  const uy = (ty - hy) / len;
  for (let i = -3; i <= len; i++) {
    const x = hx + ux * i;
    const y = hy + uy * i;
    b.set(Math.round(x), Math.round(y), P.slate);
    b.set(Math.round(x - uy), Math.round(y + ux), i % 5 ? P.steel : P.rust);
  }
  // Argolla arriba.
  const rx = hx - ux * 5;
  const ry = hy - uy * 5;
  b.ellipse(rx, ry, 2.2, 2.2, P.steel);
  b.set(Math.round(rx), Math.round(ry), 0);
  // Brazos curvos en la punta.
  const px = -uy;
  const py = ux;
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k <= 7; k++) {
      const bx = tx + px * s * k - ux * (k * k * 0.12);
      const by = ty + py * s * k - uy * (k * k * 0.12);
      b.set(Math.round(bx), Math.round(by), k > 5 ? P.mist : P.steel);
      b.set(Math.round(bx - ux), Math.round(by - uy), P.slate);
    }
  }
  b.set(Math.round(tx + ux), Math.round(ty + uy), P.rust);
}

/** Brazo grueso de hombro a mano, con el puño. */
function limb(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number): void {
  for (const [dx, dy, c] of [
    [0, 1, P.slate],
    [0, 0, P.steel],
    [1, 0, P.steel],
    [0, -1, P.fog],
  ] as const)
    b.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, c);
  b.ellipse(x1 + 0.5, y1 + 0.5, 2.6, 2.6, (x, y) => (x + y < x1 + y1 ? P.fog : P.steel));
}

function king(o: KingPose, down = false): PixelBuffer {
  const b = new PixelBuffer(60, 74);
  const g = 71;
  const cx = 26 + o.lean;
  const skin = (x: number, y: number, t: number) => rampAt(DROWNED, t, x, y);
  // Piernas y pies descalzos.
  for (const lx of [cx - 5, cx + 3]) {
    b.rect(lx, g - 18, 5, 17, P.slate);
    b.rect(lx + 1, g - 18, 2, 16, P.steel);
    b.rect(lx - 1, g - 2, 7, 2, P.deep);
  }
  // Capa: trapecio con el bajo deshilachado.
  b.poly(
    [
      [cx - 9, 24],
      [cx + 9, 24],
      [cx + 14, g - 12],
      [cx - 15, g - 12],
    ],
    (x, y) => rampAt(CLOAK, 0.2 + (x - (cx - 15)) / 40, x, y),
  );
  for (let x = cx - 15; x < cx + 15; x++) {
    const rag = (x * 13) % 7;
    for (let y = g - 12; y < g - 12 + rag; y++) b.set(x, y, x % 3 ? P.navy : P.black);
  }
  // Algas colgando de la capa.
  for (const [x, len] of [
    [cx - 11, 14],
    [cx - 3, 9],
    [cx + 8, 12],
  ] as const)
    for (let i = 0; i < len; i++)
      b.set(x + Math.round(Math.sin(i * 0.8) * 1.2), 32 + i * 2, i % 2 ? P.leaf : P.forest);
  // Torso pálido con costillas.
  b.ellipse(cx, 30, 8, 9, (x, y) => skin(x, y, 0.7 + (cx - x) * 0.03 + (30 - y) * 0.02));
  for (let r = 0; r < 3; r++) b.hline(cx - 5, 29 + r * 3, 4, P.steel);
  // Brazo libre.
  limb(b, cx - 7, 24, o.free[0], o.free[1]);
  // Cabeza: cuencas oscuras con ojos que brillan y barba de algas.
  b.ellipse(cx + 1, 14, 6, 7, (x, y) => skin(x, y, 0.8 + (cx - x) * 0.04 + (14 - y) * 0.03));
  b.rect(cx - 1, 11, 3, 3, P.deep);
  b.rect(cx + 3, 11, 3, 3, P.deep);
  b.rect(cx, 12, 2, 2, P.cyan);
  b.rect(cx + 4, 12, 2, 2, P.cyan);
  b.set(cx + 1, 12, P.white);
  b.set(cx + 5, 12, P.white);
  b.hline(cx + 1, 17, 4, P.deep);
  for (let i = 0; i < 6; i++) {
    const x = cx - 3 + i * 1.6;
    const len = 4 + ((i * 5) % 4);
    for (let y = 18; y < 18 + len; y++)
      b.set(Math.round(x + Math.sin(y) * 0.6), y, i % 2 ? P.forest : P.leaf);
  }
  // Corona.
  b.rect(cx - 5, 6, 12, 3, P.gold);
  b.hline(cx - 5, 8, 12, P.rust);
  for (const x of [cx - 5, cx - 1, cx + 3, cx + 6])
    b.poly(
      [
        [x, 6],
        [x + 1.5, 1],
        [x + 3, 6],
      ],
      P.gold,
    );
  b.set(cx + 1, 7, P.cyan);
  b.set(cx - 3, 7, P.wine);
  // Brazo del ancla y el ancla.
  anchor(b, o.hand[0], o.hand[1], o.tip[0], o.tip[1]);
  limb(b, cx + 6, 24, o.hand[0], o.hand[1]);
  const out = outline(b);
  if (!down) return out;
  // Caído: el mismo dibujo tumbado de espaldas.
  const lay = new PixelBuffer(out.h, out.w);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const c = out.get(x, y);
      if (c) lay.data[(out.w - 1 - x) * lay.w + y] = c;
    }
  return lay;
}

function kingArt(): Omit<BossArt, 'downFoot'> {
  const ready = { hand: [39, 40], tip: [44, 66], free: [17, 40], lean: 0 } as KingPose;
  const poses: Record<BossPose, PixelBuffer> = {
    ready: king(ready),
    windup: king({ hand: [14, 30], tip: [4, 54], free: [12, 40], lean: -2 }),
    strike: king({ hand: [44, 34], tip: [56, 56], free: [16, 38], lean: 3 }),
    thrust: king({ hand: [44, 30], tip: [57, 40], free: [15, 36], lean: 2 }),
    up: king({ hand: [38, 12], tip: [44, 2], free: [12, 12], lean: 0 }),
    down: king(ready, true),
  };
  const m = (x: number, y: number) => ({ x: x - 27, y: y - 72 });
  return {
    poses,
    foot: { x: 27, y: 72 },
    chest: 32,
    mouth: {
      ready: m(44, 66),
      windup: m(4, 54),
      strike: m(56, 58),
      thrust: m(57, 40),
      up: m(44, 2),
      down: m(40, 70),
    },
    reach: 16,
    fall: 'sink',
  };
}

// ---------------------------------------------------------------------------------------
// La Reina de la Cripta: reina muerta, de hueso, con corona alta, gola, vestido morado hecho
// jirones, velo negro y un cetro con un orbe que brilla. Las mismas posturas que el Rey
// Ahogado (el cetro va donde él lleva el ancla), pero no se hunde: se desploma.
// ---------------------------------------------------------------------------------------

const BONE = [P.slate, P.steel, P.fog, P.mist];
const GOWN = [P.black, P.plum, P.grape, P.rose];
const VEIL = [P.black, P.navy, P.slate];

/** Brazo de hueso, fino, del hombro a la mano, con los dedos en garra. */
function boneArm(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number): void {
  b.line(x0, y0 + 1, x1, y1 + 1, P.steel);
  b.line(x0, y0, x1, y1, P.mist);
  // Codo: un nudo a medio camino.
  b.set(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), P.fog);
  for (const [dx, dy] of [
    [-1, 1],
    [0, 2],
    [1, 2],
    [2, 1],
  ] as const)
    b.set(x1 + dx, y1 + dy, P.fog);
}

/** El cetro: caña dorada de la mano a la punta, con el orbe que brilla en la punta. */
function scepter(b: PixelBuffer, hx: number, hy: number, tx: number, ty: number): void {
  const len = Math.hypot(tx - hx, ty - hy);
  const ux = (tx - hx) / len;
  const uy = (ty - hy) / len;
  for (let i = -4; i <= len - 3; i++) {
    const x = Math.round(hx + ux * i);
    const y = Math.round(hy + uy * i);
    b.set(x, y, i % 6 === 0 ? P.orange : P.gold);
    b.set(Math.round(x - uy), Math.round(y + ux), P.rust);
  }
  // Las alas de oro que sujetan el orbe y el orbe, con su brillo.
  const px = -uy;
  const py = ux;
  for (const s of [-1, 1])
    b.line(tx - ux * 3, ty - uy * 3, tx - ux * 5 + px * s * 4, ty - uy * 5 + py * s * 4, P.gold);
  b.ellipse(tx, ty, 3.2, 3.2, (x, y) =>
    (x - tx) * -0.6 + (y - ty) * -0.6 > 0.8 ? P.coral : P.rose,
  );
  b.set(Math.round(tx - 1), Math.round(ty - 1), P.white);
}

function queen(o: KingPose, down = false): PixelBuffer {
  const b = new PixelBuffer(60, 74);
  const g = 71;
  const cx = 26 + o.lean;
  // El velo negro por la espalda, del pelo hasta la cintura.
  b.poly(
    [
      [cx - 5, 7],
      [cx + 3, 7],
      [cx - 3, 46],
      [cx - 14, 48],
    ],
    (x, y) => rampAt(VEIL, 0.15 + (x - (cx - 14)) / 30, x, y),
  );
  // El vestido: campana desde la cintura hasta el suelo, con pliegues y el bajo a jirones.
  b.poly(
    [
      [cx - 6, 33],
      [cx + 6, 33],
      [cx + 16, g],
      [cx - 17, g],
    ],
    (x, y) => {
      const fold = (x - cx + 40) % 5 === 0 ? -0.25 : 0;
      return rampAt(GOWN, 0.25 + (x - (cx - 17)) / 44 + fold, x, y);
    },
  );
  for (let x = cx - 17; x <= cx + 16; x++) {
    const rag = (x * 7) % 5;
    for (let y = g - rag; y <= g; y++) b.set(x, y, 0);
    // El ribete de oro, por encima de los jirones.
    if (x % 2 === 0) b.set(x, g - 6, P.gold);
  }
  // Corpiño, cinturón de oro y la gola blanca por detrás de la cabeza.
  b.rect(cx - 5, 22, 11, 12, P.plum);
  b.rect(cx - 2, 23, 5, 10, P.grape);
  b.hline(cx - 6, 33, 13, P.gold);
  b.set(cx, 33, P.cyan);
  b.poly(
    [
      [cx - 8, 13],
      [cx + 9, 13],
      [cx + 6, 22],
      [cx - 5, 22],
    ],
    (x, y) => ((x + y) % 3 === 0 ? P.fog : P.mist),
  );
  // Brazo libre.
  boneArm(b, cx - 5, 24, o.free[0], o.free[1]);
  // Cabeza: calavera con las cuencas negras y un brillo violeta dentro, y los dientes.
  b.ellipse(cx + 1, 14, 5, 6, (x, y) =>
    rampAt(BONE, 0.85 + (cx - x) * 0.05 + (14 - y) * 0.03, x, y),
  );
  b.rect(cx - 1, 11, 3, 3, P.black);
  b.rect(cx + 3, 11, 3, 3, P.black);
  b.set(cx, 12, P.rose);
  b.set(cx + 4, 12, P.rose);
  b.set(cx + 2, 15, P.slate);
  for (let x = cx; x < cx + 5; x++) b.set(x, 18, x % 2 ? P.mist : P.slate);
  // Corona alta, de cinco puntas, con piedras.
  b.rect(cx - 5, 6, 12, 3, P.gold);
  b.hline(cx - 5, 8, 12, P.rust);
  for (const [x, h] of [
    [cx - 5, 4],
    [cx - 2, 5],
    [cx + 1, 6],
    [cx + 4, 5],
    [cx + 6, 4],
  ] as const)
    b.poly(
      [
        [x - 0.5, 6],
        [x + 0.8, 6 - h],
        [x + 2, 6],
      ],
      P.gold,
    );
  b.set(cx + 2, 1, P.lemon);
  b.set(cx - 3, 7, P.rose);
  b.set(cx + 1, 7, P.cyan);
  b.set(cx + 5, 7, P.rose);
  // Brazo del cetro y el cetro.
  scepter(b, o.hand[0], o.hand[1], o.tip[0], o.tip[1]);
  boneArm(b, cx + 5, 24, o.hand[0], o.hand[1]);
  const out = outline(b);
  if (!down) return out;
  // Caída: el mismo dibujo tumbado de espaldas.
  const lay = new PixelBuffer(out.h, out.w);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const c = out.get(x, y);
      if (c) lay.data[(out.w - 1 - x) * lay.w + y] = c;
    }
  return lay;
}

function queenArt(): Omit<BossArt, 'downFoot'> {
  const king = kingArt();
  const ready = { hand: [39, 40], tip: [44, 62], free: [17, 40], lean: 0 } as KingPose;
  return {
    ...king,
    poses: {
      ready: queen(ready),
      windup: queen({ hand: [14, 30], tip: [6, 52], free: [12, 40], lean: -2 }),
      strike: queen({ hand: [44, 34], tip: [54, 54], free: [16, 38], lean: 3 }),
      thrust: queen({ hand: [44, 30], tip: [55, 40], free: [15, 36], lean: 2 }),
      up: queen({ hand: [38, 12], tip: [43, 4], free: [12, 12], lean: 0 }),
      down: queen(ready, true),
    },
    // No hay agua en la cripta: no se hunde, se desploma.
    fall: undefined,
  };
}

// ---------------------------------------------------------------------------------------
// La sierpe de Sierra Parda: escamas rojizas, vientre claro, alas de murciélago y cuernos.
// ---------------------------------------------------------------------------------------

const SCALES = [P.plum, P.wine, P.brick, P.amber, P.tan];
const WING = [P.ebony, P.plum, P.wine, P.rust];

interface WyrmPose {
  head: [number, number];
  jaw: number;
  /** Altura de las alas (0 plegadas – 1 abiertas). */
  wings: number;
  body: number;
  down?: boolean;
}

/** Las escamas y lo propio de cada sierpe (la de Sierra Parda o la dragona de hielo). */
interface WyrmLook {
  scales: readonly string[];
  wing: readonly string[];
  belly: [string, string];
  /** Huesos de las alas (la de atrás y la de delante). */
  bone: [string, string];
  /** Manchas y patas, la sombra de las de atrás, el empeine, las púas de la cola y la boca. */
  dark: string;
  darker: string;
  mid: string;
  spike: string;
  mouth: string;
  horn: [string, string];
  eye: [string, string];
  /** La dragona de la Corona Blanca: corona de cuernos y carámbanos por el lomo. */
  crown?: boolean;
  icicles?: boolean;
}

const SIERPE: WyrmLook = {
  scales: SCALES,
  wing: WING,
  belly: [P.tan, P.sand],
  bone: [P.ebony, P.bark],
  dark: P.wine,
  darker: P.plum,
  mid: P.brick,
  spike: P.wine,
  mouth: P.red,
  horn: [P.sand, P.tan],
  eye: [P.lemon, P.white],
};
/** La dragona de la Corona Blanca: escamas de hielo, vientre de nieve y alas escarchadas. */
const DRAGONA: WyrmLook = {
  scales: [P.navy, P.ocean, P.steel, P.fog, P.mist],
  wing: [P.navy, P.ocean, P.sky, P.cyan],
  belly: [P.mist, P.white],
  bone: [P.navy, P.slate],
  dark: P.ocean,
  darker: P.navy,
  mid: P.steel,
  spike: P.cyan,
  mouth: P.sky,
  horn: [P.white, P.mist],
  eye: [P.cyan, P.white],
  crown: true,
  icicles: true,
};

function wyrm(o: WyrmPose, L: WyrmLook = SIERPE): PixelBuffer {
  const SCALES = L.scales;
  const WING = L.wing;
  const b = new PixelBuffer(84, 64);
  const g = 61;
  const by = o.body;
  const [hx, hy] = o.head;
  const body = (x: number, y: number, top: number, h: number) =>
    y > top + h * 0.62
      ? bayer(x, y) < 0.5
        ? L.belly[0]
        : L.belly[1]
      : rampAt(SCALES, 0.85 - (y - top) / h, x, y);
  // Alas de murciélago: hueso del brazo, tres dedos y membrana festoneada entre ellos.
  const wing = (rootX: number, span: number, dark: boolean) => {
    const w = new PixelBuffer(b.w, b.h);
    const up = o.wings;
    const root: [number, number] = [rootX, by - 6];
    const hand: [number, number] = [rootX - span * 0.25, by - 18 - up * 20];
    const tips: [number, number][] = [
      [rootX - span * 0.5, by - 22 - up * 22],
      [rootX - span * 0.95, by - 12 - up * 14],
      [rootX - span * 0.92, by - 3 - up * 4],
    ];
    const back: [number, number] = [rootX - span * 0.45, by - 2];
    const edge = [hand, ...tips, back];
    w.poly([root, ...edge], (x, y) => rampAt(WING, (dark ? 0.1 : 0.4) + (y - hand[1]) / 50, x, y));
    // Festón: se recorta un arco entre cada par de puntas (centro algo por fuera del borde).
    for (let i = 1; i + 1 < edge.length; i++) {
      const [ax, ay] = edge[i]!;
      const [bx2, by2] = edge[i + 1]!;
      const mx = (ax + bx2) / 2;
      const my = (ay + by2) / 2;
      const d = Math.hypot(mx - root[0], my - root[1]);
      const r = Math.hypot(bx2 - ax, by2 - ay) * 0.34;
      const ox = ((mx - root[0]) / d) * r * 0.55;
      const oy = ((my - root[1]) / d) * r * 0.55;
      w.ellipse(mx + ox, my + oy, r, r * 0.8, 0);
    }
    // Huesos.
    const bone = dark ? L.bone[0] : L.bone[1];
    w.line(root[0], root[1], hand[0], hand[1], bone);
    w.line(root[0], root[1] - 1, hand[0], hand[1] - 1, bone);
    for (const t of tips) w.line(hand[0], hand[1], t[0], t[1], bone);
    b.blit(w, 0, 0);
  };
  if (!o.down) wing(40, 30, true);
  // Cola con púas, en curva hacia atrás.
  for (let i = 0; i <= 26; i++) {
    const k = i / 26;
    const x = 22 - i;
    const y = by + 4 + Math.sin(k * Math.PI * 1.1) * 7 - (o.down ? -3 : 0);
    const r = 5 * (1 - k) + 1;
    b.ellipse(x, y, r, r * 0.8, (px, py) => body(px, py, y - r, r * 2));
    if (i % 5 === 2) b.line(x, y - r, x - 2, y - r - 3, L.spike);
  }
  // Patas de reptil: muslo recio, espinilla hacia atrás y pie con tres garras. Las del
  // otro lado, más oscuras y un poco desplazadas, dan profundidad.
  const leg = (lx: number, far: boolean) => {
    const dim = far ? 0.3 : 0;
    const kx = lx + 3;
    const ky = by + 11;
    const ax = lx - 1;
    const ay = g - 4;
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const x = kx + (ax - kx) * k;
      const y = ky + (ay - ky) * k;
      b.ellipse(x, y, 2.8 - k * 0.8, 2.4, (px, py) =>
        rampAt(SCALES, 0.6 - dim - k * 0.25 + (px < x ? -0.15 : 0), px, py),
      );
    }
    b.set(kx + 2, ky + 1, far ? L.darker : L.dark);
    b.set(kx + 3, ky + 2, far ? L.darker : L.dark);
    b.ellipse(ax + 2, g - 2.5, 4.5, 2, far ? L.darker : L.dark);
    b.hline(ax, g - 3, 4, far ? L.dark : L.mid);
    for (let c = 0; c < 3; c++) {
      b.set(ax + 4 + c * 2, g - 1, far ? L.horn[1] : L.horn[0]);
      b.set(ax + 5 + c * 2, g - 1, far ? L.horn[1] : P.white);
    }
    b.ellipse(lx, by + 5, 6, 7.5, (x, y) => rampAt(SCALES, 0.75 - dim - (y - by) / 22, x, y));
  };
  if (!o.down) {
    leg(29, true);
    leg(47, true);
    leg(25, false);
    leg(43, false);
  }
  // Cuerpo.
  b.ellipse(34, by, 17, 10, (x, y) => body(x, y, by - 10, 20));
  // La dragona de hielo: carámbanos por el lomo.
  if (L.icicles && !o.down)
    for (let x = 22; x <= 46; x += 4) {
      const top = Math.round(by - 9 - Math.sin(((x - 18) / 32) * Math.PI) * 1.5);
      const h = 3 + ((x * 3) % 3);
      b.line(x, top, x, top - h, P.cyan);
      b.line(x + 1, top, x + 1, top - h + 2, P.white);
    }
  // Cuello en curva hasta la cabeza.
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const x = 46 + (hx - 6 - 46) * k;
    const y = by - 4 + (hy + 2 - (by - 4)) * k - Math.sin(k * Math.PI) * 4;
    b.ellipse(x, y, 5 - k * 1.5, 5 - k * 1.5, (px, py) => body(px, py, y - 5, 10));
  }
  // Cabeza: cráneo, hocico, mandíbula, cuernos y ojo.
  b.ellipse(hx, hy, 7, 5, (x, y) => rampAt(SCALES, 0.75 - (y - hy + 5) / 12, x, y));
  b.poly(
    [
      [hx + 2, hy - 3],
      [hx + 13, hy - 1],
      [hx + 13, hy + 2],
      [hx + 2, hy + 2],
    ],
    (x, y) => rampAt(SCALES, 0.7 - (y - hy + 3) / 8, x, y),
  );
  b.poly(
    [
      [hx - 2, hy + 2],
      [hx + 12, hy + 2 + o.jaw],
      [hx + 11, hy + 4 + o.jaw],
      [hx - 1, hy + 4],
    ],
    L.dark,
  );
  if (o.jaw > 1) {
    b.poly(
      [
        [hx + 1, hy + 2],
        [hx + 12, hy + 2],
        [hx + 11, hy + 1 + o.jaw],
      ],
      L.mouth,
    );
    for (let x = hx + 4; x < hx + 12; x += 3) b.set(x, hy + 2, P.white);
  }
  b.set(hx + 12, hy - 1, L.darker);
  // Cuernos: un par hacia atrás; la de la Corona Blanca, una corona de cinco en abanico.
  const horns: readonly (readonly [number, number, number])[] = L.crown
    ? [
        [-4, 8, 0.1],
        [-2, 10, 0.45],
        [0, 9, 0.8],
        [2, 7, 1.2],
        [3, 5, 1.6],
      ]
    : [
        [-3, 9, 0.3],
        [0, 7, 0.3],
      ];
  for (const [dx, len, rise] of horns) {
    const ex = hx + dx - len * Math.cos(rise * 0.6);
    const ey = hy - 3 - 4 - len * (0.3 + rise * 0.45);
    b.line(hx + dx, hy - 3, ex, ey, L.horn[0]);
    b.line(hx + dx + 1, hy - 3, ex + 1, ey, L.horn[1]);
  }
  if (o.down) b.hline(hx + 1, hy - 1, 3, P.black);
  else {
    b.rect(hx + 1, hy - 2, 3, 2, L.eye[0]);
    b.set(hx + 3, hy - 2, L.eye[1]);
  }
  // Ala de delante.
  if (!o.down) wing(36, 26, false);
  else
    b.poly(
      [
        [30, by - 6],
        [14, by - 2],
        [20, by + 4],
      ],
      (x, y) => rampAt(WING, 0.3 + (y - by) / 20, x, y),
    );
  return outline(b);
}

function wyrmArt(L: WyrmLook = SIERPE): Omit<BossArt, 'downFoot'> {
  const poses: Record<BossPose, PixelBuffer> = {
    ready: wyrm({ head: [62, 20], jaw: 0, wings: 0.3, body: 40 }, L),
    windup: wyrm({ head: [55, 13], jaw: 1, wings: 0.8, body: 39 }, L),
    strike: wyrm({ head: [68, 34], jaw: 5, wings: 0.5, body: 40 }, L),
    thrust: wyrm({ head: [67, 24], jaw: 6, wings: 0.6, body: 40 }, L),
    up: wyrm({ head: [60, 9], jaw: 6, wings: 1, body: 37 }, L),
    down: wyrm({ head: [66, 52], jaw: 2, wings: 0, body: 50, down: true }, L),
  };
  const m = (x: number, y: number) => ({ x: x - 34, y: y - 62 });
  return {
    poses,
    foot: { x: 34, y: 62 },
    chest: 22,
    mouth: {
      ready: m(76, 23),
      windup: m(69, 16),
      strike: m(82, 38),
      thrust: m(81, 28),
      up: m(74, 12),
      down: m(80, 55),
    },
    reach: 26,
  };
}

const cache = new Map<BossKind, BossArt>();

/** Apoyo de la pose de caído: la fila más baja con dibujo, centrada. */
function groundOf(b: PixelBuffer): { x: number; y: number } {
  for (let y = b.h - 1; y >= 0; y--)
    for (let x = 0; x < b.w; x++) if (b.get(x, y)) return { x: Math.round(b.w / 2), y: y + 1 };
  return { x: Math.round(b.w / 2), y: b.h };
}

/** El dibujo de cada jefe (los tres de las historias nuevas, con lo suyo sobre el de su base). */
const ART: Record<BossKind, () => Omit<BossArt, 'downFoot'>> = {
  bestia: () => beastArt(),
  ahogado: kingArt,
  sierpe: () => wyrmArt(),
  jabali: () => beastArt(ASH),
  reina: queenArt,
  dragona: () => wyrmArt(DRAGONA),
};

export function bossArt(kind: BossKind): BossArt {
  let a = cache.get(kind);
  if (!a) {
    const base = ART[kind]();
    a = { ...base, downFoot: groundOf(base.poses.down) };
    cache.set(kind, a);
  }
  return a;
}
