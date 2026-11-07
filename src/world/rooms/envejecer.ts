/**
 * El envejecimiento de las paredes de fuera, a lo grande (común a todos los materiales y
 * después de pintarlos): paños más oscuros, más claros o más cálidos; la humedad del pie, que
 * sube mellada; churretes bajo los alféizares y bajo el alero; y lo alto, más pálido por el sol.
 * Cada cambio mueve el color un escalón por la paleta (sin degradados ni trama) y deja el
 * relieve como estaba. Fijo por pared (semilla), sin `Math.random`.
 */
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';

type Step = 'dark' | 'light' | 'warm' | 'pale';

const PAL: [number, number, number][] = Object.values(P).map((h) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
});

const cache = new Map<number, number>();

/** Tono (grados) y croma (0–1) de un color. */
function hueOf([r, g, b]: [number, number, number]): [number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (!d) return [0, 0];
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / 255];
}

/**
 * Si un color de la paleta vale como escalón de otro: del mismo tono y parecida saturación (o
 * los dos casi grises).
 * Así un yeso no se vuelve amarillo limón ni una tabla, azul.
 */
function kin(a: [number, number, number], b: [number, number, number], s: Step): boolean {
  const [ha, ca] = hueOf(a);
  const [hb, cb] = hueOf(b);
  if (ca <= 0.12) return cb <= 0.22;
  if (cb <= 0.12) return s === 'pale' || s === 'dark';
  const dh = Math.min(Math.abs(ha - hb), 360 - Math.abs(ha - hb));
  return dh <= (s === 'dark' ? 40 : 26) && Math.abs(ca - cb) <= 0.22;
}

/** El color de la paleta más cercano a `t` que no sea el propio (si ninguno se acerca, el mismo). */
function nearest(
  src: [number, number, number],
  t: [number, number, number],
  s: Step,
): [number, number, number] {
  let best = src;
  let bd = Infinity;
  for (const c of PAL) {
    if (c[0] === src[0] && c[1] === src[1] && c[2] === src[2]) continue;
    if (!kin(src, c, s)) continue;
    const rm = (c[0] + t[0]) / 2;
    const dr = c[0] - t[0];
    const dg = c[1] - t[1];
    const db = c[2] - t[2];
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (3 - rm / 256) * db * db;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  // Si el más cercano está más lejos que el propio color, no hay escalón: se queda.
  const ds = 2 * (src[0] - t[0]) ** 2 + 4 * (src[1] - t[1]) ** 2 + 3 * (src[2] - t[2]) ** 2;
  return bd < ds ? best : src;
}

/** Un escalón de `c` (ABGR, como en `PixelBuffer`) hacia lo oscuro, lo claro, lo cálido o lo pálido. */
export function step(c: number, s: Step): number {
  const key = ((c & 0xffffff) * 4 + ['dark', 'light', 'warm', 'pale'].indexOf(s)) >>> 0;
  const hit = cache.get(key);
  if (hit !== undefined) return (hit | (c & 0xff000000)) >>> 0;
  const r = c & 255;
  const g = (c >> 8) & 255;
  const b = (c >> 16) & 255;
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  // Lo oscuro tira a morado (como las sombras de la paleta) y lo claro, a amarillo.
  const t: [number, number, number] =
    s === 'dark'
      ? [r * 0.74, g * 0.7, b * 0.84 + 4]
      : s === 'light'
        ? [r * 1.16 + 10, g * 1.14 + 8, b * 1.06 + 4]
        : s === 'warm'
          ? [r * 1.1 + 14, g * 1.02 + 2, b * 0.82]
          : [
              (l + (r - l) * 0.6) * 1.12 + 8,
              (l + (g - l) * 0.6) * 1.12 + 8,
              (l + (b - l) * 0.6) * 1.1 + 10,
            ];
  const n = nearest([r, g, b], t, s);
  const out = n[0] | (n[1] << 8) | (n[2] << 16);
  cache.set(key, out);
  return (out | (c & 0xff000000)) >>> 0;
}

const hash = (x: number, y: number, s: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483, 1274126177);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 10000) / 10000;
};

