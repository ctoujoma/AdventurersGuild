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
import { bush, fern, leafy, log, pine, pineSmall, rock, stump, tuft, wheat } from './arboles';
import type { Depth } from './luz';
import { M, Tonos, clamp01, fbm1, hash, hash2, lerp, noise2, smooth, type Mat } from './tonos';
import { bayer } from '../../art/pixel';

export type CapaId =
  'lejos' | 'sierra' | 'colinas' | 'medio' | 'cerca' | 'suelo' | 'delante' | 'copas';

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
  copas: 1.2,
};

const DEPTH: Record<CapaId, Depth> = {
  lejos: { haze: 0.62, fog: 1 },
  sierra: { haze: 0.4, fog: 0.95 },
  colinas: { haze: 0.2, fog: 0.82 },
  medio: { haze: 0.1, fog: 0.62 },
  cerca: { haze: 0.03, fog: 0.4 },
  suelo: { haze: 0, fog: 0.16 },
  delante: { haze: 0, fog: 0.05, dark: 1 },
  copas: { haze: 0, fog: 0.1, dark: 1 },
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
  copas: 0.3,
};

export const step = (v: number, x: number, y: number) => {
  const b = Math.floor(v);
  return v - b > bayer(x, y) ? b + 1 : b;
};

/** Largo de las tiras para un ancho de pantalla. */
export const stripLen = (w: number) => Math.max(384, Math.ceil((w * 2) / 32) * 32);

/** Lo que pinta una capa: su tira de tonos y la fila donde va. */
export interface PaintOpts {
  /** Nieve posada por el tiempo (0–1), además de la que toque por la lejanía. */
  snow?: number;
  /** Lo mojado por la lluvia (0–1): charcos y tierra oscura. */
  wet?: number;
}
export type Painter = (
  e: Encuadre,
  L: number,
  wild: number,
  seed: number,
  o: PaintOpts,
) => [Tonos, number];

/** Un paisaje: cómo se pinta cada capa y cuánto se apaga en lo más hondo. */
export interface Paisaje {
  capas: Record<Exclude<CapaId, 'copas'>, Painter> & { copas?: Painter };
  dim?: Partial<Record<CapaId, number>>;
  /** Cuánto pesa la bruma de la distancia (1 como en el bosque; el aire seco, menos). */
  haze?: number;
}

export const BOSQUE: Paisaje = {
  capas: { lejos, sierra, colinas, medio, cerca, suelo, delante, copas },
  dim: DIM,
};

export function buildCapas(
  e: Encuadre,
  wild: number,
  seed: number,
  p: Paisaje = BOSQUE,
  o: PaintOpts = {},
): Capa[] {
  const L = stripLen(e.w);
  const ids: CapaId[] = ['lejos', 'sierra', 'colinas', 'medio', 'cerca', 'suelo', 'delante'];
  if (p.capas.copas) ids.push('copas');
  return ids.map((id) => {
    const [t, y] = p.capas[id]!(e, L, wild, seed, o);
    return {
      id,
      t,
      y,
      speed: SPEED[id],
      depth: {
        ...DEPTH[id],
        haze: DEPTH[id].haze * (p.haze ?? 1),
        dim: 1 - (p.dim?.[id] ?? 0) * smooth(0.3, 1, wild),
      },
    };
  });
}

// ---------- Montes lejanos ----------

