import { HAIR, P, SKIN, darker } from '../palette';
import { PixelBuffer, alpha, toHex } from '../pixel';
import type { Grid } from '../sprite';
import {
  BASE,
  BEARD,
  BODY_H,
  BODY_W,
  HAIR as FRONT_HAIR,
  HATS,
  HEADROOM,
  HELMS,
  OUTFITS,
  OVERLAYS,
  WEAPONS,
} from './layers';
import {
  SIDE_ARM,
  SIDE_ARM_THRUST,
  SIDE_ARM_UP,
  SIDE_BASE,
  SIDE_BEARD,
  SIDE_HAIR,
  SIDE_HATS,
  SIDE_HELMS,
  SIDE_LEGS,
  SIDE_ROBE,
  SIDE_TORSO,
  SIDE_WEAPONS,
} from './layersSide';
import type { HeroLook, HeroMarks, OutfitId } from './look';

export { generateLook } from './look';
export type { HeroLook, HeroMarks, OutfitId, Sex } from './look';

/** Sprite final: 16×26 de dibujo + 1 px de contorno a cada lado. */
export const SPRITE_W = BODY_W + 2;
export const SPRITE_H = BODY_H + HEADROOM + 2;
/** Fila de los pies dentro del sprite (para apoyarlo en el suelo). */
export const FEET_Y = SPRITE_H - 2;

export interface HeroSprites {
  /** De frente: respiración en dos tiempos. */
  idle: [PixelBuffer, PixelBuffer];
  blink: PixelBuffer;
  /** De perfil mirando a la derecha: ciclo de 4 pasos. */
  walk: PixelBuffer[];
  /** Sentado tras una mesa: de cintura para arriba. */
  sit: PixelBuffer;
  /** Cabeza con venda para pintarla en la almohada. */
  bed: PixelBuffer;
}

type Slots = Record<string, string>;

const CLASS: Record<OutfitId, Slots> = {
  guerrero: {
    c: P.red,
    C: P.wine,
    a: P.gold,
    A: P.orange,
    o: P.rust,
    O: P.plum,
    p: P.wine,
    P: P.plum,
    q: P.steel,
    Q: P.slate,
  },
  picaro: {
    c: P.grape,
    C: P.plum,
    a: P.rust,
    A: P.bark,
    o: P.bark,
    O: P.black,
    p: P.plum,
    P: P.black,
    q: P.grape,
    Q: P.plum,
  },
  mago: {
    c: P.ocean,
    C: P.navy,
    a: P.gold,
    A: P.orange,
    o: P.rust,
    O: P.plum,
    p: P.navy,
    P: P.black,
    q: P.ocean,
    Q: P.navy,
  },
  clerigo: {
    c: P.mist,
    C: P.fog,
    a: P.gold,
    A: P.orange,
    o: P.rust,
    O: P.plum,
    p: P.fog,
    P: P.steel,
    q: P.mist,
    Q: P.fog,
  },
  explorador: {
    c: P.leaf,
    C: P.forest,
    a: P.oak,
    A: P.rust,
    o: P.rust,
    O: P.plum,
    p: P.bark,
    P: P.plum,
    q: P.leaf,
    Q: P.forest,
  },
  tabernero: {
    c: P.sand,
    C: P.tan,
    a: P.clay,
    A: P.rust,
    o: P.rust,
    O: P.plum,
    p: P.bark,
    P: P.plum,
    q: P.sand,
    Q: P.tan,
  },
};

const SHARED: Slots = {
  m: P.steel,
  M: P.mist,
  e: P.black,
  k: P.black,
  n: P.white,
  r: P.red,
  v: P.oak,
  V: P.clay,
  g: P.cyan,
  G: P.white,
  y: P.gold,
  Y: P.orange,
  w: P.white,
};

function slots(look: HeroLook): Slots {
  const skin = SKIN[look.skin] ?? SKIN[0]!;
  const hair = HAIR[look.hairColor] ?? HAIR[0]!;
  return { ...SHARED, ...CLASS[look.outfit], x: skin[3]!, X: skin[2]!, h: hair[2]!, H: hair[1]! };
}

