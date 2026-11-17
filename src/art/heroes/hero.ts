import { HAIR, P, SKIN, darker } from '../palette';
import { PixelBuffer, alpha, toHex } from '../pixel';
import type { Grid } from '../sprite';
import { gearFront, gearSide, withDye, wearsCrown } from './gear';
import { dyeOf, garmentFront, garmentSide } from './sastre';
import {
  ARMS_UP,
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
  /** De perfil mirando a la derecha: ciclo de 8 tiempos (ver `Step`). */
  walk: PixelBuffer[];
  /** De frente con los brazos en alto: celebrando, y estirándose (con los ojos cerrados). */
  cheer: PixelBuffer;
  stretch: PixelBuffer;
  /** De frente, bostezando. */
  yawn: PixelBuffer;
  /** Sentado tras una mesa: de cintura para arriba. */
  sit: PixelBuffer;
  /** Incorporado en la cama: como `sit`, pero con la camisa de dormir y sin sombrero. */
  upright: PixelBuffer;
  /** Cabeza con venda para pintarla en la almohada. */
  bed: PixelBuffer;
  /** Cabeza dormida, sin venda, para la almohada del dormitorio. */
  sleep: PixelBuffer;
  /**
   * De espaldas: quieto y subiendo un peldaño con cada pierna (el pie de arriba, levantado). Para
   * la escalera de caracol, cuando se aleja de la cámara.
   */
  back: [PixelBuffer, PixelBuffer, PixelBuffer];
  /** De frente, subiendo o bajando un peldaño con cada pierna (cuando viene hacia la cámara). */
  stepFront: [PixelBuffer, PixelBuffer];
  /**
   * De tres cuartos (para los giros de la escalera de caracol), mirando a la derecha: de espaldas
   * con la cabeza vuelta (se le ve la mejilla) y de frente con la cabeza vuelta; quieto y con
   * el pie de delante en alto.
   */
  back3: [PixelBuffer, PixelBuffer];
  front3: [PixelBuffer, PixelBuffer];
  /** Incorporado en la cama bebiendo (ver `composeDrink`): un fotograma por tiempo del trago. */
  drink: [PixelBuffer, PixelBuffer, PixelBuffer];
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
  // Herrero: camisa oscura sin mangas, mandil de cuero, guantes y botas.
  herrero: {
    c: P.slate,
    C: P.navy,
    a: P.mocha,
    A: P.bark,
    o: P.bark,
    O: P.ebony,
    p: P.umber,
    P: P.ebony,
    q: P.umber,
    Q: P.bark,
  },
  // Sastre: camisa cruda, chaleco rojo con la cinta de medir al cuello y calzas oscuras.
  sastre: {
    c: P.sand,
    C: P.tan,
    a: P.red,
    A: P.wine,
    o: P.bark,
    O: P.navy,
    p: P.bark,
    P: P.plum,
    q: P.mist,
    Q: P.fog,
  },
  // Alquimista: túnica verde hasta los pies, pañuelo crudo y el cinto de cuero con frascos.
  alquimista: {
    c: P.forest,
    C: P.deep,
    a: P.sand,
    A: P.bark,
    o: P.bark,
    O: P.black,
    p: P.umber,
    P: P.ebony,
    q: P.forest,
    Q: P.deep,
  },
  // Pintor: bata clara manchada de pintura sobre camisa azul, boina de vino y zapatos.
  pintor: {
    c: P.mist,
    C: P.fog,
    a: P.ocean,
    A: P.navy,
    o: P.bark,
    O: P.umber,
    p: P.umber,
    P: P.ebony,
    q: P.mist,
    Q: P.fog,
    b: P.wine,
    B: P.plum,
  },
  // Chaleco de lana parda sobre camisa cruda, cuerda por cinturón y zuecos.
  campesino: {
    c: P.oak,
    C: P.bark,
    a: P.sand,
    A: P.tan,
    o: P.clay,
    O: P.rust,
    p: P.bark,
    P: P.umber,
    q: P.sand,
    Q: P.tan,
    b: P.wine,
    B: P.plum,
  },
  // Casaca de terciopelo con cuello de piel, cadena de oro y bolsa al cinto.
  mercader: {
    c: P.wine,
    C: P.plum,
    a: P.sand,
    A: P.tan,
    o: P.bark,
    O: P.ebony,
    p: P.slate,
    P: P.navy,
    q: P.wine,
    Q: P.plum,
    b: P.forest,
    B: P.deep,
  },
  // Casaca larga azul con gola blanca, banda de oro y gorro de pluma.
  noble: {
    c: P.sky,
    C: P.ocean,
    a: P.gold,
    A: P.lemon,
    o: P.ebony,
    O: P.black,
    p: P.white,
    P: P.mist,
    q: P.sky,
    Q: P.ocean,
    b: P.navy,
    B: P.black,
  },
  // Capa gris con capucha que le tapa hasta las manos.
  forastero: {
    c: P.slate,
    C: P.navy,
    a: P.steel,
    A: P.fog,
    o: P.ebony,
    O: P.black,
    p: P.navy,
    P: P.black,
    q: P.slate,
    Q: P.navy,
  },
  // El forastero de la tormenta: hábito verde muy oscuro, casi negro, con cordón de hueso.
  velado: {
    c: P.deep,
    C: P.black,
    a: P.sand,
    A: P.tan,
    o: P.ebony,
    O: P.black,
    p: P.black,
    P: P.black,
    q: P.deep,
    Q: P.black,
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
  // Paja del sombrero de los campesinos.
  z: P.sand,
  Z: P.tan,
};

/**
 * El color de la ropa de alguien (la tela del traje): el de su clase u oficio o, si le han teñido
 * en la sastrería, el del tinte. El claro y su sombra.
 */
export function clothOf(look: HeroLook): { field: string; dark: string } {
  const dye = dyeOf(look.dye);
  if (dye) return { field: dye[2], dark: dye[1] };
  const c = CLASS[look.outfit] ?? CLASS.tabernero;
  return { field: c.c!, dark: c.C! };
}

function slots(look: HeroLook): Slots {
  const skin = SKIN[look.skin] ?? SKIN[0]!;
  const hair = HAIR[look.hairColor] ?? HAIR[0]!;
  // Con tinte, la tela del traje (cuerpo y mangas) toma sus tonos; el cuero y el metal, no.
  const dye = dyeOf(look.dye);
  const cloth: Slots = dye ? { c: dye[2], C: dye[1], q: dye[2], Q: dye[1] } : {};
  return {
    ...SHARED,
    ...CLASS[look.outfit],
    ...cloth,
    x: skin[3]!,
    X: skin[2]!,
    h: hair[2]!,
    H: hair[1]!,
  };
}

/** El equipo, con el tinte del héroe (la capa y los filetes lo toman). */
const gearOf = (look: HeroLook, marks: HeroMarks) => withDye(marks.gear, look.dye);

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
  // La corona va en lugar del sombrero.
  if (wearsCrown(marks.gear)) return null;
  return marks.injured && look.headgear === 'casco' ? null : look.headgear;
}

