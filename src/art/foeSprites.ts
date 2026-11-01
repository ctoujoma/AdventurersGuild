/**
 * Los enemigos que no son bandidos, pintados a mano: cabeza y cuerpo de cada bicho píxel a píxel
 * (plantillas de letras) y, por código, lo que se mueve en cada pose (piernas con rodilla y pie,
 * brazos, patas con articulación, el arma girada). Lo usa `foes.ts`; todos miran a la derecha y
 * apoyan los pies en la última fila.
 *
 * Letras de las plantillas (cada bicho trae su paleta): minúscula, el color; mayúscula, su
 * sombra; `h`, la luz; `K`, negro; `w`, blanco (dientes, hueso claro); `e`, el ojo; el punto,
 * transparente.
 */
import { P, darker } from './palette';
import { PixelBuffer, bayer, toHex } from './pixel';

export type Legs = 'stand' | 'a' | 'b' | 'lunge' | 'crouch';
export type Arm = 'rest' | 'back' | 'forward' | 'up';

export interface PoseSpec {
  legs: Legs;
  arm: Arm;
  lean: number;
  bob: number;
  bite?: boolean;
  /** Con el golpe encima: ojos cerrados y echado atrás. */
  hurt?: boolean;
}

export type Pal = Record<string, string>;

/** Pinta una plantilla en `b` con su esquina en (`x`, `y`). */
export function paint(b: PixelBuffer, rows: readonly string[], pal: Pal, x: number, y: number) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]!];
      if (c) b.set(x + i, y + j, c);
    }
  });
}

export const outline = (b: PixelBuffer) => b.outlined((n) => darker(toHex(n), 3));

// ---------- Armas: de pie (la punta arriba) y con el puño en `grip` ----------

interface WeaponArt {
  rows: string[];
  pal: Pal;
  grip: [number, number];
}

const METAL = { m: P.fog, M: P.steel, h: P.white, g: P.gold, o: P.oak, O: P.bark, b: P.bark };
const RUST = { m: P.clay, M: P.rust, h: P.tan, g: P.rust, o: P.oak, O: P.bark, b: P.bark };

export const WEAPON: Record<string, WeaponArt> = {
  daga: { rows: ['.h.', '.m.', 'hmM', '.mM', 'ggg', '.b.', '.b.'], pal: METAL, grip: [1, 5] },
  espada: {
    rows: ['.h.', '.hM', '.mM', '.mM', '.mM', '.mM', '.mM', 'gggg', '.b..', '.b..', '.g..'],
    pal: METAL,
    grip: [1, 9],
  },
  oxidada: {
    rows: ['.h.', '.mM', '.mM', 'M.M', '.mM', '.mM', 'gggg', '.b..', '.b..'],
    pal: RUST,
    grip: [1, 7],
  },
  lanza: {
    rows: [
      '.h.',
      'hmM',
      '.mM',
      '.M.',
      '.o.',
      '.O.',
      '.o.',
      '.o.',
      '.O.',
      '.o.',
      '.o.',
      '.O.',
      '.o.',
    ],
    pal: METAL,
    grip: [1, 9],
  },
  garrote: {
    rows: ['.oo.', 'ohoO', 'ooOO', 'oOOO', '.oO.', '.oO.', '..o.', '..o.', '..O.', '..o.'],
    pal: METAL,
    grip: [2, 8],
  },
  hacha: {
    rows: ['.mmM.', 'hmmMo', 'mmMMo', '.mM.o', '....o', '....O', '....o', '....o', '....O'],
    pal: METAL,
    grip: [4, 7],
  },
  porra: {
    rows: [
      '.oooo.',
      'oohooO',
      'ohooOO',
      'ooooOO',
      '.oooO.',
      '.ooOO.',
      '..oO..',
      '..oO..',
      '..oO..',
      '..oO..',
      '..OO..',
      '..oO..',
      '..oO..',
    ],
    pal: { o: P.cocoa, O: P.umber, h: P.tan },
    grip: [2, 11],
  },
};

/** Ángulo del arma (grados, desde arriba en el sentido del reloj) en cada postura del brazo. */
const ANGLE: Record<Arm, number> = { rest: 30, back: -60, forward: 95, up: 0 };

/** Pinta un arma girada `deg` con el puño en (`x`, `y`). */
export function weaponAt(b: PixelBuffer, w: WeaponArt, x: number, y: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const R = Math.max(...w.rows.map((r) => r.length), w.rows.length) + 1;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      // Del destino a la plantilla: el giro al revés.
      const sx = Math.round(w.grip[0] + dx * c + dy * s);
      const sy = Math.round(w.grip[1] - dx * s + dy * c);
      const ch = w.rows[sy]?.[sx];
      const col = ch ? w.pal[ch] : undefined;
      if (col) b.set(x + dx, y + dy, col);
    }
}