export function lejos(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
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
export function paintRange(
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

export function house(t: Tonos, x: number, base: number, s: number) {
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

// ---------- Especies ----------

/**
 * Un árbol del bosque a esta lejanía: frutales y chopos junto a casa; robles, hayas y abedules en
 * el bosque mixto; el pinar, cada vez más, y en lo más hondo pinos viejos.
 */
function arbol(t: Tonos, x: number, b: number, h: number, wild: number, id: number, s: number) {
  const r = hash2(id, 31, s);
  const fruit = clamp01(0.9 - wild * 4.5);
  const pineP = smooth(0.25, 0.85, wild);
  if (r < fruit) {
    const tall = hash2(id, 32, s) < 0.3;
    leafy(t, x, b, Math.round(h * (tall ? 0.7 : 0.55)), {
      seed: id + s,
      tall,
      fruit: !tall && hash2(id, 33, s) < 0.6,
    });
    return;
  }
  if (hash2(id, 34, s) < pineP) {
    const old = wild > 0.5 ? (wild - 0.5) * 1.8 : 0;
    const r2 = hash2(id, 35, s);
    const giant = r2 > 0.82 ? 1.35 : r2 < 0.2 ? 0.65 : 1;
    pine(t, x, b + (giant < 1 ? -2 : 0), Math.round(h * giant), {
      seed: id * 31 + s,
      old,
      trunk: giant > 1 && wild > 0.4 && h > 40 ? 2 : h > 40 ? 1 : 0,
      fat: 1 + old * 0.15,
    });
    return;
  }
  // Bosque mixto: roble (redondo), haya (más alta y clara) o abedul (blanco y fino).
  const k = hash2(id, 36, s);
  if (k < 0.22)
    leafy(t, x, b, Math.round(h * 0.75), {
      seed: id * 7 + s,
      tall: true,
      bark: M.nieve,
      mat: M.musgo,
    });
  else if (k < 0.55) leafy(t, x, b, Math.round(h * 0.7), { seed: id * 7 + s, mat: M.musgo });
  else leafy(t, x, b, Math.round(h * 0.62), { seed: id * 7 + s });
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
    // Los pies, a distinta altura (unos más atrás que otros).
    const b = base - Math.round(hash2(i, 3, seed + 40) * 5);
    const h = Math.round(lerp(18, 30, wild) + hash2(i, 8, seed + 40) * lerp(8, 16, wild));
    arbol(t, x, b, Math.min(H - 1, h), wild, i, seed + 40);
  }
  return [t, y0];
}

// ---------- Árboles cerca (detrás del camino) ----------

/** Un mojón de piedra con la cruz grabada (cerca de casa). */
function mojon(t: Tonos, x: number, base: number) {
  for (let j = 0; j < 9; j++)
    for (let i = 0; i < 4; i++)
      t.set(x + i, base - j, M.roca, i === 0 ? 5 : i === 3 ? 2 : 4 - (j === 8 ? 0 : 0), true);
  t.set(x + 1, base - 6, M.roca, 1, true);
  t.set(x + 2, base - 6, M.roca, 1, true);
  t.set(x + 1, base - 5, M.roca, 1, true);
  t.set(x + 1, base - 7, M.roca, 1, true);
  for (let i = -1; i <= 4; i++) t.set(x + i, base + 1, M.roca, 1, true);
}

/** Un carro roto: caja ladeada, una rueda caída y la otra entera. */
function carro(t: Tonos, x: number, base: number, s: number) {
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 5; j++) {
      const y = base - 4 - j + Math.round(i * 0.2);
      t.set(x + i, y, M.valla, j === 4 ? 4 : j === 0 ? 1 : (i + j) % 4 === 0 ? 2 : 3, true);
    }
  // Rueda entera (aro y radios) y la caída, plana.
  const cx = x + 4;
  const cy = base - 4;
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    t.set(
      cx + Math.round(Math.cos(ang) * 4),
      cy + Math.round(Math.sin(ang) * 4),
      M.corteza,
      2,
      true,
    );
  }
  for (let k = -3; k <= 3; k++) {
    t.set(cx + k, cy, M.corteza, 1, true);
    t.set(cx, cy + k, M.corteza, 1, true);
  }
  for (let i = 0; i < 9; i++) t.set(x + 14 + i, base, M.corteza, i % 4 === 0 ? 1 : 2, true);
  // La lanza, en el suelo.
  for (let i = 0; i < 10; i++) t.set(x - 9 + i, base - Math.round(i * 0.3), M.valla, 2, true);
  bush(t, x + 10, base + 1, 8, 3, M.hierba, s);
}

