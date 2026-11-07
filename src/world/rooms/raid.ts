/**
 * El asalto en la escena de salas: reproduce, paso a paso, la pelea que ya ha decidido el núcleo
 * (core/assault.ts). Los bandidos llegan por el camino, aporrean la puerta, recorren las salas
 * hasta la cámara, fuerzan la cerradura y salen con sus sacos; los nuestros se levantan de la
 * cama y corren a cortarles el paso. Aquí se mueve a la gente y se pintan los golpes, con la
 * vida de cada uno y el daño de cada golpe.
 *
 * En directo (`live`), la pelea se va jugando a la vez que se ve y el jugador da órdenes:
 * arrastrar a un héroe a una sala, tocar a un bandido (a por él) o a un héroe (crítico o
 * habilidad).
 */
import { P } from '../../art/palette';
import { tinyDigits } from '../../art/digits';
import type { Assault } from '../../core/assault';
import type { AbilityId } from '../../core/combat';
import type { RaidPlan, RaidStep } from '../../core/model';
import { BANDIT_TYPES, banditLook } from '../battle';
import type { PKind } from '../particles';
import type { SoundName } from '../scene';
import { blowOf, type Blow, type Crowd } from './crowd';
import { PATIO_W, floorY, interior, type RoomsLayout } from './layout';
import type { Place } from './people';
import { RaidFx, type FxKind } from './raidFx';
import type { View } from './view3d';

type HitStep = Extract<RaidStep, { k: 'hit' }>;
type FallStep = Extract<RaidStep, { k: 'fall' | 'down' }>;

/** Quien pelea a distancia se queda a esta distancia del blanco (si no, se arrima a 11). */
const RANGED_REACH = 34;
/** El efecto en el blanco de cada golpe cuerpo a cuerpo. */
const MELEE_FX: Partial<Record<Blow, FxKind>> = {
  tajo: 'slash',
  estocada: 'thrust',
  maza: 'smash',
};

/** El asalto se ve algo más rápido de lo que dura en el núcleo. */
export const RAID_SPEED = 1.6;

export interface RaidHooks {
  burst(kind: PKind, x: number, y: number, n: number): void;
  sound(name: SoundName, volume?: number): void;
}

interface Area {
  x0: number;
  x1: number;
  floor: number;
}

export const isBandit = (id: string) => /^b\d+$/.test(id);

/** Un número de daño (o de cura) que sube y se apaga. */
interface Float {
  id: string;
  text: string;
  color: string;
  t0: number;
  /** Corrimiento a un lado. */
  dx: number;
}
const FLOAT_LIFE = 0.9;

/** Un saco soltado: de la espalda (x0, y0) al suelo (x1, y1), con el oro que llevaba. */
interface Drop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  gold: number;
  push: 1 | -1;
  /** Las monedas desparramadas alrededor (corrimiento desde el saco). */
  coins: { dx: number; dy: number }[];
}
/** Lo que tarda el saco en caer al suelo (en segundos del asalto). */
const DROP_TIME = 0.45;
/** Lo que tarda en caer quien recibe el golpe de gracia (como `FALL_TIME` en `crowd.ts`). */
const LAND_TIME = 0.4 * RAID_SPEED;
/**
 * La antorcha en la mano: píxeles hacia dentro desde el borde de la figura (de frente, por fuera;
 * de perfil, metida tras la espalda), altura de la mano (parte del alto, desde arriba) y largo
 * del palo.
 */
const TORCH_OUT = -2;
const TORCH_BACK = 0;
const TORCH_HAND_FRONT = 0.62;
const TORCH_HAND_SIDE = 0.56;
const TORCH_STICK = 9;
/** Lleva antorcha uno de cada tantos bandidos (el primero siempre). */
const TORCH_EVERY = 3;

/** Una luz de la pelea: la antorcha de un bandido (en alto o, si ha caído, en el suelo). */
export interface RaidLight {
  x: number;
  y: number;
  floor: number;
  /** Fuerza (1 en alto; menos en el suelo). */
  power: number;
  /** Para que cada una parpadee a su aire. */
  seed: number;
}

/** Las estrellas del aturdido, sobre los bandidos (los nuestros, mientras estén en el suelo). */
const DAZE_TIME = 3;