// ---------- De dos patas ----------

export interface Biped {
  /** Cabeza y tronco, mirando a la derecha; las piernas salen por debajo de la fila `hip`. */
  upper: string[];
  pal: Pal;
  hip: number;
  hipX: number;
  /** De dónde sale el brazo de delante y el de atrás (en la plantilla). */
  shoulder: [number, number];
  backShoulder: [number, number];
  legH: number;
  leg: { c: string; C: string; foot: string; w: number; bone?: boolean };
  arm: { c: string; C: string; hand: string; len: number; w: number };
  weapon: WeaponArt;
  /** Un escudo en el brazo de atrás. */
  shield?: { c: string; C: string; rim: string };
  /** La cara con el golpe encima: filas de la plantilla que se cambian (fila, texto). */
  ouch?: [number, string][];
}

export function bipedPose(d: Biped, p: PoseSpec): PixelBuffer {
  const tw = Math.max(...d.upper.map((r) => r.length));
  const reach = Math.max(...d.weapon.rows.map((r) => r.length), d.weapon.rows.length);
  const padX = reach + 2;
  const padTop = reach + 2;
  const W = tw + padX * 2;
  const H = padTop + d.upper.length + d.legH;
  const b = new PixelBuffer(W, H);
  const G = H - 1;
  const crouch = p.legs === 'crouch' ? 2 : p.legs === 'lunge' ? 1 : 0;
  const ox = padX + p.lean;
  const oy = G - d.legH - d.hip + crouch + p.bob;
  const hipY = oy + d.hip + 1;
  const hx = ox + d.hipX;

  // Las piernas: muslo hasta la rodilla y espinilla hasta el pie, con su bota.
  const feet: Record<Legs, [number, number]> = {
    stand: [-2, 2],
    a: [-4, 4],
    b: [2, -2],
    lunge: [-5, 5],
    crouch: [-3, 3],
  };
  const [fb, ff] = feet[p.legs];
  const leg = (x0: number, footX: number, front: boolean) => {
    const c = front ? d.leg.c : d.leg.C;
    const kneeY = Math.round((hipY + G) / 2);
    const bend = p.legs === 'crouch' || p.legs === 'lunge' ? 2 : 1;
    const kneeX = Math.round((x0 + footX) / 2) + (front ? bend : 0);
    const seg = (ax: number, ay: number, bx: number, by: number) => {
      const n = Math.max(1, Math.abs(by - ay));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / n);
        const y = ay + Math.round(((by - ay) * k) / n);
        b.rect(x, y, d.leg.w, 1, c);
        if (d.leg.w > 1 && !d.leg.bone) b.set(x, y, darker(c, 1));
      }
    };
    seg(x0, hipY, kneeX, kneeY);
    seg(kneeX, kneeY, footX, G - 1);
    if (d.leg.bone) b.set(kneeX, kneeY, P.white);
    // El pie, hacia delante.
    b.rect(footX - 1, G - 1, d.leg.w + 2, 2, d.leg.foot);
    b.set(footX - 1, G - 1, darker(d.leg.foot, 1));
  };
  leg(hx - 1, hx - 1 + fb, false);

  // El brazo de atrás (y el escudo), por detrás del cuerpo.
  const [bsx, bsy] = d.backShoulder;
  const backHand: [number, number] =
    p.arm === 'back' || p.hurt
      ? [ox + bsx - 2, oy + bsy - 3]
      : [ox + bsx - 1 + Math.round(fb / 2), oy + bsy + d.arm.len - 1];
  limb(b, ox + bsx, oy + bsy, backHand[0], backHand[1], d.arm.C, d.arm.w);
  b.rect(backHand[0], backHand[1], 2, 2, darker(d.arm.hand, 1));

  // El tronco y la cabeza.
  const rows =
    p.hurt && d.ouch ? d.upper.map((r, i) => d.ouch!.find((o) => o[0] === i)?.[1] ?? r) : d.upper;
  paint(b, rows, d.pal, ox, oy);
  leg(hx + 1, hx + 1 + ff, true);

  if (d.shield) {
    const sx = ox + bsx - 3;
    const sy = oy + bsy;
    b.rect(sx, sy, 5, 7, d.shield.c);
    b.rect(sx + 3, sy, 2, 7, d.shield.C);
    b.hline(sx, sy, 5, d.shield.rim);
    b.hline(sx + 1, sy + 6, 3, d.shield.rim);
    b.set(sx + 2, sy + 3, d.shield.rim);
  }

  // El brazo de delante con el arma.
  const [sx, sy] = d.shoulder;
  const L = d.arm.len;
  const hand: Record<Arm, [number, number]> = {
    rest: [sx + 1, sy + L - 1],
    back: [sx - 2, sy - L + 1],
    forward: [sx + L, sy + 1],
    up: [sx + 1, sy - L],
  };
  const arm = p.hurt ? 'up' : p.arm;
  const [ax, ay] = hand[arm];
  weaponAt(b, d.weapon, ox + ax, oy + ay, ANGLE[arm]);
  limb(b, ox + sx, oy + sy, ox + ax, oy + ay, d.arm.c, d.arm.w);
  b.rect(ox + ax - 1, oy + ay - 1, 2, 2, d.arm.hand);
  b.set(ox + ax - 1, oy + ay - 1, darker(d.arm.hand, 1));
  return b;
}

