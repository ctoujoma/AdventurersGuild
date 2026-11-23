/**
 * Las capas del paisaje del bosque, de lejos a cerca: montes con bruma, sierra, colinas (sembrados
 * cerca de casa, bosque cada vez más cerrado lejos), árboles a media distancia, árboles cerca, el
 * suelo con el camino y las matas de delante. Cada una es una tira de tonos de largo `L` que
 * empalma consigo misma y se desplaza a su velocidad (paralaje).
 *
 * Lo salvaje (`wild`, 0–1) no corta: cada cosa tiene su número y sale si está por debajo de lo que
 * toca a esa lejanía (más árboles, más altos y más viejos, menos sembrados, camino más estrecho).
 */
import type { Encuadre } from './encuadre';
import { bush, fern, leafy, pine, pineSmall, rock, tuft } from './arboles';
import type { Depth } from './luz';
import { M, Tonos, clamp01, fbm1, hash, hash2, lerp, noise2, smooth, type Mat } from './tonos';
import { bayer } from '../../art/pixel';

export type CapaId = 'lejos' | 'sierra' | 'colinas' | 'medio' | 'cerca' | 'suelo' | 'delante';

export interface Capa {
  id: CapaId;
  t: Tonos;
  /** Fila de la pantalla donde empieza la tira. */
  y: number;
  /** Lo que se mueve por cada píxel que avanza el suelo. */
  speed: number;
  depth: Depth;
}

export const SPEED: Record<CapaId, number> = {
  lejos: 0.03,
  sierra: 0.08,
  colinas: 0.2,
  medio: 0.4,
  cerca: 0.7,
  suelo: 1,
  delante: 1.5,
};

const DEPTH: Record<CapaId, Depth> = {
  lejos: { haze: 0.62, fog: 1 },
  sierra: { haze: 0.4, fog: 0.95 },
  colinas: { haze: 0.2, fog: 0.82 },
  medio: { haze: 0.1, fog: 0.62 },
  cerca: { haze: 0.03, fog: 0.4 },
  suelo: { haze: 0, fog: 0.16 },
  delante: { haze: 0, fog: 0.05, dark: 1 },
};

/** Lo que se apaga cada plano en el bosque cerrado (lo de cerca, a la sombra de los árboles). */
const DIM: Record<CapaId, number> = {
  lejos: 0,
  sierra: 0,
  colinas: 0.05,
  medio: 0.18,
  cerca: 0.24,
  suelo: 0.3,
  delante: 0.32,
};

const step = (v: number, x: number, y: number) => {
  const b = Math.floor(v);
  return v - b > bayer(x, y) ? b + 1 : b;
};

/** Largo de las tiras para un ancho de pantalla. */
export const stripLen = (w: number) => Math.max(384, Math.ceil((w * 2) / 32) * 32);

export function buildCapas(e: Encuadre, wild: number, seed: number): Capa[] {
  const L = stripLen(e.w);
  const mk = (id: CapaId, t: Tonos, y: number): Capa => ({
    id,
    t,
    y,
    speed: SPEED[id],
    depth: { ...DEPTH[id], dim: 1 - DIM[id] * smooth(0.3, 1, wild) },
  });
  return [
    mk('lejos', ...lejos(e, L, wild, seed)),
    mk('sierra', ...sierra(e, L, wild, seed)),
    mk('colinas', ...colinas(e, L, wild, seed)),
    mk('medio', ...medio(e, L, wild, seed)),
    mk('cerca', ...cerca(e, L, wild, seed)),
    mk('suelo', ...suelo(e, L, wild, seed)),
    mk('delante', ...delante(e, L, wild, seed)),
  ];
}

// ---------- Montes lejanos ----------

function lejos(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const H = Math.round(e.hor * 0.62);
  const t = new Tonos(L, H + 2);
  const amp = H * lerp(0.82, 1, wild);
  const ridged = (v: number) => 1 - Math.abs(v * 2 - 1);
  // Cumbres de dos tamaños sobre una base común: picos (ruido «crestado») y collados.
  const tops = Array.from({ length: L }, (_, x) => {
    const r1 = ridged(fbm1(x, 150, L, seed + 1, 3));
    const r2 = ridged(fbm1(x, 46, L, seed + 2, 2));
    return H + 1 - Math.min(1, 0.22 + 0.5 * r1 ** 1.6 + 0.26 * r2 * r1) * amp;
  });
  paintRange(t, tops, { snow: H - amp * 0.58, seed: seed + 3, mat: M.monte, foot: 0.5 });
  return [t, e.hor - H + 1];
}

