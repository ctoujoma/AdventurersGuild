/**
 * El paisaje de las ruinas (rumbo sureste): tierra seca y ocre. Cerca de casa, olivares y viñas en
 * bancales con algún cortijo; lejos, mesetas de estratos, un acueducto que cruza el valle, columnas
 * en pie, arcos rotos, cipreses y la calzada de losas que se va tapando de arena.
 */
import { bush, leafy, rock, tuft } from './arboles';
import { step, type Paisaje, type Painter } from './capas';
import { M, Tonos, clamp01, fbm1, hash2, lerp, noise2, smooth } from './tonos';

/** Rampas de las ruinas: hierba seca, ciprés, olivo, arena, caliza, mármol y terracota. */
export const RUINAS_RAMPS = {
  [M.hierba]: ['#3a2e1e', '#54422a', '#6e5a34', '#8a7440', '#a68e4e', '#c2aa62', '#dcc67c'],
  [M.pino]: ['#0e1a16', '#14241c', '#1c3024', '#263e2c', '#344e34', '#46603e', '#5c744a'],
  [M.hoja]: ['#252a22', '#343a2e', '#464e3c', '#5c644c', '#76805e', '#929c74', '#b0b890'],
  [M.viejo]: ['#2a2418', '#3a3220', '#4c4228', '#605432', '#76683e', '#8e7e4c', '#a8965e'],
  [M.tierra]: ['#4a3424', '#664830', '#86603c', '#a67c4c', '#c29a62', '#dab87e', '#ecd4a0'],
  [M.roca]: ['#3a2e2e', '#54443e', '#70604e', '#8e7c62', '#ac9a7c', '#c8b898', '#e2d6ba'],
  [M.monte]: ['#5a3e48', '#6e4c52', '#84605e', '#9a7466', '#b08a74', '#c4a286', '#d8bc9c'],
  [M.nieve]: ['#7a7484', '#968e9a', '#b4aab2', '#d0c8ca', '#e8e2de', '#fff8f0'],
  [M.valla]: ['#3a1e1a', '#5a2c22', '#7c3e2a', '#9c5434', '#ba6e42', '#d48c58'],
  [M.musgo]: ['#4a3a1a', '#6a5222', '#8c6c2a', '#ae8a36', '#cca848', '#e4c460'],
};

/** Una columna de mármol: fuste con estrías, basa y capitel (o rota a media altura). */
export function columna(t: Tonos, x: number, base: number, h: number, s: number, broken = 0) {
  const w = Math.max(2, Math.round(h / 19));
  const hh = broken ? Math.round(h * (1 - broken)) : h;
  for (let y = base - hh; y <= base; y++) {
    const top = base - hh;
    // Rota: el canto de arriba mellado.
    for (let dx = -w; dx <= w; dx++) {
      if (broken && y < top + 3 && hash2(dx, y, s) < (top + 3 - y) * 0.35) continue;
      const flute = (dx + w) % 2 === 0 ? -0.5 : 0;
      const v =
        3 -
        (dx / w) * 2.2 +
        flute +
        (hash2(dx, y >> 2, s + 1) - 0.5) * 0.4 -
        (y > base - 4 ? 0.6 : 0);
      t.set(x + dx, y, M.nieve, step(v, x + dx, y), true);
    }
  }
  // Basa.
  for (let dx = -w - 1; dx <= w + 1; dx++) {
    t.set(x + dx, base, M.nieve, 2 - (dx > 0 ? 1 : 0), true);
    t.set(x + dx, base - 1, M.nieve, 4 - (dx > 0 ? 1 : 0), true);
  }
  // Capitel (si está entera).
  if (!broken) {
    for (let dx = -w - 2; dx <= w + 2; dx++) {
      t.set(x + dx, base - h - 1, M.nieve, 4 - (dx > 0 ? 1 : 0), true);
      t.set(x + dx, base - h, M.nieve, 2, true);
    }
  }
}

