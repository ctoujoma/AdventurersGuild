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
import { scriptOf, stubScript, type Act, type Script, type Track } from './replay';

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
/** En directo, lo más que dura la pelea en el visor (s): si la de verdad duró más, va más deprisa. */
const LIVE = 12;
/** En qué punto del gesto entra el golpe (0–1). */
const IMPACT = 0.32;

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

  /** El guion de la pelea de ahora: la de verdad si viene (`m.sim`); si no, uno de relleno. */
  private scriptOf(m: MarchNow, heroes: number, n: number): Script {
    if (m.sim)
      return scriptOf(
        m.sim,
        m.crew.map((h) => h.id),
        n,
      );
    return stubScript(heroes, n, m.won !== false, TURN);
  }

  /**
   * La pelea, tal cual fue (`replay.ts`): cada uno pega cuando pegó, a quien pegó y lo que quitó;
   * cae quien cayó y cuando cayó. `t`: segundos desde que empezó; `end` (0–1): ganada, el grupo
   * lo celebra.
   */
  private fight(c: Ctx, t: number, end?: number): void {
    const { b, e, m, l, lk } = c;
    const crew = m.crew.map((c) => heroOf(c, m.dress?.[c.id]));
    const foes = this.foes(m);
    const n = crew.length;
    const dir = m.home ? -1 : 1;
    const sc = this.scriptOf(m, n, foes.length);
    // En directo, la pelea cabe en su hora del camino (más deprisa si hace falta); al repetirla,
    // a su paso (`pace` 1; el botón de acelerar adelanta el reloj).
    const pace = m.pace ?? Math.max(1, sc.T / LIVE);
    const ct = end !== undefined ? sc.T + 99 : t * pace;
    // Lo que dura cada gesto en segundos de la pelea; la fase del gesto que empezó en `at` (el
    // golpe entra en 0,32, como en el resto de peleas).
    const span = TURN * pace;
    const phase = (at: number) => (ct - at) / span + IMPACT;
    /** El gesto de ahora de uno (o nada): el último que ha empezado y no ha acabado. */
    const actOf = (tr: Track): { a: Act; p: number } | null => {
      for (let i = tr.acts.length - 1; i >= 0; i--) {
        const p = phase(tr.acts[i]!.at);
        if (p >= 1) return null;
        if (p >= 0) return { a: tr.acts[i]!, p };
      }
      return null;
    };
    /** Lo que ha recibido hace poco (para la cifra que sube y el retroceso). */
    const takenOf = (tr: Track) =>
      tr.taken.map((x) => ({ x, p: phase(x.at) })).filter(({ p }) => p >= IMPACT && p < 1);
    const fallP = (tr: Track) => (tr.downAt === Infinity ? -1 : phase(tr.downAt));
    // Cae del todo un poco después del golpe que le tumba (el golpe se ve primero).
    const isDown = (j: number) => fallP(sc.foes[j]!) > 0.55;
    const heroDown = (i: number) => fallP(sc.heroes[i]!) > 0.55;
    const flash = Math.floor(t * 20) % 2 === 0;
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
    const lunge = (p: number) => (p > 0.3 && p < 0.58 ? 3 : 0);
    const heroActs = sc.heroes.map(actOf);
    // Los enemigos (los caídos, debajo).
    for (const j of order) {
      const f = foes[j]!;
      const tr = sc.foes[j]!;
      const feet = e.feet + depth(j);
      const down = isDown(j);
      const act = down ? null : actOf(tr);
      const p = act?.p ?? 0;
      const taken = takenOf(tr).filter(({ x }) => !x.heal);
      const hitNow = taken.find(({ p: q }) => q < 0.62);
      const struck = !!hitNow && end === undefined;
      const hp = hitNow?.p ?? 0;
      let pose: FoePose;
      if (down) pose = 'down';
      else if (struck) pose = 'hurt';
      else if (act) pose = p < 0.3 ? 'windup' : p < 0.58 ? 'strike' : 'idle';
      else pose = Math.floor(t * 2 + j) % 2 ? 'idle2' : 'idle';
      // Un respiro en el impacto (el golpe pesa): la carrera de la pose se para un instante.
      const ph = p > 0.32 && p < 0.37 ? 0.32 : p > 0.37 ? p - 0.05 * (1 - (p - 0.37) / 0.63) : p;
      const u =
        pose === 'down'
          ? (fallP(tr) - 0.55) / 0.4
          : pose === 'windup'
            ? p / 0.3
            : pose === 'strike'
              ? (ph - 0.3) / 0.28
              : (hp - 0.32) / 0.3;
      const img = tinted(foeFrame(f, pose, u, t + j * 0.7), l, lk);
      const back = struck ? dir * Math.round(2 + (hp < 0.45 ? 1 : 0)) : 0;
      // Los que traen su golpe dibujado (`seq.strike`) ya se echan adelante: sin embestida.
      // El jabalí se lanza de verdad unos píxeles al embestir (y vuelve despacio).
      const rams = !!act && RAMS.has(f.what);
      const dash = rams
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
      const x = foeXs[j]! + back - dir * (f.seq?.strike ? dash : act ? lunge(p) : 0);
      if (!down) shadow(b, x, feet, f.big ? 10 : 6);
      const fy = img.h - 1;
      const hitFlash = struck && hp < 0.44 && flash;
      put(b, img, x, feet + (down ? 1 : 0), f.foot, fy, dir > 0, hitFlash ? white : undefined);
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
        const by = crew[hitNow!.x.from];
        this.fx.push({
          k: 'impact',
          x: x - dir * 4,
          y: feet - f.chest,
          a: (hp - 0.32) / 0.16,
          big: f.big || hitNow!.x.crit,
          magia: !!by && MAIN[by.crew.cls] === 'baston',
        });
        this.fx.push({
          k: 'bits',
          x: x - dir * 3,
          y: feet - f.chest,
          floor: feet + 1,
          dir,
          a: (hp - 0.32) / 0.62,
          seed: Math.round(hitNow!.x.at * 10) * 7 + j,
          cols: [...BLOOD, ...furOf(f.poses.idle)],
          n: f.big ? 11 : 7,
        });
      }
      // El jabalí embiste: estelas de velocidad tras la grupa y polvo de las pezuñas.
      if (rams && p > 0.22 && p < 0.66) {
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
          seed: Math.round(act!.a.at * 10),
        });
        this.fx.push({ k: 'dust', x: x + dir * 6, y: feet, a: (p - 0.26) / 0.4, w: 7 });
      }
      // El golpe de un grande (y el golpe fuerte de cualquiera): tiembla todo y levanta polvo.
      if (act && (f.big || act.a.kind === 'fuerte') && p > 0.32 && p < 0.7) {
        if (p < 0.42) this.shake = Math.floor(t * 40) % 2 ? 1 : -1;
        this.fx.push({
          k: 'dust',
          x: x - dir * Math.round(f.span * 0.45),
          y: feet,
          a: (p - 0.32) / 0.38,
          w: act.a.kind === 'fuerte' ? 18 : 12,
        });
      }
      // Cae: polvo donde da el cuerpo (y, si es grande, un golpe sordo).
      const fallU = (fallP(tr) - 0.7) / 0.3;
      if (fallU >= 0 && fallU < 1) {
        this.fx.push({ k: 'dust', x, y: feet, a: fallU, w: Math.max(8, f.span * 0.4) });
        if (f.big && fallU < 0.12) this.shake = Math.floor(c.time * 40) % 2 ? 1 : -1;
      }
      // Lo que le quitan, de verdad (los críticos, en amarillo).
      if (end === undefined)
        taken.forEach(({ x: hit, p: q }, k) => {
          if (!hit.amount) return;
          this.pops.push({
            text: String(hit.amount),
            x: foeXs[j]!,
            y: feet - f.poses.idle.h - 3 - k * 7,
            u: (q - 0.32) / 0.68,
            color: hit.crit ? '#fee761' : '#ffffff',
          });
        });
    }
    // El grupo, de atrás adelante.
    for (let i = n - 1; i >= 0; i--) {
      const h = crew[i]!;
      const tr = sc.heroes[i];
      const x0 = heroX(i);
      // Caído en la pelea: tumbado en el suelo, de espaldas a los enemigos.
      if (tr && heroDown(i)) {
        const img = tinted(fightSprites(h.look, h.marks).ready, l, lk);
        putRot(b, img, x0, e.feet - 4, 9, FEET_Y - 9, dir > 0 ? -90 : 90, dir < 0);
        continue;
      }
      // Ganada: de frente con los brazos en alto, cada uno a su ritmo, dando saltitos.
      if (end !== undefined && end > 0.12 + i * 0.06) {
        const hop = Math.round(Math.abs(Math.sin(c.time * 7 + i * 1.9)) * 3);
        shadow(b, x0, e.feet, hop > 1 ? 4 : 5);
        put(b, tinted(heroSprites(h.look, h.marks).cheer, l, lk), x0, e.feet - hop, 9, FEET_Y);
        continue;
      }
      const act = end === undefined ? heroActs[i] : null;
      const p = act?.p ?? 0;
      const heal = act?.a.kind === 'cura';
      const pose: FightPose = !act
        ? 'ready'
        : heal
          ? p < 0.6
            ? 'up'
            : 'ready'
          : p < 0.3
            ? 'windup'
            : p < 0.58
              ? 'strike'
              : 'ready';
      const taken = tr && end === undefined ? takenOf(tr) : [];
      const hitNow = taken.find(({ x, p: q }) => !x.heal && q < 0.62);
      const struck = !!hitNow;
      const x = x0 + dir * (act && !heal ? lunge(p) : 0) - (struck ? dir * 2 : 0);
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
        struck && hitNow!.p < 0.44 && flash ? white : undefined,
      );
      const wid = MAIN[h.crew.cls] ?? 'espada';
      // Lo que lleva su golpe hasta el enemigo: la flecha y el orbe vuelan; el resto, un tajo.
      // La cura: una luz que va al herido.
      if (act && heal) {
        const to = act.a.blows[0]?.to ?? i;
        this.fx.push({
          k: 'bolt',
          what: 'luz',
          x0: x + dir * 4,
          x1: heroX(to),
          y: e.feet - 16,
          a: (p - 0.1) / 0.3,
        });
      } else if (act) {
        const tj = Math.min(foes.length - 1, act.a.blows[0]?.to ?? 0);
        const tf = foes[tj];
        if (tf) {
          const fxX = foeXs[tj]!;
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
              big: wid === 'maza' || act.a.kind === 'habilidad',
            });
        }
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
      if (struck) {
        const q = hitNow!.p;
        // Las bestias arañan (el jabalí embiste: choque fuerte y tiembla); el resto, un golpe.
        const by = foes[hitNow!.x.from];
        const ram = !!by && RAMS.has(by.what);
        const big = ram || !!hitNow!.x.big;
        if (big && q < 0.4) this.shake = Math.floor(t * 40) % 2 ? 1 : -1;
        if (by && !big && (by.kind === 'bestia' || by.kind === 'alimana') && !by.big)
          this.fx.push({ k: 'claw', x: x + dir * 2, y: e.feet - 14, dir, a: (q - 0.32) / 0.4 });
        else
          this.fx.push({
            k: 'impact',
            x: x + dir * 4,
            y: e.feet - 14,
            a: (q - 0.32) / (big ? 0.18 : 0.14),
            big,
          });
        this.fx.push({
          k: 'dust',
          x: x - dir * 2,
          y: e.feet,
          a: (q - 0.32) / 0.4,
          w: big ? 9 : 5,
        });
      }
      // Lo que le quitan (en rojo) y lo que le curan (en verde, con su +).
      taken.forEach(({ x: hit, p: q }, k) => {
        if (!hit.amount) return;
        this.pops.push({
          text: hit.heal ? `+${hit.amount}` : String(hit.amount),
          x: x0,
          y: e.feet - 30 - k * 7,
          u: (q - 0.32) / 0.68,
          color: hit.heal ? '#63c74d' : '#f6757a',
        });
      });
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

/** Los que embisten (estelas, se lanzan y choque fuerte): el jabalí y el Viejo Jabalí. */
const RAMS = new Set(['jabali', 'viejo_jabali']);

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
 * Lo que dura la pelea en el visor (s): la de verdad a su paso (o más deprisa en directo), más
 * lo que tarda en caer el último. Para «Ver la pelea».
 */
export function fightSpan(m: MarchNow): number {
  const n = foesOf(m).length;
  const sc = m.sim
    ? scriptOf(
        m.sim,
        m.crew.map((h) => h.id),
        n,
      )
    : stubScript(m.crew.length, n, m.won !== false, TURN);
  const pace = m.pace ?? Math.max(1, sc.T / LIVE);
  return sc.T / pace + TURN;
}

/** Lo que dura, al ganar, la caída de los que quedan y la celebración (s). */
export const WIN_AFTER = AFTER;