/**
 * Pinta una sierra bajo la cresta `tops`: cada píxel mira a un lado según hacia dónde baja la
 * cresta cerca de él (más ancho cuanto más abajo: las caras grandes), con surcos en diagonal que
 * bajan hacia fuera y la nieve por encima de una línea que sube y baja (con calvas de roca).
 */
function paintRange(
  t: Tonos,
  tops: number[],
  o: { snow: number; seed: number; mat: Mat; foot: number },
): void {
  const L = t.w;
  const ridge = (x: number) => tops[((Math.round(x) % L) + L) % L]!;
  for (let x = 0; x < L; x++) {
    const y0 = Math.max(0, Math.ceil(ridge(x)));
    for (let y = y0; y < t.h; y++) {
      const d = y - ridge(x);
      const r = 2 + d * 0.55;
      const xs =
        x + (noise2(x / 9, y / 9, o.seed, Math.round(L / 9)) - 0.5) * Math.min(d, 24) * 0.5;
      const slope = ridge(xs + r) - ridge(xs - r);
      // slope > 0: la cresta baja hacia la derecha; la cara mira a la derecha (en sombra).
      const right = slope > 0;
      const flat = Math.abs(slope) < r * 0.15;
      const u = x - (right ? 1 : -1) * d * 0.9;
      const g =
        noise2(u / 5, 0.5, o.seed + 11, Math.round(L / 5)) * 0.7 +
        noise2(x / 3, y / 12, o.seed + 13, Math.round(L / 3)) * 0.3;
      const snowline = o.snow + (fbm1(x, 24, L, o.seed + 5, 2) - 0.5) * 10 + (g - 0.5) * 8;
      const snowy = y < snowline && !(g < 0.32 && d > 4);
      const lit = flat ? 0.55 : right ? 0.25 : 0.72;
      // Al pie, más claro (la bruma sube del valle).
      const foot = Math.max(0, (y - t.h * 0.55) / (t.h * 0.45)) * o.foot;
      if (snowy) t.set(x, y, M.nieve, step((lit + 0.1 + (g - 0.5) * 0.4) * 5.4, x, y));
      else t.set(x, y, o.mat, step((lit + (g - 0.5) * 0.45 + foot) * 6.2, x, y));
    }
  }
}

// ---------- Sierra ----------

function sierra(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const H = Math.round(e.hor * lerp(0.24, 0.36, wild));
  const t = new Tonos(L, H + 3);
  const ridged = (v: number) => 1 - Math.abs(v * 2 - 1);
  const tops = Array.from({ length: L }, (_, x) => {
    const r1 = ridged(fbm1(x, 80, L, seed + 11, 3));
    const n = fbm1(x, 30, L, seed + 12, 2);
    return H - Math.min(1, 0.18 + 0.62 * r1 ** 1.3 + 0.2 * n) * H * 0.95;
  });
  paintRange(t, tops, {
    snow: wild > 0.45 ? H * (0.1 + (wild - 0.45) * 0.4) : -99,
    seed: seed + 14,
    mat: M.roca,
    foot: 0.15,
  });
  // El bosque que trepa por la falda: pinitos de 3–6 px muy juntos.
  const treeLine = H * lerp(0.55, 0.3, wild);
  for (let i = 0; i < L / 2; i++) {
    const x = Math.round(i * 2 + hash2(i, 1, seed) * 2);
    const top = tops[x % L]!;
    const y = Math.round(lerp(Math.max(top + 2, treeLine), t.h + 2, hash2(i, 2, seed) ** 0.7));
    if (y < top + 2) continue;
    pineSmall(
      t,
      x,
      y,
      3 + Math.round(hash2(i, 3, seed) * 3),
      wild > 0.6 ? M.viejo : M.pino,
      i,
      -0.4,
    );
  }
  return [t, e.hor - H + 1];
}