/** Un ciprés: huso alto y estrecho, oscuro. */
export function cipres(t: Tonos, x: number, base: number, h: number, s: number) {
  const w = h * 0.13;
  t.set(x, base, M.corteza, 1, true);
  for (let j = 1; j < h; j++) {
    const u = j / h;
    const half = w * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 + (u < 0.15 ? 0.5 : 0);
    for (let dx = Math.floor(-half - 0.5); dx <= half + 0.5; dx++) {
      if (Math.abs(dx) > half + (hash2(dx, j >> 1, s) - 0.5)) continue;
      const v =
        2.8 - (dx / Math.max(1, half)) * 1.3 + (hash2((x + dx) >> 1, j >> 1, s + 2) - 0.5) * 1.3;
      t.set(x + dx, base - j, M.pino, step(v, x + dx, base - j), true);
    }
  }
}

/** Un trozo de muro de sillares (con un arco si cabe), roto en diagonal a sillares. */
function muro(t: Tonos, x: number, base: number, w: number, h: number, s: number, arch: boolean) {
  const flip = hash2(s, 1, 2) < 0.5;
  const tops = Array.from({ length: w }, (_, i) => {
    const u = (flip ? w - 1 - i : i) / w;
    const drop = Math.max(0, u - 0.35) * 1.4 * h * (0.6 + hash2(Math.floor(i / 4), s, 3) * 0.6);
    return base - h + Math.round(drop / 3) * 3;
  });
  const ax = w / 2;
  const ar = Math.min(w * 0.22, h * 0.32);
  const spring = base - h * 0.45;
  for (let i = 0; i < w; i++)
    for (let y = tops[i]!; y <= base; y++) {
      const dx = i + 0.5 - ax;
      if (arch && Math.abs(dx) < ar && (y > spring || Math.hypot(dx, y - spring) < ar)) continue;
      // Dovelas alrededor del arco.
      const voussoir =
        arch && Math.abs(dx) < ar + 2 && y <= spring && Math.hypot(dx, y - spring) < ar + 2;
      const row = Math.floor((base - y) / 3);
      const joint = (base - y) % 3 === 0 || (i + row * 3) % 7 === 0;
      let v = (joint ? 2 : 3.4) + (hash2((i + row * 3) / 7, row, s) - 0.5) * 1.2;
      if (voussoir) v = joint ? 2 : 4;
      if (y === tops[i]) v += 0.8;
      if (i === w - 1 || (i < w - 1 && tops[i + 1]! > y)) v -= 1.2;
      t.set(x + i, y, M.roca, step(v, x + i, y), true);
    }
}

const lejos: Painter = (e, L, _wild, seed) => {
  const H = Math.round(e.hor * 0.42);
  const t = new Tonos(L, H + 2);
  // Mesas: lomas recortadas a la altura de una capa dura (cima plana, cantil y talud).
  const cap = (x: number) => 0.5 + 0.4 * fbm1(x, 200, L, seed + 303, 2);
  const hgt = Array.from({ length: L }, (_, x) => {
    const n = clamp01((fbm1(x, 90, L, seed + 301, 3) - 0.28) / 0.44);
    const c = cap(x);
    return n > c ? c + (n - c) * 0.05 : n * (0.6 + 0.4 * (n / c) ** 3);
  });
  for (let x = 0; x < L; x++) {
    const top = Math.round(H + 1 - hgt[x]! * H * 1.1);
    const c = cap(x);
    const flat = hgt[x]! >= c * 0.98;
    const sl = hgt[(x + 3) % L]! - hgt[(x - 3 + L) % L]!;
    for (let y = Math.max(0, top); y < t.h; y++) {
      const d = y - top;
      // Estratos: bandas claras y oscuras horizontales; el cantil, debajo de la cima.
      const band = Math.floor((y + fbm1(x, 50, L, seed + 302, 2) * 4) / 3) % 3;
      let v = 4 + (band === 0 ? -0.7 : band === 1 ? 0.3 : 0);
      v += sl > 0.03 ? 0.7 : sl < -0.03 ? -1 : 0;
      if (flat && d < 2) v += 0.8;
      t.set(x, y, M.monte, step(v, x, y));
    }
  }
  return [t, e.hor - H + 1];
};

