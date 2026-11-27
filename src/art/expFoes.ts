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
  goblinBody,
  ratBody,
  skeletonBody,
  trollPose,
  TROLL_FOOT,
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
/** Las motas de ceniza (grises). */
const ASH = ['#6e6e80', '#8e8ea0', '#b0b0c0'];
/** Las del jabalí de ceniza: ceniza y alguna brasa. */
const EMBERS = ['#6e6e80', '#8e8ea0', '#6e6e80', '#e8642a', '#f0a030'];

/** Bayer 4×4: el orden en que se borran los píxeles al deshacerse. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Se vuelve ceniza y se la lleva el viento: en `n` pasos se deshace de arriba abajo y lo que se
 * suelta sube y se va hacia atrás en motas grises que se apagan. El último, vacío.
 */
function ashOut(img: PixelBuffer, n: number, motes: readonly string[] = ASH): PixelBuffer[] {
  const pts: { x: number; y: number; c: number; o: number; h: number; g: number }[] = [];
  let top = img.h;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) if (alpha(img.get(x, y))) top = Math.min(top, y);
  const tall = Math.max(1, img.h - top);
  const rnd = (k: number) => {
    const v = Math.sin(k * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const c = img.get(x, y);
      if (!alpha(c)) continue;
      // Primero lo de arriba y la cabeza (a la derecha), con un poco de azar para que no se corte
      // en líneas.
      const o = 0.45 * ((y - top) / tall) + 0.3 * (1 - x / img.w) + 0.25 * rnd(x * 31 + y * 57 + 1);
      pts.push({ x, y, c, o, h: rnd(x * 17 + y * 89 + 3), g: rnd(x * 7 + y * 13 + 5) });
    }
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 1) / n) * 1.3;
    const out = new PixelBuffer(img.w, img.h);
    for (const p of pts) {
      if (p.o > t) {
        out.set(p.x, p.y, p.c);
        continue;
      }
      // Solo una de cada cinco motas se ve volar; se va hacia atrás y arriba, y se apaga.
      const q = (t - p.o) / 0.45;
      if (q >= 1 || p.h > 0.2) continue;
      if (q > 0.6 && p.g < (q - 0.6) / 0.4) continue;
      const x = p.x - q * (10 + p.g * 18);
      const y = p.y - q * (6 + p.h * 60) + Math.sin(q * 7 + p.g * 9) * 1.2;
      if (y < 0) continue;
      out.set(x, y, q < 0.15 ? p.c : motes[Math.floor(p.g * motes.length)]!);
    }
    return out;
  });
}

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
  o: {
    /** Al acabar de morir, se deshace en tramado en tantos pasos. */
    fade?: number;
    /** O se vuelve ceniza que se lleva el viento, en tantos pasos y con estas motas. */
    ash?: number;
    motes?: readonly string[];
    /** Otros colores para el mismo dibujo (el lobo gris de la sierra, del lobo del bosque). */
    ramp?: (ramp: readonly string[]) => readonly string[];
  } = {},
): FoeArt {
  const { fade = 0, ash = 0 } = o;
  const base = CALCOS[what]!;
  const c = o.ramp ? { ...base, ramp: o.ramp(base.ramp) } : base;
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
  // Caído: el suyo si lo tiene (la sanguijuela reventada); si no, se deshace (abajo).
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
    if (ash && d?.length) {
      const gone = ashOut(d[d.length - 1]!, ash, o.motes);
      art.seq.down = [...d, ...gone];
      poses.down = gone[gone.length - 1]!;
    } else if (fade && d?.length) {
      const last = d[d.length - 1]!;
      const gone = Array.from({ length: fade }, (_, i) => dissolve(last, (i + 1) / fade));
      art.seq.down = [...d, ...gone];
      poses.down = gone[gone.length - 1]!;
    }
  }
  // Sin muerte dibujada (el bosque): herido, se deshace en tramado en vez de quedar panza arriba.
  if (pose.down === undefined) {
    const h = poses.hurt;
    const gone = [0.25, 0.5, 0.75, 1].map((u) => dissolve(h, u));
    art.seq = { ...art.seq, down: [h, h, ...gone] };
    poses.down = gone[gone.length - 1]!;
  }
  return art;
}

/**
 * La misma rampa con otro tono: cada color pasa a `hue` (grados) con `sat` de saturación (por la
 * que tenía) y se aclara (`lift`: 0 igual, 1 blanco) sin perder el orden de oscuro a claro.
 */