/** Una cabaña de leñadores: troncos, tejado de tablas, leña apilada al lado. */
function cabana(t: Tonos, x: number, base: number, s: number) {
  const w = 22;
  const h = 10;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const row = Math.floor(j / 2);
      const v = j % 2 === 0 ? 1 : i < 2 ? 4 : 3;
      t.set(x + i, base - j, M.corteza, v - (row % 3 === 0 ? 0 : 0), true);
    }
  // Puerta y ventanuco con luz.
  for (let j = 0; j < 7; j++)
    for (let i = 8; i < 12; i++) t.set(x + i, base - j, M.corteza, 0, true);
  t.set(x + 16, base - 6, M.mies, 4, true);
  t.set(x + 17, base - 6, M.mies, 3, true);
  // Tejado de tablas a dos aguas, que vuela.
  for (let j = 0; j < 7; j++)
    for (let i = -2 + j; i < w + 2 - j; i++)
      t.set(x + i, base - h - j, M.valla, j === 0 ? 1 : i < w / 2 ? 4 : 2, true);
  // Leña apilada: rodajas.
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 6; i++) t.set(x + w + 2 + i, base - j, M.valla, (i + j) % 2 ? 4 : 2, true);
  // Humo (tenue, quieto: el visor lo anima aparte si hace falta).
  t.set(x + 4, base - h - 6, M.roca, 5, true);
  void s;
}

/** Un santuario de camino: hornacina de piedra con una imagen y velas. */
function santuario(t: Tonos, x: number, base: number) {
  for (let j = 0; j < 14; j++)
    for (let i = 0; i < 8; i++) {
      const niche = i > 1 && i < 6 && j > 4 && j < 11;
      t.set(x + i, base - j, M.roca, niche ? 0 : i === 0 ? 5 : i === 7 ? 2 : 4, true);
    }
  // Tejadillo y la imagen.
  for (let i = -1; i <= 8; i++) t.set(x + i, base - 14, M.roca, 5, true);
  for (let i = 1; i <= 6; i++) t.set(x + i, base - 15, M.roca, 3, true);
  t.set(x + 3, base - 9, M.nieve, 4, true);
  t.set(x + 4, base - 9, M.nieve, 3, true);
  t.set(x + 3, base - 8, M.agua, 3, true);
  t.set(x + 4, base - 8, M.agua, 2, true);
  t.set(x + 3, base - 7, M.agua, 3, true);
  t.set(x + 4, base - 7, M.agua, 2, true);
  // Velas y flores al pie.
  t.set(x + 2, base - 5, M.mies, 5, true);
  t.set(x + 5, base - 5, M.mies, 5, true);
  t.set(x - 1, base, M.flor, 3, true);
  t.set(x + 9, base, M.flor, 4, true);
}

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
  // Los árboles en dos filas: la de atrás (pies más arriba, algo más bajos) y la de delante.
  const gap = Math.round(lerp(46, 17, smooth(0, 0.85, wild)));
  const density = lerp(0.5, 0.92, smooth(0.05, 0.6, wild));
  const shade = (x: number, w: number) => {
    // La sombra del árbol sobre la hierba, hacia la derecha (el sol de la izquierda).
    for (let i = 0; i < w; i++)
      for (let j = 0; j < 3; j++) {
        const xx = x + i;
        const y = base + 1 + j;
        const c = t.get(xx, y, true);
        if (!c || c >> 4 !== M.hierba) continue;
        if (Math.abs(i / w - 0.5) * 2 + j / 3 > 1 + (hash2(xx, y, 7) - 0.5) * 0.3) continue;
        t.set(xx, y, M.hierba, Math.max(0, (c & 15) - 1), true);
      }
  };
  for (const row of [0, 1]) {
    const n = Math.floor(L / gap);
    for (let i = 0; i < n; i++) {
      const id = i + row * 997;
      if (hash2(id, 2, seed + 60) > density * (row ? 1 : 0.8)) continue;
      const x = Math.round(i * gap + (row ? gap * 0.5 : 0) + hash2(id, 1, seed + 60) * gap * 0.5);
      const b = row
        ? base + Math.round(hash2(id, 4, seed + 60) * 2)
        : base - 4 - Math.round(hash2(id, 4, seed + 60) * 2);
      const h = Math.round(
        (lerp(34, 60, wild) + hash2(id, 7, seed + 60) * lerp(14, 30, wild)) * (row ? 1 : 0.78),
      );
      if (row) shade(x + 2, Math.round(h * 0.35));
      arbol(t, x, b, h, wild, id, seed + 60);
      // A sus pies, sotobosque: matas, helechos, una piedra o un tronco caído.
      const f = hash2(id, 9, seed + 60);
      if (f < 0.3) bush(t, x + 6, b + 1, 9, 5, M.hoja, id);
      else if (wild > 0.25 && f < 0.6) fern(t, x - 5, b + 1, 6, id, M.hierba);
      else if (wild > 0.45 && f < 0.7)
        log(t, x + 4, b + 1, 14 + Math.round(hash2(id, 11, seed) * 10), id, wild);
      if (wild > 0.35 && hash2(id, 10, seed) < wild * 0.4) rock(t, x + 9, b + 2, 7, 4, id, wild);
    }
  }
  // Una señal del camino por tira, según la lejanía.
  const lx = Math.round(L * (0.2 + hash2(seed, 61, 3) * 0.5));
  if (wild < 0.22) mojon(t, lx, base + 1);
  else if (wild < 0.45) carro(t, lx, base + 1, seed);
  else if (wild < 0.62) cabana(t, lx, base + 1, seed);
  else if (wild < 0.85) santuario(t, lx, base + 1);
  else log(t, lx, base + 1, 40, seed, 1);
  return [t, 0];
}

