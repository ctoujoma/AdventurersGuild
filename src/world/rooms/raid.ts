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
import type { RaidPlan, RaidStep } from '../../core/model';
import { BANDIT_TYPES, banditLook } from '../battle';
import type { PKind } from '../particles';
import type { SoundName } from '../scene';
import type { Crowd } from './crowd';
import { PATIO_W, floorY, interior, type RoomsLayout } from './layout';
import type { Place } from './people';

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
}
const FLOAT_LIFE = 0.9;

export class RaidShow {
  /** Segundos de asalto que ya se han visto. */
  t = 0;
  private next = 0;
  private areas = new Map<string, Area>();
  private fights = new Set<string>();
  private sacks = new Map<string, number>();
  private door: { t0: number; dur: number; x: number } | null = null;
  private lock: { t0: number; dur: number; area: Area } | null = null;
  private lastHit = 0;
  private slot = new Map<string, number>();
  /** Vida de cada uno (si el plan la trae) y la de al empezar. */
  private hp = new Map<string, number>();
  private max = new Map<string, number>();
  private floats: Float[] = [];
  private chances = new Set<string>();

  constructor(
    private plan: RaidPlan,
    L: RoomsLayout,
    private crowd: Crowd,
    private hooks: RaidHooks,
    /** El asalto en marcha, si se juega en directo. */
    readonly live: Assault | null = null,
  ) {
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
    const bandits = Object.keys(plan.start).filter(isBandit);
    bandits.forEach((id, i) => {
      const { look, marks } = banditLook(BANDIT_TYPES[i % BANDIT_TYPES.length]!, i);
      this.slot.set(id, i);
      this.crowd.addBandit(id, look, marks, this.placeOf('fuera', id));
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
    const steps = this.plan.steps;
    while (this.next < steps.length) this.apply(steps[this.next++]!, true);
    this.t = this.end + 0.5;
    this.floats = [];
    this.chances.clear();
    this.door = null;
    this.lock = null;
    this.fights.clear();
  }

  /** Sacos a cuestas, la barra de la puerta y la de la cerradura (en la lámina de delante). */
  draw(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    for (const [id, gold] of this.sacks) {
      const w = this.crowd.where(id);
      if (!w || w.down || gold <= 0) continue;
      const x = Math.round(w.x - px) + 3;
      const y = Math.round(w.y - py) - 24;
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 1, y - 1, 7, 7);
      ctx.fillStyle = P.tan;
      ctx.fillRect(x, y + 1, 5, 4);
      ctx.fillStyle = P.clay;
      ctx.fillRect(x + 1, y, 3, 1);
      ctx.fillStyle = P.lemon;
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }
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
    // Los números de daño (y de cura) suben y se apagan.
    this.floats = this.floats.filter((f) => this.t - f.t0 < FLOAT_LIFE * RAID_SPEED);
    for (const f of this.floats) {
      const w = this.crowd.where(f.id);
      if (!w) continue;
      const k = (this.t - f.t0) / (FLOAT_LIFE * RAID_SPEED);
      const x = Math.round(w.x - px - f.text.length * 2);
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
          const p = this.placeOf(s.to, id);
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
      case 'down': {
        const w = this.crowd.where(s.id);
        this.crowd.knock(s.id);
        this.sacks.delete(s.id);
        if (skip || !w) break;
        this.hooks.burst('puff', w.x, w.y - 4, 5);
        if (s.k === 'down' && s.gold > 0) this.hooks.burst('coin', w.x, w.y - 10, 10);
        this.hooks.sound('thud', 0.9);
        break;
      }
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
      case 'hit': {
        this.hp.set(s.id, Math.max(0, (this.hp.get(s.id) ?? 0) - s.amount));
        if (skip) break;
        this.chances.delete(s.from);
        const a = this.crowd.where(s.from);
        const b = this.crowd.where(s.id);
        if (a && b) {
          const dir = b.x >= a.x ? 1 : -1;
          this.crowd.strike(s.from, dir);
          this.hooks.burst('spark', b.x - dir * 3, b.y - 14, s.crit ? 6 : 3);
        }
        this.floats.push({
          id: s.id,
          text: String(s.amount),
          color: s.crit ? P.lemon : isBandit(s.id) ? P.white : P.red,
          t0: this.t,
        });
        if (this.t - this.lastHit > 0.2) {
          this.lastHit = this.t;
          this.hooks.sound('hit', s.crit ? 0.9 : 0.5);
        }
        break;
      }
      case 'heal':
        this.hp.set(
          s.id,
          Math.min(this.max.get(s.id) ?? Infinity, (this.hp.get(s.id) ?? 0) + s.amount),
        );
        if (!skip)
          this.floats.push({ id: s.id, text: String(s.amount), color: P.lime, t0: this.t });
        break;
      case 'chance':
        if (!skip) this.chances.add(s.id);
        break;
      case 'skill': {
        if (skip) break;
        const w = this.crowd.where(s.id);
        if (w) this.hooks.burst(s.skill === 'curar' ? 'glint' : 'star', w.x, w.y - 18, 8);
        this.hooks.sound('swing', 0.9);
        break;
      }
    }
  }

  /** Un sitio dentro de una sala para cada uno (que no se amontonen todos en el mismo punto). */
  private placeOf(node: string, id: string): Place {
    const a = this.areas.get(node) ?? this.areas.get('patio')!;
    const k = this.slot.get(id) ?? 0;
    const mid = (a.x0 + a.x1) / 2;
    const spread = Math.min(8, (a.x1 - a.x0) / 6);
    const x = mid + (isBandit(id) ? 1 : -1) * (4 + (k % 4) * spread);
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
        if (Math.abs(dx) > 11) this.crowd.nudge(u.id, dir * Math.min(Math.abs(dx) - 10, 40 * dt));
      }
      if (!any && !here.some((u) => u.w!.moving)) this.fights.delete(node);
    }
  }
}