/** Una loma de tierra rota (cárcavas) con, lejos, torres caídas recortadas en la cresta. */
const sierra: Painter = (e, L, wild, seed) => {
  const H = Math.round(e.hor * 0.3);
  const t = new Tonos(L, H + 3);
  const tops = Array.from(
    { length: L },
    (_, x) => H - (0.25 + 0.6 * fbm1(x, 70, L, seed + 311, 3)) * H,
  );
  for (let x = 0; x < L; x++) {
    const tp = Math.round(tops[x]!);
    const sl = tops[(x + 2) % L]! - tops[(x - 2 + L) % L]!;
    for (let y = tp; y < t.h; y++) {
      const gully = noise2(x / 3, y / 10, seed + 312, Math.round(L / 3)) < 0.2;
      const v =
        3.4 + (sl > 0.6 ? -1 : sl < -0.6 ? 0.6 : 0) - (gully ? 1.2 : 0) + (y % 4 === 0 ? -0.3 : 0);
      t.set(x, y, M.roca, step(v, x, y));
    }
  }
  // Torres rotas en la cresta, más cuanto más lejos.
  for (let k = 0; k < L / 70; k++) {
    if (hash2(k, 1, seed + 313) > smooth(0.2, 0.8, wild)) continue;
    const x = Math.round(k * 70 + hash2(k, 2, seed + 313) * 30);
    const tp = Math.round(tops[x % L]!);
    const w = 4 + Math.round(hash2(k, 3, seed) * 4);
    const h = 6 + Math.round(hash2(k, 4, seed) * 10);
    for (let i = 0; i < w; i++) {
      const hh = h - (i === w - 1 || hash2(i, k, seed) < 0.25 ? Math.round(hash2(i, k, 9) * 4) : 0);
      for (let y = tp - hh; y <= tp + 1; y++)
        t.set(x + i, y, M.roca, i === 0 ? 4 : i === w - 1 ? 2 : 3, true);
    }
    t.set(x + (w >> 1), tp - h + 3, M.roca, 0, true);
  }
  return [t, e.hor - H + 1];
};

/** El acueducto: dos pisos de arcos que cruzan el valle, rotos a trechos. */
function acueducto(t: Tonos, y: number, h: number, L: number, seed: number) {
  const span = Math.max(6, Math.round(h * 0.55));
  for (let x = 0; x < L; x++) {
    const seg = Math.floor(x / (span * 6));
    const gone = hash2(seg, 1, seed) < 0.35;
    if (gone) continue;
    const k = x % span;
    const pier = k < Math.max(2, span * 0.28);
    for (let j = 0; j < h; j++) {
      const yy = y - j;
      const tier = j < h * 0.55 ? 0 : 1;
      const tierH = tier ? h * 0.45 : h * 0.55;
      const local = tier ? j - h * 0.55 : j;
      const r = (span - span * 0.28) / 2;
      const cx = span * 0.28 + r;
      const inArch =
        !pier &&
        local < tierH - 2 &&
        (local < tierH - 2 - r || Math.hypot(k - cx, local - (tierH - 2 - r)) < r);
      if (inArch) continue;
      const v = 3.6 - (k > span * 0.2 && pier ? 1 : 0) + (local >= tierH - 2 ? 0.6 : 0);
      t.set(x, yy, M.roca, step(v, x, yy), true);
    }
  }
}

