import type { BossKind } from '../data/bosses';
import { P, darker } from './palette';
import { PixelBuffer, bayer, rampAt, toHex } from './pixel';

/**
 * Los jefes de las historias, grandes y dibujados a mano en código: la bestia de Hondogrís
 * (un jabalí del tamaño de un carro), el Rey Ahogado (un gigante con corona y ancla) y la
 * sierpe de Sierra Parda (con alas, cuernos y fuego). Miran a la derecha; la pelea los
 * voltea. Cada pose es un búfer aparte con contorno.
 */

export type BossPose = 'ready' | 'windup' | 'strike' | 'up' | 'thrust' | 'down';

export interface BossArt {
  poses: Record<BossPose, PixelBuffer>;
  /** Dónde pisa dentro del sprite: centro de los pies y fila del suelo. */
  foot: { x: number; y: number };
  /** Lo mismo para la pose de caído (tumbado, apoya en otra fila). */
  downFoot: { x: number; y: number };
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

const FUR = [P.black, P.ebony, P.plum, P.umber, P.mocha, P.cocoa];

function beast(o: BeastPose): PixelBuffer {
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
      b.line(x0, g - 6, x1, g - 2, P.ebony);
      b.line(x0, g - 5, x1, g - 1, P.ebony);
      b.set(x1, g - 1, P.black);
    }
    b.ellipse(26, g - 10, 21, 9, (x, y) => rampAt(FUR, 0.25 + shade(y, g - 19, 18) * 0.6, x, y));
    for (let x = 9; x < 42; x += 3) b.line(x, g - 18, x - 1, g - 21, P.ebony);
    b.ellipse(48, g - 7, 8, 6, (x, y) => rampAt(FUR, 0.3 + shade(y, g - 13, 12) * 0.5, x, y));
    b.ellipse(55, g - 5, 4, 3, P.skinS);
    b.line(51, g - 3, 56, g - 9, P.sand);
    b.set(56, g - 10, P.white);
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
    b.rect(lx - 2, by + 8, 5, g - by - 9 - up, P.ebony);
    b.rect(lx - 1, by + 8, 2, g - by - 10 - up, P.plum);
    b.rect(lx - 2, g - 2 - up, 5, 2, P.black);
  }
  // Cuerpo con la joroba de los hombros y una raya clara por el lomo.
  b.ellipse(25, by, 21, 12, (x, y) => rampAt(FUR, 0.15 + shade(y, by - 12, 24) * 0.75, x, y));
  b.ellipse(36, by - 4, 12, 11, (x, y) => rampAt(FUR, 0.2 + shade(y, by - 15, 22) * 0.75, x, y));
  for (let x = 10; x < 44; x++) {
    const top = Math.round(by - 11 - Math.sin(((x - 10) / 34) * Math.PI) * 4);
    if (bayer(x, 0) < 0.6) b.set(x, top + 2, P.cocoa);
  }
  // Cerdas de punta.
  for (let x = 8; x < 46; x += 2) {
    const top = Math.round(by - 11 - Math.sin(((x - 8) / 38) * Math.PI) * 5);
    const len = 2 + ((x * 7) % 3);
    b.line(x, top, x - 1, top - len, x % 4 ? P.ebony : P.black);
  }
  // Rabo.
  b.line(4, by - 4, 1, by - 7, P.ebony);
  b.set(0, by - 8, P.black);
  // Cabeza, hocico y boca.
  b.ellipse(hx, hy, 9, 7.5, (x, y) => rampAt(FUR, 0.25 + shade(y, hy - 7, 15) * 0.6, x, y));
  b.poly(
    [
      [hx - 2, hy - 7],
      [hx + 1, hy - 12],
      [hx + 3, hy - 6],
    ],
    P.umber,
  );
  b.ellipse(hx + 8, hy + 2, 4.5, 4, (_x, y) => (y < hy + 1 ? P.clay : P.skinS));
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
  // Colmillos curvos.
  for (const [dx, c] of [
    [0, P.sand],
    [1, P.white],
  ] as const) {
    b.line(hx + 6 + dx, hy + 6, hx + 8 + dx, hy + 1, c);
    b.line(hx + 8 + dx, hy + 1, hx + 7 + dx, hy - 2, c);
  }
  // Ojo rojo con brillo.
  b.rect(hx + 2, hy - 3, 2, 2, P.red);
  b.set(hx + 3, hy - 3, P.hot);
  return outline(b);
}

