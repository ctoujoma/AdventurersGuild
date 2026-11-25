/**
 * El paisaje del visor no se pinta en colores sino en «tonos»: cada píxel guarda su material y su
 * escalón dentro de la rampa del material (`code = mat << 4 | escalón`). Así la luz de la hora,
 * la bruma de la distancia y la niebla se aplican luego con una tabla de 256 colores por capa
 * (`luz.ts`), sin volver a dibujar nada: el dibujo se hace una vez y se recolorea al vuelo.
 */

/** Materiales (hasta 15; el 0 es hueco). */
export const M = {
  pino: 1,
  hoja: 2,
  corteza: 3,
  hierba: 4,
  tierra: 5,
  roca: 6,
  nieve: 7,
  mies: 8,
  valla: 9,
  musgo: 10,
  fruta: 11,
  flor: 12,
  monte: 13,
  viejo: 14,
  agua: 15,
} as const;
export type Mat = (typeof M)[keyof typeof M];

/** Rampas de cada material a pleno día, de la sombra a la luz (hasta 16 escalones). */
export const RAMPS: Ramps = {
  // Pinos y abetos: verdes fríos y apagados (los del fondo de la taberna).
  [M.pino]: ['#0f1f22', '#16292a', '#1f3a35', '#2d5141', '#41694d', '#5f845a', '#86a066'],
  // Frutales, robles y matas: más amarillos.
  [M.hoja]: ['#1c2f25', '#22382b', '#304d33', '#46663b', '#64823f', '#8ea04a', '#b9bb5e'],
  [M.corteza]: ['#181425', '#2e211d', '#46322a', '#5f463a', '#7a5a45', '#94704f'],
  [M.hierba]: ['#1a3226', '#24402c', '#2f5232', '#3e6b3a', '#558443', '#729c4c', '#97b458'],
  [M.tierra]: ['#2e1f27', '#4a2e2a', '#64402f', '#7f5538', '#9c6c45', '#b98a5a', '#d4ac78'],
  [M.roca]: ['#1d1d2c', '#2c2f42', '#3e4458', '#566078', '#727e95', '#97a2b4', '#c0cbdc'],
  [M.nieve]: ['#6f7ea2', '#8b9bb4', '#aab8cc', '#c8d4e2', '#e4ecf4', '#ffffff'],
  [M.mies]: ['#5a3c1a', '#7c561e', '#a07624', '#c89a34', '#e2bc4c', '#f4dc80'],
  [M.valla]: ['#2e1f27', '#4f2f2d', '#733e39', '#945a3c', '#b86f50', '#d49268'],
  [M.musgo]: ['#1c3a2c', '#285236', '#3a6e3a', '#5a8c3e', '#86ac48', '#b0c860'],
  [M.fruta]: ['#5a1c24', '#a22633', '#e43b44', '#f6757a', '#feae34'],
  [M.flor]: ['#68386c', '#b55088', '#f6757a', '#fee761', '#ffffff'],
  // Los montes lejanos: roca azulada (la bruma la acerca al cielo).
  [M.monte]: ['#2a3150', '#3a4466', '#4c5878', '#5f6c8c', '#7684a2', '#93a0b8', '#b2bccc'],
  // El bosque viejo: más oscuro y azulado que el pino joven.
  [M.viejo]: ['#0a1518', '#0f1f22', '#152a2b', '#1d3834', '#28483d', '#3a5c48', '#557552'],
  [M.agua]: ['#193c5e', '#245a80', '#3a7ea4', '#62a6c8', '#a0d0ee'],
};

/** Las rampas de todos los materiales (cada rumbo puede cambiar algunas: `bioma.ts`). */
export type Ramps = Record<Mat, readonly string[]>;

export const code = (m: Mat, i: number) => (m << 4) | Math.max(0, Math.min(15, i | 0));

/** Un búfer de tonos (0 = hueco). */
export class Tonos {
  readonly d: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Uint8Array(w * h);
  }

  /** Pinta (con `wrap`, la x da la vuelta: para las tiras que se repiten). */
  set(x: number, y: number, m: Mat, i: number, wrap = false): void {
    x = Math.round(x);
    y = Math.round(y);
    if (y < 0 || y >= this.h) return;
    if (wrap) x = ((x % this.w) + this.w) % this.w;
    else if (x < 0 || x >= this.w) return;
    const n = RAMPS[m].length - 1;
    this.d[y * this.w + x] = (m << 4) | Math.max(0, Math.min(n, Math.round(i)));
  }

  get(x: number, y: number, wrap = false): number {
    x = Math.round(x);
    y = Math.round(y);
    if (y < 0 || y >= this.h) return 0;
    if (wrap) x = ((x % this.w) + this.w) % this.w;
    else if (x < 0 || x >= this.w) return 0;
    return this.d[y * this.w + x]!;
  }

  /** Copia otro búfer encima (con la x dando la vuelta). */
  stamp(src: Tonos, dx: number, dy: number, flip = false): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < src.h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + (flip ? src.w - 1 - x : x)]!;
        if (!c) continue;
        const tx = (((dx + x) % this.w) + this.w) % this.w;
        this.d[ty * this.w + tx] = c;
      }
    }
  }
}

// ---------- Ruido con periodo (para que las tiras empalmen) ----------

export function hash(n: number): number {
  n = Math.imul(n | 0, 374761393) + 668265263;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export const hash2 = (x: number, y: number, s = 0) =>
  hash(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(s | 0, 83492791));

const sm = (t: number) => t * t * (3 - 2 * t);

/** Ruido de valor 1D con periodo `p` (en celdas): `noise(x + p) = noise(x)`. */
export function noise1(x: number, s: number, p = 1 << 20): number {
  const i = Math.floor(x);
  const f = sm(x - i);
  const a = hash((((i % p) + p) % p) + s * 1013);
  const b = hash(((((i + 1) % p) + p) % p) + s * 1013);
  return a + (b - a) * f;
}

/** Suma de octavas con periodo: `x` en píxeles, `scale` el tamaño de la celda, `L` el periodo. */
export function fbm1(x: number, scale: number, L: number, s: number, oct = 3): number {
  let a = 0;
  let w = 0.5;
  let tot = 0;
  let sc = scale;
  for (let k = 0; k < oct; k++) {
    const p = Math.max(1, Math.round(L / sc));
    a += noise1((x / L) * p, s + k * 7, p) * w;
    tot += w;
    w *= 0.5;
    sc /= 2;
  }
  return a / tot;
}

/** Ruido 2D de valor con periodo en x. */
export function noise2(x: number, y: number, s: number, px = 1 << 20): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = sm(x - ix);
  const fy = sm(y - iy);
  const wx = (v: number) => ((v % px) + px) % px;
  const a = hash2(wx(ix), iy, s);
  const b = hash2(wx(ix + 1), iy, s);
  const c = hash2(wx(ix), iy + 1, s);
  const d = hash2(wx(ix + 1), iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => sm(clamp01((x - a) / (b - a)));
