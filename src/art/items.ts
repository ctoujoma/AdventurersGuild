import type { ItemIcon, Rarity, TrophyIcon } from '../core/model';
import { P, darker } from './palette';
import { PixelBuffer, alpha, toHex } from './pixel';
import { GRIDS, ORN } from './itemGrids';
import { FRAMES, LEGENDS, legendFrame, legendShine } from './legendaries';
import { ACCENT, CLOTH, FIELD, METAL, TRIM, tierOf, type Tier } from './tiers';

/**
 * Iconos de objetos y trofeos en pixel art. Los del equipo (16 × 16, rejillas de `itemGrids.ts`
 * coloreadas por nivel con `tiers.ts`, y los legendarios propios de `legendaries.ts`) van en las
 * fichas; los pequeños de 12 × 12 (`rackIcon`), en la escena. Trofeos, 14 × 14.
 */

const cache = new Map<string, PixelBuffer>();

function make(key: string, w: number, h: number, draw: (b: PixelBuffer) => void): PixelBuffer {
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new PixelBuffer(w, h);
  draw(b);
  const out = b.outlined((n) => darker(toHex(n), 2));
  cache.set(key, out);
  return out;
}

/** Metal y remate de los iconos pequeños de la escena: hierro, acero con plata y oro. */
const RACK_METAL = [
  [P.steel, P.fog, P.mist],
  [P.fog, P.mist, P.white],
  [P.amber, P.gold, P.lemon],
] as const;
const RACK_TRIM = [P.oak, P.mist, P.lemon] as const;