export class RaidShow {
  /** Segundos de asalto que ya se han visto. */
  t = 0;
  private next = 0;
  private areas = new Map<string, Area>();
  private fights = new Set<string>();
  private sacks = new Map<string, number>();
  /** Los sacos que han soltado los bandidos al caer: vuelan, caen al suelo y se quedan. */
  private drops: Drop[] = [];
  /** Quién le pegó por última vez a cada uno (para saber hacia dónde cae). */
  private lastFrom = new Map<string, string>();
  /** Cuándo cayó cada uno (las estrellas del aturdido). */
  private downAt = new Map<string, number>();
  /** Cosas para dentro de un rato (el golpe contra el suelo al acabar de caer). */
  private soon: { t: number; fn: () => void }[] = [];
  /** Los bandidos que llevan antorcha. */
  private torches: string[] = [];
  private door: { t0: number; dur: number; x: number } | null = null;
  private lock: { t0: number; dur: number; area: Area } | null = null;
  private lastHit = 0;
  private slot = new Map<string, number>();
  /** De qué lado llegan los bandidos a cada sala (-1 izquierda, 1 derecha). */
  private side = new Map<string, number>();
  /** Dónde está (o a dónde va) cada uno: para saber por qué lado entra en cada sala. */
  private at = new Map<string, string>();
  /** Vida de cada uno (si el plan la trae) y la de al empezar. */
  private hp = new Map<string, number>();
  private max = new Map<string, number>();
  private floats: Float[] = [];
  private chances = new Set<string>();
  /** Flechas, rayos, tajos y luces de los golpes. */
  private fx: RaidFx;
  /** La habilidad que acaba de usar alguien (sus golpes de ese mismo segundo son de ella). */
  private skillNow: { id: string; skill: AbilityId; t: number } | null = null;
  /** El último disparo de cada uno (las dos flechas de la andanada salen una tras otra). */
  private lastShot = new Map<string, { t: number; n: number }>();
  /** Proyectiles en el aire hacia cada uno, y su caída si llega antes que ellos. */
  private inbound = new Map<string, number>();
  private held = new Map<string, FallStep>();
  private skipping = false;

  constructor(
    private plan: RaidPlan,
    L: RoomsLayout,
    private crowd: Crowd,
    private hooks: RaidHooks,
    /** El asalto en marcha, si se juega en directo. */
    readonly live: Assault | null = null,
  ) {
    this.fx = new RaidFx((id) => this.crowd.where(id));
    for (const [id, n] of Object.entries(plan.hp ?? {})) {
      this.hp.set(id, n);
      this.max.set(id, n);
    }
    for (const { room, rect } of L.rooms) {
      if (room.type === 'torre') continue;
      const i = interior(rect);
      this.areas.set(room.id, { x0: i.x + 14, x1: i.x + i.w - 14, floor: room.floor });
    }
    this.areas.set('patio', { x0: -PATIO_W + 40, x1: -24, floor: 0 });
    this.areas.set('fuera', { x0: -PATIO_W + 2, x1: -PATIO_W + 10, floor: 0 });
    // En cada sala, los bandidos se quedan del lado por el que llegan y los nuestros enfrente.
    const path = ['fuera', 'patio', ...plan.route];
    const mid = (n: string) => {
      const a = this.areas.get(n);
      return a ? (a.x0 + a.x1) / 2 : 0;
    };
    for (let i = 1; i < path.length; i++) {
      const d = mid(path[i - 1]!) - mid(path[i]!);
      this.side.set(path[i]!, d > 0 ? 1 : -1);
    }
    for (const [id, node] of Object.entries(plan.start)) this.at.set(id, node);
    const bandits = Object.keys(plan.start).filter(isBandit);
    bandits.forEach((id, i) => {
      const { look, marks } = banditLook(BANDIT_TYPES[i % BANDIT_TYPES.length]!, i);
      this.slot.set(id, i);
      this.crowd.addBandit(id, look, marks, this.placeOf('fuera', id));
      // Uno de cada tres lleva antorcha: es la luz de la pelea en las salas a oscuras.
      if (i % TORCH_EVERY === 0) this.torches.push(id);
    });
    let k = 0;
    for (const id of Object.keys(plan.start)) if (!isBandit(id)) this.slot.set(id, k++);
  }

  /** Segundo en que acaba (en directo, mientras no ha acabado, todavía no se sabe). */
  private get end(): number {
    if (!this.live) return this.plan.end;
    return this.live.result ? this.live.result.plan.end : Infinity;
  }

  get done(): boolean {
    return this.t >= this.end + 0.5;
  }

  /** Lo que queda por ver, en segundos de reloj (para alargar la noche lo justo). */
  get left(): number {
    return Math.max(0, this.end + 0.5 - this.t) / RAID_SPEED;
  }

  /** Vida de alguien ahora (0–1) y si está en pie; null si no se sabe. */
  health(id: string): { hp: number; max: number } | null {
    const max = this.max.get(id);
    return max ? { hp: this.hp.get(id) ?? max, max } : null;
  }

  /** En directo: suelta a un héroe en una sala (va corriendo y se queda allí). */
  send(id: string, room: string): boolean {
    return !!this.live?.order({ kind: 'move', who: id, to: room });
  }

