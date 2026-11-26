/**
 * La gente del visor: el grupo andando por el camino (ocho tiempos; los heridos cojean y el grupo
 * va a su paso; de vuelta, hacia la izquierda) y las peleas en directo, por turnos: carga, golpe
 * con estocada, destello y retroceso del que lo recibe, cifras de daño que suben y, de vez en
 * cuando, uno que cae. Los muñecos son los de verdad (`heroSprites`, `fightSprites`, `foeArt`).
 */
import { expFoeArt } from '../../art/expFoes';
import { foeArt, type FoeArt, type FoePose } from '../../art/foes';
import type { Dress } from '../../data/custom';
import {
  FEET_Y,
  HAND,
  fightSprites,
  generateLook,
  heroSprites,
  type FightPose,
  type HeroLook,
  type HeroMarks,
} from '../../art/heroes/hero';
import { PixelBuffer, rgba } from '../../art/pixel';
import { Rng } from '../../core/rng';
import { WEAPONS, type WeaponId } from '../weapons';
import type { Ctx } from './ctx';
import { pack, tintColor, unpack } from './luz';
import type { MarchNow } from './marcha';
import { digits, put, putRot, tinted } from './pintar';
import { hash } from './tonos';

type Crew = MarchNow['crew'][number];

export interface Hero {
  crew: Crew;
  look: HeroLook;
  marks: HeroMarks;
  hurt: boolean;
}

const heroCache = new Map<string, Hero>();
export function heroOf(c: Crew, dress?: Dress): Hero {
  const hurt = c.fate === 'herido';
  const key = `${c.id}:${c.seed}:${c.cls}:${hurt}:${c.gear?.icon ?? ''}:${dress?.dye ?? ''}:${dress?.garment ?? ''}`;
  let h = heroCache.get(key);
  if (!h) {
    const base = generateLook(c.seed, c.cls, c.sex);
    // Lo de la sastrería, encima (como `lookOf` en la taberna).
    const look = dress?.dye || dress?.garment ? { ...base, ...dress } : base;
    h = {
      crew: c,
      look,
      marks: { eyepatch: c.eyepatch, scar: c.scar, gear: c.gear, injured: hurt },
      hurt,
    };
    heroCache.set(key, h);
  }
  return h;
}

const MAIN: Record<string, WeaponId> = {
  guerrero: 'espada',
  picaro: 'daga',
  mago: 'baston',
  clerigo: 'maza',
  explorador: 'arco',
};
/** Ángulo del arma en cada pose (grados, desde arriba y en el sentido del reloj). */
const SWING: Record<FightPose, number> = { ready: 25, windup: -50, strike: 80, up: 0, thrust: 90 };

/** Separación entre los del grupo. */
export const GAP = 13;
/** Lo que dura un turno de la pelea (s). */
const TURN = 0.95;

interface Pop {
  text: string;
  x: number;
  y: number;
  /** 0–1: lo que lleva subido. */
  u: number;
  color: string;
}

/** La sombra a los pies (oscurece el suelo, tramada en los bordes). */
export function shadow(b: PixelBuffer, x: number, y: number, w: number): void {
  for (let dx = -w; dx <= w; dx++) {
    const edge = Math.abs(dx) > w - 2;
    for (let dy = 0; dy < 2; dy++) {
      if ((edge || dy === 1) && (x + dx + dy) % 2) continue;
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      if (!b.inside(X, Y)) continue;
      const [r, g, bl] = unpack(b.data[Y * b.w + X]!);
      b.data[Y * b.w + X] = pack([r * 0.62, g * 0.62, bl * 0.7]);
    }
  }
}

export class Gente {
  private fightFrom = -1;
  private pops: Pop[] = [];
  private sparks: { x: number; y: number; big: boolean }[] = [];

  draw(c: Ctx): void {
    this.pops = [];
    this.sparks = [];
    if (c.m.mode === 'fight') {
      if (this.fightFrom < 0) this.fightFrom = c.time;
      this.fight(c, c.time - this.fightFrom);
    } else {
      this.fightFrom = -1;
      this.walk(c);
    }
  }

