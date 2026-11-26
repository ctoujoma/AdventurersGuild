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
  type FoeSeq,
} from './foes';
import {
  bearBody,
  goblinBody,
  ratBody,
  skeletonBody,
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
/** Bayer 4×4: el orden en que se borran los píxeles al deshacerse. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** El dibujo con una parte `u` (0–1) de sus píxeles borrada en tramado. */
function dissolve(img: PixelBuffer, u: number): PixelBuffer {
  const out = img.clone();
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (BAYER[(y & 3) * 4 + (x & 3)]! < u * 16) out.data[y * img.w + x] = 0;
  return out;
}

/** Los caracteres de los colores de `ramp` en los calcos (`expCalcos.ts`). */
const IDX = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function calcoArt(
  kind: FoeArt['kind'],
  what: string,
  pose: Record<Exclude<FoePose, 'down'>, number> & { down?: number },
  big = false,
  seq?: Partial<Record<FoeSeq, number[]>>,
  fade = 0,
): FoeArt {
  const c = CALCOS[what]!;
  const w = Math.max(...c.frames.map((f) => f[0]!.length));
  const h = Math.max(...c.frames.map((f) => f.length));
  const col = (ch: string) => {
    const i = IDX.indexOf(ch);
    return i >= 0 ? c.ramp[i]! : BOCA[ch as keyof typeof BOCA];
  };
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
  for (const k of Object.keys(pose) as FoePose[]) poses[k] = frames[pose[k]!]!;
  // Caído: el suyo si lo tiene (la sanguijuela reventada) y si no, panza arriba.
  if (pose.down === undefined) poses.down = trim(upsideDown(poses.idle));
  const iw = c.frames[pose.idle]![0]!.length;
  // Con varios fotogramas por pose, los pies van donde pisa de verdad (el centro de las filas de
  // abajo), que es por donde se alinean los fotogramas (`tools/bocetos/enemigos`).
  const low = c.frames[pose.idle]!.slice(-3);
  const xs = low.flatMap((r) => [...r].flatMap((ch, x) => (ch === '.' ? [] : [x])));
  const foot =
    seq && xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : Math.round(iw / 2);
  const art: FoeArt = {
    kind,
    what,
    poses,
    foot,
    chest: Math.round(h / 2),
    span: iw,
    big,
  };
  if (seq) {
    art.seq = {};
    for (const k of Object.keys(seq) as (keyof typeof seq)[])
      art.seq[k] = seq[k]!.map((i) => frames[i]!);
    // Al acabar de morir se deshace en `fade` pasos (tramado, como el fundido del paisaje) y no
    // queda nada: caído, ya no se ve.
    const d = art.seq.down;
    if (fade && d?.length) {
      const last = d[d.length - 1]!;
      const gone = Array.from({ length: fade }, (_, i) => dissolve(last, (i + 1) / fade));
      art.seq.down = [...d, ...gone];
      poses.down = gone[gone.length - 1]!;
    }
  }
  return art;
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
      art: calcoArt(
        'grande',
        'gigante',
        { idle: 0, idle2: 12, walk1: 0, walk2: 1, windup: 3, strike: 4, hurt: 7, down: 11 },
        true,
        // Respira; guardia y garrote arriba y lo estampa (el de recogerlo bailaba: fuera); herido, se dobla; al morir cae.
        {
          idle: [0, 0, 12, 12],
          windup: [1, 2, 3],
          strike: [4, 5, 5, 5],
          hurt: [7, 8],
          down: [9, 10, 11],
        },
      ),
      count: 1,
    }),
  ],
  marismas: [
    () => ({
      // Verde y, al atacar, se llena de sangre (roja).
      art: calcoArt(
        'alimana',
        'sanguijuela',
        { idle: 0, idle2: 6, walk1: 4, walk2: 5, windup: 7, strike: 8, hurt: 1, down: 5 },
        false,
        { idle: [0, 9, 6, 9], windup: [2, 7], strike: [8], hurt: [1] },
      ),
      count: 3,
    }),
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

/**
 * El guardián del rumbo en las expediciones (el que espera a la vista): el de sierra, el dragón
 * de hielo; los demás, de momento, el huargo del bosque.
 */
export function expGuardianArt(heading: Heading): FoeArt {
  const key = `guardian:${heading}`;
  let f = cache.get(key);
  if (!f) {
    f =
      heading === 'sierra'
        ? {
            art: calcoArt(
              'grande',
              'dragon',
              { idle: 13, idle2: 14, walk1: 2, walk2: 4, windup: 6, strike: 8, hurt: 23, down: 24 },
              true,
              // Respira, abre las alas y ruge, echa el aliento de hielo; herido, se escarcha; al morir
              // se encabrita, se dobla, se desploma, queda helado y se deshace.
              {
                idle: [13, 14, 15, 16, 17, 16, 15, 14],
                windup: [18, 6],
                strike: [7, 8, 9, 8],
                hurt: [23],
                down: [19, 20, 21, 22, 24, 24],
              },
              4,
            ),
            count: 1,
          }
        : expFoeArt('bosque', 3);
    cache.set(key, f);
  }
  return f.art;
}

/** El guardián de cada rumbo (su dibujo, en `art/bosses.ts`). */
export const GUARDIAN_OF = {
  bosque: 'colmillo',
  sierra: 'blanca',
  marismas: 'juncal',
  ruinas: 'ceniza',
} as const satisfies Record<Heading, string>;