/** Gestos de frente: celebrar (brazos en alto y boca abierta), estirarse y bostezar. */
type Gesture = 'cheer' | 'stretch' | 'yawn';

/**
 * La camisa de dormir (en la cama, en lugar del traje): lisa, de lino azulado, con el cuello
 * abierto. Con sus propias tintas (no las del traje: la capucha, si la lleva, sigue con las suyas).
 */
const NIGHTSHIRT: Grid = [
  ...Array.from({ length: 10 }, () => '................'),
  '...cccxxccccc...',
  '..cCccxxcccCcc..',
  '..cCcccccccCcc..',
  '..cCcccccccCcc..',
  '..cCcccccccCcc..',
  '....cccccccc....',
  '....cccccccc....',
  '....cCccccCc....',
  '...cCccccccCc...',
  '...cCccccccCc...',
  '...cccccccccc...',
];
const NIGHT_INK: Slots = { c: P.mist, C: P.fog };

/** En la cama: sin sombrero ni casco (la capucha y el velo, sí), como en la almohada. */
const bedLook = (look: HeroLook): HeroLook => {
  const hood = look.headgear === 'capucha' || look.headgear === 'velo';
  return { ...look, headgear: hood ? look.headgear : null };
};

function composeFront(
  look: HeroLook,
  marks: HeroMarks,
  blink: boolean,
  noHat = false,
  gesture?: Gesture,
  /** En la cama: con la camisa de dormir, sin armas, equipo ni prendas de la sastrería. */
  night = false,
): PixelBuffer {
  const c = slots(look);
  const b = new PixelBuffer(BODY_W, BODY_H + HEADROOM);
  const body = (g: Grid, from = 0) => stamp(b, g.slice(from), c, 0, HEADROOM + from);
  const hg = noHat ? null : headgearOf(look, marks);
  body(blink ? withBlink(BASE, [5, 6]) : BASE);
  if (night) stamp(b, NIGHTSHIRT, { ...NIGHT_INK, x: c.x!, X: c.X! }, 0, HEADROOM);
  else body(OUTFITS[look.outfit]);
  const up = gesture === 'cheer' || gesture === 'stretch';
  if (up)
    // Fuera los brazos caídos (mangas y manos): van en alto, encima de todo.
    for (let y = HEADROOM + 12; y <= HEADROOM + 16; y++)
      for (const x of [0, 1, 2, 3, 12, 13, 14, 15]) b.clear(x, y);
  if (look.beard && hg !== 'capucha' && hg !== 'velo') body(BEARD);
  if (hg === 'capucha' || hg === 'velo') body(HELMS[hg]);
  else if (hg === 'casco') {
    body(FRONT_HAIR[look.hairStyle], 5);
    body(HELMS.casco);
  } else {
    body(FRONT_HAIR[look.hairStyle]);
    if (hg) stamp(b, HATS[hg], c, 0, 0);
  }
  if (marks.eyepatch) body(OVERLAYS.parche);
  if (marks.injured && hg !== 'sombrero' && hg !== 'gorra') body(OVERLAYS.venda);
  // La prenda de la sastrería: la capa, por detrás del equipo; lo demás (tabardo, faja,
  // bufanda), por encima de la armadura, para que se vea con ella puesta.
  const cape = look.garment === 'capa';
  if (night) return b;
  if (cape) garmentFront(b, 'capa', look.dye);
  // Con los brazos en alto, el arma no está en la mano.
  if (!up) body(WEAPONS[look.outfit]);
  const gear = gearOf(look, marks);
  if (gear) gearFront(b, gear);
  if (look.garment && !cape) garmentFront(b, look.garment, look.dye);
  if (up) body(ARMS_UP);
  if (gesture === 'yawn' || gesture === 'cheer') {
    // La boca abierta, bajo la nariz.
    b.rect(7, HEADROOM + 7, 2, 2, P.plum);
    b.set(7, HEADROOM + 8, P.black);
  }
  return b;
}

