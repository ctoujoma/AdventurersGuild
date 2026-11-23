/**
 * El mapa a color: la comarca vista desde lo alto, como el mapa de mundo de un juego. El relieve
 * se pinta con la luz del noroeste (laderas claras y en sombra), el mar con su fondo (espuma,
 * bajíos y alta mar), los bosques copa a copa, las parcelas con sus surcos y setos, los caminos
 * de tierra con sus puentes, las aldeas, unas nubes en los Montes de la Niebla y un marco de
 * madera. La niebla de lo no explorado son nubes (`colorFog`).
 */
import { MAP_H, MAP_W } from '../data/places';
import { compass, house, placeIcons, serpent, ship, shifted, stamp, whale } from './mapIcons';
import {
  BLACK,
  BROAD,
  BURNT,
  ICE,
  LAKE,
  PINE,
  POOL,
  REAL,
  RIVER_W,
  SEA,
  SENDA,
  fbm,
  from,
  hash2,
  shadeAt,
  terrain,
  type Terrain,
} from './mapTerrain';
import { P } from './palette';
import { PixelBuffer, bayer, type Color } from './pixel';

/** Escoge de una rampa (de sombra a luz) con trama ordenada, para que las bandas no se vean. */
function ramp(r: readonly Color[], v: number, x: number, y: number, spread = 0.9): Color {
  const t = Math.max(0, Math.min(0.999, v + (bayer(x, y) - 0.5) * (spread / r.length)));
  return r[Math.floor(t * r.length)]!;
}

const GRASS = [P.forest, P.leaf, P.leaf, P.lime];
const WOOD = [P.deep, P.deep, P.forest];
const MARSH = [P.forest, P.leaf, P.leaf];
const PARDA = [P.plum, P.rust, P.clay, P.tan];
const NIEBLA = [P.navy, P.slate, P.steel, P.fog];
const ESTE = [P.ebony, P.umber, P.mocha, P.cocoa];
const SNOW = [P.steel, P.fog, P.mist, P.white];
const SAND = [P.clay, P.tan, P.sand];
const ASH = [P.ebony, P.plum, P.umber, P.mocha];

/** Cultivos: color de la parcela y de sus surcos. */
const CROPS: [Color, Color][] = [
  [P.gold, P.amber],
  [P.lime, P.leaf],
  [P.oak, P.cocoa],
  [P.tan, P.clay],
];

let cached: PixelBuffer | null = null;

/** La comarca a color. */
export function colorMap(): PixelBuffer {
  cached ??= colorRender(terrain());
  return cached;
}

/**
 * Un terreno a color (la comarca o el mapa de rumbos, que la lleva dentro), en coordenadas de la
 * comarca. `deco` pinta lo suyo antes del marco.
 */