function stamp(
  buf: PixelBuffer,
  grid: Grid,
  colors: Slots,
  dx: number,
  dy: number,
  swap = false,
): void {
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      let ch = row[x]!;
      if (ch === '.') continue;
      if (swap && (ch === 'p' || ch === 'P')) ch = ch === 'p' ? 'P' : 'p';
      const c = colors[ch];
      if (c) buf.set(dx + x, dy + y, c);
    }
  });
}

/** Contorno selectivo: un tono bastante más oscuro que el píxel vecino. */
function selOut(raw: PixelBuffer): PixelBuffer {
  return raw.outlined((n) => darker(toHex(n), 3));
}

const withBlink = (grid: Grid, eyeRows: [number, number]): Grid =>
  grid.map((row, y) => (y === eyeRows[0] ? row.replace(/e/g, 'x') : row));

function headgearOf(look: HeroLook, marks: HeroMarks) {
  return marks.injured && look.headgear === 'casco' ? null : look.headgear;
}

function composeFront(
  look: HeroLook,
  marks: HeroMarks,
  blink: boolean,
  noHat = false,
): PixelBuffer {
  const c = slots(look);
  const b = new PixelBuffer(BODY_W, BODY_H + HEADROOM);
  const body = (g: Grid, from = 0) => stamp(b, g.slice(from), c, 0, HEADROOM + from);
  const hg = noHat ? null : headgearOf(look, marks);
  body(blink ? withBlink(BASE, [5, 6]) : BASE);
  body(OUTFITS[look.outfit]);
  if (look.beard && hg !== 'capucha') body(BEARD);
  if (hg === 'capucha') body(HELMS.capucha);
  else if (hg === 'casco') {
    body(FRONT_HAIR[look.hairStyle], 5);
    body(HELMS.casco);
  } else {
    body(FRONT_HAIR[look.hairStyle]);
    if (hg) stamp(b, HATS[hg], c, 0, 0);
  }
  if (marks.eyepatch) body(OVERLAYS.parche);
  if (marks.injured && hg !== 'sombrero' && hg !== 'gorra') body(OVERLAYS.venda);
  body(WEAPONS[look.outfit]);
  return b;
}

/** Respiración: cabeza y pecho bajan un píxel; caderas y piernas se quedan quietas. */
function breathe(src: PixelBuffer): PixelBuffer {
  const out = src.clone();
  const split = HEADROOM + 15;
  for (let y = split + 1; y >= 1; y--) {
    for (let x = 0; x < src.w; x++) {
      const from = src.get(x, y - 1);
      if (alpha(from)) out.data[y * src.w + x] = from;
      else if (y <= split) out.clear(x, y);
    }
  }
  for (let x = 0; x < src.w; x++) out.clear(x, 0);
  return out;
}

type Step = 0 | 1 | 2 | 3;