/** Un brazo o una pata: de (`x0`, `y0`) a (`x1`, `y1`), de `w` de grueso con su sombra. */
function limb(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: string, w = 2) {
  const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n);
    const y = Math.round(y0 + ((y1 - y0) * k) / n);
    b.rect(x, y, w, w > 1 ? 2 : 1, c);
    if (w > 1) b.set(x + w - 1, y + 1, darker(c, 1));
  }
}

// ---------- De cuatro patas ----------

export interface Quad {
  /** Cuerpo, cola y cabeza, sin las patas. */
  body: string[];
  pal: Pal;
  /** Dónde nacen las patas (x en la plantilla), de atrás adelante, y la fila de los hombros. */
  legsAt: [number, number, number, number];
  legTop: number;
  legH: number;
  leg: { c: string; C: string; paw: string; w: number };
  /** Lo que cambia al morder (fila, texto) y al recibir el golpe. */
  bite?: [number, string][];
  ouch?: [number, string][];
}

export function quadPose(d: Quad, p: PoseSpec): PixelBuffer {
  const tw = Math.max(...d.body.map((r) => r.length));
  const W = tw + 8;
  const H = d.legTop + d.legH + 4;
  const b = new PixelBuffer(W, H);
  const G = H - 1;
  const crouch = p.legs === 'crouch' ? 2 : 0;
  const leap = p.legs === 'lunge';
  const ox = 3 + p.lean;
  const oy = G - d.legTop - d.legH + 1 + crouch + p.bob - (leap ? 2 : 0);
  // Pasos: cada pata adelanta o atrasa el pie; las del fondo, más oscuras.
  const swing: Record<Legs, number[]> = {
    stand: [0, 0, 0, 0],
    a: [-2, 1, -2, 2],
    b: [1, -2, 2, -2],
    lunge: [-3, -3, 4, 4],
    crouch: [1, 1, -1, -1],
  };
  const s = swing[p.legs];
  const drawLeg = (i: number) => {
    const far = i % 2 === 0;
    const c = far ? d.leg.C : d.leg.c;
    const x0 = ox + d.legsAt[i]!;
    const y0 = oy + d.legTop;
    const foot = x0 + s[i]!;
    const front = i >= 2;
    const lift = leap && front ? 3 : 0;
    const kneeY = Math.round((y0 + G) / 2) - lift;
    // Las de atrás doblan la corva hacia atrás; las de delante, recta.
    const kneeX = front
      ? Math.round((x0 + foot) / 2) + (leap ? 2 : 0)
      : x0 - 1 + Math.round(s[i]! / 2);
    limb(b, x0, y0, kneeX, kneeY, c, d.leg.w);
    limb(
      b,
      kneeX,
      kneeY,
      foot + (leap && front ? 3 : 0),
      G - 1 - lift,
      c,
      Math.max(1, d.leg.w - 1),
    );
    b.rect(foot - 1 + (leap && front ? 3 : 0), G - lift, d.leg.w + 1, 1, d.leg.paw);
  };
  drawLeg(0);
  drawLeg(2);
  const rows =
    (p.hurt ? d.ouch : p.bite ? d.bite : undefined)?.reduce(
      (acc, [i, r]) => acc.map((x, k) => (k === i ? r : x)),
      d.body,
    ) ?? d.body;
  paint(b, rows, d.pal, ox, oy);
  drawLeg(1);
  drawLeg(3);
  return b;
}

// ---------- Los de dos patas ----------

const SKIN_G = { s: P.lime, S: P.leaf, h: P.lemon };

