import { bossArt, type BossArt, type BossPose } from '../art/bosses';
import { bufferCanvas } from '../art/canvas';
import { P } from '../art/palette';
import {
  FEET_Y,
  HAND,
  fightSprites,
  heroSprites,
  type FightPose,
  type HeroLook,
  type HeroMarks,
  type HeroSprites,
} from '../art/heroes/hero';
import { generateLook } from '../art/heroes/look';
import type { PixelBuffer } from '../art/pixel';
import type { BossKind } from '../data/bosses';
import type { PKind } from './particles';
import { WEAPONS, type WeaponId } from './weapons';

/**
 * Asalto a la taberna en tiempo real: los bandidos bajan por el camino, los defensores salen
 * por la puerta y chocan en el patio. Cada clase (y cada tipo de bandido) tiene su arma y
 * varios ataques que se van alternando para que ninguna pelea se vea igual: tajos, estocadas,
 * volteretas, bolas de fuego, rayos, luz sagrada, andanadas de flechas… El resultado ya lo
 * ha decidido el núcleo; aquí solo se cuenta bonito. Dura unos 13 segundos.
 *
 * La misma pelea sirve para los jefes de las historias (`arena`): el grupo entra por la
 * izquierda en un escenario lejos de la taberna y el jefe, con sus esbirros, espera a la
 * derecha. Dura algo más y el jefe tiene sus propios ataques.
 */

export interface BattleSpec {
  won: boolean;
  bandits: number;
  /** Defensores con su aspecto; `hurt` acaban en el suelo. */
  defenders: { id: string; look: HeroLook; marks: HeroMarks; hurt: boolean }[];
  /** Pelea contra un jefe en su guarida, de `width` píxeles de ancho. */
  arena?: { boss: BossKind; minions: number; width: number };
}

export type BattleSound =
  | 'hit'
  | 'cheer'
  | 'creak'
  | 'swing'
  | 'thud'
  | 'zap'
  | 'boom'
  | 'arrow'
  | 'holy'
  | 'thunder'
  | 'roar'
  | 'whoosh';

export interface BattleHooks {
  feetAt: (x: number) => number;
  burst: (kind: PKind, x: number, y: number, n: number) => void;
  coin: (x: number, y: number) => void;
  sound: (name: BattleSound, volume?: number) => void;
}

export interface BattleLight {
  x: number;
  y: number;
  r: number;
  color: [number, number, number];
}

type State = 'walk' | 'fight' | 'down' | 'flee' | 'cheer' | 'loot' | 'inside' | 'gone';

export type Style =
  | 'guerrero'
  | 'picaro'
  | 'mago'
  | 'clerigo'
  | 'explorador'
  | 'bruto'
  | 'navajero'
  | 'arquero'
  | 'incendiario'
  | 'jefe'
  | BossKind;

interface Frame {
  pose: FightPose;
  /** Ángulo del arma en grados: 0 hacia arriba, positivo hacia delante. */
  angle: number;
  dx?: number;
  dy?: number;
  /** Giro de todo el cuerpo (voltereta), en radianes. */
  spin?: number;
  /** Estela del arma: del ángulo inicial al actual. */
  trail?: [number, number];
  shield?: boolean;
  noWeapon?: boolean;
  /** Flecha montada en el arco. */
  nock?: boolean;
  /** La gema del bastón brilla (cargando un hechizo). */
  glow?: boolean;
  /** Mirar al revés (torbellino). */
  turn?: boolean;
}

interface HurtOpts {
  sound?: BattleSound;
  puff?: boolean;
  stun?: boolean;
  spark?: number;
  tint?: string;
  freeze?: number;
  fire?: boolean;
}

interface Move {
  dur: number;
  /** Momentos (0..1) en los que el ataque tiene efecto. */
  hits: number[];
  frame: (p: number, f: Fighter) => Frame;
  hit: (b: Battle, f: Fighter, i: number) => void;
  /** Solo se elige si se cumple (p. ej. escudo de fe si hay a quién proteger). */
  when?: (b: Battle, f: Fighter) => boolean;
}

interface Fighter {
  side: 'b' | 'd';
  id?: string;
  style: Style;
  spr: HeroSprites;
  poses: Record<FightPose, PixelBuffer>;
  x: number;
  target: number;
  speed: number;
  state: State;
  /** Hacia dónde mira cuando no camina (1 derecha, -1 izquierda). */
  face: 1 | -1;
  foe?: Fighter;
  dist: number;
  sack: boolean;
  /** Qué hace al llegar a su destino. */
  then: State;
  move?: { m: Move; t: number; fired: number; ally?: Fighter };
  last?: Move;
  cool: number;
  /** Destello al recibir un golpe, y su color. */
  flash: number;
  tint: string;
  /** Retroceso visual tras un golpe (px, se amortigua). */
  knock: number;
  frozen: number;
  bubble: number;
  stun: number;
  rage: number;
  /** Dónde arde su antorcha (para la luz), o null. */
  torchAt: { x: number; y: number } | null;
  /** Altura del pecho sobre los pies (donde se apuntan los golpes). */
  chestH: number;
  /** Dibujo del jefe (si lo es) y su vida para la barra (0–1). */
  art?: BossArt;
  hp: number;
  /** Esbirro de un jefe (ahogado o muerto de la cripta): se pinta teñido y sin antorcha. */
  ghost?: boolean;
  /** Su tinte: verdoso (ahogados) o pálido como el hueso (los de la Reina). */
  ghostTint?: string;
  /** Cuándo cayó (para la animación de muerte del jefe) y si ya ha tocado el suelo. */
  downAt?: number;
  landed?: boolean;
}

type ShotKind = 'arrow' | 'firearrow' | 'fire' | 'ice' | 'dagger' | 'bottle';

interface Shot {
  kind: ShotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  t: number;
  life: number;
  to: Fighter;
  onHit: () => void;
  trail: { x: number; y: number }[];
}

type FxKind =
  | 'boom'
  | 'bolt'
  | 'pillar'
  | 'halo'
  | 'ring'
  | 'shards'
  | 'stars'
  | 'shout'
  | 'flames'
  /** El aliento de la dragona de hielo: como las llamas, en blanco y azul. */
  | 'frost'
  | 'slash';

interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  t: number;
  dur: number;
  color: string;
  r: number;
  dir: 1 | -1;
  seed: number;
  follow?: Fighter;
}

export const BATTLE_TIME = 13;
const DOOR = 98;
/** Muerte de los jefes: cuánto tarda en tocar el suelo, y cuánto se tambalea antes. */
const TIP_SWAY = 0.5;
const deathTime = (f: { art?: { fall?: 'sink' } }) => (f.art?.fall === 'sink' ? 2 : 0.55);

/** Pelea contra un jefe: llegada, golpes, desenlace y final. */
const ARENA_TIMES = { fight: 3.4, outcome: 15.5, end: 20 };
/** Altura del pecho sobre los pies, donde se apuntan los golpes. */
const CHEST = 13;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const hump = (k: number) => Math.sin(Math.PI * clamp01(k));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

// ---------------------------------------------------------------------------------------
// Ataques
// ---------------------------------------------------------------------------------------

interface SwingOpts {
  power: number;
  from: number;
  to: number;
  pose0?: FightPose;
  pose1?: FightPose;
  lunge?: number;
  at?: number;
  sound?: BattleSound;
  puff?: boolean;
  stun?: boolean;
  dy?: number;
}

/** Golpe cuerpo a cuerpo genérico: preparar, soltar con estela y volver a la guardia. */
function swing(dur: number, ready: number, o: SwingOpts): Move {
  const at = o.at ?? 0.55;
  const lunge = o.lunge ?? 2;
  return {
    dur,
    hits: [at],
    frame: (p) => {
      if (p < at - 0.18) {
        const k = easeOut(seg(p, 0, at - 0.18));
        return { pose: o.pose0 ?? 'up', angle: lerp(ready, o.from, k), dx: -k };
      }
      if (p < at + 0.08) {
        const k = seg(p, at - 0.18, at + 0.02);
        const a = lerp(o.from, o.to, k);
        return {
          pose: o.pose1 ?? 'strike',
          angle: a,
          dx: lerp(-1, lunge, k),
          dy: (o.dy ?? 0) * k,
          trail: [o.from, a],
        };
      }
      const k = seg(p, at + 0.08, 1);
      return { pose: 'ready', angle: lerp(o.to, ready, k), dx: lunge * (1 - k) };
    },
    hit: (b, f) =>
      b.strike(f, o.power, {
        sound: o.sound ?? 'hit',
        puff: o.puff,
        stun: o.stun,
      }),
  };
}

/** Disparo con arco: tensar, soltar. `arc` para tiro parabólico. */
function bowShot(
  dur: number,
  times: number[],
  o: { arc?: boolean; fire?: boolean; power: number },
): Move {
  const aim = o.arc ? -40 : 0;
  return {
    dur,
    hits: times,
    frame: (p) => {
      const next = times.find((x) => x >= p - 0.02);
      const drawing = next !== undefined && p > next - 0.22 && p <= next;
      return { pose: drawing ? 'strike' : 'ready', angle: drawing ? aim : 0, nock: drawing };
    },
    hit: (b, f) =>
      b.shoot(f, o.fire ? 'firearrow' : 'arrow', o.arc ? 140 : 220, !!o.arc, () =>
        b.hurt(f.foe!, f, o.power, { spark: 2, sound: 'hit', fire: o.fire }),
      ),
  };
}

/** Rugido del jefe al ver llegar al grupo (sin golpe). */
const ROAR: Move = {
  dur: 1.1,
  hits: [],
  frame: (p) => ({ pose: p > 0.15 && p < 0.85 ? 'up' : 'ready', angle: 0 }),
  hit: () => {},
};