/** Las mejoras del taller (+1 a +3): galones dorados en la esquina de arriba y un destello. */
function withPlus(base: PixelBuffer, key: string, plus: number): PixelBuffer {
  const n = Math.max(0, Math.min(3, Math.round(plus)));
  if (!n) return base;
  const k = `${key}:+${n}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const b = base.clone();
  for (let i = 0; i < n; i++) {
    const y = 1 + i * 2;
    b.hline(b.w - 4, y, 3, P.lemon);
    b.set(b.w - 4, y, P.white);
    b.hline(b.w - 4, y + 1, 3, P.rust);
  }
  b.set(1, 1, P.white);
  b.set(0, 1, P.lemon);
  b.set(2, 1, P.lemon);
  b.set(1, 0, P.lemon);
  b.set(1, 2, P.lemon);
  cache.set(k, b);
  return b;
}

/** Pinta una rejilla de 14 × 14 a escala `k` y la contornea. */
function fromRows(rows: readonly string[], pal: Record<string, string>, k: number): PixelBuffer {
  const b = new PixelBuffer(14 * k, 14 * k);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]!];
      if (c) b.rect(x * k, y * k, k, k, c);
    }
  });
  return b.outlined((n) => darker(toHex(n), 2));
}

/** Lo centra en un lienzo de `size` (el de 32 sale de 30: la rejilla al doble y su contorno). */
function fit(b: PixelBuffer, size: number): PixelBuffer {
  if (b.w === size) return b;
  const o = new PixelBuffer(size, size);
  o.blit(b, (size - b.w) >> 1, (size - b.h) >> 1);
  return o;
}

/** Las filas y la paleta de un icono genérico en un nivel (con sus adornos). */
function tierRows(icon: ItemIcon, t: Tier): { rows: string[]; pal: Record<string, string> } {
  const [m0, m1, m2, m3] = METAL[t]!;
  const [t0, t1] = TRIM[t]!;
  const [a0, a1] = ACCENT[t]!;
  const [c0, c1, c2] = CLOTH[t]!;
  const [f0, f1] = FIELD[t]!;
  const pal: Record<string, string> = {
    '0': m0,
    '1': m1,
    '2': m2,
    '3': m3,
    t: t0,
    T: t1,
    a: a0,
    A: a1,
    g: a0,
    G: a1,
    o: P.oak,
    b: P.bark,
    f: f0,
    F: f1,
    c: c0,
    C: c1,
    k: c2,
    l: P.bark,
    L: P.clay,
    r: P.oak,
    w: P.white,
    x: P.black,
  };
  // El escudo común lleva la cruz de hierro, no de cuero.
  if (icon === 'escudo' && t === 0) pal.T = P.steel;
  const rows = GRIDS[icon].map((r) => [...r]);
  for (const [min, x, y, ch] of ORN[icon] ?? []) if (t >= min && rows[y]?.[x]) rows[y]![x] = ch;
  return { rows: rows.map((r) => r.join('')), pal };
}

const uniqueOf = (rarity: Rarity, unique?: string) =>
  rarity === 2 && unique && LEGENDS[unique] ? unique : undefined;

/**
 * El icono de un objeto (16 × 16; `size` 32, el mismo dibujo al doble). Los legendarios con
 * dibujo propio (`unique`: el nombre del objeto) usan el suyo. Con `plus` (mejoras del taller),
 * sus galones.
 */
export function itemIcon(
  icon: ItemIcon,
  rarity: Rarity = 0,
  plus = 0,
  unique?: string,
  size: 16 | 32 = 16,
): PixelBuffer {
  const u = uniqueOf(rarity, unique);
  const key = `i:${icon}:${rarity}:${u ?? ''}:${size}`;
  let base = cache.get(key);
  if (!base) {
    const k = size / 16;
    base = fit(
      u ? fromRows(LEGENDS[u]!.rows, LEGENDS[u]!.pal, k) : fromRows(...rowsPal(icon, rarity), k),
      size,
    );
    cache.set(key, base);
  }
  return withPlus(base, key, plus);
}

function rowsPal(icon: ItemIcon, rarity: Rarity): [string[], Record<string, string>] {
  const { rows, pal } = tierRows(icon, tierOf(rarity));
  return [rows, pal];
}

/** Mezcla un color con otro (`k`: 0–1). */
function mix(c: number, to: string, k: number): string {
  const a = toHex(c);
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    '#' +
    [0, 1, 2]
      .map((i) =>
        Math.round(ch(a, i) + (ch(to, i) - ch(a, i)) * k)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Un brillo que cruza la pieza en diagonal (en los primeros fotogramas). */
function sweep(b: PixelBuffer, f: number, tint: string, span = 8): PixelBuffer {
  if (f >= span) return b;
  const o = b.clone();
  const s = b.w / 16;
  const p = (f / (span - 1)) * (b.w + b.h + 8 * s) - 8 * s;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (!alpha(c)) continue;
      const d = Math.abs(x + y - p) / s;
      if (d < 3) o.set(x, y, mix(c, tint, d < 1.5 ? 0.6 : 0.3));
    }
  return o;
}

/** Una estrella que se enciende y se apaga. */
function star(b: PixelBuffer, x: number, y: number, r: number, tip: string): void {
  if (r <= 0) return;
  b.set(x, y, P.white);
  for (let i = 1; i <= r; i++)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      b.set(x + dx * i, y + dy * i, i === r ? tip : P.white);
}
const TWINKLE = [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0];

/** Si el icono se anima: los épicos, los legendarios y los legendarios propios. */
export const itemAnimates = (rarity: Rarity) => tierOf(rarity) >= 3;

/**
 * Los fotogramas de la animación del icono (`FRAMES`; el primero es el icono quieto). Los épicos,
 * un brillo morado que cruza; los legendarios, una estrella; los propios, la suya.
 */
export function itemFrames(
  icon: ItemIcon,
  rarity: Rarity = 0,
  plus = 0,
  unique?: string,
  size: 16 | 32 = 16,
): PixelBuffer[] {
  const still = itemIcon(icon, rarity, plus, unique, size);
  if (!itemAnimates(rarity)) return [still];
  const u = uniqueOf(rarity, unique);
  const key = `f:${icon}:${rarity}:${plus}:${u ?? ''}:${size}`;
  const hit = frameCache.get(key);
  if (hit) return hit;
  const k = size / 16;
  const out = Array.from({ length: FRAMES }, (_, f) => {
    if (f === 0) return still;
    if (u) {
      const { rows, pal } = legendFrame(u, f);
      let b = withPlus(fit(fromRows(rows, pal, k), size), `x:${key}:${f}`, plus);
      const shine = legendShine(u);
      if (shine === 'sweep') b = sweep(b, f, P.white);
      if (shine === 'twinkle') {
        b = b.clone();
        star(b, 4 * k, 7 * k, Math.min(1, TWINKLE[f]!), P.lime);
        star(b, 10 * k, 11 * k, Math.min(1, TWINKLE[(f + 4) % FRAMES]!), P.lime);
      }
      return b;
    }
    if (tierOf(rarity) === 3) return sweep(still, f, P.rose);
    const b = still.clone();
    star(b, b.w - 3 * k, b.h - 3 * k, TWINKLE[f]! * k, P.lemon);
    return b;
  });
  frameCache.set(key, out);
  return out;
}
const frameCache = new Map<string, PixelBuffer[]>();

/**
 * El icono pequeño (12 × 12) del tablero de la bodega y de lo que sale de los talleres, en la
 * escena (donde el de 16 no cabe en su hueco).
 */
export function rackIcon(icon: ItemIcon, rarity: Rarity = 0, plus = 0): PixelBuffer {
  return withPlus(rackPlain(icon, rarity), `r:${icon}:${rarity}`, plus);
}

function rackPlain(icon: ItemIcon, rarity: Rarity): PixelBuffer {
  const [m0, m1, m2] = RACK_METAL[rarity];
  const trim = RACK_TRIM[rarity];
  return make(`r:${icon}:${rarity}`, 12, 12, (b) => {
    switch (icon) {
      case 'espada':
        b.line(2, 9, 9, 2, m1);
        b.line(3, 9, 10, 2, m0);
        b.set(10, 1, m2);
        b.line(1, 7, 4, 10, trim);
        b.line(1, 10, 2, 9, P.bark);
        b.set(0, 11, trim);
        break;
      case 'hacha':
        b.line(2, 10, 8, 2, P.oak);
        b.line(3, 10, 9, 2, P.bark);
        b.rect(7, 1, 4, 5, m0);
        b.rect(8, 1, 3, 4, m1);
        b.vline(11, 1, 5, m2);
        break;
      case 'escudo':
        b.rect(2, 1, 8, 7, m0);
        b.rect(3, 8, 6, 2, m0);
        b.rect(4, 10, 4, 1, m0);
        b.rect(3, 2, 6, 6, P.wine);
        b.rect(5, 2, 2, 8, trim);
        b.rect(3, 4, 6, 2, trim);
        break;
      case 'coraza':
        b.rect(2, 2, 8, 8, m0);
        b.rect(3, 3, 3, 6, m1);
        b.rect(0, 2, 3, 3, m1);
        b.rect(9, 2, 3, 3, m0);
        b.rect(4, 1, 4, 1, P.black);
        b.hline(2, 9, 8, trim);
        break;
      case 'amuleto':
        b.line(2, 1, 6, 6, P.oak);
        b.line(10, 1, 6, 6, P.oak);
        b.rect(4, 6, 5, 5, trim);
        b.rect(5, 7, 3, 3, rarity === 1 ? P.cyan : P.wine);
        b.set(5, 7, P.white);
        break;
      case 'ganzua':
        b.hline(1, 3, 9, m1);
        b.hline(1, 6, 8, m0);
        b.hline(1, 9, 9, m1);
        b.set(10, 2, m1);
        b.set(9, 5, m0);
        b.set(10, 8, m1);
        b.rect(0, 2, 2, 9, P.wine);
        b.vline(1, 2, 9, trim);
        break;
      case 'botas':
        b.rect(2, 1, 4, 8, P.oak);
        b.rect(2, 8, 8, 3, P.oak);
        b.rect(3, 2, 2, 6, P.clay);
        b.hline(2, 10, 8, P.bark);
        b.hline(2, 3, 4, trim);
        break;
      case 'capa':
        b.rect(4, 0, 4, 2, trim);
        for (let y = 2; y < 12; y++) {
          const half = 2 + Math.floor(y / 3);
          b.hline(6 - half, y, half * 2, [P.mocha, P.ocean, P.wine][rarity]);
          b.set(6 - half, y, P.deep);
        }
        b.vline(6, 2, 9, [P.cocoa, P.sky, P.red][rarity]);
        break;
      case 'varita':
        b.line(2, 10, 8, 4, P.oak);
        b.line(3, 10, 9, 4, P.bark);
        b.rect(8, 1, 3, 3, rarity === 1 ? P.cyan : trim);
        b.set(9, 0, P.white);
        b.set(11, 2, P.white);
        break;
    }
  });
}

export function trophyIcon(icon: TrophyIcon): PixelBuffer {
  return make(`t:${icon}`, 14, 14, (b) => {
    switch (icon) {
      case 'cabeza':
        // Placa de madera y cabeza de bestia con orejas y colmillos.
        b.rect(3, 9, 8, 5, P.oak);
        b.hline(3, 9, 8, P.clay);
        b.rect(3, 2, 8, 7, P.umber);
        b.rect(2, 0, 2, 3, P.umber);
        b.rect(10, 0, 2, 3, P.umber);
        b.rect(5, 6, 4, 4, P.cocoa);
        b.set(4, 4, P.lemon);
        b.set(9, 4, P.lemon);
        b.set(5, 10, P.white);
        b.set(8, 10, P.white);
        b.rect(6, 6, 2, 1, P.black);
        break;
      case 'colmillos':
        b.rect(1, 9, 12, 4, P.oak);
        b.hline(1, 9, 12, P.clay);
        b.line(3, 9, 5, 1, P.sand);
        b.line(4, 9, 5, 2, P.white);
        b.line(10, 9, 8, 1, P.sand);
        b.line(9, 9, 8, 2, P.white);
        break;
      case 'estandarte':
        b.vline(1, 0, 14, P.oak);
        b.hline(1, 1, 11, P.oak);
        b.rect(2, 2, 10, 9, P.wine);
        b.rect(2, 11, 3, 2, P.wine);
        b.rect(9, 11, 3, 2, P.wine);
        b.rect(5, 4, 4, 4, P.black);
        b.set(6, 5, P.red);
        b.set(7, 5, P.red);
        break;
      case 'calavera':
        b.rect(3, 1, 8, 7, P.sand);
        b.rect(4, 8, 6, 3, P.sand);
        b.rect(4, 4, 2, 2, P.black);
        b.rect(8, 4, 2, 2, P.black);
        b.set(7, 7, P.black);
        b.hline(4, 10, 6, P.tan);
        b.rect(3, 0, 8, 1, P.gold);
        b.set(4, 0, P.lemon);
        b.rect(2, 12, 10, 2, P.oak);
        break;
      case 'idolo':
        b.rect(4, 1, 6, 10, P.leaf);
        b.rect(3, 3, 8, 3, P.leaf);
        b.rect(5, 2, 2, 8, P.lime);
        b.set(5, 4, P.lemon);
        b.set(8, 4, P.lemon);
        b.rect(6, 7, 2, 1, P.forest);
        b.rect(2, 11, 10, 3, P.steel);
        b.hline(2, 11, 10, P.fog);
        break;
      case 'mascara':
        b.rect(3, 2, 8, 9, P.white);
        b.rect(2, 4, 10, 4, P.white);
        b.rect(4, 4, 2, 2, P.black);
        b.rect(8, 4, 2, 2, P.black);
        b.line(4, 8, 6, 9, P.wine);
        b.line(7, 9, 9, 8, P.wine);
        b.vline(7, 1, 2, P.gold);
        b.hline(3, 2, 8, P.gold);
        break;
    }
  });
}

/** Las tijeras de la sastrería (el bocadillo de vestir a un héroe), 12×12. */
export function scissorsIcon(): PixelBuffer {
  return make('i:tijeras', 12, 12, (b) => {
    // Las dos hojas cruzadas y los ojos de los dedos abajo.
    b.line(2, 1, 7, 7, P.mist);
    b.line(3, 1, 8, 6, P.white);
    b.line(9, 1, 4, 7, P.fog);
    b.line(10, 1, 5, 6, P.mist);
    b.set(6, 6, P.slate);
    b.ellipse(3, 9, 2, 2, (_x, _y, d) => (d > 0.3 ? P.red : 0));
    b.ellipse(8, 9, 2, 2, (_x, _y, d) => (d > 0.3 ? P.red : 0));
  });
}
