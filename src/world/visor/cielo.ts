/**
 * El cielo del visor: franjas tramadas de cada luz (las de `art/clouds.ts`, más una de noche) que
 * pasan de una a otra tramando, el sol y la luna con su arco según la hora, estrellas que titilan
 * y nubes con volumen en dos alturas (las de `art/clouds.ts`, iluminadas con la luz del momento).
 */
import {
  SKY_BANDS,
  bank,
  cumulus,
  cirrus,
  paintCloud,
  type CloudShape,
  type SkyPhase,
} from '../../art/clouds';
import { PixelBuffer, bayer, rgba } from '../../art/pixel';
import { skyStripCnc } from '../rooms/paisaje';
import type { Encuadre } from './encuadre';
import { pack, type Luz, unpack } from './luz';
import { clamp01, hash, lerp } from './tonos';

const NIGHT_BANDS = ['#0d0b18', '#141226', '#181a30', '#1c2038', '#22283f', '#262e4a', '#2c3555'];
const GREY_BANDS = ['#56607a', '#626c86', '#6e7892', '#7c869e', '#8a94aa', '#9aa4b8', '#aab2c4'];
const GREY_NIGHT = ['#121220', '#161828', '#1a1e30', '#1e2436', '#22283c', '#262c42', '#2a3046'];

