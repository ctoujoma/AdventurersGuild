/**
 * El mapa en pergamino ilustrado: tinta sepia y acuarela, como el de un cartógrafo. El papel
 * tiene su tono y sus bordes tostados. El mar lleva una aguada azul junto a la costa, las líneas
 * del oleaje y olitas dibujadas. Las sierras son montes a plumilla con la cara de sombra rayada
 * y nieve en los altos. Los bosques van árbol a árbol; los ríos, con su orilla entintada; las
 * parcelas, rayadas, y los caminos, a trazos. Lleva rumbos desde la rosa de los vientos, un barco,
 * la sierpe y un marco de leguas. Lo no explorado se cubre de rayado (`inkFog`).
 */
import { MAP_H, MAP_W } from '../data/places';
import { compass, house, placeIcons, serpent, ship, stamp, whale } from './mapIcons';
import {
  BLACK,
  BROAD,
  BURNT,
  ICE,
  PINE,
  POOL,
  REAL,
  SEA,
  SENDA,
  at,
  fbm,
  hash2,
  inside,
  terrain,
} from './mapTerrain';
import { P } from './palette';
import { PixelBuffer, bayer, type Color } from './pixel';

const INK = P.umber;
const ROSE: [number, number] = [44, 240];

let cached: PixelBuffer | null = null;

