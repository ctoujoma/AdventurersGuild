/**
 * Los enemigos de los encargos, por familias (`data/journey.ts`): bandidos, trasgos (y orcos),
 * bestias (lobo, jabalí, oso), alimañas (rata grande, araña, limo), muertos (esqueleto,
 * espectro) y grandes (trols). Del tamaño de un héroe; el grande, el doble. Cada uno sale de una
 * semilla (colores, arma y, en algunas familias, qué bicho es) y tiene sus poses: quieto (dos
 * tiempos), andar (dos), atacar (cargar y golpe), golpe recibido y caído. Miran a la derecha;
 * quien los pinte los voltea. Sirven para la tira del encargo, los asaltos y los esbirros.
 *
 * Todas las poses de un enemigo miden lo mismo (menos la de caído, recortada) y apoyan los pies
 * en la última fila del dibujo (la de debajo es el contorno): se pintan por el centro de abajo.
 */
import { Rng } from '../core/rng';
import type { FoeKind } from '../data/journey';
import {
  bearBody,
  bipedPose,
  boarBody,
  goblinBody,
  orcBody,
  outline,
  quadPose,
  ratBody,
  skeletonBody,
  slimePose,
  spiderPose,
  trollPose,
  TROLL_FOOT,
  wolfBody,
  wraithPose,
  type Biped,
  type Pal,
  type PoseSpec,
  type Quad,
} from './foeSprites';
import { P } from './palette';
import { PixelBuffer, alpha } from './pixel';
import { FEET_Y, fightSprites, heroSprites } from './heroes/hero';
import { BANDIT_TYPES, banditLook } from '../world/battle';
import type { WeaponId } from '../world/weapons';

export type { FoeKind };

export type FoePose = 'idle' | 'idle2' | 'walk1' | 'walk2' | 'windup' | 'strike' | 'hurt' | 'down';

export const FOE_POSES: readonly FoePose[] = [
  'idle',
  'idle2',
  'walk1',
  'walk2',
  'windup',
  'strike',
  'hurt',
  'down',
];

export interface FoeArt {
  kind: FoeKind;
  /** Qué es, dentro de la familia (`lobo`, `arana`, `orco`…), por si se quiere nombrar. */
  what: string;
  poses: Record<FoePose, PixelBuffer>;
  /** Centro de los pies dentro del dibujo (de pie), para pintarlo por ahí. */
  foot: number;
  /** Altura del pecho sobre el suelo (donde se apuntan los golpes y sale el destello). */
  chest: number;
  /** Lo que ocupa a lo ancho en una fila (para separarlos). */
  span: number;
  /** El doble de grande que un héroe. */
  big: boolean;
  /**
   * Los bandidos son los de los asaltos (`banditLook`): figuras de héroe sin el arma, que se
   * pinta aparte en la mano (`HAND`), como en la pelea.
   */
  hand?: { weapon: WeaponId };
}

/** Recorta lo vacío alrededor (para la pose de caído). */
function trim(b: PixelBuffer): PixelBuffer {
  let x0 = b.w;
  let y0 = b.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      if (alpha(b.get(x, y))) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? b : b.crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

/** Tumbado boca arriba: girado un cuarto (la cabeza, atrás). */
function rotated(b: PixelBuffer): PixelBuffer {
  const r = new PixelBuffer(b.h, b.w);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (alpha(c)) r.data[(b.w - 1 - x) * r.w + y] = c;
    }
  return r;
}

/** Patas arriba (los bichos caídos). */
function upsideDown(b: PixelBuffer): PixelBuffer {
  const r = new PixelBuffer(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) r.data[(b.h - 1 - y) * b.w + x] = b.data[y * b.w + x]!;
  return r;
}

// ---------- Las poses ----------

const POSE: Record<Exclude<FoePose, 'down'>, PoseSpec> = {
  idle: { legs: 'stand', arm: 'rest', lean: 0, bob: 0 },
  idle2: { legs: 'stand', arm: 'rest', lean: 0, bob: 1 },
  walk1: { legs: 'a', arm: 'rest', lean: 0, bob: 0 },
  walk2: { legs: 'b', arm: 'rest', lean: 0, bob: 1 },
  windup: { legs: 'crouch', arm: 'back', lean: -1, bob: 1 },
  strike: { legs: 'lunge', arm: 'forward', lean: 2, bob: 0, bite: true },
  hurt: { legs: 'stand', arm: 'up', lean: -2, bob: 0, hurt: true },
};

const STANDING = Object.keys(POSE) as Exclude<FoePose, 'down'>[];

const pick = <T>(rng: Rng, list: readonly T[]) => list[rng.int(0, list.length - 1)]!;

