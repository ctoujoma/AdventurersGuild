/**
 * El paisaje de la sierra (rumbo norte): cerca de casa, pastos de altura con muros de piedra seca,
 * bordas y rebaños; lejos, canchales, pino negro cada vez más bajo y torcido, peñascos con hitos y
 * la nieve que baja hasta el camino. Las cumbres, mucho más cerca y más altas que desde el bosque.
 */
import { pine, pineSmall, tuft } from './arboles';
import { paintRange, step, type PaintOpts, type Paisaje, type Painter } from './capas';
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

// ---------- La nieve en el suelo ----------

/**
 * Cuánta nieve hay posada (la parte del suelo que cubre, 0–1). Desde media lejanía, a manchas: en
 * los montes y las colinas crece hasta cubrirlo casi todo; lo de cerca nunca pasa de neveros
 * sueltos (decisión S1). Si nieva (`o.snow`), lo cubre más, pero la senda se sigue viendo.
 */
export const snowFar = (wild: number, o: PaintOpts = {}) =>
  Math.min(0.95, smooth(0.3, 1, wild) * 0.8 + (o.snow ?? 0) * 0.6);
export const snowNear = (wild: number, o: PaintOpts = {}) =>
  Math.min(0.85, smooth(0.45, 1, wild) * 0.36 + (o.snow ?? 0) * 0.7);

/** El campo de los neveros: manchas alargadas (el suelo se ve de canto) con el borde roto. */
function campo(x: number, y: number, s: number, L: number): number {
  // Algo torcido por otro ruido, para que las manchas no salgan en celdas.
  const wx = x + (noise2(x / 16, y / 5, s + 5, L / 16) - 0.5) * 8;
  const wy = y + (noise2(x / 8, y / 4, s + 6, L / 8) - 0.5) * 3;
  return (
    0.55 * noise2(wx / 32, wy / 7, s, L / 32) +
    0.33 * noise2(wx / 16, wy / 3.5, s + 1, L / 16) +
    0.12 * noise2(wx / 8, wy / 2, s + 2, L / 8)
  );
}
/**
 * El campo de una franja, guardado: no depende de la lejanía, así que al rehacer las tiras por el
 * camino (o al nevar) no se vuelve a calcular. Es suave: columnas pares, y las impares a medias.
 */
const campos = new Map<string, Float32Array>();
function campoDe(w: number, y0: number, rows: number, s: number, L: number): Float32Array {
  const key = `${w}:${y0}:${rows}:${s}:${L}`;
  let f = campos.get(key);
  if (f) return f;
  f = new Float32Array(w * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < w; x += 2) f[y * w + x] = campo(x, y + y0, s, L);
    for (let x = 1; x < w; x += 2)
      f[y * w + x] = (f[y * w + x - 1]! + f[y * w + ((x + 1) % w)]!) / 2;
  }
  if (campos.size > 12) campos.delete(campos.keys().next().value!);
  campos.set(key, f);
  return f;
}

/** El umbral del campo para que la nieve cubra la parte `c` del suelo. */
const umbral = (c: number) => {
  if (c <= 0.004) return -1;
  const k = Math.min(0.996, c);
  return 0.5 + 0.075 * Math.log(k / (1 - k));
};

const GROUND = new Set<number>([M.hierba, M.musgo, M.tierra, M.mies, M.flor, M.agua]);

/**
 * Neveros sobre el suelo ya pintado (filas `y0`–`y1`): solo donde hay suelo (no en piedras ni
 * árboles), con el labio de arriba al sol, la panza en sombra, el borde roto donde la nieve es
 * fina y la hierba mojada al pie, donde se derrite. `cover(x, y)` dice cuánto cubre ahí.
 */
function neveros(
  t: Tonos,
  y0: number,
  y1: number,
  cover: (x: number, y: number) => number,
  s: number,
  L: number,
): void {
  const w = t.w;
  const rows = y1 - y0 + 1;
  const f = campoDe(w, y0, rows, s, L);
  const th = new Float32Array(w * rows);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < w; x++) th[y * w + x] = umbral(cover(x, y + y0));
  const inside = (x: number, y: number) => {
    if (y < 0 || y >= rows) return false;
    const i = y * w + ((x + w) % w);
    return f[i]! < th[i]!;
  };
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < w; x++) {
      const ty = y + y0;
      const c = t.get(x, ty);
      if (!c || !GROUND.has(c >> 4)) continue;
      const i = y * w + x;
      if (!inside(x, y)) {
        // Al pie del nevero, la hierba empapada.
        if (inside(x, y - 1) && inside(x, y - 2) && (c >> 4 === M.hierba || c >> 4 === M.musgo))
          t.set(x, ty, (c >> 4) as Mat, Math.max(0, (c & 15) - 1));
        continue;
      }
      // El borde, donde la nieve es fina: deja asomar la hierba.
      const edge = th[i]! - f[i]!;
      if (edge < 0.008 && hash2(x, ty, s + 3) < 0.45) continue;
      // Ni píxeles sueltos ni hilos de uno.
      if (!inside(x - 1, y) && !inside(x + 1, y)) continue;
      const u1 = inside(x, y - 1);
      const d1 = inside(x, y + 1);
      if (!((u1 && (d1 || inside(x, y - 2))) || (d1 && inside(x, y + 2)))) continue;
      let v = 3.9 + (noise2(x / 4, ty / 2, s + 4, L / 4) - 0.5) * 0.9;
      if (!inside(x, y - 1)) v = 4.7;
      else if (!inside(x, y + 1)) v = 2;
      else if (!inside(x, y + 2)) v = 3;
      if (!inside(x - 1, y)) v += 0.4;
      else if (!inside(x + 1, y)) v -= 0.5;
      t.set(x, ty, M.nieve, step(v, x, ty));
    }
}