/** Trasgo: cabezón, orejas largas, ojos amarillos, nariz ganchuda y sonrisa de dientes. */
export function goblinBody(skin: Pal, cloth: string, weapon: string): Biped {
  const pal: Pal = {
    ...skin,
    K: P.black,
    w: P.white,
    y: P.lemon,
    c: cloth,
    C: darker(cloth, 1),
    l: darker(cloth, -1) ?? cloth,
    b: P.bark,
    m: P.gold,
    r: P.rust,
  };
  return {
    upper: [
      '......hhss....',
      'S....hsssss...',
      'SS..hsssssss..',
      '.SSShssssyKs..',
      '..SSsssssyysS.',
      '....Sssssssss.',
      '....SsKwKwKS..',
      '.....SSSSSS...',
      '....CcccccC...',
      '...CCcccccC...',
      '...Cbbbmbbb...',
      '...CcC.cC.c...',
    ],
    ouch: [
      [3, '.SSShsssKKss..'],
      [4, '..SSssssssssS.'],
      [6, '....SsKKKKKS..'],
    ],
    pal,
    hip: 11,
    hipX: 7,
    shoulder: [9, 9],
    backShoulder: [5, 9],
    legH: 6,
    leg: { c: skin.S!, C: darker(skin.S!, 1), foot: P.bark, w: 1 },
    arm: { c: skin.s!, C: skin.S!, hand: skin.s!, len: 4, w: 1 },
    weapon: WEAPON[weapon]!,
  };
}

/** Orco: más alto y ancho, ceño, colmillos, coleta y una hombrera de hierro. */
export function orcBody(skin: Pal, cloth: string, weapon: string): Biped {
  const pal: Pal = {
    ...skin,
    K: P.black,
    w: P.white,
    e: P.red,
    r: P.black,
    c: cloth,
    C: darker(cloth, 1),
    b: P.bark,
    m: P.fog,
    M: P.steel,
    g: P.gold,
  };
  return {
    upper: [
      '.....rr.......',
      '....rrsssh....',
      '...rssssssh...',
      '...sssssssss..',
      '..SsKKKKKsss..',
      '..SssKeKssss..',
      '..SSsssssssss.',
      '..SSswsssswss.',
      '...SSsssssss..',
      '....SSSSSS....',
      '..CCcccmmmM...',
      '.SCCcsssmMMM..',
      '.SCCcssscccS..',
      '.SCCcsssccc...',
      '..CCcsssscc...',
      '..bbbbgbbbb...',
      '..CCccCCcc....',
      '...CcC.CcC....',
    ],
    ouch: [
      [4, '..SsssKKKsss..'],
      [5, '..SssKKKssss..'],
      [7, '..SSswKKKKwss.'],
    ],
    pal,
    hip: 17,
    hipX: 6,
    shoulder: [10, 11],
    backShoulder: [3, 11],
    legH: 8,
    leg: { c: P.umber, C: P.ebony, foot: P.black, w: 2 },
    arm: { c: skin.s!, C: skin.S!, hand: skin.s!, len: 6, w: 2 },
    weapon: WEAPON[weapon]!,
  };
}

/** Esqueleto: calavera con las cuencas encendidas, costillas, columna y pelvis; huesos finos. */
export function skeletonBody(eye: string, helmet: boolean, weapon: string, shield: boolean): Biped {
  const pal: Pal = { w: P.mist, W: P.fog, h: P.white, K: P.black, e: eye, m: P.steel, M: P.slate };
  const head = helmet
    ? [
        '...mmmm..',
        '..mmmmmM.',
        '.mMMMMMMM',
        '.WwKKwKKw',
        '.WwKewKe.',
        '.WWwwwwww',
        '..WKwKwK.',
        '...WWWW..',
      ]
    : [
        '...www...',
        '..hwwwww.',
        '.wwwwwwww',
        '.WwKKwKKw',
        '.WwKewKe.',
        '.WWwwwwww',
        '..WKwKwK.',
        '...WWWW..',
      ];
  return {
    upper: [
      ...head,
      '....WwW...',
      '..whwwwhw.',
      '..W..W..W.',
      '..wwwWwww.',
      '...W.W.W..',
      '...wwWww..',
      '.....W....',
      '...wwWww..',
      '...W...W..',
    ],
    ouch: [
      [3, '.WwKKwKKw'],
      [4, '.WwKKwKK.'],
    ],
    pal,
    hip: 16,
    hipX: 5,
    shoulder: [7, 10],
    backShoulder: [3, 10],
    legH: 7,
    leg: { c: P.mist, C: P.fog, foot: P.fog, w: 1, bone: true },
    arm: { c: P.mist, C: P.fog, hand: P.mist, len: 5, w: 1 },
    weapon: WEAPON[weapon]!,
    shield: shield ? { c: P.rust, C: P.plum, rim: P.clay } : undefined,
  };
}