/** Fases de un golpe de jefe: preparar, soltar y volver (con desplazamiento opcional). */
const bossFrame =
  (at: number, pose: 'strike' | 'thrust', lunge = 3, back = 2): Move['frame'] =>
  (p) =>
    p < at - 0.15
      ? { pose: 'windup', angle: 0, dx: -back * seg(p, 0, at - 0.15) }
      : p < at + 0.25
        ? { pose, angle: 0, dx: lerp(-back, lunge, seg(p, at - 0.15, at)) }
        : { pose: 'ready', angle: 0, dx: lunge * (1 - seg(p, at + 0.25, 1)) };

/**
 * Los golpes de cada jefe. Los de las historias nuevas pelean como su base, con sus efectos:
 * el jabalí de ceniza levanta brasas; la Reina de la Cripta golpea con el cetro (polvo y luz
 * violeta, no agua) y llama a sus muertos; la dragona de hielo escupe escarcha, no fuego. (Lo que
 * pasa lo decide el núcleo: aquí solo se cuenta.)
 */
const beastMoves = (ash: boolean): Move[] => [
  // Colmillazo.
  {
    dur: 0.9,
    hits: [0.55],
    frame: bossFrame(0.55, 'strike'),
    hit: (b, f) => {
      b.area(f, f.art!.reach + 16, 6, { sound: 'thud', spark: 5 });
      if (ash) b.burstAt('ember', f.x + f.face * f.art!.reach, b.feet(f) - 10, 6);
    },
  },
  // Embestida: retrocede, carga y arrolla.
  {
    dur: 1.4,
    hits: [0.5],
    frame: bossFrame(0.5, 'thrust', 20, 7),
    hit: (b, f) => {
      b.area(f, f.art!.reach + 30, 7, {
        sound: 'thud',
        puff: true,
        stun: true,
        ...(ash ? { tint: P.orange, fire: true } : {}),
      });
      b.burstAt('puff', f.x + f.face * 18, b.feet(f) - 2, 8);
      if (ash) b.burstAt('ember', f.x + f.face * 18, b.feet(f) - 6, 10);
    },
  },
  // Bramido: se encabrita y aturde a todos.
  {
    dur: 1.2,
    hits: [0.35],
    frame: (p) => ({ pose: p > 0.2 && p < 0.85 ? 'up' : 'ready', angle: 0 }),
    hit: (b, f) => {
      const m = f.art!.mouth.up;
      const c = ash ? P.orange : P.sand;
      b.fx('shout', f.x + f.face * m.x, b.feet(f) + m.y, 0.8, c, 26, undefined, f.face);
      b.sound('roar');
      b.stunAround(f, 90, 0.7);
      // El de ceniza suelta una nube de brasas del lomo.
      if (ash) b.burstAt('ember', f.x, b.feet(f) - f.art!.chest - 8, 14);
    },
  },
];

const drownedMoves = (crypt: boolean): Move[] => [
  // Ancla: la levanta y la deja caer sobre quien tiene delante.
  {
    dur: 1.2,
    hits: [0.6],
    frame: bossFrame(0.6, 'strike', 3, 1),
    hit: (b, f) => {
      const to = f.foe;
      if (!to) return;
      b.fx('ring', to.x, b.feet(to) - 1, 0.5, crypt ? P.rose : P.sky, 20);
      b.burstAt(crypt ? 'puff' : 'splash', to.x, b.feet(to) - 2, 8);
      b.areaAt(f, to.x, 16, 7, { sound: 'thud', puff: true, stun: true });
    },
  },
  // Ola: el agua de la laguna barre a todo el grupo. (La Reina: un lamento violeta que hiela.)
  {
    dur: 1.3,
    hits: [0.5],
    frame: (p) => ({ pose: p > 0.15 && p < 0.8 ? 'up' : 'ready', angle: 0 }),
    hit: (b, f) => {
      const c = crypt ? P.rose : P.cyan;
      b.fx('ring', f.x, b.feet(f) - 1, 0.9, c, 80);
      if (crypt) b.fx('ring', f.x, b.feet(f) - 1, 1.1, P.grape, 60);
      b.area(f, 110, 3, { tint: c, freeze: 0.5, sound: crypt ? 'holy' : 'zap', spark: 2 });
    },
  },
  // Llama a sus ahogados (la Reina, a sus muertos), que se enrabietan.
  {
    dur: 1.0,
    hits: [0.4],
    when: (b, f) => b.allies(f).length > 1,
    frame: (p) => ({ pose: p > 0.2 && p < 0.8 ? 'up' : 'ready', angle: 0 }),
    hit: (b, f) => {
      const m = f.art!.mouth.up;
      const c = crypt ? P.rose : P.cyan;
      b.fx('shout', f.x + f.face * 6, b.feet(f) + m.y + 10, 0.7, c, 22, undefined, f.face);
      b.sound('roar');
      for (const a of b.allies(f)) a.rage = 1.8;
    },
  },
];

const wyrmMoves = (ice: boolean): Move[] => [
  // Mordisco.
  {
    dur: 0.85,
    hits: [0.55],
    frame: bossFrame(0.55, 'strike'),
    hit: (b, f) => b.strike(f, 6, { sound: 'thud', spark: 5 }),
  },
  // Aliento de fuego sobre todo el grupo (la dragona de hielo: escarcha que congela).
  {
    dur: 1.8,
    hits: [0.3, 0.45, 0.6, 0.75],
    frame: (p) =>
      p < 0.22
        ? { pose: 'windup', angle: 0 }
        : p < 0.85
          ? { pose: 'thrust', angle: 0 }
          : { pose: 'ready', angle: 0 },
    hit: (b, f, i) => {
      if (i === 0) {
        const m = f.art!.mouth.thrust;
        b.fx(
          ice ? 'frost' : 'flames',
          f.x + f.face * m.x,
          b.feet(f) + m.y + 2,
          1.1,
          ice ? P.cyan : P.orange,
          90,
          undefined,
          f.face,
        );
        b.sound('whoosh');
        b.sound(ice ? 'zap' : 'boom', 0.5);
      }
      b.area(
        f,
        110,
        3,
        ice ? { tint: P.cyan, freeze: 0.6, spark: 1 } : { tint: P.orange, fire: true, spark: 1 },
      );
    },
  },
  // Coletazo: se da la vuelta y barre con la cola.
  {
    dur: 1.0,
    hits: [0.5],
    frame: (p) => ({
      pose: p < 0.3 ? 'windup' : 'strike',
      angle: 0,
      turn: p > 0.3 && p < 0.75,
      dx: p > 0.3 && p < 0.75 ? -6 : 0,
    }),
    hit: (b, f) => {
      b.area(f, f.art!.reach + 22, 5, { sound: 'thud', puff: true, stun: true });
      if (ice) b.fx('shards', f.x - f.face * 10, b.feet(f) - 6, 0.5, P.cyan, 18);
    },
  },
];

/** Los golpes de cada jefe: los de base y los de las historias nuevas, con sus efectos. */
const BOSS_MOVES: Record<BossKind, Move[]> = {
  bestia: beastMoves(false),
  ahogado: drownedMoves(false),
  sierpe: wyrmMoves(false),
  jabali: beastMoves(true),
  reina: drownedMoves(true),
  dragona: wyrmMoves(true),
};

