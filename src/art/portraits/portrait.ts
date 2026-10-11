import type { HeroLook, HeroMarks, OutfitId } from '../heroes/look';
import { EYES as EYE_COLORS, HAIR, P, SKIN, type Ramp } from '../palette';
import { PixelBuffer, alpha } from '../pixel';
import {
  BANDAGE,
  BEARDS,
  BLUSH,
  BROWS,
  EYEPATCH,
  EYES,
  FRECKLES,
  HAIR_BACK,
  HAIR_FRONT,
  HEADGEAR,
  HEADS,
  LIPS,
  MOUTHS,
  NOSE_BIG,
  OUTFITS,
  SCAR,
  H,
  TOP,
  W,
  toGrid,
  type Part,
} from './parts';

/**
 * Retratos de 40×48 montados con piezas dibujadas a mano (ver parts.ts):
 * se apilan como capas, se recolorean con la paleta del héroe y se contornean.
 */

export const PORTRAIT_W = W;
export const PORTRAIT_H = H;
export const PORTRAIT_BG = P.plum;

type Slots = Record<string, string>;

/** Ropa: [principal a b c d, secundaria A B C D]. */
const CLASS: Record<OutfitId, [Ramp, Ramp]> = {
  guerrero: [
    [P.plum, P.wine, P.red, P.coral],
    [P.rust, P.orange, P.gold, P.lemon],
  ],
  picaro: [
    [P.black, P.plum, P.grape, P.rose],
    [P.black, P.bark, P.rust, P.oak],
  ],
  mago: [
    [P.black, P.navy, P.ocean, P.sky],
    [P.rust, P.orange, P.gold, P.lemon],
  ],
  clerigo: [
    [P.slate, P.fog, P.mist, P.white],
    [P.navy, P.ocean, P.sky, P.lemon],
  ],
  explorador: [
    [P.black, P.forest, P.leaf, P.lime],
    [P.plum, P.bark, P.rust, P.oak],
  ],
  tabernero: [
    [P.rust, P.tan, P.sand, P.white],
    [P.plum, P.bark, P.rust, P.oak],
  ],
};

function slots(look: HeroLook): Slots {
  const skin = SKIN[look.skin] ?? SKIN[0]!;
  const hair = HAIR[look.hairColor] ?? HAIR[0]!;
  const eye = EYE_COLORS[look.eyes] ?? EYE_COLORS[0]!;
  const [cloth, trim] = CLASS[look.outfit];
  const lip =
    look.sex === 'f' ? ([P.coral, P.rose, P.rose, P.wine][look.skin] ?? P.rose) : skin[1]!;
  return {
    S: skin[0]!,
    s: skin[1]!,
    t: skin[2]!,
    u: skin[3]!,
    v: skin[4]!,
    h: hair[0]!,
    i: hair[1]!,
    j: hair[2]!,
    l: hair[hair.length - 1]!,
    w: P.mist,
    x: eye[1]!,
    y: eye[0]!,
    W: P.white,
    r: lip,
    a: cloth[0]!,
    b: cloth[1]!,
    c: cloth[2]!,
    d: cloth[3]!,
    A: trim[0]!,
    B: trim[1]!,
    C: trim[2]!,
    D: trim[3]!,
    m: P.slate,
    n: P.steel,
    o: P.fog,
    p: P.mist,
    k: P.black,
    R: P.red,
    K: P.plum,
    L: P.bark,
  };
}

const grids = new Map<Part, string[]>();
function gridOf(part: Part): string[] {
  let g = grids.get(part);
  if (!g) {
    g = toGrid(part);
    grids.set(part, g);
  }
  return g;
}

/** Estampa una pieza; `fromRow` (en filas de pieza) recorta lo que queda por encima. */
function stamp(b: PixelBuffer, part: Part, colors: Slots, fromRow = -TOP): void {
  const g = gridOf(part);
  for (let y = Math.max(0, fromRow + TOP); y < H; y++) {
    const row = g[y]!;
    for (let x = 0; x < W; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const c = colors[ch];
      if (c) b.set(x, y, c);
    }
  }
}

