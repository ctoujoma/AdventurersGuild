/**
 * Las nubes y los colores del cielo, en pixel art. Cada nube es una forma con volumen (bultos
 * esféricos sobre una panza plana, con sus pliegues) que se ilumina según la hora: de día, desde
 * arriba y blanca; al atardecer y al alba, desde el sol bajo (las panzas encendidas, las cimas en
 * morado); de noche, con la luna de lado. Se pinta en escalones de color con un tramado estrecho
 * entre uno y otro, como a mano.
 */
import { Rng } from '../core/rng';
import { PixelBuffer, bayer } from './pixel';

/** Las luces del día: cada una pinta la misma nube con su dirección de luz y su rampa. */
export type SkyPhase = 'night' | 'day' | 'dusk' | 'dawn';
export const PHASES: readonly SkyPhase[] = ['night', 'day', 'dusk', 'dawn'];

/** La forma de una nube: por píxel, su normal y lo encajado que está (pliegues entre bultos). */
export interface CloudShape {
  w: number;
  h: number;
  /** Normal (x, y, z) por píxel; z = 0 donde no hay nube. */
  n: Float32Array;
  /** Oclusión (0–1): baja en los pliegues entre bultos y en la panza. */
  ao: Float32Array;
  /** Cuánto de borde tiene cada píxel (1 en el contorno): para el filo de luz. */
  rim: Float32Array;
  /** Lo cerca que está de la panza (1 en la base): de día, en sombra. */
  belly: Float32Array;
}

interface Puff {
  x: number;
  y: number;
  r: number;
  z: number;
}

/** Hacia dónde está la luz (en la imagen, y hacia abajo; z hacia quien mira). */
const LIGHT: Record<SkyPhase, [number, number, number]> = {
  day: [-0.35, -0.8, 0.5],
  dusk: [-0.55, 0.6, 0.45],
  dawn: [0.55, 0.6, 0.45],
  night: [-0.55, -0.55, 0.62],
};

/** Rampas de la nube, de la sombra a la luz. */
export const CLOUD_RAMP: Record<SkyPhase, readonly string[]> = {
  day: ['#7f8fb8', '#9eaed2', '#bfcbe6', '#dde5f3', '#f2f6fb', '#ffffff'],
  dusk: ['#3e2a58', '#68386c', '#a2486e', '#d8606c', '#f58c62', '#ffc26e', '#ffe6a0'],
  dawn: ['#4a4a7a', '#6e5a8e', '#a46c98', '#d888a0', '#f6aa98', '#ffd2a8', '#fff0d2'],
  night: ['#1c2038', '#262b44', '#30385a', '#3a4466', '#4f5c80', '#6f7ea2'],
};

/** Escalón de una rampa para un valor en [0, 1], con tramado solo cerca del salto. */
export function stepAt(ramp: readonly string[], v: number, x: number, y: number, band = 0.35) {
  const n = ramp.length - 1;
  const t = Math.max(0, Math.min(1, v)) * n;
  const i = Math.floor(t);
  const f = t - i;
  const up = f > 1 - band && (f - (1 - band)) / band > bayer(x, y);
  return ramp[Math.min(n, i + (up ? 1 : 0))]!;
}

/**
 * Un cúmulo de `w` × `h`: bultos a lo largo de una panza casi plana, más altos en medio
 * (`tower` 0 → banco tendido, 1 → torre), con bultitos encima que le dan la coliflor.
 */
