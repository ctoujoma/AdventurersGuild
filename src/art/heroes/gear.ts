import type { ItemIcon, Rarity } from '../../core/model';
import { TINTS, type TintId } from '../../data/custom';
import { P } from '../palette';
import { alpha, type PixelBuffer } from '../pixel';
import { ACCENT, BOOT, CLOTH, FIELD, METAL, TRIM, tierOf } from '../tiers';

/**
 * El equipo que lleva el héroe (una pieza por ranura: arma, cuerpo y complemento), pintado encima
 * (o por detrás) de su sprite y de su retrato: coraza con peto y hombreras, capa, amuleto al
 * cuello, espada o hacha a la espalda, escudo, varita, botas y bandolera de ganzúas. El nivel
 * (`tiers.ts`) pone el metal y el color de gemas, telas y campos; los legendarios propios
 * (`unique`, el nombre del objeto) llevan su detalle, y la Corona del Rey Ahogado va en la cabeza,
 * en lugar del sombrero.
 */

export interface GearMark {
  icon: ItemIcon;
  rarity: Rarity;
  /** El nombre del objeto, para los legendarios con dibujo propio. */
  unique?: string;
  /** El tinte del héroe: la capa común es de ese color. */
  dye?: TintId;
}
/** Lo que lleva puesto: una pieza (partidas y peleas antiguas) o las de cada ranura. */
export type GearMarks = GearMark | readonly GearMark[];

const CROWN = 'Corona del Rey Ahogado';
const listOf = (g?: GearMarks): readonly GearMark[] =>
  !g ? [] : Array.isArray(g) ? g : [g as GearMark];
/** Las piezas con el tinte del héroe (la capa común lo toma). */
export function withDye(g: GearMarks | undefined, dye: TintId | undefined): GearMark[] | undefined {
  const l = listOf(g);
  return l.length ? l.map((p) => ({ ...p, dye })) : undefined;
}
/** Si lleva algún legendario (le salen destellos en la escena). */
export const hasLegend = (g?: GearMarks) => listOf(g).some((p) => p.rarity === 4);
/** Si lleva la corona (que va en la cabeza, en lugar del sombrero). */
export const wearsCrown = (g?: GearMarks) => listOf(g).some((p) => p.unique === CROWN);

interface Tones {
  m: readonly string[];
  t: readonly string[];
  a: readonly string[];
  c: readonly string[];
  f: readonly string[];
  boot: string;
  tier: number;
  u?: string;
}
function tones(p: GearMark): Tones {
  const k = tierOf(p.rarity);
  const base: Tones = {
    m: METAL[k]!,
    t: TRIM[k]!,
    a: ACCENT[k]!,
    c: CLOTH[k]!,
    f: FIELD[k]!,
    boot: BOOT[k]!,
    tier: k,
    u: p.rarity === 4 ? p.unique : undefined,
  };
  // La capa común, del color del tinte del héroe.
  if (k === 0 && p.dye) {
    const r = TINTS[p.dye].ramp;
    base.c = [r[1]!, r[2]!, r[3]!];
  }
  switch (base.u) {
    case 'Hoja de Vadoverde':
      return {
        ...base,
        m: [P.steel, P.fog, P.mist, P.white],
        a: [P.forest, P.lime],
        t: [P.forest, P.leaf],
      };
    case 'Capa élfica':
      return {
        ...base,
        c: [P.deep, P.forest, P.leaf],
        t: [P.steel, P.mist],
        a: [P.leaf, P.lime],
        m: [P.steel, P.fog, P.mist, P.white],
      };
    case 'Varita de la Abuela Tormenta':
      return { ...base, a: [P.fog, P.lemon] };
    case 'Botas de siete leguas':
      return { ...base, boot: P.clay, a: [P.wine, P.red] };
    case 'Coraza de escamas de sierpe':
      return { ...base, a: [P.forest, P.leaf] };
    case 'Capa de piel de ceniza':
      return { ...base, c: [P.slate, P.steel, P.fog], a: [P.orange, P.gold] };
    case 'Cetro de la Reina':
      return { ...base, m: [P.fog, P.mist, P.white, P.white], a: [P.sky, P.cyan] };
    case 'Escudo de escama blanca':
      return {
        ...base,
        m: [P.fog, P.mist, P.white, P.white],
        f: [P.mist, P.white],
        a: [P.sky, P.cyan],
      };
  }
  return base;
}

