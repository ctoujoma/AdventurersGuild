/**
 * La comarca como datos, para las versiones del mapa (`mapInk.ts`, `mapColor.ts`): la altura
 * (sierras, lomas y valles de los ríos), el agua (mar con calas, ríos, lagos y charcas), los
 * bosques, las parcelas de labor, los caminos y las casas. Sale siempre igual (semillas fijas) y
 * respeta las coordenadas de `data/places.ts`: un píxel del dibujo es una unidad del mapa.
 */
import { Rng } from '../core/rng';
import { MAP_H, MAP_W, PLACE_INFO, TAVERN } from '../data/places';

export const W = MAP_W;
export const H = MAP_H;
export type Pt = readonly [number, number];

// ---------- Ruido ----------

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ruido fractal (0–1). */
export function fbm(x: number, y: number, s: number, oct = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += vnoise(x, y, s + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / norm;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distancia de un punto a una polilínea. */
function distTo(pts: readonly Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

/** Recorre una polilínea punto a punto, con un vaivén suave. */
export function trace(
  pts: readonly Pt[],
  wobble: number,
  seed: number,
  draw: (x: number, y: number, i: number, t: number) => void,
): void {
  let total = 0;
  for (let s = 0; s < pts.length - 1; s++)
    total += Math.max(
      Math.abs(pts[s + 1]![0] - pts[s]![0]),
      Math.abs(pts[s + 1]![1] - pts[s]![1]),
      1,
    );
  let i = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, ay] = pts[s]!;
    const [bx, by] = pts[s + 1]!;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    for (let k = 0; k < n; k++, i++) {
      const t = k / n;
      const off = (fbm(i * 0.06, seed, seed) - 0.5) * 2 * wobble;
      draw(
        Math.round(ax + (bx - ax) * t + nx * off),
        Math.round(ay + (by - ay) * t + ny * off),
        i,
        i / total,
      );
    }
  }
}

// ---------- La geografía ----------

/** Línea de costa media: x del agua para cada fila (el mar queda a la izquierda). */
export function coastAt(y: number): number {
  return 58 + 10 * Math.sin(y * 0.045) + Math.max(0, y - 130) * 0.55 + 3 * Math.sin(y * 0.2);
}

/** Río grande: del norte, por el vado y el molino, hasta el mar junto a las salinas. */
export const RIVER: readonly Pt[] = [
  [214, 0],
  [210, 40],
  [204, 94],
  [192, 116],
  [176, 130],
  [162, 144],
  [150, 158],
  [128, 172],
  [96, 180],
  [84, 182],
];
/** Afluente que baja de la sierra y pasa bajo el puente de los ahorcados. */
export const BROOK: readonly Pt[] = [
  [266, 22],
  [250, 54],
  [234, 90],
  [220, 112],
  [204, 115],
  [194, 117],
];
/** Arroyo de los Montes de la Niebla, por Carbonera, al mar. */
export const STREAM: readonly Pt[] = [
  [104, 56],
  [100, 78],
  [92, 100],
  [86, 116],
  [60, 128],
  [40, 132],
];

/** Caminos reales desde la taberna. */
export const ROADS: readonly (readonly Pt[])[] = [
  [
    [198, 146],
    [230, 156],
    [258, 168],
    [280, 182],
    [294, 192],
    [330, 214],
    [356, 230],
    [384, 256],
  ],
  [
    [198, 146],
    [240, 140],
    [276, 138],
    [322, 150],
    [396, 126],
  ],
  [
    [198, 146],
    [202, 120],
    [204, 94],
    [212, 60],
    [222, 4],
  ],
  [
    [198, 146],
    [172, 152],
    [150, 158],
    [124, 172],
    [108, 182],
  ],
  [
    [198, 146],
    [192, 170],
    [188, 192],
    [182, 216],
    [176, 238],
    [186, 276],
  ],
];

/** Las sierras: su cresta, su anchura y su altura; `kind` 1 Parda, 2 Niebla, 3 Este. */
const RANGES: readonly { pts: readonly Pt[]; w: number; top: number; kind: number }[] = [
  {
    pts: [
      [96, 20],
      [150, 28],
      [196, 34],
      [250, 26],
      [300, 22],
      [350, 28],
      [398, 12],
    ],
    w: 30,
    top: 1,
    kind: 1,
  },
  {
    pts: [
      [126, 66],
      [170, 70],
      [232, 72],
      [292, 80],
      [344, 72],
      [392, 60],
    ],
    w: 12,
    top: 0.5,
    kind: 1,
  },
  {
    pts: [
      [52, 18],
      [80, 36],
      [104, 54],
      [114, 70],
    ],
    w: 18,
    top: 0.8,
    kind: 2,
  },
  {
    pts: [
      [388, 80],
      [378, 118],
      [386, 166],
      [374, 210],
    ],
    w: 13,
    top: 0.42,
    kind: 3,
  },
];

/** Bosques: centro, radio, cuántos árboles caben y de qué clase. */
export const GROVES: readonly { x: number; y: number; r: number; kind: number }[] = [
  { x: 124, y: 120, r: 22, kind: 1 },
  { x: 338, y: 156, r: 26, kind: 1 },
  { x: 288, y: 98, r: 14, kind: 2 },
  { x: 140, y: 80, r: 11, kind: 2 },
  { x: 302, y: 236, r: 11, kind: 1 },
  { x: 78, y: 80, r: 10, kind: 3 },
  { x: 370, y: 84, r: 12, kind: 2 },
  { x: 240, y: 120, r: 7, kind: 1 },
];

/** Las tierras de labor: centro, tamaño y giro de cada zona de parcelas. */
const FIELDS: readonly { x: number; y: number; w: number; h: number; a: number }[] = [
  { x: 244, y: 186, w: 30, h: 13, a: 0.18 },
  { x: 220, y: 218, w: 26, h: 13, a: -0.12 },
  { x: 280, y: 246, w: 44, h: 14, a: 0.06 },
  { x: 214, y: 164, w: 14, h: 7, a: 0.3 },
  { x: 302, y: 126, w: 16, h: 8, a: -0.2 },
];

// ---------- El modelo ----------

export const SEA = 1;
export const RIVER_W = 2;
export const LAKE = 3;
export const POOL = 4;
export const ICE = 5;
export const BLACK = 6;

export const BROAD = 1;
export const PINE = 2;
export const BURNT = 3;

export const REAL = 1;
export const SENDA = 2;

export interface House {
  x: number;
  y: number;
  roof: number;
}

export interface Terrain {
  /** Altura, 0–1. */
  h: Float32Array;
  /** Qué sierra (0 ninguna, 1 Parda, 2 Niebla, 3 Este). */
  range: Uint8Array;
  /** El agua: 0 tierra, o SEA, RIVER_W, LAKE, POOL, ICE, BLACK (la laguna Negra). */
  water: Uint8Array;
  /** En el mar, cuánto hay hasta tierra; en tierra, cuánto hasta el mar (tope 255). */
  depth: Uint8Array;
  forest: Uint8Array;
  /** La parcela (id + 1) o 0. */
  field: Int32Array;
  marsh: Uint8Array;
  road: Uint8Array;
  houses: House[];
  /** El arco de cada parcela, por id: su cultivo (0–3) y la dirección de los surcos. */
  crop: (id: number) => { kind: number; dir: number };
}

let cached: Terrain | null = null;

const idx = (x: number, y: number) => y * W + x;
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

/** Distancia (chaflán 3-4, en píxeles) a lo que cumple `src`. */
function distField(src: (i: number) => boolean): Float32Array {
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = src(i) ? 0 : 1e9;
  const pass = (x: number, y: number, dx: number, dy: number, c: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (!inside(nx, ny)) return;
    const v = d[idx(nx, ny)]! + c;
    if (v < d[idx(x, y)]!) d[idx(x, y)] = v;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      pass(x, y, -1, 0, 3);
      pass(x, y, 0, -1, 3);
      pass(x, y, -1, -1, 4);
      pass(x, y, 1, -1, 4);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      pass(x, y, 1, 0, 3);
      pass(x, y, 0, 1, 3);
      pass(x, y, 1, 1, 4);
      pass(x, y, -1, 1, 4);
    }
  for (let i = 0; i < W * H; i++) d[i] = d[i]! / 3;
  return d;
}

export function terrain(): Terrain {
  if (cached) return cached;
  const h = new Float32Array(W * H);
  const range = new Uint8Array(W * H);
  const water = new Uint8Array(W * H);
  const forest = new Uint8Array(W * H);
  const field = new Int32Array(W * H);
  const marsh = new Uint8Array(W * H);
  const road = new Uint8Array(W * H);

  // El mar, con calas y cabos; y las islas.
  const isles: [number, number, number][] = [
    [22, 128, 5],
    [70, 262, 6],
    [36, 58, 4],
    [14, 210, 3],
  ];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge =
        coastAt(y) + (fbm(x / 18, y / 18, 7) - 0.5) * 16 + (fbm(x / 5, y / 5, 9) - 0.5) * 3;
      let sea = x < edge;
      for (const [ix, iy, r] of isles)
        if (Math.hypot((x - ix) / 1.3, y - iy) < r + (fbm(x / 3, y / 3, 13) - 0.5) * 3) sea = false;
      if (sea) water[idx(x, y)] = SEA;
    }
  const shore = distField((i) => water[i] === SEA);
  const toLand = distField((i) => water[i] !== SEA);

  // La marisma.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (water[idx(x, y)]) continue;
      const e = Math.hypot((x - 142) / 40, (y - 222) / 26) + (fbm(x / 10, y / 10, 21) - 0.5) * 0.6;
      if (e < 1) marsh[idx(x, y)] = 1;
    }

  // La altura: llanura ondulada, sierras con crestas, lomas sueltas.
  const rng = new Rng('comarca');
  const bumps = Array.from({ length: 18 }, () => ({
    x: rng.int(140, 360),
    y: rng.int(100, 260),
    r: rng.int(6, 11),
  })).filter((b) => Math.hypot(b.x - TAVERN.x, b.y - TAVERN.y) > 18);
  const rivers = [RIVER, BROOK, STREAM];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      let v = 0.13 + 0.1 * fbm(x / 50, y / 50, 1) + 0.04 * fbm(x / 10, y / 10, 2);
      let m = 0;
      for (const r of RANGES) {
        const d = distTo(r.pts, x, y) + (fbm(x / 20, y / 20, 5) - 0.5) * 14;
        const f = Math.exp(-((d / r.w) ** 2)) * r.top;
        if (f > m) {
          m = f;
          if (f > 0.18) range[i] = r.kind;
        }
      }
      const ridge = 1 - Math.abs(2 * fbm(x / 24, y / 20, 3, 5) - 1);
      v += m * (0.3 + 0.7 * ridge ** 2);
      for (const b of bumps) {
        const d = Math.hypot(x - b.x, (y - b.y) * 1.4) / b.r;
        if (d < 1) v += 0.1 * (1 - d * d) ** 2;
      }
      // Los ríos abren valles.
      const dr = Math.min(...rivers.map((r) => distTo(r, x, y)));
      v = 0.12 + (v - 0.12) * (1 - 0.65 * Math.exp(-((dr / 8) ** 2)));
      // Junto al mar, bajo; en la marisma, llano.
      v = Math.min(v, 0.1 + shore[i]! * 0.035);
      if (marsh[i]) v = Math.min(v, 0.11 + 0.02 * fbm(x / 6, y / 6, 4));
      h[i] = water[i] === SEA ? 0 : v;
    }

  // Ríos (se ensanchan hacia el mar) y lagos.
  const disk = (x: number, y: number, r: number, kind: number) => {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        if (dx * dx + dy * dy <= r * r + 0.5 && inside(x + dx, y + dy)) {
          const i = idx(x + dx, y + dy);
          if (water[i] !== SEA) water[i] = kind;
        }
  };
  trace(RIVER, 1.4, 31, (x, y, _i, t) => disk(x, y, 0.6 + t * 1.6, RIVER_W));
  trace(BROOK, 1, 32, (x, y) => disk(x, y, 0.5, RIVER_W));
  trace(STREAM, 1, 33, (x, y, _i, t) => disk(x, y, 0.5 + t * 0.6, RIVER_W));
  const lake = (cx: number, cy: number, rx: number, ry: number, kind: number, hole = 0) => {
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        if (!inside(x, y)) continue;
        const e = Math.hypot((x - cx) / rx, (y - cy) / ry) + (fbm(x / 4, y / 4, 41) - 0.5) * 0.4;
        const isle = hole && Math.hypot((x - cx) / (hole * 1.5), (y - cy) / hole) < 1;
        if (e < 1 && !isle) {
          water[idx(x, y)] = kind;
          h[idx(x, y)] = Math.min(h[idx(x, y)]!, 0.12);
        }
      }
  };
  lake(358, 40, 12, 6, ICE);
  lake(126, 249, 10, 5, BLACK);
  lake(148, 259, 9, 5.5, LAKE, 2.4);
  lake(170, 125, 4, 2.5, LAKE);
  // Charcas de la marisma.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (marsh[i] && !water[i] && fbm(x / 4, y / 3, 23) > 0.6) water[i] = POOL;
    }

  // Bosques.
  for (const g of GROVES)
    for (let y = g.y - g.r - 6; y <= g.y + g.r + 6; y++)
      for (let x = Math.round(g.x - g.r * 1.4 - 6); x <= g.x + g.r * 1.4 + 6; x++) {
        if (!inside(x, y)) continue;
        const e = Math.hypot((x - g.x) / 1.35, y - g.y) / g.r + (fbm(x / 7, y / 7, 51) - 0.5) * 0.7;
        if (e < 1 && !water[idx(x, y)]) forest[idx(x, y)] = g.kind;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (water[i] || forest[i] || marsh[i]) continue;
      const n = fbm(x / 9, y / 9, 61);
      // Pinares en las laderas; sotos sueltos en la llanura.
      if (h[i]! > 0.3 && h[i]! < 0.55 && range[i] !== 3 && n > 0.56) forest[i] = PINE;
      else if (h[i]! < 0.3 && n > 0.7 && Math.hypot(x - TAVERN.x, y - TAVERN.y) > 14)
        forest[i] = BROAD;
    }

  // Las parcelas: una rejilla girada, de anchos desiguales.
  const crops: { kind: number; dir: number }[] = [];
  FIELDS.forEach((f, z) => {
    const ca = Math.cos(f.a);
    const sa = Math.sin(f.a);
    for (let y = f.y - f.h; y <= f.y + f.h; y++)
      for (let x = f.x - f.w; x <= f.x + f.w; x++) {
        if (!inside(x, y)) continue;
        const u = (x - f.x) * ca + (y - f.y) * sa;
        const v = -(x - f.x) * sa + (y - f.y) * ca;
        const e = Math.hypot(u / f.w, v / f.h) + (fbm(x / 8, y / 8, 71) - 0.5) * 0.35;
        const i = idx(x, y);
        if (e > 0.95 || water[i]) continue;
        const row = Math.floor((v + 40) / 7);
        const col = Math.floor(
          (u + 80 + hash2(row, z, 3) * 9) / (8 + Math.floor(hash2(row, z, 4) * 5)),
        );
        const id = z * 1000 + row * 40 + col;
        field[i] = id + 1;
        forest[i] = 0;
        crops[id] ??= { kind: Math.floor(hash2(id, z, 5) * 4), dir: hash2(id, z, 6) < 0.5 ? 0 : 1 };
      }
  });

  // Caminos reales y senderos (de cada lugar al camino más cercano).
  const along: Pt[] = [];
  ROADS.forEach((r, k) =>
    trace(r, 1.2, 80 + k, (x, y) => {
      if (!inside(x, y)) return;
      road[idx(x, y)] = REAL;
      along.push([x, y]);
    }),
  );
  Object.values(PLACE_INFO).forEach((p, k) => {
    let best: Pt = [TAVERN.x, TAVERN.y];
    let d = Math.hypot(p.x - best[0], p.y - best[1]);
    for (const q of along) {
      const e = Math.hypot(p.x - q[0], p.y - q[1]);
      if (e < d) [best, d] = [q, e];
    }
    if (d < 5) return;
    trace([best, [p.x, p.y]], Math.min(3, d / 8), 120 + k, (x, y) => {
      if (inside(x, y) && !road[idx(x, y)]) road[idx(x, y)] = SENDA;
    });
  });

  // Las casas: aldeas en los pueblos, junto a la taberna y algún caserío.
  const houses: House[] = [];
  const village = (cx: number, cy: number, n: number, roof: number, seed: string) => {
    const r = new Rng(seed);
    for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
      const x = cx + r.int(-9, 9);
      const y = cy + r.int(-6, 6);
      if (!inside(x, y) || water[idx(x, y)] || road[idx(x, y)]) continue;
      if (houses.some((o) => Math.abs(o.x - x) < 6 && Math.abs(o.y - y) < 5)) continue;
      if (Math.hypot(x - cx, y - cy) < 3) continue;
      houses.push({ x, y, roof });
      k++;
    }
  };
  for (const [name, p] of Object.entries(PLACE_INFO))
    if (p.terrain === 'pueblo' || /aldea/.test(name)) village(p.x, p.y, 6, 0, name);
  village(TAVERN.x, TAVERN.y, 4, 0, 'taberna');
  village(186, 262, 3, 1, 'juncal-sur');
  village(232, 136, 2, 1, 'caserio');
  village(318, 236, 2, 0, 'caserio-sur');
  for (const o of houses)
    for (let y = o.y - 4; y <= o.y + 1; y++)
      for (let x = o.x - 3; x <= o.x + 3; x++) if (inside(x, y)) forest[idx(x, y)] = 0;

  const depth = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++)
    depth[i] = Math.min(255, Math.round(water[i] === SEA ? toLand[i]! : shore[i]!));

  cached = {
    h,
    range,
    water,
    depth,
    forest,
    field,
    marsh,
    road,
    houses,
    crop: (id) => crops[id] ?? { kind: 0, dir: 0 },
  };
  return cached;
}

/** La luz de una ladera (0 sombra – 1 luz), con el sol al noroeste. */
export function shadeAt(t: Terrain, x: number, y: number, k = 9): number {
  const at = (px: number, py: number) =>
    t.h[idx(Math.max(0, Math.min(W - 1, px)), Math.max(0, Math.min(H - 1, py)))]!;
  const gx = at(x + 1, y) - at(x - 1, y);
  const gy = at(x, y + 1) - at(x, y - 1);
  return Math.max(0, Math.min(1, 0.5 + (gx + gy) * k));
}

export const at = idx;
export { smooth };