export function inkMap(): PixelBuffer {
  if (cached) return cached;
  const t = terrain();
  const W = MAP_W;
  const H = MAP_H;
  const b = new PixelBuffer(W, H);
  const wat = (x: number, y: number) => (inside(x, y) ? t.water[at(x, y)]! : SEA);
  const land = (x: number, y: number) => inside(x, y) && !t.water[at(x, y)];

  // ---------- El papel ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const tone = fbm(x / 34, y / 26, 201);
      let c: Color = P.sand;
      if (tone > 0.6 && bayer(x, y) < (tone - 0.6) * 0.9) c = P.tan;
      if (hash2(x, y, 202) < 0.006) c = P.tan;
      // Bordes tostados.
      const burn = 16 - edge + (fbm(x / 6, y / 6, 203) - 0.5) * 8;
      if (burn > 0 && bayer(x, y) < burn / 16) c = burn > 11 ? P.clay : P.tan;
      b.set(x, y, c);
    }

  // ---------- El mar ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (t.water[i] !== SEA) continue;
      const d = t.depth[i]!;
      // Aguada azul que se desvanece mar adentro.
      const wash = d < 2 ? 0.6 : d < 4 ? 0.35 : d < 8 ? 0.16 : d < 14 ? 0.06 : 0;
      if (bayer(x, y) < wash) b.set(x, y, P.mist);
      // Líneas del oleaje, paralelas a la costa, más rotas cuanto más lejos.
      for (const [L, c, gap] of [
        [2.2, P.steel, 0.05],
        [4.6, P.fog, 0.2],
        [7.8, P.fog, 0.4],
        [12, P.fog, 0.6],
      ] as const)
        if (Math.abs(d - L) < 0.55 && hash2(x >> 2, y >> 2, 204 + L) > gap) b.set(x, y, c);
    }
  // Olitas sueltas mar adentro.
  for (let cy = 0; cy < H; cy += 9)
    for (let cx = 0; cx < W; cx += 13) {
      const x = cx + Math.floor(hash2(cx, cy, 205) * 9);
      const y = cy + Math.floor(hash2(cx, cy, 206) * 6);
      if (!inside(x, y) || t.water[at(x, y)] !== SEA || t.depth[at(x, y)]! < 16) continue;
      if (hash2(cx, cy, 207) < 0.45) continue;
      stamp(b, x, y, ['.s.s.', 's.s.s'], { s: P.fog }, null);
    }
  // Rumbos desde la rosa, solo sobre el mar.
  for (let a = 0; a < 16; a++) {
    const ang = (a * Math.PI) / 8;
    for (let k = 22; k < 170; k += 2) {
      const x = Math.round(ROSE[0] + Math.cos(ang) * k);
      const y = Math.round(ROSE[1] + Math.sin(ang) * k);
      if (inside(x, y) && t.water[at(x, y)] === SEA && t.depth[at(x, y)]! > 3)
        b.set(x, y, a % 2 ? P.mist : P.fog);
    }
  }

  // ---------- Aguadas de la tierra ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (t.water[i]) continue;
      const f = t.forest[i]!;
      if (f === BURNT) {
        if (bayer(x, y) < 0.35) b.set(x, y, P.tan);
      } else if (f) {
        if (bayer(x, y) < 0.1) b.set(x, y, P.lime);
      } else if (t.marsh[i]) {
        if (bayer(x, y) < 0.08) b.set(x, y, P.mist);
      } else if (t.range[i] && t.h[i]! > 0.36) {
        if (bayer(x, y) < 0.3) b.set(x, y, P.tan);
      }
    }

  // ---------- Parcelas: rayadas, con algún sembrado en color ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fi = t.field[at(x, y)]!;
      if (!fi) continue;
      const crop = t.crop(fi - 1);
      const right = x + 1 < W ? t.field[at(x + 1, y)] : 0;
      const down = y + 1 < H ? t.field[at(x, y + 1)] : 0;
      if (right !== fi || down !== fi) {
        if ((x + y) % 2 === 0) b.set(x, y, P.oak);
        continue;
      }
      const lineOn = crop.dir ? (x + y) % 3 === 0 : (x - y + 300) % 3 === 0;
      const wash = [P.gold, P.lime, null, P.tan][crop.kind];
      if (lineOn) b.set(x, y, crop.kind === 2 ? P.oak : P.clay);
      else if (wash && bayer(x, y) < 0.25) b.set(x, y, wash);
    }

  // ---------- Agua de tierra adentro ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const w = t.water[at(x, y)]!;
      if (!w || w === SEA) continue;
      const edge = [wat(x - 1, y), wat(x + 1, y), wat(x, y - 1), wat(x, y + 1)].some((v) => !v);
      let c: Color;
      if (w === ICE) c = edge ? P.steel : (x * 2 + y) % 7 === 0 ? P.fog : P.white;
      else if (w === BLACK) c = edge ? P.navy : (x + y) % 2 ? P.slate : P.steel;
      else if (w === POOL) c = edge ? P.ocean : y % 2 ? P.mist : P.sky;
      else c = edge ? P.ocean : y % 3 === 0 && !edge ? P.mist : P.sky;
      b.set(x, y, c);
    }
  // La costa entintada.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (land(x, y) && [wat(x - 1, y), wat(x + 1, y), wat(x, y - 1), wat(x, y + 1)].includes(SEA))
        b.set(x, y, INK);

  // ---------- Caminos a trazos y puentes ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = t.road[at(x, y)]!;
      if (!r) continue;
      if (t.water[at(x, y)] && t.water[at(x, y)] !== POOL) {
        b.set(x, y, P.bark);
        continue;
      }
      const k = Math.floor(hash2(x >> 1, y >> 1, 208) * 3);
      if (r === REAL && k !== 0) b.set(x, y, P.cocoa);
      else if (r === SENDA && (x + y) % 3 === 0) b.set(x, y, P.oak);
    }

  // ---------- Montes a plumilla ----------
  const peaks: [number, number, number][] = [];
  for (let gy = 0; gy < H; gy += 6)
    for (let gx = 0; gx < W; gx += 11) {
      const x = gx + Math.floor(hash2(gx, gy, 209) * 9);
      const y = gy + Math.floor(hash2(gx, gy, 210) * 5);
      if (!inside(x, y) || !t.range[at(x, y)] || t.water[at(x, y)]) continue;
      const h = t.h[at(x, y)]!;
      if (h < 0.44 || t.road[at(x, y)]) continue;
      peaks.push([x, y, Math.min(17, Math.round(5 + (h - 0.44) * 17))]);
    }
  peaks.sort((a, c) => a[1] - c[1]);
  for (const [x, y, s] of peaks) mount(b, x, y, s, hash2(x, y, 211));
  // Lomas: arcos con su sombra.
  for (let gy = 0; gy < H; gy += 6)
    for (let gx = 0; gx < W; gx += 9) {
      const x = gx + Math.floor(hash2(gx, gy, 212) * 9);
      const y = gy + Math.floor(hash2(gx, gy, 213) * 6);
      if (!inside(x, y) || t.water[at(x, y)] || t.forest[at(x, y)] || t.field[at(x, y)]) continue;
      if (t.road[at(x, y)] || t.marsh[at(x, y)]) continue;
      const h = t.h[at(x, y)]!;
      if (h < 0.24 || h >= 0.42) continue;
      if (hash2(gx, gy, 214) < 0.35) continue;
      stamp(b, x, y, ['.kkk.', 'k..hk', '...h.'], { k: INK, h: P.cocoa }, null);
    }

  // ---------- Bosques, árbol a árbol ----------
  const trees: [number, number, number][] = [];
  for (let gy = 0; gy < H; gy += 4)
    for (let gx = (gy / 4) % 2 ? 3 : 0; gx < W; gx += 5) {
      const x = gx + Math.floor(hash2(gx, gy, 215) * 3) - 1;
      const y = gy + Math.floor(hash2(gx, gy, 216) * 2);
      if (!inside(x, y)) continue;
      const f = t.forest[at(x, y)]!;
      if (!f || t.road[at(x, y)] || t.water[at(x, y)]) continue;
      trees.push([x, y, f]);
    }
  trees.sort((a, c) => a[1] - c[1]);
  for (const [x, y, f] of trees) {
    if (f === BROAD)
      stamp(
        b,
        x,
        y,
        ['.ll.', 'llLf', 'lLLf', '.ff.', '..k.'],
        { l: P.lime, L: P.leaf, f: P.leaf, k: P.bark },
        P.forest,
      );
    else if (f === PINE)
      stamp(b, x, y, ['.l.', '.lf', 'llf', '.k.'], { l: P.lime, f: P.leaf, k: P.bark }, P.forest);
    else stamp(b, x, y, ['k.k', '.k.', '.k.'], { k: P.bark }, null);
  }

  // ---------- Juncos de la marisma ----------
  for (let gy = 0; gy < H; gy += 5)
    for (let gx = 0; gx < W; gx += 7) {
      const x = gx + Math.floor(hash2(gx, gy, 217) * 4);
      const y = gy + Math.floor(hash2(gx, gy, 218) * 3);
      if (!inside(x, y) || !t.marsh[at(x, y)] || t.water[at(x, y)] || t.road[at(x, y)]) continue;
      if (hash2(gx, gy, 219) < 0.55) continue;
      stamp(b, x, y, ['g.g', '.g.', 'sss'], { g: P.leaf, s: P.fog }, null);
    }

  // ---------- Aldeas y lugares ----------
  for (const o of [...t.houses].sort((a, c) => a.y - c.y)) house(b, o.x, o.y, o.roof, P.bark);
  placeIcons(b, P.bark);

  // ---------- El mar: barco, ballena, sierpe y la rosa ----------
  ship(b, 40, 200, P.bark);
  whale(b, 22, 104, P.bark);
  serpent(b, 30, 160, P.bark);
  compass(b, ROSE[0], ROSE[1], 15, P.bark);

  border(b);
  cached = b;
  return b;
}