/** Mezcla dos colores (para pasar de una luz a otra sin tramar). */
const mixc = (a: number, b: number, t: number) => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const p = unpack(a);
  const q = unpack(b);
  return pack([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
};

const bandsOf = (p: SkyPhase) => (p === 'night' ? NIGHT_BANDS : SKY_BANDS[p]);

const stripCache = new Map<string, PixelBuffer>();
/** Las franjas en grumos de 2 px (como el cielo de la taberna), del ancho del encuadre. */
function strip(bands: readonly string[], w: number, h: number, y1: number): PixelBuffer {
  const k = `${bands[0]}:${w}:${h}:${y1}`;
  let s = stripCache.get(k);
  if (!s) stripCache.set(k, (s = skyStripCnc(bands, w, h, 0, y1)));
  return s;
}

/** El fondo del cielo (todo el alto, para que asome entre lo que haya). */
export function skyBuffer(e: Encuadre, l: Luz): PixelBuffer {
  const h = e.h;
  const y1 = e.hor + 2;
  const w = e.w;
  const a = strip(bandsOf(l.skyA), w, h, y1);
  const b = strip(bandsOf(l.skyB), w, h, y1);
  const ov = clamp01(l.clima.cloud * 0.9 + l.clima.rain * 0.4 - 0.1);
  const g = strip(l.night > 0.5 ? GREY_NIGHT : GREY_BANDS, w, h, y1);
  const out = new PixelBuffer(e.w, h);
  const dust = clamp01(l.clima.dust ?? 0);
  const dc = pack([l.fogColor[0] * 0.5 + 103, l.fogColor[1] * 0.5 + 76, l.fogColor[2] * 0.5 + 44]);
  const storm = clamp01(l.clima.storm ?? 0) * 0.75;
  const sc = pack([46, 44, 58]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < e.w; x++) {
      let c = mixc(a.data[y * w + x]!, b.data[y * w + x]!, l.skyT);
      if (ov > 0) c = mixc(c, g.data[y * w + x]!, ov);
      // Polvo: el cielo se vuelve ocre, más abajo que arriba (por bandas, tramado).
      if (dust > 0) {
        const u = clamp01(y / (e.hor + 2));
        const k =
          Math.floor(Math.min(1, dust * 1.25 * (0.55 + 0.45 * u)) * 6 + bayer(x, y) * 0.999) / 6;
        if (k > 0) c = mixc(c, dc, k);
      }
      // Tormenta: negro plomizo arriba, que aclara hacia el horizonte.
      if (storm > 0) {
        const u = clamp01(y / (e.hor + 2));
        const k = Math.floor(storm * (1 - 0.5 * u) * 6 + bayer(x, y) * 0.999) / 6;
        if (k > 0) c = mixc(c, sc, k);
      }
      out.data[y * e.w + x] = c;
    }
  return out;
}

/** Dónde está el sol (o la luna) a esa hora: sale por la derecha (el este, hacia el bosque). */
export function sunAt(e: Encuadre, hour: number, rise = 5.6, set = 19.8) {
  const u = (hour - rise) / (set - rise);
  return {
    x: Math.round(lerp(e.w * 0.92, e.w * 0.08, u)),
    y: Math.round(e.hor + 4 - Math.sin(Math.PI * clamp01(u)) * e.hor * 0.82),
    up: u > -0.02 && u < 1.02,
    low: 1 - Math.sin(Math.PI * clamp01(u)),
  };
}

/** El sol: disco, corona tramada y, bajo, más grande y encendido. */
export function drawSun(b: PixelBuffer, e: Encuadre, l: Luz): void {
  const s = sunAt(e, l.hour);
  const c = l.clima;
  if (c.rain > 0.1 || (c.snow ?? 0) > 0.3 || (c.storm ?? 0) > 0.2 || (c.dust ?? 0) > 0.75) return;
  // Al salir y al ponerse, el cielo se enciende alrededor (aunque el sol esté tras los montes).
  const u = (l.hour - 5.6) / (19.8 - 5.6);
  const near = Math.max(0, 1 - Math.min(Math.abs(u + 0.02), Math.abs(u - 1.02)) / 0.2);
  if (near > 0 && l.clima.cloud < 0.9)
    glow(b, e, s.x, Math.max(s.y, e.hor - 6), near * (1 - l.clima.cloud * 0.6));
  if (!s.up || l.clima.cloud > 0.85) return;
  const low = s.low;
  const r = 3.5 + low * 1.8;
  const core = rgba(low > 0.75 ? '#ffe6a0' : '#ffffff');
  const rim = rgba(low > 0.75 ? '#feae34' : '#fee761');
  const halo = rgba(low > 0.75 ? '#ffc46a' : '#e2f2f6');
  const R = r + 5 + low * 4;
  const veil = clamp01(l.clima.cloud * 0.8 + l.clima.fog * 0.6);
  for (let y = Math.floor(s.y - R); y <= s.y + R; y++)
    for (let x = Math.floor(s.x - R); x <= s.x + R; x++) {
      if (!b.inside(x, y) || y > e.hor + 2) continue;
      const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
      if (veil > bayer(x + 1, y + 3) * 1.4 && d > r - 1) continue;
      if (d <= r - 1) b.data[y * b.w + x] = core;
      else if (d <= r) b.data[y * b.w + x] = rim;
      else if (d <= R) {
        // Halo liso: anillos de mezcla hacia el color del halo (sin puntos sueltos).
        const q = Math.floor((1 - (d - r) / (R - r)) ** 1.8 * 4) / 4;
        if (q > 0) b.data[y * b.w + x] = mixc(b.data[y * b.w + x]!, halo, q * 0.7);
      }
    }
}

/** Resplandor cálido del sol bajo: mezcla el cielo hacia el oro, en anillos. */
function glow(b: PixelBuffer, e: Encuadre, x0: number, y0: number, k: number) {
  const R = e.hor * 0.75;
  const warm = unpack(rgba('#ffd09a'));
  for (let y = Math.max(0, Math.floor(y0 - R)); y < Math.min(b.h, e.hor + 6); y++)
    for (let x = Math.max(0, Math.floor(x0 - R * 1.6)); x < Math.min(b.w, x0 + R * 1.6); x++) {
      const d = Math.hypot((x - x0) / 1.6, y - y0) / R;
      if (d >= 1) continue;
      // Anillos lisos (sin tramar): seis escalones de mezcla.
      const q = Math.floor((1 - d) ** 1.6 * k * 6) / 6;
      if (q <= 0) continue;
      const i = y * b.w + x;
      const c = unpack(b.data[i]!);
      const t = Math.min(0.75, q * 0.75);
      b.data[i] = pack([
        c[0] + (warm[0] - c[0]) * t,
        c[1] + (warm[1] - c[1]) * t,
        c[2] + (warm[2] - c[2]) * t,
      ]);
    }
}

/** La luna (creciente o llena según el día) y su halo. */
export function drawMoon(b: PixelBuffer, e: Encuadre, l: Luz, day: number): void {
  if (l.night <= 0.05) return;
  // De noche, la luna hace su arco de 20 a 6.
  const h = l.hour < 12 ? l.hour + 24 : l.hour;
  const m = sunAt(e, h, 19.5, 30.5);
  if (!m.up) return;
  const phase = ((day % 8) + 8) % 8; // 0 llena … 4 nueva
  const r = 4;
  const lit = rgba('#e4ecf4');
  const shade = rgba('#8b9bb4');
  const off = phase === 0 ? 99 : phase < 4 ? 6 - phase : -(phase - 4) - 2;
  for (let y = -r - 3; y <= r + 3; y++)
    for (let x = -r - 3; x <= r + 3; x++) {
      const X = m.x + x;
      const Y = m.y + y;
      if (!b.inside(X, Y)) continue;
      const d = Math.hypot(x + 0.5, y + 0.5);
      if (d <= r) {
        const cut = Math.hypot(x + 0.5 - off, y + 0.5) <= r;
        const c = cut && phase !== 0 ? (l.night > bayer(X, Y) ? null : shade) : lit;
        if (c !== null) b.data[Y * b.w + X] = (x + y > 3 && !cut ? shade : c) as number;
      } else if (d <= r + 3 && (1 - (d - r) / 3) * 0.35 * l.night > bayer(X, Y)) {
        const [rr, gg, bb] = unpack(b.data[Y * b.w + X]!);
        b.data[Y * b.w + X] = pack([rr + 24, gg + 26, bb + 34]);
      }
    }
}

/** Estrellas que titilan (y alguna fugaz). */
export function drawStars(b: PixelBuffer, e: Encuadre, l: Luz, time: number, seed: number): void {
  if (l.night <= 0.02) return;
  const n = Math.round((e.w * e.hor) / 90);
  const veil = clamp01(l.clima.cloud * 1.1 + l.clima.rain);
  const bright = rgba('#ffffff');
  const dim = rgba('#8b9bb4');
  const mid = rgba('#c0cbdc');
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i * 3 + seed) * e.w);
    const y = Math.floor(hash(i * 7 + seed) ** 1.4 * (e.hor - 4));
    const k = hash(i * 11 + seed);
    if (k > l.night * 1.05 || hash(i * 13) < veil) continue;
    const tw = hash(i + Math.floor(time * 2.5 + k * 40) * 977) > 0.88;
    b.set(x, y, tw ? dim : k < 0.15 ? bright : mid);
    if (k < 0.04 && !tw) {
      b.set(x - 1, y, dim);
      b.set(x + 1, y, dim);
      b.set(x, y - 1, dim);
      b.set(x, y + 1, dim);
    }
  }
  // Una estrella fugaz de vez en cuando.
  const cyc = Math.floor(time / 9);
  const u = (time % 9) / 0.7;
  if (u < 1 && hash(cyc + seed) < 0.5 * l.night && veil < 0.4) {
    const x0 = hash(cyc * 3) * e.w;
    const y0 = hash(cyc * 5) * e.hor * 0.4;
    for (let k = 0; k < 6; k++) {
      const x = Math.round(x0 + (u * 30 - k) * 1.6);
      const y = Math.round(y0 + (u * 30 - k) * 0.6);
      if (k < 4 || bayer(x, y) < 0.5) b.set(x, y, k < 2 ? bright : mid);
    }
  }
}