  /** En directo: los nuestros que están en la sala de ese bandido van a por él. */
  aim(bandit: string): boolean {
    const live = this.live;
    const b = live?.unit(bandit);
    if (!live || !b || b.down || b.gone || b.to) return false;
    let any = false;
    for (const d of live.defs())
      if (!d.down && !d.to && d.node === b.node)
        any = live.order({ kind: 'target', who: d.id, to: bandit }) || any;
    if (any) this.hooks.sound('click', 0.6);
    return any;
  }

  /** En directo: tocar a un héroe coge su crítico si lo tiene abierto; si no, su habilidad. */
  tap(id: string): 'crit' | 'skill' | null {
    const live = this.live;
    if (!live) return null;
    if (live.order({ kind: 'crit', who: id })) return 'crit';
    if (live.order({ kind: 'skill', who: id })) return 'skill';
    return null;
  }

  /** Las antorchas que siguen encendidas: dónde está la llama y cuánto alumbra. */
  lights(): RaidLight[] {
    const out: RaidLight[] = [];
    for (const id of this.torches) {
      const t = this.torchAt(id);
      if (t) out.push({ x: t.x, y: t.y, floor: t.floor, power: t.down ? 0.6 : 1, seed: t.seed });
    }
    return out;
  }

  /** Dónde está la llama de una antorcha (en la mano, o en el suelo junto a quien la llevaba). */
  private torchAt(id: string) {
    const w = this.crowd.where(id);
    if (!w) return null;
    const seed = (this.slot.get(id) ?? 0) * 7 + 3;
    const lie = this.crowd.lying(id);
    if (w.down && lie)
      return { x: w.x - lie.head * 9, y: w.y - 3, floor: w.floor, down: true, seed };
    const dir = this.facing(id);
    return { x: w.x - dir * 8, y: w.y - 25, floor: w.floor, down: false, seed, dir };
  }

  /** Dónde mirar: el grupo de bandidos que sigue en pie (o null si ya no queda ninguno). */
  focus(): { x: number; y: number } | null {
    for (const id of this.slot.keys()) {
      if (!isBandit(id)) continue;
      const w = this.crowd.where(id);
      if (w && !w.down) return { x: w.x, y: w.y - 20 };
    }
    return null;
  }

  update(dt: number): void {
    this.t += dt * RAID_SPEED;
    // En directo, la pelea se juega hasta el segundo que se ve.
    const live = this.live;
    if (live) while (!live.result && live.t < this.t) live.tick();
    const steps = this.plan.steps;
    while (this.next < steps.length && steps[this.next]!.t <= this.t)
      this.apply(steps[this.next++]!, false);
    this.fx.update(dt * RAID_SPEED);
    const due = this.soon.filter((x) => x.t <= this.t);
    this.soon = this.soon.filter((x) => x.t > this.t);
    for (const x of due) x.fn();
    // Las antorchas sueltan alguna chispa.
    if (Math.random() < dt * 6)
      for (const l of this.lights()) if (l.power >= 1) this.hooks.burst('ember', l.x, l.y - 4, 1);
    this.brawl(dt);
    // La puerta: golpes y astillas mientras aguanta.
    if (this.door && Math.floor(this.t * 2.5) !== Math.floor((this.t - dt * RAID_SPEED) * 2.5)) {
      this.hooks.burst('puff', this.door.x, floorY(0) - 10, 3);
      this.hooks.sound('thud', 0.5);
    }
  }

  /** Se salta lo que queda: cada uno, directamente a donde acaba. */
  finish(): void {
    // En directo, el resto se lo apañan solos.
    this.live?.run();
    this.skipping = true;
    this.fx.flush();
    const steps = this.plan.steps;
    while (this.next < steps.length) this.apply(steps[this.next++]!, true);
    this.skipping = false;
    this.soon = [];
    this.t = this.end + 0.5;
    this.floats = [];
    this.chances.clear();
    this.door = null;
    this.lock = null;
    this.fights.clear();
  }

