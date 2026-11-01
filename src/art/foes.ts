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
import { P, darker } from './palette';
import { PixelBuffer, alpha, toHex } from './pixel';
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

const outline = (b: PixelBuffer) => b.outlined((n) => darker(toHex(n), 3));

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

// ---------- Las poses, por partes ----------

type Legs = 'stand' | 'a' | 'b' | 'lunge' | 'crouch';
type Arm = 'rest' | 'back' | 'forward' | 'up';

interface Pose {
  legs: Legs;
  arm: Arm;
  /** Cuánto se corre el cuerpo hacia delante (o atrás) y cuánto baja. */
  lean: number;
  bob: number;
  /** Boca abierta (los bichos al morder). */
  bite?: boolean;
}

const POSE: Record<Exclude<FoePose, 'down'>, Pose> = {
  idle: { legs: 'stand', arm: 'rest', lean: 0, bob: 0 },
  idle2: { legs: 'stand', arm: 'rest', lean: 0, bob: 1 },
  walk1: { legs: 'a', arm: 'rest', lean: 0, bob: 0 },
  walk2: { legs: 'b', arm: 'rest', lean: 0, bob: 1 },
  windup: { legs: 'crouch', arm: 'back', lean: -1, bob: 1 },
  strike: { legs: 'lunge', arm: 'forward', lean: 2, bob: 0, bite: true },
  hurt: { legs: 'stand', arm: 'up', lean: -2, bob: 0 },
};

const STANDING = Object.keys(POSE) as Exclude<FoePose, 'down'>[];

// ---------- De dos patas: bandidos, trasgos, orcos, esqueletos y trols ----------

type Weapon = 'daga' | 'espada' | 'hacha' | 'garrote' | 'lanza' | 'baston';

interface Humanoid {
  /** De los pies a la coronilla. */
  h: number;
  /** Ancho del torso y de la cabeza. */
  wide: number;
  head: number;
  skin: string;
  skinD: string;
  cloth: string;
  clothD: string;
  legs: string;
  boots: string;
  eye: string;
  hair?: string;
  hood?: string;
  bandana?: string;
  ears?: boolean;
  tusks?: boolean;
  /** Calavera: cuencas negras, dientes y costillas. */
  skull?: boolean;
  /** Cargado de hombros (trols): la cabeza, adelantada y baja. */
  hunch?: boolean;
  weapon: Weapon;
  metal: string;
  wood: string;
  shield?: string;
}

/** Hacia dónde apunta el arma en cada postura del brazo. */
const AIM: Record<Arm, [number, number]> = {
  rest: [0.35, -1],
  back: [-0.8, -1],
  forward: [1, 0.1],
  up: [0.15, -1],
};

const REACH: Record<Weapon, number> = {
  daga: 4,
  espada: 8,
  hacha: 8,
  garrote: 8,
  lanza: 13,
  baston: 11,
};