export function colorRender(t: Terrain, deco?: (b: PixelBuffer) => void): PixelBuffer {
  const { W, H } = t;
  const X0 = t.x0;
  const Y0 = t.y0;
  const X1 = X0 + W;
  const Y1 = Y0 + H;
  const out = new PixelBuffer(W, H);
  const b = shifted(out, -X0, -Y0);
  const { at, inside } = t;
  const deep = !!t.wild;
  const wat = (x: number, y: number) => (inside(x, y) ? t.water[at(x, y)]! : SEA);

  // ---------- El suelo ----------
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = at(x, y);
      const w = t.water[i]!;
      if (w === SEA) {
        b.set(x, y, sea(t.depth[i]!, x, y, deep));
        continue;
      }
      if (w) {
        b.set(x, y, inland(w, x, y, wat));
        continue;
      }
      const h = t.h[i]!;
      let s = shadeAt(t, x, y, 10);
      // La sombra que echan las sierras (el sol, bajo, al noroeste).
      for (let k = 2; k <= 8; k += 2)
        if (inside(x - k, y - k) && t.h[at(x - k, y - k)]! > h + k * 0.035) {
          s *= 0.55;
          break;
        }
      const meadow = (fbm(x / 16, y / 16, 91) - 0.5) * 0.25;
      // Lo salvaje (solo en el mapa de rumbos): más oscuro cuanto más lejos.
      const wl = t.wild ? t.wild[i]! / 255 : 0;
      const sd = t.sand ? t.sand[i]! / 255 : 0;
      let c: Color;
      const range = t.range[i]!;
      // Dónde empieza la roca y dónde la nieve, en cada sierra.
      const rockAt = range === 2 ? 0.44 : range === 3 ? 0.54 : range === 4 ? 0.46 : 0.5;
      const snowAt = range === 2 ? 0.66 : range === 3 ? 9 : range === 4 ? 0.86 : 0.9;
      if (t.forest[i] === BURNT) c = ramp(ASH, 0.35 + (s - 0.5) * 0.8, x, y);
      else if (t.forest[i] && h < rockAt) c = ramp(WOOD, 0.5 + (s - 0.5), x, y);
      else if (t.marsh[i]) c = ramp(MARSH, 0.5 + meadow * 0.5 - wl * 0.45, x, y, 0.5);
      else if (t.depth[i]! <= 1.5 && h < 0.24) c = ramp(SAND, 0.55 + (s - 0.5), x, y);
      else if (sd && sd + (bayer(x, y) - 0.5) * 0.5 > 0.42) c = dune(x, y, s, wl);
      else {
        const rock = range === 2 || range === 4 ? NIEBLA : range === 3 ? ESTE : PARDA;
        const shaded = 0.1 + s * 0.85;
        // De la hierba a la roca y a la nieve, con trama en el paso.
        const k = (h - rockAt) / 0.06 + (bayer(x, y) - 0.5) * 1.2;
        const n = (h - snowAt) / 0.05 + (bayer(x + 1, y) - 0.5) * 0.8 + (s - 0.5) * 1.6;
        if (range && n > 0) c = ramp(SNOW, 0.2 + s * 0.85, x, y);
        else if (range && k > 0) c = ramp(rock, shaded, x, y);
        else {
          c = ramp(GRASS, 0.48 + meadow + (s - 0.5) * 1.2 - wl * 0.12 + sd * 0.25, x, y, 0.7);
          // Hacia la arena, la hierba se seca.
          if (sd > 0.12 && bayer(x + 2, y + 1) < (sd - 0.12) * 1.4) c = sd > 0.3 ? P.tan : P.lime;
        }
      }
      // La orilla de ríos y lagos, más verde y oscura.
      if (
        !t.marsh[i] &&
        [wat(x - 1, y), wat(x + 1, y), wat(x, y - 1), wat(x, y + 1)].some((v) => v && v !== SEA)
      )
        c = h > 0.5 ? P.slate : P.forest;
      b.set(x, y, c);
    }

  // ---------- Las parcelas, con surcos y setos ----------
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const f = t.field[at(x, y)]!;
      if (!f) continue;
      const crop = t.crop(f - 1);
      const [base, furrow] = CROPS[crop.kind]!;
      const right = x + 1 < X1 ? t.field[at(x + 1, y)] : 0;
      const down = y + 1 < Y1 ? t.field[at(x, y + 1)] : 0;
      if (right !== f || down !== f) {
        b.set(x, y, hash2(x, y, 7) < 0.7 ? P.forest : P.leaf);
        continue;
      }
      const line = crop.dir ? x % 2 === 0 : y % 2 === 0;
      b.set(x, y, line ? furrow : base);
    }

  // ---------- Caminos y puentes ----------
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const r = t.road[at(x, y)]!;
      if (!r) continue;
      const w = t.water[at(x, y)]!;
      if (w && r === SENDA) continue;
      if (w && w !== POOL) {
        // Puente de tablas con barandilla.
        b.set(x, y, P.oak);
        for (const [dx, dy] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ] as const)
          if (inside(x + dx, y + dy) && t.water[at(x + dx, y + dy)] && !t.road[at(x + dx, y + dy)])
            b.set(x + dx, y + dy, P.bark);
        continue;
      }
      if (r === SENDA && hash2(x, y, 3) < 0.3) continue;
      b.set(x, y, r === REAL ? (hash2(x, y, 4) < 0.85 ? P.sand : P.tan) : P.tan);
      // El camino real, de dos de ancho con su sombra; el sendero, con la suya.
      const below = inside(x, y + 1) && !t.road[at(x, y + 1)] && !t.water[at(x, y + 1)];
      if (r === REAL && below) {
        b.set(x, y + 1, P.tan);
        if (inside(x, y + 2) && !t.road[at(x, y + 2)] && !t.water[at(x, y + 2)])
          b.set(x, y + 2, P.cocoa);
      } else if (below) b.set(x, y + 1, P.cocoa);
    }

  // ---------- Bosques, copa a copa ----------
  const trees: [number, number, number][] = [];
  for (let gy = from(Y0, 2); gy < Y1; gy += 2)
    for (let gx = from(X0, 3) + ((gy / 2) % 2 ? 1 : 0); gx < X1; gx += 3) {
      const x = gx + Math.floor(hash2(gx, gy, 11) * 3) - 1;
      const y = gy + Math.floor(hash2(gx, gy, 12) * 2);
      if (!inside(x, y)) continue;
      const f = t.forest[at(x, y)]!;
      if (!f || t.road[at(x, y)] || t.water[at(x, y)]) continue;
      if (f === BURNT && hash2(x, y, 13) < 0.45) continue;
      trees.push([x, y, f]);
    }
  trees.sort((a, c) => a[1] - c[1]);
  for (const [x, y, f] of trees) {
    // En lo hondo del bosque (mapa de rumbos), copas más oscuras.
    const dark = t.wild ? t.wild[at(x, y)]! / 255 + (hash2(x, y, 18) - 0.5) * 0.5 > 0.55 : false;
    if (f === BROAD) {
      const tone = hash2(x, y, 14) < 0.25;
      stamp(
        b,
        x,
        y,
        ['.hl.', 'hllf', 'llff', '.fd.'],
        dark
          ? { h: P.leaf, l: P.forest, f: P.deep, d: P.black }
          : tone
            ? { h: P.leaf, l: P.leaf, f: P.forest, d: P.deep }
            : { h: P.lime, l: P.leaf, f: P.forest, d: P.deep },
        null,
      );
      if (inside(x + 2, y + 1)) b.set(x + 2, y + 1, dark ? P.black : P.deep);
    } else if (f === PINE) {
      const snowy = t.h[at(x, y)]! > 0.6;
      stamp(
        b,
        x,
        y,
        ['.l.', '.ld', 'lfd', 'lfd', '.b.'],
        dark && !snowy
          ? { l: P.forest, f: P.deep, d: P.black, b: P.bark }
          : { l: snowy ? P.mist : P.leaf, f: P.forest, d: P.deep, b: P.bark },
        null,
      );
    } else
      stamp(
        b,
        x,
        y,
        ['k.', 'kk', '.k', '.k'],
        { k: hash2(x, y, 15) < 0.5 ? P.ebony : P.bark },
        null,
      );
  }

  // ---------- Charcas y juncos de la marisma ----------
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = at(x, y);
      if (!t.marsh[i] || t.water[i] || t.forest[i] || t.road[i]) continue;
      if (hash2(x, y, 16) < 0.06) {
        b.set(x, y, P.leaf);
        if (inside(x, y - 1)) b.set(x, y - 1, hash2(x, y, 17) < 0.5 ? P.lime : P.oak);
      }
    }

  // ---------- Aldeas y lugares ----------
  for (const o of [...t.houses].sort((a, c) => a.y - c.y)) house(b, o.x, o.y, o.roof, P.black);
  placeIcons(b, P.black);

  // ---------- Nubes en los Montes de la Niebla ----------
  for (const [cx, cy, r] of [
    [72, 34, 12],
    [100, 22, 9],
    [58, 58, 8],
  ] as const)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r * 2; x <= cx + r * 2; x++) {
        if (!inside(x, y)) continue;
        const d = Math.hypot((x - cx) / 2, y - cy) / r + (fbm(x / 5, y / 5, 99) - 0.5) * 0.6;
        if (d > 1) continue;
        const top = y < cy - r * 0.2;
        const c =
          d > 0.85 ? (bayer(x, y) < 0.5 ? P.mist : null) : top ? P.white : d > 0.6 ? P.fog : P.mist;
        if (c) b.set(x, y, c);
      }

  // ---------- Mar: barco, ballena, sierpe y la rosa ----------
  ship(b, 40, 200, P.black);
  whale(b, 22, 104, P.black);
  serpent(b, 30, 160, P.black);
  compass(b, 44, 240, 15, P.bark);

  deco?.(b);
  frame(out);
  return out;
}