// ---------- Colinas ----------

function colinas(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const y0 = e.hor - Math.round(e.hor * 0.16);
  const H = e.ground - y0 + 4;
  const t = new Tonos(L, H);
  const amp = H * 0.45;
  const top = (x: number) => 1 + (1 - fbm1(x, 110, L, seed + 21, 3)) * amp;
  const tops = Array.from({ length: L }, (_, x) => top(x));
  // Sembrados: parcelas a lo largo de las colinas, solo cerca de casa.
  const farm = clamp01(1 - wild * 3.2);
  const forest = smooth(0.02, 0.6, wild);
  // Parcelas (bordes con periodo L).
  const cuts: number[] = [0];
  for (let x = 0; x < L - 30;) {
    x += 22 + Math.round(hash(x + seed) * 34);
    if (x < L - 14) cuts.push(x);
  }
  const parcelOf = (x: number) => {
    let k = 0;
    while (k + 1 < cuts.length && cuts[k + 1]! <= x) k++;
    return k;
  };
  for (let x = 0; x < L; x++) {
    const tp = Math.round(tops[x]!);
    const k = parcelOf(x);
    const isFarm = hash2(k, 7, seed) < farm * 0.9;
    const kind = hash2(k, 8, seed);
    for (let y = tp; y < H; y++) {
      const u = (y - tp) / Math.max(1, H - tp);
      let v = 3.2 - u * 1.2 + (noise2(x / 8, y / 4, seed + 22, Math.round(L / 8)) - 0.5) * 1.2;
      const slope = tops[(x + 2) % L]! - tops[(x - 2 + L) % L]!;
      v += slope > 0.4 ? -0.6 : slope < -0.4 ? 0.5 : 0;
      let m: Mat = M.hierba;
      if (isFarm && u > 0.08) {
        // Surcos que siguen la ladera.
        const row = Math.floor((y - tp * 0.6) / 2);
        if (kind < 0.45) {
          m = M.mies;
          v = 3 + (row % 2 ? 0.6 : -0.4) - u * 0.8;
        } else if (kind < 0.7) {
          m = M.tierra;
          v = 3.2 + (row % 2 ? 0.5 : -0.7) - u * 0.6;
        } else v += row % 2 ? 0.5 : -0.2;
      }
      t.set(x, y, m, step(v, x, y));
    }
    // Setos entre parcelas.
    if (farm > 0 && cuts.includes(x) && hash2(k, 9, seed) < farm)
      for (let y = tp; y < H; y += 2) bush(t, x, y + 2, 3, 2, M.hoja, x * 7 + y);
  }
  // Alguna casa de labor en la loma.
  if (farm > 0.2)
    for (let k = 0; k < cuts.length; k++) {
      if (hash2(k, 31, seed) > 0.18 * farm) continue;
      const x = cuts[k]! + 10;
      house(t, x, Math.round(tops[x % L]!) + 6, k + seed);
    }
  // El bosque: filas de pinos pequeños de atrás a delante, cada vez más juntos.
  const rows = Math.ceil(H / 3);
  for (let r = 0; r < rows; r++) {
    const gap = 3;
    for (let i = 0; i < L / gap; i++) {
      const id = r * 997 + i;
      const x = Math.round(i * gap + hash2(id, 1, seed) * gap);
      const tp = tops[((x % L) + L) % L]!;
      const y = Math.round(tp + 2 + r * 3 + hash2(id, 2, seed) * 2);
      if (y >= H + 2) continue;
      // Cerca de casa, bosquecillos sueltos (manchas); lejos, todo cubierto.
      const clump = noise2(x / 26, r / 3, seed + 23, Math.round(L / 26));
      const p = lerp(clump > 0.62 ? 0.75 : 0.04, 1.05, forest);
      if (hash2(id, 3, seed) > p) continue;
      const old = hash2(id, 4, seed) < smooth(0.45, 0.95, wild);
      const h = Math.round(5 + hash2(id, 5, seed) * 4 + wild * 4 + r * 0.3);
      pineSmall(t, x, y, h, old ? M.viejo : M.pino, id, r / rows - 0.2);
    }
  }
  return [t, y0];
}