function humanoidPose(d: Humanoid, p: Pose): PixelBuffer {
  const k = d.h / 26;
  const W = Math.round(30 * k) + 6;
  const H = d.h + Math.round(10 * k);
  const b = new PixelBuffer(W, H);
  const G = H - 1;
  const cx = Math.round(W * 0.42);
  const legH = Math.round(d.h * 0.37);
  const torsoH = Math.round(d.h * 0.37);
  const headH = d.h - legH - torsoH;
  const legW = Math.max(2, Math.round(d.wide / 3));
  const hip = G - legH + 1;
  const crouch = p.legs === 'crouch' ? Math.round(2 * k) : 0;

  // Las piernas: de la cadera al pie, la de atrás más oscura.
  const spread = { stand: [0, 0], a: [3, -2], b: [-2, 3], lunge: [5, -4], crouch: [2, -2] }[
    p.legs
  ].map((v) => Math.round(v * k));
  const leg = (hx: number, foot: number, color: string) => {
    const top = hip + crouch;
    for (let y = top; y <= G; y++) {
      const u = (y - top) / Math.max(1, G - top);
      const x = Math.round(hx + (foot - hx) * u);
      b.rect(x, y, legW, 1, y > G - 2 ? d.boots : color);
      if (y > G - 2) b.set(x + legW, y, d.boots);
    }
  };
  const backX = cx - legW + 1 + p.lean;
  const frontX = cx + 1 + p.lean;
  leg(backX, backX + spread[1]!, darker(d.legs, 1));

  // El torso: con sombra atrás, cinturón abajo y, encorvado, la espalda redonda.
  const top = hip - torsoH + p.bob + crouch;
  const x0 = cx - Math.floor(d.wide / 2) + p.lean;
  b.rect(x0, top, d.wide, torsoH, d.cloth);
  b.rect(x0, top, Math.max(1, Math.round(d.wide / 4)), torsoH, d.clothD);
  b.hline(x0, top + torsoH - 1, d.wide, d.clothD);
  if (d.hunch) b.rect(x0 - 1, top + 1, d.wide - 2, Math.round(torsoH / 3), d.cloth);
  if (d.skull)
    for (let y = top + 1; y < top + torsoH - 2; y += 2) b.hline(x0 + 1, y, d.wide - 2, d.clothD);
  if (d.shield) {
    const sh = Math.round(7 * k);
    const sw = Math.round(5 * k);
    b.rect(x0 - Math.round(2 * k), top + 1, sw, sh, d.shield);
    b.vline(x0 - Math.round(2 * k), top + 1, sh, d.metal);
    b.set(x0 - Math.round(2 * k) + Math.floor(sw / 2), top + Math.floor(sh / 2) + 1, d.metal);
  }
  leg(frontX, frontX + spread[0]!, d.legs);

  // La cabeza.
  const hx = x0 + Math.round((d.wide - d.head) / 2) + (d.hunch ? Math.round(3 * k) : 0);
  const hy = top - headH + (d.hunch ? Math.round(3 * k) : 0) + (p.arm === 'up' ? 0 : 0);
  b.rect(hx, hy, d.head, headH, d.skin);
  b.vline(hx, hy, headH, d.skinD);
  const ey = hy + Math.round(headH * 0.45);
  if (d.skull) {
    b.rect(hx + d.head - 3, ey - 1, 2, 2, P.black);
    b.set(hx + d.head - 2, ey - 1, d.eye);
    b.hline(hx + d.head - 4, hy + headH - 1, 3, d.skinD);
    b.set(hx + d.head - 3, hy + headH - 1, d.skin);
  } else {
    b.set(hx + d.head - 2, ey, d.eye);
    b.set(hx + d.head - 1, ey + 1, d.skinD);
  }
  if (d.ears) {
    // Orejas largas de punta, hacia atrás y arriba, y la nariz ganchuda.
    b.line(hx - 1, hy + 2, hx - 3, hy, d.skin);
    b.line(hx - 1, hy + 3, hx - 3, hy + 1, d.skinD);
    b.set(hx + d.head, ey + 1, d.skin);
    b.set(hx + d.head, ey + 2, d.skinD);
  }
  if (d.tusks) {
    b.set(hx + d.head - 1, hy + headH - 1, P.white);
    b.set(hx + d.head - 1, hy + headH - 2, P.mist);
  }
  if (d.hair) {
    b.hline(hx, hy, d.head, d.hair);
    b.vline(hx, hy, Math.max(2, headH - 2), d.hair);
  }
  if (d.hood) {
    b.rect(hx - 1, hy - 1, d.head + 1, 2, d.hood);
    b.rect(hx - 1, hy, 2, headH, d.hood);
    b.set(hx + d.head - 1, hy, d.hood);
  }
  if (d.bandana) {
    b.hline(hx + 1, ey + 1, d.head - 1, d.bandana);
    b.hline(hx + 1, ey + 2, d.head - 1, d.bandana);
  }

  // El brazo y el arma.
  const sx = x0 + d.wide - 2;
  const sy = top + 1;
  const hand: Record<Arm, [number, number]> = {
    rest: [sx + 1, top + torsoH - 2],
    back: [x0 - 1, top - Math.round(2 * k)],
    forward: [x0 + d.wide + Math.round(4 * k), top + Math.round(2 * k)],
    up: [sx + 1, top - Math.round(3 * k)],
  };
  const [ax, ay] = hand[p.arm];
  const thick = Math.max(2, Math.round(2 * k));
  for (let i = 0; i < thick; i++) b.line(sx, sy + i, ax, ay + i, d.clothD);
  const [dx, dy] = AIM[p.arm];
  const len = Math.round(REACH[d.weapon] * k);
  const n = Math.hypot(dx, dy);
  const tip = (t: number): [number, number] => [
    Math.round(ax + (dx / n) * t),
    Math.round(ay + (dy / n) * t),
  ];
  const [tx, ty] = tip(len);
  const shaft = d.weapon === 'daga' || d.weapon === 'espada' ? d.metal : d.wood;
  b.line(ax, ay, tx, ty, shaft);
  if (d.weapon === 'garrote' || (d.weapon === 'baston' && k > 1)) {
    const [mx, my] = tip(len - 1);
    b.line(mx, my, tx, ty, d.wood);
    b.rect(tx - 1, ty - 1, 2 + Math.round(k), 2 + Math.round(k), darker(d.wood, 1));
  }
  if (d.weapon === 'hacha') b.rect(tx - 1, ty - 1, 3, 3, d.metal);
  if (d.weapon === 'lanza') {
    const [mx, my] = tip(len - 2);
    b.line(mx, my, tx, ty, d.metal);
  }
  if (d.weapon === 'baston') b.set(tx, ty, P.lime);
  if (d.weapon === 'espada') {
    const [gx, gy] = tip(1);
    b.set(gx + Math.round(-dy / n), gy + Math.round(dx / n), P.gold);
    b.set(gx - Math.round(-dy / n), gy - Math.round(dx / n), P.gold);
  }
  b.rect(ax, ay, thick, thick, d.skull ? d.skin : d.skin);
  return b;
}

