/**
 * Árboles y matas con «luz con ambiente» (ver `docs/plan-luz.md`): sin contorno, en racimos de
 * color apagados, con la luz de arriba pintada y el resto del volumen en el relieve (`level`), así
 * el sol del shader les da la cara que toca a cada hora. Abetos por pisos con las puntas caídas;
 * robles en racimos (algunos de otoño); matas. Sale de la prueba A (`tools/estilo/paisaje.py`).
 */
import { Rng } from '../../core/rng';
import { PixelBuffer } from '../../art/pixel';

const CONIFER = ['#16292a', '#1f3a35', '#2d5141', '#41694d', '#5f845a', '#86a066'];
const LEAFY = ['#22382b', '#304d33', '#46663b', '#64823f', '#8ea04a', '#b9bb5e'];
const AUTUMN = ['#4a2219', '#7a3218', '#a8481a', '#d06d22', '#eb9a32', '#f6c25a'];
const GOLD = ['#3f3018', '#6b4a1a', '#9a6a1c', '#c89428', '#e6b83c', '#f6dc78'];
const BARK = ['#2e211d', '#46322a', '#5f463a'];

const pick = (r: readonly string[], v: number) =>
  r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))]!;

/** Grumos de 2 píxeles fijos (para que el follaje no salga liso ni tramado). */
const grain = (x: number, y: number, s: number) => {
  let h = Math.imul((x >> 1) * 374761393 + (y >> 1) * 668265263 + s * 982451653, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};

/**
 * Un abeto de `h` de alto, rama a rama: cada una sale del tronco a su altura y a su lado, con su
 * largo (dentro de una silueta de cono que también se mella) y su caída, y acaba en racimos.
 * Quedan huecos, lados desiguales y la punta algo torcida: nada de pisos iguales.
 */
export function pineCnc(seed: string, h = 80): PixelBuffer {
  const rng = new Rng(seed);
  const w = Math.round(h * 0.66) | 1;
  const b = new PixelBuffer(w, h);
  const s = rng.int(0, 999);
  const trunk = Math.round(h * 0.09);
  const body = h - trunk;
  const lean = (rng.next() - 0.5) * 3;
  const cxAt = (y: number) => (w - 1) / 2 + lean * (1 - y / body) ** 2;
  // El tronco, de arriba abajo (se ve entre las ramas).
  for (let y = 2; y < h; y++) {
    const t = y / h;
    const tw = t < 0.4 ? 0 : 1;
    for (let dx = -tw; dx <= tw; dx++) {
      b.level = 2;
      b.set(Math.round(cxAt(y) + dx), y, BARK[Math.min(2, dx + 1)]!);
    }
  }
  // El cono, más ancho por un lado que por el otro y con hombros.
  const lopsided = 0.85 + rng.next() * 0.3;
  const env = (t: number, side: number) =>
    (0.07 + 0.93 * t ** 0.95) * (w / 2 - 1) * (side < 0 ? lopsided : 2 - lopsided);
  const disc = (x0: number, y0: number, r: number, t: number, tip: number) => {
    for (let y = Math.floor(y0 - r); y <= y0 + r; y++)
      for (let x = Math.floor(x0 - r); x <= x0 + r; x++) {
        const g = grain(x, y, s);
        const dy = y - y0;
        if (Math.hypot(x - x0, dy * 1.3) > r + (g - 0.5) * 1.3) continue;
        const ax = Math.abs(x - cxAt(y));
        const core = Math.max(0, 1 - ax / (env(t, 1) * 0.3 + 1));
        // Lo de encima de cada rama, a la luz; lo de debajo, en sombra; las puntas, más claras.
        const v =
          0.4 + (dy < 0 ? 0.2 : dy > 0.5 ? -0.2 : 0) + tip * 0.08 + (g - 0.5) * 0.25 - core * 0.2;
        b.level = Math.round(2 + 4 * Math.max(0, 1 - ax / (env(t, 1) + 1)) + (dy < 0 ? 1 : 0));
        b.set(x, y, pick(CONIFER, v + (1 - t) * 0.06));
      }
  };
  // La punta: un brote fino con dos o tres mechones.
  for (let y = 0; y < body * 0.08; y++) disc(cxAt(y), y, 0.8 + y * 0.12, 0.02, 0.5);
  // Las ramas, de arriba abajo (las de abajo tapan a las de arriba).
  for (let y = body * 0.05; y < body - 1; y += 2.2 + rng.next() * 2.6) {
    const t = y / body;
    for (const side of [-1, 1]) {
      if (rng.next() < 0.18) continue; // un hueco
      const L = env(t, side) * (0.55 + rng.next() * 0.55);
      const droop = 0.12 + rng.next() * 0.2;
      const th = 1.2 + t * 2.4 + rng.next() * 0.8;
      for (let i = 0; i <= L; i += 1) {
        const k = i / Math.max(1, L);
        const x = cxAt(y) + side * i;
        const yy = y + droop * i + k * k * 2.5;
        disc(x, yy, th * (1 - 0.45 * k) + 0.3, t, k);
      }
    }
  }
  b.level = 0;
  return b;
}

/** Un árbol de copa (roble o castaño): racimos redondos, más claros arriba; algunos, de otoño. */
export function oakCnc(seed: string, h = 70): PixelBuffer {
  const rng = new Rng(seed);
  const w = Math.round(h * 0.86);
  const b = new PixelBuffer(w, h);
  const s = rng.int(0, 999);
  const r0 = rng.next();
  const leaves = r0 < 0.22 ? AUTUMN : r0 < 0.38 ? GOLD : LEAFY;
  const cx = w / 2;
  const trunk = Math.round(h * 0.36);
  const crownH = h - trunk + 6;
  // El tronco y dos ramas.
  b.level = 3;
  for (let y = h - trunk; y < h; y++)
    for (let dx = -2; dx <= 2; dx++)
      b.set(Math.round(cx + dx), y, BARK[dx < 0 ? 0 : dx > 0 ? 2 : 1]!);
  b.line(Math.round(cx), h - trunk + 3, Math.round(cx - w * 0.16), h - trunk - 7, BARK[1]!);
  b.line(Math.round(cx), h - trunk + 5, Math.round(cx + w * 0.17), h - trunk - 5, BARK[1]!);
  // La copa: racimos, de los de atrás (arriba) a los de delante (abajo).
  const ccx = cx;
  const ccy = crownH * 0.5;
  const rx = w * 0.46;
  const ry = crownH * 0.46;
  const clumps = Array.from({ length: 34 }, () => {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * 0.78;
    return {
      x: ccx + Math.cos(a) * d * rx,
      y: ccy + Math.sin(a) * d * ry,
      r: (0.2 + rng.next() * 0.1) * Math.min(rx, ry) * (1.15 - d * 0.4),
    };
  }).sort((a, c) => a.y - c.y);
  for (const c of clumps) {
    const R = Math.ceil(c.r) + 2;
    for (let y = Math.floor(c.y - R); y <= c.y + R; y++)
      for (let x = Math.floor(c.x - R); x <= c.x + R; x++) {
        const g = grain(x, y, s);
        const d = Math.hypot(x - c.x, (y - c.y) * 1.1) / c.r;
        if (d > 1 + (g - 0.5) * 0.5) continue;
        // Más claro arriba de cada racimo y de toda la copa; abajo, en la sombra.
        const up = (c.y - y) / c.r;
        const whole = (ccy - y) / ry;
        const v = 0.42 + up * 0.18 + whole * 0.16 + (g - 0.5) * 0.4 - (d > 0.85 ? 0.08 : 0);
        const dc = Math.min(1, Math.hypot((x - ccx) / rx, (y - ccy) / ry));
        b.level = Math.round(3 + 6 * Math.sqrt(1 - dc * dc) + 2 * (1 - Math.min(1, d)));
        b.set(x, y, pick(leaves, v));
      }
  }
  b.level = 0;
  return b;
}

/** Una mata: unos pocos racimos y alguna flor. */
export function bushCnc(seed: string, w = 22, h = 12): PixelBuffer {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  const s = rng.int(0, 999);
  for (let i = 0; i < 8; i++) {
    const cx = 4 + rng.next() * (w - 8);
    const cy = 4 + rng.next() * (h - 6);
    const r = 3 + rng.next() * 2;
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const g = grain(x, y, s);
        if (Math.hypot(x - cx, (y - cy) * 1.2) > r + (g - 0.5)) continue;
        b.level = 3;
        b.set(x, y, pick(LEAFY, 0.4 + ((cy - y) / r) * 0.2 + (g - 0.5) * 0.45));
      }
  }
  for (let i = 0; i < 3; i++) {
    b.level = 4;
    const x = rng.int(3, w - 4);
    const y = rng.int(2, h - 5);
    if (b.get(x, y)) b.set(x, y, rng.chance(0.5) ? '#e8a0a0' : '#f2dc8a');
  }
  b.level = 0;
  return b;
}
