/**
 * El paisaje de las marismas (rumbo suroeste): todo llano y mucho cielo. Cerca de casa, arrozales
 * con sus motas y barracas blancas de tejado de carrizo; lejos, lagunas abiertas, sauces y luego
 * cipreses de pantano con musgo colgando, árboles muertos y el camino que se vuelve una pasarela
 * de tablones sobre el agua.
 */
import { bush, leafy, tuft } from './arboles';
import { step, type Paisaje, type Painter } from './capas';
import { M, Tonos, clamp01, fbm1, hash2, lerp, noise2, smooth } from './tonos';

/** Rampas de las marismas: juncal, sauce plateado, ciprés oliva, carrizo, lodo y agua turbia. */
export const MARISMAS_RAMPS = {
  [M.hierba]: ['#1a2c22', '#21392a', '#2c4a2e', '#3c6034', '#517a3a', '#6c9442', '#90ae52'],
  [M.hoja]: ['#1e2e28', '#28403a', '#385646', '#4e6e52', '#6a8a62', '#8ea67a', '#b4c49a'],
  [M.viejo]: ['#121a14', '#1a2618', '#24321e', '#304028', '#405232', '#56683e', '#70804c'],
  [M.mies]: ['#3a2a1a', '#5a3e22', '#7a5a30', '#9a7a44', '#bc9c5c', '#dcc080'],
  [M.musgo]: ['#26361e', '#3a4e24', '#52682c', '#6e8434', '#8ea044', '#b0bc5a'],
  [M.tierra]: ['#1e1818', '#2e2420', '#3e3028', '#4e3e30', '#62503c', '#7a664c', '#94805e'],
  [M.agua]: ['#1e3a44', '#2a5260', '#3a6c7a', '#568a96', '#86b2b8'],
  [M.monte]: ['#36405a', '#44506a', '#56627a', '#6a768c', '#808ca0', '#98a2b4', '#b2bac8'],
  [M.valla]: ['#241e22', '#3a3030', '#544640', '#6e5e50', '#8a7a66', '#a8987e'],
};

/** Agua quieta: más clara a lo lejos (refleja el cielo) con rayas de brillo horizontales. */
function water(t: Tonos, x: number, y: number, u: number, seed: number) {
  const L = t.w;
  const ripple = noise2(x / 9, y * 1.3, seed, Math.round(L / 9));
  let v = 2.4 + (1 - u) * 1.2 + (ripple > 0.72 ? 1 : ripple < 0.25 ? -0.6 : 0);
  if (hash2(x >> 2, y, seed + 1) < 0.04) v += 1.2;
  t.set(x, y, M.agua, step(v, x, y));
}

/** Una enea: tallo y la mazorca parda arriba; con hojas largas. */
export function enea(t: Tonos, x: number, base: number, h: number, s: number) {
  const bend = (hash2(s, 1, 3) - 0.5) * 3;
  for (let k = 0; k < h; k++) {
    const u = k / h;
    const px = x + bend * u * u;
    if (u > 0.68 && u < 0.9) {
      t.set(px, base - k, M.mies, 1 + (k & 1), true);
      t.set(px + 1, base - k, M.mies, 0, true);
    } else t.set(px, base - k, M.hierba, 2 + u * 2, true);
  }
  for (let j = 0; j < 2; j++) {
    const dir = j ? 1 : -1;
    for (let k = 0; k < h * 0.6; k++) {
      const u = k / (h * 0.6);
      t.set(x + dir * (u * u * 3 + 1), base - k, M.hierba, 3 + u - (j ? 1 : 0), true);
    }
  }
}

/** Un sauce: copa redonda y ramas que caen como cortinas. */
function sauce(t: Tonos, x: number, base: number, h: number, s: number) {
  leafy(t, x, base, h, { seed: s, mat: M.hoja });
  const cw = h * 0.6;
  for (let i = 0; i < h * 0.9; i++) {
    const dx = Math.round((hash2(i, s, 41) - 0.5) * cw * 1.25);
    const y0 = Math.round(base - h * 0.75 + Math.abs(dx) * 0.4 + hash2(i, s, 42) * 4);
    const len = Math.round(h * (0.3 + hash2(i, s, 43) * 0.25));
    for (let k = 0; k < len; k++)
      t.set(
        x + dx + (k > len * 0.6 ? Math.sign(dx) : 0),
        y0 + k,
        M.hoja,
        3 - (dx > 0 ? 1 : 0) + (k < 2 ? 1 : 0),
        true,
      );
  }
}