// ---------- De cuatro patas: lobos, jabalíes, osos y ratas grandes ----------

interface Beast {
  len: number;
  tall: number;
  legH: number;
  head: number;
  fur: string;
  furD: string;
  belly: string;
  eye: string;
  nose: string;
  tusks?: boolean;
  mane?: string;
  ears: 'punta' | 'redonda';
  tail: 'larga' | 'corta' | 'pelada';
  tailColor?: string;
}

function beastPose(d: Beast, p: Pose): PixelBuffer {
  const W = d.len + d.head + 10;
  const H = d.tall + d.legH + 6;
  const b = new PixelBuffer(W, H);
  const G = H - 1;
  const crouch = p.legs === 'crouch' ? 2 : 0;
  const leap = p.legs === 'lunge';
  const x0 = 4 + Math.max(0, p.lean);
  const top = G - d.legH - d.tall + 1 + p.bob + crouch - (leap ? 1 : 0);
  // Las patas: dos atrás y dos delante, la del fondo más oscura.
  const legsAt = [x0 + 1, x0 + 3, x0 + d.len - 4, x0 + d.len - 2];
  const swing = { stand: [0, 0], a: [2, -1], b: [-1, 2], lunge: [-2, 4], crouch: [1, 1] }[p.legs];
  legsAt.forEach((lx, i) => {
    const front = i >= 2;
    const s = swing[i % 2]!;
    const far = i % 2 === 0;
    const c = far ? d.furD : d.fur;
    const y0 = top + d.tall - 1;
    if (front && leap) {
      // Saltando: las de delante, por delante y en alto.
      b.line(lx, y0, lx + 3, y0 + d.legH - 3, c);
      b.line(lx + 1, y0, lx + 4, y0 + d.legH - 3, c);
      return;
    }
    for (let y = y0; y <= G; y++) {
      const u = (y - y0) / Math.max(1, G - y0);
      b.rect(Math.round(lx + s * u), y, 2, 1, y === G ? darker(c, 1) : c);
    }
  });
  // El cuerpo: un barril redondeado, más claro por la tripa.
  b.ellipse(x0 + d.len / 2, top + d.tall / 2, d.len / 2, d.tall / 2, (x, y) =>
    y > top + d.tall * 0.7 ? d.belly : x < x0 + 2 ? d.furD : d.fur,
  );
  if (d.mane) b.rect(x0 + d.len - 6, top - 1, 5, 3, d.mane);
  // La cola.
  const ty = top + Math.round(d.tall * 0.3);
  const tc = d.tailColor ?? d.furD;
  if (d.tail === 'larga') b.line(x0, ty, x0 - 4, ty + (p.bob ? 3 : 2), tc);
  else if (d.tail === 'corta') b.line(x0, ty, x0 - 2, ty - 1, tc);
  else b.line(x0, ty + 1, x0 - 6, ty + 3 + p.bob, tc);
  // La cabeza, delante: hocico, ojo, oreja y, mordiendo, la boca abierta.
  const hx = x0 + d.len - 3;
  const hy =
    top - Math.round(d.head * 0.4) + (p.legs === 'crouch' ? 2 : 0) + (p.arm === 'up' ? -1 : 0);
  b.rect(hx, hy, d.head, d.head - 1, d.fur);
  b.rect(hx + d.head, hy + 2, Math.round(d.head * 0.6), d.head - 3, d.fur);
  b.set(hx + d.head + Math.round(d.head * 0.6) - 1, hy + 2, d.nose);
  b.set(hx + d.head - 2, hy + 1, d.eye);
  if (d.ears === 'punta') {
    b.set(hx + 1, hy - 1, d.furD);
    b.set(hx + 1, hy - 2, d.furD);
    b.set(hx + 2, hy - 1, d.fur);
  } else b.rect(hx + 1, hy - 1, 2, 1, d.furD);
  const jaw = hy + d.head - 2;
  if (p.bite) {
    b.hline(hx + d.head - 1, jaw, Math.round(d.head * 0.6) + 1, P.black);
    b.hline(hx + d.head, jaw + 1, Math.round(d.head * 0.6), d.fur);
    b.set(hx + d.head + 1, jaw - 1, P.white);
  }
  if (d.tusks) {
    b.set(hx + d.head + 1, jaw - 1, P.white);
    b.set(hx + d.head + 1, jaw - 2, P.mist);
  }
  return b;
}