/** Todas las poses de pie con `paint`, y la de caído a partir de la de quieto. */
function posesOf(
  paintPose: (p: PoseSpec, i: number) => PixelBuffer,
  down: (idle: PixelBuffer) => PixelBuffer,
): Record<FoePose, PixelBuffer> {
  const poses = {} as Record<FoePose, PixelBuffer>;
  STANDING.forEach((p, i) => (poses[p] = outline(paintPose(POSE[p], i))));
  poses.down = down(poses.idle);
  return poses;
}

function bipedArt(kind: FoeKind, what: string, d: Biped): FoeArt {
  const poses = posesOf(
    (p) => bipedPose(d, p),
    (idle) => trim(rotated(idle)),
  );
  const reach = Math.max(...d.weapon.rows.map((r) => r.length), d.weapon.rows.length);
  const tw = Math.max(...d.upper.map((r) => r.length));
  return {
    kind,
    what,
    poses,
    foot: reach + 2 + d.hipX + 1,
    chest: d.legH + d.hip - d.shoulder[1],
    span: tw + 2,
    big: false,
  };
}

function quadArt(kind: FoeKind, what: string, d: Quad): FoeArt {
  const poses = posesOf(
    (p) => quadPose(d, p),
    (idle) => trim(upsideDown(idle)),
  );
  const tw = Math.max(...d.body.map((r) => r.length));
  return {
    kind,
    what,
    poses,
    foot: 4 + Math.round((d.legsAt[0] + d.legsAt[3]) / 2),
    chest: d.legH + Math.round(d.legTop / 2),
    span: tw,
    big: false,
  };
}

/** El arma de cada tipo de bandido de los asaltos. */
const BANDIT_WEAPON: Record<string, WeaponId> = {
  bruto: 'garrote',
  navajero: 'daga',
  arquero: 'arco',
  incendiario: 'antorcha',
};

/** Un bandido de los asaltos: la misma figura que los héroes (y que en la taberna). */
function bandit(rng: Rng): FoeArt {
  const style = pick(rng, BANDIT_TYPES);
  const { look, marks } = banditLook(style, rng.int(0, 99));
  const f = fightSprites(look, marks);
  const walk = heroSprites(look, marks).walk;
  const poses: Record<FoePose, PixelBuffer> = {
    idle: f.ready,
    idle2: f.ready,
    walk1: walk[0]!,
    walk2: walk[4]!,
    windup: f.windup,
    strike: f.strike,
    hurt: f.up,
    down: trim(rotated(f.ready)),
  };
  return {
    kind: 'bandido',
    what: style,
    poses,
    foot: 9,
    chest: FEET_Y - 14,
    span: 12,
    big: false,
    hand: { weapon: BANDIT_WEAPON[style] ?? 'daga' },
  };
}

/** Pieles verdes (y la gris de los orcos de la sierra), de la luz a la sombra. */
const GREEN: Pal[] = [
  { h: P.lemon, s: P.lime, S: P.leaf },
  { h: P.lime, s: P.leaf, S: P.forest },
];
const ORC_SKIN: Pal[] = [
  { h: P.lime, s: P.leaf, S: P.forest },
  { h: P.leaf, s: P.forest, S: P.deep },
  { h: P.fog, s: P.steel, S: P.slate },
];

function goblin(rng: Rng): FoeArt {
  if (rng.chance(0.35))
    return bipedArt(
      'trasgo',
      'orco',
      orcBody(
        pick(rng, ORC_SKIN),
        pick(rng, [P.bark, P.rust, P.wine]),
        pick(rng, ['hacha', 'garrote']),
      ),
    );
  return bipedArt(
    'trasgo',
    'trasgo',
    goblinBody(
      pick(rng, GREEN),
      pick(rng, [P.bark, P.umber, P.wine, P.mocha]),
      pick(rng, ['lanza', 'daga', 'garrote']),
    ),
  );
}

function beast(rng: Rng): FoeArt {
  const roll = rng.next();
  if (roll < 0.5) {
    const [f, F, l] = pick(rng, [
      [P.fog, P.steel, P.mist],
      [P.steel, P.slate, P.fog],
      [P.cocoa, P.umber, P.tan],
      [P.slate, P.navy, P.steel],
    ] as const);
    return quadArt('bestia', 'lobo', wolfBody(f, F, l));
  }
  if (roll < 0.8) return quadArt('bestia', 'jabali', boarBody());
  const [f, F] = pick(rng, [
    [P.cocoa, P.umber],
    [P.mocha, P.ebony],
    [P.oak, P.bark],
  ] as const);
  return quadArt('bestia', 'oso', bearBody(f, F));
}

