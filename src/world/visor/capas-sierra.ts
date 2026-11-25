/**
 * El paisaje de la sierra (rumbo norte): cerca de casa, pastos de altura con muros de piedra seca,
 * bordas y rebaños; lejos, canchales, pino negro cada vez más bajo y torcido, peñascos con hitos y
 * la nieve que baja hasta el camino. Las cumbres, mucho más cerca y más altas que desde el bosque.
 */
import { pine, pineSmall, rock, tuft } from './arboles';
import { paintRange, step, type Paisaje, type Painter } from './capas';
import { M, Tonos, clamp01, fbm1, hash2, lerp, noise2, smooth, type Mat } from './tonos';

/** Rampas de la sierra: pasto alpino, pino negro, brezo y liquen. */
export const SIERRA_RAMPS = {
  [M.hierba]: ['#22301f', '#2e3f26', '#3d522c', '#536a35', '#6e823f', '#8e9a4c', '#b0b262'],
  [M.pino]: ['#0c181c', '#122226', '#1a2f30', '#264139', '#355443', '#4b6a50', '#68845e'],
  [M.viejo]: ['#0a1216', '#0e1a1e', '#142426', '#1c312f', '#284036', '#385242', '#4c664e'],
  [M.mies]: ['#3a2338', '#553047', '#714057', '#8e5468', '#a86e7c', '#c4909a'],
  [M.musgo]: ['#3a3a2a', '#545232', '#706a3a', '#8e8646', '#aca458', '#c8c070'],
  [M.monte]: ['#283050', '#36426a', '#4a587e', '#5e6e92', '#7686a6', '#93a2bc', '#b6c2d4'],
  [M.valla]: ['#1e1c26', '#2c2a36', '#3c3c4a', '#505262', '#686c7c', '#868c9a'],
};

const ridged = (v: number) => 1 - Math.abs(v * 2 - 1);

/** Nieve en lo alto de todo lo pintado (copetes): lo que no tiene nada encima. */
export function nevar(t: Tonos, k: number, seed: number, deep = 0.55): void {
  if (k <= 0) return;
  for (let x = 0; x < t.w; x++)
    for (let y = 1; y < t.h; y++) {
      const c = t.d[y * t.w + x]!;
      if (!c || t.d[(y - 1) * t.w + x]) continue;
      if (c >> 4 === M.nieve || c >> 4 === M.corteza) continue;
      if (hash2(x, y, seed) > k) continue;
      t.set(x, y, M.nieve, 4 + (hash2(x, y, seed + 1) < 0.4 ? 1 : 0));
      if (y + 1 < t.h && t.d[(y + 1) * t.w + x] && hash2(x, y, seed + 2) < k * deep)
        t.set(x, y + 1, M.nieve, 2);
    }
}

/** Cuánta nieve hay en el suelo a esta lejanía (0 en los pastos, 1 arriba del todo). */
let extra = 0;
const snowAt = (wild: number) => clamp01(smooth(0.35, 1, wild) + extra * 0.55);

// ---------- Cumbres ----------

const lejos: Painter = (e, L, wild, seed, o) => {
  extra = o.snow ?? 0;
  const H = Math.round(e.hor * lerp(0.78, 0.92, wild));
  const t = new Tonos(L, H + 2);
  const amp = H * 0.98;
  const tops = Array.from({ length: L }, (_, x) => {
    const r1 = ridged(fbm1(x, 120, L, seed + 101, 3));
    const r2 = ridged(fbm1(x, 38, L, seed + 102, 2));
    return H + 1 - Math.min(1, 0.3 + 0.5 * r1 ** 1.5 + 0.22 * r2 * r1) * amp;
  });
  paintRange(t, tops, {
    snow: H - amp * lerp(0.42, 0.25, wild),
    seed: seed + 103,
    mat: M.monte,
    foot: 0.45,
  });
  return [t, e.hor - H + 1];
};