// ---------- Bichos sin patas o con muchas: araña, limo y espectro ----------

function spiderPose(body: string, dark: string, eye: string, p: Pose): PixelBuffer {
  const b = new PixelBuffer(24, 16);
  const G = 15;
  const cy = 9 + p.bob + (p.legs === 'crouch' ? 1 : 0);
  const cx = 10 + p.lean;
  // Ocho patas dobladas (cuatro por lado; las de atrás, más oscuras).
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const along = (i % 2) * 3 + 1;
    const lift = (p.legs === 'a' && i % 2 === 0) || (p.legs === 'b' && i % 2 === 1) ? 1 : 0;
    const knee = [cx + side * (along + 2), cy - 4 - lift] as const;
    const foot = [cx + side * (along + 5), G - lift] as const;
    const c = i % 2 ? body : dark;
    if (p.legs === 'lunge' && side > 0) {
      b.line(cx + 2, cy - 1, cx + 7, cy - 6, c);
      b.line(cx + 7, cy - 6, cx + 9, cy - 3, c);
      continue;
    }
    b.line(cx + side, cy - 1, knee[0], knee[1], c);
    b.line(knee[0], knee[1], foot[0], foot[1], c);
  }
  b.ellipse(cx - 2, cy, 5, 4, (x, y) => ((x + y) % 3 ? body : dark));
  b.ellipse(cx + 3, cy, 3, 2.5, body);
  b.set(cx + 4, cy - 1, eye);
  b.set(cx + 5, cy, eye);
  if (p.bite) b.set(cx + 6, cy + 1, P.white);
  return b;
}

function slimePose(body: string, light: string, eye: string, p: Pose): PixelBuffer {
  const b = new PixelBuffer(20, 16);
  const G = 15;
  const squash = { stand: 0, a: 1, b: -1, lunge: -3, crouch: 2 }[p.legs] + (p.arm === 'up' ? 2 : 0);
  const h = 9 - squash;
  const w = 7 + squash / 2;
  const cx = 9 + p.lean;
  b.ellipse(cx, G - h / 2 + 0.5, w, h / 2 + 0.5, (x, y) =>
    y < G - h * 0.6 && x < cx ? light : body,
  );
  b.hline(Math.round(cx - w + 1), G, Math.round(w * 2 - 1), darker(body, 1));
  const ey = Math.round(G - h * 0.6);
  b.set(cx + 2, ey, eye);
  b.set(cx + 4, ey, eye);
  if (p.bite) b.hline(cx + 2, ey + 2, 3, P.black);
  // Algo tragado dentro: un hueso.
  b.hline(cx - 3, G - 2, 3, P.mist);
  return b;
}

