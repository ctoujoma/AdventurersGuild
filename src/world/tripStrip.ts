/**
 * La tira del encargo en curso: una línea de tiempo dibujada. Abajo, las partes del viaje (de la
 * taberna al sitio y de vuelta a la taberna), con lo pasado pintado y los sucesos marcados;
 * encima, el paisaje del terreno, de día o de noche, y el grupo en su punto del viaje:
 *
 * - de camino (ida y vuelta), andando; los heridos, cojeando y a la cola;
 * - de noche por el camino, sentados junto a una hoguera;
 * - al llegar, mirando alrededor; haciendo lo suyo, según el tipo (un cofre, el carro…);
 * - peleando contra los enemigos de su familia (`art/foes.ts`) mientras dura la pelea;
 * - ante un jefe, parados frente a su silueta con un «!» mientras esperan; ya resuelto, el jefe
 *   caído o el grupo en retirada;
 * - y los sucesos, como bocadillos en su momento.
 *
 * Solo pinta: recibe `JourneyNow` y el reloj de la animación (segundos). Ver `ui/QuestStrip.tsx`.
 */
import { bossArt } from '../art/bosses';
import { bufferCanvas } from '../art/canvas';
import { foeArt, type FoeArt, type FoePose } from '../art/foes';
import {
  FEET_Y,
  HAND,
  fightSprites,
  heroSprites,
  type FightPose,
  type HeroLook,
  type HeroMarks,
} from '../art/heroes/hero';
import { generateLook } from '../art/heroes/look';
import { P } from '../art/palette';
import type { PixelBuffer } from '../art/pixel';
import { LAND_GROUND, LAND_H, cart, chest, tripLand } from '../art/trip';
import { BOSS_T, LEGS, RESOLVE_T, type JourneyEvent, type JourneyNow } from '../core/journey';
import { Rng } from '../core/rng';
import { WEAPONS, type WeaponId } from './weapons';

/** Alto de la tira (el paisaje y, debajo, la línea del viaje) y margen a los lados. */
export const STRIP_H = 64;
const PAD = 10;
/** Separación entre los del grupo y entre los enemigos. */
const GAP = 11;
/** Cuánto (del total del viaje) dura un bocadillo después de su suceso. */
const BUBBLE = 0.03;

type Crew = JourneyNow['crew'][number];

const MAIN: Record<string, WeaponId> = {
  guerrero: 'espada',
  picaro: 'daga',
  mago: 'baston',
  clerigo: 'maza',
  explorador: 'arco',
};

/** Ángulo del arma en cada pose (grados, desde arriba y en el sentido del reloj). */
const SWING: Record<FightPose, number> = { ready: 25, windup: -50, strike: 80, up: 0, thrust: 90 };

const GOOD = new Set(['Éxito brillante', 'Éxito', 'Éxito parcial']);

/** Lo que se sabe de cada uno para pintarlo, hecho una vez. */
interface Hero {
  crew: Crew;
  look: HeroLook;
  marks: HeroMarks;
  hurt: boolean;
}