const sierra: Painter = (e, L, wild, seed) => {
  const H = Math.round(e.hor * lerp(0.42, 0.58, wild));
  const t = new Tonos(L, H + 3);
  const tops = Array.from({ length: L }, (_, x) => {
    const r1 = ridged(fbm1(x, 70, L, seed + 111, 3));
    const n = fbm1(x, 22, L, seed + 112, 2);
    return H - Math.min(1, 0.22 + 0.6 * r1 ** 1.2 + 0.2 * n) * H * 0.96;
  });
  paintRange(t, tops, {
    snow: H * lerp(0.25, 0.7, wild),
    seed: seed + 114,
    mat: M.roca,
    foot: 0.2,
  });
  // Pinitos en la falda, que se acaban con la altura.
  const trees = 1 - smooth(0.3, 0.85, wild);
  for (let i = 0; i < L / 2; i++) {
    if (hash2(i, 9, seed) > trees) continue;
    const x = Math.round(i * 2 + hash2(i, 1, seed) * 2);
    const top = tops[x % L]!;
    const y = Math.round(lerp(Math.max(top + 4, H * 0.62), t.h + 2, hash2(i, 2, seed) ** 0.6));
    if (y < top + 3) continue;
    pineSmall(t, x, y, 3 + Math.round(hash2(i, 3, seed) * 2), M.pino, i, -0.6);
  }
  return [t, e.hor - H + 1];
};

// ---------- Pastos y canchales ----------

function borda(t: Tonos, x: number, base: number, s: number) {
  const w = 9 + (s % 2) * 3;
  const h = 4;
  for (let y = base - h; y <= base; y++)
    for (let i = 0; i < w; i++)
      t.set(x + i, y, M.roca, (i < 2 ? 3 : 4) - (hash2(i, y, s) < 0.3 ? 1 : 0), true);
  // Tejado de losa, oscuro, a dos aguas muy tendido.
  for (let j = 0; j < 3; j++)
    for (let i = -1 + j; i <= w - j; i++)
      t.set(x + i, base - h - 1 - j, M.valla, j === 2 ? 3 : i < w / 2 ? 2 : 1, true);
  t.set(x + 3, base - 1, M.corteza, 0, true);
  t.set(x + 3, base - 2, M.corteza, 0, true);
}