export function cumulus(seed: string, w: number, h: number, tower = 0.6): CloudShape {
  const rng = new Rng(seed);
  const base = h - 2;
  const puffs: Puff[] = [];
  // Las cúpulas: pocas y grandes, la más alta hacia un lado (no siempre en medio).
  const n = Math.max(2, Math.round(w / 32));
  const peak = 0.35 + rng.next() * 0.3;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1);
    const e = Math.max(0, 1 - Math.abs(t - peak) * (1.6 + (1 - tower)));
    const r = h * (0.26 + 0.28 * e * (0.4 + tower)) * (0.75 + rng.next() * 0.5);
    const x0 = 2 + t * (w - 4) + (rng.next() - 0.5) * 6;
    const m = r + 3 + w * 0.08;
    const x = Math.max(m, Math.min(w - m, x0));
    const y = Math.max(r + 1, base - r * 0.3 - e * tower * h * 0.3);
    puffs.push({ x, y, r, z: e * r * 0.5 });
  }
  // Los hombros: bajos y pegados a la panza, por los dos lados.
  for (const side of [0, 1]) {
    const r = h * (0.2 + rng.next() * 0.08);
    const x = side ? w - r - 1 : r + 1;
    puffs.push({ x, y: base - r * 0.35, r, z: -2 });
  }
  // El cuerpo, a lo largo de la panza: que la nube no se parta en trozos.
  const rb = Math.min(h * 0.3, 9);
  for (let x = rb; x <= w - rb; x += rb * (0.7 + rng.next() * 0.6))
    puffs.push({ x, y: base - rb * 0.25, r: rb * (0.7 + rng.next() * 0.6), z: -3 });
  // La coliflor: bultitos por la cara de arriba de cada cúpula, que asoman del contorno.
  for (const p of [...puffs]) {
    if (p.z < 0) continue;
    const k = 3 + Math.floor(rng.next() * 2);
    for (let j = 0; j < k; j++) {
      const a = -Math.PI * (0.12 + 0.76 * ((j + 0.2 + rng.next() * 0.6) / k));
      const r = p.r * (0.3 + rng.next() * 0.16);
      const d = p.r * (0.68 + rng.next() * 0.1);
      const y = p.y + Math.sin(a) * d;
      const x = Math.max(r + 1, Math.min(w - r - 1, p.x + Math.cos(a) * d));
      if (y - r < 1) continue;
      puffs.push({ x, y, r, z: p.z + p.r * 0.2 });
    }
  }
  return shapeOf(w, h, puffs, () => base);
}

/** Un banco tendido y bajo, de los que asoman tras los montes: ancho, poco alto. */
export function bank(seed: string, w: number, h: number): CloudShape {
  const rng = new Rng(seed);
  const base = h - 2;
  const puffs: Puff[] = [];
  // Un cuerpo largo y desigual, con dos o tres lomos algo más altos.
  for (let x = 4; x < w - 4;) {
    const r = h * (0.3 + rng.next() * 0.16);
    const cx = Math.max(r + 1, Math.min(w - r - 1, x));
    puffs.push({ x: cx, y: base - r * 0.2, r, z: 0 });
    x += r * (1 + rng.next() * 0.5);
  }
  const k = 2 + Math.floor(rng.next() * 2);
  for (let j = 0; j < k; j++) {
    const r = h * (0.42 + rng.next() * 0.14);
    const x = Math.max(r + 1, Math.min(w - r - 1, w * ((j + 0.3 + rng.next() * 0.4) / k)));
    puffs.push({ x, y: Math.max(r + 1, base - r * 0.55), r, z: 2 });
  }
  return shapeOf(w, h, puffs, () => base);
}

/**
 * La forma con su volumen. La luz no sale de cada bulto (eso la hace un gusano de bolas): sale
 * del conjunto, una cúpula suave hecha difuminando la silueta, y los bultos solo le dan un poco
 * de relieve. Los pliegues entre bultos se marcan solo cerca de la cima (la coliflor).
 */