/** Filete del tinte (tela o cuero, nunca el metal); los legendarios propios no lo llevan. */
function dyeLine(p: GearMark): string | undefined {
  return p.dye && !p.unique ? TINTS[p.dye].ramp[2] : undefined;
}

function under(b: PixelBuffer, x: number, y: number, c: string) {
  if (!alpha(b.get(x, y))) b.set(x, y, c);
}
function line(
  b: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: string,
  back: boolean,
) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n),
      y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (back) under(b, x, y, c);
    else b.set(x, y, c);
  }
}
const ORDER = [
  'capa',
  'espada',
  'hacha',
  'escudo',
  'coraza',
  'botas',
  'amuleto',
  'ganzua',
  'varita',
];
const sorted = (g: GearMarks) =>
  [...listOf(g)].sort((a, b) => ORDER.indexOf(a.icon) - ORDER.indexOf(b.icon));

// ---------- Figura de frente (16 × 26) ----------
function crownSprite(b: PixelBuffer) {
  // Sobre la cabeza (filas 1–4), oro gastado con perlas y algas.
  const rows = ['p..p..p.', 'g..gg..g', 'gGgGGgGg', 'oeooeooo', '.e....e.'];
  const pal: Record<string, string> = { p: P.mist, g: P.gold, G: P.lemon, o: P.amber, e: P.leaf };
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (pal[ch]) b.set(4 + x, 1 + y, pal[ch]!);
    }),
  );
}