const heroCache = new Map<string, Hero>();
function heroOf(c: Crew): Hero {
  const hurt = c.fate === 'herido';
  const key = `${c.id}:${c.seed}:${c.cls}:${hurt}:${c.gear?.icon ?? ''}`;
  let h = heroCache.get(key);
  if (!h) {
    const look = generateLook(c.seed, c.cls, c.sex);
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

/** Un dibujo teñido de un color (el destello del golpe, la silueta del jefe). */
const tinted = new Map<PixelBuffer, Map<string, HTMLCanvasElement>>();
function tint(img: PixelBuffer, color: string): HTMLCanvasElement {
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

/** Pinta un dibujo por el centro de sus pies (`fx`: columna de los pies), volteado si `left`. */
function put(
  ctx: CanvasRenderingContext2D,
  img: PixelBuffer | HTMLCanvasElement,
  x: number,
  feet: number,
  fx: number,
  footRow: number,
  left = false,
): void {
  const c = 'data' in img ? bufferCanvas(img) : img;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(feet - footRow));
  if (left) {
    ctx.scale(-1, 1);
    ctx.drawImage(c, -(c.width - fx), 0);
  } else ctx.drawImage(c, -fx, 0);
  ctx.restore();
}

// ---------- Los glifos de los bocadillos y la línea ----------

const GLYPH: Record<JourneyEvent['kind'] | 'alerta', string[]> = {
  camino: ['.....', 'X..X.', '.....', '..X..X', '......'],
  llegada: ['XXX..', 'XXXX.', 'X....', 'X....', 'X....'],
  faena: ['..XX.', '.X..X', '..XX.', '.X...', 'X....'],
  pelea: ['X...X', '.X.X.', '..X..', '.X.X.', 'X...X'],
  jefe: ['.XXX.', 'X.X.X', 'XXXXX', '.X.X.', '.....'],
  aviso: ['XXXXX', 'XX.XX', 'X.X.X', 'X...X', 'XXXXX'],
  noche: ['.XX..', 'X....', 'X....', 'X....', '.XX..'],
  vuelta: ['..X..', '.XXX.', 'XXXXX', '.X.X.', '.X.X.'],
  alerta: ['..X..', '..X..', '..X..', '.....', '..X..'],
};

const KIND_COLOR: Record<JourneyEvent['kind'], string> = {
  camino: P.sand,
  llegada: P.gold,
  faena: P.lime,
  pelea: P.red,
  jefe: P.hot,
  aviso: P.white,
  noche: P.sky,
  vuelta: P.tan,
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function glyph(ctx: CanvasRenderingContext2D, g: string[], x: number, y: number, c: string): void {
  g.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === 'X') px(ctx, x + i, y + j, c);
  });
}

/** Un bocadillo con su glifo, con el piquito hacia abajo en `x`. */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, g: string[], c: string): void {
  const w = 9;
  const h = 9;
  const x0 = Math.round(x - w / 2);
  const y0 = Math.round(y - h - 2);
  px(ctx, x0 + 1, y0, P.black, w - 2, h);
  px(ctx, x0, y0 + 1, P.black, w, h - 2);
  px(ctx, x0 + 1, y0 + 1, P.white, w - 2, h - 2);
  px(ctx, Math.round(x) - 1, y0 + h, P.black, 3, 1);
  px(ctx, Math.round(x), y0 + h - 1, P.white);
  px(ctx, Math.round(x), y0 + h + 1, P.black);
  glyph(ctx, g, x0 + 2, y0 + 2, c);
}

// ---------- La tira ----------

export class TripStrip {
  private land: PixelBuffer | null = null;
  private landKey = '';
  /** Lo que va encima de todo, también de la noche (los bocadillos). */
  private later: (() => void)[] = [];
  constructor(private w: number) {}

  resize(w: number): void {
    this.w = w;
  }

  /** De un punto del viaje (0–1) a la columna de la tira. */
  private xOf(t: number): number {
    return PAD + t * (this.w - PAD * 2);
  }