/** Ciprés de pantano: tronco que se ensancha al pie, copa ancha en nubes planas y musgo colgando. */
function cipres(
  t: Tonos,
  x: number,
  base: number,
  h: number,
  s: number,
  moss: number,
  dead = false,
) {
  if (dead) h = Math.round(h * 0.6);
  const trunkH = Math.round(h * (dead ? 1 : 0.42));
  const top = base - h + 1;
  for (let y = top + (dead ? 0 : 6); y <= base; y++) {
    const u = (y - top) / h;
    const flare = y > base - 6 ? Math.round((y - (base - 6)) * 0.7) : 0;
    const w = Math.round((h > 34 ? 1.5 : 1) * (0.6 + u * 0.6)) + flare;
    for (let dx = -w; dx <= w; dx++)
      t.set(x + dx, y, M.corteza, dx < 0 ? 4 : dx === 0 ? 3 : 1, true);
  }
  // Ramas que salen al ras de la copa.
  for (let b = 0; b < (dead ? 5 : 3); b++) {
    const by =
      base - trunkH * (dead ? 0.3 + hash2(b, s, 1) * 0.6 : 1) - Math.round(hash2(b, s, 1) * 3);
    const dir = b % 2 ? 1 : -1;
    const len = Math.round(h * (0.12 + hash2(b, s, 2) * 0.14));
    for (let k = 0; k < len; k++)
      t.set(x + dir * k, by - (k >> 1), M.corteza, 3 - (dir > 0 ? 1 : 0), true);
  }
  if (dead) return;
  // La copa: nubes planas y anchas, la de arriba chata.
  const cw = h * 0.36;
  const crownTop = top;
  const crownBot = base - trunkH;
  const n = 6 + Math.round(h / 8);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = hash2(i, s, 11);
    const by = lerp(crownTop + 3, crownBot, u);
    const spread = cw * (0.5 + u * 0.6);
    blobs.push([x + (hash2(i, s, 12) - 0.5) * 2 * spread, by, 3 + hash2(i, s, 13) * cw * 0.4]);
  }
  blobs.sort((p, q) => p[1] - q[1]);
  for (const [bx, by, br] of blobs)
    for (let y = Math.floor(by - br * 0.5); y <= by + br * 0.35; y++)
      for (let xx = Math.floor(bx - br); xx <= bx + br; xx++) {
        const dx = (xx + 0.5 - bx) / br;
        const dy = (y + 0.5 - by) / (br * 0.45);
        const g = hash2(xx >> 1, y >> 1, s + 3);
        if (dx * dx + dy * dy > 1 + (g - 0.5) * 0.5) continue;
        const v = 3 - dx * 1.1 - dy * 0.9 + (g - 0.5) * 1.2;
        t.set(xx, y, M.viejo, step(v, xx, y), true);
      }
  // Musgo que cuelga de la copa.
  if (moss > 0)
    for (const [bx, by, br] of blobs)
      for (let dx = Math.floor(-br); dx <= br; dx += 2) {
        if (hash2(dx + Math.round(bx), Math.round(by), s + 6) > moss * 0.55) continue;
        const len = 2 + Math.round(hash2(dx, Math.round(by), s + 7) * 7 * moss);
        const y0 = Math.round(by + br * 0.3);
        for (let j = 0; j < len; j++)
          t.set(
            bx + dx + (j > len * 0.6 ? 1 : 0),
            y0 + j,
            M.musgo,
            3 - (j > len / 2 ? 1 : 0),
            true,
          );
      }
}

/** Orillas: el agua, oscura justo bajo la tierra (la sombra del ribazo) y con brillo debajo. */
function orillas(t: Tonos): void {
  const W = M.agua;
  for (let y = t.h - 1; y > 0; y--)
    for (let x = 0; x < t.w; x++) {
      const c = t.d[y * t.w + x]!;
      if (c >> 4 !== W) continue;
      const up = t.d[(y - 1) * t.w + x]!;
      if (up && up >> 4 !== W) t.d[y * t.w + x] = (W << 4) | 0;
      else if (
        y > 1 &&
        up >> 4 === W &&
        t.d[(y - 2) * t.w + x]! >> 4 !== W &&
        t.d[(y - 2) * t.w + x]
      )
        t.d[y * t.w + x] = (W << 4) | 1;
    }
}