// ---------- Nubes ----------

interface Cloud {
  shape: CloudShape;
  x: number;
  y: number;
  speed: number;
  /** Hasta qué nubosidad no sale (las primeras salen siempre). */
  need: number;
  par: number;
  cir?: boolean;
}

const GREY_CLOUD: Record<SkyPhase, readonly string[]> = {
  day: ['#4f5872', '#5f6984', '#717c96', '#8590a8', '#9aa4b8', '#b2bac8'],
  dusk: ['#3a2c48', '#4e3a58', '#6a4a66', '#8a5c70', '#a8707a', '#c48a84'],
  dawn: ['#3c3c5c', '#50506e', '#686684', '#827c98', '#9c94aa', '#b6aec0'],
  night: ['#14162a', '#1a1e32', '#20263a', '#272e44', '#2f364c', '#373f56'],
};

const paintCache = new Map<string, PixelBuffer>();
function painted(c: Cloud, i: number, phase: SkyPhase, grey: boolean): PixelBuffer {
  const k = `${i}:${c.shape.w}:${c.shape.h}:${phase}:${grey}`;
  let p = paintCache.get(k);
  if (!p) {
    p = paintCloud(c.shape, phase, grey ? GREY_CLOUD[phase] : undefined);
    paintCache.set(k, p);
  }
  return p;
}