function shapeOf(w: number, h: number, puffs: Puff[], bottom: (x: number) => number): CloudShape {
  const n = new Float32Array(w * h * 3);
  const ao = new Float32Array(w * h);
  const rim = new Float32Array(w * h);
  const bellyA = new Float32Array(w * h);
  const inside = new Uint8Array(w * h);
  const bump = new Float32Array(w * h);
  const crease = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (y > bottom(x)) continue;
      let best = -1e9;
      let second = -1e9;
      let bp: Puff | null = null;
      const px = x + 0.5;
      const py = y + 0.5;
      for (const p of puffs) {
        const dx = px - p.x;
        const dy = py - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= p.r * p.r) continue;
        const zz = p.z + Math.sqrt(p.r * p.r - d2);
        if (zz > best) {
          second = best;
          best = zz;
          bp = p;
        } else if (zz > second) second = zz;
      }
      if (!bp) continue;
      const i = y * w + x;
      inside[i] = 1;
      bump[i] = Math.sqrt(Math.max(0, best - bp.z)) / Math.sqrt(bp.r);
      crease[i] = second > -1e8 ? 1 - Math.min(1, (best - second) / 1.6) : 0;
    }
  // La cúpula del conjunto: la silueta difuminada (dos pasadas de caja).
  const R = Math.max(3, Math.round(h * 0.22));
  let H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = inside[i]!;
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let k = -R; k <= R; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < w) acc += H[y * w + xx]!;
        }
        t[y * w + x] = acc / (2 * R + 1);
      }
    const u = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let k = -R; k <= R; k++) {
          const yy = y + k;
          // Por debajo de la panza cuenta como nube: la base es plana, no redonda.
          acc += yy >= h ? t[(h - 1) * w + x]! : yy >= 0 ? t[yy * w + x]! : 0;
        }
        u[y * w + x] = acc / (2 * R + 1);
      }
    H = u;
  }
  // Lo alto de cada columna: los pliegues solo cuentan cerca de ahí.
  const colTop = new Int32Array(w).fill(h);
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (inside[y * w + x]) {
        colTop[x] = y;
        break;
      }
  const at = (x: number, y: number) => {
    const xx = Math.max(0, Math.min(w - 1, x));
    const yy = Math.max(0, Math.min(h - 1, y));
    const i = yy * w + xx;
    return H[i]! * 6 + bump[i]! * 0.75;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inside[i]) continue;
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const l = Math.hypot(gx, gy, 1);
      n[i * 3] = -gx / l;
      n[i * 3 + 1] = -gy / l;
      n[i * 3 + 2] = Math.max(0.05, 1 / l);
      const nearTop = Math.max(0, 1 - (y - colTop[x]!) / Math.max(5, h * 0.2));
      const belly = Math.max(0, (y - (bottom(x) - 4)) / 5);
      ao[i] = 1 - crease[i]! * 0.42 * nearTop;
      bellyA[i] = Math.min(1, belly);
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inside[i]) continue;
      const out = (xx: number, yy: number) =>
        xx < 0 || yy < 0 || xx >= w || yy >= h || !inside[yy * w + xx];
      if (out(x - 1, y) || out(x + 1, y) || out(x, y - 1)) rim[i] = 1;
      else if (out(x - 2, y) || out(x + 2, y) || out(x, y - 2)) rim[i] = 0.5;
    }
  return { w, h, n, ao, rim, belly: bellyA };
}

/** La nube iluminada con la luz de `phase`. */
export function paintCloud(s: CloudShape, phase: SkyPhase): PixelBuffer {
  const b = new PixelBuffer(s.w, s.h);
  const [lx, ly, lz] = norm(LIGHT[phase]);
  const ramp = CLOUD_RAMP[phase];
  const low = phase === 'dusk' || phase === 'dawn';
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      const nz = s.n[i * 3 + 2]!;
      if (!nz) continue;
      const nx = s.n[i * 3]!;
      const ny = s.n[i * 3 + 1]!;
      const lam = nx * lx + ny * ly + nz * lz;
      // Media lambert: la nube deja pasar luz, nunca se queda negra del todo.
      let v = (low ? 0.38 + 0.62 * lam : 0.3 + 0.7 * lam) * s.ao[i]!;
      // Filo de luz en el contorno que mira a la luz (de día, el borde plateado).
      if (s.rim[i]! > 0 && lam > -0.1) v += 0.22 * s.rim[i]! * (low ? 1.3 : 1);
      if (phase === 'day') v = v * 0.9 + 0.12 - s.belly[i]! * 0.3;
      if (phase === 'night') v -= s.belly[i]! * 0.15;
      if (phase === 'night') v = v * 0.9;
      b.set(x, y, stepAt(ramp, v, x, y));
    }
  return b;
}