export { SKIN_G };

// ---------- Los de cuatro patas ----------

/** Lobo: hocico largo, orejas de punta, lomo oscuro, pecho claro y cola peluda. */
export function wolfBody(f: string, F: string, l: string): Quad {
  return {
    body: [
      '.................F.F...',
      '................FfFf...',
      '...............ffffff..',
      '..............fffyKfff.',
      'tt.....FFFFFFfffffffffK',
      '.tt..FFffffffffffflllll',
      '..ttFfffffffffffffflll.',
      '...tFffffffffffffffl...',
      '....Fflllllllllfffl....',
      '.....FlllllllllFF......',
    ],
    bite: [
      [4, 'tt.....FFFFFFfffffffffK'],
      [5, '.tt..FFffffffffffffKKKK'],
      [6, '..ttFfffffffffffffflwlw'],
      [7, '...tFffffffffffffffllll'],
    ],
    ouch: [[3, '..............fffKKfff.']],
    pal: { f, F, l, t: F, y: P.lemon, K: P.black, w: P.white },
    legsAt: [5, 7, 15, 17],
    legTop: 9,
    legH: 6,
    leg: { c: f, C: F, paw: darker(F, 1), w: 2 },
  };
}

/** Jabalí: cresta de cerdas en el lomo, hocico largo y chato y colmillos que suben. */
export function boarBody(): Quad {
  return {
    body: [
      '.....K.K.K.K.K..........',
      '....KfKfKfKfKfK.........',
      '...KfffffffffffKK.......',
      '..KffffffffffffffKK.....',
      '.tfffffffffffffffffKf...',
      'tFfffffffffffffffffyfff.',
      '.FFffffffffffffffffffRRR',
      '..FFffffffffffffffwffRR.',
      '...FFlllllllllllFFwf....',
      '....FFFllllllllFFF......',
    ],
    bite: [
      [6, '.FFffffffffffffffffffRRR'],
      [7, '..FFffffffffffffffwKKKK.'],
      [8, '...FFlllllllllllFFwlw...'],
    ],
    ouch: [[5, 'tFfffffffffffffffffKfff.']],
    pal: {
      f: P.cocoa,
      F: P.umber,
      l: P.mocha,
      K: P.ebony,
      t: P.ebony,
      y: P.red,
      R: P.coral,
      w: P.white,
    },
    legsAt: [5, 8, 14, 17],
    legTop: 9,
    legH: 6,
    leg: { c: P.mocha, C: P.umber, paw: P.black, w: 2 },
  };
}

/** Oso: grande y redondo, joroba en los hombros, orejas redondas y hocico claro. */
export function bearBody(f: string, F: string): Quad {
  return {
    body: [
      '...................FF....',
      '.........FFFFFF...Ffff...',
      '.......FFffffffFFfffff...',
      '......Ffffffffffffffyfl..',
      '.....Fffffffffffffffffll.',
      '....FffffffffffffffffflK.',
      '...FFffffffffffffffffll..',
      '...Fffffffffffffffffff...',
      '..tFfffffffffffffffff....',
      '...FFfffffffffffffff.....',
      '....FFfffffffffffFF......',
      '......FFFFFFFFFFF........',
    ],
    bite: [
      [5, '....FffffffffffffffffKKK.'],
      [6, '...FFffffffffffffffffwlw.'],
    ],
    ouch: [[3, '......FfffffffffffffKKfl..']],
    pal: { f, F, l: P.tan, K: P.black, t: F, y: P.black },
    legsAt: [5, 8, 15, 18],
    legTop: 11,
    legH: 5,
    leg: { c: f, C: F, paw: darker(F, 1), w: 3 },
  };
}

/** Rata grande: orejas redondas rosadas, bigotes, ojo rojo y la cola pelada. */
export function ratBody(f: string, F: string): Quad {
  return {
    body: [
      '..............pp...',
      '.............pPfp..',
      '.......FFFFFfffff..',
      '.....FFffffffffyfwK',
      'RR..FfffffffffffffK',
      '.RRFffffffffffflll.',
      '...RFfflllllllll...',
    ],
    bite: [
      [3, '.....FFffffffffyfwK'],
      [4, 'RR..FfffffffffffKKK'],
      [5, '.RRFffffffffffflwl.'],
    ],
    ouch: [[3, '.....FFfffffffKKfwK']],
    pal: { f, F, l: P.tan, p: P.coral, P: P.rose, R: P.coral, K: P.black, y: P.red, w: P.mist },
    legsAt: [5, 7, 12, 14],
    legTop: 6,
    legH: 3,
    leg: { c: f, C: F, paw: P.coral, w: 1 },
  };
}