export const MOVES: Record<Style, Move[]> = {
  guerrero: [
    // Tajo de arriba abajo.
    swing(0.6, 30, { power: 3, from: -40, to: 125 }),
    // Estocada a fondo.
    {
      dur: 0.6,
      hits: [0.5],
      frame: (p) =>
        p < 0.35
          ? { pose: 'windup', angle: 95, dx: -2 * seg(p, 0, 0.35) }
          : p < 0.65
            ? { pose: 'thrust', angle: 90, dx: lerp(-2, 7, easeOut(seg(p, 0.35, 0.5))) }
            : {
                pose: 'ready',
                angle: lerp(90, 30, seg(p, 0.65, 1)),
                dx: 7 * (1 - seg(p, 0.65, 1)),
              },
      hit: (b, f) => b.strike(f, 4, { sound: 'hit' }),
    },
    // Golpe de escudo: aturde.
    {
      dur: 0.75,
      hits: [0.45],
      frame: (p) => ({
        pose: 'ready',
        angle: 30,
        shield: true,
        dx:
          p < 0.3
            ? -3 * seg(p, 0, 0.3)
            : lerp(-3, 8, easeOut(seg(p, 0.3, 0.45))) * (1 - seg(p, 0.6, 1)),
        dy: p < 0.3 ? seg(p, 0, 0.3) : 0,
      }),
      hit: (b, f) => b.strike(f, 7, { sound: 'thud', puff: true, stun: true }),
    },
    // Torbellino: dos vueltas con la espada, golpea a todos los cercanos.
    {
      dur: 0.95,
      hits: [0.4, 0.75],
      frame: (p) => {
        const a = 90 + p * 720;
        return {
          pose: 'strike',
          angle: a,
          turn: Math.sin(p * Math.PI * 4) < 0,
          trail: [a - 110, a],
          dy: -hump(p) * 2,
        };
      },
      hit: (b, f, i) => {
        if (i === 0) b.sound('swing');
        b.area(f, 26, 3, { sound: 'hit', spark: 3 });
      },
    },
  ],
  picaro: [
    // Doble puñalada.
    {
      dur: 0.55,
      hits: [0.3, 0.72],
      frame: (p) => {
        const jab = (p > 0.18 && p < 0.38) || (p > 0.6 && p < 0.8);
        return { pose: jab ? 'thrust' : 'ready', angle: 90, dx: jab ? 4 : 1 };
      },
      hit: (b, f) => b.strike(f, 2, { sound: 'hit', spark: 2 }),
    },
    // Lanzar una daga.
    {
      dur: 0.6,
      hits: [0.45],
      frame: (p) =>
        p < 0.45
          ? { pose: 'up', angle: lerp(100, -20, seg(p, 0, 0.45)) }
          : { pose: p < 0.7 ? 'strike' : 'ready', angle: 100, noWeapon: p < 0.7 },
      hit: (b, f) => {
        b.sound('whoosh');
        b.shoot(f, 'dagger', 190, false, () => b.hurt(f.foe!, f, 3, { spark: 3, sound: 'hit' }));
      },
    },
    // Voltereta hacia atrás y entrada a fondo.
    {
      dur: 1,
      hits: [0.78],
      frame: (p) => {
        if (p < 0.45) {
          const k = seg(p, 0, 0.45);
          return {
            pose: 'ready',
            angle: 100,
            dx: -12 * easeOut(k),
            dy: -11 * hump(k),
            spin: -Math.PI * 2 * k,
          };
        }
        if (p < 0.85) {
          const k = easeOut(seg(p, 0.55, 0.78));
          return { pose: 'thrust', angle: 90, dx: lerp(-12, 6, k) };
        }
        return { pose: 'ready', angle: 100, dx: 6 * (1 - seg(p, 0.85, 1)) };
      },
      hit: (b, f) => b.strike(f, 4, { sound: 'hit', spark: 5 }),
    },
    // Agacharse y puñalada hacia arriba.
    {
      dur: 0.55,
      hits: [0.55],
      frame: (p) =>
        p < 0.4
          ? { pose: 'windup', angle: 150, dy: 3 * seg(p, 0, 0.3), dx: 1 }
          : p < 0.7
            ? {
                pose: 'up',
                angle: lerp(150, 20, seg(p, 0.4, 0.58)),
                dy: lerp(3, -3, seg(p, 0.4, 0.58)),
                dx: 3,
                trail: [150, lerp(150, 20, seg(p, 0.4, 0.58))],
              }
            : { pose: 'ready', angle: 100, dy: -3 * (1 - seg(p, 0.7, 1)) },
      hit: (b, f) => b.strike(f, 3, { sound: 'hit' }),
    },
  ],
  mago: [
    // Bola de fuego.
    {
      dur: 0.95,
      hits: [0.55],
      frame: (p) =>
        p < 0.55
          ? { pose: 'up', angle: 0, glow: true }
          : { pose: p < 0.8 ? 'strike' : 'ready', angle: p < 0.8 ? 70 : 0 },
      hit: (b, f) => {
        b.sound('whoosh');
        b.shoot(f, 'fire', 120, false, () => {
          const to = f.foe!;
          b.fx('boom', to.x, b.chest(to), 0.45, P.orange, 12);
          b.burstAt('ember', to.x, b.chest(to), 10);
          b.hurt(to, f, 6, { sound: 'boom', tint: P.orange });
        });
      },
    },
    // Esquirla de hielo: congela un momento.
    {
      dur: 0.7,
      hits: [0.45],
      frame: (p) =>
        p < 0.45
          ? { pose: 'windup', angle: -10, glow: true }
          : { pose: p < 0.75 ? 'strike' : 'ready', angle: p < 0.75 ? 80 : 0 },
      hit: (b, f) => {
        b.sound('zap');
        b.shoot(f, 'ice', 170, false, () => {
          const to = f.foe!;
          b.fx('shards', to.x, b.chest(to), 0.4, P.cyan, 10);
          b.hurt(to, f, 3, { sound: 'hit', tint: P.cyan, freeze: 0.8 });
        });
      },
    },
    // Rayo del cielo.
    {
      dur: 1.05,
      hits: [0.6],
      frame: (p) => ({ pose: 'up', angle: p < 0.6 ? -8 : 8, glow: p < 0.65 }),
      hit: (b, f) => {
        const to = f.foe!;
        b.fx('bolt', to.x, b.feet(to), 0.3, P.white, 0);
        b.burstAt('spark', to.x, b.feet(to) - 4, 8);
        b.hurt(to, f, 6, { sound: 'thunder', tint: P.white, stun: true });
      },
    },
    // Onda arcana: empuja a todos alrededor.
    {
      dur: 0.85,
      hits: [0.5],
      frame: (p) =>
        p < 0.5
          ? { pose: 'up', angle: 0, glow: true, dy: -hump(seg(p, 0, 0.5)) * 2 }
          : { pose: 'ready', angle: 0 },
      hit: (b, f) => {
        b.fx('ring', f.x, b.chest(f), 0.45, P.rose, 46);
        b.area(f, 48, 5, { sound: 'zap', tint: P.rose });
      },
    },
  ],
  clerigo: [
    // Mazazo que levanta polvo.
    swing(0.7, 30, { power: 5, from: -45, to: 150, sound: 'thud', puff: true, dy: 1 }),
    // Columna de luz sagrada.
    {
      dur: 1,
      hits: [0.55],
      frame: (p) => ({ pose: 'up', angle: 0, glow: p < 0.7 }),
      hit: (b, f) => {
        const to = f.foe!;
        b.fx('pillar', to.x, b.feet(to), 0.55, P.gold, 0);
        b.hurt(to, f, 4, { sound: 'holy', tint: P.lemon });
      },
    },
    // Bendición: un halo y corazones sobre un compañero.
    {
      dur: 1,
      hits: [0.5],
      frame: (p) => ({ pose: p < 0.7 ? 'up' : 'ready', angle: 0, glow: p < 0.6 }),
      hit: (b, f) => {
        const ally = b.allyOf(f);
        b.fx('halo', ally.x, b.feet(ally), 0.9, P.lemon, 0, ally);
        b.burstAt('heart', ally.x, b.feet(ally) - 24, 3);
        b.sound('holy');
      },
    },
    // Escudo de fe: una burbuja que amortigua los golpes.
    {
      dur: 0.85,
      hits: [0.45],
      when: (b, f) => b.allies(f).some((a) => a.bubble <= 0),
      frame: (p) => ({ pose: 'up', angle: 0, glow: p < 0.5 }),
      hit: (b, f) => {
        const ally = b.allies(f).find((a) => a.bubble <= 0) ?? f;
        ally.bubble = 2.4;
        b.sound('holy', 0.7);
      },
    },
  ],
  explorador: [
    bowShot(0.7, [0.55], { power: 3 }),
    // Andanada de tres flechas.
    bowShot(1.15, [0.3, 0.55, 0.8], { power: 2 }),
    // Flecha alta que cae sobre el enemigo.
    bowShot(0.9, [0.5], { arc: true, power: 4 }),
    // Carrera y patada.
    {
      dur: 0.8,
      hits: [0.5],
      frame: (p, f) => {
        const gap = Math.max(0, Math.abs((f.foe?.x ?? f.x) - f.x) - 12);
        const k = p < 0.5 ? easeOut(seg(p, 0.05, 0.45)) : 1 - seg(p, 0.6, 1);
        return {
          pose: p > 0.4 && p < 0.6 ? 'thrust' : 'ready',
          angle: 0,
          dx: gap * k,
          noWeapon: false,
        };
      },
      hit: (b, f) => b.strike(f, 4, { sound: 'thud', puff: true }),
    },
  ],
  bruto: [
    swing(0.8, 35, { power: 4, from: -50, to: 130, sound: 'thud' }),
    // Barrido horizontal.
    swing(0.65, 35, { power: 3, from: 40, to: 150, pose0: 'windup', lunge: 3, sound: 'hit' }),
    // Embestida con el hombro.
    {
      dur: 0.85,
      hits: [0.5],
      frame: (p) => ({
        pose: 'ready',
        angle: 35,
        dx:
          p < 0.3
            ? -4 * seg(p, 0, 0.3)
            : lerp(-4, 10, easeOut(seg(p, 0.3, 0.5))) * (1 - seg(p, 0.65, 1)),
        spin: 0.25 * hump(seg(p, 0.25, 0.65)),
      }),
      hit: (b, f) => b.strike(f, 6, { sound: 'thud', puff: true }),
    },
  ],
  navajero: [
    {
      dur: 0.42,
      hits: [0.5],
      frame: (p) => ({
        pose: p > 0.3 && p < 0.7 ? 'thrust' : 'ready',
        angle: 90,
        dx: p > 0.3 && p < 0.7 ? 4 : 0,
      }),
      hit: (b, f) => b.strike(f, 2, { sound: 'hit', spark: 2 }),
    },
    swing(0.5, 90, { power: 3, from: 20, to: 140, pose0: 'windup' }),
    // Salto atrás y puñalada.
    {
      dur: 0.9,
      hits: [0.8],
      frame: (p) => {
        if (p < 0.4) {
          const k = seg(p, 0, 0.4);
          return { pose: 'ready', angle: 90, dx: -8 * k, dy: -6 * hump(k) };
        }
        const k = easeOut(seg(p, 0.55, 0.8));
        return {
          pose: p > 0.6 && p < 0.9 ? 'thrust' : 'ready',
          angle: 90,
          dx: lerp(-8, 5, k) * (1 - seg(p, 0.9, 1)),
        };
      },
      hit: (b, f) => b.strike(f, 3, { sound: 'hit' }),
    },
  ],
  arquero: [
    bowShot(0.75, [0.6], { power: 3 }),
    bowShot(0.95, [0.55], { arc: true, power: 3 }),
    bowShot(0.8, [0.6], { fire: true, power: 3 }),
  ],
  incendiario: [
    // Antorchazo: lluvia de ascuas.
    {
      ...swing(0.6, 20, { power: 3, from: -30, to: 120 }),
      hit: (b, f) => {
        b.strike(f, 3, { sound: 'hit', fire: true });
        if (f.foe) b.burstAt('ember', f.foe.x, b.chest(f.foe), 8);
      },
    },
    // Botella de aceite ardiendo.
    {
      dur: 0.8,
      hits: [0.45],
      frame: (p) =>
        p < 0.45 ? { pose: 'windup', angle: 20 } : { pose: p < 0.7 ? 'up' : 'ready', angle: 20 },
      hit: (b, f) => {
        b.sound('whoosh');
        b.shoot(f, 'bottle', 110, true, () => {
          const to = f.foe!;
          b.fx('boom', to.x, b.feet(to) - 4, 0.4, P.orange, 10);
          b.burstAt('ember', to.x, b.feet(to) - 4, 12);
          b.hurt(to, f, 4, { sound: 'boom', tint: P.orange });
        });
      },
    },
    // Escupir fuego con la antorcha.
    {
      dur: 0.9,
      hits: [0.45],
      frame: (p) => ({ pose: p > 0.3 && p < 0.75 ? 'thrust' : 'ready', angle: 70 }),
      hit: (b, f) => {
        b.fx('flames', f.x + f.face * 14, b.chest(f) + 2, 0.4, P.orange, 22, undefined, f.face);
        b.strike(f, 3, { sound: 'whoosh', tint: P.orange, fire: true });
      },
    },
  ],
  jefe: [
    swing(0.85, 30, { power: 6, from: -60, to: 140, sound: 'thud', puff: true }),
    // Grito de guerra: los suyos se enrabietan.
    {
      dur: 0.9,
      hits: [0.35],
      frame: (p) => ({ pose: 'up', angle: -10, dy: p > 0.3 && p < 0.7 ? -1 : 0 }),
      hit: (b, f) => {
        b.fx('shout', f.x + f.face * 10, b.chest(f) - 6, 0.6, P.sand, 18, undefined, f.face);
        for (const a of b.allies(f)) a.rage = 1.6;
        b.sound('roar');
      },
    },
    // Hacha giratoria.
    {
      dur: 0.9,
      hits: [0.5],
      frame: (p) => {
        const a = 60 + p * 540;
        return {
          pose: 'strike',
          angle: a,
          trail: [a - 100, a],
          turn: Math.sin(p * Math.PI * 3) < 0,
        };
      },
      hit: (b, f) => {
        b.sound('swing');
        b.area(f, 24, 4, { sound: 'hit', spark: 3 });
      },
    },
  ],
  ...BOSS_MOVES,
};