function recolor(
  ramp: readonly string[],
  o: { hue: number; sat: number; lift: number },
): readonly string[] {
  return ramp.map((h) => {
    const v = parseInt(h.slice(1), 16);
    const [r, g, b] = [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    // La boca y la sangre, como estaban.
    if (r > 0.45 && r > g * 1.8) return h;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    let l = (mx + mn) / 2;
    const s0 = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    l = l + (1 - l) * o.lift * Math.sqrt(l);
    const s = Math.min(1, s0 * o.sat + 0.06);
    // HSL a RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hh = (o.hue / 60) % 6;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    const [r1, g1, b1] =
      hh < 1
        ? [c, x, 0]
        : hh < 2
          ? [x, c, 0]
          : hh < 3
            ? [0, c, x]
            : hh < 4
              ? [0, x, c]
              : hh < 5
                ? [x, 0, c]
                : [c, 0, x];
    const m = l - c / 2;
    const to = (u: number) =>
      Math.round(Math.max(0, Math.min(1, u + m)) * 255)
        .toString(16)
        .padStart(2, '0');
    return '#' + to(r1) + to(g1) + to(b1);
  });
}

const banditOf = (seed: string) => bandit(new Rng(`exp-bandido-${seed}`));

/** Cómo se hace cada enemigo de cada rumbo (en el orden de los textos). */
const FOES: Record<Heading, readonly (() => ExpFoe)[]> = {
  bosque: [
    () => ({
      // Respira; se agacha, salta y muerde; herido, se encoge; muere y queda tendido.
      art: calcoArt(
        'bestia',
        'lobo',
        { idle: 0, idle2: 2, walk1: 1, walk2: 3, windup: 6, strike: 8, hurt: 11, down: 18 },
        false,
        {
          idle: [0, 1, 2, 3, 4, 3, 2, 1],
          windup: [5, 6],
          strike: [7, 8, 9, 10],
          hurt: [11, 12, 13, 14],
          down: [15, 16, 17, 18],
        },
      ),
      count: 3,
    }),
    () => ({
      // Respira; escarba, carga y embiste; herido, se encabrita; muere y queda tendido.
      art: calcoArt(
        'bestia',
        'jabali',
        { idle: 0, idle2: 2, walk1: 1, walk2: 3, windup: 7, strike: 8, hurt: 11, down: 18 },
        false,
        {
          idle: [0, 1, 2, 3, 4, 3, 2, 1],
          windup: [5, 6, 7],
          strike: [8, 9, 10],
          hurt: [11, 12, 13, 14],
          down: [15, 16, 17, 18],
        },
      ),
      count: 1,
    }),
    () => ({
      art: calcoArt(
        'bestia',
        'oso',
        { idle: 0, idle2: 2, walk1: 1, walk2: 3, windup: 7, strike: 8, hurt: 11, down: 18 },
        false,
        // Respira; se alza y suelta el zarpazo; herido, ruge y se encoge; muere y queda tendido.
        {
          idle: [0, 1, 2, 3, 4, 3, 2, 1],
          windup: [5, 6, 7],
          strike: [8, 9, 10],
          hurt: [11, 12, 13, 14],
          down: [15, 16, 17, 18],
        },
      ),
      count: 1,
    }),
    () => ({
      art: calcoArt(
        'bestia',
        'huargo',
        { idle: 0, idle2: 7, walk1: 6, walk2: 7, windup: 2, strike: 4, hurt: 1, down: 13 },
        true,
        // Muere: se encabrita, agacha la cabeza, se desploma, se oscurece y queda en ceniza, que se
        // lleva el viento.
        // Herido, se encabrita aullando (el primero de la muerte) y vuelve.
        { hurt: [8, 8, 1], down: [8, 9, 10, 11, 12, 13, 13] },
        { ash: 6 },
      ),
      count: 1,
    }),
  ],
  sierra: [
    () => ({
      // El lobo del bosque, más claro y frío: de pelo de nieve.
      art: calcoArt(
        'bestia',
        'lobo',
        { idle: 0, idle2: 2, walk1: 1, walk2: 3, windup: 6, strike: 8, hurt: 11, down: 18 },
        false,
        {
          idle: [0, 1, 2, 3, 4, 3, 2, 1],
          windup: [5, 6],
          strike: [7, 8, 9, 10],
          hurt: [11, 12, 13, 14],
          down: [15, 16, 17, 18],
        },
        { ramp: (r) => recolor(r, { hue: 215, sat: 0.12, lift: 0.3 }) },
      ),
      count: 3,
    }),
    () => ({
      art: bipedArt(
        'trasgo',
        'trasgo',
        goblinBody({ h: P.lemon, s: P.lime, S: P.leaf }, P.umber, 'lanza'),
      ),
      count: 3,
    }),
    () => ({
      // El oso del bosque, pardo: menos rojo, más terroso y con las puntas más claras.
      art: calcoArt(
        'bestia',
        'oso',
        { idle: 0, idle2: 2, walk1: 1, walk2: 3, windup: 7, strike: 8, hurt: 11, down: 18 },
        false,
        {
          idle: [0, 1, 2, 3, 4, 3, 2, 1],
          windup: [5, 6, 7],
          strike: [8, 9, 10],
          hurt: [11, 12, 13, 14],
          down: [15, 16, 17, 18],
        },
        { ramp: (r) => recolor(r, { hue: 30, sat: 0.72, lift: 0.1 }) },
      ),
      count: 1,
    }),
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

let ceniza: FoeArt | undefined;

/**
 * El jabalí de ceniza, jefe de la historia «Ceniza» (hoja del usuario, 27 de noviembre): resopla;
 * escarba, arranca y embiste agachado hasta dar la cornada hacia arriba; herido, chilla y se
 * encoge; al morir se encabrita, se desploma y se deshace en ceniza y brasas que se lleva el viento.
 */
export function cenizaArt(): FoeArt {
  ceniza ??= calcoArt(
    'grande',
    'ceniza',
    { idle: 0, idle2: 2, walk1: 1, walk2: 3, windup: 7, strike: 8, hurt: 11, down: 19 },
    true,
    {
      idle: [0, 1, 2, 3, 4, 3, 2, 1],
      windup: [5, 6, 7],
      strike: [8, 9, 10],
      hurt: [11, 12, 13, 14],
      // El montón de ceniza de la hoja quedaba pobre: desde que empieza a deshacerse, se lo lleva
      // el viento en ceniza y brasas.
      down: [15, 16, 17, 18, 18, 19],
    },
    { ash: 7, motes: EMBERS },
  );
  return ceniza;
}

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
                // Un solo chorro (el otro dibujo va en otro ángulo y parpadeaba), titilando.
                strike: [7, 8, 25, 8, 25],
                hurt: [23],
                down: [19, 20, 21, 22, 24, 24],
              },
              { fade: 4 },
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