/** Nieve que aguanta a la sombra de una piedra (a su derecha, el sol viene de la izquierda). */
function nieveSombra(t: Tonos, x: number, base: number, w: number, s: number) {
  const len = Math.round(w * (0.5 + hash2(s, 1, 9) * 0.4));
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const h = Math.round((1 - u * u) * 2.2);
    for (let j = 0; j <= h; j++) {
      const y = base - j + 1;
      const c = t.get(x + i, y, true);
      if (c && !GROUND.has(c >> 4)) continue;
      t.set(x + i, y, M.nieve, j === h ? 4 : j === 0 ? 2 : 3, true);
    }
  }
}

// ---------- Piedras de montaña ----------

/**
 * Un canto de montaña: caras planas (la de la izquierda al sol, la de arriba más clara, la de la
 * derecha en sombra), aristas rectas, liquen en la cara del sol y nieve encima si toca.
 */
export function canto(
  t: Tonos,
  x: number,
  base: number,
  w: number,
  h: number,
  s: number,
  o: { lichen?: number; snow?: number; lift?: number } = {},
): void {
  w = Math.max(3, Math.round(w));
  // La silueta: un bolo redondeado con nudos que la hacen angulosa (aristas rectas).
  const se = (u: number) => (1 - Math.abs(2 * u - 1) ** 2.4) ** (1 / 2.4);
  const K = 6;
  const kh = Array.from({ length: K }, (_, k) => {
    const u = k / (K - 1);
    const e = k === 0 || k === K - 1 ? 0.2 + hash2(s, k, 1) * 0.25 : se(u);
    return Math.min(1, e * (0.82 + hash2(s, k, 2) * 0.3)) * h;
  });
  const prof = (u: number) => {
    const f = Math.max(0, Math.min(K - 1.001, u * (K - 1)));
    const k = Math.floor(f);
    return kh[k]! + (kh[k + 1]! - kh[k]!) * (f - k);
  };
  // Tres caras: al sol, de frente y en sombra, con las aristas algo en diagonal.
  const cut1 = 0.28 + hash2(s, 8, 1) * 0.12;
  const cut2 = 0.62 + hash2(s, 9, 1) * 0.12;
  const lift = o.lift ?? 0;
  const x0 = Math.round(x - w / 2);
  const tops: number[] = [];
  const faces: number[] = [];
  for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w;
    const tp = Math.round(base - prof(u));
    tops.push(tp);
    const flat = Math.abs(prof(Math.min(1, u + 1 / w)) - prof(Math.max(0, u - 1 / w))) * w < h;
    const px = x0 + i;
    const rows = Math.max(1, base - tp);
    for (let y = tp; y <= base; y++) {
      const d = y - tp;
      const q = d / rows;
      const face = u < cut1 + q * 0.12 ? 0 : u < cut2 - q * 0.06 ? 1 : 2;
      if (y === tp) faces.push(face);
      let v = face === 0 ? 4.1 : face === 1 ? 3.1 : 1.9;
      if (d === 0) v += face === 2 ? 0.7 : 1;
      else if (d === 1 && flat) v += 0.5;
      v += (grainOf(px, y, s) - 0.5) * 0.5 - q * 0.8;
      if (y === base) v = 0.8;
      if (
        face < 2 &&
        o.lichen &&
        d > 0 &&
        y < base &&
        noise2(px / 3, y / 2, s + 9, 1 << 12) < o.lichen * 0.3
      )
        t.set(px, y, M.musgo, step(v - 0.6 + lift, px, y), true);
      else t.set(px, y, M.roca, step(v + lift, px, y), true);
    }
  }
  // Nieve encima: en lo alto, y más en la cara de la sombra (donde no le da el sol).
  if (o.snow && o.snow > 0)
    for (let i = 0; i < w; i++) {
      const sh = faces[i] === 2;
      if (hash2(x0 + i, s, 11) > o.snow * (sh ? 1.2 : 0.8)) continue;
      const tp = tops[i]!;
      t.set(x0 + i, tp, M.nieve, sh ? 3 : 5, true);
      if (hash2(x0 + i, s, 12) < o.snow * 0.7) t.set(x0 + i, tp + 1, M.nieve, sh ? 2 : 4, true);
    }
}

const grainOf = (x: number, y: number, s: number) => hash2(x >> 1, y >> 1, s);

// ---------- Plantas de montaña ----------

/**
 * Un abeto: cono estrecho y prieto de pisos cortos y tiesos, con la punta en aguja; más oscuro y
 * azulado que el pino negro (es el árbol de las umbrías bajas).
 */
export function abeto(t: Tonos, x: number, base: number, h: number, s: number, lift = 0): void {
  const trunkH = Math.max(1, Math.round(h * 0.08));
  const crown = h - trunkH;
  const w = h * (0.16 + hash2(s, 1, 5) * 0.05);
  const tierH = Math.max(2, Math.round(2 + h * 0.06));
  for (let y = base - trunkH; y <= base; y++) {
    t.set(x, y, M.corteza, 2, true);
    if (h > 26) t.set(x + 1, y, M.corteza, 1, true);
  }
  for (let j = 0; j < crown; j++) {
    const y = base - trunkH - j;
    const u = j / crown;
    const tv = ((j + (s & 1)) % tierH) / tierH;
    let half = w * (1 - u) ** 0.95 * (0.7 + 0.3 * (1 - tv));
    // Las puntas de cada piso, de un lado o del otro.
    if (tv === 0 && hash2(j, s, 6) < 0.5) half += 0.8;
    if (u > 0.88) half = Math.min(half, 0.4);
    for (let dx = Math.floor(-half - 0.5); dx <= Math.ceil(half + 0.5); dx++) {
      if (Math.abs(dx) > half + 0.35) continue;
      const g = hash2((x + dx) >> 1, y >> 1, s + 7);
      let v = 3 + lift - (dx / Math.max(1, half)) * 1.4 + (tv < 0.34 ? -0.8 : 0.2);
      v += (g - 0.5) * 0.6;
      if (j >= crown - 2) v += 0.5;
      t.set(x + dx, y, M.viejo, step(v, x + dx, y), true);
    }
  }
}

