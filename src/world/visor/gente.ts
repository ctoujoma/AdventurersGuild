/**
 * La gente del visor: el grupo andando por el camino (ocho tiempos; los heridos cojean y el grupo
 * va a su paso; de vuelta, hacia la izquierda) y las peleas en directo, por turnos: carga, golpe
 * con estocada, destello y retroceso del que lo recibe, cifras de daño que suben y, de vez en
 * cuando, uno que cae. Los muñecos son los de verdad (`heroSprites`, `fightSprites`, `foeArt`).
 */
import { deathOf, expFoeArt, expGuardianArt } from '../../art/expFoes';
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
import { PixelBuffer, alpha, rgba } from '../../art/pixel';
import { Rng } from '../../core/rng';
import { WEAPONS, type WeaponId } from '../weapons';
import type { Ctx } from './ctx';
import { pack, tintColor, unpack } from './luz';
import { BLOOD, drawFxGlow, drawFxScene, furOf, type Fx } from './vfx';
import type { MarchNow } from './marcha';
import { digits, put, putRot, tinted } from './pintar';
import { hash } from './tonos';
import { drawEscondidos, hiding } from './sucesos';

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
/** Ganada la pelea: los que quedaban en pie caen y el grupo lo celebra (s); luego siguen. */
const AFTER = 3.6;

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
  /** Al ganar, los que quedaban en pie caen (cuándo acabó y cuánto duró la pelea). */
  private after?: { from: number; t: number; travel: number };
  /** Los enemigos de la última pelea y dónde estaban (los caídos se quedan en el camino). */
  private last?: { foes: FoeArt[]; xs: number[]; ys: number[] };
  private pops: Pop[] = [];
  private sparks: { x: number; y: number; big: boolean }[] = [];
  /** Los efectos de este fotograma (`vfx.ts`) y el temblor de los grandes (px, arriba o abajo). */
  private fx: Fx[] = [];
  shake = 0;

  /** Parados celebrando (el paisaje no avanza aunque ya anden). */
  holds(m: MarchNow, time: number): boolean {
    if (m.mode !== 'walk') return false;
    if (this.fightFrom >= 0) return !!m.won;
    return !!this.after && time - this.after.from < AFTER;
  }

  draw(c: Ctx): void {
    this.pops = [];
    this.sparks = [];
    this.fx = [];
    this.shake = 0;
    if (c.m.mode === 'fight') {
      if (this.fightFrom < 0) this.fightFrom = c.time;
      this.after = undefined;
      this.fight(c, c.time - this.fightFrom);
    } else {
      if (this.fightFrom >= 0 && c.m.won && c.m.mode === 'walk')
        this.after = { from: c.time, t: c.time - this.fightFrom, travel: c.travel };
      this.fightFrom = -1;
      const end = this.after ? (c.time - this.after.from) / AFTER : 1;
      if (this.after && end >= 0 && end < 1) {
        this.fight(c, this.after.t, end);
        return;
      }
      // Luego siguen andando y los caídos se quedan en el camino hasta salir de la vista.
      if (!this.after || !this.corpses(c)) this.after = undefined;
      if (hiding(c)) drawEscondidos(c);
      else this.walk(c);
    }
  }

  /** Los caídos de la pelea ganada, quietos en el suelo mientras el camino pasa (false: ya no se ven). */
  private corpses(c: Ctx): boolean {
    const { b, e, l, lk } = c;
    if (!this.last || !this.after) return false;
    const dir = c.m.home ? -1 : 1;
    const shift = c.travel - this.after.travel;
    let seen = false;
    this.last.foes.forEach((f, j) => {
      const x = Math.round(this.last!.xs[j]! - shift);
      if (x < -f.span || x > e.w + f.span) return;
      const img = foeFrame(f, 'down', 1, c.time);
      if (img.isEmpty()) return;
      seen = true;
      put(b, tinted(img, l, lk), x, e.feet + 1 + this.last!.ys[j]!, f.foot, img.h - 1, dir > 0);
    });
    return seen;
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
    return foesOf(m);
  }

  /** La pelea, por turnos: el grupo y los enemigos se van dando. */
  private fight(c: Ctx, t: number, end?: number): void {
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
    const fell = (j: number) => k > downAt(j) || (k === downAt(j) && p > 0.55);
    // Ganada la pelea (`end`, 0–1), caen todos: los que seguían en pie, ahora.
    const isDown = (j: number) => end !== undefined || fell(j);
    const heroTurn = end === undefined && k % 2 === 0;
    const alive = foes.map((_, j) => j).filter((j) => !isDown(j) || (k === downAt(j) && p <= 0.55));
    const front = alive[0] ?? 0;
    const atkHero = heroTurn ? (k >> 1) % n : -1;
    const atkFoe =
      end === undefined && !heroTurn && alive.length ? alive[(k >> 1) % alive.length]! : -1;
    const tgtHero = !heroTurn ? Math.floor(hash(k * 7 + 3) * Math.min(n, 2)) : -1;
    const hit = end === undefined && p > 0.32 && p < 0.62;
    const flash = p > 0.32 && p < 0.44 && Math.floor(t * 20) % 2 === 0;
    const white = rgba('#ffffff');
    // Posiciones: el grupo a un lado, los enemigos al otro, de cara.
    const lead = Math.round(e.w / 2 - dir * 8);
    const heroX = (i: number) => lead - dir * i * (GAP + 2);
    const foeXs: number[] = [];
    let fx = lead + dir * Math.max(27, 10 + Math.ceil((foes[0]?.span ?? 0) / 2));
    // Una manada (varios pequeños) va en corrillo, no en fila: más juntos y a distintas
    // profundidades (unos más atrás, otros más adelante).
    const pack = foes.length > 1 && !foes.some((f) => f.big);
    const DEPTH = [0, -4, 3];
    const depth = (j: number) => (pack ? DEPTH[j % 3]! : 0);
    for (const f of foes) {
      // Los grandes, un poco más allá (el dragón ya ocupa media pantalla: no, que se cortaría).
      if (f.big && f.span < 50) fx += dir * 10;
      foeXs.push(fx);
      fx += dir * (pack ? Math.round(f.span * 0.5) : f.span + 3);
    }
    // De atrás adelante (y los caídos, debajo).
    const order = foes
      .map((_, j) => j)
      .sort((a, b) => depth(a) - depth(b) || Number(isDown(b)) - Number(isDown(a)) || b - a);
    this.last = { foes, xs: foeXs, ys: foes.map((_, j) => depth(j)) };
    const lunge = (who: boolean) => (who && p > 0.3 && p < 0.58 ? 3 : 0);
    // Los enemigos (los caídos, debajo).
    for (const j of order) {
      const f = foes[j]!;
      const feet = e.feet + depth(j);
      const down = isDown(j);
      const struck = heroTurn && j === front && hit;
      let pose: FoePose;
      if (down) pose = 'down';
      else if (struck) pose = 'hurt';
      else if (j === atkFoe) pose = p < 0.3 ? 'windup' : p < 0.58 ? 'strike' : 'idle';
      else pose = Math.floor(t * 2 + j) % 2 ? 'idle2' : 'idle';
      // Un respiro en el impacto (el golpe pesa): la carrera de la pose se para un instante.
      const ph = p > 0.32 && p < 0.37 ? 0.32 : p > 0.37 ? p - 0.05 * (1 - (p - 0.37) / 0.63) : p;
      const u =
        pose === 'down'
          ? end !== undefined && !fell(j)
            ? end / 0.6
            : k === downAt(j)
              ? (p - 0.55) / 0.4
              : 1
          : pose === 'windup'
            ? p / 0.3
            : pose === 'strike'
              ? (ph - 0.3) / 0.28
              : (ph - 0.32) / 0.3;
      const img = tinted(foeFrame(f, pose, u, t + j * 0.7), l, lk);
      const back = struck ? dir * Math.round(2 + (p < 0.45 ? 1 : 0)) : 0;
      // Los que traen su golpe dibujado (`seq.strike`) ya se echan adelante: sin embestida.
      // El jabalí se lanza de verdad unos píxeles al embestir (y vuelve despacio).
      const dash =
        j === atkFoe && f.what === 'jabali'
          ? Math.round(
              8 *
                (p < 0.24
                  ? 0
                  : p < 0.34
                    ? (p - 0.24) / 0.1
                    : p < 0.5
                      ? 1
                      : Math.max(0, 1 - (p - 0.5) / 0.3)),
            )
          : 0;
      const x = foeXs[j]! + back - dir * (f.seq?.strike ? dash : lunge(j === atkFoe));
      if (!down) shadow(b, x, feet, f.big ? 10 : 6);
      const fy = img.h - 1;
      put(
        b,
        img,
        x,
        feet + (down ? 1 : 0),
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
          feet - FEET_Y + hd.y,
          wp.px,
          wp.py,
          f.hand.weapon === 'arco' ? 0 : SWING[fp],
          dir > 0,
          (col) => tintColor(col, l),
        );
      }
      if (struck) {
        const fx = this.fx;
        fx.push({
          k: 'impact',
          x: x - dir * 4,
          y: feet - f.chest,
          a: (p - 0.32) / 0.16,
          big: f.big,
          magia: atkHero >= 0 && MAIN[crew[atkHero]!.crew.cls] === 'baston',
        });
        fx.push({
          k: 'bits',
          x: x - dir * 3,
          y: feet - f.chest,
          floor: feet + 1,
          dir,
          a: (p - 0.32) / 0.62,
          seed: k * 7 + j,
          cols: [...BLOOD, ...furOf(f.poses.idle)],
          n: f.big ? 11 : 7,
        });
      }
      // El jabalí embiste: estelas de velocidad tras la grupa y polvo de las pezuñas.
      if (j === atkFoe && f.what === 'jabali' && p > 0.22 && p < 0.66) {
        const img0 = f.poses.idle;
        // La grupa de verdad en el dibujo de ahora: lo de más atrás del cuerpo, fila a fila en la
        // mitad de abajo, quedándose con la mediana (la cola, levantada y fina, no cuenta).
        const cols: number[] = [];
        for (let y = Math.round(img.h * 0.4); y < Math.round(img.h * 0.8); y++) {
          let c0 = 0;
          while (c0 < img.w && !alpha(img.get(c0, y))) c0++;
          if (c0 < img.w) cols.push(c0);
        }
        cols.sort((p0, p1) => p0 - p1);
        const col = cols[Math.floor(cols.length / 2)] ?? 0;
        this.fx.push({
          k: 'rush',
          x: x + dir * (f.foot - col),
          top: feet - img0.h + 4,
          bottom: feet - 3,
          back: dir,
          a: (p - 0.22) / 0.44,
          seed: k,
        });
        this.fx.push({ k: 'dust', x: x + dir * 6, y: feet, a: (p - 0.26) / 0.4, w: 7 });
      }
      // El golpe de un grande: tiembla todo y levanta polvo delante.
      if (j === atkFoe && f.big && p > 0.32 && p < 0.7) {
        if (p < 0.42) this.shake = Math.floor(t * 40) % 2 ? 1 : -1;
        this.fx.push({
          k: 'dust',
          x: x - dir * Math.round(f.span * 0.45),
          y: feet,
          a: (p - 0.32) / 0.38,
          w: 12,
        });
      }
      // Cae: polvo donde da el cuerpo (y, si es grande, un golpe sordo).
      const fallU =
        end !== undefined && !fell(j) ? (end - 0.18) / 0.3 : k === downAt(j) ? (p - 0.7) / 0.3 : -1;
      if (fallU >= 0 && fallU < 1) {
        this.fx.push({ k: 'dust', x, y: feet, a: fallU, w: Math.max(8, f.span * 0.4) });
        if (f.big && fallU < 0.12) this.shake = Math.floor(c.time * 40) % 2 ? 1 : -1;
      }
      if (heroTurn && j === front && p > 0.32 && (!down || k === downAt(j))) {
        const crit = hash(k * 13) > 0.82;
        const dmg = Math.round(2 + hash(k * 5 + 1) * 8) * (crit ? 2 : 1);
        this.pops.push({
          text: String(dmg),
          x: foeXs[j]!,
          y: feet - f.poses.idle.h - 3,
          u: (p - 0.32) / 0.68,
          color: crit ? '#fee761' : '#ffffff',
        });
      }
    }
    // El grupo, de atrás adelante.
    for (let i = n - 1; i >= 0; i--) {
      const h = crew[i]!;
      // Ganada: de frente con los brazos en alto, cada uno a su ritmo, dando saltitos.
      if (end !== undefined && end > 0.12 + i * 0.06) {
        const x = heroX(i);
        const hop = Math.round(Math.abs(Math.sin(c.time * 7 + i * 1.9)) * 3);
        shadow(b, x, e.feet, hop > 1 ? 4 : 5);
        put(b, tinted(heroSprites(h.look, h.marks).cheer, l, lk), x, e.feet - hop, 9, FEET_Y);
        continue;
      }
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
      // Lo que lleva su golpe hasta el enemigo: la flecha y el orbe vuelan; el resto, un tajo.
      if (me && alive.length) {
        const tf = foes[front]!;
        const fxX = foeXs[front]!;
        const near = fxX - dir * Math.round(tf.span / 2);
        const y = e.feet - Math.min(14, tf.chest + 2);
        if (wid === 'baston')
          this.fx.push({ k: 'charge', x: x - dir * 7, y: e.feet - 15, a: (p - 0.04) / 0.2 });
        if (wid === 'arco' || wid === 'baston')
          this.fx.push({
            k: 'bolt',
            what: wid === 'arco' ? 'flecha' : 'orbe',
            x0: x + dir * 7,
            x1: near + dir * 2,
            y,
            a: (p - (wid === 'arco' ? 0.18 : 0.22)) / (wid === 'arco' ? 0.14 : 0.1),
          });
        else
          this.fx.push({
            k: 'slash',
            x: near - dir * 7,
            y: e.feet - tf.chest,
            dir,
            a: (p - 0.27) / 0.13,
            big: wid === 'maza',
          });
      }
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
        // Las bestias arañan (el jabalí embiste: choque fuerte y tiembla); el resto, un golpe.
        const by = foes[atkFoe];
        const ram = by?.what === 'jabali';
        if (ram && p < 0.4) this.shake = Math.floor(t * 40) % 2 ? 1 : -1;
        if (by && !ram && (by.kind === 'bestia' || by.kind === 'alimana') && !by.big)
          this.fx.push({ k: 'claw', x: x + dir * 2, y: e.feet - 14, dir, a: (p - 0.32) / 0.4 });
        else
          this.fx.push({
            k: 'impact',
            x: x + dir * 4,
            y: e.feet - 14,
            a: (p - 0.32) / (ram ? 0.18 : 0.14),
            big: ram,
          });
        this.fx.push({
          k: 'dust',
          x: x - dir * 2,
          y: e.feet,
          a: (p - 0.32) / 0.4,
          w: ram ? 9 : 5,
        });
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
    drawFxScene(b, this.fx, l);
  }

  /** Lo que va por encima de todo (y de la luz): destellos y cifras. */
  overlay(c: Ctx): void {
    const { b } = c;
    drawFxGlow(b, this.fx, c.l);
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

/**
 * El fotograma de un enemigo en su pose: con `seq`, quieto va pasando los suyos (respira) y la
 * carga, el golpe, el daño y la caída avanzan con `u` (0–1, lo que lleva de la pose).
 */
export function foeFrame(f: FoeArt, pose: FoePose, u: number, t: number): PixelBuffer {
  const k = pose === 'idle2' ? 'idle' : pose;
  const s = k === 'walk1' || k === 'walk2' ? undefined : f.seq?.[k];
  if (!s?.length) return f.poses[pose];
  if (k === 'idle') return s[Math.floor(t * 5) % s.length]!;
  return s[Math.max(0, Math.min(s.length - 1, Math.floor(u * s.length)))]!;
}

/** Un número de una cadena (para la semilla de la pelea). */
function seedNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h;
}