/**
 * Un monte a plumilla, por el centro de su base: relleno de papel (tapa a los de detrás), la
 * cara de sombra rayada, el contorno en tinta y, si es alto, nieve en la cumbre.
 */
function mount(b: PixelBuffer, x: number, y: number, s: number, r: number): void {
  const top = y - s;
  const lean = Math.round((r - 0.5) * 2);
  const ax = x + lean;
  const half = Math.round(s * 1.15);
  const snow = s >= 10;
  for (let row = 0; row <= s; row++) {
    const yy = top + row;
    const k = row / s;
    const l = Math.round(ax - (ax - (x - half)) * k);
    const rr = Math.round(ax + (x + half - ax) * k);
    // El filo de la cresta baja algo a la derecha de la cumbre.
    const ridge = Math.round(ax + k * s * 0.25);
    for (let xx = l; xx <= rr; xx++) {
      let c: Color = P.sand;
      if (xx > ridge) c = (xx + yy) % 2 === 0 ? P.cocoa : P.tan;
      else if (xx === ridge && row > 0) c = INK;
      if (snow && k < 0.35) c = xx > ridge ? P.mist : xx === ridge ? P.fog : P.white;
      b.set(xx, yy, c);
    }
    b.set(l, yy, INK);
    b.set(rr, yy, INK);
    // Rayitas de luz en la cara clara.
    if (row > 2 && row % 3 === 0 && ridge - l > 3) b.set(ridge - 2, yy, P.tan);
  }
  b.set(ax, top - 1 >= 0 ? top : top, INK);
}

