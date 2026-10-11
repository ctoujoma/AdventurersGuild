import { bufferCanvas } from '../art/canvas';
import { FEET_Y, heroSprites, type HeroSprites } from '../art/heroes/hero';
import { generateLook } from '../art/heroes/look';
import type { PixelBuffer } from '../art/pixel';

/**
 * Asalto a la taberna en tiempo real: los bandidos bajan por el camino con antorchas, los
 * defensores salen por la puerta, chocan en el patio y el resultado (ya decidido por el
 * núcleo) se ve: unos caen, otros huyen o se llevan sacos. Dura unos 13 segundos.
 */

export interface BattleSpec {
  won: boolean;
  bandits: number;
  /** Defensores con su sprite; `hurt` acaban en el suelo. */
  defenders: { id: string; spr: HeroSprites; hurt: boolean }[];
}

export interface BattleHooks {
  feetAt: (x: number) => number;
  spark: (x: number, y: number) => void;
  coin: (x: number, y: number) => void;
  sound: (name: 'hit' | 'cheer' | 'creak') => void;
}

type State = 'walk' | 'fight' | 'down' | 'flee' | 'cheer' | 'loot' | 'inside' | 'gone';

interface Fighter {
  side: 'b' | 'd';
  id?: string;
  spr: HeroSprites;
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
}

export const BATTLE_TIME = 13;
const DOOR = 98;
const FIGHT_AT = 4.6;
const OUTCOME_AT = 9.2;

export class Battle {
  t = 0;
  done = false;
  readonly hidden: Set<string>;
  private fighters: Fighter[] = [];
  private nextHit = 0;
  private resolved = false;

  constructor(
    private spec: BattleSpec,
    private hooks: BattleHooks,
  ) {
    this.hidden = new Set(spec.defenders.map((d) => d.id));
    for (let i = 0; i < spec.bandits; i++) {
      const look = {
        ...generateLook(`bandido-${i}`, 'picaro', i % 3 ? 'm' : 'f'),
        headgear: 'capucha' as const,
      };
      const spot = spec.defenders.length ? -96 + i * 22 : DOOR - 8 - i * 6;
      this.fighters.push({
        side: 'b',
        spr: heroSprites(look, { eyepatch: i % 2 === 1 }),
        x: -150 - i * 16,
        target: spot,
        speed: 34,
        state: 'walk',
        face: 1,
        dist: i * 5,
        sack: false,
        then: spec.defenders.length ? 'fight' : 'inside',
      });
    }
  }

  /** Antorchas de los bandidos, para iluminar la noche. */
  torches(): { x: number; y: number }[] {
    return this.fighters
      .filter(
        (f) => f.side === 'b' && f.state !== 'gone' && f.state !== 'inside' && f.state !== 'down',
      )
      .map((f) => ({ x: f.x + 5 * f.face, y: this.hooks.feetAt(f.x) - FEET_Y + 6 }));
  }

  /** Salta al final (el resultado no cambia). */
  finish(): void {
    this.t = BATTLE_TIME;
    this.done = true;
  }

