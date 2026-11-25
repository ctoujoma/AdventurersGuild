/**
 * Árboles, matas y piedras del visor, pintados en tonos (`tonos.ts`) con la luz de arriba a la
 * izquierda: pinos de pisos con las puntas caídas (jóvenes o viejos, con musgo), frutales y robles
 * en racimos, pinos pequeños para las colinas, matas, helechos y rocas. Todo con `wrap` (las tiras
 * empalman).
 */
import { bayer } from '../../art/pixel';
import { M, Tonos, hash2, type Mat } from './tonos';

/** Escalón tramado: `v` continuo → entero, tramando entre uno y otro. */
const step = (v: number, x: number, y: number) => {
  const b = Math.floor(v);
  return v - b > bayer(x, y) ? b + 1 : b;
};

/** Grano de 2 px (racimos de aguja y hoja, para que no salga liso). */
const grain = (x: number, y: number, s: number) => hash2(x >> 1, y >> 1, s);

/** Escalón en grumos: como `step`, pero el tramado va por racimos de 2 px (follaje, no damero). */
const clump = (v: number, x: number, y: number, s: number) => {
  const b = Math.floor(v);
  return v - b > hash2((x + (y & 1)) >> 1, y >> 1, s + 77) ? b + 1 : b;
};

export interface PineOpts {
  /** Bosque viejo: más ancho, oscuro, con musgo colgando y ramas secas. */
  old?: number;
  /** Semilla de la forma. */
  seed: number;
  /** Cuánto se ensancha (1 normal). */
  fat?: number;
  /** El tronco grueso (para los de delante). */
  trunk?: number;
}

/**
 * Un pino de `h` de alto con la base en (`x`, `base`): pisos que se ensanchan hacia abajo, cada uno
 * con su falda de puntas caídas; el lado de la luz claro y el otro en sombra.
 */