const colinas: Painter = (e, L, wild, seed) => {
  const y0 = e.hor - Math.round(e.hor * 0.12);
  const H = e.ground - y0 + 4;
  const t = new Tonos(L, H);
  const amp = H * 0.4;
  const tops = Array.from({ length: L }, (_, x) => 1 + (1 - fbm1(x, 110, L, seed + 321, 3)) * amp);
  const farm = clamp01(1 - wild * 2.4);
  for (let x = 0; x < L; x++) {
    const tp = Math.round(tops[x]!);
    const sl = tops[(x + 2) % L]! - tops[(x - 2 + L) % L]!;
    for (let y = tp; y < H; y++) {
      const u = (y - tp) / Math.max(1, H - tp);
      const n = noise2(x / 7, y / 3, seed + 322, Math.round(L / 7));
      let v = 3.4 - u * 1.2 + (n - 0.5) * 1.2 + (sl > 0.4 ? -0.6 : sl < -0.4 ? 0.5 : 0);
      // Bancales: escalones de tierra a lo largo de la ladera (cerca de casa).
      const terr = (y - tp) % 4 === 0;
      const m =
        farm > 0.2 && hash2(Math.floor(x / 40), 1, seed) < farm && terr
          ? M.tierra
          : n > 0.66
            ? M.tierra
            : M.hierba;
      if (m === M.tierra) v -= 0.4;
      t.set(x, y, m, step(v, x, y));
    }
  }
  // Olivos en filas y viñas (motas) en los bancales.
  for (let r = 0; r < Math.ceil(H / 4); r++)
    for (let i = 0; i < L / 6; i++) {
      const x = i * 6 + (r % 2) * 3;
      const k = Math.floor(x / 40);
      const y = Math.round(tops[x % L]! + 3 + r * 4);
      if (y >= H) continue;
      if (hash2(k, 2, seed) > farm * 0.95) continue;
      const olive = hash2(k, 3, seed) < 0.6;
      if (olive) bush(t, x, y, 4, 3, M.hoja, x * 3 + r);
      else {
        t.set(x, y, M.hoja, 3, true);
        t.set(x + 2, y, M.hoja, 2, true);
      }
    }
  // Cortijos encalados con teja.
  for (let k = 0; k < L / 100; k++) {
    if (hash2(k, 31, seed) > farm * 0.6) continue;
    const x = Math.round(k * 100 + hash2(k, 32, seed) * 50);
    const b = Math.round(tops[x % L]!) + 7;
    const w = 11;
    for (let y = b - 4; y <= b; y++)
      for (let i = 0; i < w; i++) t.set(x + i, y, M.nieve, i < 2 ? 3 : 4, true);
    for (let j = 0; j < 2; j++)
      for (let i = -1 + j; i <= w - j; i++) t.set(x + i, b - 5 - j, M.valla, 3 - j, true);
    t.set(x + 4, b, M.corteza, 0, true);
    t.set(x + 4, b - 1, M.corteza, 0, true);
  }
  // Lejos, el acueducto y muros rotos por las lomas.
  const ruin = smooth(0.25, 0.7, wild);
  if (ruin > 0.3) acueducto(t, Math.round(H * 0.62), Math.round(H * 0.5), L, seed + 323);
  for (let k = 0; k < L / 50; k++) {
    if (hash2(k, 41, seed) > ruin * 0.7) continue;
    const x = Math.round(k * 50 + hash2(k, 42, seed) * 30);
    muro(
      t,
      x,
      Math.round(tops[x % L]!) + 6 + Math.round(hash2(k, 43, seed) * 6),
      8 + Math.round(hash2(k, 44, seed) * 10),
      5 + Math.round(hash2(k, 45, seed) * 4),
      k + seed,
      false,
    );
  }
  return [t, y0];
};