function ghostPose(sheet: string, shade: string, eye: string, p: Pose, t: number): PixelBuffer {
  const b = new PixelBuffer(22, 30);
  const float = 3 - p.bob - (p.legs === 'a' ? 1 : 0);
  const cx = 10 + p.lean;
  const top = 4 + float;
  const bottom = 29 - float;
  b.ellipse(cx, top + 5, 6, 5, sheet);
  b.rect(cx - 6, top + 5, 12, bottom - top - 7, sheet);
  b.vline(cx - 6, top + 5, bottom - top - 7, shade);
  // El borde de abajo, deshilachado (cambia con el tiempo).
  for (let x = cx - 6; x < cx + 6; x++)
    if ((x + t) % 3) b.set(x, bottom - 2 + ((x + t) % 2), sheet);
  b.rect(cx + 1, top + 4, 2, 2, P.black);
  b.rect(cx + 4, top + 4, 1, 2, P.black);
  b.set(cx + 1, top + 4, eye);
  b.rect(cx + 2, top + 8, 2, 2, shade);
  // Los brazos: tendidos al atacar.
  const [ax, ay] =
    p.arm === 'forward'
      ? [cx + 11, top + 10]
      : p.arm === 'back'
        ? [cx - 3, top + 4]
        : [cx + 6, top + 14];
  b.line(cx + 4, top + 11, ax, ay, sheet);
  b.line(cx + 4, top + 12, ax, ay + 1, shade);
  return b;
}

// ---------- Las familias, con sus variantes ----------

const pick = <T>(rng: Rng, list: readonly T[]) => list[rng.int(0, list.length - 1)]!;

function humanoidArt(kind: FoeKind, what: string, d: Humanoid): FoeArt {
  const poses = {} as Record<FoePose, PixelBuffer>;
  for (const p of STANDING) poses[p] = outline(humanoidPose(d, POSE[p]));
  poses.down = trim(rotated(poses.idle));
  const W = poses.idle.w;
  return {
    kind,
    what,
    poses,
    foot: Math.round((W - 2) * 0.42) + 1,
    chest: Math.round(d.h * 0.55),
    span: d.wide + 8,
    big: d.h > 40,
  };
}