export function pine(t: Tonos, x: number, base: number, h: number, o: PineOpts): void {
  const s = o.seed;
  const old = o.old ?? 0;
  const mat: Mat = old > 0.5 ? M.viejo : M.pino;
  const trunkH = Math.max(2, Math.round(h * (0.1 + old * 0.08)));
  const crownH = h - trunkH;
  const top = base - h + 1;
  const maxW = h * (0.27 + old * 0.07) * (o.fat ?? 1);
  const tiers = Math.max(3, Math.round(crownH / (6 + h * 0.03)));
  const tw = Math.max(0, (o.trunk ?? (h > 40 ? 1 : 0)) | 0);
  const lean = (hash2(s, 1, 9) - 0.5) * 2;
  const cxAt = (y: number) => x + lean * ((base - y) / h) ** 2;
  // Tronco (se ve abajo y entre los pisos).
  for (let y = top + 3; y <= base; y++) {
    const cx = Math.round(cxAt(y));
    for (let dx = -tw; dx <= tw; dx++) {
      const sh = dx < 0 ? 4 : dx === 0 ? (tw ? 3 : 2) : 1;
      t.set(cx + dx, y, M.corteza, sh - (y > base - 2 ? 1 : 0), true);
    }
    // Musgo en el tronco del bosque viejo.
    if (old > 0.4 && y > base - trunkH && hash2(y, s, 4) < old * 0.35)
      t.set(cx - tw, y, M.musgo, 2 + (hash2(y, s, 5) < 0.5 ? 1 : 0), true);
  }
  // Raíces que asoman.
  if (h > 30) {
    const cx = Math.round(cxAt(base));
    t.set(cx - tw - 1, base, M.corteza, 2, true);
    t.set(cx + tw + 1, base, M.corteza, 1, true);
    if (old > 0.3) {
      t.set(cx - tw - 2, base, M.corteza, 1, true);
      t.set(cx + tw + 2, base, M.corteza, 0, true);
    }
  }
  // Lindes de los pisos: de alto desigual (algo más altos abajo).
  const cuts: number[] = [0];
  let acc = 0;
  const wts = Array.from(
    { length: tiers },
    (_, k) => (0.8 + hash2(k, s, 1) * 0.4) * (0.85 + (k / tiers) * 0.3),
  );
  const sum = wts.reduce((a, v) => a + v, 0);
  for (const wt of wts) cuts.push((acc += wt) / sum);
  const tierH = crownH / tiers;
  // De abajo arriba: la falda de cada piso cae sobre el de debajo (y le hace sombra).
  for (let k = tiers - 1; k >= 0; k--) {
    // k = 0 arriba.
    const yt = top + Math.round(cuts[k]! * crownH * 0.94);
    const yb = top + Math.round(cuts[k + 1]! * crownH) + (k === tiers - 1 ? 0 : 1);
    const uB = (yb - top) / crownH;
    const wB = Math.max(1.5, maxW * Math.pow(uB, 0.85) * (0.86 + hash2(k, s, 2) * 0.3));
    const wL = wB * (0.9 + hash2(k, s, 3) * 0.2);
    const wR = wB * (0.9 + hash2(k, s, 6) * 0.2);
    const lift = Math.min(3, tierH * 0.4);
    const cxb = cxAt(yb);
    const bottomAt = (dx: number) => {
      const w = dx < 0 ? wL : wR;
      const u = Math.min(1, Math.abs(dx) / w);
      // Las ramas caen: los extremos más bajos que el centro, con dientes de aguja.
      const tooth = (Math.round(cxb + dx) + k) % 3 === 0 ? 1 : 0;
      return yb - Math.round((1 - u) ** 1.6 * lift) + tooth;
    };
    for (let y = yt; y <= yb + 1; y++) {
      const v = Math.min(1, (y - yt) / Math.max(1, yb - yt));
      const cx = cxAt(y);
      for (let dx = Math.floor(-wL - 1); dx <= Math.ceil(wR + 1); dx++) {
        const px = Math.round(cx + dx);
        const g = grain(px, y, s);
        const w = dx < 0 ? wL : wR;
        const edge = w * (0.22 + 0.78 * v ** 1.25) + (g - 0.5) * 1.4;
        if (Math.abs(dx) > edge) continue;
        const bot = bottomAt(dx);
        if (y > bot) continue;
        const side = dx / Math.max(1, w);
        let v0 = 3.3 - side * 1.9;
        if (v < 0.3) v0 -= 1.9 * (1 - v / 0.3); // la sombra del piso de arriba
        if (y >= bot)
          v0 -= 1.2; // la panza de la falda
        else if (y === bot - 1) v0 -= 0.4;
        v0 += (g - 0.5) * 1.2 - old * 0.7;
        if (Math.abs(dx) > edge - 1 && side > 0) v0 -= 1; // filo de sombra a la derecha
        if (Math.abs(dx) > edge - 1 && side < -0.3 && v > 0.3) v0 += 0.7; // filo de luz
        // Mechones de aguja al sol: rayitas claras en la cara de arriba, a la izquierda.
        if (side < 0.2 && v > 0.3 && v < 0.75 && hash2(px >> 1, y, s + 9) < 0.18) v0 += 1.2;
        if (k === 0 && v < 0.4) v0 += 1.3; // la punta, al sol
        t.set(px, y, mat, clump(v0, px, y, s), true);
      }
    }
    // Las puntas: un pico hacia fuera y abajo en cada extremo.
    for (const sd of [-1, 1]) {
      const w = sd < 0 ? wL : wR;
      const ex = Math.round(cxb + sd * (w + 0.5));
      t.set(ex, yb, mat, sd < 0 ? 3 : 1, true);
      t.set(ex + sd, yb + 1, mat, sd < 0 ? 2 : 0, true);
    }
    const wBm = wB;
    // Musgo colgando (barbas) en el viejo.
    if (old > 0.55) {
      const n = Math.max(2, Math.round(wBm / 2.5));
      for (let j = 0; j <= n; j++) {
        if (hash2(j, k * 3 + s, 8) > (old - 0.5) * 0.9) continue;
        const dx = ((j / n) * 2 - 1) * wBm * 0.9;
        const px = Math.round(cxb + dx);
        const y0 = bottomAt(dx);
        const beard = 2 + Math.floor(hash2(j, k, s) * 3);
        for (let d = 1; d <= beard; d++)
          t.set(px + (d > 2 ? 1 : 0), y0 + d, M.musgo, 3 - Math.min(2, d), true);
      }
    }
    // Una rama seca que asoma en el viejo.
    if (old > 0.6 && hash2(k, s, 11) < 0.25 && k > 1) {
      const side = hash2(k, s, 12) < 0.5 ? -1 : 1;
      const len = Math.round(wB + 2);
      const y = Math.round(yb - 1);
      for (let d = 0; d < 3; d++)
        t.set(Math.round(cxAt(y) + side * (len + d)), y - (d >> 1), M.corteza, 3, true);
    }
  }
}