function house(t: Tonos, x: number, base: number, s: number) {
  const w = 9 + (s % 3) * 2;
  const h = 5;
  for (let y = base - h; y <= base; y++)
    for (let i = 0; i < w; i++) t.set(x + i, y, M.tierra, i < 2 ? 4 : 5, true);
  // Tejado rojo a dos aguas.
  for (let j = 0; j < 4; j++)
    for (let i = -1 + j; i <= w - j; i++)
      t.set(x + i, base - h - 1 - j, M.fruta, j === 3 ? 2 : i < w / 2 ? 2 : 1, true);
  t.set(x + 3, base - 2, M.corteza, 0, true);
  t.set(x + 3, base - 1, M.corteza, 0, true);
  t.set(x + w - 3, base - 3, M.corteza, 1, true);
}

// ---------- Árboles a media distancia ----------

function medio(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const H = Math.round(e.ground * 0.62);
  const y0 = e.ground + 2 - H;
  const t = new Tonos(L, H);
  const base = H - 2;
  const gap = Math.round(lerp(13, 6, wild));
  const n = Math.floor(L / gap);
  const density = lerp(0.35, 1, smooth(0, 0.7, wild));
  for (let i = 0; i < n; i++) {
    const x = Math.round(i * gap + hash2(i, 1, seed + 40) * gap * 0.8);
    if (hash2(i, 2, seed + 40) > density) continue;
    const b = base - Math.round(hash2(i, 3, seed + 40) * 3);
    const r = hash2(i, 4, seed + 40);
    // Cerca de casa, frutales y chopos; luego pinos, más altos y viejos.
    const leafP = clamp01(0.85 - wild * 2.2);
    if (r < leafP) {
      const tall = hash2(i, 5, seed + 40) < 0.3;
      leafy(t, x, b, Math.round(12 + hash2(i, 6, seed) * 8), {
        seed: i + seed,
        tall,
        fruit: !tall && hash2(i, 7, seed) < 0.6,
      });
    } else {
      const h = Math.round(lerp(14, 26, wild) + hash2(i, 8, seed + 40) * lerp(8, 16, wild));
      pine(t, x, b, Math.min(H - 1, h), {
        seed: i * 13 + seed,
        old: wild > 0.5 ? (wild - 0.5) * 1.6 : 0,
      });
    }
  }
  return [t, y0];
}

// ---------- Árboles cerca (detrás del camino) ----------