const medio: Painter = (e, L, wild, seed) => {
  const H = Math.round(e.ground * 0.62);
  const y0 = e.ground + 2 - H;
  const t = new Tonos(L, H);
  const base = H - 2;
  const ruin = smooth(0.15, 0.75, wild);
  const gap = Math.round(lerp(16, 11, wild));
  for (let i = 0; i < L / gap; i++) {
    const x = Math.round(i * gap + hash2(i, 1, seed + 340) * gap * 0.8);
    const b = base - Math.round(hash2(i, 3, seed + 340) * 3);
    const r = hash2(i, 4, seed + 340);
    if (hash2(i, 2, seed + 340) > lerp(0.55, 0.85, wild)) continue;
    if (r < ruin * 0.45) {
      // Columnata: tres o cuatro seguidas, alguna rota.
      const n = 2 + Math.round(hash2(i, 5, seed) * 2);
      const h = Math.round(lerp(14, 26, wild) + hash2(i, 6, seed) * 6);
      for (let k = 0; k < n; k++)
        columna(
          t,
          x + k * Math.round(h * 0.45),
          b,
          h,
          i * 7 + k,
          hash2(i, k, seed + 341) < 0.4 ? 0.3 + hash2(i, k, 9) * 0.5 : 0,
        );
    } else if (r < ruin * 0.6)
      muro(
        t,
        x,
        b,
        16 + Math.round(hash2(i, 7, seed) * 10),
        12 + Math.round(wild * 10),
        i + seed,
        true,
      );
    else if (r < 0.75) cipres(t, x, b, Math.round(18 + hash2(i, 8, seed) * 12), i + seed);
    else leafy(t, x, b, Math.round(10 + hash2(i, 9, seed) * 5), { seed: i + seed, mat: M.hoja });
  }
  return [t, y0];
};

const cerca: Painter = (e, L, wild, seed) => {
  const H = e.ground + 7;
  const t = new Tonos(L, H);
  const base = e.ground + 4;
  const ruin = smooth(0.1, 0.7, wild);
  for (let x = 0; x < L; x++) {
    const top = e.ground + Math.round(fbm1(x, 40, L, seed + 350, 2) * 2);
    for (let y = top; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 351, Math.round(L / 3));
      t.set(x, y, n > 0.68 ? M.tierra : M.hierba, step(2.6 + (n - 0.5) * 1.6, x, y));
    }
  }
  const gap = Math.round(lerp(44, 30, wild));
  for (let i = 0; i < L / gap; i++) {
    if (hash2(i, 2, seed + 360) > lerp(0.6, 0.9, wild)) continue;
    const x = Math.round(i * gap + hash2(i, 1, seed + 360) * gap * 0.6);
    const r = hash2(i, 3, seed + 360);
    if (r < ruin * 0.35) {
      const h = Math.round(lerp(40, 70, wild) + hash2(i, 4, seed) * 20);
      columna(
        t,
        x,
        base,
        h,
        i * 3 + seed,
        hash2(i, 5, seed) < 0.5 ? 0.2 + hash2(i, 6, seed) * 0.5 : 0,
      );
    } else if (r < ruin * 0.55)
      muro(
        t,
        x,
        base,
        30 + Math.round(hash2(i, 7, seed) * 20),
        26 + Math.round(wild * 20),
        i + seed,
        hash2(i, 8, seed) < 0.6,
      );
    else if (r < 0.7)
      cipres(t, x, base, Math.round(lerp(40, 56, wild) + hash2(i, 9, seed) * 20), i * 11 + seed);
    else
      leafy(t, x, base, Math.round(22 + hash2(i, 10, seed) * 10), {
        seed: i * 5 + seed,
        mat: M.hoja,
      });
    // Tambores de columna caídos y matas secas.
    if (hash2(i, 11, seed) < ruin * 0.6) {
      const dw = 10;
      for (let dy = 0; dy < 5; dy++)
        for (let dx = 0; dx < dw; dx++)
          t.set(
            x + 12 + dx,
            base + 1 - dy,
            M.nieve,
            dy === 4 ? 4 : dy === 0 ? 1 : 3 - (dx === dw - 1 ? 1 : 0),
            true,
          );
    }
    if (hash2(i, 12, seed) < 0.6) bush(t, x - 8, base + 1, 8, 4, M.viejo, i);
  }
  return [t, 0];
};