export interface LeafOpts {
  seed: number;
  /** Frutas entre las hojas (los frutales de cerca de casa). */
  fruit?: boolean;
  /** Copa más alta que ancha (chopo) o redonda (frutal, roble). */
  tall?: boolean;
  mat?: Mat;
  /** La corteza (el abedul, blanca con manchas). */
  bark?: Mat;
}

/** Un árbol de hoja con la base en (`x`, `base`): tronco que se abre y copa en racimos. */
export function leafy(t: Tonos, x: number, base: number, h: number, o: LeafOpts): void {
  const s = o.seed;
  const mat = o.mat ?? M.hoja;
  const bark = o.bark ?? M.corteza;
  const trunkH = Math.round(h * (o.tall ? 0.18 : 0.3));
  const cw = h * (o.tall ? 0.28 : 0.6);
  // Tronco con dos ramas.
  for (let y = base - trunkH - 2; y <= base; y++) {
    const w = y > base - 2 ? 1 : 0;
    for (let dx = -w; dx <= Math.max(w, 1) - 1 + (h > 24 ? 1 : 0); dx++)
      t.set(
        x + dx,
        y,
        bark,
        bark === M.nieve ? (hash2(dx, y >> 1, s) < 0.25 ? 0 : dx <= 0 ? 4 : 2) : dx <= 0 ? 3 : 1,
        true,
      );
  }
  const fy = base - trunkH;
  for (let d = 0; d < Math.round(h * 0.18); d++) {
    t.set(x - 1 - (d >> 1), fy - d, bark, 3, true);
    t.set(x + 1 + (d >> 1), fy - d - 1, bark, 1, true);
  }
  // Racimos: discos repartidos por la copa, de atrás (oscuros) a delante (claros).
  const cy = base - trunkH - (h - trunkH) * 0.5;
  const ch = (h - trunkH) * 0.62;
  const n = Math.max(5, Math.round(h / 2.4));
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = hash2(i, s, 21) * Math.PI * 2;
    const r = Math.sqrt(hash2(i, s, 22));
    blobs.push([
      x + Math.cos(a) * r * cw * 0.62,
      cy + Math.sin(a) * r * ch * 0.62,
      Math.max(2.2, (o.tall ? cw : ch) * (0.38 + hash2(i, s, 23) * 0.25)),
    ]);
  }
  blobs.sort((p, q) => p[1] - q[1] + (q[0] - p[0]) * 0.1);
  for (const [bx, by, br] of blobs) {
    for (let y = Math.floor(by - br); y <= by + br; y++)
      for (let xx = Math.floor(bx - br); xx <= bx + br; xx++) {
        const g = grain(xx, y, s + 3);
        const dx = xx + 0.5 - bx;
        const dy = y + 0.5 - by;
        const d = Math.hypot(dx, dy * (o.tall ? 0.8 : 1.05)) / br;
        if (d > 1 + (g - 0.5) * 0.35) continue;
        // Normal de la bola: luz de arriba a la izquierda, y el conjunto más claro arriba.
        const lam = (-dx * 0.6 - dy * 0.8) / br;
        let v = 2.6 + lam * 2 + (cy - by) / (ch + 1) - d * 0.6 + (g - 0.5) * 1.2;
        if (d > 0.85 && dx > 0) v -= 0.8;
        t.set(xx, y, mat, step(v, xx, y), true);
      }
  }
  if (o.fruit) {
    for (let i = 0; i < Math.round(h / 3); i++) {
      const fx = Math.round(x + (hash2(i, s, 31) - 0.5) * cw * 1.3);
      const fyy = Math.round(cy + (hash2(i, s, 32) - 0.4) * ch * 1.2);
      if (t.get(fx, fyy, true) >> 4 !== mat) continue;
      t.set(fx, fyy, M.fruta, hash2(i, s, 33) < 0.6 ? 2 : 3, true);
      t.set(fx, fyy + 1, M.fruta, 1, true);
    }
  }
}