interface Kit {
  main: WeaponId;
  off?: WeaponId;
  /** Ángulo del arma en guardia. */
  ready: number;
  ranged: boolean;
  torch: boolean;
}

const KITS: Record<Style, Kit> = {
  guerrero: { main: 'espada', off: 'escudo', ready: 30, ranged: false, torch: false },
  picaro: { main: 'daga', off: 'daga', ready: 100, ranged: false, torch: false },
  mago: { main: 'baston', ready: 0, ranged: true, torch: false },
  clerigo: { main: 'maza', ready: 30, ranged: false, torch: false },
  explorador: { main: 'arco', ready: 0, ranged: true, torch: false },
  bruto: { main: 'garrote', ready: 35, ranged: false, torch: true },
  navajero: { main: 'cuchillo', ready: 90, ranged: false, torch: true },
  arquero: { main: 'arco', ready: 0, ranged: true, torch: false },
  incendiario: { main: 'antorcha', ready: 20, ranged: false, torch: true },
  jefe: { main: 'hacha', ready: 30, ranged: false, torch: true },
  bestia: { main: 'garrote', ready: 0, ranged: false, torch: false },
  ahogado: { main: 'garrote', ready: 0, ranged: false, torch: false },
  sierpe: { main: 'garrote', ready: 0, ranged: false, torch: false },
  jabali: { main: 'garrote', ready: 0, ranged: false, torch: false },
  reina: { main: 'garrote', ready: 0, ranged: false, torch: false },
  dragona: { main: 'garrote', ready: 0, ranged: false, torch: false },
};

export const BANDIT_TYPES: Style[] = ['bruto', 'navajero', 'arquero', 'incendiario'];

export function banditLook(style: Style, i: number): { look: HeroLook; marks: HeroMarks } {
  const seed = `bandido-${i}`;
  switch (style) {
    case 'bruto':
      return {
        look: {
          ...generateLook(seed, 'guerrero', 'm'),
          headgear: null,
          hairStyle: 'calvo',
          beard: true,
        },
        marks: { scar: true },
      };
    case 'arquero':
      return {
        look: { ...generateLook(seed, 'explorador', i % 2 ? 'f' : 'm'), headgear: 'capucha' },
        marks: {},
      };
    case 'incendiario':
      return { look: { ...generateLook(seed, 'picaro', 'm'), headgear: 'gorra' }, marks: {} };
    case 'jefe':
      return {
        look: { ...generateLook(seed, 'guerrero', 'm'), headgear: 'sombrero', beard: true },
        marks: { eyepatch: true },
      };
    default:
      return {
        look: { ...generateLook(seed, 'picaro', i % 3 ? 'm' : 'f'), headgear: 'capucha' },
        marks: { eyepatch: i % 2 === 1 },
      };
  }
}

function styleOf(outfit: string): Style {
  return outfit === 'picaro' || outfit === 'mago' || outfit === 'clerigo' || outfit === 'explorador'
    ? outfit
    : 'guerrero';
}

// Copias teñidas de cada sprite para el destello del golpe (blanco, hielo, rabia…).
const tinted = new WeakMap<PixelBuffer, Map<string, HTMLCanvasElement>>();
function tintOf(img: PixelBuffer, color: string): HTMLCanvasElement {
  let m = tinted.get(img);
  if (!m) tinted.set(img, (m = new Map()));
  let c = m.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.w;
    c.height = img.h;
    const x = c.getContext('2d')!;
    x.drawImage(bufferCanvas(img), 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color;
    x.fillRect(0, 0, img.w, img.h);
    m.set(color, c);
  }
  return c;
}

const RGB: Record<string, [number, number, number]> = {
  [P.orange]: [255, 140, 60],
  [P.cyan]: [120, 230, 255],
  [P.white]: [200, 220, 255],
  [P.gold]: [255, 210, 110],
  [P.lemon]: [255, 230, 140],
  [P.rose]: [220, 120, 200],
};

export class Battle {
  t = 0;
  done = false;
  readonly hidden: Set<string>;
  /** Cuándo empiezan los golpes, cuándo se decide y cuánto dura. */
  readonly fightAt: number;
  readonly outcomeAt: number;
  readonly duration: number;
  private fighters: Fighter[] = [];
  private shots: Shot[] = [];
  private effects: Fx[] = [];
  private resolved = false;
  private lastSound = new Map<string, number>();
  /** En las peleas contra jefes: quién cae antes del final, y cuándo. */
  private doom: { f: Fighter; at: number }[] = [];
  private roared = false;

  constructor(
    private spec: BattleSpec,
    private hooks: BattleHooks,
  ) {
    this.hidden = new Set(spec.defenders.map((d) => d.id));
    const times = spec.arena ? ARENA_TIMES : { fight: 4.6, outcome: 9.2, end: BATTLE_TIME };
    this.fightAt = times.fight;
    this.outcomeAt = times.outcome;
    this.duration = times.end;
    if (spec.arena) {
      this.setupArena(spec.arena);
      return;
    }
    const n = spec.bandits;
    for (let i = 0; i < n; i++) {
      const style: Style =
        i === 0 && n >= 4 ? 'jefe' : BANDIT_TYPES[(i + n) % BANDIT_TYPES.length]!;
      const { look, marks } = banditLook(style, i);
      const base = spec.defenders.length ? -100 + i * 24 : DOOR - 8 - i * 6;
      const spot = KITS[style].ranged && spec.defenders.length ? base - 18 : base;
      this.fighters.push(
        this.fighter('b', style, look, marks, {
          x: -150 - i * 16,
          target: spot,
          speed: 34,
          dist: i * 5,
          then: spec.defenders.length ? 'fight' : 'inside',
        }),
      );
    }
  }

  /** Jefe y esbirros a la derecha; el grupo entra andando por la izquierda. */
  private setupArena(a: NonNullable<BattleSpec['arena']>): void {
    const art = bossArt(a.boss);
    const bx = Math.round(a.width * 0.74);
    const dummy = banditLook('jefe', 0);
    const boss = this.fighter('b', a.boss, dummy.look, dummy.marks, {
      x: bx,
      target: bx,
      speed: 0,
      dist: 0,
      then: 'fight',
    });
    Object.assign(boss, { art, chestH: art.chest, state: 'fight', face: -1, cool: 1 });
    this.fighters.push(boss);
    const minions: Fighter[] = [];
    for (let i = 0; i < a.minions; i++) {
      const style: Style = i % 2 ? 'navajero' : 'bruto';
      const { look, marks } = banditLook(style, 100 + i);
      const m = this.fighter('b', style, { ...look, headgear: null }, marks, {
        x: a.width + 16 + i * 14,
        target: bx - art.reach - 16 - i * 16,
        speed: 30,
        dist: i * 5,
        then: 'fight',
      });
      m.ghost = true;
      m.ghostTint = a.boss === 'reina' ? P.mist : P.leaf;
      minions.push(m);
      this.fighters.push(m);
    }
    const foes = [...minions, boss];
    const front = (f: Fighter) => f.target - (f.art ? f.art.reach : 0) - 13;
    let melee = 0;
    let ranged = 0;
    this.spec.defenders.forEach((d, i) => {
      const style = styleOf(d.look.outfit);
      const far = KITS[style].ranged;
      const k = far ? ranged++ : melee++;
      const foe = far ? boss : foes[k % foes.length]!;
      const f = this.fighter('d', style, d.look, d.marks, {
        id: d.id,
        x: -14 - i * 14,
        target: far
          ? Math.max(14, bx - art.reach - 64 - k * 14)
          : front(foe) - Math.floor(k / foes.length) * 7,
        speed: 55,
        dist: i * 3,
        then: 'fight',
        foe,
      });
      foe.foe ??= f;
      this.fighters.push(f);
      // Los que acaban heridos (o peor) caen antes del final, uno tras otro.
      if (d.hurt) this.doom.push({ f, at: this.outcomeAt - 3.2 + this.doom.length * 0.9 });
    });
  }