/**
 * El mar según la distancia a tierra: espuma, bajío, mar y alta mar; con olas sueltas. Con
 * `deep` (el mapa de rumbos, de mar más ancho), la alta mar tiene vetas y se va más despacio.
 */
function sea(d: number, x: number, y: number, deep = false): Color {
  if (d <= 1) return bayer(x, y) < 0.6 ? P.white : P.mist;
  if (d <= 2) return bayer(x, y) < 0.3 ? P.mist : P.cyan;
  const v = deep
    ? Math.max(1 - Math.min(1, (d - 2) / 60), 0.1 + (fbm(x / 70, y / 34, 23, 3) - 0.5) * 0.5)
    : 1 - Math.min(1, (d - 2) / 44);
  let c: Color = ramp([P.navy, P.ocean, P.ocean, P.ocean, P.sky, P.sky], v, x, y, 1.4);
  // Olas: rayitas claras sueltas.
  const cx = Math.floor(x / 9);
  const cy = Math.floor(y / 6);
  const hx = Math.floor(hash2(cx, cy, 21) * 6);
  if (hash2(cx, cy, 22) < 0.35 && y % 6 === 3 && x % 9 >= hx && x % 9 < hx + 3)
    c = c === P.navy ? P.ocean : c === P.ocean ? P.sky : P.mist;
  return c;
}