function pieceFront(b: PixelBuffer, p: GearMark) {
  const T = tones(p);
  const { m, a, c } = T;
  const dy = dyeLine(p);
  switch (p.icon) {
    case 'coraza':
      for (let y = 13; y <= 17; y++)
        for (let x = 5; x <= 10; x++) {
          let col = y === 13 || x === 5 ? m[2]! : m[1]!;
          if (T.u === 'Coraza de escamas de sierpe') col = (x + y) % 2 ? P.forest : P.leaf;
          else if (dy && (y === 17 || x === 5 || x === 10)) col = dy;
          b.setIfFilled(x, y, col);
        }
      b.setIfFilled(3, 13, T.u ? P.gold : m[2]!);
      b.setIfFilled(12, 13, T.u ? P.gold : m[2]!);
      if (T.tier >= 1 && !T.u) {
        b.setIfFilled(7, 15, a[0]!);
        b.setIfFilled(8, 15, a[1]!);
      }
      break;
    case 'capa':
      for (let y = 12; y <= 23; y++) {
        const w = y < 15 ? 0 : 1;
        under(b, 2 - w, y, c[0]!);
        under(b, 3 - w, y, c[1]!);
        under(b, 12 + w, y, c[1]!);
        under(b, 13 + w, y, c[0]!);
        under(b, 2, y, c[1]!);
        under(b, 13, y, c[1]!);
      }
      if (T.u === 'Capa de piel de ceniza') for (const x of [3, 4, 11, 12]) b.set(x, 12, P.mist);
      b.setIfFilled(7, 12, T.tier >= 1 ? a[1]! : m[2]!);
      break;
    case 'amuleto':
      b.setIfFilled(6, 13, P.ebony);
      b.setIfFilled(9, 13, P.ebony);
      b.setIfFilled(7, 14, m[2]!);
      b.setIfFilled(8, 14, m[1]!);
      b.setIfFilled(7, 15, a[1]!);
      b.setIfFilled(8, 15, a[0]!);
      break;
    case 'botas':
      for (let y = 22; y <= 25; y++)
        for (let x = 2; x <= 13; x++) b.setIfFilled(x, y, y === 22 ? T.t[1]! : T.boot);
      if (T.u === 'Botas de siete leguas') {
        b.set(1, 21, P.white);
        b.set(0, 20, P.white);
        b.set(14, 21, P.white);
        b.set(15, 20, P.white);
      }
      break;
    case 'espada':
    case 'hacha':
      line(b, 13, 14, 13, 5, m[1]!, true);
      line(b, 14, 13, 14, 6, m[2]!, true);
      if (p.icon === 'hacha') {
        for (let y = 4; y <= 7; y++)
          for (let x = 11; x <= 15; x++) under(b, x, y, m[y === 4 ? 2 : 1]!);
      } else {
        line(b, 11, 12, 15, 12, T.u ? P.leaf : T.t[1]!, true);
        under(b, 13, 4, T.tier >= 1 ? a[1]! : m[3]!);
      }
      break;
    case 'escudo':
      for (let y = 14; y <= 21; y++)
        for (let x = 0; x <= 4; x++) {
          if (y >= 20 && (x === 0 || x === 4)) continue;
          if (y === 21 && x !== 2) continue;
          const edge = y === 14 || x === 0 || x === 4 || y >= 20;
          const inner = dy && !edge && (y >= 18 ? x !== 2 || y === 19 : false);
          b.set(x, y, edge ? m[2]! : inner ? dy : T.f[x < 2 ? 1 : 0]!);
        }
      if (!T.u) {
        b.set(2, 15, T.t[1]!);
        b.set(2, 16, T.t[1]!);
        b.set(2, 17, T.t[1]!);
        b.set(1, 16, T.t[1]!);
        b.set(3, 16, T.t[1]!);
      } else b.set(2, 16, a[1]!);
      break;
    case 'varita': {
      const staff = T.u === 'Cetro de la Reina' ? P.mist : P.oak;
      line(b, 13, 20, 14, 15, staff, false);
      if (T.u === 'Varita de la Abuela Tormenta') {
        b.set(13, 13, P.fog);
        b.set(14, 13, P.fog);
        b.set(15, 13, P.fog);
        b.set(14, 14, P.lemon);
        b.set(14, 12, P.steel);
      } else {
        b.set(14, 14, a[1]!);
        b.set(15, 13, P.white);
      }
      break;
    }
    case 'ganzua':
      b.setIfFilled(10, 18, P.oak);
      b.setIfFilled(11, 18, P.oak);
      b.setIfFilled(11, 19, m[2]!);
      break;
  }
}

export function gearFront(b: PixelBuffer, g: GearMarks): void {
  for (const p of sorted(g)) pieceFront(b, p);
  if (wearsCrown(g)) crownSprite(b);
}
export function gearSide(b: PixelBuffer, g: GearMarks): void {
  for (const p of sorted(g)) {
    const T = tones(p);
    const { m, a, c } = T;
    const dy = dyeLine(p);
    switch (p.icon) {
      case 'coraza':
        for (let y = 13; y <= 16; y++)
          for (let x = 5; x <= 10; x++) {
            const rim = dy && y > 13 && (y === 16 || x === 5 || x === 10);
            b.setIfFilled(x, y, rim ? dy : y === 13 ? m[2]! : m[1]!);
          }
        break;
      case 'capa':
        for (let y = 12; y <= 23; y++) {
          under(b, 3, y, c[0]!);
          under(b, 4, y, c[1]!);
          if (y > 16) under(b, 2, y, c[0]!);
        }
        break;
      case 'amuleto':
        b.setIfFilled(10, 14, a[1]!);
        break;
      case 'botas':
        for (let y = 22; y <= 25; y++)
          for (let x = 2; x <= 14; x++) b.setIfFilled(x, y, y === 22 ? T.t[1]! : T.boot);
        break;
      case 'espada':
      case 'hacha':
        line(b, 3, 18, 5, 6, m[1]!, true);
        line(b, 2, 17, 4, 6, m[2]!, true);
        break;
      case 'escudo':
        for (let y = 12; y <= 19; y++)
          for (let x = 1; x <= 4; x++)
            under(b, x, y, x === 1 || y === 12 || y === 19 ? m[2]! : dy && x === 2 ? dy : T.f[0]!);
        break;
      case 'varita':
        b.setIfFilled(12, 19, a[1]!);
        break;
      case 'ganzua':
        b.setIfFilled(6, 18, P.oak);
        break;
    }
  }
  if (wearsCrown(g)) crownSprite(b);
}