  private fighter(
    side: 'b' | 'd',
    style: Style,
    look: HeroLook,
    marks: HeroMarks,
    o: Pick<Fighter, 'x' | 'target' | 'speed' | 'dist' | 'then'> & { id?: string; foe?: Fighter },
  ): Fighter {
    return {
      side,
      style,
      spr: heroSprites(look, marks),
      poses: fightSprites(look, marks),
      state: 'walk',
      face: side === 'b' ? 1 : -1,
      sack: false,
      cool: 0.2 + Math.random() * 0.9,
      flash: 0,
      tint: P.white,
      knock: 0,
      frozen: 0,
      bubble: 0,
      stun: 0,
      rage: 0,
      torchAt: null,
      chestH: CHEST,
      hp: 1,
      ...o,
    };
  }

  // ---------- Ayudas para los ataques ----------

  feet(f: Fighter): number {
    return this.hooks.feetAt(f.x);
  }

  chest(f: Fighter): number {
    return this.hooks.feetAt(f.x) - f.chestH;
  }

  sound(name: BattleSound, volume = 1): void {
    const last = this.lastSound.get(name) ?? -1;
    if (this.t - last < 0.07) return;
    this.lastSound.set(name, this.t);
    this.hooks.sound(name, volume);
  }

  burstAt(kind: PKind, x: number, y: number, n: number): void {
    this.hooks.burst(kind, x, y, n);
  }

  fx(
    kind: FxKind,
    x: number,
    y: number,
    dur: number,
    color: string,
    r: number,
    follow?: Fighter,
    dir: 1 | -1 = 1,
  ): void {
    this.effects.push({ kind, x, y, t: 0, dur, color, r, follow, dir, seed: Math.random() * 1000 });
  }

  private alive(f: Fighter | undefined): f is Fighter {
    return !!f && (f.state === 'fight' || f.state === 'cheer' || f.state === 'walk');
  }

  allies(f: Fighter): Fighter[] {
    return this.fighters.filter((a) => a.side === f.side && a.state === 'fight');
  }

  allyOf(f: Fighter): Fighter {
    const xs = this.allies(f);
    return xs.length ? pick(xs) : f;
  }

  /** Golpe a quien tiene delante. */
  strike(
    f: Fighter,
    power: number,
    o: {
      sound?: BattleSound;
      puff?: boolean;
      stun?: boolean;
      spark?: number;
      tint?: string;
      fire?: boolean;
    },
  ): void {
    if (!this.alive(f.foe)) return;
    this.hurt(f.foe, f, power, o);
  }

  /** Golpe a todos los enemigos a menos de `radius`. */
  area(f: Fighter, radius: number, power: number, o: HurtOpts): void {
    for (const e of this.fighters)
      if (e.side !== f.side && e.state === 'fight' && Math.abs(e.x - f.x) <= radius)
        this.hurt(e, f, power, o);
  }

  /** Golpe a los enemigos de `f` que estén a menos de `radius` del punto `x`. */
  areaAt(f: Fighter, x: number, radius: number, power: number, o: HurtOpts): void {
    for (const e of this.fighters)
      if (e.side !== f.side && e.state === 'fight' && Math.abs(e.x - x) <= radius)
        this.hurt(e, f, power, o);
  }

  /** Aturde a los enemigos cercanos (rugidos de los jefes). */
  stunAround(f: Fighter, radius: number, dur: number): void {
    for (const e of this.fighters)
      if (e.side !== f.side && e.state === 'fight' && Math.abs(e.x - f.x) <= radius) {
        e.stun = Math.max(e.stun, dur);
        e.move = undefined;
        this.fx('stars', e.x, this.chest(e) - 14, dur, P.lemon, 0, e);
      }
  }

  hurt(to: Fighter, from: Fighter, power: number, o: HurtOpts = {}): void {
    if (!this.alive(to)) return;
    const dir = Math.sign(to.x - from.x) || -from.face;
    const shielded = to.bubble > 0;
    to.flash = 0.09;
    to.tint = shielded ? P.cyan : (o.tint ?? P.white);
    if (to.art) {
      // El jefe apenas se mueve con los golpes, pero la barra baja (sin llegar al final
      // antes de tiempo: el desenlace ya está escrito).
      to.knock += dir * power * 0.25;
      const floor = !this.spec.won ? 0.45 : this.t < this.outcomeAt ? 0.12 : 0;
      to.hp = Math.max(floor, to.hp - power * 0.016);
    } else {
      to.knock += dir * (shielded ? power * 0.3 : power);
      if (o.stun && !shielded) to.stun = 0.55;
      if (o.freeze && !shielded) to.frozen = o.freeze;
      if (to.move && power >= 5 && !shielded) to.move = undefined;
    }
    const y = this.chest(to);
    const sx = to.x - dir * 4;
    if (o.spark !== 0) this.hooks.burst('spark', sx, y, o.spark ?? 4);
    if (o.fire) this.hooks.burst('ember', sx, y, 5);
    if (o.puff) this.hooks.burst('puff', to.x, this.feet(to) - 2, 5);
    if (o.stun && !shielded && !to.art) this.fx('stars', to.x, y - 14, 0.55, P.lemon, 0, to);
    if (power >= 5) this.fx('slash', sx, y, 0.18, P.white, 0, undefined, dir > 0 ? 1 : -1);
    if (o.sound) this.sound(o.sound, o.sound === 'hit' ? 0.55 : 0.8);
  }

  /** Lanza un proyectil desde la mano hacia el enemigo. */
  shoot(f: Fighter, kind: ShotKind, speed: number, arc: boolean, onHit: () => void): void {
    const to = f.foe;
    if (!this.alive(to)) return;
    const hand = HAND.strike;
    const x0 = f.x + f.face * (hand.x - 9);
    const y0 = this.feet(f) - FEET_Y + hand.y;
    const x1 = to.x;
    const y1 = this.chest(to);
    const life = Math.max(0.12, Math.abs(x1 - x0) / speed);
    const g = arc ? 260 : 0;
    this.shots.push({
      kind,
      x: x0,
      y: y0,
      vx: (x1 - x0) / life,
      vy: (y1 - y0 - 0.5 * g * life * life) / life,
      g,
      t: 0,
      life,
      to,
      onHit,
      trail: [],
    });
    if (kind === 'arrow' || kind === 'firearrow') this.sound('arrow', 0.7);
  }

  /** Luces de la pelea: antorchas, bolas de fuego, rayos… */
  lights(): BattleLight[] {
    const out: BattleLight[] = [];
    for (const f of this.fighters)
      if (f.torchAt && f.state !== 'gone' && f.state !== 'inside' && f.state !== 'down')
        out.push({ ...f.torchAt, r: 30, color: [255, 150, 70] });
    return out.concat(this.glows());
  }

  /** Brillos de la magia y el fuego (también se suman como luz aditiva). */
  glows(): BattleLight[] {
    if (this.done) return [];
    const out: BattleLight[] = [];
    for (const s of this.shots)
      if (s.kind === 'fire' || s.kind === 'firearrow' || s.kind === 'bottle')
        out.push({ x: s.x, y: s.y, r: 22, color: [255, 140, 60] });
      else if (s.kind === 'ice') out.push({ x: s.x, y: s.y, r: 18, color: [120, 230, 255] });
    for (const e of this.effects) {
      const c = RGB[e.color];
      if (!c || e.kind === 'stars' || e.kind === 'slash' || e.kind === 'shards') continue;
      const big = e.kind === 'bolt' || e.kind === 'pillar' || e.kind === 'boom';
      out.push({ x: e.follow?.x ?? e.x, y: e.y - (big ? 10 : 0), r: big ? 46 : 30, color: c });
    }
    return out;
  }

  /** Salta al final (el resultado no cambia). */
  finish(): void {
    this.t = this.duration;
    this.done = true;
  }

  /** Vida del jefe (0–1), o null si no es una pelea contra un jefe. */
  get bossHp(): number | null {
    const b = this.fighters.find((f) => f.art);
    return b ? b.hp : null;
  }