  draw(ctx: CanvasRenderingContext2D, now: JourneyNow, time: number): void {
    const { w } = this;
    const j = now.journey;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, STRIP_H);
    this.sky(ctx, now, time);
    const site: [number, number] = [
      Math.round(this.xOf(LEGS[1].from)),
      Math.round(this.xOf(LEGS[2].to)),
    ];
    const key = `${j.terrain}:${w}:${j.seed}`;
    if (key !== this.landKey) {
      this.landKey = key;
      this.land = tripLand(j.terrain, w, site, j.seed);
    }
    ctx.drawImage(bufferCanvas(this.land!), 0, 0);
    const fire = this.scene(ctx, now, time);
    if (now.night) {
      // La noche: todo más oscuro y azulado; luego, las estrellas y la luz de la hoguera.
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#5b649e';
      ctx.fillRect(0, 0, w, LAND_H);
      ctx.globalCompositeOperation = 'source-over';
      this.stars(ctx, now, time);
      if (fire) this.glow(ctx, fire.x, fire.y, time);
    }
    for (const f of this.later) f();
    this.later = [];
    this.timeline(ctx, now);
  }

  // ---------- El cielo ----------

  private sky(ctx: CanvasRenderingContext2D, now: JourneyNow, time: number): void {
    const { w } = this;
    const bands = now.night ? [P.steel, P.steel, P.fog, P.fog] : [P.sky, P.sky, P.sky, P.mist];
    const h = 44;
    for (let y = 0; y < h; y++) {
      const i = Math.min(bands.length - 1, Math.floor((y / h) * bands.length));
      px(ctx, 0, y, bands[i]!, w, 1);
    }
    if (now.night) return;
    // Nubes que pasan despacio.
    const rng = new Rng(`nubes-${now.journey.seed}`);
    for (let i = 0; i < 4; i++) {
      const cw = rng.int(10, 18);
      const y = rng.int(4, 18);
      const x = ((rng.int(0, w) + time * (1.5 + i * 0.4)) % (w + cw * 2)) - cw;
      px(ctx, x, y, P.white, cw, 2);
      px(ctx, x + 2, y - 1, P.white, cw - 6, 1);
      px(ctx, x + 1, y + 2, P.mist, cw - 2, 1);
    }
  }

  private stars(ctx: CanvasRenderingContext2D, now: JourneyNow, time: number): void {
    const rng = new Rng(`estrellas-${now.journey.seed}`);
    for (let i = 0; i < 26; i++) {
      const x = rng.int(0, this.w - 1);
      const y = rng.int(1, 24);
      if ((Math.floor(time * 2) + i) % 7 === 0) continue;
      px(ctx, x, y, i % 4 ? P.fog : P.white);
    }
    // La luna.
    const mx = this.w - 26;
    px(ctx, mx, 5, P.mist, 5, 5);
    px(ctx, mx + 1, 4, P.mist, 3, 7);
    px(ctx, mx - 1, 6, P.mist, 7, 3);
    px(ctx, mx + 2, 6, P.fog, 2, 2);
  }

  private glow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const r = 16 + Math.sin(time * 9) * 1.5;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(255,170,80,0.55)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    this.flames(ctx, x, y, time);
  }

  // ---------- La línea del viaje ----------

  private timeline(ctx: CanvasRenderingContext2D, now: JourneyNow): void {
    const { w } = this;
    const y = LAND_H;
    px(ctx, 0, y, P.black, w, STRIP_H - y);
    const x0 = this.xOf(0);
    const x1 = this.xOf(1);
    const xt = this.xOf(now.t);
    const mid = y + 5;
    px(ctx, x0, mid, P.slate, x1 - x0, 2);
    px(ctx, x0, mid, P.gold, xt - x0, 2);
    // Dónde empieza cada parte.
    for (const l of LEGS.slice(1)) px(ctx, this.xOf(l.from), mid - 2, P.fog, 1, 6);
    // La taberna en las puntas y la bandera del sitio en medio.
    glyph(ctx, GLYPH.vuelta, x0 - 7, mid - 2, P.tan);
    glyph(ctx, GLYPH.vuelta, x1 + 3, mid - 2, P.tan);
    const site = this.xOf((LEGS[1].from + LEGS[2].from) / 2);
    glyph(ctx, GLYPH.llegada, site - 1, mid - 6, now.t >= LEGS[1].from ? P.gold : P.steel);
    // Los sucesos ya pasados.
    for (const e of now.past) px(ctx, this.xOf(e.t) - 1, mid - 1, KIND_COLOR[e.kind], 2, 4);
    // Dónde van ahora.
    px(ctx, xt - 2, y + 1, P.lemon, 5, 1);
    px(ctx, xt - 1, y + 2, P.lemon, 3, 1);
    px(ctx, xt, y + 3, P.lemon);
  }

  // ---------- Lo que pasa ----------

  /** El grupo y lo suyo; devuelve dónde está la hoguera, si la hay. */
  private scene(
    ctx: CanvasRenderingContext2D,
    now: JourneyNow,
    time: number,
  ): { x: number; y: number } | null {
    const j = now.journey;
    const G = LAND_GROUND;
    // En la fila: los que siguen (los muertos y perdidos, no); los heridos, a la cola.
    const crew = now.crew
      .filter((c) => c.fate !== 'muerto' && c.fate !== 'desaparecido')
      .map(heroOf)
      .sort((a, b) => Number(a.hurt) - Number(b.hurt));
    const n = crew.length;
    const bossOn = !!j.boss && now.t >= BOSS_T - 0.02;
    const good = now.outcome ? GOOD.has(now.outcome) : null;
    // El jefe (mirando a la izquierda): dónde pisa y hasta dónde llega por delante.
    const art = j.boss ? bossArt(j.boss) : null;
    const down = good === true;
    const bossImg = art ? (down ? art.poses.down : art.poses.ready) : null;
    const bossFoot = art ? (down ? art.downFoot : art.foot) : { x: 0, y: 0 };
    const k = bossImg ? Math.min(1, 46 / bossImg.h) : 1;
    const bossX = bossImg ? Math.min(this.w - 2 - bossFoot.x * k, this.xOf(BOSS_T) + 30) : 0;
    const bossFront = bossImg ? bossX - (bossImg.w - bossFoot.x) * k : this.w;
    let lead = Math.min(this.w - 12, Math.max(this.xOf(now.t), PAD + 6 + Math.max(0, n - 1) * GAP));
    // Ante el jefe (y mientras siguen allí), el grupo se planta delante de él.
    if (bossOn && now.leg === 'faena') lead = Math.min(lead, bossFront - 8);
    const at = (i: number) => lead - i * GAP;

    // El jefe: silueta mientras espera; caído o en pie (si se retiran) cuando ya se sabe.
    if (bossOn && bossImg) {
      const c = down ? bufferCanvas(bossImg) : tint(bossImg, P.black);
      ctx.save();
      ctx.translate(Math.round(bossX), G + 1);
      ctx.scale(-k, k);
      ctx.drawImage(c, -bossFoot.x, -bossFoot.y);
      ctx.restore();
    }

    // Escoltando: el carro va con ellos.
    if (j.type === 'Escoltar' && n) {
      const c = cart();
      put(ctx, c, at(n - 1) - 12, G + 1, Math.round(c.w / 2), c.h - 1);
    }

    const waiting = now.waiting || (bossOn && !now.outcome && now.t < RESOLVE_T);
    let fire: { x: number; y: number } | null = null;

    if (now.fighting) this.fight(ctx, now, crew, at, time);
    else if (waiting) {
      crew.forEach((h, i) => this.pose(ctx, h, at(i), 'ready', false, time, i));
      // El «!» que salta: esperan a que digas.
      const hop = Math.floor(time * 3) % 2;
      this.later.push(() => bubble(ctx, lead, G - 30 - hop, GLYPH.alerta, P.red));
    } else if (bossOn && now.outcome && now.leg === 'faena') {
      if (good) crew.forEach((h, i) => this.cheer(ctx, h, at(i), time, i));
      // En retirada: andando hacia atrás, mirando a la taberna.
      else crew.forEach((h, i) => this.walk(ctx, h, at(i) - 4, time, i, true));
    } else if (now.night && (now.leg === 'ida' || now.leg === 'vuelta')) {
      fire = this.camp(ctx, crew, lead - Math.round(((n - 1) * GAP) / 2));
    } else if (now.leg === 'llegada') {
      crew.forEach((h, i) => this.look(ctx, h, at(i), time, i));
    } else if (now.leg === 'faena') {
      this.work(ctx, now, crew, at, lead, time);
    } else crew.forEach((h, i) => this.walk(ctx, h, at(i), time, i, false));

    // Los enemigos, ya acabada la pelea: caídos si ha ido bien (con el informe ya llegado).
    if (!j.boss && j.fight && now.t >= j.fight.to && now.leg === 'faena' && good)
      this.foes(now).forEach((f, i) => {
        const img = f.poses.down;
        put(
          ctx,
          img,
          lead + 16 + i * GAP + (f.big ? 8 : 0),
          G + 1,
          Math.round(img.w / 2),
          img.h - 1,
        );
      });

    // El suceso de ahora, en un bocadillo encima del grupo.
    if (!waiting && n) {
      const e = [...now.past].reverse().find((x) => now.t - x.t < BUBBLE);
      if (e)
        this.later.push(() =>
          bubble(
            ctx,
            lead - 2,
            G - 30,
            GLYPH[e.kind],
            KIND_COLOR[e.kind] === P.white ? P.navy : darkOf(e.kind),
          ),
        );
    }
    return fire;
  }

  /** Los enemigos de esta pelea (de dos a tres; uno, si es grande). */
  private foes(now: JourneyNow): FoeArt[] {
    const j = now.journey;
    const rng = new Rng(`foes-${j.seed}`);
    const n = j.foe === 'grande' ? 1 : j.foe === 'alimana' ? 3 : rng.int(2, 3);
    return Array.from({ length: n }, (_, i) => foeArt(j.foe, `${j.seed}-${i}`));
  }

  private walk(
    ctx: CanvasRenderingContext2D,
    h: Hero,
    x: number,
    time: number,
    i: number,
    back: boolean,
  ): void {
    const spr = heroSprites(h.look, h.marks);
    // Los heridos, más despacio y con un saltito al apoyar (cojean).
    const speed = h.hurt ? 5 : 9;
    const f = Math.floor(time * speed + i * 3) % spr.walk.length;
    const dip = h.hurt && f % 4 === 1 ? 1 : 0;
    put(ctx, spr.walk[f]!, x, LAND_GROUND + 1 + dip, 9, FEET_Y, back);
  }

  private look(ctx: CanvasRenderingContext2D, h: Hero, x: number, time: number, i: number): void {
    const spr = heroSprites(h.look, h.marks);
    const blink = Math.floor(time * 3 + i * 5) % 17 === 0;
    const img = blink ? spr.blink : spr.idle[Math.floor(time * 2 + i) % 2]!;
    put(ctx, img, x, LAND_GROUND + 1, 9, FEET_Y);
  }

  private cheer(ctx: CanvasRenderingContext2D, h: Hero, x: number, time: number, i: number): void {
    const spr = heroSprites(h.look, h.marks);
    const up = !h.hurt && Math.floor(time * 3 + i) % 2 === 0;
    put(ctx, up ? spr.cheer : spr.idle[0], x, LAND_GROUND + 1 - (up ? 1 : 0), 9, FEET_Y);
  }

  /** Una pose de pelea con su arma (mirando a la derecha). */
  private pose(
    ctx: CanvasRenderingContext2D,
    h: Hero,
    x: number,
    pose: FightPose,
    flash: boolean,
    _time: number,
    _i: number,
    planted = false,
  ): void {
    const poses = fightSprites(h.look, h.marks, planted);
    const img = poses[pose];
    const feet = LAND_GROUND + 1;
    const lunge = pose === 'strike' ? 2 : 0;
    put(ctx, flash ? tint(img, P.white) : img, x + lunge, feet, 9, FEET_Y);
    const weapon = WEAPONS[MAIN[h.crew.cls] ?? 'espada'];
    const hand = HAND[pose];
    ctx.save();
    ctx.translate(Math.round(x + lunge + hand.x - 9), Math.round(feet - FEET_Y + hand.y));
    ctx.rotate(((MAIN[h.crew.cls] === 'arco' ? 0 : SWING[pose]) * Math.PI) / 180);
    ctx.drawImage(bufferCanvas(weapon.img), -weapon.px, -weapon.py);
    ctx.restore();
  }

  /** La pelea: el grupo contra los enemigos, cada uno a su ritmo, con destellos al dar. */
  private fight(
    ctx: CanvasRenderingContext2D,
    now: JourneyNow,
    crew: Hero[],
    at: (i: number) => number,
    time: number,
  ): void {
    const foes = this.foes(now);
    const lead = at(0);
    const G = LAND_GROUND;
    const phase = (k: number) => (time / 1.3 + k * 0.37) % 1;
    const hits = new Set<number>();
    crew.forEach((h, i) => {
      const p = phase(i);
      const pose: FightPose =
        p < 0.45 ? 'ready' : p < 0.65 ? 'windup' : p < 0.85 ? 'strike' : 'ready';
      if (pose === 'strike') hits.add(i % foes.length);
      this.pose(ctx, h, at(i), pose, false, time, i);
    });
    let x = lead + 18;
    foes.forEach((f, i) => {
      if (f.big) x += 8;
      const p = phase(i + 0.5);
      const hurt = hits.has(i);
      const pose: FoePose = hurt
        ? 'hurt'
        : p < 0.4
          ? Math.floor(time * 2 + i) % 2
            ? 'idle2'
            : 'idle'
          : p < 0.6
            ? 'windup'
            : p < 0.8
              ? 'strike'
              : 'idle';
      const img = f.poses[pose];
      const dx = pose === 'strike' ? -2 : pose === 'hurt' ? 1 : 0;
      const flash = hurt && Math.floor(time * 12) % 2 === 0;
      put(ctx, flash ? tint(img, P.white) : img, x + dx, G + 1, f.foot, img.h - 1, true);
      // El destello del golpe, en el pecho.
      if (hurt) {
        const sx = x - 3;
        const sy = G - f.chest;
        px(ctx, sx - 1, sy, P.lemon, 3, 1);
        px(ctx, sx, sy - 1, P.lemon, 1, 3);
        px(ctx, sx, sy, P.white);
      }
      x += f.span;
    });
  }

  /** Lo suyo, sin pelea: abren un cofre, empujan el carro, buscan… */
  private work(
    ctx: CanvasRenderingContext2D,
    now: JourneyNow,
    crew: Hero[],
    at: (i: number) => number,
    lead: number,
    time: number,
  ): void {
    const t = now.journey.type;
    if (t === 'Recuperar' || t === 'Explorar') {
      const c = chest(now.legT > 0.5);
      put(ctx, c, lead + 12, LAND_GROUND + 1, Math.round(c.w / 2), c.h - 1);
      if (now.legT > 0.5 && Math.floor(time * 4) % 2) px(ctx, lead + 11, LAND_GROUND - 9, P.white);
    }
    crew.forEach((h, i) => {
      // A ratos trabajan (cavan, golpean, buscan) y a ratos miran alrededor.
      const p = (time / 1.6 + i * 0.29) % 1;
      if (p < 0.5) this.pose(ctx, h, at(i), p < 0.25 ? 'windup' : 'strike', false, time, i, true);
      else this.look(ctx, h, at(i), time, i);
    });
  }

  /** De noche por el camino: sentados alrededor de la hoguera. */
  private camp(ctx: CanvasRenderingContext2D, crew: Hero[], x: number) {
    const G = LAND_GROUND;
    crew.forEach((h, i) => {
      const spr = heroSprites(h.look, h.marks);
      const side = i % 2 ? 1 : -1;
      const sx = x + side * (10 + Math.floor(i / 2) * 11);
      put(ctx, spr.sit, sx, G - 1, 9, spr.sit.h - 1, side > 0);
      // El tronco donde se sientan.
      px(ctx, sx - 5, G - 2, P.bark, 10, 2);
      px(ctx, sx - 5, G - 2, P.oak, 10, 1);
    });
    // Las piedras de la hoguera.
    px(ctx, x - 4, G - 1, P.steel, 9, 2);
    return { x, y: G - 4 };
  }

  private flames(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const tick = Math.floor(time * 10);
    const h = [4, 6, 5, 7, 5][tick % 5]!;
    px(ctx, x - 2, y + 1, P.red, 5, 2);
    px(ctx, x - 1, y - h + 3, P.orange, 3, h - 1);
    px(ctx, x, y - h + 1, P.gold, 1, h - 1);
    px(ctx, x + ((tick % 3) - 1), y - h, P.lemon);
  }
}

const darkOf = (k: JourneyEvent['kind']) =>
  ({
    camino: P.umber,
    llegada: P.amber,
    faena: P.leaf,
    pelea: P.red,
    jefe: P.wine,
    aviso: P.navy,
    noche: P.ocean,
    vuelta: P.rust,
  })[k];