/** La nuca: la cabeza llena de pelo (o de piel, el calvo; o de la capucha) y el cuello debajo. */
const NAPE: Grid = [
  '................',
  '................',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '..xhhhhhhhhhhx..',
  '..xHhhhhhhhhHx..',
  '...HhhhhhhhhH...',
  '....HHHHHHHH....',
  '......XXXX......',
];
/** El casco por detrás: la cabeza entera, hasta la nuca. */
const HELM_BACK: Grid = [
  '................',
  '....mmmmmmmm....',
  '...mMmmmmmmMm...',
  '...mmmmmmmmmm...',
  '...mmmmmmmmmm...',
  '...MmmmmmmmmM...',
  '...MMmmmmmmMM...',
  '....MMMMMMMM....',
];
/** La coleta y la melena, vistas por detrás. */
const NAPE_TAIL: Grid = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.......hh.......',
  '.......hH.......',
  '.......HH.......',
];
const NAPE_LONG: Grid = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '...hhhhhhhhhh...',
  '...hHhhhhhhHh...',
  '....HhhhhhhH....',
];

/**
 * De espaldas: lo mismo que de frente (traje, equipo, sombrero) pero con la nuca en lugar de la
 * cara, sin barba ni parche, y volteado (lo que lleva en la mano derecha queda a la derecha).
 */
function composeBack(look: HeroLook, marks: HeroMarks): PixelBuffer {
  const c = slots(look);
  const b = new PixelBuffer(BODY_W, BODY_H + HEADROOM);
  const body = (g: Grid, from = 0) =>
    stamp(b, g.map((r) => r || '................').slice(from), c, 0, HEADROOM + from);
  const hg = headgearOf(look, marks);
  const bald = look.hairStyle === 'calvo';
  body(BASE);
  // La capucha y el velo del forastero tapan la cabeza entera, también de espaldas.
  const hood = hg === 'capucha' || hg === 'velo';
  const nape = hood ? 'cC' : bald ? 'xX' : 'hH';
  body(NAPE.map((r) => r.replace(/h/g, nape[0]!).replace(/H/g, nape[1]!)));
  body(plainBack(OUTFITS[look.outfit]));
  if (!hood && look.hairStyle === 'largo') body(NAPE_LONG);
  if (!hood && look.hairStyle === 'coleta') body(NAPE_TAIL);
  if (hood) body(HELMS[hg]);
  else if (hg === 'casco') body(HELM_BACK);
  else {
    if (!bald) body(FRONT_HAIR[look.hairStyle].slice(0, 4));
    if (hg) stamp(b, HATS[hg], c, 0, 0);
  }
  if (marks.injured && hg !== 'sombrero' && hg !== 'gorra') body(OVERLAYS.venda);
  if (look.garment === 'capa') garmentFront(b, 'capa', look.dye);
  body(WEAPONS[look.outfit]);
  const gear = gearOf(look, marks);
  if (gear) gearFront(b, gear);
  if (look.garment && look.garment !== 'capa') garmentFront(b, look.garment, look.dye);
  const out = new PixelBuffer(b.w, b.h);
  out.blit(b, 0, 0, true);
  return out;
}