  update(dt: number): void {
    if (this.done) return;
    const t0 = this.t;
    this.t += dt;
    const { spec, hooks } = this;
    const bandits = this.fighters.filter((f) => f.side === 'b');

    if (spec.arena) this.arenaBeats(t0);
    // Los defensores salen por la puerta poco después de que suene la alarma.
    if (!spec.arena && t0 < 1.4 && this.t >= 1.4) {
      // Cuerpo a cuerpo, cada uno frente a un bandido; los de distancia, detrás de la línea.
      const front = Math.max(...bandits.map((b) => b.target)) + 13;
      let melee = 0;
      let ranged = 0;
      spec.defenders.forEach((d, i) => {
        const style = styleOf(d.look.outfit);
        const far = KITS[style].ranged;
        const k = far ? ranged++ : melee++;
        const foe =
          bandits[(far ? bandits.length - 1 - (k % bandits.length) : k) % bandits.length]!;
        const f = this.fighter('d', style, d.look, d.marks, {
          id: d.id,
          x: DOOR - 4 + i * 4,
          target: far ? front + 22 + k * 14 : foe.target + 13 + Math.floor(k / bandits.length) * 6,
          speed: 50,
          dist: i * 3,
          then: 'fight',
          foe,
        });
        foe.foe ??= f;
        this.fighters.push(f);
      });
      if (spec.defenders.length) hooks.sound('creak');
    }

    // Desenlace.
    if (!this.resolved && this.t >= this.outcomeAt) {
      this.resolved = true;
      this.outcome();
    }
    if (this.t >= this.duration) this.done = true;

    for (const f of this.fighters) {
      f.flash = Math.max(0, f.flash - dt);
      f.knock *= Math.exp(-dt * 9);
      f.frozen = Math.max(0, f.frozen - dt);
      f.bubble = Math.max(0, f.bubble - dt);
      f.stun = Math.max(0, f.stun - dt);
      f.rage = Math.max(0, f.rage - dt);
      if (f.state === 'walk' || f.state === 'flee' || f.state === 'loot') {
        const step = f.speed * dt * Math.sign(f.target - f.x);
        f.dist += Math.abs(step);
        if (Math.abs(f.target - f.x) <= Math.abs(step)) {
          f.x = f.target;
          this.arrive(f);
        } else f.x += step;
      } else if (f.state === 'fight') this.fight(f, dt);
    }

    // Proyectiles.
    for (const s of this.shots) {
      s.t += dt;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 6) s.trail.shift();
      s.vy += s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.kind === 'fire' && Math.random() < 0.5) hooks.burst('ember', s.x, s.y, 1);
      if (s.t >= s.life) {
        if (this.alive(s.to)) s.onHit();
        s.t = Infinity;
      }
    }
    this.shots = this.shots.filter((s) => s.t !== Infinity);

    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);
  }

  /** Turno de un luchador: elige ataque, lo ejecuta y descansa un poco. */
  private fight(f: Fighter, dt: number): void {
    if (!this.alive(f.foe) || f.foe.state !== 'fight') {
      const foes = this.fighters.filter((e) => e.side !== f.side && e.state === 'fight');
      if (foes.length)
        f.foe = foes.reduce((a, b) => (Math.abs(b.x - f.x) < Math.abs(a.x - f.x) ? b : a));
    }
    if (f.foe) f.face = f.foe.x >= f.x ? 1 : -1;
    if (this.t >= this.outcomeAt || this.t < this.fightAt - 0.8) {
      // Fuera de la pelea solo vale el rugido del jefe al ver llegar al grupo.
      if (f.move?.m === ROAR) {
        f.move.t += dt;
        if (f.move.t >= ROAR.dur) f.move = undefined;
      } else f.move = undefined;
      return;
    }
    if (f.stun > 0 || f.frozen > 0) return;
    const speed = f.rage > 0 ? 1.35 : 1;
    if (!f.move) {
      f.cool -= dt * speed;
      if (f.cool > 0 || !this.alive(f.foe) || f.foe.state !== 'fight') return;
      const options = MOVES[f.style].filter((m) => m !== f.last && (!m.when || m.when(this, f)));
      const m = pick(options.length ? options : MOVES[f.style]);
      f.move = { m, t: 0, fired: 0 };
      f.last = m;
      return;
    }
    const mv = f.move;
    mv.t += dt * speed;
    const p = mv.t / mv.m.dur;
    while (mv.fired < mv.m.hits.length && p >= mv.m.hits[mv.fired]!) {
      if (this.alive(f.foe)) mv.m.hit(this, f, mv.fired);
      mv.fired++;
    }
    if (p >= 1) {
      f.move = undefined;
      f.cool = 0.2 + Math.random() * 0.75;
    }
  }

  /** Momentos fijos de la pelea contra el jefe: el rugido al llegar y los que caen. */
  private arenaBeats(t0: number): void {
    const boss = this.fighters.find((f) => f.art)!;
    // Muerte del jefe: mientras se hunde, el agua borbotea; al final, el golpe (o el
    // último remolino) y el polvo.
    const dead = boss.state === 'down' ? this.t - (boss.downAt ?? 0) : -1;
    const sinks = boss.art!.fall === 'sink';
    if (sinks && dead > TIP_SWAY && !boss.landed && Math.random() < 0.5)
      this.hooks.burst('splash', boss.x + (Math.random() - 0.5) * 24, this.feet(boss) - 1, 1);
    if (dead >= deathTime(boss) && !boss.landed) {
      boss.landed = true;
      const y = this.feet(boss) - 1;
      if (sinks) {
        this.fx('ring', boss.x, y, 0.9, P.sky, 30);
        this.hooks.burst('splash', boss.x, y - 1, 12);
        this.sound('zap', 0.6);
      } else {
        this.hooks.burst('puff', boss.x, y - 1, 16);
        this.fx('ring', boss.x, y, 0.6, P.sand, 34);
        this.sound('boom', 0.7);
      }
      this.sound('thud');
    }
    if (!this.roared && this.t >= 1.6) {
      this.roared = true;
      const m = boss.art!.mouth.up;
      boss.move = { m: ROAR, t: 0, fired: 0 };
      this.fx(
        'shout',
        boss.x + boss.face * m.x,
        this.feet(boss) + m.y,
        0.9,
        P.sand,
        26,
        undefined,
        boss.face,
      );
      this.sound('roar');
    }
    for (const d of this.doom) {
      if (t0 >= d.at || this.t < d.at || d.f.state !== 'fight') continue;
      d.f.flash = 0.25;
      d.f.tint = P.white;
      d.f.knock -= 12;
      d.f.move = undefined;
      this.hooks.burst('spark', d.f.x, this.chest(d.f), 8);
      this.fx('slash', d.f.x, this.chest(d.f), 0.25, P.white, 0);
      this.sound('thud');
      d.f.state = 'down';
    }
  }

  private arrive(f: Fighter): void {
    if (f.state === 'flee') {
      f.state = 'gone';
      return;
    }
    if (f.state === 'loot') {
      // En la puerta: entran a por el botín y salen con un saco.
      if (!f.sack) {
        f.state = 'inside';
        setTimeout(() => {
          f.sack = true;
          f.state = 'flee';
          f.target = -170;
          f.speed = 60;
          this.hooks.coin(DOOR, this.hooks.feetAt(DOOR) - 14);
        }, 1100);
      }
      return;
    }
    if (f.then === 'inside') {
      f.state = 'loot';
      f.target = DOOR + 2;
      return;
    }
    f.state = f.then;
    f.face = (f.side === 'b') === !this.spec.arena ? 1 : -1;
  }

  private outcome(): void {
    const { spec, hooks } = this;
    const bandits = this.fighters.filter((f) => f.side === 'b');
    const defenders = this.fighters.filter((f) => f.side === 'd');
    if (!defenders.length) return;
    for (const f of this.fighters) f.move = undefined;
    const knockout = (f: Fighter, by: Fighter | undefined) => {
      f.flash = 0.25;
      f.tint = P.white;
      f.knock += (by ? Math.sign(f.x - by.x) : f.side === 'b' ? -1 : 1) * (f.art ? 3 : 10);
      hooks.burst('spark', f.x, this.chest(f), 8);
      this.fx('slash', f.x, this.chest(f), 0.22, P.white, 0);
      f.state = 'down';
      f.downAt = this.t;
    };
    if (spec.arena) {
      const boss = bandits.find((f) => f.art)!;
      const standing = defenders.filter((d) => d.state === 'fight');
      if (spec.won) {
        boss.hp = 0;
        knockout(boss, standing[0]);
        // Último grito; el golpe contra el suelo llega al caer (ver `arenaBeats`).
        const m = boss.art!.mouth.up;
        this.fx(
          'shout',
          boss.x + boss.face * m.x,
          this.feet(boss) + m.y,
          0.7,
          P.sand,
          22,
          undefined,
          boss.face,
        );
        this.sound('roar');
        bandits.forEach((b, i) => {
          if (b === boss) return;
          if (i % 2) knockout(b, b.foe);
          else Object.assign(b, { state: 'flee', target: spec.arena!.width + 40, speed: 60 });
        });
        for (const d of standing) d.state = 'cheer';
        setTimeout(() => hooks.sound('cheer'), 700);
      } else {
        boss.state = 'cheer';
        this.fx(
          'shout',
          boss.x + boss.face * 20,
          this.chest(boss) - 8,
          1,
          P.sand,
          30,
          undefined,
          boss.face,
        );
        this.sound('roar');
        for (const b of bandits) if (b !== boss && b.state === 'fight') b.state = 'cheer';
        for (const d of standing) Object.assign(d, { state: 'flee', target: -40, speed: 62 });
      }
      return;
    }
    if (spec.won) {
      bandits.forEach((b, i) => {
        if (i % 2 === 0 && i < bandits.length - 1) knockout(b, b.foe);
        else Object.assign(b, { state: 'flee', target: -170, speed: 70 });
      });
      for (const d of defenders) d.state = 'cheer';
      this.sound('thud');
      hooks.sound('cheer');
      // Los caídos se levantan y huyen renqueando al final.
      setTimeout(() => {
        for (const b of bandits)
          if (b.state === 'down') Object.assign(b, { state: 'flee', target: -170, speed: 45 });
      }, 2200);
    } else {
      for (const d of defenders)
        if (spec.defenders.find((x) => x.id === d.id)?.hurt) knockout(d, d.foe);
      this.sound('thud');
      bandits.forEach((b, i) => {
        if (i < 2) Object.assign(b, { state: 'loot', target: DOOR + 2, speed: 55, then: 'inside' });
        else b.state = 'cheer';
      });
      setTimeout(() => {
        for (const b of bandits)
          if (b.state === 'cheer') Object.assign(b, { state: 'flee', target: -170, speed: 50 });
      }, 2000);
    }
  }

  // ---------- Dibujo ----------

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.done) return;
    const order = [...this.fighters].sort((a, b) => a.x - b.x);
    for (const f of order) {
      f.torchAt = null;
      if (f.state === 'gone' || f.state === 'inside') continue;
      const feet = this.hooks.feetAt(f.x);
      ctx.fillStyle = 'rgba(24, 20, 37, 0.45)';
      const half = f.art ? f.art.reach : 5;
      const sunk = f.art?.fall === 'sink' && f.state === 'down';
      if (!sunk) ctx.fillRect(Math.round(f.x + f.knock - half) - cx, feet - 1 - cy, half * 2, 1);
      if (f.art) this.drawBoss(ctx, f, feet, cx, cy);
      else if (f.state === 'walk' || f.state === 'flee' || f.state === 'loot')
        this.drawWalker(ctx, f, feet, cx, cy);
      else this.drawFighter(ctx, f, feet, cx, cy);
    }
  }

  private drawWalker(
    ctx: CanvasRenderingContext2D,
    f: Fighter,
    feet: number,
    cx: number,
    cy: number,
  ): void {
    const img = f.spr.walk[Math.floor(f.dist / 1.75) % f.spr.walk.length]!;
    const flip = f.target < f.x;
    const x = Math.round(f.x - 9) - cx;
    const y = feet - FEET_Y - cy;
    ctx.save();
    if (flip) {
      ctx.translate(x + img.w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(bufferCanvas(img), 0, 0);
    } else ctx.drawImage(bufferCanvas(img), x, y);
    if (f.ghost) {
      ctx.globalAlpha = 0.45;
      const tint = f.ghostTint ?? P.leaf;
      if (flip) ctx.drawImage(tintOf(img, tint), 0, 0);
      else ctx.drawImage(tintOf(img, tint), x, y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Antorcha o saco en la mano.
    if (f.side !== 'b' || f.ghost) return;
    const hx = Math.round(f.x + 5 * (flip ? -1 : 1)) - cx;
    const hy = y + 6;
    if (f.sack) {
      ctx.fillStyle = P.oak;
      ctx.fillRect(hx - 3, hy - 2, 6, 6);
      ctx.fillStyle = P.gold;
      ctx.fillRect(hx - 1, hy - 3, 2, 1);
    } else if (KITS[f.style].torch) {
      ctx.fillStyle = P.bark;
      ctx.fillRect(hx, hy, 1, 6);
      this.flame(ctx, hx, hy - 1, f.x);
      f.torchAt = { x: hx + cx, y: hy + cy };
    }
  }

  private flame(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
    ctx.fillStyle = Math.sin(this.t * 20 + seed) > 0 ? P.lemon : P.orange;
    ctx.fillRect(x - 1, y - 2, 3, 3);
    ctx.fillStyle = P.orange;
    ctx.fillRect(x, y - 3 - (Math.sin(this.t * 13 + seed) > 0 ? 1 : 0), 1, 1);
    ctx.fillStyle = P.white;
    ctx.fillRect(x, y - 1, 1, 1);
  }

  /** Lo que hace ahora mismo: guardia, un ataque, celebrar, caído… */
  private frameOf(f: Fighter): Frame {
    const ready = KITS[f.style].ready;
    if (f.state === 'cheer') {
      const up = Math.sin(this.t * 9 + f.x) > 0;
      return { pose: up ? 'up' : 'ready', angle: up ? -5 : ready, dy: up ? -2 : 0 };
    }
    if (f.move) return f.move.m.frame(clamp01(f.move.t / f.move.m.dur), f);
    if (f.stun > 0) return { pose: 'windup', angle: ready + 20, dx: -1 };
    // En guardia: un leve vaivén.
    const sway = Math.sin(this.t * 5 + f.x) > 0.3 ? 1 : 0;
    return { pose: 'ready', angle: ready + sway * 6, dy: 0 };
  }

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    f: Fighter,
    feet: number,
    cx: number,
    cy: number,
  ): void {
    const kit = KITS[f.style];
    if (f.state === 'down') {
      // Tumbado en el suelo.
      const img = f.poses.ready;
      ctx.save();
      ctx.translate(Math.round(f.x + f.knock) - cx, feet - 3 - cy);
      ctx.rotate(f.side === 'b' ? -Math.PI / 2 : Math.PI / 2);
      ctx.drawImage(bufferCanvas(img), -img.w / 2, -img.h / 2);
      if (f.flash > 0) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(tintOf(img, f.tint), -img.w / 2, -img.h / 2);
      }
      ctx.restore();
      return;
    }
    const fr = this.frameOf(f);
    const face = (fr.turn ? -f.face : f.face) as 1 | -1;
    const ox = Math.round(f.x + f.knock + (fr.dx ?? 0) * f.face);
    const oy = Math.round(feet + (fr.dy ?? 0));
    const hand = HAND[fr.pose];
    const hx = hand.x - 9;
    const hy = hand.y - FEET_Y;
    ctx.save();
    ctx.translate(ox - cx, oy - cy);
    if (face < 0) ctx.scale(-1, 1);
    if (fr.spin) {
      ctx.translate(0, -CHEST);
      ctx.rotate(fr.spin);
      ctx.translate(0, CHEST);
    }

    // Lo que va a la espalda o en la otra mano (detrás del cuerpo).
    if (kit.off === 'escudo' && !fr.shield) this.weapon(ctx, 'escudo', -4, -15, 0);
    if (kit.off === 'daga') this.weapon(ctx, 'daga', 3, -9, 120);
    if (kit.torch && kit.main !== 'antorcha' && !f.ghost) {
      this.weapon(ctx, 'antorcha', -3, -10, -20);
      this.flame(ctx, -5, -15, f.x);
      f.torchAt = { x: f.x - 5 * face, y: oy - 15 };
    }

    const img = f.poses[fr.pose];
    const special =
      f.frozen > 0
        ? P.cyan
        : f.rage > 0 && Math.sin(this.t * 16) > 0
          ? P.red
          : f.ghost
            ? (f.ghostTint ?? P.leaf)
            : null;
    const c =
      f.flash > 0 ? tintOf(img, f.tint) : special ? tintOf(img, special) : bufferCanvas(img);
    // El destello y los tintes van sobre el sprite, semitransparentes.
    if (special || f.flash > 0) {
      ctx.drawImage(bufferCanvas(img), -9, -FEET_Y);
      ctx.globalAlpha = f.flash > 0 ? 0.7 : 0.45;
    }
    ctx.drawImage(c, -9, -FEET_Y);
    ctx.globalAlpha = 1;

    if (fr.shield) this.weapon(ctx, 'escudo', 7, -13, 0);
    if (!fr.noWeapon) {
      this.weapon(ctx, kit.main, hx, hy, fr.angle);
      if (kit.main === 'antorcha') {
        const a = (fr.angle * Math.PI) / 180;
        const tx = Math.round(hx + Math.sin(a) * 5);
        const ty = Math.round(hy - Math.cos(a) * 5);
        this.flame(ctx, tx, ty, f.x);
        f.torchAt = { x: ox + tx * face, y: oy + ty };
      }
      if (fr.nock) {
        // Flecha montada: del arco hacia atrás.
        ctx.fillStyle = P.tan;
        ctx.fillRect(hx - 7, hy, 8, 1);
        ctx.fillStyle = P.mist;
        ctx.fillRect(hx + 1, hy, 1, 1);
      }
      if (fr.glow) {
        const a = (fr.angle * Math.PI) / 180;
        const gx = Math.round(hx + Math.sin(a) * 9);
        const gy = Math.round(hy - Math.cos(a) * 9);
        const on = Math.floor(this.t * 14) % 2 === 0;
        ctx.fillStyle = f.style === 'clerigo' ? P.lemon : P.cyan;
        ctx.fillRect(gx - 1, gy - 1, 3, 3);
        if (on) {
          ctx.fillStyle = P.white;
          ctx.fillRect(gx - 2, gy, 5, 1);
          ctx.fillRect(gx, gy - 2, 1, 5);
        }
      }
    }
    if (fr.trail) this.trail(ctx, hx, hy, fr.trail[0], fr.trail[1], kit.main);
    ctx.restore();

    if (f.bubble > 0) this.bubble(ctx, ox - cx, oy - CHEST - cy, f.bubble);
  }

  /** El jefe: su pose según lo que hace, volteado hacia el grupo, con destellos y tintes. */
  private drawBoss(
    ctx: CanvasRenderingContext2D,
    f: Fighter,
    feet: number,
    cx: number,
    cy: number,
  ): void {
    const art = f.art!;
    if (f.state === 'down' && art.fall === 'sink') {
      this.drawSinking(ctx, f, feet, cx, cy);
      return;
    }
    // Al morir se encabrita un momento, temblando, antes de caer de golpe.
    const dying = f.state === 'down' && this.t - (f.downAt ?? -9) < deathTime(f);
    const fr: Frame | null =
      f.state !== 'down'
        ? this.frameOf(f)
        : dying
          ? { pose: 'up', angle: 0, dx: Math.sin(this.t * 40) * 1.5 }
          : null;
    const pose: BossPose = fr ? fr.pose : 'down';
    const img = art.poses[pose];
    const face = fr?.turn ? -f.face : f.face;
    ctx.save();
    ctx.translate(
      Math.round(f.x + f.knock + (fr?.dx ?? 0) * f.face) - cx,
      Math.round(feet + (fr?.dy ?? 0)) - cy,
    );
    if (face < 0) ctx.scale(-1, 1);
    const foot = pose === 'down' ? art.downFoot : art.foot;
    const x = -foot.x;
    const y = -foot.y;
    ctx.drawImage(bufferCanvas(img), x, y);
    const special = f.frozen > 0 ? P.cyan : f.rage > 0 && Math.sin(this.t * 16) > 0 ? P.red : null;
    if (f.flash > 0 || special) {
      ctx.globalAlpha = f.flash > 0 ? 0.55 : 0.4;
      ctx.drawImage(tintOf(img, f.flash > 0 ? f.tint : special!), x, y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /**
   * Muerte del Rey Ahogado: se tambalea y la laguna se lo traga, inclinándose hacia atrás,
   * cada vez más deprisa, hasta que no queda más que el remolino.
   */
  private drawSinking(
    ctx: CanvasRenderingContext2D,
    f: Fighter,
    feet: number,
    cx: number,
    cy: number,
  ): void {
    const art = f.art!;
    const e = this.t - (f.downAt ?? this.t);
    const k = clamp01((e - TIP_SWAY) / (deathTime(f) - TIP_SWAY));
    if (k >= 1) return;
    const sway = e < TIP_SWAY ? Math.sin(e * 28) * 1.5 * (1 - e / TIP_SWAY) : Math.sin(e * 9);
    const depth = Math.pow(k, 1.6) * (art.foot.y + 4);
    const img = art.poses.up;
    const gx = Math.round(f.x + f.knock + sway * f.face) - cx;
    const gy = Math.round(feet) - cy;
    ctx.save();
    // Solo se ve lo que queda por encima del agua.
    ctx.beginPath();
    ctx.rect(gx - 80, gy - 120, 160, 120);
    ctx.clip();
    ctx.translate(gx, gy + Math.round(depth));
    if (f.face < 0) ctx.scale(-1, 1);
    ctx.rotate(-0.25 * k);
    ctx.drawImage(bufferCanvas(img), -art.foot.x, -art.foot.y);
    if (f.flash > 0) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(tintOf(img, f.tint), -art.foot.x, -art.foot.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Agua revuelta a su alrededor.
    ctx.fillStyle = P.sky;
    const w = 18 + Math.round(8 * Math.sin(e * 6));
    ctx.fillRect(gx - w, gy - 1, w * 2, 1);
    ctx.fillStyle = P.mist;
    for (let i = -w; i < w; i += 5)
      ctx.fillRect(gx + i + Math.round(Math.sin(e * 10 + i) * 2), gy - 2, 2, 1);
  }

  private weapon(
    ctx: CanvasRenderingContext2D,
    id: WeaponId,
    x: number,
    y: number,
    deg: number,
  ): void {
    const w = WEAPONS[id];
    const c = bufferCanvas(w.img);
    if (deg === 0) {
      ctx.drawImage(c, Math.round(x - w.px), Math.round(y - w.py));
      return;
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(c, -w.px, -w.py);
    ctx.restore();
  }

  /** Estela del golpe: un arco de píxeles claros por donde ha pasado el arma. */
  private trail(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    from: number,
    to: number,
    id: WeaponId,
  ): void {
    const len = Math.max(6, WEAPONS[id].py - 1);
    const span = to - from;
    const steps = Math.min(24, Math.max(2, Math.ceil(Math.abs(span) / 7)));
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const a = ((from + span * k) * Math.PI) / 180;
      for (const r of [len, len - 2]) {
        ctx.fillStyle = k > 0.75 ? P.white : k > 0.4 ? P.mist : P.fog;
        if (r !== len && k < 0.5) continue;
        ctx.fillRect(Math.round(hx + Math.sin(a) * r), Math.round(hy - Math.cos(a) * r), 1, 1);
      }
    }
  }

  private bubble(ctx: CanvasRenderingContext2D, x: number, y: number, left: number): void {
    if (left < 0.5 && Math.floor(this.t * 16) % 2) return;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + this.t * 1.5;
      ctx.fillStyle = i % 3 === 0 ? P.white : P.lemon;
      ctx.fillRect(Math.round(x + Math.cos(a) * 11), Math.round(y + Math.sin(a) * 14), 1, 1);
    }
  }

  /** Proyectiles y efectos: se pintan después de la noche para que brillen. */
  drawFx(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.done) return;
    const px = (x: number, y: number, c: string, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x) - cx, Math.round(y) - cy, w, h);
    };
    for (const s of this.shots) {
      const dir = Math.sign(s.vx) || 1;
      switch (s.kind) {
        case 'arrow':
        case 'firearrow': {
          const a = Math.atan2(s.vy, s.vx);
          for (let i = 0; i < 7; i++)
            px(
              s.x - Math.cos(a) * i,
              s.y - Math.sin(a) * i,
              i === 0 ? P.mist : i > 4 ? P.white : P.tan,
            );
          if (s.kind === 'firearrow') {
            px(s.x - 1, s.y - 1, P.orange, 2, 2);
            px(s.x, s.y - 1, P.lemon);
          }
          break;
        }
        case 'dagger': {
          const spin = Math.floor(s.t * 24) % 4;
          const d = [
            [1, 0],
            [1, 1],
            [0, 1],
            [-1, 1],
          ][spin]!;
          for (let i = -2; i <= 2; i++)
            px(s.x + d[0]! * i, s.y + d[1]! * i, i > 0 ? P.white : P.steel);
          break;
        }
        case 'fire':
          s.trail.forEach((p, i) => px(p.x - 1, p.y - 1, i > 3 ? P.orange : P.red, 2, 2));
          px(s.x - 2, s.y - 2, P.orange, 5, 5);
          px(s.x - 1, s.y - 1, P.lemon, 3, 3);
          px(s.x, s.y, P.white);
          break;
        case 'ice':
          s.trail.forEach((p, i) => i % 2 && px(p.x, p.y, P.sky));
          px(s.x - 2 * dir, s.y, P.cyan, 3, 1);
          px(s.x, s.y - 1, P.cyan, 1, 3);
          px(s.x + dir, s.y, P.white);
          break;
        case 'bottle':
          px(s.x - 1, s.y - 1, P.forest, 3, 3);
          px(s.x, s.y - 3, P.oak, 1, 2);
          px(s.x, s.y - 4 - (Math.floor(s.t * 20) % 2), P.orange);
          break;
      }
    }
    for (const e of this.effects) {
      const k = e.t / e.dur;
      const x = e.follow ? e.follow.x : e.x;
      const y = e.follow ? this.hooks.feetAt(e.follow.x) - (e.kind === 'stars' ? 27 : 0) : e.y;
      switch (e.kind) {
        case 'boom': {
          const r = e.r * easeOut(k);
          if (k < 0.3) px(x - r / 2, y - r / 2, P.lemon, Math.max(1, r), Math.max(1, r));
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2 + e.seed;
            const c = k < 0.35 ? P.white : k < 0.6 ? P.lemon : k < 0.8 ? P.orange : P.red;
            px(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, c);
          }
          break;
        }
        case 'bolt': {
          if (Math.floor(e.t * 30) % 3 === 2) break;
          let bx = x;
          const top = y - 96;
          for (let yy = top; yy < y; yy += 6) {
            const nx = x + Math.sin(e.seed + yy * 0.7) * 5 * (1 - (yy - top) / 96);
            const steps = 6;
            for (let j = 0; j < steps; j++) {
              const ix = lerp(bx, nx, j / steps);
              px(ix - 1, yy + j, P.sky);
              px(ix, yy + j, P.white);
              px(ix + 1, yy + j, P.cyan);
            }
            bx = nx;
          }
          for (let i = -6; i <= 6; i++) px(x + i, y - 1, Math.abs(i) < 3 ? P.white : P.cyan);
          break;
        }
        case 'pillar': {
          const w = Math.max(1, Math.round(8 * (1 - k)));
          for (let yy = y - 80; yy < y; yy += 1) {
            if ((yy + Math.floor(e.t * 40)) % 4 === 0) continue;
            px(x - w / 2, yy, k < 0.5 ? P.lemon : P.gold, w, 1);
          }
          px(x - Math.max(1, w / 4), y - 80, P.white, Math.max(1, w / 2), 80);
          for (let i = 0; i < 4; i++)
            px(
              x - 6 + ((i * 5 + Math.floor(e.t * 30)) % 12),
              y - 4 - ((e.t * 60 + i * 9) % 30),
              P.white,
            );
          break;
        }
        case 'halo': {
          const lift = -26 - k * 4;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            px(x + Math.cos(a) * 5, y + lift + Math.sin(a) * 1.5, i % 4 ? P.lemon : P.white);
          }
          for (let i = 0; i < 3; i++)
            px(
              x - 6 + i * 6,
              y - 6 - ((e.t * 30 + i * 7) % 20),
              Math.floor(e.t * 10 + i) % 2 ? P.white : P.lemon,
            );
          break;
        }
        case 'ring': {
          const r = e.r * easeOut(k);
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            if ((i + Math.floor(e.t * 20)) % 3 === 0) continue;
            px(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, k < 0.5 ? P.coral : e.color);
          }
          break;
        }
        case 'shards':
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + e.seed;
            const r = 3 + e.r * k;
            px(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 2 ? P.cyan : P.white);
            px(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2), P.sky);
          }
          break;
        case 'stars':
          for (let i = 0; i < 3; i++) {
            const a = e.t * 9 + (i * Math.PI * 2) / 3;
            const sx = x + Math.cos(a) * 5;
            const sy = y + Math.sin(a) * 1.5;
            px(sx, sy, P.lemon);
            px(sx - 1, sy, P.gold);
            px(sx + 1, sy, P.gold);
            px(sx, sy - 1, P.gold);
            px(sx, sy + 1, P.gold);
          }
          break;
        case 'shout':
          for (let ring = 0; ring < 3; ring++) {
            const r = 4 + ((k * 18 + ring * 6) % 18);
            for (let i = -4; i <= 4; i++) {
              const a = (i / 4) * 0.9;
              px(x + e.dir * Math.cos(a) * r, y + Math.sin(a) * r, ring === 0 ? P.white : P.sand);
            }
          }
          break;
        case 'flames':
        case 'frost': {
          const ice = e.kind === 'frost';
          for (let i = 0; i < 26; i++) {
            const d = ((i * 37 + Math.floor(e.t * 60)) % 100) / 100;
            const spread = d * 6;
            const fy = y + Math.sin(i * 12.9 + e.t * 30) * spread;
            const c = ice
              ? d < 0.3
                ? P.white
                : d < 0.7
                  ? P.cyan
                  : P.sky
              : d < 0.3
                ? P.lemon
                : d < 0.7
                  ? P.orange
                  : P.red;
            px(x + e.dir * d * e.r, fy, c);
            // La escarcha deja copos que caen un poco por detrás.
            if (ice && i % 4 === 0) px(x + e.dir * d * e.r * 0.8, fy + 2 + d * 3, P.mist);
          }
          break;
        }
        case 'slash':
          for (let i = -5; i <= 5; i++) {
            px(x + i, y + i * e.dir * 0.6, Math.abs(i) < 3 ? P.white : P.mist);
            if (k < 0.5) px(x + i, y - i * e.dir * 0.6, P.mist);
          }
          break;
      }
    }
  }
}
