/**
 * El terreno del mapa de rumbos: la comarca (`mapTerrain.ts`) en el centro, tal cual, y
 * alrededor la sierra (norte), el bosque (este), las ruinas (sureste), las marismas (sur-suroeste)
 * y el mar (oeste), cada vez más salvajes cuanto más lejos. Es el mismo modelo que el de la
 * comarca (altura, agua, bosques, caminos…), así lo pintan los mismos pinceles (`mapInk.ts`,
 * `mapColor.ts`) y empalma sin costura; lleva además la arena de las ruinas, lo salvaje y las
 * piedras y accidentes que se dibujan encima (`expArt.ts`).
 *
 * Todo va en coordenadas de la comarca: el mapa va de (−400, −280) a (800, 560).
 */
import type { Heading } from '../core/model';
import { Rng } from '../core/rng';
import { MAP_H, MAP_W, TAVERN } from '../data/places';
import { ANGLE, OX, OY, WORLD_H, WORLD_W, expPoint, maxDist } from './expGeo';
import {
  BLACK,
  BROAD,
  ICE,
  LAKE,
  PINE,
  POOL,
  REAL,
  RIVER_W,
  SEA,
  SENDA,
  coastAt,
  fbm,
  hash2,
  reliefAt,
  smooth,
  terrain,
  trace,
  type House,
  type Pt,
  type Ruin,
  type Terrain,
} from './mapTerrain';

const X0 = -OX;
const Y0 = -OY;
const W = WORLD_W;
const H = WORLD_H;
const X1 = X0 + W;
const Y1 = Y0 + H;
const idx = (x: number, y: number) => (y - Y0) * W + (x - X0);
const inside = (x: number, y: number) => x >= X0 && y >= Y0 && x < X1 && y < Y1;
const inShire = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const DEG = Math.PI / 180;
/** La sierra alta del norte (roca azulada, nieve en las cumbres): solo en el mapa de rumbos. */
export const HIGH = 4;

/** Un punto del rumbo, en coordenadas de la comarca. */
export function headingAt(h: Heading, dist: number, side = 0): Pt {
  const p = expPoint(h, dist, side);
  return [Math.round(p.x - OX), Math.round(p.y - OY)];
}

/**
 * La costa del mapa grande: la de la comarca (`coastAt`) en su tramo, y fuera se va abriendo al
 * oeste, al norte bajo la sierra y al sur tras el delta de las marismas, como una gran bahía.
 */
export function worldCoast(y: number): number {
  if (y < 0) return coastAt(y) - (y * y) / 700;
  if (y < MAP_H) return coastAt(y);
  const s = y - MAP_H + 1;
  return coastAt(MAP_H - 1) - 1.5 * s * smooth(0, 24, s) - (s * s) / 260;
}

/** Distancia (chaflán 3-4) a lo que cumple `src`, en una rejilla de `w × h`. */
function chamfer(w: number, h: number, src: (i: number) => boolean): Float32Array {
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = src(i) ? 0 : 1e9;
  const step = (i: number, j: number, c: number) => {
    const v = d[j]! + c;
    if (v < d[i]!) d[i] = v;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) step(i, i - 1, 3);
      if (y > 0) {
        step(i, i - w, 3);
        if (x > 0) step(i, i - w - 1, 4);
        if (x < w - 1) step(i, i - w + 1, 4);
      }
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) step(i, i + 1, 3);
      if (y < h - 1) {
        step(i, i + w, 3);
        if (x < w - 1) step(i, i + w + 1, 4);
        if (x > 0) step(i, i + w - 1, 4);
      }
    }
  for (let i = 0; i < w * h; i++) d[i] = d[i]! / 3;
  return d;
}

/** Cuánto pesa cada rumbo en un punto (por su ángulo desde la taberna, con lindes torcidas). */
function regions(x: number, y: number): { s: number; b: number; r: number; m: number } {
  const warp = (fbm(x / 110, y / 110, 301, 3) - 0.5) * 0.7;
  const a = (Math.atan2(y - TAVERN.y, x - TAVERN.x) + warp) / DEG;
  const up = (lo: number, hi: number) =>
    smooth(lo - 9, lo + 9, a) * (1 - smooth(hi - 9, hi + 9, a));
  const s = up(-200, -42) + up(150, 400);
  const b = up(-42, 21);
  const r = up(21, 80);
  const m = up(80, 150);
  return { s, b, r, m };
}