const colinas: Painter = (e, L, wild, seed) => {
  const y0 = e.hor - Math.round(e.hor * 0.22);
  const H = e.ground - y0 + 4;
  const t = new Tonos(L, H);
  const amp = H * 0.6;
  const tops = Array.from({ length: L }, (_, x) => 1 + (1 - fbm1(x, 90, L, seed + 121, 3)) * amp);
  const farm = clamp01(1 - wild * 2.6);
  const snow = snowAt(wild);
  for (let x = 0; x < L; x++) {
    const tp = Math.round(tops[x]!);
    const slope = tops[(x + 2) % L]! - tops[(x - 2 + L) % L]!;
    for (let y = tp; y < H; y++) {
      const u = (y - tp) / Math.max(1, H - tp);
      const n = noise2(x / 6, y / 3, seed + 122, Math.round(L / 6));
      let v = 3.4 - u * 1.4 + (n - 0.5) * 1.1 + (slope > 0.4 ? -0.7 : slope < -0.4 ? 0.5 : 0);
      let m: Mat = M.hierba;
      // Canchales: abanicos de piedra suelta que bajan de lo alto.
      const fan = noise2(x / 14, 0.5, seed + 123, Math.round(L / 14));
      const scree = fan > lerp(0.78, 0.5, wild) && u < 0.25 + (fan - 0.5) * 1.3;
      if (scree) {
        m = M.roca;
        v = 3.4 + (hash2(x, y, seed) - 0.5) * 2.2 - u;
      }
      // Brezo en flor a manchas (los pastos de cerca).
      else if (n > 0.7 && farm > 0.2 && u > 0.2) m = M.mies;
      // Neveros: manchas arriba que bajan con la lejanía.
      const sn = noise2(x / 10, y / 5, seed + 124, Math.round(L / 10));
      if (sn < snow * 1.1 - u * 0.6) {
        m = M.nieve;
        v = 3.6 - u * 1.2 + (slope > 0.4 ? -1 : 0.4);
      }
      t.set(x, y, m, step(v, x, y));
    }
  }
  // Muros de piedra seca que siguen la ladera (cerca de casa).
  if (farm > 0)
    for (let r = 0; r < 3; r++) {
      const dy = 4 + r * 5;
      for (let x = 0; x < L; x++) {
        const k = Math.floor(x / 50);
        if (hash2(k, r, seed + 125) > farm * 0.8) continue;
        const y = Math.round(tops[x]! + dy + (fbm1(x, 30, L, seed + 126 + r, 2) - 0.5) * 3);
        if (y >= H - 1) continue;
        t.set(x, y, M.roca, x % 3 === 0 ? 2 : 4, true);
        t.set(x, y + 1, M.roca, 1, true);
      }
    }
  // Bordas y un rebaño.
  if (farm > 0.15) {
    for (let k = 0; k < L / 90; k++) {
      if (hash2(k, 31, seed) > 0.5 * farm) continue;
      const x = Math.round(k * 90 + hash2(k, 32, seed) * 40);
      borda(t, x, Math.round(tops[x % L]!) + 8, k + seed);
    }
    for (let g = 0; g < L / 120; g++) {
      if (hash2(g, 33, seed) > farm) continue;
      const cx = Math.round(g * 120 + hash2(g, 34, seed) * 60);
      for (let i = 0; i < 6; i++) {
        const x = cx + Math.round(hash2(g, i, seed + 35) * 18);
        const y = Math.round(tops[x % L]!) + 6 + Math.round(hash2(g, i, seed + 36) * 6);
        t.set(x, y, M.nieve, 5, true);
        t.set(x + 1, y, M.nieve, 4, true);
        t.set(x, y + 1, M.corteza, 0, true);
      }
    }
  }
  // Pinos negros en rodales, cada vez menos.
  const forest = 1 - smooth(0.2, 0.9, wild);
  for (let r = 0; r < Math.ceil(H / 3); r++)
    for (let i = 0; i < L / 3; i++) {
      const id = r * 991 + i;
      const x = Math.round(i * 3 + hash2(id, 1, seed) * 3);
      const tp = tops[((x % L) + L) % L]!;
      const y = Math.round(tp + 3 + r * 3 + hash2(id, 2, seed) * 2);
      if (y >= H + 2) continue;
      const clump = noise2(x / 22, r / 3, seed + 127, Math.round(L / 22));
      if (clump < 0.6 || hash2(id, 3, seed) > forest) continue;
      pineSmall(t, x, y, Math.round(4 + hash2(id, 5, seed) * 4), M.pino, id, r / 8 - 0.3);
    }
  nevar(t, snow * 0.7, seed + 128);
  return [t, y0];
};

// ---------- Pino negro y peñascos ----------

/** Un peñasco grande: caras planas con la luz a la izquierda y grietas. */
export function crag(t: Tonos, x: number, base: number, w: number, h: number, s: number) {
  h = Math.min(h, w * 0.6);
  const top = (i: number) => {
    const u = (i / w) * 2 - 1;
    const r = ridged(fbm1(i + s * 13, 10, 1 << 12, s, 2));
    return base - h * Math.max(0, 1 - u * u) ** 0.45 * (0.72 + 0.28 * r);
  };
  for (let i = 0; i < w; i++) {
    const tp = Math.round(top(i));
    const sl = top(i + 3) - top(i - 3);
    for (let y = tp; y <= base; y++) {
      const d = y - tp;
      // Caras: la de la izquierda al sol, la de la derecha en sombra; el pie, más oscuro.
      let v = sl > 1 ? 2 : sl < -1 ? 4.6 : 3.6;
      v += (noise2((x + i) / 4, y / 6, s, 1 << 12) - 0.5) * 1.4 - (d / h) * 1.1;
      if (noise2((x + i) / 2, y / 9, s + 5, 1 << 12) < 0.12) v -= 1.6; // grietas
      if (d === 0) v += 1;
      t.set(x + i, y, M.roca, step(v, x + i, y), true);
    }
  }
}