// ---------- Retrato (40 × 48) ----------
export function gearPortraitBack(b: PixelBuffer, g: GearMarks): void {
  for (const p of sorted(g)) {
    const T = tones(p);
    const { m, a, c } = T;
    switch (p.icon) {
      case 'espada':
        line(b, 25, 47, 33, 30, m[1]!, false);
        line(b, 26, 47, 34, 30, m[2]!, false);
        line(b, 30, 28, 37, 31, T.u ? P.leaf : T.t[1]!, false);
        if (T.u) {
          b.set(29, 27, P.lime);
          b.set(38, 32, P.lime);
          b.set(29, 28, P.leaf);
          b.set(38, 31, P.leaf);
        }
        line(b, 34, 28, 36, 23, P.oak, false);
        b.set(36, 22, T.tier >= 1 ? a[1]! : T.t[1]!);
        b.set(37, 22, T.tier >= 1 ? a[0]! : T.t[0]!);
        break;
      case 'hacha':
        line(b, 25, 47, 34, 22, P.oak, false);
        for (let y = 18; y <= 26; y++)
          for (let x = 33; x <= 39; x++) {
            const d = Math.abs(y - 22) + Math.max(0, x - 36);
            if (d < 5) b.set(x, y, d === 4 || x === 39 ? m[3]! : m[1]!);
          }
        if (T.tier >= 1) b.set(34, 22, a[1]!);
        break;
      case 'capa':
        for (let y = 36; y < 48; y++)
          for (let x = 0; x < 40; x++) {
            const edge = Math.abs(x - 20) > 18 - (y - 36) * 0.4;
            if (!edge) b.set(x, y, (x + y) % 7 === 0 ? c[0]! : c[1]!);
          }
        break;
    }
  }
}

function crownPortrait(b: PixelBuffer) {
  const rows = [
    '..p.......p.......p..',
    '..g......gGg......g..',
    '.gGg....gGGGg....gGg.',
    '.gGGg..gGGGGGg..gGGg.',
    '.gGGGggGGGGGGGggGGGo.',
    '.ggGGGGGGGGGGGGGGGgo.',
    '.oeooaoeooooeoaooeoo.',
    '.ooooooooooooooooooo.',
    '..e......e.....e.....',
    '..e............e.....',
  ];
  const pal: Record<string, string> = {
    p: P.mist,
    g: P.gold,
    G: P.lemon,
    o: P.amber,
    e: P.leaf,
    a: P.mist,
  };
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (pal[ch]) b.set(10 + x, 4 + y, pal[ch]!);
    }),
  );
}