// ---------- Bichos raros ----------

/** Araña: abdomen con su marca, cabeza con racimo de ojos rojos y ocho patas con codo. */
export function spiderPose(
  body: string,
  dark: string,
  light: string,
  mark: string,
  p: PoseSpec,
): PixelBuffer {
  const b = new PixelBuffer(32, 18);
  const G = 17;
  const cy = 10 + p.bob + (p.legs === 'crouch' ? 1 : 0);
  const cx = 14 + p.lean;
  // Las patas: cuatro por lado, con el codo alto y la punta fina; las del fondo, más oscuras.
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < 4; i++) {
      const far = side === 0;
      const c = far ? dark : body;
      const step = (p.legs === 'a' ? i % 2 : p.legs === 'b' ? (i + 1) % 2 : 0) ? 1 : 0;
      const root = cx - 2 + i;
      const dir = i < 2 ? -1 : 1;
      const spread = [11, 6, 6, 11][i]!;
      const kneeX = root + dir * Math.round(spread * 0.55);
      const kneeY = cy - 6 - step + (far ? 1 : 0) + (i === 1 || i === 2 ? 1 : 0);
      const footX = root + dir * spread + (far ? -dir : dir);
      if (p.legs === 'lunge' && i === 3 && !far) {
        limb(b, root, cy - 1, root + 5, cy - 8, c, 1);
        limb(b, root + 5, cy - 8, root + 10, cy - 5, c, 1);
        continue;
      }
      limb(b, root, cy - 1, kneeX, kneeY, c, 1);
      limb(b, kneeX, kneeY, footX, G - step, c, 1);
      if (!far) b.set(kneeX, kneeY, light);
    }
  // El abdomen (atrás), con luz arriba y su marca, y la cabeza delante.
  b.ellipse(cx - 4, cy - 2, 5.5, 4, (x, y) => {
    const u = (x - (cx - 4)) / 5.5 + (y - (cy - 2)) / 4;
    return u < -0.7 ? light : u > 0.8 ? dark : body;
  });
  paint(b, ['..m..', '.mmm.', '..m..'], { m: mark }, cx - 6, cy - 4);
  b.ellipse(cx + 3, cy, 3, 2.5, body);
  b.set(cx + 2, cy - 2, light);
  paint(b, ['.ee', 'eee', '.e.'], { e: P.red }, cx + 3, cy - 2);
  b.set(cx + 4, cy - 1, P.lemon);
  b.set(cx + 6, cy + 1, p.bite ? P.white : light);
  b.set(cx + 6, cy + 2, p.bite ? P.white : dark);
  return b;
}

/** Limo: gota con brillo, burbujas dentro, un hueso tragado y carita. */
export function slimePose(body: string, light: string, deep: string, p: PoseSpec): PixelBuffer {
  const b = new PixelBuffer(22, 18);
  const G = 17;
  const squash = { stand: 0, a: 1, b: -1, lunge: -3, crouch: 2 }[p.legs] + (p.hurt ? 2 : 0);
  const h = 11 - squash;
  const w = 8 + squash / 2;
  const cx = 10 + p.lean;
  const top = G - h;
  b.ellipse(cx, G - h / 2 + 0.5, w, h / 2 + 0.5, (x, y) => {
    const u = (x - cx) / w;
    const v = (y - (G - h / 2)) / (h / 2);
    if (u * u + v * v > 0.7 && v > 0) return deep;
    return v > 0.35 && bayer(x, y) < 0.5 ? deep : body;
  });
  // Brillo arriba a la izquierda y burbujas.
  b.hline(Math.round(cx - w * 0.5), top + 2, 3, light);
  b.set(Math.round(cx - w * 0.6), top + 3, light);
  b.set(Math.round(cx - w * 0.2), top + 1, P.white);
  b.set(cx - 2, G - 4, light);
  b.set(cx + 3, G - 3, light);
  // Lo tragado: un hueso.
  paint(b, ['w..w', '.ww.', 'w..w'].slice(0, 1).concat(['wwww']), { w: P.mist }, cx - 5, G - 4);
  // La cara.
  const ey = Math.round(G - h * 0.6);
  if (p.hurt) {
    b.hline(cx + 1, ey, 2, P.black);
    b.hline(cx + 4, ey, 2, P.black);
  } else {
    b.rect(cx + 1, ey - 1, 2, 2, P.black);
    b.rect(cx + 4, ey - 1, 2, 2, P.black);
    b.set(cx + 1, ey - 1, P.white);
    b.set(cx + 4, ey - 1, P.white);
  }
  if (p.bite) b.hline(cx + 2, ey + 2, 3, P.black);
  else b.set(cx + 3, ey + 2, deep);
  b.hline(Math.round(cx - w + 2), G, Math.round(w * 2 - 3), deep);
  return b;
}

