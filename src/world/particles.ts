import { P } from '../art/palette';
import { bayer } from '../art/pixel';

/** Partículas en pixel art: ascuas, humo, chispas, polvo, luciérnagas, notas, corazones… */

export type PKind =
  | 'ember'
  | 'spark'
  | 'smoke'
  | 'steam'
  | 'dust'
  | 'firefly'
  | 'moth'
  | 'leaf'
  | 'drip'
  | 'splash'
  | 'heart'
  | 'note'
  | 'zzz'
  | 'puff'
  | 'coin';

export interface Particle {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  seed: number;
  /** Centro de órbita o datos extra. */
  ax: number;
  ay: number;
}

const GLYPHS: Partial<Record<PKind, string[]>> = {
  heart: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
  note: ['..XX', '..X.', '..X.', 'XXX.', 'XX..'],
  zzz: ['XXX', '..X', '.X.', 'XXX'],
  coin: ['.X.', 'XXX', '.X.'],
};

const COLORS: Partial<Record<PKind, string>> = {
  heart: P.coral,
  note: P.lemon,
  zzz: P.mist,
  coin: P.lemon,
};

export class Particles {
  list: Particle[] = [];
  private n = 0;

  spawn(
    kind: PKind,
    x: number,
    y: number,
    o: Partial<Pick<Particle, 'vx' | 'vy' | 'max' | 'ax' | 'ay'>> = {},
  ): void {
    if (this.list.length > 600) return;
    const max = o.max ?? defaults[kind].life * (0.7 + Math.random() * 0.6);
    this.list.push({
      kind,
      x,
      y,
      vx: o.vx ?? defaults[kind].vx * (Math.random() - 0.5) * 2,
      vy: o.vy ?? defaults[kind].vy * (0.6 + Math.random() * 0.8),
      life: max,
      max,
      seed: this.n++ % 997,
      ax: o.ax ?? x,
      ay: o.ay ?? y,
    });
  }

  update(dt: number, t: number, onLand?: (p: Particle) => void): void {
    for (const p of this.list) {
      p.life -= dt;
      switch (p.kind) {
        case 'ember':
          p.vx += Math.sin(t * 3 + p.seed) * 6 * dt;
          break;
        case 'spark':
          p.vy += 90 * dt;
          break;
        case 'smoke':
          p.vx += 3 * dt;
          break;
        case 'leaf':
          p.vx = Math.sin(t * 2 + p.seed) * 10;
          break;
        case 'drip':
          p.vy += 200 * dt;
          if (p.y >= p.ay) {
            p.life = 0;
            onLand?.(p);
          }
          break;
        case 'firefly':
          p.vx = Math.sin(t * 0.7 + p.seed) * 6 + Math.sin(t * 1.9 + p.seed * 2) * 3;
          p.vy = Math.cos(t * 0.9 + p.seed) * 4;
          if (p.life < 1) p.life = p.max; // viven siempre
          break;
        case 'moth': {
          const a = t * (2 + (p.seed % 3)) + p.seed;
          p.x = p.ax + Math.cos(a) * (5 + (p.seed % 4)) + Math.sin(t * 7 + p.seed) * 1.5;
          p.y = p.ay + Math.sin(a * 1.3) * 4;
          if (p.life < 1) p.life = p.max;
          continue;
        }
        case 'dust':
          p.vx = Math.sin(t * 0.5 + p.seed) * 1.5;
          break;
        case 'note':
        case 'zzz':
        case 'heart':
          p.vx = Math.sin(t * 3 + p.seed) * 6;
          break;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number): void {
    for (const p of this.list) {
      const x = Math.round(p.x - camX);
      const y = Math.round(p.y - camY);
      const k = p.life / p.max; // 1 → 0
      const fade = (px: number, py: number) => bayer(px + p.seed, py) < k;
      switch (p.kind) {
        case 'ember':
        case 'spark':
          px(ctx, x, y, k > 0.6 ? P.lemon : k > 0.3 ? P.orange : P.red);
          break;
        case 'smoke': {
          const s = k > 0.6 ? 2 : 3;
          for (let j = 0; j < s; j++)
            for (let i = 0; i < s; i++)
              if (fade(x + i, y + j)) px(ctx, x + i, y + j, k > 0.5 ? P.steel : P.slate);
          break;
        }
        case 'steam':
          if (fade(x, y)) px(ctx, x, y, P.mist);
          break;
        case 'dust':
          if ((Math.floor(t * 2 + p.seed) % 3 !== 0 || k > 0.5) && fade(x, y))
            px(ctx, x, y, P.mist);
          break;
        case 'firefly': {
          const on = Math.sin(t * 2.2 + p.seed * 1.7) > 0.1;
          if (!on) break;
          px(ctx, x, y, P.lemon);
          ctx.fillStyle = P.lime;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
          ctx.globalAlpha = 1;
          break;
        }
        case 'moth':
          px(ctx, x, y, P.mist);
          if (Math.floor(t * 20 + p.seed) % 2) px(ctx, x + 1, y, P.fog);
          break;
        case 'leaf':
          px(ctx, x, y, P.leaf);
          px(ctx, x + (Math.floor(t * 4 + p.seed) % 2 ? 1 : -1), y, P.forest);
          break;
        case 'drip':
          px(ctx, x, y, P.sky);
          break;
        case 'splash':
          px(ctx, x, y, P.sky);
          break;
        case 'puff':
          for (let j = 0; j < 3; j++)
            for (let i = 0; i < 3; i++)
              if (fade(x + i, y + j) && (i + j) % 2 === 0)
                px(ctx, x + i, y + j, k > 0.5 ? P.sand : P.tan);
          break;
        default: {
          const g = GLYPHS[p.kind];
          if (!g) break;
          const c = COLORS[p.kind]!;
          g.forEach((row, j) => {
            for (let i = 0; i < row.length; i++)
              if (row[i] === 'X' && fade(x + i, y + j)) px(ctx, x + i, y + j, c);
          });
        }
      }
    }
  }
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
}

const defaults: Record<PKind, { life: number; vx: number; vy: number }> = {
  ember: { life: 1.4, vx: 6, vy: -22 },
  spark: { life: 0.8, vx: 40, vy: -60 },
  smoke: { life: 4, vx: 2, vy: -9 },
  steam: { life: 1.6, vx: 2, vy: -8 },
  dust: { life: 9, vx: 1, vy: 1.2 },
  firefly: { life: 9999, vx: 0, vy: 0 },
  moth: { life: 9999, vx: 0, vy: 0 },
  leaf: { life: 9, vx: 0, vy: 9 },
  drip: { life: 3, vx: 0, vy: 0 },
  splash: { life: 0.35, vx: 20, vy: -25 },
  heart: { life: 1.8, vx: 0, vy: -12 },
  note: { life: 2.2, vx: 0, vy: -14 },
  zzz: { life: 2.4, vx: 0, vy: -6 },
  puff: { life: 1.2, vx: 18, vy: -10 },
  coin: { life: 1.2, vx: 10, vy: -20 },
};