export function gearPortraitFront(b: PixelBuffer, g: GearMarks): void {
  for (const p of sorted(g)) {
    const T = tones(p);
    const { m, a } = T;
    const dy = dyeLine(p);
    switch (p.icon) {
      case 'coraza': {
        const scales = T.u === 'Coraza de escamas de sierpe';
        // El peto: placa sobre el pecho, con nervio, y las hombreras.
        for (let y = 40; y < 48; y++)
          for (let x = 13; x <= 26; x++) {
            const ins = x >= 14 + Math.max(0, 42 - y) && x <= 25 - Math.max(0, 42 - y);
            if (!ins) continue;
            let col = x === 19 || x === 20 ? m[3]! : x < 19 ? m[2]! : m[1]!;
            // Filete justo dentro del borde del peto.
            const lo = 14 + Math.max(0, 42 - y),
              hi = 25 - Math.max(0, 42 - y);
            if (dy && (x === lo + 1 || x === hi - 1 || (y === 41 && x > lo && x < hi))) col = dy;
            if (scales)
              col =
                (x + (Math.floor((y - 40) / 2) % 2 ? 2 : 0)) % 4 === 0
                  ? P.deep
                  : y % 2
                    ? P.forest
                    : P.leaf;
            b.set(x, y, col);
          }
        for (const cx of [6, 33])
          for (let y = 38; y < 48; y++)
            for (let x = cx - 7; x <= cx + 7; x++) {
              const d = Math.hypot((x - cx) * 0.8, y - 44);
              if (d < 6.5)
                b.set(
                  x,
                  y,
                  scales ? (d > 5.3 ? P.amber : P.gold) : d > 5.3 ? m[0]! : y < 42 ? m[2]! : m[1]!,
                );
            }
        if (T.tier >= 1 && !scales) {
          b.set(19, 44, a[1]!);
          b.set(20, 44, a[0]!);
          b.set(19, 45, a[0]!);
          b.set(20, 45, a[0]!);
        }
        if (T.tier >= 2 && !scales)
          for (const [x, y] of [
            [3, 41],
            [9, 41],
            [30, 41],
            [36, 41],
          ] as const)
            b.set(x, y, m[3]!);
        break;
      }
      case 'capa':
        if (T.u === 'Capa de piel de ceniza')
          for (let x = 2; x <= 37; x++) {
            if (x > 13 && x < 26) continue;
            const h = 38 + ((x * 7) % 3);
            for (let y = h; y <= 41; y++) b.set(x, y, (x + y) % 3 ? P.mist : P.fog);
          }
        for (let y = 41; y <= 43; y++) for (let x = 19; x <= 21; x++) b.set(x, y, m[1]!);
        b.set(20, 42, T.tier >= 1 ? a[1]! : m[3]!);
        break;
      case 'escudo': {
        // Grande y en primer plano: solo asoma la esquina de arriba, con parte de la cruz.
        const white = T.u === 'Escudo de escama blanca';
        const cx = 1,
          top = 35,
          half = 12;
        for (let y = top; y <= 47; y++)
          for (let x = 0; x <= cx + half; x++) {
            const dx = Math.abs(x - cx);
            const round = y < top + 3 ? half - (top + 3 - y) * 0.7 : half;
            if (dx > round) continue;
            const edge = dx > round - 2 || y < top + 2;
            let col = edge
              ? y < top + 1 || x > cx + half - 1
                ? m[3]!
                : m[2]!
              : dy && (dx > round - 3 || y < top + 3)
                ? dy
                : T.f[y < 41 ? 1 : 0]!;
            if (!edge && !white && (Math.abs(x - cx) < 2 || Math.abs(y - 42) < 1.5))
              col = T.tier === 0 ? P.steel : T.t[1]!;
            if (white && !edge && Math.abs(dx - (round - 4)) < 0.6) col = P.cyan;
            if (white && !edge && Math.abs(y - (top + 5)) < 0.6) col = P.cyan;
            b.set(x, y, col);
          }
        if (!white && T.tier >= 2)
          for (const [x, y] of [
            [10, 37],
            [11, 44],
          ] as const)
            b.set(x, y, m[3]!);
        if (T.tier >= 1 && !white) {
          b.set(1, 42, a[1]!);
          b.set(2, 42, a[0]!);
        }
        break;
      }
      case 'amuleto':
        line(b, 15, 39, 19, 43, m[0]!, false);
        line(b, 25, 39, 21, 43, m[0]!, false);
        for (let y = 43; y <= 47; y++)
          for (let x = 18; x <= 22; x++) {
            const d = Math.abs(x - 20) + Math.abs(y - 45);
            if (d <= 2) b.set(x, y, d === 2 ? m[2]! : d === 1 ? a[0]! : a[1]!);
          }
        b.set(19, 44, P.white);
        break;
      case 'ganzua':
        // Bandolera de cuero cruzada con las ganzúas.
        line(b, 12, 38, 24, 47, P.bark, false);
        line(b, 13, 38, 25, 47, P.oak, false);
        for (const [x, y] of [
          [16, 41],
          [19, 43],
          [22, 45],
        ] as const) {
          b.set(x, y - 1, m[2]!);
          b.set(x, y - 2, m[3]!);
        }
        if (T.tier >= 1) b.set(18, 42, a[1]!);
        break;
      case 'varita': {
        const queen = T.u === 'Cetro de la Reina',
          storm = T.u === 'Varita de la Abuela Tormenta';
        line(b, 35, 47, 31, 37, queen ? P.mist : P.oak, false);
        line(b, 36, 47, 32, 37, queen ? P.fog : P.bark, false);
        if (storm) {
          for (let y = 31; y <= 36; y++)
            for (let x = 27; x <= 36; x++) {
              const d = Math.hypot((x - 31.5) * 0.7, y - 33.5);
              if (d < 2.9) b.set(x, y, d > 2 ? P.steel : P.fog);
            }
          b.set(31, 33, P.lemon);
          b.set(32, 34, P.lemon);
          b.set(31, 35, P.lemon);
        } else {
          b.set(31, 36, a[0]!);
          b.set(30, 35, P.white);
          b.set(32, 35, a[1]!);
          b.set(31, 35, a[1]!);
          b.set(31, 34, a[1]!);
          if (queen) {
            b.set(29, 34, P.white);
            b.set(33, 34, P.white);
            b.set(31, 33, P.cyan);
          }
        }
        break;
      }
    }
  }
  if (wearsCrown(g)) crownPortrait(b);
}