const suelo: Painter = (e, L, wild, seed) => {
  const y0 = e.ground + 4;
  const H = e.h - y0;
  const t = new Tonos(L, H);
  const path = e.feet - y0 - 1;
  const half = 5;
  const paved = smooth(0.15, 0.55, wild);
  const sand = smooth(0.5, 1, wild);
  for (let x = 0; x < L; x++) {
    const top = path - half;
    const bot = path + half * 0.8;
    for (let y = 0; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 371, Math.round(L / 3));
      const drift = noise2(x / 20, y / 3, seed + 372, Math.round(L / 20));
      if (y >= top && y <= bot) {
        const u = (y - top) / (bot - top);
        if (drift < sand * 0.6 || hash2(Math.floor(x / 60), 1, seed) > paved) {
          t.set(x, y, M.tierra, step(4.4 - u * 0.8 + (n - 0.5) - (y < top + 1 ? 1 : 0), x, y));
          continue;
        }
        // Losas de la calzada: juntas a tresbolillo y alguna grieta.
        const row = Math.floor((y - top) / 3);
        const jx = (x + row * 5) % 9 === 0;
        const jy = (y - top) % 3 === 0;
        let v =
          jx || jy ? 1.6 : 3.4 - u * 0.6 + (hash2((x + row * 5) / 9, row, seed + 373) - 0.5) * 1.2;
        if (hash2(x, y, 374) < 0.02) v = 1;
        t.set(x, y, M.roca, step(v, x, y));
        continue;
      }
      const near = y > bot ? (y - bot) / Math.max(1, H - bot) : 0;
      if (drift < sand * 0.8 - 0.1) {
        t.set(x, y, M.tierra, step(4.2 + near * 0.6 + (n - 0.5) * 0.8, x, y));
        continue;
      }
      let v = 2.8 + (n - 0.5) * 1.6 + near * 0.6;
      if (y > bot && y < bot + 2) v -= 1;
      t.set(x, y, n > 0.7 ? M.tierra : M.hierba, step(v, x, y));
    }
  }
  // Cascotes, tejas rotas y matas secas.
  for (let i = 0; i < L / 8; i++) {
    const x = Math.round(i * 8 + hash2(i, 1, seed + 380) * 8);
    const y = Math.round(hash2(i, 2, seed + 380) * (H - 2));
    if (Math.abs(y - path) < half + 1) continue;
    const r = hash2(i, 3, seed + 380);
    if (r < 0.25) rock(t, x, y + 2, 4 + Math.round(r * 10), 2 + Math.round(r * 5), i);
    else if (r < 0.35) {
      t.set(x, y, M.valla, 3, true);
      t.set(x + 1, y, M.valla, 2, true);
    } else if (r < 0.6) tuft(t, x, y + 1, 4, i, M.hierba, 0.6);
    else if (r < 0.64) t.set(x, y, M.fruta, 2, true);
  }
  return [t, y0];
};

const delante: Painter = (e, L, _wild, seed) => {
  const H = Math.max(14, Math.min(28, e.h - e.feet - 6));
  const t = new Tonos(L, H);
  const base = H - 1;
  for (let i = 0; i < L / 24; i++) {
    const x = Math.round(i * 24 + hash2(i, 1, seed + 390) * 14);
    if (hash2(i, 2, seed + 390) > 0.7) continue;
    const k = hash2(i, 3, seed + 390);
    if (k < 0.5)
      tuft(t, x, base, Math.round(H * (0.5 + hash2(i, 4, seed) * 0.4)), i, M.hierba, 0.6);
    else if (k < 0.75) rock(t, x, base + 3, 12, Math.round(H * 0.4), i);
    else bush(t, x, base + 2, 14, Math.round(H * 0.45), M.viejo, i);
  }
  return [t, e.h - H];
};

export const RUINAS: Paisaje = {
  capas: { lejos, sierra, colinas, medio, cerca, suelo, delante },
  haze: 0.55,
};