/** Ruido suave (0–1) con celdas de `cw` × `ch`. */
function smooth(x: number, y: number, cw: number, ch: number, s: number): number {
  const fx = x / cw;
  const fy = y / ch;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = fx - x0;
  const v = fy - y0;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const a = hash(x0, y0, s);
  const b = hash(x0 + 1, y0, s);
  const c = hash(x0, y0 + 1, s);
  const d = hash(x0 + 1, y0 + 1, s);
  return (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
}

const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
};

export interface AgeOpts {
  /** El suelo (y en el búfer): de ahí sube la humedad. Sin él, no hay humedad. */
  ground?: number;
  /** Lo más alto de la pared (para el sol); por defecto, arriba del trozo. */
  top?: number;
  /** Alféizares: debajo de cada uno, churretes. */
  sills?: { x: number; y: number; w: number }[];
  /** Aleros: churretes que bajan desde `y`, de `x0` a `x1`. */
  eaves?: { x0: number; x1: number; y: number }[];
}

/** Envejece lo pintado en el trozo (x, y, w, h) del búfer. */
export function ageWall(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  o: AgeOpts = {},
): void {
  const s = seedOf(seed);
  const top = o.top ?? y;
  const span = Math.max(1, (o.ground ?? y + h) - top);
  const x1 = Math.min(b.w, x + w);
  const y1 = Math.min(b.h, y + h);
  const put = (xx: number, yy: number, st: Step) => {
    const c = b.data[yy * b.w + xx]!;
    if (c >>> 24) b.data[yy * b.w + xx] = step(c, st);
  };
  for (let xx = Math.max(0, x); xx < x1; xx++) {
    // La humedad del pie: sube a alturas distintas, mellada de 2 en 2.
    const wet =
      o.ground === undefined
        ? 0
        : Math.round((5 + smooth(xx, 0, 23, 1, s + 3) * 12 + hash(xx >> 1, 0, s + 4) * 3) / 2) * 2;
    // El sol: lo alto, más pálido (con el borde de abajo mellado).
    const sun =
      top +
      span * (0.12 + smooth(xx, 0, 37, 1, s + 5) * 0.12) +
      (hash(xx >> 1, 1, s + 9) - 0.5) * 6;
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      const j = (hash(xx >> 1, yy >> 1, s + 6) - 0.5) * 0.07;
      // Paños alargados de arriba abajo (como corre el agua y como van las tablas).
      const n = smooth(xx, yy, 30, 84, s) * 0.72 + smooth(xx, yy, 11, 34, s + 1) * 0.28 + j;
      const warm = smooth(xx, yy, 44, 96, s + 2) + j;
      if (o.ground !== undefined && yy >= o.ground - wet && yy < o.ground) {
        put(xx, yy, 'dark');
        if (yy >= o.ground - wet * 0.45) put(xx, yy, 'dark');
      } else if (yy < sun) put(xx, yy, 'pale');
      else if (n < 0.27) put(xx, yy, 'dark');
      else if (n > 0.76) put(xx, yy, 'light');
      else if (warm > 0.84) put(xx, yy, 'warm');
    }
  }
  // Churretes: bajo cada alféizar y bajo el alero, rayas oscuras de largo desigual.
  const drip = (x0: number, x2: number, from: number, dens: number, len: number, salt: number) => {
    for (let xx = Math.max(0, Math.round(x0)); xx < Math.min(x1, Math.round(x2)); xx++) {
      if (hash(xx, salt, s + 7) > dens) continue;
      const l = 3 + Math.floor(hash(xx, salt, s + 8) * len);
      for (let k = 0; k < l; k++) {
        const yy = Math.round(from) + k;
        if (yy >= 0 && yy < y1) put(xx, yy, 'dark');
      }
    }
  };
  for (const [i, sl] of (o.sills ?? []).entries()) drip(sl.x, sl.x + sl.w, sl.y, 0.5, 14, i);
  for (const [i, e] of (o.eaves ?? []).entries()) drip(e.x0, e.x1, e.y, 0.32, 22, 100 + i);
}