/**
 * Espectro: capucha rota sin cara (dos ojos que brillan), túnica que flota deshilachada y manos
 * huesudas que se estiran al atacar.
 */
export function wraithPose(robe: string, shade: string, eye: string, p: PoseSpec, t: number) {
  const b = new PixelBuffer(24, 32);
  const float = 3 - p.bob - (p.legs === 'a' ? 1 : 0);
  const ox = 3 + p.lean;
  const oy = 2 + float;
  const rows = [
    '.....RRRR.....',
    '....RrrrrR....',
    '...RrrrrrrR...',
    '...rrKKKKrrR..',
    '..RrKKKKKKrR..',
    '..RrKeKKeKrR..',
    '..RrKKKKKKrR..',
    '..RrrKKKKrrR..',
    '.RRrrrrrrrrRR.',
    '.RrrrrrrrrrrR.',
    '.RrrRrrrrrRrR.',
    'RRrrRrrrrrRrrR',
    'RrrrRrrrrrRrrR',
    'RrrrrRrrrRrrrR',
    'RrrrrRrrrRrrrR',
    'RrrrrrRrRrrrrR',
    'RrrrrrRrRrrrrR',
    '.RrrrrRrRrrrR.',
    '.RrrrrrrrrrrR.',
    '..RrrrrrrrrR..',
  ];
  const pal: Pal = { r: robe, R: shade, K: P.black, e: p.hurt ? P.black : eye };
  paint(b, rows, pal, ox, oy);
  // El borde de abajo, en jirones que ondean.
  const bottom = oy + rows.length;
  for (let x = ox + 1; x < ox + 13; x++) {
    const len = 1 + ((x + t) % 3) + (x % 2);
    b.vline(x, bottom, len, (x + t) % 2 ? robe : shade);
  }
  // Las manos: de hueso, tendidas al atacar.
  const hand: Record<Arm, [number, number]> = {
    rest: [ox + 13, oy + 13],
    back: [ox + 2, oy + 6],
    forward: [ox + 19, oy + 10],
    up: [ox + 12, oy + 4],
  };
  const [hx, hy] = hand[p.hurt ? 'up' : p.arm];
  limb(b, ox + 11, oy + 10, hx, hy, shade, 2);
  paint(b, ['ww.', '.ww', 'w.w'], { w: P.mist }, hx, hy - 1);
  if (eye) b.set(ox + 5, oy + 5, p.hurt ? P.black : P.white);
  return b;
}

// ---------- El trol ----------

/**
 * Trol: el doble que un héroe, cargado de hombros, brazos largos hasta las rodillas, barriga,
 * taparrabos, verrugas y una porra. El cuerpo se pinta por formas (con luz y sombra tramadas) y
 * la cara, a mano.
 */
/** Dónde empieza el trol en su lienzo (con sitio para la porra a los lados y arriba). */
export const TROLL_X = 30;
/** El centro de sus pies, en el lienzo. */
export const TROLL_FOOT = TROLL_X + 18;