/** Un hito: piedras apiladas que marcan el camino. */
function hito(t: Tonos, x: number, base: number, s: number) {
  let y = base;
  let w = 5;
  while (w > 1) {
    const h = 2;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        t.set(x - (w >> 1) + i, y - j, M.roca, i === 0 ? 4 : i === w - 1 ? 1 : 3, true);
    y -= h;
    w -= 1 + (hash2(w, s, 1) < 0.4 ? 1 : 0);
  }
}

const medio: Painter = (e, L, wild, seed) => {
  const H = Math.round(e.ground * 0.62);
  const y0 = e.ground + 2 - H;
  const t = new Tonos(L, H);
  const base = H - 2;
  const gap = Math.round(lerp(11, 22, wild));
  const density = lerp(0.85, 0.3, smooth(0.2, 1, wild));
  for (let i = 0; i < L / gap; i++) {
    const x = Math.round(i * gap + hash2(i, 1, seed + 140) * gap * 0.8);
    const b = base - Math.round(hash2(i, 3, seed + 140) * 3);
    if (hash2(i, 2, seed + 140) < density) {
      // El pino negro: más bajo y más torcido cuanto más arriba.
      const h = Math.round(lerp(22, 10, wild) + hash2(i, 8, seed + 140) * lerp(12, 6, wild));
      pine(t, x, b, Math.min(H - 1, h), { seed: i * 13 + seed, old: wild * 0.6, fat: 1.1 });
    } else if (hash2(i, 4, seed + 140) < 0.6) {
      rock(t, x, b + 1, 8 + Math.round(hash2(i, 5, seed) * 8), 4 + Math.round(wild * 5), i);
    }
  }
  nevar(t, snowAt(wild) * 0.8, seed + 141);
  return [t, y0];
};

const cerca: Painter = (e, L, wild, seed) => {
  const H = e.ground + 7;
  const t = new Tonos(L, H);
  const base = e.ground + 4;
  const snow = snowAt(wild);
  for (let x = 0; x < L; x++) {
    const top = e.ground + Math.round(fbm1(x, 40, L, seed + 150, 2) * 2);
    for (let y = top; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 151, Math.round(L / 3));
      const sn = noise2(x / 9, y / 3, seed + 152, Math.round(L / 9));
      if (sn < snow * 0.9) t.set(x, y, M.nieve, step(3.2 + (n - 0.5), x, y));
      else t.set(x, y, M.hierba, step(2.4 + (n - 0.5) * 1.6, x, y));
    }
  }
  // Peñascos grandes de tanto en tanto (más a más altura).
  const big = Math.round(L / 150);
  for (let k = 0; k < big; k++) {
    if (hash2(k, 1, seed + 153) > lerp(0.4, 0.9, wild)) continue;
    const x = Math.round(k * 150 + hash2(k, 2, seed + 153) * 60);
    const w = 30 + Math.round(hash2(k, 3, seed) * 30);
    crag(t, x, base + 1, w, Math.round(e.ground * lerp(0.3, 0.55, hash2(k, 4, seed))), k + seed);
  }
  // Pinos negros torcidos sueltos.
  const gap = Math.round(lerp(40, 70, wild));
  for (let i = 0; i < L / gap; i++) {
    if (hash2(i, 2, seed + 160) > lerp(0.85, 0.35, wild)) continue;
    const x = Math.round(i * gap + hash2(i, 1, seed + 160) * gap * 0.6);
    const h = Math.round(lerp(46, 22, wild) + hash2(i, 7, seed) * 18);
    pine(t, x, base, h, { seed: i * 31 + seed, old: 0.3 + wild * 0.5, fat: 1.2 });
  }
  // Hitos y piedras a la orilla del camino.
  for (let i = 0; i < L / 60; i++) {
    const x = Math.round(i * 60 + hash2(i, 1, seed + 170) * 30);
    if (hash2(i, 2, seed + 170) < 0.35 + wild * 0.4) hito(t, x, base + 1, i);
    else rock(t, x, base + 2, 7, 4, i);
    if (hash2(i, 3, seed + 170) < 0.6) tuft(t, x + 10, base + 2, 5, i, M.musgo);
  }
  nevar(t, snow * 0.8, seed + 171);
  return [t, 0];
};

// ---------- El suelo y el camino ----------