/** Lo que solo se ve por delante (cruces, correas, hebillas, botones): en el pecho. */
const CHEST_MARKS = /[aAyYwgrpk]/g;

/**
 * El traje por detrás: en las filas del pecho, lo que solo lleva por delante se tapa con el
 * color de tela (o de metal) que más hay en esa fila.
 */
function plainBack(g: Grid): Grid {
  return g.map((row, y) => {
    if (y < 10 || y > 15) return row;
    const count = new Map<string, number>();
    for (const ch of row) if (/[cCmMoOqQ]/.test(ch)) count.set(ch, (count.get(ch) ?? 0) + 1);
    const main = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
    return main ? row.replace(CHEST_MARKS, main) : row;
  });
}

/** Filas del sentado (de cintura para arriba): hasta las manos. */
const SIT_ROWS = HEADROOM + 17;

/**
 * La jarra de espuma, de frente, con el asa a la izquierda (la mano derecha, que de frente cae a
 * ese lado): derecha y empinada (se le ve el culo y la espuma asoma arriba, en los labios). La
 * derecha es también la que baja flotando en la pesadilla (`particles.ts`). Madera más oscura
 * que la piel, para que no se confunda con la cara.
 */
export const MUG: Record<'up' | 'tip', Grid> = {
  up: ['..WWW.', '.WWmWW', 'oottTT', 'o.rrrr', 'oottTT', '..TTTT'],
  tip: ['..WmW.', 'oottTT', 'o.rrrr', 'oottTT', '..tTTt'],
};
export const MUG_INK: Slots = { W: P.white, m: P.mist, t: P.clay, T: P.oak, r: P.bark, o: P.rust };

/** Los tres tiempos del trago: la jarra al pecho, a la boca y empinada. */
export type Sip = 0 | 1 | 2;

/**
 * Cada tiempo del trago: esquina de la jarra (x, fila del cuerpo), fila de la mano (en el asa) y
 * el brazo, de la muñeca al codo (que asoma por fuera del cuerpo al subir la jarra).
 */
const SIPS: Record<Sip, { mug: [number, number]; hand: number; arm: [number, number][] }> = {
  0: { mug: [4, 9], hand: 11, arm: [[3, 12]] },
  1: {
    mug: [4, 7],
    hand: 9,
    arm: [
      [3, 10],
      [2, 11],
      [1, 11],
      [1, 12],
    ],
  },
  2: {
    mug: [4, 6],
    hand: 7,
    arm: [
      [3, 8],
      [2, 9],
      [1, 9],
      [1, 10],
      [1, 11],
      [2, 12],
    ],
  },
};

/**
 * Incorporado en la cama bebiendo (de cintura para arriba, como `sit`, y una fila más alto para
 * la cabeza echada atrás): el brazo derecho sube la jarra a la boca. Bebiendo, los ojos cerrados
 * y la cabeza un píxel atrás (sube: se le ve más cuello); empinada, el codo más alto. La jarra y
 * el brazo llevan su propio contorno por encima del cuerpo, para que se lean delante de la cara.
 */