/** Barraca: paredes encaladas, puerta azul y tejado de carrizo muy empinado. */
function barraca(t: Tonos, x: number, base: number, s: number) {
  const w = 10 + (s % 2) * 2;
  const h = 4;
  for (let y = base - h; y <= base; y++)
    for (let i = 0; i < w; i++) t.set(x + i, y, M.nieve, i < 2 ? 2 : 4, true);
  const rh = 7;
  for (let j = 0; j < rh; j++) {
    const inset = Math.round((j / rh) * (w / 2 - 1));
    for (let i = inset - 1; i <= w - inset; i++)
      t.set(x + i, base - h - 1 - j, M.mies, i < w / 2 ? 4 - (j & 1) : 2, true);
  }
  t.set(x + w / 2, base - h - 1 - rh, M.corteza, 1, true);
  t.set(x + 4, base, M.agua, 1, true);
  t.set(x + 4, base - 1, M.agua, 1, true);
  t.set(x + 4, base - 2, M.agua, 2, true);
}

const lejos: Painter = (e, L, wild, seed) => {
  const H = Math.round(e.hor * 0.22);
  const t = new Tonos(L, H + 2);
  for (let x = 0; x < L; x++) {
    const top =
      H - Math.round((fbm1(x, 160, L, seed + 201, 3) * 0.8 + 0.1) * H * lerp(0.7, 0.4, wild));
    for (let y = top; y < t.h; y++)
      t.set(
        x,
        y,
        M.monte,
        step(4.4 - ((y - top) / H) * 0.6 + (fbm1(x, 20, L, seed + 202, 2) - 0.5), x, y),
      );
  }
  return [t, e.hor - H + 1];
};

/** El horizonte: una raya de arboleda baja y el brillo del agua al pie. */
const sierra: Painter = (e, L, _wild, seed) => {
  const H = Math.round(e.hor * 0.14);
  const t = new Tonos(L, H + 3);
  for (let x = 0; x < L; x++) {
    const n = fbm1(x, 26, L, seed + 211, 3);
    const top = Math.round(H - 1 - (n > 0.45 ? (n - 0.3) * H * 1.3 : 0));
    for (let y = top; y < H; y++) t.set(x, y, M.viejo, step(4 - (y - top) * 0.3, x, y));
    for (let y = H; y < H + 3; y++) water(t, x, y, 0, seed + 212);
  }
  return [t, e.hor - H + 1];
};

const colinas: Painter = (e, L, wild, seed) => {
  const y0 = e.hor + 1;
  const H = e.ground - y0 + 4;
  const t = new Tonos(L, H);
  const farm = clamp01(1 - wild * 2.8);
  const lagoon = smooth(0.15, 0.8, wild);
  // Bandas horizontales: agua, islas de juncal y, cerca de casa, arrozales.
  for (let x = 0; x < L; x++)
    for (let y = 0; y < H; y++) {
      const u = y / H;
      const band = fbm1(x + y * 23, 60, L, seed + 221, 2);
      const isle = noise2(x / (30 + u * 20), y / 2.5, seed + 222, Math.round(L / (30 + u * 20)));
      const wet = isle < lerp(0.42, 0.62, lagoon);
      if (farm > 0.1 && !wet && band < farm * 0.8) {
        // Arrozal: agua con motas verdes en filas y caballones de tierra.
        const row = y % 3 === 0;
        if (x % 37 === 0 || (y % 5 === 0 && hash2(x >> 3, y, seed) < 0.9))
          t.set(x, y, M.tierra, 3 + (row ? 1 : 0));
        else if ((x + y) % 2 === 0) t.set(x, y, M.hierba, step(3.6 - u, x, y));
        else water(t, x, y, u, seed + 223);
        continue;
      }
      if (wet) water(t, x, y, u, seed + 224);
      else {
        const reed = hash2(x, y, seed + 225) < 0.35;
        t.set(x, y, reed ? M.mies : M.hierba, step(3 - u * 0.8 + (isle - 0.6) * 2, x, y));
      }
    }
  // Juncos que asoman en las orillas.
  for (let i = 0; i < L / 2; i++) {
    const x = Math.round(i * 2 + hash2(i, 1, seed) * 2);
    const y = Math.round(hash2(i, 2, seed + 226) * (H - 1));
    if (t.get(x, y, true) >> 4 !== M.hierba) continue;
    const h = 2 + Math.round((y / H) * 3);
    for (let k = 0; k < h; k++)
      t.set(x, y - k, k === h - 1 ? M.mies : M.hierba, 3 + (k === h - 1 ? 1 : 0), true);
  }
  // Barracas en los arrozales; árboles muertos en las lagunas.
  for (let k = 0; k < L / 80; k++) {
    const x = Math.round(k * 80 + hash2(k, 1, seed + 227) * 40);
    const y = 4 + Math.round(hash2(k, 2, seed + 227) * (H - 10));
    if (hash2(k, 3, seed + 227) < farm * 0.6) barraca(t, x, y, k + seed);
    else if (hash2(k, 4, seed + 227) < lagoon * 0.8)
      cipres(t, x, y, 8 + Math.round(y * 0.5), k + seed, 0, true);
  }
  // Una garza de lejos (punto blanco) de tanto en tanto.
  for (let k = 0; k < L / 60; k++) {
    if (hash2(k, 5, seed) > 0.5) continue;
    const x = Math.round(k * 60 + hash2(k, 6, seed) * 30);
    const y = 3 + Math.round(hash2(k, 7, seed) * (H - 6));
    if (t.get(x, y, true) >> 4 !== M.agua) continue;
    t.set(x, y - 1, M.nieve, 5, true);
    t.set(x, y - 2, M.nieve, 4, true);
  }
  return [t, y0];
};