  /** Andando por el camino. */
  private walk(c: Ctx): void {
    const { b, e, m, l, lk, time } = c;
    const crew = m.crew.map((c) => heroOf(c, m.dress?.[c.id]));
    const n = crew.length;
    const dir = m.home ? -1 : 1;
    const lead = Math.round(e.w / 2 + (dir * (n - 1) * GAP) / 2);
    const lame = crew.some((h) => h.hurt);
    // Pasos por segundo: el grupo va al paso del herido.
    const rate = c.walking ? (lame ? 6 : 8) : 0;
    // De atrás adelante (el de delante tapa al de detrás).
    for (let i = n - 1; i >= 0; i--) {
      const h = crew[i]!;
      const spr = heroSprites(h.look, h.marks);
      const x = lead - dir * i * GAP;
      let f: number;
      let dip = 0;
      if (!c.walking) f = 0;
      else if (h.hurt) {
        // Cojea: la pierna mala apoya poco (pasa deprisa por esos tiempos) y el cuerpo se hunde.
        const ph = (((time * rate + i * 3) % 8) + 8) % 8;
        const warp = ph < 5 ? ph * 0.8 : 4 + (ph - 5) * (4 / 3);
        f = Math.floor(warp) % 8;
        dip = f === 4 || f === 5 ? 1 : 0;
      } else f = ((Math.floor(time * rate + i * 3) % 8) + 8) % 8;
      shadow(b, x, e.feet, 5);
      const img = c.walking ? spr.walk[f]! : spr.idle[Math.abs(Math.floor(time * 2 + i)) % 2]!;
      put(b, tinted(img, l, lk), x, e.feet + dip, 9, FEET_Y, dir < 0);
    }
  }

  /** Los enemigos de esta pelea (de dos a tres; uno, si es grande; tres, si son alimañas). */
  private foes(m: MarchNow): FoeArt[] {
    if (m.rival) {
      const { art, count } = expFoeArt(m.rival.heading, m.rival.idx);
      return Array.from({ length: count }, () => art);
    }
    const rng = new Rng(`visor-foes-${m.seed}-${m.foe}`);
    const n = m.foe === 'grande' ? 1 : m.foe === 'alimana' ? 3 : rng.int(2, 3);
    return Array.from({ length: n }, (_, i) => foeArt(m.foe, `${m.seed}-${i}`));
  }