function vermin(rng: Rng): FoeArt {
  const roll = rng.next();
  if (roll < 0.4) {
    const [f, F] = pick(rng, [
      [P.clay, P.rust],
      [P.steel, P.slate],
      [P.cocoa, P.umber],
    ] as const);
    return quadArt('alimana', 'rata', ratBody(f, F));
  }
  if (roll < 0.75) {
    const [body, dark, light] = pick(rng, [
      [P.grape, P.plum, P.rose],
      [P.slate, P.navy, P.steel],
      [P.mocha, P.ebony, P.cocoa],
    ] as const);
    const mark = pick(rng, [P.red, P.gold, P.lemon]);
    const poses = posesOf(
      (p) => spiderPose(body, dark, light, mark, p),
      (idle) => trim(upsideDown(idle)),
    );
    return { kind: 'alimana', what: 'arana', poses, foot: 15, chest: 8, span: 24, big: false };
  }
  const [body, light, deep] = pick(rng, [
    [P.lime, P.lemon, P.leaf],
    [P.cyan, P.white, P.sky],
    [P.coral, P.sand, P.rose],
  ] as const);
  const poses = posesOf(
    (p) => slimePose(body, light, deep, p),
    () => {
      // Caído: un charco con el hueso.
      const puddle = new PixelBuffer(20, 4);
      puddle.ellipse(10, 2, 9.5, 2, (x, y) => (y < 2 && x < 9 ? light : x > 12 ? deep : body));
      puddle.hline(7, 1, 4, P.mist);
      return outline(puddle);
    },
  );
  return { kind: 'alimana', what: 'limo', poses, foot: 11, chest: 7, span: 18, big: false };
}

function undead(rng: Rng): FoeArt {
  if (rng.chance(0.3)) {
    const [robe, shade, eye] = pick(rng, [
      [P.slate, P.navy, P.cyan],
      [P.grape, P.plum, P.lime],
      [P.steel, P.slate, P.lemon],
    ] as const);
    const poses = posesOf(
      (p, i) => wraithPose(robe, shade, eye, p, i),
      () => {
        // Caído: la túnica vacía en el suelo.
        const heap = new PixelBuffer(18, 5);
        heap.ellipse(9, 3.5, 8.5, 3, (x) => (x < 6 ? shade : robe));
        heap.set(13, 2, P.mist);
        return outline(heap);
      },
    );
    return { kind: 'muerto', what: 'espectro', poses, foot: 10, chest: 18, span: 18, big: false };
  }
  return bipedArt(
    'muerto',
    'esqueleto',
    skeletonBody(
      pick(rng, [P.red, P.lime, P.cyan]),
      rng.chance(0.4),
      pick(rng, ['oxidada', 'lanza', 'hacha']),
      rng.chance(0.4),
    ),
  );
}

function troll(rng: Rng): FoeArt {
  const skin = pick(rng, [
    { h: P.lime, s: P.leaf, S: P.forest },
    { h: P.fog, s: P.steel, S: P.slate },
    { h: P.leaf, s: P.forest, S: P.deep },
  ]);
  const cloth = pick(rng, [P.bark, P.umber, P.rust]);
  const { poses, shift } = trimAll(
    posesOf(
      (p) => trollPose(skin, cloth, p),
      (idle) => trim(rotated(idle)),
    ),
  );
  return {
    kind: 'grande',
    what: skin.s === P.steel ? 'trol de piedra' : 'trol',
    poses,
    foot: TROLL_FOOT - shift,
    chest: 30,
    span: 36,
    big: true,
  };
}

/**
 * Recorta el aire de los lados de todas las poses de pie a la vez (el mismo trozo en todas, para
 * que no bailen) y ajusta la columna de los pies.
 */
function trimAll(poses: Record<FoePose, PixelBuffer>): {
  poses: Record<FoePose, PixelBuffer>;
  shift: number;
} {
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  for (const p of STANDING) {
    const b = poses[p];
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++)
        if (alpha(b.get(x, y))) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
        }
  }
  const out = { ...poses };
  for (const p of STANDING) {
    const b = poses[p];
    out[p] = b.crop(x0, y0, x1 - x0 + 1, b.h - y0);
  }
  return { poses: out, shift: x0 };
}

const FAMILY: Record<FoeKind, (rng: Rng) => FoeArt> = {
  bandido: bandit,
  trasgo: goblin,
  bestia: beast,
  alimana: vermin,
  muerto: undead,
  grande: troll,
};

const cache = new Map<string, FoeArt>();

/** Un enemigo de la familia `kind`, siempre el mismo para la misma semilla. */
export function foeArt(kind: FoeKind, seed: string): FoeArt {
  const key = `${kind}:${seed}`;
  let a = cache.get(key);
  if (!a) {
    a = FAMILY[kind](new Rng(`enemigo-${key}`));
    cache.set(key, a);
  }
  return a;
}