/** Los accidentes de cada rumbo (y del mar), por donde caen: los dibuja `expArt.ts`. */
export function landmarks(): Ruin[] {
  const at = (h: Heading, d: number, side: number, kind: string): Ruin => {
    const [x, y] = headingAt(h, Math.min(d, maxDist(h) - 0.6), side);
    return { x, y, kind };
  };
  return [
    at('sierra', 6.2, 1.9, 'pico'),
    at('sierra', 4.9, 0.7, 'paso'),
    at('bosque', 6.5, -1.5, 'arbol'),
    at('marismas', 6, 1.6, 'torre_hundida'),
    at('ruinas', 7.4, 1.4, 'ciudad'),
    { x: -170, y: 110, kind: 'faro' },
    { x: -270, y: 330, kind: 'remolino' },
    { x: -40, y: -150, kind: 'naufragio' },
  ];
}

let cached: Terrain | null = null;

export function worldTerrain(): Terrain {
  if (cached) return cached;
  const c = terrain();
  const N = W * H;
  const h = new Float32Array(N);
  const range = new Uint8Array(N);
  const water = new Uint8Array(N);
  const forest = new Uint8Array(N);
  const field = new Int32Array(N);
  const marsh = new Uint8Array(N);
  const road = new Uint8Array(N);
  const sand = new Uint8Array(N);
  const wild = new Uint8Array(N);
  /** Fuera de la comarca: a qué distancia queda de ella. */
  const out = new Float32Array(N);
  const reg = {
    s: new Float32Array(N),
    b: new Float32Array(N),
    r: new Float32Array(N),
    m: new Float32Array(N),
  };
  const marks = landmarks();
  const mark = (k: string) => marks.find((m) => m.kind === k)!;

  // ---------- La comarca, tal cual; fuera, el mar y los rumbos ----------
  const isles: [number, number, number][] = [
    [-170, 112, 7],
    [-120, 20, 4],
    [-300, -60, 6],
    [-330, 440, 5],
    [-40, -150, 3],
  ];
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = idx(x, y);
      if (inShire(x, y)) {
        const j = c.at(x, y);
        water[i] = c.water[j]!;
        h[i] = c.h[j]!;
        range[i] = c.range[j]!;
        forest[i] = c.forest[j]!;
        field[i] = c.field[j]!;
        marsh[i] = c.marsh[j]!;
        road[i] = c.road[j]!;
        continue;
      }
      const dx = Math.max(-x, 0, x - (MAP_W - 1));
      const dy = Math.max(-y, 0, y - (MAP_H - 1));
      out[i] = Math.hypot(dx, dy);
      const cw = worldCoast(y);
      let sea = x < cw - 12;
      if (!sea && x < cw + 12)
        sea = x < cw + (fbm(x / 18, y / 18, 7) - 0.5) * 16 + (fbm(x / 5, y / 5, 9) - 0.5) * 3;
      if (sea)
        for (const [ix, iy, r] of isles) {
          const e = Math.hypot((x - ix) / 1.3, y - iy);
          if (e < r + 2 && e < r + (fbm(x / 3, y / 3, 13) - 0.5) * 3) sea = false;
        }
      if (sea) {
        water[i] = SEA;
        continue;
      }
      const g = regions(x, y);
      reg.s[i] = g.s;
      reg.b[i] = g.b;
      reg.r[i] = g.r;
      reg.m[i] = g.m;
    }
  const shore = chamfer(W, H, (i) => water[i] === SEA);
  const toLand = chamfer(W, H, (i) => water[i] !== SEA);

  // El camino de cada rumbo (para abrir el paso de la sierra) y los ríos nuevos.
  const route = (hd: Heading): Pt[] => {
    const pts: Pt[] = [];
    for (let d = 0.8; d <= maxDist(hd); d += 0.25) pts.push(headingAt(hd, d));
    return pts;
  };
  const sierra = route('sierra');
  // Dónde toca el río grande el borde de arriba de la comarca.
  let riverTop = 214;
  for (let x = 200; x < 230; x++)
    if (c.water[c.at(x, 0)] === RIVER_W) {
      riverTop = x;
      break;
    }
  const lakeN: Pt = [sierra[Math.min(sierra.length - 1, 15)]![0] - 18, -170];
  const RIVER_N: Pt[] = [
    [lakeN[0] + 4, lakeN[1] + 6],
    [lakeN[0] + 10, -130],
    [204, -96],
    [210, -60],
    [riverTop - 2, -24],
    [riverTop, 1],
  ];
  const BROOK_N: Pt[] = [
    [300, -120],
    [286, -80],
    [272, -40],
    [268, -6],
  ];
  const FOREST_R: Pt[] = [
    [520, -150],
    [536, -90],
    [528, -30],
    [548, 40],
    [590, 110],
    [640, 170],
    [700, 206],
    [760, 236],
    [800, 250],
  ];
  const CHANNELS: Pt[][] = [
    [
      [118, 286],
      [96, 330],
      [56, 362],
      [10, 390],
      [-40, 404],
    ],
    [
      [196, 300],
      [178, 352],
      [150, 404],
      [100, 446],
      [40, 480],
      [-20, 500],
    ],
    [
      [240, 380],
      [214, 440],
      [180, 500],
      [130, 540],
      [100, 560],
    ],
    [
      [60, 450],
      [20, 520],
      [-10, 560],
    ],
  ];
  // La distancia a las líneas que abren valles: el paso de la sierra y los ríos.
  const lines = new Uint8Array(N);
  const draw = (pts: readonly Pt[], wob: number, seed: number) =>
    trace(pts, wob, seed, (x, y) => {
      if (inside(x, y)) lines[idx(x, y)] = 1;
    });
  draw(sierra, 2, 401);
  draw(RIVER_N, 3, 402);
  draw(BROOK_N, 2, 403);
  draw(FOREST_R, 4, 404);
  const valley = chamfer(W, H, (i) => lines[i] === 1);
  // Lo que se queda despejado alrededor de los accidentes.
  const peak = mark('pico');

  // ---------- La altura, la sierra, los bosques, la arena ----------
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = idx(x, y);
      if (inShire(x, y)) continue;
      const o = out[i]!;
      const wl = clamp01(smooth(0, 300, o + (fbm(x / 40, y / 40, 302, 2) - 0.5) * 60));
      wild[i] = Math.round(wl * 255);
      if (water[i] === SEA) continue;
      const s = reg.s[i]!;
      const b = reg.b[i]!;
      const r = reg.r[i]!;
      const m = reg.m[i]!;
      let v = 0.13 + 0.1 * fbm(x / 50, y / 50, 1, 3) + 0.04 * fbm(x / 10, y / 10, 2, 3);
      // La sierra: cada vez más alta hacia el norte, con crestas.
      // Pegada al borde de arriba de la comarca, la sierra sigue también hacia el este.
      const north = smooth(70, -10, y) * (1 - smooth(520, 720, x)) * (x > 0 ? 1 : 0);
      const mass = Math.max(s * smooth(-40, 10, -y), north) * (0.55 + 0.5 * smooth(0, 230, -y));
      if (mass > 0.02) {
        const ridge = 1 - Math.abs(2 * fbm(x / 24, y / 20, 3, 4) - 1);
        const knot = fbm(x / 70, y / 60, 308, 2);
        v += mass * (0.15 + 0.85 * ridge ** 2) * (0.75 + 0.5 * knot);
        if (mass > 0.25) range[i] = y < -170 + (fbm(x / 30, y / 30, 303, 2) - 0.5) * 90 ? HIGH : 1;
      }
      // El pico de la sierra.
      const dp = Math.hypot(x - peak.x, (y - peak.y) * 1.2);
      v += 0.55 * Math.exp(-((dp / 22) ** 2));
      // Lomas en el bosque.
      v += b * 0.07 * fbm(x / 26, y / 26, 304, 2);
      // El paso y los ríos abren valles.
      const dv = valley[i]!;
      v = 0.12 + (v - 0.12) * (1 - 0.72 * Math.exp(-((dv / 14) ** 2)));
      // Junto al mar, bajo; en las marismas, llano.
      v = Math.min(v, 0.1 + shore[i]! * 0.035);
      if (m > 0.45 && y > MAP_H - 6) {
        const e = m + (fbm(x / 12, y / 12, 21, 3) - 0.5) * 0.5 + smooth(4, 44, o) * 0.45 - 0.4;
        if (e > 0.5) marsh[i] = 1;
      }
      if (marsh[i])
        v = Math.min(v, 0.11 + 0.02 * fbm(x / 6, y / 6, 4, 2) + (1 - smooth(0, 40, o)) * 0.3);
      // Pegado a la comarca, su mismo relieve (que sigue fuera), y poco a poco el de aquí.
      const k = smooth(0, 34, o);
      if (k < 1) {
        const rel = reliefAt(x, y);
        const vc = Math.min(rel.v, 0.1 + shore[i]! * 0.035);
        v = vc * (1 - k) + v * k;
        if (k < 0.5) range[i] = rel.range;
      }
      h[i] = v;
      // La arena de las ruinas, cada vez más cerrada.
      const sd = r * (0.15 + 1.25 * wl) + (fbm(x / 20, y / 16, 305, 3) - 0.5) * 0.7 - b * 0.6;
      if (sd > 0.3 && !marsh[i]) sand[i] = Math.round(clamp01((sd - 0.3) / 0.4) * 255);
    }

  // ---------- El agua de tierra adentro ----------
  const disk = (x: number, y: number, r: number, kind: number) => {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        if (
          dx * dx + dy * dy <= r * r + 0.5 &&
          inside(x + dx, y + dy) &&
          !inShire(x + dx, y + dy)
        ) {
          const i = idx(x + dx, y + dy);
          if (water[i] !== SEA) water[i] = kind;
        }
  };
  trace(RIVER_N, 3, 402, (x, y) => disk(x, y, 0.5, RIVER_W));
  trace(BROOK_N, 2, 403, (x, y) => disk(x, y, 0.5, RIVER_W));
  trace(FOREST_R, 4, 404, (x, y, _i, t) => disk(x, y, 0.5 + t * 1.2, RIVER_W));
  CHANNELS.forEach((ch, k) =>
    trace(ch, 6, 410 + k, (x, y, _i, t) => disk(x, y, 0.6 + t * 1.4, RIVER_W)),
  );
  const lake = (cx: number, cy: number, rx: number, ry: number, kind: number, hole = 0) => {
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        if (!inside(x, y) || inShire(x, y)) continue;
        const e = Math.hypot((x - cx) / rx, (y - cy) / ry) + (fbm(x / 4, y / 4, 41) - 0.5) * 0.4;
        const isle = hole && Math.hypot((x - cx) / (hole * 1.5), (y - cy) / hole) < 1;
        const i = idx(x, y);
        if (e < 1 && !isle && water[i] !== SEA) {
          water[i] = kind;
          h[i] = Math.min(h[i]!, 0.12);
          sand[i] = 0;
        }
      }
  };
  lake(lakeN[0], lakeN[1], 13, 6, ICE);
  lake(BROOK_N[0]![0] + 4, BROOK_N[0]![1] - 6, 6, 3.5, ICE);
  const [fx, fy] = headingAt('bosque', 4.2, 1.3);
  lake(fx, fy, 16, 9, LAKE, 2.5);
  const tower = mark('torre_hundida');
  lake(tower.x, tower.y + 1, 20, 11, LAKE);
  const [bx, by] = headingAt('marismas', 8.4, -1.5);
  lake(bx, by, 18, 9, BLACK);
  const [ox, oy] = headingAt('ruinas', 4.6, -1.6);
  lake(ox, oy, 6, 3.5, LAKE);
  // Charcas de las marismas: más cuanto más lejos.
  for (let y = MAP_H; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = idx(x, y);
      if (!marsh[i] || water[i]) continue;
      const wl = wild[i]! / 255;
      if (fbm(x / (4 + 4 * wl), y / (3 + 3 * wl), 23, 3) > 0.69 - 0.04 * wl) water[i] = POOL;
    }

  // ---------- Bosques ----------
  const tree = mark('arbol');
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = idx(x, y);
      if (inShire(x, y) || water[i] || sand[i]! > 90) continue;
      const wl = wild[i]! / 255;
      const n = fbm(x / 9, y / 9, 61, 3);
      const b = reg.b[i]!;
      // Claros: grandes manchas sin árboles, cada vez más raras.
      const glade = fbm(x / 34, y / 30, 306, 2) < 0.3 - 0.12 * wl;
      const open =
        Math.hypot(x - tree.x, (y - tree.y) * 1.3) < 15 || Math.hypot(x - fx, y - fy) < 24;
      const hh = h[i]!;
      if (b > 0.05 && !glade && !open && hh < 0.5) {
        const thr = 0.62 - b * (0.12 + 0.5 * wl ** 0.7);
        if (n > thr) forest[i] = hash2(x >> 2, y >> 2, 307) < 0.25 + 0.6 * wl ? PINE : BROAD;
      }
      if (forest[i]) continue;
      if (marsh[i]) {
        // Algún sauce suelto (los árboles muertos van aparte, en `expArt.ts`).
        if (n > 0.76 && wl < 0.6) forest[i] = BROAD;
        continue;
      }
      if (hh > 0.3 && hh < 0.55 && range[i] && n > 0.56) forest[i] = PINE;
      else if (hh < 0.3 && n > 0.72 && !sand[i]) forest[i] = BROAD;
    }

  // ---------- Caminos que salen de la comarca y se pierden ----------
  const ways: { pts: Pt[]; real: number }[] = [
    {
      pts: [
        [232, 4],
        [228, -24],
        [214, -60],
        [206, -100],
        [lakeN[0] + 20, lakeN[1] + 14],
        [sierra[Math.min(sierra.length - 1, 18)]![0], sierra[Math.min(sierra.length - 1, 18)]![1]],
      ],
      real: 0.35,
    },
    {
      pts: [
        [396, 126],
        [440, 124],
        [500, 136],
        [560, 130],
        [610, 142],
      ],
      real: 0.4,
    },
    {
      pts: [
        [384, 256],
        [420, 290],
        [462, 326],
        [500, 372],
        [530, 420],
      ],
      real: 0.3,
    },
    {
      pts: [
        [186, 276],
        [182, 304],
        [172, 340],
        [160, 372],
      ],
      real: 0.5,
    },
  ];
  ways.forEach((wy, k) =>
    trace(wy.pts, 1.4, 420 + k, (x, y, _i, t) => {
      if (!inside(x, y) || inShire(x, y)) return;
      const i = idx(x, y);
      if (water[i] === SEA) return;
      if (t > wy.real && hash2(x, y, 421) < (t - wy.real) * 0.9) return;
      road[i] = t < wy.real ? REAL : SENDA;
      forest[i] = 0;
    }),
  );

  // ---------- Casas sueltas: el refugio, la cabaña, los palafitos ----------
  const houses: House[] = [...c.houses];
  const put = (x: number, y: number, roof: number) => {
    if (!inside(x, y) || water[idx(x, y)]) return;
    houses.push({ x, y, roof });
    for (let yy = y - 4; yy <= y + 1; yy++)
      for (let xx = x - 3; xx <= x + 3; xx++) if (inside(xx, yy)) forest[idx(xx, yy)] = 0;
  };
  put(lakeN[0] + 24, lakeN[1] + 18, 1);
  put(470, 120, 0);
  put(480, 140, 1);
  put(156, 378, 1);
  put(166, 384, 1);
  put(150, 390, 0);
  put(-20, 360, 1);

  // ---------- Las piedras de las ruinas ----------
  const ruins: Ruin[] = [];
  const rng = new Rng('ruinas');
  const KINDS = ['muro', 'muro', 'columna', 'columnas', 'caida', 'arco', 'muroL', 'basa'];
  for (let gy = 0; gy < Y1; gy += 13)
    for (let gx = 200; gx < X1; gx += 15) {
      const x = gx + rng.int(-4, 4);
      const y = gy + rng.int(-3, 3);
      if (!inside(x, y) || inShire(x, y)) {
        rng.next();
        continue;
      }
      const i = idx(x, y);
      // Las piedras van a corros (donde hubo pueblos), más cuanto más lejos.
      const site = smooth(0.5, 0.75, fbm(x / 60, y / 50, 309, 2));
      const p = (sand[i]! / 255) * (0.04 + 0.7 * site * (wild[i]! / 255));
      const kind = KINDS[rng.int(0, KINDS.length - 1)]!;
      if (water[i] || rng.next() > p) continue;
      ruins.push({ x, y, kind });
    }
  ruins.push(...marks);
  ruins.sort((a, b) => a.y - b.y);

  const depth = new Uint8Array(N);
  for (let i = 0; i < N; i++)
    depth[i] = Math.min(255, Math.round(water[i] === SEA ? toLand[i]! : shore[i]!));

  cached = {
    x0: X0,
    y0: Y0,
    W,
    H,
    at: idx,
    inside,
    h,
    range,
    water,
    depth,
    forest,
    field,
    marsh,
    road,
    houses,
    crop: c.crop,
    sand,
    wild,
    ruins,
  };
  return cached;
}

export { ANGLE };