function cerca(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const H = e.ground + 7;
  const t = new Tonos(L, H);
  const base = e.ground + 4;
  // La orilla: hierba entre los árboles y el camino.
  for (let x = 0; x < L; x++) {
    const top = e.ground + Math.round(fbm1(x, 40, L, seed + 50, 2) * 2);
    for (let y = top; y < H; y++) {
      const v = 2.4 + (noise2(x / 3, y / 2, seed + 51, Math.round(L / 3)) - 0.5) * 1.6;
      t.set(
        x,
        y,
        wild > 0.6 && hash2(x, y, 52) < (wild - 0.6) * 1.2 ? M.musgo : M.hierba,
        step(v, x, y),
      );
    }
  }
  // Cerca de casa: una valla de palos que va y viene.
  const fence = clamp01(1 - wild * 4);
  if (fence > 0) {
    for (let x = 0; x < L; x++) {
      const k = Math.floor(x / 64);
      if (hash2(k, 1, seed + 53) > fence) continue;
      const fy = base - 1;
      if (x % 8 === 0) {
        for (let y = fy - 7; y <= fy; y++) t.set(x, y, M.valla, 3, true);
        t.set(x + 1, fy - 6, M.valla, 1, true);
        t.set(x, fy - 7, M.valla, 4, true);
      }
      t.set(x, fy - 5, M.valla, x % 8 === 0 ? 4 : 3, true);
      t.set(x, fy - 4, M.valla, 1, true);
      t.set(x, fy - 2, M.valla, x % 8 === 0 ? 4 : 3, true);
      t.set(x, fy - 1, M.valla, 1, true);
    }
  }
  // Los árboles: cerca de casa, pocos frutales grandes; lejos, pinos que tapan el cielo.
  const gap = Math.round(lerp(46, 17, smooth(0, 0.85, wild)));
  const n = Math.floor(L / gap);
  const density = lerp(0.5, 1, smooth(0.05, 0.6, wild));
  const slots: { x: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (hash2(i, 2, seed + 60) > density) continue;
    slots.push({ x: Math.round(i * gap + hash2(i, 1, seed + 60) * gap * 0.7), i });
  }
  // Los de atrás (más bajos) primero.
  for (const { x, i } of slots) {
    const r = hash2(i, 3, seed + 60);
    const leafP = clamp01(0.9 - wild * 2.4);
    const b = base - Math.round(hash2(i, 4, seed + 60) * 2);
    if (r < leafP) {
      leafy(t, x, b, Math.round(26 + hash2(i, 5, seed) * 14), {
        seed: i * 7 + seed,
        fruit: hash2(i, 6, seed) < 0.65,
      });
    } else {
      const old = wild > 0.45 ? (wild - 0.45) * 1.8 : 0;
      // Alturas muy desiguales: alguno enorme, alguno joven.
      const r2 = hash2(i, 7, seed + 60);
      const giant = r2 > 0.82 ? 1.45 : r2 < 0.2 ? 0.62 : 1;
      const h = Math.round((lerp(34, 60, wild) + r2 * lerp(14, 30, wild)) * giant);
      pine(t, x, b + (giant < 1 ? -2 : 0), h, {
        seed: i * 31 + seed,
        old,
        trunk: giant > 1 && wild > 0.4 ? 2 : 1,
        fat: 1 + old * 0.15,
      });
    }
    // A sus pies, matas, helechos o una piedra.
    const f = hash2(i, 9, seed + 60);
    if (f < 0.4) bush(t, x + 6, base + 1, 9, 5, M.hoja, i);
    else if (wild > 0.3 && f < 0.75) fern(t, x - 5, base + 1, 6, i, M.hierba);
    if (wild > 0.35 && hash2(i, 10, seed) < wild * 0.5) rock(t, x + 9, base + 2, 7, 4, i, wild);
  }
  return [t, 0];
}

// ---------- El suelo y el camino ----------