const blendCache = new Map<string, PixelBuffer>();
/** La nube con la luz entre dos momentos (mezclada, no tramada). */
function blended(c: Cloud, i: number, a: SkyPhase, b: SkyPhase, t: number, grey: boolean) {
  if (t <= 0 || a === b) return painted(c, i, a, grey);
  const k = `${i}:${c.shape.w}:${a}:${b}:${t}:${grey}`;
  let out = blendCache.get(k);
  if (!out) {
    const pa = painted(c, i, a, grey);
    const pb = painted(c, i, b, grey);
    out = new PixelBuffer(pa.w, pa.h);
    for (let j = 0; j < pa.data.length; j++)
      out.data[j] = pa.data[j]! >>> 24 ? mixc(pa.data[j]!, pb.data[j]!, t) : 0;
    if (blendCache.size > 400) blendCache.clear();
    blendCache.set(k, out);
  }
  return out;
}

const cirrusCache = new Map<string, PixelBuffer>();

export class Nubes {
  private list: Cloud[] = [];
  /** Los cirros (velos altos): de momento, sin ellos (se leían como rayas). */
  cirrus = false;
  constructor(
    private e: Encuadre,
    seed: number,
  ) {
    const n = Math.max(6, Math.round(e.w / 26));
    for (let i = 0; i < n; i++) {
      const big = hash(i * 5 + seed) < 0.35;
      const low = hash(i * 7 + seed) < 0.5;
      const w = Math.round(
        lerp(34, 70, hash(i * 3 + seed)) * (big ? 1.4 : 1) * (e.w > 200 ? 1.15 : 0.9),
      );
      const h = Math.round(w * lerp(0.32, 0.45, hash(i * 9 + seed)));
      const shape = low
        ? bank(`visor-${seed}-${i}`, w + 10, Math.round(h * 0.7))
        : cumulus(`visor-${seed}-${i}`, w, h, hash(i * 13) * 0.8);
      this.list.push({
        shape,
        x: hash(i * 17 + seed) * (e.w + 140),
        y: low
          ? e.hor * lerp(0.42, 0.72, hash(i * 19 + seed))
          : e.hor * lerp(0.02, 0.4, hash(i * 23 + seed)),
        speed: low ? 1.4 : 0.8,
        need: i < 3 ? 0 : (i - 2) / (n - 2),
        par: low ? 0.06 : 0.03,
      });
    }
    this.list.sort((a, b) => a.y - b.y);
  }

  draw(b: PixelBuffer, l: Luz, time: number, travel: number, wind = 1): void {
    const e = this.e;
    const cover = clamp01(0.3 + l.clima.cloud * 0.75 + l.clima.rain * 0.3);
    const grey = l.clima.cloud > 0.55 || l.clima.rain > 0.2;
    const span = e.w + 140;
    // Los cirros de lo alto, primero.
    if (cover < 0 && this.cirrus) {
      const k = `${e.w}:${l.skyA}`;
      let c = cirrusCache.get(k);
      if (!c)
        cirrusCache.set(
          k,
          (c = cirrus(`visor-cirro-${e.w}`, e.w + 60, Math.round(e.hor * 0.35), l.skyA)),
        );
      const ox = Math.round(((time * 0.6 + travel * 0.02) % 60) - 60);
      blitSky(b, c, ox, 2, e.hor);
    }
    this.list.forEach((c, i) => {
      if (c.need > cover) return;
      let x = (c.x - time * c.speed * wind - travel * c.par) % span;
      if (x < 0) x += span;
      x = Math.round(x - 70);
      const pa = blended(c, i, l.skyA, l.skyB, Math.round(l.skyT * 8) / 8, grey);
      const y = Math.round(c.y);
      for (let yy = 0; yy < pa.h; yy++) {
        const ty = y + yy;
        if (ty < 0 || ty >= b.h || ty > e.hor + 4) continue;
        for (let xx = 0; xx < pa.w; xx++) {
          const tx = x + xx;
          if (tx < 0 || tx >= b.w) continue;
          const col = pa.data[yy * pa.w + xx]!;
          if (col >>> 24) b.data[ty * b.w + tx] = col;
        }
      }
    });
  }
}

function blitSky(b: PixelBuffer, src: PixelBuffer, x: number, y: number, maxY: number) {
  for (let yy = 0; yy < src.h; yy++) {
    const ty = y + yy;
    if (ty < 0 || ty >= b.h || ty > maxY) continue;
    for (let xx = 0; xx < src.w; xx++) {
      const tx = x + xx;
      if (tx < 0 || tx >= b.w) continue;
      const c = src.data[yy * src.w + xx]!;
      if (c >>> 24) b.data[ty * b.w + tx] = c;
    }
  }
}
