/**
 * Los enemigos de las expediciones, cada uno con su dibujo (en el visor y en «Ver la pelea»): los
 * lobos son lobos y el oso es un oso, con el pelaje de su rumbo, y salen tantos como dice el
 * diario (una manada, tres; un oso, uno). Están hechos con los cuerpos de `foeSprites.ts`; los
 * que no había (la culebra de agua, el lobo enorme, el ahogado con algas, el gólem con runas) se
 * hacen aquí. El orden de cada rumbo es el de `expediciones.enemigos.<rumbo>` en los textos.
 */
import type { Heading } from '../core/model';
import { Rng } from '../core/rng';
import {
  bandit,
  bipedArt,
  posesOf,
  quadArt,
  trim,
  trimAll,
  upsideDown,
  rotated,
  type FoeArt,
  type FoePose,
} from './foes';
import {
  bearBody,
  goblinBody,
  ratBody,
  skeletonBody,
  slimePose,
  trollPose,
  TROLL_FOOT,
  wolfBody,
  type PoseSpec,
} from './foeSprites';
import { BOCA, CALCOS } from './expCalcos';
import { P } from './palette';
import { PixelBuffer, alpha } from './pixel';

export interface ExpFoe {
  art: FoeArt;
  /** Cuántos salen (una manada, tres; un oso, uno). */
  count: number;
}

/** Salpica unas manchas de un color sobre lo pintado (algas, liquen). */
function speckle(b: PixelBuffer, col: string, k: number, seed: number): PixelBuffer {
  const o = b.clone();
  const r = new Rng(`motas-${seed}`);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (!alpha(c) || !alpha(b.get(x, y - 1))) continue;
      if (r.next() < k) o.set(x, y, col);
    }
  return o;
}

/** La culebra de agua: cuerpo en ese a ras de suelo, el cuello alzado y la lengua al morder. */
function snakePose(p: PoseSpec, i: number): PixelBuffer {
  const b = new PixelBuffer(30, 16);
  const g = 15;
  const sway = p.bob ? 1 : 0;
  const strike = p.legs === 'lunge';
  const wind = p.legs === 'crouch';
  const hurt = !!p.hurt;
  const head: [number, number] = strike
    ? [26, 9]
    : wind
      ? [17, 3]
      : hurt
        ? [18, 2]
        : [21 + sway, 4];
  // El cuerpo: de la cola (izquierda) al cuello, ondulando.
  const pts: [number, number][] = [];
  for (let x = 1; x <= 18; x++)
    pts.push([x, g - 2 - Math.round(Math.sin((x + i) * 0.55) * 1.5 * (x / 18))]);
  // El cuello sube hasta la cabeza.
  const [hx, hy] = head;
  for (let k = 1; k <= 8; k++) {
    const u = k / 8;
    pts.push([
      Math.round(18 + (hx - 18) * u),
      Math.round(g - 2 + (hy + 2 - (g - 2)) * Math.sin(u * Math.PI * 0.5)),
    ]);
  }
  pts.forEach(([x, y], k) => {
    const th = k < 4 ? 1 : 2;
    for (let d = -th; d <= th - 1; d++) {
      const col = d === -th ? P.leaf : d === th - 1 ? P.sand : P.forest;
      b.set(x, y + d, col);
    }
    if (k % 3 === 0) b.set(x, y - th + 1, P.deep);
  });
  // La cabeza: chata, con el ojo amarillo; al morder, la boca abierta y la lengua.
  for (let dx = 0; dx < 5; dx++)
    for (let dy = -2; dy <= 1; dy++)
      b.set(hx + dx - 1, hy + dy, dy === -2 ? P.leaf : dy === 1 ? P.sand : P.forest);
  b.set(hx + 1, hy - 1, P.lemon);
  if (strike) {
    b.set(hx + 4, hy, P.black);
    b.set(hx + 5, hy, P.red);
    b.set(hx + 6, hy - 1, P.red);
    b.set(hx + 6, hy + 1, P.red);
  }
  return b;
}

function snakeArt(): FoeArt {
  const poses = posesOf(
    (p, i) => snakePose(p, i),
    (idle) => trim(upsideDown(idle)),
  );
  return { kind: 'alimana', what: 'culebra', poses, foot: 12, chest: 6, span: 26, big: false };
}

/** Los trols de cada sitio (el gigante de las nieves, el gólem de las ruinas con sus runas). */
function giant(what: string, skin: Record<string, string>, cloth: string, runes = false): FoeArt {
  const { poses, shift } = trimAll(
    posesOf(
      (p) => {
        const b = trollPose(skin, cloth, p);
        if (!runes) return b;
        // Runas que brillan en el pecho y los brazos.
        const r = new Rng(`runas-${what}`);
        for (let k = 0; k < 14; k++) {
          const x = r.int(TROLL_FOOT - 14, TROLL_FOOT + 6);
          const y = r.int(Math.round(b.h * 0.25), Math.round(b.h * 0.6));
          if (alpha(b.get(x, y))) b.set(x, y, k % 3 ? P.cyan : P.white);
        }
        return b;
      },
      (idle) => trim(rotated(idle)),
    ),
  );
  return { kind: 'grande', what, poses, foot: TROLL_FOOT - shift, chest: 30, span: 36, big: true };
}