// ---------- Brillos del retrato ----------

/** Dónde brilla cada pieza en el retrato. */
const SHINE_AT: Partial<Record<ItemIcon, [number, number]>> = {
  espada: [36, 21],
  hacha: [37, 17],
  varita: [33, 33],
  escudo: [10, 37],
  coraza: [9, 40],
  capa: [23, 40],
  amuleto: [23, 44],
};
const TWINKLE = [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0];

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

/** Si el retrato tiene algo que brille (épicos y legendarios). */
export const portraitShines = (g?: GearMarks) => listOf(g).some((p) => tierOf(p.rarity) >= 3);

/**
 * El retrato en el fotograma `f` de su brillo (0, quieto): una estrella en cada pieza épica
 * (morada) o legendaria (dorada); la corona destella, la nube de la Abuela Tormenta relampaguea y
 * las brasas de la capa de ceniza se avivan.
 */
export function portraitShine(src: PixelBuffer, g: GearMarks | undefined, f: number): PixelBuffer {
  const l = listOf(g).filter((p) => tierOf(p.rarity) >= 3);
  if (!f || !l.length) return src;
  const b = src.clone();
  l.forEach((p, i) => {
    const r = TWINKLE[(f + i * 3) % TWINKLE.length]!;
    const tip = tierOf(p.rarity) === 4 ? P.lemon : P.rose;
    const u = p.rarity === 4 ? p.unique : undefined;
    if (u === CROWN) return star(b, 13, 6, r, P.lemon);
    if (u === 'Varita de la Abuela Tormenta') {
      if (f === 3 || f === 5)
        for (let y = 30; y <= 36; y++)
          for (let x = 27; x <= 36; x++)
            if (Math.hypot((x - 31.5) * 0.7, y - 33.5) < 2.9) b.set(x, y, P.white);
      return;
    }
    if (u === 'Capa de piel de ceniza') {
      const e = [P.rust, P.orange, P.gold, P.lemon, P.gold, P.orange][Math.min(5, f >> 1)]!;
      for (const [x, y] of [
        [8, 40],
        [31, 39],
        [35, 41],
      ] as const)
        b.set(x, y, e);
      return;
    }
    const at = SHINE_AT[p.icon];
    if (at) star(b, at[0], at[1], r, tip);
  });
  return b;
}