/**
 * Un piorno: cojín de ramitas prietas, redondo y achaparrado, con el borde de arriba en púas; en
 * flor (amarillo) en los pastos de media altura.
 */
export function piorno(
  t: Tonos,
  x: number,
  base: number,
  w: number,
  h: number,
  s: number,
  flor = 0,
  lift = 0,
): void {
  for (let xx = Math.floor(x - w / 2); xx <= x + w / 2; xx++) {
    const dx = (xx + 0.5 - x) / (w / 2);
    const prof = 1 - dx * dx;
    if (prof <= 0) continue;
    const top = base - h * prof ** 0.5 * (0.8 + 0.35 * hash2(xx, s, 3));
    for (let y = Math.round(top); y <= base; y++) {
      const dy = (base - y) / h;
      const g = hash2(xx >> 1, (y + (xx & 1)) >> 1, s + 2);
      let v = 2.2 + lift - dx * 1.1 + dy * 1.4 + (g - 0.5) * 1.1;
      if (y === Math.round(top)) v += 0.6;
      if (y === base) v = 0.6;
      if (
        flor &&
        y < base - 1 &&
        dy > 0.4 &&
        hash2(xx >> 1, y, s + 4) < flor * 0.24 * (1 - dx * 0.6)
      )
        t.set(xx, y, M.flor, dx < 0.2 ? 3 : 2.6, true);
      else t.set(xx, y, M.musgo, step(v, xx, y), true);
    }
  }
}

/** Un enebro rastrero: mata ancha y baja, verde azulado y oscuro, con el lomo ondulado. */
export function enebro(
  t: Tonos,
  x: number,
  base: number,
  w: number,
  h: number,
  s: number,
  lift = 0,
) {
  w = Math.max(4, Math.round(w));
  const x0 = Math.round(x - w / 2);
  for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w;
    const lump = 0.7 + 0.3 * Math.sin(u * 9 + s) * hash2(i >> 2, s, 8);
    const ph = Math.max(1, Math.round(h * (1 - Math.abs(2 * u - 1) ** 2.5) * lump));
    for (let j = 0; j <= ph; j++) {
      const y = base - j;
      const g = hash2((x0 + i) >> 1, y >> 1, s + 9);
      let v = 1.8 + lift - (u - 0.4) * 1.4 + (j / Math.max(1, ph)) * 1.2 + (g - 0.5) * 0.9;
      if (j === ph) v += 0.6;
      if (j === 0) v = 0.4;
      t.set(x0 + i, y, M.pino, step(v, x0 + i, y), true);
    }
  }
}

/** Matorral a los pies de algo: piorno (con flor si toca) o enebro, según la altura. */
function mata(t: Tonos, x: number, base: number, size: number, wild: number, s: number, lift = 0) {
  const flor = 1 - smooth(0.35, 0.8, wild);
  if (hash2(s, 51, 7) < lerp(0.75, 0.25, wild))
    piorno(t, x, base, size, Math.round(size * 0.55), s, flor, lift);
  else enebro(t, x, base, size * 1.5, Math.round(size * 0.3), s, lift);
}

// ---------- Cumbres ----------