/**
 * Fondo: un halo cálido detrás de la cabeza que se apaga hacia los bordes,
 * con transiciones en damero de dos píxeles, como en los retratos de los RPG clásicos.
 */
let bg: PixelBuffer | null = null;
function backdrop(): PixelBuffer {
  if (bg) return bg;
  bg = new PixelBuffer(W, H);
  const ramp = [P.ebony, PORTRAIT_BG, P.bark];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 20, (y - TOP - 14) * 0.9);
      const odd = (x + y) & 1;
      const lv = d < 13 ? 2 : d < 15 ? 1 + odd : d < 22 ? 1 : d < 24 ? odd : 0;
      bg.set(x, y, ramp[lv]!);
    }
  }
  return bg;
}

const cache = new Map<string, PixelBuffer>();

export function renderPortrait(look: HeroLook, marks: HeroMarks = {}, blink = false): PixelBuffer {
  const key = JSON.stringify([look, marks, blink]);
  const hit = cache.get(key);
  if (hit) return hit;

  const c = slots(look);
  const fig = new PixelBuffer(W, H);
  const hg = marks.injured && look.headgear === 'casco' ? null : look.headgear;
  const hair = look.hairStyle;

  // Detrás de todo: melena y coleta.
  if (hg !== 'capucha') {
    if (hair === 'largo') stamp(fig, HAIR_BACK.largo, c);
    if (hair === 'coleta') stamp(fig, HAIR_BACK.coleta, c);
  }
  stamp(fig, HEADS[look.sex], c);
  stamp(fig, OUTFITS[look.outfit], c);

  // Cara.
  const eyes = blink
    ? EYES.cerrado
    : look.sex === 'f'
      ? EYES.grande
      : look.brow === 'fruncida'
        ? EYES.entornado
        : EYES.normal;
  stamp(fig, eyes, c);
  const brow = look.sex === 'm' && look.brow === 'recta' ? BROWS.gruesa : BROWS[look.brow];
  stamp(fig, brow, c);
  if (look.sex === 'm' && look.face === 'alargada') stamp(fig, NOSE_BIG, c);
  stamp(fig, MOUTHS[look.mouth], c);
  if (look.sex === 'f') stamp(fig, LIPS, c);
  if (look.sex === 'f' && look.skin < 2) stamp(fig, BLUSH, c);
  if (look.freckles) stamp(fig, FRECKLES, c);
  if (look.scar) stamp(fig, SCAR, c);
  if (look.beard) stamp(fig, look.face === 'alargada' ? BEARDS.perilla : BEARDS.barba, c);

  // Pelo por delante, recortado por el sombrero.
  const front = HAIR_FRONT[hair];
  if (hg === 'casco') stamp(fig, front, c, 14);
  else if (hg === 'sombrero') stamp(fig, front, c, 12);
  else if (hg === 'gorra') stamp(fig, front, c, 10);
  else if (hg !== 'capucha') stamp(fig, front, c);
  if (hg) stamp(fig, HEADGEAR[hg], c);

  if (marks.eyepatch) stamp(fig, EYEPATCH, c);
  if (marks.injured) stamp(fig, BANDAGE, c);

  // Fondo con halo y contorno oscuro alrededor de la figura.
  const out = backdrop().clone();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = fig.get(x, y);
      if (alpha(px)) {
        out.data[y * W + x] = px;
        continue;
      }
      if (
        alpha(fig.get(x - 1, y)) ||
        alpha(fig.get(x + 1, y)) ||
        alpha(fig.get(x, y - 1)) ||
        alpha(fig.get(x, y + 1))
      ) {
        out.set(x, y, P.black);
      }
    }
  }
  cache.set(key, out);
  return out;
}