  /** Sacos a cuestas, la barra de la puerta y la de la cerradura (en la lámina de delante). */
  /** `view`: la vista (para poner lo que se lleva en la mano donde se ve la figura). */
  draw(ctx: CanvasRenderingContext2D, px: number, py: number, view?: View): void {
    for (const [id, gold] of this.sacks) {
      const w = this.crowd.where(id);
      if (!w || w.down || gold <= 0) continue;
      sack(ctx, Math.round(w.x - px) + 3, Math.round(w.y - py) - 24, false);
    }
    this.drawDrops(ctx, px, py);
    this.drawTorches(ctx, px, py, view);
    this.drawDazed(ctx, px, py);
    const bar = (cx: number, top: number, k: number, color: string) => {
      const W = 24;
      const x = Math.round(cx - px - W / 2);
      const y = Math.round(top - py);
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 1, y - 1, W + 2, 5);
      ctx.fillStyle = P.steel;
      ctx.fillRect(x, y, W, 3);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, Math.max(1, Math.round(W * Math.min(1, k))), 3);
    };
    // La vida de cada uno que está en pie, sobre la cabeza.
    for (const [id, max] of this.max) {
      const w = this.crowd.where(id);
      const hp = this.hp.get(id) ?? max;
      if (!w || w.down || hp <= 0) continue;
      const x = Math.round(w.x - px) - 6;
      const y = Math.round(w.y - py) - 31;
      const fill = Math.max(1, Math.round((12 * hp) / max));
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 1, y - 1, 14, 4);
      ctx.fillStyle = P.steel;
      ctx.fillRect(x, y, 12, 2);
      ctx.fillStyle = isBandit(id) ? P.red : hp / max < 0.35 ? P.gold : P.lime;
      ctx.fillRect(x, y, fill, 2);
    }
    // La ocasión de crítico: un rombo amarillo que late (tocar al héroe para cogerlo).
    const beat = Math.floor(this.t * 6) % 2;
    for (const id of this.chances) {
      const w = this.crowd.where(id);
      if (!w || w.down) continue;
      const x = Math.round(w.x - px);
      const y = Math.round(w.y - py) - 40 - beat;
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 2, y - 1, 5, 7);
      ctx.fillStyle = P.lemon;
      ctx.fillRect(x - 1, y + 1, 3, 3);
      ctx.fillRect(x, y, 1, 5);
    }
    this.fx.draw(ctx, px, py);
    // Los números de daño (y de cura) suben y se apagan.
    this.floats = this.floats.filter((f) => this.t - f.t0 < FLOAT_LIFE * RAID_SPEED);
    for (const f of this.floats) {
      const w = this.crowd.where(f.id);
      if (!w) continue;
      const k = (this.t - f.t0) / (FLOAT_LIFE * RAID_SPEED);
      // Varios a la vez sobre el mismo, uno a cada lado (que no se monten en una columna).
      const x = Math.round(w.x - px - f.text.length * 2 + f.dx);
      const y = Math.round(w.y - py - 36 - k * 10);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      tinyDigits(ctx, f.text, x + 1, y + 1, P.black);
      tinyDigits(ctx, f.text, x, y, f.color);
      ctx.globalAlpha = 1;
    }
    if (this.door) bar(this.door.x, floorY(0) - 70, (this.t - this.door.t0) / this.door.dur, P.red);
    if (this.lock) {
      const a = this.lock.area;
      bar((a.x0 + a.x1) / 2, floorY(a.floor) - 70, (this.t - this.lock.t0) / this.lock.dur, P.gold);
    }
  }

  // ---------- Por dentro ----------

  private apply(s: RaidStep, skip: boolean): void {
    switch (s.k) {
      case 'move':
        for (const id of s.ids) {
          const p = this.placeOf(s.to, id, this.at.get(id));
          this.at.set(id, s.to);
          if (skip) this.crowd.warp(id, p);
          else this.crowd.runTo(id, p, Math.max(0.2, (s.t + s.dur - this.t) / RAID_SPEED));
        }
        break;
      case 'wake':
        this.crowd.wake(s.id);
        break;
      case 'fight':
        this.fights.add(s.at);
        if (!skip) this.hooks.sound('swing', 0.8);
        break;
      case 'fall':
      case 'down':
        // Si le va a llegar una flecha o un hechizo, cae cuando le dé.
        if (!skip && this.inbound.get(s.id)) this.held.set(s.id, s);
        else this.fallen(s, skip);
        break;
      case 'door': {
        const door = this.areas.get(this.plan.route[0] ?? '');
        this.door = { t0: s.t, dur: s.dur, x: door ? door.x0 - 10 : -10 };
        break;
      }
      case 'broke':
        if (!skip && this.door) {
          this.hooks.burst('puff', this.door.x, floorY(0) - 12, 16);
          this.hooks.sound('boom', 0.6);
        }
        this.door = null;
        break;
      case 'lock': {
        const area = this.areas.get(this.plan.route.at(-1) ?? '');
        if (area) this.lock = { t0: s.t, dur: s.dur, area };
        if (!skip) this.hooks.sound('creak', 0.8);
        break;
      }
      case 'open':
        if (!skip && this.lock) {
          const a = this.lock.area;
          this.hooks.burst('coin', (a.x0 + a.x1) / 2, floorY(a.floor) - 16, 14);
          this.hooks.sound('creak', 1);
        }
        this.lock = null;
        break;
      case 'loot':
        this.sacks.set(s.id, s.gold);
        break;
      case 'escape':
        this.sacks.delete(s.id);
        this.crowd.vanish(s.id);
        break;
      case 'hit':
        this.lastFrom.set(s.id, s.from);
        this.hp.set(s.id, Math.max(0, (this.hp.get(s.id) ?? 0) - s.amount));
        if (skip) break;
        this.chances.delete(s.from);
        this.blow(s);
        break;
      case 'heal': {
        this.hp.set(
          s.id,
          Math.min(this.max.get(s.id) ?? Infinity, (this.hp.get(s.id) ?? 0) + s.amount),
        );
        if (skip) break;
        // La luz cae sobre el curado y el número sale cuando le llega.
        this.fx.add('pillar', s.id);
        const w = this.crowd.where(s.id);
        if (w) this.hooks.burst('glint', w.x, w.y - 16, 6);
        this.hooks.sound('holy', 0.7);
        this.float(s.id, String(s.amount), P.lime, this.t + 0.25);
        break;
      }
      case 'chance':
        if (!skip) this.chances.add(s.id);
        break;
      case 'skill': {
        if (skip) break;
        this.skillNow = { id: s.id, skill: s.skill, t: s.t };
        const w = this.crowd.where(s.id);
        if (!w) break;
        if (s.skill === 'provocar') {
          // El arma en alto y un grito que atrae a los bandidos.
          this.crowd.strike(s.id, this.facing(s.id), 'grito');
          this.fx.add('shout', s.id);
          this.hooks.sound('roar', 0.5);
        } else if (s.skill === 'curar') {
          this.crowd.strike(s.id, this.facing(s.id), 'grito');
          this.hooks.burst('glint', w.x, w.y - 26, 4);
        } else if (s.skill === 'bola') {
          this.fx.add('cast', s.id, this.facing(s.id));
          this.hooks.sound('whoosh', 0.8);
        } else this.hooks.sound('swing', 0.9);
        break;
      }
    }
  }

  /** Hacia dónde mira alguien: hacia el enemigo más cercano en su planta. */
  private facing(id: string): 1 | -1 {
    const me = this.crowd.where(id);
    if (!me) return 1;
    let best: number | null = null;
    for (const o of this.slot.keys()) {
      if (isBandit(o) === isBandit(id)) continue;
      const w = this.crowd.where(o);
      if (!w || w.down || w.floor !== me.floor) continue;
      if (best === null || Math.abs(w.x - me.x) < Math.abs(best - me.x)) best = w.x;
    }
    return best === null || best >= me.x ? 1 : -1;
  }

  /**
   * Un golpe con el gesto y el efecto de la clase de quien lo da: tajo, estocada o mazazo junto al
   * blanco; flecha o rayo que vuela hasta él (el número sale al llegar). Si es de una habilidad
   * (Puñalada, Andanada, Bola de fuego), con su dibujo.
   */
  private blow(s: HitStep): void {
    const a = this.crowd.where(s.from);
    const b = this.crowd.where(s.id);
    const now = this.skillNow;
    const skill = now && now.id === s.from && now.t === s.t ? now.skill : null;
    const land = () => this.land(s);
    if (!a || !b) return land();
    const dir = b.x >= a.x ? 1 : -1;
    const outfit = this.crowd.outfit(s.from);
    const blow: Blow = skill === 'punalada' ? 'estocada' : outfit ? blowOf(outfit) : 'tajo';
    this.crowd.strike(s.from, dir, blow === 'grito' ? 'maza' : blow);
    const ranged = skill === 'bola' || blow === 'tiro' || blow === 'conjuro';
    if (!ranged) {
      land();
      this.fx.add(skill === 'punalada' ? 'stab' : (MELEE_FX[blow] ?? 'smash'), s.id, dir);
      return;
    }
    // Los disparos del mismo segundo salen uno tras otro (las dos flechas de la andanada).
    const last = this.lastShot.get(s.from);
    const n = last && last.t === s.t ? last.n + 1 : 0;
    this.lastShot.set(s.from, { t: s.t, n });
    const kind = skill === 'bola' ? 'fire' : blow === 'tiro' ? 'arrow' : 'bolt';
    const hand =
      kind === 'arrow' ? { x: a.x + dir * 7, y: a.y - 15 } : { x: a.x + dir * 8, y: a.y - 22 };
    if (kind === 'bolt' && !n) this.fx.add('cast', s.from, dir);
    this.inbound.set(s.id, (this.inbound.get(s.id) ?? 0) + 1);
    this.fx.shoot(
      kind,
      hand.x,
      hand.y,
      s.id,
      () => {
        const left = (this.inbound.get(s.id) ?? 1) - 1;
        if (left > 0) this.inbound.set(s.id, left);
        else this.inbound.delete(s.id);
        land();
        if (kind === 'fire' && !this.skipping) this.fx.add('boom', s.id);
        const fall = this.held.get(s.id);
        if (fall && !left) {
          this.held.delete(s.id);
          this.fallen(fall, this.skipping);
        }
      },
      n * 0.16,
    );
    if (!this.skipping) this.hooks.sound(kind === 'arrow' ? 'arrow' : 'zap', 0.6);
  }

  /** El golpe llega: chispas, el número y el sonido (un destello más si es crítico). */
  private land(s: HitStep): void {
    if (this.skipping) return;
    const a = this.crowd.where(s.from);
    const b = this.crowd.where(s.id);
    if (b) {
      const dir = !a || b.x >= a.x ? 1 : -1;
      this.hooks.burst('spark', b.x - dir * 3, b.y - 14, s.crit ? 6 : 3);
      if (s.crit) this.fx.add('crit', s.id, dir);
    }
    this.float(s.id, String(s.amount), s.crit ? P.lemon : isBandit(s.id) ? P.white : P.red);
    if (this.t - this.lastHit > 0.2) {
      this.lastHit = this.t;
      this.hooks.sound('hit', s.crit ? 0.9 : 0.5);
    }
  }

  /** Un número que sube sobre alguien (si ya hay otros, a un lado). */
  private float(id: string, text: string, color: string, t0 = this.t): void {
    const n = this.floats.filter((f) => f.id === id).length;
    const dx = [0, 6, -6, 3, -3][n % 5]!;
    this.floats.push({ id, text, color, t0, dx });
  }

  /** Cae (un defensor herido o un bandido, que suelta lo que lleva). */
  private fallen(s: FallStep, skip: boolean): void {
    const w = this.crowd.where(s.id);
    const by = this.crowd.where(this.lastFrom.get(s.id) ?? '');
    // Le echa hacia el lado contrario de quien le pegó.
    const push: 1 | -1 = !w || !by || w.x >= by.x ? 1 : -1;
    const carried = this.sacks.get(s.id) ?? 0;
    this.sacks.delete(s.id);
    const gold = s.k === 'down' ? Math.max(s.gold, carried) : 0;
    if (w && gold > 0) this.drop(w, push, gold, skip);
    if (skip || !w) {
      this.crowd.knock(s.id);
      return;
    }
    this.crowd.knock(s.id, push);
    this.downAt.set(s.id, this.t);
    this.hooks.sound('swing', 0.4);
    // El golpe contra el suelo, al acabar de caer: polvo y ruido sordo.
    this.soon.push({
      t: this.t + LAND_TIME,
      fn: () => {
        const at = this.crowd.where(s.id);
        if (!at) return;
        this.hooks.burst('dust', at.x, at.y - 2, 6);
        this.hooks.burst('puff', at.x + push * 4, at.y - 3, 3);
        this.hooks.sound('thud', 0.9);
      },
    });
  }

  /** El saco sale despedido de la espalda, cae al suelo y se desparrama el oro. */
  private drop(w: { x: number; y: number }, push: 1 | -1, gold: number, skip: boolean): void {
    const n = Math.min(7, 2 + Math.round(gold / 15));
    const coins = Array.from({ length: n }, (_, i) => ({
      dx: push * (3 + ((i * 5) % 9)) - push * (i % 3) * 2,
      dy: -((i * 3) % 3),
    }));
    const d: Drop = {
      x0: w.x + 3,
      y0: w.y - 24,
      x1: w.x + push * 14,
      // A la altura a la que se ve tendido (los pies van un poco más abajo, por la profundidad).
      y1: w.y - 4,
      t0: skip ? this.t - DROP_TIME - 2 : this.t,
      gold,
      push,
      coins,
    };
    this.drops.push(d);
    if (skip) return;
    this.soon.push({
      t: this.t + DROP_TIME,
      fn: () => {
        this.hooks.burst('coin', d.x1 + push * 3, d.y1 - 4, Math.min(12, 4 + n));
        this.hooks.sound('coin', 0.7);
      },
    });
  }

  /** Los sacos soltados: en el aire, girando; en el suelo, abiertos con el oro alrededor. */
  private drawDrops(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    for (const d of this.drops) {
      const k = Math.min(1, (this.t - d.t0) / DROP_TIME);
      if (k < 1) {
        const x = d.x0 + (d.x1 - d.x0) * k;
        const y = d.y0 + (d.y1 - 5 - d.y0) * k - Math.sin(k * Math.PI) * 10;
        sack(ctx, Math.round(x - px) - 2, Math.round(y - py), false);
        continue;
      }
      const x = Math.round(d.x1 - px);
      const y = Math.round(d.y1 - py);
      // Las monedas salen rodando del saco (en el primer medio segundo) y se quedan.
      const roll = Math.min(1, (this.t - d.t0 - DROP_TIME) / 0.5);
      for (const c of d.coins) {
        const cx = x + Math.round(c.dx * roll);
        const cy = y - 1 + c.dy;
        ctx.fillStyle = P.black;
        ctx.fillRect(cx - 1, cy - 1, 4, 3);
        ctx.fillStyle = P.gold;
        ctx.fillRect(cx, cy, 2, 1);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(cx, cy, 1, 1);
      }
      sack(ctx, x - 6, y - 6, true, d.push);
      // Cuánto oro vuelve: el número sube y se apaga.
      const up = (this.t - d.t0 - DROP_TIME) / (1.4 * RAID_SPEED);
      if (up < 1) {
        const text = String(d.gold);
        const tx = x - text.length * 2 + 2;
        const ty = Math.round(y - 14 - up * 10);
        ctx.globalAlpha = up > 0.7 ? 1 - (up - 0.7) / 0.3 : 1;
        ctx.fillStyle = P.black;
        ctx.fillRect(tx - 5, ty, 4, 4);
        ctx.fillStyle = P.gold;
        ctx.fillRect(tx - 4, ty + 1, 2, 2);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(tx - 4, ty + 1, 1, 1);
        tinyDigits(ctx, text, tx + 1, ty + 1, P.black);
        tinyDigits(ctx, text, tx, ty, P.lemon);
        ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * Las antorchas: el palo en la mano de atrás, en alto, con la llama que baila; en el suelo,
   * tumbada y con la llama más baja.
   */
  private drawTorches(ctx: CanvasRenderingContext2D, px: number, py: number, view?: View): void {
    const dot = (x: number, y: number, c: string, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x - px), Math.round(y - py), w, h);
    };
    for (const id of this.torches) {
      const t = this.torchAt(id);
      if (!t) continue;
      const f = Math.floor(this.t * 9 + t.seed) % 3;
      if (t.down) {
        // Tumbada: el palo a lo largo del suelo y una llama baja.
        dot(t.x - 4, t.y + 1, P.black, 7, 3);
        dot(t.x - 3, t.y + 2, P.oak, 5, 1);
        dot(t.x - 1, t.y - 1 - (f === 1 ? 1 : 0), P.orange, 2, 2);
        dot(t.x - 1, t.y, P.lemon);
        continue;
      }
      // En la mano, donde se ve la figura (con la perspectiva no cae justo sobre sus pies en el
      // mundo). De frente, los brazos caen a los costados: la antorcha, por fuera del cuerpo en
      // el lado contrario al enemigo. De perfil, en la mano de atrás: tras la espalda.
      const r = view ? this.crowd.screenRect(id, view) : null;
      const pose = this.crowd.pose(id);
      if (r && pose) {
        const away = pose.front ? -(t.dir ?? 1) : -pose.dir;
        const inset = pose.front ? TORCH_OUT : TORCH_BACK;
        t.x = px + (away < 0 ? r.x + inset : r.x + r.w - 1 - inset);
        // La base de la llama, un palo por encima de la mano.
        t.y = py + r.y + r.h * (pose.front ? TORCH_HAND_FRONT : TORCH_HAND_SIDE) - TORCH_STICK;
      }
      dot(t.x - 1, t.y + 2, P.black, 3, 9);
      dot(t.x, t.y + 3, P.oak, 1, 7);
      dot(t.x, t.y + 3, P.umber, 1, 1);
      const h = 4 + (f === 2 ? 1 : 0);
      const lean = f === 1 ? 1 : 0;
      dot(t.x - 1, t.y + 3 - h, P.black, 4, h + 1);
      dot(t.x - 1 + lean, t.y + 3 - h + 1, P.red, 2, h - 1);
      dot(t.x, t.y + 3 - h + 1, P.orange, 2, h - 1);
      dot(t.x, t.y + 3 - h + 2, P.lemon, 1, h - 2);
      if (f === 0) dot(t.x + lean, t.y + 1 - h, P.orange);
    }
  }

  /** Estrellas que giran sobre la cabeza de quien está tendido (aturdido, no muerto). */
  private drawDazed(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    for (const [id, t0] of this.downAt) {
      const lie = this.crowd.lying(id);
      const w = this.crowd.where(id);
      if (!lie || !w) continue;
      const age = (this.t - t0) / RAID_SPEED;
      if (!lie.landed || (isBandit(id) && age > DAZE_TIME)) continue;
      const hx = w.x + lie.head * 8;
      const hy = w.y - 9;
      for (let i = 0; i < 3; i++) {
        const a = age * 5 + (i * Math.PI * 2) / 3;
        const sx = Math.round(hx + Math.cos(a) * 4 - px);
        const sy = Math.round(hy + Math.sin(a) * 1.5 - py);
        ctx.fillStyle = P.gold;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
  }

  /** Un sitio dentro de una sala para cada uno (que no se amontonen todos en el mismo punto). */
  /**
   * Dónde se para alguien que llega a una sala (desde `from`): del lado por el que entra; si ya
   * hay enemigos dentro, delante del más cercano por ese lado, cara a cara. Sin saber de dónde
   * viene (al empezar), los bandidos del lado por el que llegan y los nuestros enfrente.
   */
  private placeOf(node: string, id: string, from?: string): Place {
    const a = this.areas.get(node) ?? this.areas.get('patio')!;
    const k = this.slot.get(id) ?? 0;
    const mid = (a.x0 + a.x1) / 2;
    const spread = Math.min(8, (a.x1 - a.x0) / 6);
    const prev = from && from !== node ? this.areas.get(from) : undefined;
    const d = prev ? (prev.x0 + prev.x1) / 2 - mid : 0;
    // El lado por el que entra (por una escalera justo encima o debajo, el de siempre).
    const fallback = (this.side.get(node) ?? -1) * (isBandit(id) ? 1 : -1);
    const entry = Math.abs(d) > 4 ? Math.sign(d) : fallback;
    const foes = [...this.at]
      .filter(([o, n]) => n === node && o !== id && isBandit(o) !== isBandit(id))
      .map(([o]) => this.crowd.where(o))
      // Solo los que ya están dentro (no los que aún vienen de camino).
      .filter(
        (w): w is NonNullable<typeof w> =>
          !!w && !w.down && w.floor === a.floor && w.x > a.x0 - 8 && w.x < a.x1 + 8,
      );
    let x: number;
    if (foes.length) {
      // El enemigo más metido hacia el lado por el que entra: se planta delante de él.
      const front = foes.reduce((b, w) => (w.x * entry > b.x * entry ? w : b));
      x = front.x + entry * (10 + (k % 3) * 6);
    } else x = mid + entry * (4 + (k % 4) * spread);
    return { x: Math.max(a.x0, Math.min(a.x1, x)), floor: a.floor };
  }

  /** Donde se pelea: cada uno se arrima al enemigo más cercano y le atiza. */
  private brawl(dt: number): void {
    for (const node of this.fights) {
      const a = this.areas.get(node);
      if (!a) continue;
      const here = [...this.slot.keys()]
        .map((id) => ({ id, w: this.crowd.where(id) }))
        .filter(
          (u) =>
            u.w &&
            !u.w.down &&
            !u.w.moving &&
            u.w.floor === a.floor &&
            u.w.x > a.x0 - 30 &&
            u.w.x < a.x1 + 30,
        );
      let any = false;
      for (const u of here) {
        const foes = here.filter((f) => isBandit(f.id) !== isBandit(u.id));
        if (!foes.length) continue;
        any = true;
        const foe = foes.reduce((b, f) =>
          Math.abs(f.w!.x - u.w!.x) < Math.abs(b.w!.x - u.w!.x) ? f : b,
        );
        const dx = foe.w!.x - u.w!.x;
        const dir = dx >= 0 ? 1 : -1;
        // Se arriman; los golpes los dan los pasos `hit` (los de verdad).
        // Quien dispara o lanza hechizos se queda a distancia (si cabe en la sala).
        const o = this.crowd.outfit(u.id);
        const b = o ? blowOf(o) : 'tajo';
        const reach =
          (b === 'tiro' || b === 'conjuro') && Math.abs(dx) <= RANGED_REACH + 30
            ? RANGED_REACH
            : 11;
        if (Math.abs(dx) > reach)
          this.crowd.nudge(u.id, dir * Math.min(Math.abs(dx) - reach + 1, 40 * dt));
      }
      if (!any && !here.some((u) => u.w!.moving)) this.fights.delete(node);
    }
  }
}

/** El saco tumbado y abierto: contorno, tela, luz, sombra, el cordel y el oro que asoma. */
const OPEN_SACK = [
  '..kkkkk.....',
  '.kssttTk....',
  'kstttttckk..',
  'ktttttTcgok.',
  'kttttTTcggok',
  '.kTTTTTkkkk.',
];
const SACK_INK: Record<string, string> = {
  k: P.black,
  t: P.tan,
  s: P.sand,
  T: P.clay,
  c: P.rust,
  g: P.gold,
  o: P.lemon,
};

/**
 * Un saco de botín: a la espalda (cerrado, con la boca atada) o en el suelo (tumbado y abierto
 * hacia `open`, con el oro asomando).
 */
function sack(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean, dir = 1): void {
  if (!open) {
    ctx.fillStyle = P.black;
    ctx.fillRect(x - 1, y - 1, 7, 7);
    ctx.fillStyle = P.tan;
    ctx.fillRect(x, y + 1, 5, 4);
    ctx.fillStyle = P.clay;
    ctx.fillRect(x + 1, y, 3, 1);
    ctx.fillRect(x, y + 4, 5, 1);
    ctx.fillStyle = P.lemon;
    ctx.fillRect(x + 2, y + 2, 1, 1);
    return;
  }
  // Tumbado, con la boca hacia `dir` (el dibujo mira a la derecha y se voltea).
  for (let r = 0; r < OPEN_SACK.length; r++) {
    const row = OPEN_SACK[r]!;
    for (let c = 0; c < row.length; c++) {
      const col = SACK_INK[row[c]!];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(dir > 0 ? x + c : x + row.length - 1 - c, y + r, 1, 1);
    }
  }
}