  update(dt: number): void {
    if (this.done) return;
    const t0 = this.t;
    this.t += dt;
    const { spec, hooks } = this;
    const bandits = this.fighters.filter((f) => f.side === 'b');

    // Los defensores salen por la puerta poco después de que suene la alarma.
    if (t0 < 1.4 && this.t >= 1.4) {
      spec.defenders.forEach((d, i) => {
        const foe = bandits[i % bandits.length]!;
        const f: Fighter = {
          side: 'd',
          id: d.id,
          spr: d.spr,
          x: DOOR - 4 + i * 4,
          target: foe.target + 13 + Math.floor(i / bandits.length) * 6,
          speed: 50,
          state: 'walk',
          face: -1,
          dist: i * 3,
          sack: false,
          then: 'fight',
          foe,
        };
        foe.foe ??= f;
        this.fighters.push(f);
      });
      if (spec.defenders.length) hooks.sound('creak');
    }

    // Choques en el patio.
    if (this.t >= FIGHT_AT && this.t < OUTCOME_AT && this.t >= this.nextHit) {
      const fighting = this.fighters.filter((f) => f.state === 'fight' && f.side === 'd');
      if (fighting.length) {
        const f = fighting[Math.floor(Math.random() * fighting.length)]!;
        hooks.spark(f.x - 7, hooks.feetAt(f.x) - 12);
        hooks.sound('hit');
      }
      this.nextHit = this.t + 0.28 + Math.random() * 0.25;
    }

    // Desenlace.
    if (!this.resolved && this.t >= OUTCOME_AT) {
      this.resolved = true;
      this.outcome();
    }
    if (this.t >= BATTLE_TIME) this.done = true;

    // Movimiento.
    for (const f of this.fighters) {
      if (f.state === 'walk' || f.state === 'flee' || f.state === 'loot') {
        const step = f.speed * dt * Math.sign(f.target - f.x);
        f.dist += Math.abs(step);
        if (Math.abs(f.target - f.x) <= Math.abs(step)) {
          f.x = f.target;
          this.arrive(f);
        } else f.x += step;
      }
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
    f.face = f.side === 'b' ? 1 : -1;
  }

  private outcome(): void {
    const { spec, hooks } = this;
    const bandits = this.fighters.filter((f) => f.side === 'b');
    const defenders = this.fighters.filter((f) => f.side === 'd');
    if (!defenders.length) return;
    if (spec.won) {
      bandits.forEach((b, i) => {
        if (i % 2 === 0 && i < bandits.length - 1) b.state = 'down';
        else Object.assign(b, { state: 'flee', target: -170, speed: 70 });
      });
      for (const d of defenders) d.state = 'cheer';
      hooks.sound('cheer');
      // Los caídos se levantan y huyen renqueando al final.
      setTimeout(() => {
        for (const b of bandits)
          if (b.state === 'down') Object.assign(b, { state: 'flee', target: -170, speed: 45 });
      }, 2200);
    } else {
      for (const d of defenders) {
        const hurt = spec.defenders.find((x) => x.id === d.id)?.hurt;
        d.state = hurt ? 'down' : 'cheer';
        if (!hurt) d.state = 'fight';
      }
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

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.done) return;
    const order = [...this.fighters].sort((a, b) => a.x - b.x);
    for (const f of order) {
      if (f.state === 'gone' || f.state === 'inside') continue;
      const feet = this.hooks.feetAt(f.x);
      const moving = f.state === 'walk' || f.state === 'flee' || f.state === 'loot';
      let img: PixelBuffer;
      let flip: boolean;
      let dx = 0;
      let dy = 0;
      if (moving) {
        img = f.spr.walk[Math.floor(f.dist / 3.5) % 4]!;
        flip = f.target < f.x;
      } else {
        img = f.spr.walk[0]!;
        flip = f.face < 0;
        if (f.state === 'fight') dx = Math.sin(this.t * 14 + f.x) > 0.6 ? 2 * f.face : 0;
        if (f.state === 'cheer') dy = Math.sin(this.t * 10 + f.x) > 0 ? -2 : 0;
      }
      const x = Math.round(f.x - 9 + dx) - cx;
      const y = feet - FEET_Y + dy - cy;
      ctx.fillStyle = 'rgba(24, 20, 37, 0.45)';
      ctx.fillRect(Math.round(f.x - 5) - cx, feet - 1 - cy, 10, 1);
      const c = bufferCanvas(img);
      ctx.save();
      if (f.state === 'down') {
        // Tumbado en el suelo.
        ctx.translate(x + img.w / 2, feet - 3 - cy);
        ctx.rotate(f.side === 'b' ? -Math.PI / 2 : Math.PI / 2);
        ctx.drawImage(c, -img.w / 2, -img.h / 2);
      } else if (flip) {
        ctx.translate(x + img.w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(c, 0, 0);
      } else ctx.drawImage(c, x, y);
      ctx.restore();
      // Antorcha o saco.
      if (f.side === 'b' && f.state !== 'down') {
        const hx = Math.round(f.x + 5 * (moving ? (flip ? -1 : 1) : f.face)) - cx;
        const hy = y + 6;
        if (f.sack) {
          ctx.fillStyle = '#945a3c';
          ctx.fillRect(hx - 3, hy - 2, 6, 6);
          ctx.fillStyle = '#feae34';
          ctx.fillRect(hx - 1, hy - 3, 2, 1);
        } else {
          ctx.fillStyle = '#4f2f2d';
          ctx.fillRect(hx, hy, 1, 6);
          ctx.fillStyle = Math.sin(this.t * 20 + f.x) > 0 ? '#fee761' : '#f77622';
          ctx.fillRect(hx - 1, hy - 3, 3, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(hx, hy - 2, 1, 1);
        }
      }
    }
  }
}