/** Un pino pequeño de lejos (colinas): unos pisos y su lado de sombra. */
export function pineSmall(
  t: Tonos,
  x: number,
  base: number,
  h: number,
  mat: Mat,
  s: number,
  lift = 0,
): void {
  const w = h * 0.3;
  t.set(x, base, M.corteza, 1, true);
  for (let j = 0; j < h; j++) {
    const y = base - 1 - j;
    const u = 1 - j / h;
    const tierV = ((j + (s & 3)) % 3) / 3; // 0 abajo del piso
    const half = Math.max(0, w * u * (0.65 + 0.35 * (1 - tierV)));
    for (let dx = Math.floor(-half); dx <= Math.ceil(half); dx++) {
      if (Math.abs(dx) > half + 0.35) continue;
      let v = 2.5 + lift - (dx / Math.max(1, half)) * 1.2 + (tierV < 0.34 ? -0.6 : 0.3);
      if (j >= h - 2) v += 0.6;
      t.set(x + dx, y, mat, step(v, x + dx, y), true);
    }
  }
}

/** Una mata redonda (de `w` × `h`). */
export function bush(t: Tonos, x: number, base: number, w: number, h: number, mat: Mat, s: number) {
  for (let y = base - h; y <= base; y++)
    for (let xx = Math.floor(x - w / 2); xx <= x + w / 2; xx++) {
      const g = grain(xx, y, s);
      const dx = (xx + 0.5 - x) / (w / 2);
      const dy = (y + 0.5 - (base - h * 0.45)) / (h * 0.6);
      const d = dx * dx + dy * dy;
      if (d > 1 + (g - 0.5) * 0.5 || y > base) continue;
      const v = 2.6 - dx * 1.2 - dy * 1.3 + (g - 0.5) * 1.2;
      t.set(xx, y, mat, step(v, xx, y), true);
    }
}

/** Una piedra (con musgo encima si `moss`). */
export function rock(t: Tonos, x: number, base: number, w: number, h: number, s: number, moss = 0) {
  for (let y = base - h; y <= base; y++)
    for (let xx = Math.floor(x - w / 2); xx <= x + w / 2; xx++) {
      const g = grain(xx, y, s);
      const dx = (xx + 0.5 - x) / (w / 2);
      const dy = (y + 0.5 - base) / h;
      if (dx * dx + dy * dy > 1 + (g - 0.5) * 0.3 || y > base) continue;
      let v = 3 - dx * 1.4 + dy * 1.2 + (g - 0.5) * 0.8;
      if (y === base) v = 1;
      if (moss && dy < -0.45 + moss * 0.25 && hash2(xx, y, s) < 0.4 + moss * 0.5)
        t.set(xx, y, M.musgo, step(v - 0.5, xx, y), true);
      else t.set(xx, y, M.roca, step(v, xx, y), true);
    }
}

/** Helecho: frondas en abanico que caen hacia fuera. */
export function fern(t: Tonos, x: number, base: number, h: number, s: number, mat: Mat = M.hierba) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2 + (hash2(i, s, 1) - 0.5) * 0.3;
    const len = h * (0.75 + hash2(i, s, 2) * 0.35) * (1 - Math.abs(i / (n - 1) - 0.5) * 0.4);
    for (let k = 0; k <= len; k++) {
      const u = k / len;
      const px = x + Math.cos(a) * k + Math.sign(Math.cos(a)) * u * u * 2;
      const py = base + Math.sin(a) * k + u * u * h * 0.45;
      const v = 4 - u * 1.5 - (Math.cos(a) > 0 ? 1 : 0);
      t.set(px, py, mat, v, true);
      // Las hojitas a los lados.
      if (k % 2 === 0 && u > 0.15 && u < 0.9) {
        t.set(px - 1, py + 1, mat, v - 1, true);
        t.set(px + 1, py + 1, mat, v - 1.5, true);
      }
    }
  }
}

