/**
 * El viento de la sierra en el visor: siempre corre algo de brisa allá arriba (más con «viento»).
 * Mece la hierba del suelo y las matas de delante (en ráfagas que pasan como olas), levanta la
 * nieve de los neveros a ras de suelo y arranca penachos de nieve de las cumbres. Todo se pinta con
 * los colores de su capa (la misma luz y bruma) y en sus coordenadas (su paralaje).
 */
import { bayer } from '../../art/pixel';
import { biomaOf } from './bioma';
import type { Capa } from './capas';
import type { Ctx } from './ctx';
import { lutOf, pack, unpack } from './luz';
import { M, hash, hash2, smooth } from './tonos';

/** La brisa de ahora (0–1): un fondo que nunca para y ráfagas que van y vienen. */
export function brisa(c: Ctx): number {
  const w = c.l.clima.wind ?? 0;
  const t = c.time;
  const gust = 0.72 + 0.16 * Math.sin(t * 0.7) + 0.12 * Math.sin(t * 1.9 + 1.3);
  return Math.min(1, Math.max(0.42 + 0.2 * smooth(0.3, 1, c.m.wild), w) * gust + w * 0.3);
}

/** Cuánto se dobla la hierba en `x` (las ráfagas cruzan de derecha a izquierda, como olas). */
const doblez = (c: Ctx, x: number, k: number) => {
  const wave = 0.5 + 0.5 * Math.sin(x * 0.045 + c.time * 3.2);
  const flutter = Math.sin(c.time * 7 + x * 0.9) * 0.25;
  return -k * (0.35 + 0.9 * wave) + flutter * k;
};

const luts = new Map<string, Uint32Array>();
/** La tabla de colores de una capa con la luz de ahora (guardada por luz). */
function lutDe(c: Ctx, capa: Capa): Uint32Array {
  const key = `${capa.id}:${c.lk}:${c.l.hour.toFixed(1)}:${c.l.clima.fog.toFixed(2)}`;
  let lut = luts.get(key);
  if (!lut) {
    if (luts.size > 24) luts.clear();
    lut = lutOf(c.l, capa.depth, biomaOf(c.m.terrain).ramps);
    luts.set(key, lut);
  }
  return lut;
}

const capaDe = (c: Ctx, id: Capa['id']) => c.capas.find((k) => k.id === id);

// ---------- La hierba del suelo ----------

const briznas = new WeakMap<Capa, Int32Array>();
/** Dónde van las briznas de una tira (solo en la hierba): x, y de la tira y su escalón. */
function briznasDe(capa: Capa): Int32Array {
  let out = briznas.get(capa);
  if (out) return out;
  const t = capa.t;
  const list: number[] = [];
  const n = Math.round((t.w * t.h) / 32);
  for (let i = 0; i < n; i++) {
    const wx = Math.floor(hash(i * 7 + 3) * t.w);
    const sy = Math.floor(hash(i * 13 + 5) * t.h);
    const code = t.get(wx, sy);
    if (code >> 4 === M.hierba) list.push(wx, sy, code & 15, i);
  }
  out = Int32Array.from(list);
  briznas.set(capa, out);
  return out;
}

/** Briznas que se mecen sobre la hierba del suelo (no en la senda ni en la nieve). */
function hierbaSuelo(c: Ctx, k: number): void {
  const capa = capaDe(c, 'suelo');
  if (!capa) return;
  const { b, e } = c;
  const lut = lutDe(c, capa);
  const L = capa.t.w;
  const off = Math.round(c.travel * capa.speed);
  const list = briznasDe(capa);
  for (let p = 0; p < list.length; p += 4) {
    const x = (((list[p]! - off) % L) + L) % L;
    if (x >= e.w) continue;
    const y = list[p + 1]! + capa.y;
    if (y < e.ground + 6 || y >= e.h) continue;
    const i = list[p + 3]!;
    // Más altas cuanto más cerca (abajo).
    const near = (y - e.ground) / (e.h - e.ground);
    const h = 2 + Math.round(near * 2 + hash(i * 3) * 1.5);
    const bend = doblez(c, x, k) * (0.6 + near * 0.6);
    const base = list[p + 2]!;
    for (let j = 1; j <= h; j++) {
      const u = j / h;
      const px = Math.round(x + bend * u * u * 1.6);
      b.set(px, y - j, lut[(M.hierba << 4) | Math.min(6, base + 1 + (j === h ? 1 : 0))]!);
    }
    // Algunas, con el haz al sol cuando se doblan (el brillo de la ráfaga).
    if (bend < -0.7 && hash(i * 5) < 0.4)
      b.set(Math.round(x + bend * 1.6), y - h, lut[(M.hierba << 4) | 6]!);
  }
}