const norm = ([x, y, z]: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

/** Rampas de los cirros (los velos altos): sombra y luz. Al atardecer, lo primero que se enciende. */
const CIRRUS: Record<SkyPhase, readonly [string, string, string]> = {
  day: ['#a9c4e6', '#d6e6f6', '#ffffff'],
  dusk: ['#b0587c', '#f0866e', '#ffcf8a'],
  dawn: ['#a07aa6', '#f0a6a0', '#ffe2c0'],
  night: ['#283050', '#343e60', '#46527a'],
};

/**
 * Un velo de cirros: hebras finas y tendidas, algo inclinadas, que se deshacen en un tramado
 * por las puntas.
 */
export function cirrus(seed: string, w: number, h: number, phase: SkyPhase): PixelBuffer {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  const ramp = CIRRUS[phase];
  const strands = Math.round(w / 14);
  for (let k = 0; k < strands; k++) {
    const len = 18 + rng.next() * (w * 0.45);
    const x0 = rng.next() * (w - len);
    const y0 = 2 + rng.next() * (h - 4);
    const slope = (rng.next() - 0.6) * 0.12;
    const curve = (rng.next() - 0.5) * 6;
    const thick = rng.next() < 0.35 ? 2 : 1;
    for (let i = 0; i < len; i++) {
      const u = i / len;
      // Fuerte en medio, se deshace por las puntas.
      const f = Math.sin(Math.PI * u);
      const x = Math.round(x0 + i);
      const y = Math.round(y0 + i * slope + Math.sin(u * Math.PI) * curve);
      if (f < bayer(x, y) * 0.9 + 0.05) continue;
      b.set(x, y, f > 0.7 ? ramp[2] : ramp[1]);
      if (thick === 2 && f > 0.4) b.set(x, y + 1, ramp[0]);
      // Unas barbas sueltas por debajo, que caen hacia atrás.
      if (f > 0.55 && (x * 7 + k * 13) % 9 === 0) {
        b.set(x - 1, y + 1, ramp[1]);
        b.set(x - 2, y + 2, ramp[0]);
      }
    }
  }
  return b;
}

/**
 * Franjas del cielo de cada luz, de lo alto (`0`) al horizonte (`1`). Se pintan en escalones con
 * tramado (no un degradado liso).
 */
export const SKY_BANDS: Record<Exclude<SkyPhase, 'night'>, readonly string[]> = {
  day: ['#2f68b0', '#3b7cc2', '#4b90d2', '#63a6de', '#7fbbe7', '#a0d0ee', '#c4e3f3', '#e2f2f6'],
  dusk: [
    '#262b54',
    '#3a3266',
    '#563a78',
    '#7a4482',
    '#a44e86',
    '#d05e7e',
    '#ee7a6e',
    '#fa9c5e',
    '#ffc46a',
  ],
  dawn: [
    '#2c3462',
    '#3e4678',
    '#5a5890',
    '#7c6aa0',
    '#a67ca8',
    '#d090aa',
    '#f0aaa4',
    '#ffcaa6',
    '#ffe6b8',
  ],
};

/**
 * Tira de cielo de 4 de ancho y `h` de alto (se repite a lo ancho con un patrón): la franja
 * `bands` repartida de `y0` (lo alto) a `y1` (el horizonte), y lo de encima y debajo, del primer
 * y el último color.
 */
export function skyStrip(bands: readonly string[], h: number, y0: number, y1: number) {
  const b = new PixelBuffer(4, h);
  for (let y = 0; y < h; y++) {
    // Las franjas de abajo, más estrechas (como en un cielo de verdad, el cambio se aprieta).
    const u = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    const v = Math.pow(u, 1.6);
    for (let x = 0; x < 4; x++) b.set(x, y, stepAt(bands, v, x, y, 0.4));
  }
  return b;
}

/**
 * El sol: el disco con su filo y un halo en anillos tramados. Al atardecer, grande y naranja,
 * cruzado por dos o tres franjas de cielo (las nubes finas del horizonte).
 */
export function sunSprite(low: boolean): PixelBuffer {
  const R = low ? 11 : 8;
  const H = low ? 26 : 22;
  const S = H * 2 + 1;
  const b = new PixelBuffer(S, S);
  const c = H;
  const halo = low ? ['#ff9a5a', '#ffb866', '#ffd27a'] : ['#e6f4fb', '#f4fae0', '#fff6b8'];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= R + 0.3) {
        const lit = (x - c) * -0.4 + (y - c) * -0.5;
        const col = low
          ? d > R - 1.2
            ? '#f77622'
            : lit > 2
              ? '#ffe8a0'
              : '#feae34'
          : d > R - 1.2
            ? '#fee761'
            : lit > 1.5
              ? '#ffffff'
              : '#fff8c8';
        // Al atardecer, franjas finas de nube que lo cruzan por abajo.
        if (low && (y === c + 4 || y === c + 7 || y === c + 9)) continue;
        b.set(x, y, col);
        continue;
      }
      // Halo: tres anillos cada vez más sueltos.
      const t = (d - R) / (H - R);
      if (t >= 1) continue;
      const k = t < 0.22 ? 2 : t < 0.5 ? 1 : 0;
      const dens = t < 0.22 ? 0.75 : t < 0.5 ? 0.4 : 0.16 * (1 - (t - 0.5) / 0.5);
      if (bayer(x, y) < dens) b.set(x, y, halo[k]!);
    }
  return b;
}