/** Una mata de hierba alta (hojas que salen del suelo y se curvan con `sway`). */
export function tuft(
  t: Tonos,
  x: number,
  base: number,
  h: number,
  s: number,
  mat: Mat = M.hierba,
  lift = 0,
) {
  const n = 3 + ((h / 3) | 0);
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1) - 0.5) * (h * 0.7);
    const len = h * (0.55 + hash2(i, s, 4) * 0.45);
    const bend = off * 0.25 + (hash2(i, s, 5) - 0.5) * 2;
    for (let k = 0; k < len; k++) {
      const u = k / len;
      const px = x + off * 0.4 + bend * u * u;
      const py = base - k;
      t.set(px, py, mat, 1.5 + u * 3 + lift - (off > 0 ? 0.8 : 0), true);
    }
  }
}

/** Unas espigas: tallos finos que se doblan con la espiga (más gorda y clara) en la punta. */
export function wheat(t: Tonos, x: number, base: number, h: number, s: number) {
  const n = 4 + Math.floor(hash2(s, 1, 3) * 4);
  for (let i = 0; i < n; i++) {
    const ox = Math.round((i - n / 2) * 1.6 + (hash2(i, s, 4) - 0.5) * 2);
    const len = Math.round(h * (0.6 + hash2(i, s, 5) * 0.4));
    const bend = 1 + hash2(i, s, 6) * 2;
    for (let k = 0; k < len; k++) {
      const u = k / len;
      const px = x + ox + bend * u * u;
      const py = base - k;
      if (u > 0.72) {
        // La espiga: granos a los dos lados.
        t.set(px, py, M.mies, 4 + (k & 1), true);
        if (k % 2 === 0) t.set(px - 1, py, M.mies, 3, true);
        else t.set(px + 1, py, M.mies, 2, true);
      } else t.set(px, py, u < 0.3 ? M.hierba : M.mies, u < 0.3 ? 3 : 2, true);
    }
  }
}

/** Un tronco caído a lo largo, con musgo encima y el corte claro con anillos. */
export function log(t: Tonos, x: number, base: number, w: number, s: number, moss = 0) {
  const r = Math.max(2, Math.round(w / 10));
  for (let i = 0; i < w; i++)
    for (let j = 0; j < r * 2; j++) {
      const y = base - j;
      const u = j / (r * 2);
      let v = u > 0.65 ? 3.2 : u > 0.3 ? 2.4 : 1.2;
      if (hash2(i >> 2, j, s) < 0.15) v -= 0.8;
      if (moss && u > 0.7 && hash2(i, j, s + 1) < 0.5 + moss * 0.4)
        t.set(x + i, y, M.musgo, Math.round(v + 0.5), true);
      else t.set(x + i, y, M.corteza, Math.round(v), true);
    }
  // El corte: la madera clara con un anillo.
  for (let j = 0; j < r * 2; j++) {
    t.set(x + w, base - j, M.valla, j === 0 || j === r * 2 - 1 ? 3 : 5, true);
    if (j > 0 && j < r * 2 - 1) t.set(x + w + 1, base - j, M.valla, 4, true);
  }
  t.set(x + w, base - r, M.valla, 2, true);
}

/** Un tocón: corto, con raíces que se abren y el corte claro con anillos arriba. */
export function stump(t: Tonos, x: number, base: number, w: number, s: number) {
  const h = Math.round(w * 0.55);
  for (let j = 0; j < h; j++) {
    const half = w / 2 - 1 + (j < 3 ? (3 - j) * 0.8 : 0);
    for (let i = Math.floor(-half); i <= Math.ceil(half); i++) {
      if (j < 3 && Math.abs(i) > w / 2 - 1 && hash2(i, j, s) < 0.4) continue;
      const v = i < -w / 5 ? 3 : i > w / 5 ? 1 : 2;
      t.set(x + i, base - j, M.corteza, v - (hash2(i, j >> 1, s + 1) < 0.15 ? 1 : 0), true);
    }
  }
  // El corte, en óvalo: madera clara con un anillo.
  for (let i = -w / 2 + 1; i <= w / 2 - 1; i++)
    for (let j = 0; j < 2; j++) {
      const ring = Math.abs(i) === Math.round(w / 4);
      t.set(
        x + i,
        base - h - j,
        M.valla,
        j === 1 && Math.abs(i) > w / 2 - 2 ? 3 : ring ? 3 : 5,
        true,
      );
    }
}