// ---------- La nieve a ras ----------

/** Nieve en polvo que el viento arrastra de los neveros (hilos que se van a la izquierda). */
function nieveRas(c: Ctx, k: number): void {
  const capa = capaDe(c, 'suelo');
  if (!capa || k < 0.3) return;
  const { b, e, time } = c;
  const lut = lutDe(c, capa);
  const lite = lut[(M.nieve << 4) | 5]!;
  const L = capa.t.w;
  const off = Math.round(c.travel * capa.speed);
  const n = Math.round(e.w * 0.9 * (k - 0.2));
  for (let i = 0; i < n; i++) {
    const per = 1.6 + hash(i * 3) * 1.4;
    const cyc = Math.floor(time / per + hash(i * 11));
    const u = (time / per + hash(i * 11)) % 1;
    // El nevero de donde sale (si no hay nieve ahí, nada).
    const wx = Math.floor(hash(cyc * 31 + i * 7) * L);
    const sy = Math.floor(hash(cyc * 17 + i * 5) * capa.t.h);
    if (capa.t.get(wx, sy) >> 4 !== M.nieve) continue;
    const x0 = (((wx - off) % L) + L) % L;
    const y0 = sy + capa.y;
    const len = 4 + Math.round(hash(i * 9) * 6);
    const dx = -u * (14 + k * 26);
    const lift = Math.sin(u * 3.1) * (2 + hash(i * 13) * 3);
    for (let j = 0; j < len; j++) {
      const a = (1 - u) * (1 - j / len);
      const x = Math.round(x0 + dx + j);
      const y = Math.round(y0 - lift + j * 0.15);
      if (x < 0 || x >= e.w || a < bayer(x, y) * 0.9) continue;
      b.set(x, y, lite);
    }
  }
}

// ---------- Las matas de delante ----------

/** Matas de festuca de delante (las pinta el viento, no la tira): se doblan en las ráfagas. */
export function drawDelanteSierra(c: Ctx): void {
  if (biomaOf(c.m.terrain).id !== 'sierra') return;
  const capa = capaDe(c, 'delante');
  if (!capa) return;
  const { b, e } = c;
  const lut = lutDe(c, capa);
  const k = brisa(c);
  const L = capa.t.w;
  const off = Math.round(c.travel * capa.speed);
  const H = capa.t.h;
  for (let i = 0; i < L / 20; i++) {
    if (hash2(i, 2, 300) > 0.6) continue;
    const wx = Math.round(i * 20 + 10 + hash2(i, 1, 300) * 8);
    const x = (((wx - off) % L) + L) % L;
    if (x < -10 || x > e.w + 10) continue;
    const base = e.h - 1;
    const h = Math.round(H * (0.45 + hash2(i, 3, 300) * 0.35));
    const blades = 4 + Math.floor(hash2(i, 4, 300) * 4);
    const mat = hash2(i, 5, 300) < 0.3 ? M.musgo : M.hierba;
    for (let j = 0; j < blades; j++) {
      const spread = (j / (blades - 1) - 0.5) * h * 0.5;
      const len = h * (0.6 + hash2(i, j + 10, 300) * 0.4);
      const bend = doblez(c, x + j, k) * (1.2 + hash2(i, j + 20, 300) * 0.8) + spread * 0.25;
      for (let s = 0; s < len; s++) {
        const u = s / len;
        const px = Math.round(x + spread * 0.4 + bend * u * u * 3);
        const v = Math.min(5, Math.round(1 + u * 3 + (spread < 0 ? 0.6 : -0.4)));
        b.set(px, base - s, lut[(mat << 4) | v]!);
      }
    }
  }
}