const medio: Painter = (e, L, wild, seed) => {
  const H = Math.round(e.ground * 0.62);
  const y0 = e.ground + 2 - H;
  const t = new Tonos(L, H);
  const base = H - 2;
  // El agua al pie de la arboleda.
  for (let x = 0; x < L; x++) for (let y = base - 1; y < H; y++) water(t, x, y, 0.4, seed + 240);
  const gap = Math.round(lerp(18, 9, wild));
  const density = lerp(0.45, 1, smooth(0, 0.7, wild));
  for (let i = 0; i < L / gap; i++) {
    const x = Math.round(i * gap + hash2(i, 1, seed + 241) * gap * 0.8);
    if (hash2(i, 2, seed + 241) > density) continue;
    const b = base - Math.round(hash2(i, 3, seed + 241) * 2);
    const r = hash2(i, 4, seed + 241);
    const willowP = clamp01(0.9 - wild * 1.4);
    if (r < willowP) sauce(t, x, b, Math.round(12 + hash2(i, 5, seed) * 8), i + seed);
    else {
      const h = Math.round(lerp(18, 30, wild) + hash2(i, 6, seed) * 10);
      cipres(
        t,
        x,
        b,
        Math.min(H - 1, h),
        i * 7 + seed,
        smooth(0.4, 1, wild),
        hash2(i, 7, seed) < 0.15 * wild,
      );
    }
  }
  return [t, y0];
};

const cerca: Painter = (e, L, wild, seed) => {
  const H = e.ground + 7;
  const t = new Tonos(L, H);
  const base = e.ground + 4;
  // La orilla: hierba con charcas.
  for (let x = 0; x < L; x++) {
    const top = e.ground + Math.round(fbm1(x, 40, L, seed + 250, 2) * 2);
    for (let y = top; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 251, Math.round(L / 3));
      const pool = noise2(x / 26, y / 2, seed + 252, Math.round(L / 26));
      if (pool < lerp(0.2, 0.45, wild)) water(t, x, y, 0.6, seed + 253);
      else
        t.set(
          x,
          y,
          hash2(x, y, 254) < wild * 0.3 ? M.musgo : M.hierba,
          step(2.4 + (n - 0.5) * 1.6, x, y),
        );
    }
  }
  orillas(t);
  const gap = Math.round(lerp(50, 24, smooth(0, 0.85, wild)));
  for (let i = 0; i < L / gap; i++) {
    if (hash2(i, 2, seed + 260) > lerp(0.6, 1, wild)) continue;
    const x = Math.round(i * gap + hash2(i, 1, seed + 260) * gap * 0.7);
    const r = hash2(i, 3, seed + 260);
    if (r < clamp01(0.85 - wild * 1.5))
      sauce(t, x, base, Math.round(28 + hash2(i, 5, seed) * 14), i * 7 + seed);
    else {
      const h = Math.round(lerp(40, 66, wild) + hash2(i, 6, seed) * 24);
      cipres(t, x, base, h, i * 31 + seed, smooth(0.3, 0.9, wild), hash2(i, 7, seed) < 0.12);
    }
    // Eneas al pie.
    for (let k = 0; k < 4; k++)
      enea(t, x + 8 + k * 3, base + 2, 9 + Math.round(hash2(i, k, seed) * 6), i * 5 + k);
  }
  return [t, 0];
};