const suelo: Painter = (e, L, wild, seed) => {
  const y0 = e.ground + 4;
  const H = e.h - y0;
  const t = new Tonos(L, H);
  const path = e.feet - y0 - 1;
  const half = lerp(5, 3, wild);
  const snow = snowAt(wild);
  for (let x = 0; x < L; x++) {
    const wob = (fbm1(x, 50, L, seed + 180, 3) - 0.5) * 3;
    const top = path - half + wob;
    const bot = path + half * 0.8 + wob * 0.6;
    for (let y = 0; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 181, Math.round(L / 3));
      const sn = noise2(x / 12, y / 4, seed + 182, Math.round(L / 12));
      const onPath = y >= top && y <= bot;
      if (onPath) {
        // Senda de piedra: losas y cascajo; con nieve, pisada (gris azulado).
        const u = (y - top) / Math.max(1, bot - top);
        if (sn < snow * 1.05) {
          t.set(x, y, M.nieve, step(1.6 + u * 0.6 + (n - 0.5) * 0.8, x, y));
          continue;
        }
        const slab = noise2(x / 4, y / 2, seed + 183, Math.round(L / 4));
        if (slab > 0.62) t.set(x, y, M.roca, step(3.2 - u + (n - 0.5), x, y));
        else
          t.set(x, y, M.tierra, step(3 - u * 0.8 + (n - 0.5) * 1.4 - (y < top + 1 ? 1 : 0), x, y));
        continue;
      }
      const near = y > bot ? (y - bot) / Math.max(1, H - bot) : 0;
      if (sn < snow * 1.15 - 0.05) {
        t.set(
          x,
          y,
          M.nieve,
          step(3.4 + near * 0.8 + (n - 0.5) * 0.6 - (y > bot && y < bot + 2 ? 1.2 : 0), x, y),
        );
        continue;
      }
      let v = 2.6 + (n - 0.5) * 1.5 + near * 0.6;
      if (y > bot && y < bot + 2) v -= 1;
      t.set(x, y, hash2(x, y, 184) < 0.12 ? M.musgo : M.hierba, step(v, x, y));
    }
  }
  // Piedras sueltas y matas.
  for (let i = 0; i < L / 9; i++) {
    const x = Math.round(i * 9 + hash2(i, 1, seed + 185) * 9);
    const y = Math.round(hash2(i, 2, seed + 185) * (H - 2));
    if (Math.abs(y - path) < half + 1) continue;
    const r = hash2(i, 3, seed + 185);
    if (r < 0.35) rock(t, x, y + 2, 4 + Math.round(r * 8), 2 + Math.round(r * 4), i);
    else if (r < 0.6) tuft(t, x, y + 1, 4, i, M.musgo, 0.5);
  }
  nevar(t, snow * 0.5, seed + 186, 0.3);
  return [t, y0];
};

const delante: Painter = (e, L, wild, seed) => {
  const H = Math.max(14, Math.min(28, e.h - e.feet - 6));
  const t = new Tonos(L, H);
  const base = H - 1;
  for (let i = 0; i < L / 26; i++) {
    const x = Math.round(i * 26 + hash2(i, 1, seed + 190) * 14);
    const k = hash2(i, 3, seed + 190);
    if (hash2(i, 2, seed + 190) > 0.7) continue;
    if (k < 0.45) rock(t, x, base + 3, 14 + Math.round(k * 12), Math.round(H * 0.45), i);
    else if (k < 0.75) {
      // Cardo: tallo, hojas con pinchos y la flor morada.
      tuft(t, x, base, Math.round(H * 0.5), i, M.musgo);
      t.set(x, base - Math.round(H * 0.5), M.mies, 4, true);
      t.set(x + 1, base - Math.round(H * 0.5), M.mies, 3, true);
      t.set(x, base - Math.round(H * 0.5) - 1, M.mies, 5, true);
    } else tuft(t, x, base, Math.round(H * 0.7), i, M.hierba);
  }
  nevar(t, snowAt(wild) * 0.9, seed + 191);
  return [t, e.h - H];
};

export const SIERRA: Paisaje = {
  capas: { lejos, sierra, colinas, medio, cerca, suelo, delante },
};