function composeDrink(look: HeroLook, marks: HeroMarks, sip: Sip): PixelBuffer {
  const c = slots(look);
  const src = composeFront(bedLook(look), marks, sip > 0, false, undefined, true);
  const b = new PixelBuffer(BODY_W, SIT_ROWS + 1);
  // La cabeza (hasta la barbilla) sube un píxel al echarla atrás; el cuello se alarga.
  const neck = HEADROOM + 9;
  const lift = sip > 0 ? 1 : 0;
  for (let y = 0; y < SIT_ROWS; y++)
    for (let x = 0; x < BODY_W; x++) {
      const v = src.get(x, y);
      if (alpha(v)) b.data[(y + 1 - (y < neck ? lift : 0)) * BODY_W + x] = v;
    }
  if (lift)
    for (let x = 0; x < BODY_W; x++) {
      const v = src.get(x, neck);
      if (alpha(v)) b.data[neck * BODY_W + x] = v;
    }
  // Lo que lleve en esa mano (el arco, la daga) no está: la mano lleva la jarra.
  for (let y = neck; y < b.h; y++) for (const x of [0, 1]) b.clear(x, y);
  // La jarra, la mano y el brazo, en su capa (`r`: fila del cuerpo).
  const row = (r: number) => HEADROOM + 1 + r;
  const top = new PixelBuffer(BODY_W, b.h);
  const { mug, hand, arm } = SIPS[sip];
  // El brazo, de dos de grueso y del color de la manga (o de la piel, si va sin mangas): la
  // sombra, por debajo.
  const sleeve = toHex(src.get(3, HEADROOM + 12));
  for (const [x, r] of arm) {
    top.set(x, row(r), sleeve);
    if (!arm.some(([ax, ar]) => ax === x && ar === r + 1)) top.set(x, row(r) + 1, darker(sleeve));
  }
  stamp(top, MUG[sip === 2 ? 'tip' : 'up'], MUG_INK, mug[0], row(mug[1]));
  // La mano agarra el asa: los nudillos por delante.
  top.rect(mug[0], row(hand), 2, 2, c.x!);
  top.set(mug[0], row(hand) + 1, c.X!);
  // Su contorno, donde cae encima del cuerpo (por fuera ya lo pone `selOut`).
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < BODY_W; x++) {
      if (alpha(top.get(x, y)) || !alpha(b.get(x, y))) continue;
      const n = [top.get(x - 1, y), top.get(x + 1, y), top.get(x, y - 1), top.get(x, y + 1)].find(
        (v) => alpha(v),
      );
      if (n) b.set(x, y, darker(toHex(n), 3));
    }
  b.blit(top, 0, 0);
  return b;
}

/**
 * De tres cuartos, mirando a la derecha: la cabeza (y el sombrero) un píxel hacia allí y, de
 * espaldas, la mejilla (`skin`) asomando por ese lado.
 */
function threeQuarter(src: PixelBuffer, skin?: string): PixelBuffer {
  const out = src.clone();
  const neck = HEADROOM + 9;
  for (let y = 0; y <= neck; y++) {
    for (let x = src.w - 1; x >= 0; x--) {
      const from = x > 0 ? src.get(x - 1, y) : 0;
      if (from) out.data[y * src.w + x] = from;
      else out.clear(x, y);
    }
  }
  if (skin)
    for (let y = HEADROOM + 5; y <= HEADROOM + 7; y++) {
      let edge = -1;
      for (let x = 0; x < Math.min(out.w, 15); x++) if (alpha(out.get(x, y))) edge = x;
      if (edge > 0) out.set(edge, y, skin);
    }
  return out;
}

/**
 * Subiendo un peldaño (de frente o de espaldas): una pierna con el pie levantado (`left`, la de
 * la izquierda del dibujo), dos filas más corta, y el cuerpo un píxel más arriba.
 */
function stepUp(src: PixelBuffer, left: boolean): PixelBuffer {
  const out = new PixelBuffer(src.w, src.h);
  const hip = HEADROOM + 17;
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const leg = y >= hip && (left ? x < src.w / 2 : x >= src.w / 2);
      const from = leg ? y + 2 : y + 1;
      const c = from < src.h ? src.get(x, from) : 0;
      if (c) out.set(x, y, c);
    }
  return out;
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

/**
 * Paso: ocho tiempos, cuatro por zancada (apoyo, carga, paso y impulso) y los mismos con la
 * otra pierna. El cuerpo baja un píxel al apoyar y cargar.
 */
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WALK_STEPS = 8;
/** Píxeles que avanza la figura en cada tiempo del paso: lo que se corre el pie apoyado. */
export const WALK_PX = 2;

/** Los que llevan faldón o capa hasta los pies (de perfil, sin piernas). */
const ROBES: ReadonlySet<OutfitId> = new Set(['mago', 'clerigo', 'noble', 'forastero', 'velado']);