/**
 * Un enemigo calcado (`expCalcos.ts`): sus fotogramas en un lienzo común, pegados abajo y por la
 * cola, y qué fotograma hace cada pose. Caído, panza arriba.
 */
function calcoArt(
  kind: FoeArt['kind'],
  what: string,
  pose: Record<Exclude<FoePose, 'down'>, number>,
  big = false,
): FoeArt {
  const c = CALCOS[what]!;
  const w = Math.max(...c.frames.map((f) => f[0]!.length));
  const h = Math.max(...c.frames.map((f) => f.length));
  const col = (ch: string) =>
    ch >= '0' && ch <= '6' ? c.ramp[+ch]! : BOCA[ch as keyof typeof BOCA];
  const frames = c.frames.map((f) => {
    const b = new PixelBuffer(w, h);
    f.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== '.') b.set(x, h - f.length + y, col(ch));
      }),
    );
    return b;
  });
  const poses = {} as Record<FoePose, PixelBuffer>;
  for (const k of Object.keys(pose) as (keyof typeof pose)[]) poses[k] = frames[pose[k]]!;
  poses.down = trim(upsideDown(poses.idle));
  const iw = c.frames[pose.idle]![0]!.length;
  return { kind, what, poses, foot: Math.round(iw / 2), chest: Math.round(h / 2), span: iw, big };
}

const banditOf = (seed: string) => bandit(new Rng(`exp-bandido-${seed}`));

/** Cómo se hace cada enemigo de cada rumbo (en el orden de los textos). */
const FOES: Record<Heading, readonly (() => ExpFoe)[]> = {
  bosque: [
    () => ({
      art: calcoArt('bestia', 'lobo', {
        idle: 0,
        idle2: 1,
        walk1: 0,
        walk2: 1,
        windup: 2,
        strike: 3,
        hurt: 0,
      }),
      count: 3,
    }),
    () => ({
      art: calcoArt('bestia', 'jabali', {
        idle: 0,
        idle2: 0,
        walk1: 1,
        walk2: 2,
        windup: 1,
        strike: 2,
        hurt: 0,
      }),
      count: 1,
    }),
    () => ({
      art: calcoArt('bestia', 'oso', {
        idle: 0,
        idle2: 1,
        walk1: 1,
        walk2: 2,
        windup: 1,
        strike: 3,
        hurt: 0,
      }),
      count: 1,
    }),
    () => ({
      art: calcoArt(
        'bestia',
        'huargo',
        { idle: 0, idle2: 7, walk1: 6, walk2: 7, windup: 2, strike: 4, hurt: 1 },
        true,
      ),
      count: 1,
    }),
  ],
  sierra: [
    () => ({ art: quadArt('bestia', 'lobo_gris', wolfBody(P.fog, P.steel, P.mist)), count: 3 }),
    () => ({
      art: bipedArt(
        'trasgo',
        'trasgo',
        goblinBody({ h: P.lemon, s: P.lime, S: P.leaf }, P.umber, 'lanza'),
      ),
      count: 3,
    }),
    () => ({ art: quadArt('bestia', 'oso_pardo', bearBody(P.mocha, P.ebony)), count: 1 }),
    () => ({
      art: giant('gigante_nieves', { h: P.white, s: P.mist, S: P.fog }, P.steel),
      count: 1,
    }),
  ],
  marismas: [
    () => {
      const poses = posesOf(
        (p) => slimePose(P.wine, P.coral, P.plum, p),
        (idle) => trim(upsideDown(idle)),
      );
      return {
        art: {
          kind: 'alimana',
          what: 'sanguijuela',
          poses,
          foot: 11,
          chest: 7,
          span: 18,
          big: false,
        },
        count: 3,
      };
    },
    () => {
      const a = bipedArt('muerto', 'ahogado', skeletonBody(P.lime, false, 'oxidada', false));
      const poses = { ...a.poses };
      for (const k of Object.keys(poses) as (keyof typeof poses)[])
        poses[k] = speckle(poses[k], P.leaf, 0.22, k.length);
      return { art: { ...a, poses }, count: 1 };
    },
    () => ({ art: banditOf('contrabandista'), count: 3 }),
    () => ({ art: snakeArt(), count: 1 }),
  ],
  ruinas: [
    () => ({
      art: bipedArt('muerto', 'esqueleto', skeletonBody(P.red, true, 'oxidada', true)),
      count: 3,
    }),
    () => ({ art: banditOf('saqueador'), count: 3 }),
    () => ({ art: quadArt('alimana', 'rata', ratBody(P.cocoa, P.umber)), count: 3 }),
    () => ({ art: giant('golem', { h: P.sand, s: P.tan, S: P.clay }, P.slate, true), count: 1 }),
  ],
};

const cache = new Map<string, ExpFoe>();

/** El enemigo número `idx` del rumbo (siempre el mismo dibujo). */
export function expFoeArt(heading: Heading, idx: number): ExpFoe {
  const key = `${heading}:${idx}`;
  let f = cache.get(key);
  if (!f) {
    const list = FOES[heading];
    f = list[((idx % list.length) + list.length) % list.length]!();
    cache.set(key, f);
  }
  return f;
}

/** El guardián de cada rumbo (su dibujo, en `art/bosses.ts`). */
export const GUARDIAN_OF = {
  bosque: 'colmillo',
  sierra: 'blanca',
  marismas: 'juncal',
  ruinas: 'ceniza',
} as const satisfies Record<Heading, string>;