function suelo(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const y0 = e.ground + 4;
  const H = e.h - y0;
  const t = new Tonos(L, H);
  const path = e.feet - y0 - 1;
  const half = lerp(7, 2.2, smooth(0, 0.95, wild));
  const grassOver = smooth(0.35, 1, wild);
  for (let x = 0; x < L; x++) {
    const wob = (fbm1(x, 50, L, seed + 70, 3) - 0.5) * 4 * (0.4 + wild);
    const top = path - half + wob + (fbm1(x, 12, L, seed + 71, 2) - 0.5) * 2;
    const bot = path + half * 0.8 + wob * 0.6 + (fbm1(x, 14, L, seed + 72, 2) - 0.5) * 2;
    for (let y = 0; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 73, Math.round(L / 3));
      if (y >= top && y <= bot) {
        // Tierra del camino: rodadas cerca de casa, hierba que lo come lejos.
        const u = (y - top) / Math.max(1, bot - top);
        let v = 3.4 + wild * 0.6 - u * 0.8 + (n - 0.5) * 1.4;
        const rut = wild < 0.5 && (Math.abs(u - 0.3) < 0.08 || Math.abs(u - 0.75) < 0.08);
        if (rut) v -= 1.4 * (1 - wild * 2);
        if (y < top + 1) v -= 1;
        const g = noise2(x / 4, y / 3, seed + 74, Math.round(L / 4));
        if (g < grassOver * 0.3 && hash2(x, y, 75) < grassOver) {
          t.set(x, y, M.hierba, step(2.8 + (n - 0.5), x, y));
          continue;
        }
        t.set(x, y, M.tierra, step(v, x, y));
      } else {
        // Hierba: a contraluz por arriba (orilla) y más clara a los pies.
        const near = y > bot ? (y - bot) / Math.max(1, H - bot) : 0;
        let v = 2.6 + (n - 0.5) * 1.5 + near * 0.6;
        if (y > bot && y < bot + 2) v -= 1; // el borde del camino, hundido
        // El suelo del bosque: pinocha y tierra a manchas, y musgo.
        const floor = noise2(x / 7, y / 3, seed + 77, Math.round(L / 7));
        if (floor < smooth(0.3, 1, wild) * 0.3 && Math.abs(y - path) > half + 3) {
          t.set(x, y, M.tierra, step(1.6 + (n - 0.5) * 1.4 + near * 0.5, x, y));
          continue;
        }
        if (wild > 0.55 && hash2(x, y, 76) < (wild - 0.55) * 0.5) {
          t.set(x, y, M.musgo, step(v, x, y));
          continue;
        }
        t.set(x, y, M.hierba, step(v, x, y));
      }
    }
  }
  // Briznas y flores por encima de la hierba, piedras y raíces en el camino.
  for (let i = 0; i < L / 3; i++) {
    const x = Math.round(i * 3 + hash2(i, 1, seed + 80) * 3);
    const y = Math.round(hash2(i, 2, seed + 80) * (H - 1));
    if (Math.abs(y - path) < half + 1) {
      if (hash2(i, 3, seed + 80) < 0.12) {
        t.set(x, y, M.roca, 4, true);
        t.set(x + 1, y, M.roca, 2, true);
        t.set(x, y + 1, M.tierra, 1, true);
      }
      continue;
    }
    const r = hash2(i, 4, seed + 80);
    if (r < 0.45) {
      t.set(x, y, M.hierba, 5, true);
      t.set(x - 1, y + 1, M.hierba, 4, true);
      t.set(x + 1, y + 1, M.hierba, 4, true);
    } else if (r < 0.55 && wild < 0.6) {
      t.set(x, y, M.flor, hash2(i, 5, seed) < 0.5 ? 3 : 4, true);
      t.set(x, y + 1, M.hierba, 2, true);
    } else if (r < 0.515 && wild > 0.5) {
      // Setas.
      t.set(x, y, M.fruta, 2, true);
      t.set(x + 1, y, M.fruta, 3, true);
      t.set(x, y + 1, M.flor, 4, true);
    }
  }
  // Raíces que cruzan el sendero (bosque viejo).
  if (wild > 0.6)
    for (let i = 0; i < L / 40; i++) {
      if (hash2(i, 9, seed) > (wild - 0.6) * 2) continue;
      const x = Math.round(i * 40 + hash2(i, 10, seed) * 20);
      for (let k = 0; k < 7; k++)
        t.set(x + k, Math.round(path - half + k * ((half * 2) / 7)), M.corteza, 3 - (k & 1), true);
    }
  if (wild > 0.4)
    for (let i = 0; i < L / 70; i++) {
      if (hash2(i, 11, seed) > wild) continue;
      const x = Math.round(i * 70 + hash2(i, 12, seed) * 40);
      const y = hash2(i, 13, seed) < 0.5 ? 2 + Math.round(hash2(i, 14, seed) * 3) : H - 4;
      rock(
        t,
        x,
        y,
        6 + Math.round(hash2(i, 15, seed) * 6),
        3 + Math.round(hash2(i, 16, seed) * 3),
        i,
        wild,
      );
    }
  return [t, y0];
}

// ---------- Lo de delante ----------

function delante(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const H = Math.max(14, Math.min(28, e.h - e.feet - 6));
  const t = new Tonos(L, H);
  const base = H - 1;
  for (let i = 0; i < L / 22; i++) {
    const x = Math.round(i * 22 + hash2(i, 1, seed + 90) * 14);
    const r = hash2(i, 2, seed + 90);
    if (r > lerp(0.55, 0.8, wild)) continue;
    const k = hash2(i, 3, seed + 90);
    const s = i * 17 + seed;
    if (wild < 0.3 && k < 0.4) {
      // Espigas y hierba alta del borde de los sembrados.
      tuft(t, x, base, Math.round(H * 0.7), s, M.mies, 0.5);
    } else if (wild > 0.35 && k < 0.55) fern(t, x, base + 2, Math.round(H * 0.55), s, M.hierba);
    else if (k < 0.8) tuft(t, x, base, Math.round(H * (0.5 + hash2(i, 4, seed) * 0.4)), s);
    else bush(t, x, base + 2, 14, Math.round(H * 0.45), wild > 0.5 ? M.pino : M.hoja, s);
  }
  return [t, e.h - H];
}