/** El marco de leguas: doble filete con una banda de tramos alternos y esquinas. */
function border(b: PixelBuffer): void {
  const W = b.w;
  const H = b.h;
  const frame = (k: number, c: Color) => {
    for (let x = k; x < W - k; x++) {
      b.set(x, k, c);
      b.set(x, H - 1 - k, c);
    }
    for (let y = k; y < H - k; y++) {
      b.set(k, y, c);
      b.set(W - 1 - k, y, c);
    }
  };
  frame(0, P.bark);
  for (let k = 1; k <= 3; k++) frame(k, P.sand);
  // Los tramos.
  for (let x = 1; x < W - 1; x++)
    if (Math.floor(x / 8) % 2) for (const y of [2, 3, H - 3, H - 4]) b.set(x, y, P.bark);
  for (let y = 1; y < H - 1; y++)
    if (Math.floor(y / 8) % 2) for (const x of [2, 3, W - 3, W - 4]) b.set(x, y, P.bark);
  frame(1, P.bark);
  frame(4, P.bark);
  frame(6, P.rust);
  for (const [x, y] of [
    [3, 3],
    [W - 4, 3],
    [3, H - 4],
    [W - 4, H - 4],
  ] as const) {
    b.rect(x - 3, y - 3, 7, 7, P.bark);
    b.rect(x - 2, y - 2, 5, 5, P.gold);
    b.rect(x - 1, y - 1, 3, 3, P.wine);
    b.set(x, y, P.lemon);
  }
}

/**
 * Lo no explorado: «tierra ignota», tapada con papel y rayada a plumilla (más cruzado cuanto
 * más lejos de lo conocido).
 */
export function inkFog(known: readonly { x: number; y: number; r: number }[]): PixelBuffer {
  const b = new PixelBuffer(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      let best = Infinity;
      for (const k of known) best = Math.min(best, Math.hypot(x - k.x, y - k.y) - k.r);
      if (best <= 0) continue;
      const f = Math.min(1, best / 22) + (fbm(x / 9, y / 9, 221) - 0.5) * 0.4;
      if (f <= 0.05) continue;
      if (bayer(x, y) < Math.min(0.92, f * 1.3)) b.set(x, y, P.sand);
      if (f > 0.25 && (x + y) % 4 === 0) b.set(x, y, P.tan);
      if (f > 0.6 && (x - y + 400) % 4 === 0) b.set(x, y, P.tan);
      if (f > 0.85 && (x + y) % 8 === 0) b.set(x, y, P.clay);
    }
  return b;
}