function beastArt(what: string, d: Beast): FoeArt {
  const poses = {} as Record<FoePose, PixelBuffer>;
  for (const p of STANDING) poses[p] = outline(beastPose(d, POSE[p]));
  poses.down = trim(upsideDown(poses.idle));
  return {
    kind: what === 'rata' ? 'alimana' : 'bestia',
    what,
    poses,
    foot: Math.round(4 + d.len / 2) + 1,
    chest: d.legH + Math.round(d.tall / 2),
    span: d.len + d.head + 2,
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

function goblin(rng: Rng): FoeArt {
  if (rng.chance(0.35)) {
    // Orco: más alto y ancho, gris verdoso, con colmillos.
    const skin = pick(rng, [P.leaf, P.forest, P.steel]);
    return humanoidArt('trasgo', 'orco', {
      h: 24,
      wide: 9,
      head: 7,
      skin,
      skinD: darker(skin, 1),
      cloth: pick(rng, [P.bark, P.rust, P.slate]),
      clothD: P.ebony,
      legs: P.umber,
      boots: P.black,
      eye: P.red,
      hair: P.black,
      tusks: true,
      weapon: pick(rng, ['hacha', 'garrote'] as const),
      metal: P.steel,
      wood: P.bark,
    });
  }
  const skin = pick(rng, [P.lime, P.leaf]);
  return humanoidArt('trasgo', 'trasgo', {
    h: 18,
    wide: 6,
    head: 7,
    skin,
    skinD: darker(skin, 1),
    cloth: pick(rng, [P.bark, P.umber, P.wine]),
    clothD: P.ebony,
    legs: darker(skin, 1),
    boots: P.bark,
    eye: P.lemon,
    ears: true,
    weapon: pick(rng, ['lanza', 'daga', 'garrote'] as const),
    metal: P.fog,
    wood: P.oak,
  });
}

function beast(rng: Rng): FoeArt {
  const roll = rng.next();
  if (roll < 0.5) {
    const fur = pick(rng, [P.steel, P.fog, P.umber, P.slate]);
    return beastArt('lobo', {
      len: 15,
      tall: 7,
      legH: 6,
      head: 6,
      fur,
      furD: darker(fur, 1),
      belly: fur === P.fog ? P.mist : P.fog,
      eye: P.lemon,
      nose: P.black,
      ears: 'punta',
      tail: 'larga',
    });
  }
  if (roll < 0.8)
    return beastArt('jabali', {
      len: 15,
      tall: 9,
      legH: 4,
      head: 7,
      fur: P.bark,
      furD: P.ebony,
      belly: P.rust,
      eye: P.red,
      nose: P.coral,
      tusks: true,
      mane: P.ebony,
      ears: 'punta',
      tail: 'corta',
    });
  const fur = pick(rng, [P.cocoa, P.bark, P.mocha]);
  return beastArt('oso', {
    len: 18,
    tall: 11,
    legH: 5,
    head: 7,
    fur,
    furD: darker(fur, 1),
    belly: P.tan,
    eye: P.black,
    nose: P.black,
    ears: 'redonda',
    tail: 'corta',
  });
}

function vermin(rng: Rng): FoeArt {
  const roll = rng.next();
  if (roll < 0.4)
    return beastArt('rata', {
      len: 12,
      tall: 6,
      legH: 3,
      head: 5,
      fur: pick(rng, [P.clay, P.steel, P.cocoa]),
      furD: P.rust,
      belly: P.tan,
      eye: P.red,
      nose: P.coral,
      ears: 'redonda',
      tail: 'pelada',
      tailColor: P.coral,
    });
  const poses = {} as Record<FoePose, PixelBuffer>;
  if (roll < 0.75) {
    const body = pick(rng, [P.plum, P.ebony, P.grape]);
    for (const p of STANDING) poses[p] = outline(spiderPose(body, darker(body, 1), P.red, POSE[p]));
    poses.down = trim(upsideDown(poses.idle));
    return { kind: 'alimana', what: 'arana', poses, foot: 11, chest: 8, span: 20, big: false };
  }
  const body = pick(rng, [P.lime, P.cyan, P.coral]);
  const light = body === P.lime ? P.lemon : body === P.cyan ? P.white : P.sand;
  for (const p of STANDING) poses[p] = outline(slimePose(body, light, P.black, POSE[p]));
  // Caído: un charco.
  const puddle = new PixelBuffer(18, 3);
  puddle.ellipse(9, 1.5, 8.5, 1.5, (x) => (x < 7 ? light : body));
  poses.down = outline(puddle);
  return { kind: 'alimana', what: 'limo', poses, foot: 10, chest: 6, span: 16, big: false };
}

function undead(rng: Rng): FoeArt {
  if (rng.chance(0.3)) {
    const sheet = pick(rng, [P.mist, P.cyan, P.fog]);
    const shade = sheet === P.cyan ? P.sky : P.steel;
    const poses = {} as Record<FoePose, PixelBuffer>;
    STANDING.forEach((p, i) => (poses[p] = outline(ghostPose(sheet, shade, P.lime, POSE[p], i))));
    // Caído: la sábana vacía en el suelo.
    const heap = new PixelBuffer(16, 4);
    heap.ellipse(8, 3, 7.5, 3, (x) => (x < 5 ? shade : sheet));
    poses.down = outline(heap);
    return { kind: 'muerto', what: 'espectro', poses, foot: 11, chest: 16, span: 16, big: false };
  }
  return humanoidArt('muerto', 'esqueleto', {
    h: 22,
    wide: 6,
    head: 6,
    skin: P.mist,
    skinD: P.fog,
    cloth: P.mist,
    clothD: P.steel,
    legs: P.fog,
    boots: P.steel,
    eye: pick(rng, [P.red, P.lime, P.cyan]),
    skull: true,
    weapon: pick(rng, ['espada', 'lanza', 'hacha'] as const),
    metal: pick(rng, [P.steel, P.rust]),
    wood: P.bark,
    shield: rng.chance(0.4) ? P.rust : undefined,
  });
}

function troll(rng: Rng): FoeArt {
  const skin = pick(rng, [P.leaf, P.steel, P.forest]);
  return humanoidArt('grande', skin === P.steel ? 'trol de piedra' : 'trol', {
    h: 52,
    wide: 16,
    head: 11,
    skin,
    skinD: darker(skin, 1),
    cloth: pick(rng, [P.bark, P.umber, P.rust]),
    clothD: P.ebony,
    legs: skin,
    boots: darker(skin, 2),
    eye: P.lemon,
    hair: rng.chance(0.5) ? P.black : undefined,
    tusks: true,
    hunch: true,
    weapon: 'garrote',
    metal: P.steel,
    wood: P.oak,
  });
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