/** Los enemigos de una pelea del visor (siempre los mismos para la misma pelea). */
function foesOf(m: MarchNow): FoeArt[] {
  if (m.rival?.guardian) return [expGuardianArt(m.rival.heading, m.rival.idx)];
  if (m.rival) {
    const { art, count } = expFoeArt(m.rival.heading, m.rival.idx);
    // Con varias muertes dibujadas, cada uno la suya (siempre la misma en la misma pelea).
    return Array.from({ length: count }, (_, j) =>
      deathOf(art, Math.floor(hash(seedNum(`${m.seed}:${m.day ?? 0}:${m.hour}`) + j * 17) * 97)),
    );
  }
  const rng = new Rng(`visor-foes-${m.seed}-${m.foe}`);
  const n = m.foe === 'grande' ? 1 : m.foe === 'alimana' ? 3 : rng.int(2, 3);
  return Array.from({ length: n }, (_, i) => foeArt(m.foe, `${m.seed}-${i}`));
}

/**
 * Lo que tarda la pelea del visor en tumbar a los que caen por turnos (el último aguanta hasta
 * que se gana), más un par de turnos: para la repetición de «Ver la pelea» (s).
 */
export function fightSpan(m: MarchNow): number {
  const n = foesOf(m).length;
  const last = n > 2 ? 4 + (n - 2) * 4 : n === 2 ? 6 : 2;
  return (last + 2) * TURN;
}

/** Lo que dura, al ganar, la caída de los que quedan y la celebración (s). */
export const WIN_AFTER = AFTER;