// ---------- Penachos en las cumbres ----------

const cumbres = new WeakMap<Capa, number[]>();
/** Las cumbres de una tira (columnas más altas que todo lo de alrededor). */
function cumbresDe(capa: Capa): number[] {
  let out = cumbres.get(capa);
  if (out) return out;
  const t = capa.t;
  const top = new Int32Array(t.w);
  for (let x = 0; x < t.w; x++) {
    let y = 0;
    while (y < t.h && !t.d[y * t.w + x]) y++;
    top[x] = y;
  }
  out = [];
  const R = 14;
  for (let x = 0; x < t.w; x++) {
    let best = true;
    for (let d = -R; d <= R && best; d++)
      if (
        d &&
        top[(x + d + t.w) % t.w]! <= top[x]! &&
        !(top[(x + d + t.w) % t.w] === top[x] && d > 0)
      )
        best = false;
    if (best && top[x]! < t.h * 0.5) out.push(x, top[x]!);
  }
  cumbres.set(capa, out);
  return out;
}

/** El viento arranca nieve de las cumbres: un penacho que se va a la izquierda y se deshace. */
export function drawCumbres(c: Ctx): void {
  if (biomaOf(c.m.terrain).id !== 'sierra') return;
  const { b, e, l, time } = c;
  if (l.night > 0.7) return;
  const k = brisa(c);
  if (k < 0.3) return;
  const capa = capaDe(c, 'lejos');
  if (!capa) return;
  const lut = lutDe(c, capa);
  const col = unpack(lut[(M.nieve << 4) | 5]!);
  const sky = unpack(lut[(M.monte << 4) | 6]!);
  const L = capa.t.w;
  const off = Math.round(c.travel * capa.speed);
  const peaks = cumbresDe(capa);
  for (let p = 0; p < peaks.length; p += 2) {
    const x0 = (((peaks[p]! - off) % L) + L) % L;
    if (x0 > e.w + 40) continue;
    const y0 = peaks[p + 1]! + capa.y;
    const s = peaks[p]!;
    const len = Math.round((26 + hash(s) * 24) * (0.5 + k));
    // Cada penacho late a su ritmo (sopla, se calma).
    const puff = 0.65 + 0.35 * Math.sin(time * (0.6 + hash(s * 3) * 0.4) + s);
    for (let j = 0; j < len; j++) {
      const u = j / len;
      const w = 0.8 + u * 3.2;
      const drift = Math.sin(time * 1.5 - j * 0.3 + s) * u * 1.5;
      for (let r = -w; r <= w; r++) {
        const x = Math.round(x0 - j);
        const y = Math.round(y0 + 1 - u * 4 + r + drift);
        if (x < 0 || x >= e.w || y < 0) continue;
        const a = (1 - u) ** 0.7 * (1 - Math.abs(r) / (w + 1)) * puff;
        if (a < 0.06 + bayer(x + Math.round(time * 8), y) * 0.25) continue;
        const i = y * e.w + x;
        const under = unpack(b.data[i]!);
        const m = Math.min(0.85, a * 0.9);
        b.data[i] = pack([
          under[0] + (col[0] * 0.8 + sky[0] * 0.2 - under[0]) * m,
          under[1] + (col[1] * 0.8 + sky[1] * 0.2 - under[1]) * m,
          under[2] + (col[2] * 0.8 + sky[2] * 0.2 - under[2]) * m,
        ]);
      }
    }
  }
}

/** Lo del viento que va tras el suelo (la hierba y la nieve a ras), antes de la gente. */
export function drawVidaSierra(c: Ctx): void {
  const k = brisa(c);
  hierbaSuelo(c, k);
  nieveRas(c, k);
}