/**
 * La arena de las ruinas: dunas en media luna (cresta clara, cara de sombra), más altas y
 * seguidas cuanto más lejos; entre ellas, arena llana con su luz.
 */
function dune(x: number, y: number, s: number, wl: number): Color {
  const warp = fbm(x / 38, y / 30, 92, 3) * 22 + Math.sin(x / 19) * 4;
  const q = ((((y + warp) / 9) % 1) + 1) % 1;
  const on = fbm(x / 26, y / 18, 93, 2) < 0.35 + 0.35 * wl;
  if (on && q < 0.18) return bayer(x, y) < 0.7 ? P.sand : P.tan;
  if (on && q < 0.42) return bayer(x, y) < 0.5 + (0.42 - q) * 2 ? P.clay : P.tan;
  return ramp(SAND, 0.62 + (s - 0.5) * 0.6, x, y);
}

/** El agua de tierra adentro: ríos, lagos, charcas, el lago Helado y la laguna Negra. */
function inland(w: number, x: number, y: number, wat: (x: number, y: number) => number): Color {
  const edge = [wat(x - 1, y), wat(x + 1, y), wat(x, y - 1), wat(x, y + 1)].some((v) => !v);
  if (w === ICE) {
    if (edge) return P.steel;
    const crack = Math.abs(Math.sin(x * 0.7 + y * 1.3)) < 0.08;
    return crack ? P.fog : bayer(x, y) < 0.2 ? P.white : P.mist;
  }
  if (w === BLACK) return edge ? P.black : bayer(x, y) < 0.15 ? P.slate : P.navy;
  if (w === POOL) return edge ? P.deep : bayer(x, y) < 0.2 ? P.sky : P.ocean;
  if (edge) return P.ocean;
  if (w === RIVER_W || w === LAKE) return hash2(x, y, 5) < 0.08 ? P.mist : P.sky;
  return P.sky;
}

/** El marco: madera oscura con su luz y tachones de oro en las esquinas. */
function frame(b: PixelBuffer): void {
  const W = b.w;
  const H = b.h;
  for (let k = 0; k < 4; k++) {
    const c = [P.black, P.bark, P.oak, P.black][k]!;
    for (let x = k; x < W - k; x++) {
      b.set(x, k, c);
      b.set(x, H - 1 - k, c);
    }
    for (let y = k; y < H - k; y++) {
      b.set(k, y, c);
      b.set(W - 1 - k, y, c);
    }
  }
  for (const [x, y] of [
    [2, 2],
    [W - 3, 2],
    [2, H - 3],
    [W - 3, H - 3],
  ] as const) {
    b.rect(x - 2, y - 2, 5, 5, P.black);
    b.rect(x - 1, y - 1, 3, 3, P.gold);
    b.set(x - 1, y - 1, P.lemon);
  }
}

/** Lo no explorado, cubierto de nubes (más espesas cuanto más lejos de lo conocido). */
export function colorFog(known: readonly { x: number; y: number; r: number }[]): PixelBuffer {
  const b = new PixelBuffer(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      let best = Infinity;
      for (const k of known) best = Math.min(best, Math.hypot(x - k.x, y - k.y) - k.r);
      if (best <= 0) continue;
      // Bancos de nubes: espesas lejos de lo conocido, con borde tramado y panza en sombra.
      const dens = (x2: number, y2: number) =>
        Math.min(1, best / 18) + (fbm(x2 / 26, y2 / 15, 131, 3) - 0.5) * 0.9;
      const d = dens(x, y);
      if (d < 0.32) continue;
      if (d < 0.42) {
        if (bayer(x, y) < (d - 0.32) / 0.1) b.set(x, y, P.mist);
        continue;
      }
      // Bolas de nube: claras por arriba y con su panza en sombra; el borde de abajo, gris.
      const puff = (y2: number) => fbm(x / 18, y2 / 10, 141, 2);
      const p = puff(y);
      const belly = dens(x, y + 3) < 0.42 || p - puff(y + 3) > 0.06;
      const lit = puff(y - 3) - p > 0.04;
      const c = belly ? P.fog : lit || p > 0.6 ? P.white : P.mist;
      b.set(x, y, c);
    }
  return b;
}