const suelo: Painter = (e, L, wild, seed) => {
  const y0 = e.ground + 4;
  const H = e.h - y0;
  const t = new Tonos(L, H);
  const path = e.feet - y0 - 1;
  const half = lerp(5, 4, wild);
  // De lodo a tablones: la pasarela sale por tramos y lejos ya es todo.
  const board = smooth(0.35, 0.8, wild);
  const pond = lerp(0.25, 0.62, smooth(0.1, 0.9, wild));
  for (let x = 0; x < L; x++) {
    const seg = Math.floor(x / 48);
    const isBoard = hash2(seg, 1, seed + 270) < board;
    const wob = isBoard ? 0 : (fbm1(x, 50, L, seed + 271, 3) - 0.5) * 3;
    const top = Math.round(path - half + wob);
    const bot = Math.round(path + half * 0.8 + wob * 0.6);
    for (let y = 0; y < H; y++) {
      const n = noise2(x / 3, y / 2, seed + 272, Math.round(L / 3));
      if (y >= top && y <= bot) {
        if (isBoard) {
          // Tablones de través, con juntas y algún clavo; el canto de abajo, en sombra.
          const plank = x % 4 === 0;
          let v = plank
            ? 1.4
            : 3.6 - ((y - top) / (bot - top)) * 0.8 + (hash2(x >> 2, seg, 273) - 0.5);
          if (y === bot) v = 0.6;
          t.set(x, y, M.valla, step(v, x, y));
        } else {
          const u = (y - top) / Math.max(1, bot - top);
          const puddle = noise2(x / 6, y / 2, seed + 274, Math.round(L / 6)) < 0.22;
          if (puddle) water(t, x, y, 0.2, seed + 275);
          else
            t.set(x, y, M.tierra, step(3.6 - u * 1 + (n - 0.5) * 1.4 - (y === top ? 1 : 0), x, y));
        }
        continue;
      }
      const near = y > bot ? (y - bot) / Math.max(1, H - bot) : 0;
      const wet = noise2(x / 34, y / 2.6, seed + 276, Math.round(L / 34));
      if (wet < pond) {
        water(t, x, y, 0.7 + near * 0.3, seed + 277);
        // Lentejas de agua y nenúfares.
        if (hash2(x, y, 278) < 0.06 * wild) t.set(x, y, M.musgo, 4);
        continue;
      }
      let v = 2.6 + (n - 0.5) * 1.5 + near * 0.6;
      if (y > bot && y < bot + 2) v -= 1;
      t.set(x, y, M.hierba, step(v, x, y));
    }
    // Postes de la pasarela, metidos en el agua.
    if (isBoard && x % 16 === 2)
      for (let y = bot + 1; y < bot + 4; y++) t.set(x, y, M.valla, y === bot + 1 ? 2 : 1, true);
  }
  orillas(t);
  // Nenúfares con flor.
  for (let i = 0; i < L / 12; i++) {
    const x = Math.round(i * 12 + hash2(i, 1, seed + 280) * 12);
    const y = Math.round(hash2(i, 2, seed + 280) * (H - 2));
    if (t.get(x, y, true) >> 4 !== M.agua) continue;
    t.set(x, y, M.musgo, 3, true);
    t.set(x + 1, y, M.musgo, 4, true);
    t.set(x - 1, y, M.musgo, 2, true);
    if (hash2(i, 3, seed) < 0.3) t.set(x, y - 1, M.flor, 4, true);
  }
  // Matas de juncos.
  for (let i = 0; i < L / 14; i++) {
    const x = Math.round(i * 14 + hash2(i, 1, seed + 281) * 10);
    const y = Math.round(hash2(i, 2, seed + 281) * (H - 1));
    if (Math.abs(y - path) < half + 2) continue;
    tuft(t, x, y, 4 + Math.round(hash2(i, 3, seed) * 3), i, M.hierba);
  }
  return [t, y0];
};

const delante: Painter = (e, L, wild, seed) => {
  const H = Math.max(14, Math.min(30, e.h - e.feet - 4));
  const t = new Tonos(L, H);
  const base = H - 1;
  for (let i = 0; i < L / 18; i++) {
    const x = Math.round(i * 18 + hash2(i, 1, seed + 290) * 10);
    if (hash2(i, 2, seed + 290) > lerp(0.5, 0.85, wild)) continue;
    const k = hash2(i, 3, seed + 290);
    if (k < 0.6)
      for (let j = 0; j < 3; j++)
        enea(t, x + j * 3, base + 1, Math.round(H * (0.7 + hash2(i, j, seed) * 0.3)), i * 3 + j);
    else if (k < 0.85) tuft(t, x, base, Math.round(H * 0.6), i, M.hierba);
    else bush(t, x, base + 2, 12, Math.round(H * 0.4), M.hoja, i);
  }
  return [t, e.h - H];
};

export const MARISMAS: Paisaje = {
  capas: { lejos, sierra, colinas, medio, cerca, suelo, delante },
};