  /** La pelea, por turnos: el grupo y los enemigos se van dando. */
  private fight(c: Ctx, t: number): void {
    const { b, e, m, l, lk } = c;
    const crew = m.crew.map((c) => heroOf(c, m.dress?.[c.id]));
    const foes = this.foes(m);
    const n = crew.length;
    const dir = m.home ? -1 : 1;
    const k = Math.floor(t / TURN);
    const p = (t % TURN) / TURN;
    // Cuándo cae cada uno (el último aguanta: la pelea acaba en el diario, no aquí).
    const kills = foes.slice(0, -1).map((_, j) => (foes.length > 2 ? 4 + j * 4 : 6 + j * 6));
    const downAt = (j: number) => kills[j] ?? Infinity;
    const isDown = (j: number) => k > downAt(j) || (k === downAt(j) && p > 0.55);
    const heroTurn = k % 2 === 0;
    const alive = foes.map((_, j) => j).filter((j) => !isDown(j) || (k === downAt(j) && p <= 0.55));
    const front = alive[0] ?? 0;
    const atkHero = heroTurn ? (k >> 1) % n : -1;
    const atkFoe = !heroTurn && alive.length ? alive[(k >> 1) % alive.length]! : -1;
    const tgtHero = !heroTurn ? Math.floor(hash(k * 7 + 3) * Math.min(n, 2)) : -1;
    const hit = p > 0.32 && p < 0.62;
    const flash = p > 0.32 && p < 0.44 && Math.floor(t * 20) % 2 === 0;
    const white = rgba('#ffffff');
    // Posiciones: el grupo a un lado, los enemigos al otro, de cara.
    const lead = Math.round(e.w / 2 - dir * 8);
    const heroX = (i: number) => lead - dir * i * (GAP + 2);
    const foeXs: number[] = [];
    let fx = lead + dir * Math.max(27, 10 + Math.ceil((foes[0]?.span ?? 0) / 2));
    for (const f of foes) {
      if (f.big) fx += dir * 10;
      foeXs.push(fx);
      fx += dir * (f.span + 3);
    }
    const lunge = (who: boolean) => (who && p > 0.3 && p < 0.58 ? 3 : 0);
    // Los enemigos (los caídos, debajo).
    for (let j = foes.length - 1; j >= 0; j--) {
      const f = foes[j]!;
      const down = isDown(j);
      const struck = heroTurn && j === front && hit;
      let pose: FoePose;
      if (down) pose = 'down';
      else if (struck) pose = 'hurt';
      else if (j === atkFoe) pose = p < 0.3 ? 'windup' : p < 0.58 ? 'strike' : 'idle';
      else pose = Math.floor(t * 2 + j) % 2 ? 'idle2' : 'idle';
      const img = tinted(f.poses[pose], l, lk);
      const back = struck ? dir * Math.round(2 + (p < 0.45 ? 1 : 0)) : 0;
      const x = foeXs[j]! + back - dir * lunge(j === atkFoe);
      if (!down) shadow(b, x, e.feet, f.big ? 10 : 6);
      const fy = img.h - 1;
      put(
        b,
        img,
        x,
        e.feet + (down ? 1 : 0),
        f.foot,
        fy,
        dir > 0,
        struck && flash ? white : undefined,
      );
      if (f.hand && !down) {
        const fp: FightPose =
          pose === 'windup'
            ? 'windup'
            : pose === 'strike'
              ? 'strike'
              : pose === 'hurt'
                ? 'up'
                : 'ready';
        const wp = WEAPONS[f.hand.weapon];
        const hd = HAND[fp];
        putRot(
          b,
          wp.img,
          x - dir * (hd.x - 9),
          e.feet - FEET_Y + hd.y,
          wp.px,
          wp.py,
          f.hand.weapon === 'arco' ? 0 : SWING[fp],
          dir > 0,
          (col) => tintColor(col, l),
        );
      }
      if (struck && p < 0.5)
        this.sparks.push({ x: x - dir * 4, y: e.feet - f.chest, big: p < 0.4 });
      if (heroTurn && j === front && p > 0.32 && (!down || k === downAt(j))) {
        const crit = hash(k * 13) > 0.82;
        const dmg = Math.round(2 + hash(k * 5 + 1) * 8) * (crit ? 2 : 1);
        this.pops.push({
          text: String(dmg),
          x: foeXs[j]!,
          y: e.feet - f.poses.idle.h - 3,
          u: (p - 0.32) / 0.68,
          color: crit ? '#fee761' : '#ffffff',
        });
      }
    }
    // El grupo, de atrás adelante.
    for (let i = n - 1; i >= 0; i--) {
      const h = crew[i]!;
      const me = i === atkHero;
      const pose: FightPose = me ? (p < 0.3 ? 'windup' : p < 0.58 ? 'strike' : 'ready') : 'ready';
      const struck = i === tgtHero && hit;
      const x = heroX(i) + dir * lunge(me) - (struck ? dir * 2 : 0);
      shadow(b, x, e.feet, 5);
      const poses = fightSprites(h.look, h.marks);
      put(
        b,
        tinted(poses[pose], l, lk),
        x,
        e.feet,
        9,
        FEET_Y,
        dir < 0,
        struck && flash ? white : undefined,
      );
      const wid = MAIN[h.crew.cls] ?? 'espada';
      const wp = WEAPONS[wid];
      const hd = HAND[pose];
      putRot(
        b,
        wp.img,
        x + dir * (hd.x - 9),
        e.feet - FEET_Y + hd.y,
        wp.px,
        wp.py,
        wid === 'arco' ? 0 : SWING[pose],
        dir < 0,
        (col) => tintColor(col, l),
      );
      if (struck && p >= 0.32) {
        if (p < 0.42) this.sparks.push({ x: x + dir * 4, y: e.feet - 14, big: p < 0.37 });
        const dmg = Math.round(1 + hash(k * 3 + 2) * 5);
        this.pops.push({
          text: String(dmg),
          x,
          y: e.feet - 30,
          u: (p - 0.32) / 0.68,
          color: '#f6757a',
        });
      }
    }
  }

  /** Lo que va por encima de todo (y de la luz): destellos y cifras. */
  overlay(c: Ctx): void {
    const { b } = c;
    for (const s of this.sparks) {
      const r = s.big ? 3 : 2;
      const lemon = rgba('#fee761');
      const white = rgba('#ffffff');
      for (let d = -r; d <= r; d++) {
        b.set(s.x + d, s.y, Math.abs(d) < 2 ? white : lemon);
        b.set(s.x, s.y + d, Math.abs(d) < 2 ? white : lemon);
      }
      if (s.big) {
        b.set(s.x - 2, s.y - 2, lemon);
        b.set(s.x + 2, s.y + 2, lemon);
        b.set(s.x + 2, s.y - 2, lemon);
        b.set(s.x - 2, s.y + 2, lemon);
      }
    }
    // Cifras: suben deprisa al principio y se frenan; al final, parpadean y se van.
    const seen = new Set<string>();
    for (const p of this.pops) {
      const key = `${p.x}:${p.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (p.u > 0.9 && Math.floor(p.u * 30) % 2) continue;
      const rise = Math.round(10 * (1 - (1 - Math.min(1, p.u)) ** 2));
      digits(b, p.text, p.x, p.y - rise, p.color, '#181425');
    }
  }
}