const lejos: Painter = (e, L, wild, seed) => {
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

const colinas: Painter = (e, L, wild, seed, o) => {
  const y0 = e.hor - Math.round(e.hor * 0.22);
  const H = e.ground - y0 + 4;
  const t = new Tonos(L, H);
  const amp = H * 0.6;
  const tops = Array.from({ length: L }, (_, x) => 1 + (1 - fbm1(x, 90, L, seed + 121, 3)) * amp);
  const farm = clamp01(1 - wild * 2.6);
  const snow = snowFar(wild, o);
  for (let x = 0; x < L; x++) {
    const tp = Math.round(tops[x]!);
    const slope = tops[(x + 2) % L]! - tops[(x - 2 + L) % L]!;
    for (let y = tp; y < H; y++) {
      const u = (y - tp) / Math.max(1, H - tp);
      const n = noise2(x / 6, y / 3, seed + 122, Math.round(L / 6));
      const v = 3.4 - u * 1.4 + (n - 0.5) * 1.1 + (slope > 0.4 ? -0.7 : slope < -0.4 ? 0.5 : 0);
      let m: Mat = M.hierba;
      // Brezo en flor a manchas (los pastos de cerca).
      if (n > 0.7 && farm > 0.2 && u > 0.2) m = M.mies;
      t.set(x, y, m, step(v, x, y));
    }
  }
  // Canchales: conos de piedra suelta que caen de un risco y se abren ladera abajo.
  const nf = Math.round(L / 32);
  for (let k = 0; k < nf; k++) {
    if (hash2(k, 41, seed) > lerp(0.2, 0.7, wild)) continue;
    const cx = Math.round(k * 32 + hash2(k, 42, seed) * 18);
    const tp = Math.round(tops[((cx % L) + L) % L]!) + 1;
    const len = Math.round((H - tp) * lerp(0.3, 0.7, hash2(k, 43, seed)));
    const lean = (hash2(k, 44, seed) - 0.5) * 0.5;
    const open = 0.45 + hash2(k, 45, seed) * 0.3;
    for (let d = 0; d < len; d++) {
      const y = tp + d;
      const hw = 0.8 + d * open;
      const c = cx + d * lean;
      const fade = d / len;
      for (let x = Math.floor(c - hw); x <= c + hw; x++) {
        const q = Math.abs(x - c) / hw;
        if (q > 1 - hash2(x, y, seed + 46) * 0.35) continue;
        // Abajo se deshace en piedras sueltas sobre la hierba.
        if (fade > 0.6 && hash2(x, y, seed + 48) < (fade - 0.6) * 2.2) continue;
        // Piedra a piedra: claras y oscuras, la mitad del sol más clara; abajo, más gruesas.
        const big = (x >> 1) + (y >> 1) * 7;
        const v =
          3.2 + (hash2(big, d >> 1, seed + 47) - 0.5) * 2.2 + (x < c ? 0.5 : -0.4) - fade * 0.6;
        t.set(x, y, M.roca, step(v, x, y), true);
      }
    }
    // El risco de arriba, de donde cae.
    for (let j = 0; j < 3; j++)
      for (let i = -2; i <= 2; i++)
        t.set(cx + i, tp - 1 + j, M.roca, i < 0 ? 4 : i === 0 ? 3 : 1, true);
  }
  // Neveros: más arriba en la ladera, y en las caras a la sombra (las que miran a la derecha).
  neveros(
    t,
    0,
    H - 1,
    (x, y) => {
      const tp = tops[x]!;
      const u = clamp01((y - tp) / Math.max(1, H - tp));
      const sl = tops[(x + 2) % L]! - tops[(x - 2 + L) % L]!;
      return snow * clamp01(1.3 - u * 0.9 + (sl < -0.3 ? 0.15 : 0));
    },
    seed + 124,
    L,
  );
  // Matorral de lejos: motas de piorno (con flor) y de enebro, a rodales por la ladera.
  const flor = 1 - smooth(0.35, 0.8, wild);
  for (let i = 0; i < (L * H) / 14; i++) {
    const x = Math.floor(hash2(i, 61, seed) * L);
    const tp = tops[x]!;
    const u = hash2(i, 62, seed);
    const y = Math.round(tp + 2 + u * (H - tp - 2));
    if (noise2(x / 32, y / 6, seed + 63, L / 32) < 0.5) continue;
    const c = t.get(x, y) >> 4;
    if (c !== M.hierba && c !== M.mies) continue;
    const dark = hash2(i, 64, seed) < lerp(0.35, 0.75, wild);
    const w = 1 + Math.round(u * 2 + hash2(i, 65, seed));
    for (let k = 0; k < w; k++) {
      t.set(x + k, y - 1, dark ? M.pino : M.musgo, k === 0 ? 3 : 2, true);
      t.set(x + k, y, dark ? M.pino : M.musgo, 1, true);
    }
    if (!dark && hash2(i, 66, seed) < flor * 0.25) t.set(x, y - 1, M.flor, 3, true);
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
      const fir = hash2(id, 6, seed) < 1 - smooth(0.1, 0.5, wild);
      const h = Math.round(4 + hash2(id, 5, seed) * 4);
      pineSmall(t, x, y, fir ? h + 1 : h, fir ? M.viejo : M.pino, id, r / 8 - (fir ? 0.1 : 0.3));
    }
  nevar(t, snow * 0.7, seed + 128);
  return [t, y0];
};

// ---------- Pino negro y peñascos ----------

/**
 * Un peñasco grande, de tres hechuras (bloque de techo plano, aguja o laja tumbada): caras planas
 * con la luz a la izquierda, estratos y diaclasas, liquen al sol y nieve en las repisas.
 */
export function crag(
  t: Tonos,
  x: number,
  base: number,
  w: number,
  h: number,
  s: number,
  o: { snow?: number; lichen?: number } = {},
) {
  const kind = Math.floor(hash2(s, 21, 3) * 3);
  if (kind === 2) h *= 0.55;
  h = Math.min(h, w * (kind === 1 ? 0.9 : 0.62));
  const tilt = (hash2(s, 22, 3) - 0.5) * 0.4;
  const top = (i: number) => {
    const u = (i / w) * 2 - 1;
    const r = ridged(fbm1(i + s * 13, 10, 1 << 12, s, 2));
    if (kind === 0) {
      // Bloque: lados casi a plomo y el techo tendido, con algún escalón.
      const side = Math.max(0, 1 - Math.abs(u) ** 5);
      const steps = fbm1(i + s * 7, 12, 1 << 12, s + 1, 1) > 0.55 ? 1 : 0;
      return base - h * side * (0.88 + 0.12 * steps) + u * tilt * h * 0.3;
    }
    if (kind === 2)
      return base - h * Math.max(0, 1 - Math.abs(u) ** 3) * (0.85 + 0.15 * r) + u * h * 0.35;
    // Aguja: cumbre hacia un lado, laderas rectas y la cresta mellada.
    const off = (hash2(s, 32, 3) - 0.5) * 0.6;
    const k = u < off ? (u + 1) / (off + 1) : (1 - u) / (1 - off);
    return base - h * Math.min(1, k * 1.25) ** 0.8 * (0.8 + 0.2 * r);
  };
  // Cuatro caras de izquierda a derecha (sol, sol de refilón, frente, sombra).
  const c1 = 0.22 + hash2(s, 23, 3) * 0.1;
  const c2 = 0.45 + hash2(s, 24, 3) * 0.1;
  const c3 = 0.7 + hash2(s, 25, 3) * 0.1;
  const strat = Math.round(4 + hash2(s, 26, 3) * 2);
  const tops: number[] = [];
  for (let i = 0; i < w; i++) {
    const tp = Math.round(top(i));
    tops.push(tp);
    const u = (i + 0.5) / w;
    const px = x + i;
    // Diaclasas: grietas a plomo, una de cada tantas columnas.
    const joint =
      (i + s) % (kind === 1 ? 6 : 9) === 0 && hash2(Math.floor((i + s) / 9), s, 27) < 0.6;
    for (let y = tp; y <= base; y++) {
      const d = y - tp;
      const q = d / Math.max(1, base - tp);
      const f = u < c1 + q * 0.06 ? 0 : u < c2 + q * 0.04 ? 1 : u < c3 - q * 0.04 ? 2 : 3;
      let v = [4.2, 3.6, 2.9, 1.8][f]!;
      if (d === 0) v += f === 3 ? 0.7 : 1.1;
      v += (grainOf(px, y, s) - 0.5) * 0.5 - q * 0.9;
      // Estratos: una raya oscura cada pocas filas (algo inclinada) y la repisa clara encima.
      const sy = Math.round(base - y + i * tilt);
      const layered = kind !== 1 && noise2(px / 6, sy / strat, s + 33, 1 << 12) > 0.35;
      if (layered && d > 1 && sy % strat === 0) v -= 1.2;
      else if (layered && d > 1 && sy % strat === 1) v += 0.4;
      if (joint && d > 1 && f > 0) v -= 1.3;
      if (y === base) v = 0.8;
      if (
        o.lichen &&
        f < 2 &&
        d > 1 &&
        y < base &&
        noise2(px / 4, y / 3, s + 5, 1 << 12) < o.lichen * 0.28
      )
        t.set(px, y, M.musgo, step(v - 0.5, px, y), true);
      else t.set(px, y, M.roca, step(v, px, y), true);
    }
  }
  // Nieve en lo alto y en las repisas de los estratos (más en la cara de la sombra).
  const sn = o.snow ?? 0;
  if (sn > 0)
    for (let i = 0; i < w; i++) {
      const tp = tops[i]!;
      const sh = (i + 0.5) / w > c3;
      if (hash2(x + i, s, 28) < sn * (sh ? 1.1 : 0.85)) {
        t.set(x + i, tp, M.nieve, sh ? 3 : 5, true);
        if (hash2(x + i, s, 29) < sn * 0.6) t.set(x + i, tp + 1, M.nieve, sh ? 2 : 4, true);
      }
      for (let y = tp + 3; y < base - 1; y++) {
        const sy = Math.round(base - y + i * tilt);
        if (sy % strat === 1 && noise2((x + i) / 3, y, s + 30, 1 << 12) < sn * 0.55)
          t.set(x + i, y, M.nieve, sh ? 2 : 4, true);
      }
    }
  // Al pie: la sombra hacia la derecha y unas matas.
  for (let i = 0; i < Math.round(w * 0.5); i++)
    for (let j = 1; j <= 2; j++) {
      const c = t.get(x + w + i - 2, base + j - 1, true);
      if (c && c >> 4 === M.hierba && i / (w * 0.5) + j / 3 < 1)
        t.set(x + w + i - 2, base + j - 1, M.hierba, Math.max(0, (c & 15) - 1), true);
    }
  if (sn > 0.1) nieveSombra(t, x + w - 3, base, Math.round(w * 0.5), s);
  tuft(t, x + 1, base + 1, 5, s, M.hierba);
  if (hash2(s, 31, 3) < 0.6) tuft(t, x + w - 2, base + 1, 4, s + 1, M.musgo);
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

const medio: Painter = (e, L, wild, seed, o) => {
  const H = Math.round(e.ground * 0.62);
  const y0 = e.ground + 2 - H;
  const t = new Tonos(L, H);
  const base = H - 2;
  const sn = snowFar(wild, o);
  // Abajo, abetos en las umbrías; luego pino negro, cada vez más bajo y torcido; arriba, matorral.
  const fir = 1 - smooth(0.12, 0.55, wild);
  // Dos filas: la de atrás más arriba y más baja (más lejos) y la de delante.
  for (const row of [0, 1]) {
    const gap = Math.round(lerp(9, 17, wild) * (row ? 1.2 : 1));
    const density = lerp(0.8, 0.28, smooth(0.2, 1, wild)) * (row ? 0.85 : 1);
    const scale = row ? 1 : 0.72;
    for (let i = 0; i < L / gap; i++) {
      const id = i + row * 991;
      const x = Math.round(i * gap + (row ? gap * 0.5 : 0) + hash2(id, 1, seed + 140) * gap * 0.7);
      const b = row
        ? base - Math.round(hash2(id, 3, seed + 140) * 2)
        : base - 5 - Math.round(hash2(id, 3, seed + 140) * 2);
      const lift = row ? 0 : 0.3;
      // Rodales con claros de pasto entre medias (no una pared de árboles).
      const stand = smooth(0.35, 0.65, fbm1(x, 64, L, seed + 142 + row, 2)) * 1.3;
      if (hash2(id, 2, seed + 140) < density * stand) {
        if (hash2(id, 9, seed + 140) < fir) {
          const h = Math.round((lerp(20, 14, wild) + hash2(id, 8, seed + 140) * 12) * scale);
          abeto(t, x, b, Math.min(H - 1, h), id + seed, lift);
        } else {
          // El pino negro: más bajo y más torcido cuanto más arriba.
          const h = Math.round(
            (lerp(22, 10, wild) + hash2(id, 8, seed + 140) * lerp(12, 6, wild)) * scale,
          );
          pine(t, x, b, Math.min(H - 1, h), { seed: id * 13 + seed, old: wild * 0.6, fat: 1.1 });
        }
        if (row && hash2(id, 10, seed + 140) < 0.45)
          mata(t, x + 5, b + 1, 5 + Math.round(hash2(id, 11, seed) * 3), wild, id + seed);
        continue;
      }
      const k = hash2(id, 4, seed + 140);
      if (k < 0.45) {
        // Un rodal de matorral: dos o tres matas juntas.
        const n = 2 + Math.floor(hash2(id, 12, seed) * 2);
        for (let j = 0; j < n; j++)
          mata(
            t,
            x + j * 5,
            b + 1 - (j & 1),
            Math.round(lerp(5, 8, hash2(id, 13 + j, seed)) * scale + 1),
            wild,
            id * 3 + j + seed,
            lift,
          );
      } else if (k < 0.75) {
        // Un pedregal: un canto grande y otros pequeños al lado.
        const w = Math.round((8 + hash2(id, 5, seed) * 8) * scale + 2);
        canto(t, x, b + 1, w, Math.round(w * (0.35 + hash2(id, 6, seed) * 0.2)), id, {
          lichen: 0.5,
          snow: sn,
          lift,
        });
        canto(t, x + w * 0.6, b + 2, Math.round(w * 0.45), Math.round(w * 0.2), id + 1, {
          snow: sn,
          lift,
        });
      }
    }
  }
  nevar(t, sn * 0.8, seed + 141);
  return [t, y0];
};

/** El césped de altura: hierba rala, manchas de musgo y liquen, algo de cascajo. */
function cesped(t: Tonos, x: number, y: number, v: number, seed: number, L: number) {
  const moss = noise2(x / 16, y / 4, seed, L / 16);
  if (moss > 0.72) t.set(x, y, M.musgo, step(v - 0.2, x, y));
  else t.set(x, y, M.hierba, step(v, x, y));
}

const cerca: Painter = (e, L, wild, seed, o) => {
  const H = e.ground + 7;
  const t = new Tonos(L, H);
  const base = e.ground + 4;
  const near = snowNear(wild, o);
  let y1 = H;
  for (let x = 0; x < L; x++) {
    const top = e.ground + Math.round(fbm1(x, 32, L, seed + 150, 2) * 2);
    y1 = Math.min(y1, top);
    for (let y = top; y < H; y++) {
      const n = noise2(x / 4, y / 2, seed + 151, L / 4);
      cesped(t, x, y, 2.5 + (n - 0.5) * 1.5, seed + 152, L);
    }
  }
  neveros(t, y1, H - 1, () => Math.min(0.9, near * 1.2), seed + 153, L);
  // Detrás, árboles sueltos: abetos abajo y pino negro torcido arriba.
  const fir = 1 - smooth(0.12, 0.55, wild);
  const gap = Math.round(lerp(34, 64, wild));
  for (let i = 0; i < L / gap; i++) {
    if (hash2(i, 2, seed + 160) > lerp(0.85, 0.35, wild)) continue;
    const x = Math.round(i * gap + hash2(i, 1, seed + 160) * gap * 0.6);
    const b = base - 2 + Math.round(hash2(i, 3, seed + 160) * 3);
    if (hash2(i, 9, seed + 160) < fir)
      abeto(t, x, b, Math.round(lerp(40, 30, wild) + hash2(i, 7, seed) * 16), i * 31 + seed);
    else {
      const h = Math.round(lerp(46, 22, wild) + hash2(i, 7, seed) * 18);
      pine(t, x, b, h, { seed: i * 31 + seed, old: 0.3 + wild * 0.5, fat: 1.2 });
    }
  }
  // Peñascos de tanto en tanto (más a más altura), cada uno de su hechura.
  const rockSnow = clamp01(near * 1.3 + smooth(0.55, 1, wild) * 0.35);
  const big = Math.round(L / 128);
  for (let k = 0; k < big; k++) {
    if (hash2(k, 1, seed + 154) > lerp(0.45, 0.85, wild)) continue;
    const x = Math.round(k * 128 + hash2(k, 2, seed + 154) * 50);
    const w = 26 + Math.round(hash2(k, 3, seed + 154) * 34);
    const h = Math.round(e.ground * lerp(0.28, 0.55, hash2(k, 4, seed + 154)));
    crag(t, x, base + 1, w, h, k * 7 + seed, { snow: rockSnow, lichen: 0.7 });
  }
  // Matorral delante de los peñascos y los árboles: piornos y enebros a lo largo de la orilla.
  for (let i = 0; i < L / 16; i++) {
    if (hash2(i, 1, seed + 165) > lerp(0.55, 0.7, wild)) continue;
    const x = Math.round(i * 16 + hash2(i, 2, seed + 165) * 10);
    mata(
      t,
      x,
      base + 1 + Math.round(hash2(i, 3, seed + 165) * 2),
      8 + Math.round(hash2(i, 4, seed + 165) * 6),
      wild,
      i + seed,
    );
  }
  // Hitos y piedras a la orilla del camino.
  for (let i = 0; i < L / 60; i++) {
    const x = Math.round(i * 60 + hash2(i, 1, seed + 170) * 30);
    if (hash2(i, 2, seed + 170) < 0.35 + wild * 0.4) hito(t, x, base + 1, i);
    else canto(t, x, base + 2, 8, 4, i + seed, { lichen: 0.6, snow: rockSnow });
    if (hash2(i, 3, seed + 170) < 0.6) tuft(t, x + 10, base + 2, 5, i, M.musgo);
  }
  nevar(t, near * 0.8, seed + 171);
  return [t, 0];
};

// ---------- El suelo y la senda ----------

/** Dónde cruza la senda el arroyo de deshielo (si cruza): de media lejanía para arriba. */
const arroyoAt = (L: number, wild: number, seed: number) =>
  wild > 0.2 && wild < 0.92 && hash2(seed, Math.round(wild * 8), 172) < 0.6
    ? Math.round(L * (0.58 + hash2(seed, 173, 5) * 0.25))
    : -999;

const suelo: Painter = (e, L, wild, seed, o) => {
  const y0 = e.ground + 4;
  const H = e.h - y0;
  const t = new Tonos(L, H);
  const path = e.feet - y0 - 1;
  const half = lerp(5.5, 3, smooth(0, 0.95, wild));
  const near = snowNear(wild, o);
  const wet = o.wet ?? 0;
  const tops = new Float32Array(L);
  const bots = new Float32Array(L);
  for (let x = 0; x < L; x++) {
    // La senda serpentea despacio y tiembla en los bordes.
    const wind = (fbm1(x, 128, L, seed + 179, 2) - 0.5) * 5;
    const wob = (fbm1(x, 32, L, seed + 180, 3) - 0.5) * 2.4 + wind;
    const top = path - half + wob + (fbm1(x, 8, L, seed + 181, 2) - 0.5) * 1.6;
    const bot = path + half * 0.8 + wob * 0.6 + (fbm1(x, 8, L, seed + 182, 2) - 0.5) * 1.6;
    tops[x] = top;
    bots[x] = bot;
    for (let y = 0; y < H; y++) {
      const n = noise2(x / 4, y / 2, seed + 183, L / 4);
      if (y >= top && y <= bot) {
        // Tierra apisonada con cascajo, más clara por el medio (por donde se pisa).
        const u = (y - top) / Math.max(1, bot - top);
        let v = 3.3 - Math.abs(u - 0.45) * 1.2 + (n - 0.5) * 1.2 - wet * 0.6;
        if (y < top + 1) v -= 1.2;
        const pud = noise2(x / 8, y / 2.5, seed + 184, L / 8);
        if (wet && pud < 0.2 && u > 0.2 && u < 0.85) {
          t.set(x, y, M.agua, pud < 0.14 ? 3 : 2);
          continue;
        }
        if (hash2(x, y, seed + 185) < 0.1) t.set(x, y, M.roca, step(3 + (n - 0.5) * 2, x, y));
        else t.set(x, y, M.tierra, step(v, x, y));
        continue;
      }
      const dn = y > bot ? (y - bot) / Math.max(1, H - bot) : 0;
      let v = 2.6 + (n - 0.5) * 1.0 + dn * 0.5;
      if (y > bot && y < bot + 2) v -= 1.1;
      // Cascajo suelto a la orilla de la senda.
      const edge = Math.min(Math.abs(y - top), Math.abs(y - bot));
      if (edge < 2.5 && hash2(x, y, seed + 186) < 0.3) {
        t.set(x, y, M.tierra, 2 + (hash2(x, y, seed + 187) < 0.4 ? 1 : 0));
        continue;
      }
      cesped(t, x, y, v, seed + 188, L);
    }
  }
  const onPath = (x: number, y: number) => {
    const xx = ((x % L) + L) % L;
    return y >= tops[xx]! && y <= bots[xx]!;
  };
  // Losas: piedras planas encastradas en la senda, con su labio al sol y la raya de sombra.
  for (let i = 0; i < L / 9; i++) {
    const x = Math.round(i * 9 + hash2(i, 1, seed + 190) * 5);
    const y = Math.round(path - half * 0.5 + hash2(i, 2, seed + 190) * half * 1.1);
    if (hash2(i, 3, seed + 190) > 0.55) continue;
    const w = 3 + Math.round(hash2(i, 4, seed + 190) * 4);
    for (let k = 0; k < w; k++) {
      if (!onPath(x + k, y) || !onPath(x + k, y + 1)) continue;
      const end = k === 0 || k === w - 1;
      t.set(x + k, y, M.roca, end ? 3 : 4 + (k < w / 2 ? 1 : 0), true);
      if (!end) t.set(x + k, y + 1, M.roca, 3, true);
      t.set(x + k + 1, y + 2, M.tierra, 1, true);
    }
  }
  // Escalones de piedra que cruzan la senda en diagonal (para que el agua no la coma).
  if (wild > 0.25)
    for (let i = 0; i < L / 64; i++) {
      if (hash2(i, 5, seed + 191) > 0.35 + wild * 0.4) continue;
      const x = Math.round(i * 64 + hash2(i, 6, seed + 191) * 30);
      const a = tops[((x % L) + L) % L]!;
      const b = bots[((x % L) + L) % L]!;
      for (let y = Math.ceil(a); y <= b; y++) {
        const xx = x + Math.round((y - a) * 0.6);
        t.set(xx, y, M.roca, 4, true);
        t.set(xx + 1, y, M.roca, 3, true);
        t.set(xx + 2, y, M.roca, 2, true);
        t.set(xx + 3, y, M.tierra, 1, true);
      }
    }
  // Piedras con liquen, matas de festuca y flores (genciana azul, árnica amarilla, edelweiss).
  for (let i = 0; i < L / 4; i++) {
    const x = Math.round(i * 4 + hash2(i, 1, seed + 192) * 4);
    const y = Math.round(hash2(i, 2, seed + 192) * (H - 1));
    if (Math.abs(y - path) < half + 1.5) continue;
    const r = hash2(i, 3, seed + 192);
    if (r < 0.05) {
      const w = 5 + Math.round(hash2(i, 4, seed + 192) * 7);
      canto(t, x, y + 1, w, 2 + Math.round(w * 0.35), i + seed, { lichen: 0.7, snow: near });
      if (near > 0.12) nieveSombra(t, x + Math.round(w / 2) - 1, y + 1, w, i);
    } else if (r < 0.14) tuft(t, x, y + 1, 3 + Math.round(hash2(i, 5, seed) * 3), i, M.hierba, 0.6);
    else if (r < 0.4) {
      t.set(x, y, M.hierba, 5, true);
      t.set(x - 1, y + 1, M.hierba, 4, true);
      t.set(x + 1, y + 1, M.hierba, 4, true);
    } else if (r < 0.415 + (1 - wild) * 0.015) {
      t.set(x, y, M.agua, 4, true);
      t.set(x + 1, y, M.agua, 3, true);
      t.set(x, y + 1, M.hierba, 2, true);
    } else if (r < 0.46 + (1 - wild) * 0.05) {
      t.set(x, y, M.flor, 3, true);
      t.set(x, y + 1, M.hierba, 2, true);
    } else if (r < 0.47 && wild > 0.5) {
      t.set(x, y, M.nieve, 5, true);
      t.set(x, y + 1, M.hierba, 2, true);
    }
  }
  for (let i = 0; i < L / 14; i++) {
    const x = Math.round(i * 14 + hash2(i, 31, seed) * 8);
    const edge = hash2(i, 32, seed) < 0.5 ? tops[x % L]! - 1 : bots[x % L]! + 2;
    tuft(t, x, Math.round(edge), 3 + Math.round(hash2(i, 33, seed) * 3), i, M.hierba, 0.4);
  }
  // Neveros: más detrás de la senda que delante (lo de delante es lo más cercano).
  neveros(
    t,
    0,
    H - 1,
    (x, y) => {
      const xx = ((x % L) + L) % L;
      if (y < tops[xx]!) return Math.min(0.95, near * 1.2);
      if (y <= bots[xx]!) return near;
      return near * lerp(1, 0.55, (y - bots[xx]!) / Math.max(1, H - bots[xx]!));
    },
    seed + 193,
    L,
  );
  // En la senda, la nieve está pisada: gris, con las huellas hasta el barro.
  for (let x = 0; x < L; x++)
    for (let y = Math.ceil(tops[x]!); y <= bots[x]!; y++) {
      const c = t.get(x, y);
      if (c >> 4 !== M.nieve) continue;
      const u = (y - tops[x]!) / Math.max(1, bots[x]! - tops[x]!);
      const n = noise2(x / 4, y / 2, seed + 194, L / 4);
      t.set(x, y, M.nieve, step(2 - Math.abs(u - 0.45) * 1.4 + (n - 0.5) * 0.7, x, y));
    }
  for (let i = 0; i < L / 3; i++) {
    const x = Math.round(i * 3 + hash2(i, 21, seed) * 2);
    const y = Math.round(path - half * 0.2 + (i % 2 ? 1 : -1) * half * 0.25);
    const c = t.get(x, y, true);
    if (c >> 4 === M.nieve) {
      t.set(x, y, M.nieve, 0, true);
      if (hash2(i, 22, seed) < 0.4) t.set(x + 1, y, M.tierra, 1, true);
    } else if (c >> 4 === M.tierra && hash2(i, 23, seed) < 0.35) t.set(x, y, M.tierra, 1, true);
  }
  // El arroyo de deshielo: baja entre cantos, con espuma; la senda lo cruza por pasaderas.
  const sx = arroyoAt(L, wild, seed);
  if (sx > 0)
    for (let y = 0; y < H; y++) {
      const cx = sx - (H - y) * 0.45 + Math.sin(y * 0.25 + seed) * 2;
      const hw = 1.8 + y * 0.1;
      for (let x = Math.floor(cx - hw - 2); x <= cx + hw + 2; x++) {
        const d = x - cx;
        if (Math.abs(d) >= hw + 1) {
          // La orilla: guijarros.
          if (hash2(x, y, seed + 195) < 0.5)
            t.set(x, y, M.roca, d < 0 ? 4 : 2 + (hash2(x, y, 196) < 0.5 ? 1 : 0), true);
          continue;
        }
        if (Math.abs(d) >= hw) {
          t.set(x, y, M.roca, d < 0 ? 3 : 1, true);
          continue;
        }
        const rip = noise2(x / 2, y * 1.3 + 0.3, seed + 197, L / 2);
        if (rip > 0.78) t.set(x, y, M.nieve, rip > 0.86 ? 5 : 4, true);
        else t.set(x, y, M.agua, step(2 + (d > 0 ? 0.6 : 0) + (rip < 0.22 ? -0.8 : 0), x, y), true);
      }
      // Pasaderas: tres piedras planas de lado a lado en la senda.
      if (y === Math.round(path)) {
        for (const f of [-0.65, 0, 0.6]) {
          const px = Math.round(cx + f * hw * 1.2);
          for (let k = -1; k <= 1; k++) {
            t.set(px + k, y - 1, M.roca, k < 0 ? 5 : k === 0 ? 4 : 3, true);
            t.set(px + k, y, M.roca, k < 0 ? 3 : 2, true);
          }
          t.set(px - 1, y + 1, M.nieve, 4, true);
          t.set(px + 1, y + 1, M.agua, 1, true);
        }
      }
    }
  return [t, y0];
};

// ---------- Lo de delante ----------

/** Un cardo: tallo, hojas con pinchos y la flor morada. */
function cardo(t: Tonos, x: number, base: number, h: number, s: number) {
  tuft(t, x, base, Math.round(h * 0.6), s, M.musgo);
  for (let k = 0; k < h; k++) t.set(x, base - k, M.musgo, 2 + (k / h) * 1.5, true);
  const fy = base - h;
  t.set(x - 1, fy, M.mies, 3, true);
  t.set(x, fy, M.mies, 4, true);
  t.set(x + 1, fy, M.mies, 2, true);
  t.set(x, fy - 1, M.mies, 5, true);
  t.set(x - 1, fy + 1, M.musgo, 3, true);
  t.set(x + 1, fy + 1, M.musgo, 2, true);
}

const delante: Painter = (e, L, wild, seed, o) => {
  const H = Math.max(14, Math.min(28, e.h - e.feet - 6));
  const t = new Tonos(L, H);
  const base = H - 1;
  const near = snowNear(wild, o);
  for (let i = 0; i < L / 20; i++) {
    const x = Math.round(i * 20 + hash2(i, 1, seed + 200) * 12);
    if (hash2(i, 2, seed + 200) > 0.72) continue;
    const k = hash2(i, 3, seed + 200);
    const s = i * 17 + seed;
    if (k < 0.22) {
      // Un canto que asoma (con liquen y la cara del sol bien clara: aquí todo va a contraluz).
      const w = 10 + Math.round(hash2(i, 4, seed) * 8);
      canto(t, x, base + 2, w, Math.round(H * 0.4), s, { lichen: 0.8, snow: near, lift: 0.8 });
      tuft(t, x + Math.round(w / 2), base + 1, Math.round(H * 0.35), s, M.hierba, 0.6);
    } else if (k < 0.45) cardo(t, x, base, Math.round(H * (0.45 + hash2(i, 5, seed) * 0.2)), s);
    else if (k < 0.85) {
      // Festuca: matas altas y finas, de dos en dos.
      tuft(t, x, base, Math.round(H * (0.5 + hash2(i, 6, seed) * 0.35)), s, M.hierba, 0.6);
      if (hash2(i, 7, seed) < 0.6)
        tuft(t, x + 4, base + 1, Math.round(H * 0.35), s + 1, M.musgo, 0.4);
    } else tuft(t, x, base, Math.round(H * 0.6), s, M.musgo, 0.4);
  }
  nevar(t, near * 0.7, seed + 201);
  return [t, e.h - H];
};

export const SIERRA: Paisaje = {
  capas: { lejos, sierra, colinas, medio, cerca, suelo, delante },
};