// ---------- El suelo y el camino ----------

/** Dónde cruza el arroyo la tira (si cruza): solo en el bosque de media lejanía. */
const streamAt = (L: number, wild: number, seed: number) =>
  wild > 0.3 && wild < 0.88 && hash2(seed, Math.round(wild * 8), 72) < 0.65
    ? Math.round(L * (0.62 + hash2(seed, 71, 5) * 0.2))
    : -999;

function suelo(
  e: Encuadre,
  L: number,
  wild: number,
  seed: number,
  o: PaintOpts = {},
): [Tonos, number] {
  const y0 = e.ground + 4;
  const H = e.h - y0;
  const t = new Tonos(L, H);
  const path = e.feet - y0 - 1;
  const half = lerp(7, 2.6, smooth(0, 0.95, wild));
  const grassOver = smooth(0.35, 1, wild);
  const deep = smooth(0.65, 1, wild);
  const sx = streamAt(L, wild, seed);
  const wet = o.wet ?? 0;
  for (let x = 0; x < L; x++) {
    // El camino serpentea un poco (lento) y tiembla en los bordes.
    const wind = (fbm1(x, 140, L, seed + 69, 2) - 0.5) * 5;
    const wob = (fbm1(x, 50, L, seed + 70, 3) - 0.5) * 3 * (0.4 + wild) + wind;
    const top = path - half + wob + (fbm1(x, 12, L, seed + 71, 2) - 0.5) * 2;
    const bot = path + half * 0.8 + wob * 0.6 + (fbm1(x, 14, L, seed + 72, 2) - 0.5) * 2;
    // El arroyo: baja serpenteando, más ancho cuanto más cerca; el camino lo cruza por un puente.
    for (let y = 0; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 73, Math.round(L / 3));
      if (sx > 0) {
        const cx = sx - (H - y) * 0.45 + Math.sin(y * 0.22 + seed) * 2.2;
        const hw = 2.2 + y * 0.11;
        const d = x - cx;
        if (Math.abs(d) < hw + 1) {
          const onBridge = y >= top - 1 && y <= bot + 1;
          if (onBridge) {
            // Puente de tablas: tablones de través y el canto de abajo en sombra.
            const v = y > bot ? 0.6 : x % 3 === 0 ? 1.6 : 3.8 - ((y - top) / (bot - top + 1)) * 0.8;
            t.set(x, y, M.valla, step(v, x, y));
            continue;
          }
          if (Math.abs(d) >= hw) t.set(x, y, M.tierra, d < 0 ? 1 : 2);
          else {
            const rip = noise2(x / 2, y * 1.4 + 0.3, seed + 74, Math.round(L / 2));
            const v = 2 + (d > 0 ? 0.6 : 0) + (rip > 0.72 ? 1.5 : rip < 0.2 ? -0.8 : 0);
            t.set(x, y, M.agua, step(v, x, y));
          }
          continue;
        }
      }
      if (y >= top && y <= bot) {
        const u = (y - top) / Math.max(1, bot - top);
        let v = 3.4 + wild * 0.6 - u * 0.8 + (n - 0.5) * 1.4;
        const rut = wild < 0.5 && (Math.abs(u - 0.3) < 0.08 || Math.abs(u - 0.75) < 0.08);
        if (rut) v -= 1.4 * (1 - wild * 2);
        if (y < top + 1) v -= 1;
        // Charcos (más con la lluvia).
        const pud = noise2(x / 9, y / 2.5, seed + 79, Math.round(L / 9));
        if (pud < 0.12 + wet * 0.16 && u > 0.2 && u < 0.85) {
          t.set(x, y, M.agua, pud < 0.08 ? 3 : 2);
          continue;
        }
        const g = noise2(x / 4, y / 3, seed + 74, Math.round(L / 4));
        if (g < grassOver * 0.3 && hash2(x, y, 75) < grassOver) {
          t.set(x, y, M.hierba, step(2.8 + (n - 0.5), x, y));
          continue;
        }
        t.set(x, y, M.tierra, step(v - wet * 0.6, x, y));
      } else {
        const near = y > bot ? (y - bot) / Math.max(1, H - bot) : 0;
        let v = 2.6 + (n - 0.5) * 1.5 + near * 0.6;
        if (y > bot && y < bot + 2) v -= 1;
        // Manchas de sol en el bosque cerrado.
        if (deep > 0 && noise2(x / 11, y / 4, seed + 81, Math.round(L / 11)) > 0.78 - deep * 0.08)
          v += 1.6;
        const floor = noise2(x / 7, y / 3, seed + 77, Math.round(L / 7));
        if (floor < smooth(0.3, 1, wild) * 0.34 && Math.abs(y - path) > half + 3) {
          const needle = hash2(x, y, 78) < 0.18;
          if (needle) t.set(x, y, M.tierra, 2 + (hash2(x, y, 79) < 0.5 ? 1 : 0));
          else t.set(x, y, M.hierba, step(0.8 + (n - 0.5) * 1.2 + near * 0.4, x, y));
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
  // Huellas en el camino: pisadas (y de herradura, cerca de casa).
  for (let i = 0; i < L / 7; i++) {
    const x = Math.round(i * 7 + hash2(i, 21, seed) * 3);
    const y = Math.round(path - half * 0.4 + hash2(i, 22, seed) * half);
    if (t.get(x, y, true) >> 4 !== M.tierra) continue;
    t.set(x, y, M.tierra, 1, true);
    if (hash2(i, 23, seed) < 0.5) t.set(x + 1, y, M.tierra, 1, true);
  }
  // Piedras con su sombra, briznas y flores; matas que pisan el borde del camino.
  for (let i = 0; i < L / 3; i++) {
    const x = Math.round(i * 3 + hash2(i, 1, seed + 80) * 3);
    const y = Math.round(hash2(i, 2, seed + 80) * (H - 1));
    if (Math.abs(y - path) < half + 1) {
      if (hash2(i, 3, seed + 80) < 0.12 && t.get(x, y, true) >> 4 === M.tierra) {
        t.set(x, y, M.roca, 5, true);
        t.set(x + 1, y, M.roca, 3, true);
        t.set(x + 1, y + 1, M.tierra, 0, true);
        t.set(x + 2, y + 1, M.tierra, 1, true);
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
      t.set(x, y, M.fruta, 2, true);
      t.set(x + 1, y, M.fruta, 3, true);
      t.set(x, y + 1, M.flor, 4, true);
    }
  }
  for (let i = 0; i < L / 16; i++) {
    const x = Math.round(i * 16 + hash2(i, 31, seed) * 10);
    const edge = hash2(i, 32, seed) < 0.5 ? path - half - 1 : path + half * 0.8 + 2;
    tuft(t, x, Math.round(edge), 4 + Math.round(hash2(i, 33, seed) * 3), i, M.hierba);
  }
  // Los postes del puente, a los dos lados.
  if (sx > 0) {
    const bx = Math.round(sx - (H - path) * 0.45 + Math.sin(path * 0.22 + seed) * 2.2);
    const hw = Math.round(2.2 + path * 0.11) + 1;
    for (const px of [bx - hw - 1, bx + hw + 1])
      for (const py of [Math.round(path - half) - 1, Math.round(path + half * 0.8) + 1]) {
        t.set(px, py, M.valla, 4, true);
        t.set(px, py - 1, M.valla, 3, true);
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
  const H = Math.max(16, Math.min(34, e.h - e.feet - 4));
  const t = new Tonos(L, H);
  const base = H - 1;
  for (let i = 0; i < L / 18; i++) {
    const x = Math.round(i * 18 + hash2(i, 1, seed + 90) * 12);
    const r = hash2(i, 2, seed + 90);
    if (r > lerp(0.6, 0.85, wild)) continue;
    const k = hash2(i, 3, seed + 90);
    const s = i * 17 + seed;
    if (wild < 0.3 && k < 0.35) wheat(t, x, base, Math.round(H * 0.75), s);
    else if (wild > 0.3 && k < 0.5) fern(t, x, base + 2, Math.round(H * 0.7), s, M.hierba);
    else if (wild > 0.4 && k < 0.6)
      stump(t, x, base + 1, 10 + Math.round(hash2(i, 5, seed) * 6), s);
    else if (k < 0.82) tuft(t, x, base, Math.round(H * (0.5 + hash2(i, 4, seed) * 0.45)), s);
    else bush(t, x, base + 2, 16, Math.round(H * 0.5), wild > 0.5 ? M.pino : M.hoja, s);
  }
  return [t, e.h - H];
}

// ---------- Las copas que cierran por arriba (bosque hondo) ----------

function copas(e: Encuadre, L: number, wild: number, seed: number): [Tonos, number] {
  const H = Math.round(e.hor * 0.55);
  const t = new Tonos(L, H);
  const k = smooth(0.6, 1, wild);
  if (k <= 0) return [t, 0];
  // El borde de la copa: una franja arriba, mellada por abajo, con huecos de cielo.
  const band = (x: number) => {
    const g = fbm1(x, 60, L, seed + 94, 3);
    return g < 0.38 ? 0 : Math.round((g - 0.3) * H * 0.5 * k);
  };
  for (let x = 0; x < L; x++) {
    const bh = band(x);
    for (let y = 0; y < bh; y++) {
      const fringe = y > bh - 4 && hash2(x, y, seed + 93) < 0.45;
      if (fringe) continue;
      t.set(x, y, M.viejo, Math.round(1 + hash2(x >> 1, y >> 1, seed + 92) * 1.6), true);
    }
  }
  // Ramas de pino que cuelgan de ella: un brazo que se comba con las agujas en flecos.
  const n = Math.round((L / 40) * k);
  for (let i = 0; i < n; i++) {
    const x0 = Math.round(i * (L / n) + hash2(i, 2, seed + 95) * 20);
    const len = 30 + Math.round(hash2(i, 3, seed + 95) * 40);
    const y0 = Math.max(0, band(x0) - 2);
    const sag = 4 + hash2(i, 5, seed + 95) * 8;
    const dir = hash2(i, 6, seed + 95) < 0.5 ? 1 : -1;
    for (let j = 0; j < len; j++) {
      const u = j / len;
      const x = x0 + dir * j;
      const y = Math.round(y0 + Math.sin(u * Math.PI * 0.8) * sag - u * 3);
      // El brazo, más fino hacia la punta.
      const th = u < 0.5 ? 2 : 1;
      for (let d = 0; d < th; d++) t.set(x, y + d, M.corteza, 0, true);
      // Agujas: flecos que cuelgan (más largos hacia el medio) y alguno hacia arriba.
      const hang = Math.round((4 + hash2(x, i, seed + 96) * 6) * (1 - Math.abs(u - 0.45) * 0.8));
      for (let d = 1; d <= hang; d++)
        if (d < 4 || (x + d) % 2 === 0)
          t.set(x + (d > 4 ? dir : 0), y + th + d - 1, M.viejo, d < 2 ? 3 : d < 4 ? 2 : 1, true);
      if (hash2(x, i, seed + 97) < 0.5) t.set(x, y - 1, M.viejo, 3, true);
      if (hash2(x, i, seed + 98) < 0.3) t.set(x, y - 2, M.viejo, 2, true);
      // Ramillas laterales.
      if (j % 7 === 3 && u < 0.8)
        for (let d = 0; d < 5; d++) {
          t.set(x + dir * d, y + 1 + d, M.viejo, 2, true);
          t.set(x + dir * d, y + 2 + d, M.viejo, 1, true);
        }
    }
  }
  return [t, 0];
}