function composeSide(
  look: HeroLook,
  marks: HeroMarks,
  step: Step | 'stand',
  blink: boolean,
  fight?: FightPose,
): PixelBuffer {
  const c = slots(look);
  const b = new PixelBuffer(BODY_W, BODY_H + HEADROOM);
  const robe = look.outfit === 'mago' || look.outfit === 'clerigo';
  const contact = step === 0 || step === 2;
  const bob = contact ? 1 : 0;
  const up = (g: Grid, from = 0) => stamp(b, g.slice(from), c, 0, HEADROOM + from + bob);
  const hg = headgearOf(look, marks);
  const weapons: { back?: Grid; front?: Grid } = fight ? {} : SIDE_WEAPONS[look.outfit];

  if (weapons.back) up(weapons.back);
  up(blink ? withBlink(SIDE_BASE, [5, 6]) : SIDE_BASE);
  // Piernas o faldón (sin balanceo vertical).
  const lower =
    step === 'stand'
      ? robe
        ? SIDE_ROBE.stand
        : SIDE_LEGS.stand
      : robe
        ? [SIDE_ROBE.front, SIDE_ROBE.stand, SIDE_ROBE.back, SIDE_ROBE.stand][step]!
        : [SIDE_LEGS.contact, SIDE_LEGS.passing, SIDE_LEGS.contact, SIDE_LEGS.passing][step]!;
  stamp(b, lower, c, 0, HEADROOM + 17, step === 2 || step === 3);
  up(SIDE_TORSO[look.outfit]);
  if (fight === 'up') stamp(b, SIDE_ARM_UP, c, 0, HEADROOM + 6 + bob);
  else if (fight) {
    const g = {
      ready: SIDE_ARM.rest,
      windup: SIDE_ARM.back,
      strike: SIDE_ARM.forward,
      thrust: SIDE_ARM_THRUST,
    }[fight];
    stamp(b, g, c, 0, HEADROOM + 10 + bob);
  } else {
    const arm =
      step === 'stand'
        ? SIDE_ARM.rest
        : [SIDE_ARM.back, SIDE_ARM.rest, SIDE_ARM.forward, SIDE_ARM.rest][step]!;
    stamp(b, arm, c, 0, HEADROOM + 10 + bob);
  }
  if (look.beard && hg !== 'capucha') up(SIDE_BEARD);
  if (hg === 'capucha') up(SIDE_HELMS.capucha);
  else if (hg === 'casco') {
    up(SIDE_HAIR[look.hairStyle] ?? [], 5);
    up(SIDE_HELMS.casco);
  } else {
    up(SIDE_HAIR[look.hairStyle] ?? []);
    if (hg) stamp(b, SIDE_HATS[hg], c, 0, bob);
  }
  if (marks.injured && hg !== 'sombrero' && hg !== 'gorra') {
    up(['', '', '....nnnnnnnn....', '...nnnnnnnrnn...'].map((r) => r || '................'));
  }
  if (marks.eyepatch)
    up(
      ['', '', '', '', '...kkkkkkkkk....', '..........kk....', '..........kk....'].map(
        (r) => r || '................',
      ),
    );
  if (weapons.front) up(weapons.front);
  return b;
}

/** Poses de combate de perfil (mirando a la derecha), sin arma: se pinta aparte en la mano. */
export type FightPose = 'ready' | 'windup' | 'strike' | 'up' | 'thrust';

/** Dónde queda la mano en cada pose, en píxeles del sprite (con su contorno). */
export const HAND: Record<FightPose, { x: number; y: number }> = {
  ready: { x: 9, y: HEADROOM + 16 },
  windup: { x: 5, y: HEADROOM + 16 },
  strike: { x: 12, y: HEADROOM + 17 },
  up: { x: 12, y: HEADROOM + 7 },
  thrust: { x: 15, y: HEADROOM + 13 },
};

const fightCache = new Map<string, Record<FightPose, PixelBuffer>>();

export function fightSprites(
  look: HeroLook,
  marks: HeroMarks = {},
): Record<FightPose, PixelBuffer> {
  const key = JSON.stringify([look, marks]);
  const hit = fightCache.get(key);
  if (hit) return hit;
  const pose = (p: FightPose, lunge: boolean) =>
    selOut(composeSide(look, marks, lunge ? 0 : 'stand', false, p));
  const out = {
    ready: pose('ready', false),
    windup: pose('windup', false),
    strike: pose('strike', true),
    up: pose('up', false),
    thrust: pose('thrust', true),
  };
  fightCache.set(key, out);
  return out;
}

const cache = new Map<string, HeroSprites>();

export function heroSprites(look: HeroLook, marks: HeroMarks = {}): HeroSprites {
  const key = JSON.stringify([look, marks]);
  const hit = cache.get(key);
  if (hit) return hit;
  const front = composeFront(look, marks, false);
  const sitRows = HEADROOM + 17;
  const bedRaw = composeFront(
    { ...look, headgear: look.headgear === 'capucha' ? 'capucha' : null },
    { ...marks, injured: true },
    true,
    false,
  );
  const sprites: HeroSprites = {
    idle: [selOut(front), selOut(breathe(front))],
    blink: selOut(composeFront(look, marks, true)),
    walk: ([0, 1, 2, 3] as const).map((s) => selOut(composeSide(look, marks, s, false))),
    sit: selOut(front.crop(0, 0, BODY_W, sitRows)),
    bed: selOut(bedRaw.crop(1, 2, BODY_W - 2, HEADROOM + 10)),
  };
  cache.set(key, sprites);
  return sprites;
}

/** Sprite de pie suelto (para listas y galerías). */
export function renderHero(look: HeroLook, marks: HeroMarks = {}): PixelBuffer {
  return heroSprites(look, marks).idle[0];
}