function beastArt(): Omit<BossArt, 'downFoot'> {
  const poses: Record<BossPose, PixelBuffer> = {
    ready: beast({ head: [46, 26], body: 24, jaw: 0, lift: 0 }),
    windup: beast({ head: [44, 30], body: 26, jaw: 0, lift: 0 }),
    strike: beast({ head: [49, 23], body: 24, jaw: 4, lift: 3 }),
    thrust: beast({ head: [50, 28], body: 25, jaw: 2, lift: 0 }),
    up: beast({ head: [47, 16], body: 21, jaw: 6, lift: 7 }),
    down: beast({ head: [0, 0], body: 0, jaw: 0, lift: 0, down: true }),
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

function wyrm(o: WyrmPose): PixelBuffer {
  const b = new PixelBuffer(84, 64);
  const g = 61;
  const by = o.body;
  const [hx, hy] = o.head;
  const body = (x: number, y: number, top: number, h: number) =>
    y > top + h * 0.62
      ? bayer(x, y) < 0.5
        ? P.tan
        : P.sand
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
    const bone = dark ? P.ebony : P.bark;
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
    if (i % 5 === 2) b.line(x, y - r, x - 2, y - r - 3, P.wine);
  }
  // Patas.
  if (!o.down)
    for (const lx of [26, 44]) {
      b.rect(lx - 3, by + 4, 7, g - by - 6, P.wine);
      b.rect(lx - 2, by + 4, 3, g - by - 7, P.brick);
      b.rect(lx - 4, g - 2, 9, 2, P.plum);
      for (let c = 0; c < 3; c++) b.set(lx + 3 + c, g - 1, P.sand);
    }
  // Cuerpo.
  b.ellipse(34, by, 17, 10, (x, y) => body(x, y, by - 10, 20));
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
    P.wine,
  );
  if (o.jaw > 1) {
    b.poly(
      [
        [hx + 1, hy + 2],
        [hx + 12, hy + 2],
        [hx + 11, hy + 1 + o.jaw],
      ],
      P.red,
    );
    for (let x = hx + 4; x < hx + 12; x += 3) b.set(x, hy + 2, P.white);
  }
  b.set(hx + 12, hy - 1, P.plum);
  for (const [dx, len] of [
    [-3, 9],
    [0, 7],
  ] as const) {
    b.line(hx + dx, hy - 3, hx + dx - len, hy - 7 - len * 0.3, P.sand);
    b.line(hx + dx + 1, hy - 3, hx + dx - len + 1, hy - 7 - len * 0.3, P.tan);
  }
  if (o.down) b.hline(hx + 1, hy - 1, 3, P.black);
  else {
    b.rect(hx + 1, hy - 2, 3, 2, P.lemon);
    b.set(hx + 3, hy - 2, P.white);
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

function wyrmArt(): Omit<BossArt, 'downFoot'> {
  const poses: Record<BossPose, PixelBuffer> = {
    ready: wyrm({ head: [62, 20], jaw: 0, wings: 0.3, body: 40 }),
    windup: wyrm({ head: [55, 13], jaw: 1, wings: 0.8, body: 39 }),
    strike: wyrm({ head: [68, 34], jaw: 5, wings: 0.5, body: 40 }),
    thrust: wyrm({ head: [67, 24], jaw: 6, wings: 0.6, body: 40 }),
    up: wyrm({ head: [60, 9], jaw: 6, wings: 1, body: 37 }),
    down: wyrm({ head: [66, 52], jaw: 2, wings: 0, body: 50, down: true }),
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

export function bossArt(kind: BossKind): BossArt {
  let a = cache.get(kind);
  if (!a) {
    const base = kind === 'bestia' ? beastArt() : kind === 'ahogado' ? kingArt() : wyrmArt();
    a = { ...base, downFoot: groundOf(base.poses.down) };
    cache.set(kind, a);
  }
  return a;
}