function composeSide(
  look: HeroLook,
  marks: HeroMarks,
  step: Step | 'stand',
  blink: boolean,
  fight?: FightPose,
): PixelBuffer {
  const c = slots(look);
  const b = new PixelBuffer(BODY_W, BODY_H + HEADROOM);
  const robe = ROBES.has(look.outfit);
  const phase = step === 'stand' ? -1 : step % 4;
  const bob = phase === 0 || phase === 1 ? 1 : 0;
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
        ? [SIDE_ROBE.front, SIDE_ROBE.stand, SIDE_ROBE.back, SIDE_ROBE.stand][Math.floor(step / 2)]!
        : [SIDE_LEGS.contact, SIDE_LEGS.down, SIDE_LEGS.passing, SIDE_LEGS.high][step % 4]!;
  stamp(b, lower, c, 0, HEADROOM + 17, step !== 'stand' && step >= 4);
  up(SIDE_TORSO[look.outfit]);
  if (look.garment === 'capa') garmentSide(b, 'capa', look.dye, bob);
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
        : [SIDE_ARM.back, SIDE_ARM.rest, SIDE_ARM.forward, SIDE_ARM.rest][Math.floor(step / 2)]!;
    stamp(b, arm, c, 0, HEADROOM + 10 + bob);
  }
  if (look.beard && hg !== 'capucha' && hg !== 'velo') up(SIDE_BEARD);
  if (hg === 'capucha' || hg === 'velo') up(SIDE_HELMS[hg]);
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
  const gear = gearOf(look, marks);
  if (gear) gearSide(b, gear);
  if (look.garment && look.garment !== 'capa') garmentSide(b, look.garment, look.dye, bob);
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

/**
 * Poses de perfil. En la pelea, el golpe y la estocada van con las piernas abiertas; con
 * `planted`, todas con los pies quietos (para trabajar o charlar sin que parezca que anda).
 */
export function fightSprites(
  look: HeroLook,
  marks: HeroMarks = {},
  planted = false,
): Record<FightPose, PixelBuffer> {
  const key = JSON.stringify([look, marks, planted]);
  const hit = fightCache.get(key);
  if (hit) return hit;
  const pose = (p: FightPose, lunge: boolean) =>
    selOut(composeSide(look, marks, lunge && !planted ? 0 : 'stand', false, p));
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
  // En la cama, la misma cabeza acostado que incorporado: sin sombrero y con la camisa de dormir
  // (sin armas ni equipo, que asomaban junto a la almohada).
  const bare = bedLook(look);
  const bedRaw = composeFront(bare, { ...marks, injured: true }, true, false, undefined, true);
  const sleepRaw = composeFront(bare, marks, true, false, undefined, true);
  const nightRaw = composeFront(bare, marks, false, false, undefined, true);
  const backRaw = composeBack(look, marks);
  const skin = (SKIN[look.skin] ?? SKIN[0]!)[3]!;
  const back3 = threeQuarter(backRaw, skin);
  const front3 = threeQuarter(front);
  const sprites: HeroSprites = {
    idle: [selOut(front), selOut(breathe(front))],
    blink: selOut(composeFront(look, marks, true)),
    walk: ([0, 1, 2, 3, 4, 5, 6, 7] as const).map((s) =>
      selOut(composeSide(look, marks, s, false)),
    ),
    cheer: selOut(composeFront(look, marks, false, false, 'cheer')),
    stretch: selOut(composeFront(look, marks, true, false, 'stretch')),
    yawn: selOut(composeFront(look, marks, true, false, 'yawn')),
    sit: selOut(front.crop(0, 0, BODY_W, SIT_ROWS)),
    upright: selOut(nightRaw.crop(0, 0, BODY_W, SIT_ROWS)),
    bed: selOut(bedRaw.crop(1, 2, BODY_W - 2, HEADROOM + 10)),
    sleep: selOut(sleepRaw.crop(1, 2, BODY_W - 2, HEADROOM + 10)),
    back: [selOut(backRaw), selOut(stepUp(backRaw, true)), selOut(stepUp(backRaw, false))],
    stepFront: [selOut(stepUp(front, true)), selOut(stepUp(front, false))],
    back3: [selOut(back3), selOut(stepUp(back3, false))],
    front3: [selOut(front3), selOut(stepUp(front3, false))],
    drink: [0, 1, 2].map((k) =>
      selOut(composeDrink(look, marks, k as Sip)),
    ) as HeroSprites['drink'],
  };
  cache.set(key, sprites);
  return sprites;
}

/** Sprite de pie suelto (para listas y galerías). */
export function renderHero(look: HeroLook, marks: HeroMarks = {}): PixelBuffer {
  return heroSprites(look, marks).idle[0];
}