export function trollPose(skin: Pal, cloth: string, p: PoseSpec): PixelBuffer {
  const W = 96;
  const H = 88;
  const b = new PixelBuffer(W, H);
  const G = H - 1;
  const s = skin.s!;
  const S = skin.S!;
  const D = darker(S, 1);
  const hl = skin.h!;
  const crouch = p.legs === 'crouch' ? 3 : p.legs === 'lunge' ? 2 : 0;
  const ox = TROLL_X + p.lean;
  const oy = G - 52 + crouch + p.bob;
  const shade = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => {
    // Luz de arriba a la izquierda, sombra abajo a la derecha, con trama en el paso.
    const u = (x - cx) / rx + (y - cy) / ry;
    const k = u + (bayer(x, y) - 0.5) * 0.5;
    return k < -0.9 ? hl : k < 0.5 ? s : k < 1.1 ? S : D;
  };
  // Las piernas: gruesas y cortas, con el pie ancho.
  const feet: Record<Legs, [number, number]> = {
    stand: [-3, 3],
    a: [-6, 6],
    b: [4, -4],
    lunge: [-7, 8],
    crouch: [-5, 5],
  };
  const [fb, ff] = feet[p.legs];
  const hipY = oy + 38;
  const legDraw = (x: number, foot: number, c: string, c2: string) => {
    for (let y = hipY; y <= G - 2; y++) {
      const u = (y - hipY) / (G - 2 - hipY);
      const lx = Math.round(x + (foot - x) * u);
      b.rect(lx - 3, y, 7, 1, c);
      b.set(lx + 3, y, c2);
    }
    b.rect(foot - 4, G - 2, 10, 3, c2);
    b.hline(foot - 4, G - 2, 10, c);
    for (let k = 0; k < 3; k++) b.set(foot + 4 - k * 3, G, P.black);
  };
  legDraw(ox + 14, ox + 14 + fb, S, D);
  // El brazo de atrás, colgando.
  const backArm = p.arm === 'back' ? -8 : 0;
  limb(b, ox + 8, oy + 18, ox + 4 + backArm, oy + 40 + backArm, S, 5);
  b.ellipse(ox + 5 + backArm, oy + 41 + backArm, 3.5, 3, S);
  // La barriga y el tronco encorvado.
  b.ellipse(ox + 18, oy + 26, 15, 14, shade(ox + 18, oy + 26, 15, 14));
  b.ellipse(ox + 22, oy + 32, 10, 8, (x, y) =>
    shade(ox + 22, oy + 32, 10, 8)(x, y) === hl ? s : shade(ox + 22, oy + 32, 10, 8)(x, y),
  );
  b.ellipse(ox + 14, oy + 16, 12, 8, shade(ox + 14, oy + 16, 12, 8));
  // Verrugas y pelos en la espalda.
  for (const [x, y] of [
    [ox + 9, oy + 18],
    [ox + 12, oy + 24],
    [ox + 24, oy + 21],
  ] as const) {
    b.set(x, y, D);
    b.set(x - 1, y - 1, hl);
  }
  // El taparrabos, con su cuerda.
  const c = cloth;
  const C = darker(cloth, 1);
  b.rect(ox + 8, oy + 36, 22, 4, c);
  b.hline(ox + 8, oy + 36, 22, P.bark);
  for (let x = ox + 9; x < ox + 29; x += 3) b.vline(x, oy + 40, 3 + ((x * 7) % 3), x % 2 ? c : C);
  legDraw(ox + 22, ox + 22 + ff, s, S);
  // La cabeza, adelantada y baja: frente, ceja, nariz gorda, colmillos.
  const hx = ox + 22;
  const hy = oy + 6 + (p.hurt ? -1 : 0);
  paint(
    b,
    p.hurt
      ? [
          '...hhss.....',
          '..hssssss...',
          '.hsssssssss.',
          '.sKKKKssssS.',
          '.sssKKsssssS',
          '.sssssssnnnS',
          '.SssssssnnnS',
          '.SsKKKKKKsS.',
          '..SSSSSSSS..',
        ]
      : [
          '...hhss.....',
          '..hssssss...',
          '.hsssssssss.',
          '.sKKKKKssssS',
          '.sssyKssssss',
          '.sssssssnnnS',
          '.SssssssnnnS',
          '.SswsssswsS.',
          '..SSSSSSSS..',
        ],
    { h: hl, s, S, K: P.black, y: P.lemon, n: S, w: P.white },
    hx,
    hy,
  );
  if (p.bite) b.hline(hx + 3, hy + 7, 5, P.black);
  // El brazo de delante y la porra.
  const hand: Record<Arm, [number, number]> = {
    rest: [ox + 30, oy + 40],
    back: [ox + 6, oy + 6],
    forward: [ox + 46, oy + 22],
    up: [ox + 30, oy + 2],
  };
  const arm = p.hurt ? 'up' : p.arm;
  const [ax, ay] = hand[arm];
  const club = WEAPON.porra!;
  const big = {
    ...club,
    rows: club.rows.flatMap((r) => [
      r.replace(/./g, (ch) => ch + ch),
      r.replace(/./g, (ch) => ch + ch),
    ]),
    grip: [club.grip[0] * 2, club.grip[1] * 2] as [number, number],
  };
  weaponAt(b, big, ax, ay, ANGLE[arm]);
  limb(b, ox + 26, oy + 18, ax, ay, s, 5);
  limb(
    b,
    ox + 26,
    oy + 18,
    ox + 26 + Math.round((ax - ox - 26) / 2),
    oy + 18 + Math.round((ay - oy - 18) / 2),
    hl,
    2,
  );
  b.ellipse(ax + 1, ay + 1, 3.5, 3, S);
  b.set(ax, ay, s);
  return b;
}
