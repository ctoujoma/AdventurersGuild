/**
 * La escena del gremio por salas: el corte del edificio con su cielo, la luz del día y de la
 * noche, la cámara y los toques. Se maneja igual que la taberna dibujada (mismos métodos),
 * para que la interfaz no tenga que saber cuál está mirando.
 */
import { bufferCanvas, drawBuffer } from '../../art/canvas';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import type { Building } from '../../core/model';
import { ROOMS } from '../../data/rooms';
import { Camera } from '../camera';
import { GROUND, WORLD_X0 } from '../geometry';
import { glowSprite, lightSprite } from '../lighting';
import {
  MOON_R,
  buildMoon,
  buildSky,
  parallaxLayers,
  stars,
  type ParallaxLayer,
  type Star,
} from '../parallax';
import { Particles } from '../particles';
import type { Point, SceneCallbacks, SceneModel } from '../scene';
import { focusPoint, roomsLayout, type Rect, type RoomsLayout } from './layout';
import { paintRooms, type RoomsBuild } from './paint';

/** Duración del día de la escena hasta que anochece (el reloj de verdad llega con el día vivo). */
const DAY_LENGTH = 720;
const DAWN_LIGHT = 0.65;
const SKY_FX = 0.15;
const MOON = { x: 84, y: 64 } as const;

const noise = (a: number, b: number) => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};

const smooth = (k: number) => k * k * (3 - 2 * k);

interface Spot {
  id: string;
  label: string;
  rect: Rect;
}

/** Nombre de una sala tal como se enseña al tocarla. */
export function roomLabel(b: Building, id: string): string {
  const r = b.rooms.find((x) => x.id === id);
  if (!r) return '';
  const name = ROOMS[r.type].name;
  if (r.works) return `${name} (en obras)`;
  if (r.level === 0) return r.type === 'torre' ? `${name} (sin levantar)` : `${name} (rota)`;
  return `${name} · nivel ${r.level}`;
}

export class RoomScene {
  readonly camera = new Camera();
  speed = 1;
  private ctx: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private layout: RoomsLayout | null = null;
  private build: RoomsBuild | null = null;
  private backC: HTMLCanvasElement | null = null;
  private ambientC: HTMLCanvasElement | null = null;
  private skyC = bufferCanvas(buildSky());
  private moonC = bufferCanvas(buildMoon());
  private parallax: { c: HTMLCanvasElement; l: ParallaxLayer }[] = parallaxLayers().map((l) => ({
    c: bufferCanvas(l.buf),
    l,
  }));
  private starList: Star[] = stars();
  private clouds = [0, 1, 2, 3].map((i) => ({
    x: i * 170 + 20,
    y: 30 + ((i * 37) % 80),
    img: cloud(i),
    speed: 2 + i,
  }));
  private particles = new Particles();
  private spots: Spot[] = [];
  private hover: Spot | null = null;
  private model: SceneModel | null = null;
  private key = '';
  private t = 0;
  private dayStart = 0;
  private dayAtNightfall = 0;
  private night: { start: number; dur: number; done: (() => void) | null } | null = null;
  private last = 0;
  private raf = 0;
  private pointers = new Map<number, Point>();
  private press: { x: number; y: number; moved: boolean; time: number } | null = null;
  private pinch = 0;
  private cssW = 0;
  private cssH = 0;
  private framed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: SceneCallbacks = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    for (let i = 0; i < 8; i++)
      this.particles.spawn('firefly', -150 + Math.random() * 130, GROUND - 60 + Math.random() * 50);
    this.bindInput();
  }

  // ---------- API (la misma que la taberna dibujada) ----------

  setModel(model: SceneModel): void {
    const prev = this.model?.building;
    this.model = model;
    const b = model.building;
    if (!b) return;
    const key = JSON.stringify([b, model.crest]);
    if (key === this.key) return;
    this.key = key;
    const L = roomsLayout(b);
    this.layout = L;
    this.build = paintRooms(L, { crest: model.crest, yard: b.yard });
    this.backC = bufferCanvas(this.build.back);
    this.ambientC = ambientCanvas(this.build, L);
    this.camera.world = { x0: L.x0, x1: L.x1, y0: L.y0, y1: L.y1 };
    this.spots = L.rooms.map(({ room, rect }) => ({
      id: `sala:${room.id}`,
      label: roomLabel(b, room.id),
      rect,
    }));
    if (this.cssW) this.resize(this.cssW, this.cssH, this.camera.zoom);
    if (!this.framed && this.cssW) this.frame();
    // Polvo y monedas donde algo ha mejorado o se ha construido.
    if (prev)
      for (const r of b.rooms) {
        const before = prev.rooms.find((x) => x.id === r.id);
        if (!before || r.level > before.level || (before.works && !r.works)) this.celebrate(r.id);
      }
  }

  resize(cssW: number, cssH: number, zoom?: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    const min = this.minZoom(cssW, cssH);
    const z = Math.max(
      min,
      zoom ?? Math.max(2, Math.ceil(min), Math.floor(Math.min(cssW / 200, cssH / 240))),
    );
    this.camera.setView(cssW, cssH, z);
    this.canvas.width = this.camera.vw;
    this.canvas.height = this.camera.vh;
    this.canvas.style.width = `${this.camera.vw * z}px`;
    this.canvas.style.height = `${this.camera.vh * z}px`;
    this.light.width = this.camera.vw;
    this.light.height = this.camera.vh;
    this.ctx.imageSmoothingEnabled = false;
    if (!this.framed && this.layout) this.frame();
  }

  /** La primera vez, la cámara mira a la planta baja. */
  private frame(): void {
    this.framed = true;
    const p = this.layout ? focusPoint(this.layout, 'sala') : null;
    if (p) this.camera.centerOn(p.x, p.y - 20, false);
  }

  private minZoom(cssW: number, cssH: number): number {
    const w = this.layout ? this.layout.x1 - this.layout.x0 : 600;
    const h = this.layout ? this.layout.y1 - this.layout.y0 : 600;
    return Math.max(1, Math.ceil(Math.max(cssW / w, cssH / h) * 100) / 100);
  }

  zoomBy(step: number): void {
    const min = this.minZoom(this.cssW, this.cssH);
    const cur = this.camera.zoom;
    const z =
      step > 0
        ? Math.min(6, Math.floor(cur) + 1)
        : Math.max(min, Number.isInteger(cur) ? cur - 1 : Math.floor(cur));
    if (z !== cur) this.resize(this.cssW, this.cssH, z);
  }

  screenOf(wx: number, wy: number): Point {
    return this.camera.toScreen(wx, wy);
  }

  focus(room: string): void {
    const p = this.layout ? focusPoint(this.layout, room) : null;
    if (p) this.camera.centerOn(p.x, p.y);
  }

  start(): void {
    if (this.raf) return;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;
      this.update(dt * this.speed);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  /** Los héroes llegan a las salas en el PR de la gente; de momento no se señalan. */
  heroPosition(id: string): Point | null {
    void id;
    return null;
  }

  focusHero(id: string): boolean {
    void id;
    return false;
  }

  nightfall(done: () => void, dur = 2.6): void {
    this.night?.done?.();
    this.dayAtNightfall = this.daylight().day;
    this.night = { start: this.t, dur, done };
  }

  /** Noche con asalto: la pelea dentro de casa llega con su PR; de momento solo pasa la noche. */
  raidNight(
    _raid: { won: boolean; bandits: number; defenders: string[]; hurt: string[] },
    done: () => void,
  ): void {
    this.nightfall(done);
  }

  skipRaid(): void {}

  cheer(room = 'barra'): void {
    const p = this.layout ? focusPoint(this.layout, room) : null;
    if (!p) return;
    for (let i = 0; i < 12; i++)
      this.particles.spawn('note', p.x + (Math.random() - 0.5) * 70, p.y - 6 - Math.random() * 14);
    for (let i = 0; i < 14; i++)
      this.particles.spawn('coin', p.x + (Math.random() - 0.5) * 60, p.y - Math.random() * 16);
    this.cb.onSound?.('cheer');
  }

  celebrate(room: string): void {
    const p = this.layout ? focusPoint(this.layout, room) : null;
    if (!p) return;
    for (let i = 0; i < 26; i++)
      this.particles.spawn('puff', p.x + (Math.random() - 0.5) * 80, p.y + 10 + Math.random() * 20);
    for (let i = 0; i < 10; i++)
      this.particles.spawn('coin', p.x + (Math.random() - 0.5) * 60, p.y + Math.random() * 20);
    this.cb.onSound?.('build');
  }

  /** Luz del día (0–1), del atardecer (0–1) y avance del día (0 mañana – 1 noche). */
  daylight(): { day: number; dusk: number; tod: number } {
    const n = this.night;
    if (n) {
      const p = this.nightP();
      if (p < 0.35) return { day: this.dayAtNightfall * (1 - smooth(p / 0.35)), dusk: 0, tod: 1 };
      if (p < 0.9) return { day: 0, dusk: 0, tod: 0 };
      return { day: smooth(Math.min(1, (p - 0.9) / 0.9)) * DAWN_LIGHT, dusk: 0, tod: 0 };
    }
    const tod = Math.min(1, (this.t - this.dayStart) / DAY_LENGTH);
    const k = (a: number, b: number) => Math.max(0, Math.min(1, (tod - a) / (b - a)));
    const day =
      tod < 0.12 ? DAWN_LIGHT + (1 - DAWN_LIGHT) * smooth(k(0, 0.12)) : 1 - smooth(k(0.6, 0.95));
    const dusk = smooth(k(0.55, 0.78)) * (1 - smooth(k(0.82, 1)));
    return { day, dusk, tod };
  }

  private nightP(): number {
    const n = this.night!;
    const te = this.t - n.start;
    const a = 0.35 * n.dur;
    const plateau = 0.15 * n.dur;
    if (te < a) return te / n.dur;
    if (te < a + plateau) return 0.35 + (0.15 * (te - a)) / plateau;
    return 0.5 + (te - a - plateau) / n.dur;
  }

  private nightLight(): { dark: number; warm: number } {
    if (!this.night) return { dark: 0, warm: 0 };
    const p = this.nightP();
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));
    return {
      dark: ramp(0, 0.35) * (1 - ramp(0.5, 0.9)),
      warm: ramp(0.45, 0.9) * (1 - ramp(1.05, 1.8)),
    };
  }

  // ---------- Simulación y dibujo ----------

  private update(dt: number): void {
    this.t += dt;
    if (this.night) {
      const p = this.nightP();
      if (p >= 0.85 && this.night.done) {
        const done = this.night.done;
        this.night.done = null;
        done();
      }
      if (p >= 1.8) {
        this.night = null;
        this.dayStart = this.t;
      }
    }
    this.camera.update(dt);
    this.particles.update(dt, this.t);
    // Humo de la cocina y de la forja.
    if (this.build && Math.random() < dt * 2)
      for (const l of this.build.lights)
        if (l.flicker >= 0.3 && Math.random() < 0.3)
          this.particles.spawn('ember', l.x + (Math.random() - 0.5) * 8, l.y);
  }

  private draw(): void {
    const { ctx, camera } = this;
    const W = this.build;
    if (!W || !this.backC || !this.ambientC) return;
    const cx = camera.px;
    const cy = camera.py;
    const vw = camera.vw;
    const vh = camera.vh;
    const t = this.t;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.black;
    ctx.fillRect(0, 0, vw, vh);

    // Cielo, estrellas, luna, sol, nubes y capas lejanas.
    const dl = this.daylight();
    ctx.drawImage(this.skyC, WORLD_X0 - Math.round(cx * SKY_FX), -cy);
    ctx.globalAlpha = Math.max(0, 1 - dl.day * 1.4);
    for (const s of dl.day > 0.7 ? [] : this.starList) {
      const sx = s.x + WORLD_X0 - Math.round(cx * SKY_FX);
      const sy = s.y - cy;
      if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
      const tw = noise(s.x, Math.floor(t * 1.5 + s.y));
      if (!s.bright && tw < 0.25) continue;
      ctx.fillStyle = s.bright && tw > 0.6 ? P.white : tw > 0.5 ? P.mist : P.fog;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;
    const moonA = Math.max(0, 1 - dl.day * 1.25);
    if (moonA > 0) {
      ctx.globalAlpha = moonA;
      ctx.drawImage(
        this.moonC,
        Math.round(MOON.x - MOON_R - cx * SKY_FX),
        Math.round(MOON.y - MOON_R - cy),
      );
      ctx.globalAlpha = 1;
    }
    this.drawDaySky(dl, cx, cy, vw, vh);
    for (const cl of this.clouds) {
      const x = ((cl.x + t * cl.speed) % 900) - 60 + WORLD_X0 - cx * 0.2;
      drawBuffer(ctx, cl.img, x, cl.y - cy);
    }
    const { dark, warm } = this.nightLight();
    if (warm > 0) this.drawDawnSky(warm, cy, vw, vh);
    for (const { c, l } of this.parallax) ctx.drawImage(c, WORLD_X0 - Math.round(cx * l.fx), -cy);
    if (dl.day > 0 || dl.dusk > 0) {
      ctx.globalCompositeOperation = 'screen';
      const h = (v: number) => Math.round(v * dl.day + v * 0.4 * dl.dusk);
      ctx.fillStyle = `rgb(${h(70) + Math.round(60 * dl.dusk)}, ${h(105)}, ${h(120)})`;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
    }

    // El edificio.
    ctx.drawImage(this.backC, W.ox - cx, W.oy - cy);

    // Luz: ambiente por sala, día, focos.
    const l = this.lctx;
    l.globalCompositeOperation = 'copy';
    l.fillStyle = '#ffffff';
    l.fillRect(0, 0, vw, vh);
    l.globalCompositeOperation = 'source-over';
    l.drawImage(this.ambientC, W.ox - cx, W.oy - cy);
    l.globalCompositeOperation = 'lighter';
    if (dl.day > 0 || dl.dusk > 0) {
      const v = Math.round(150 * dl.day);
      l.fillStyle = `rgb(${v + Math.round(70 * dl.dusk)}, ${v + Math.round(30 * dl.dusk)}, ${Math.round(v * 0.95)})`;
      l.fillRect(0, 0, vw, vh);
    }
    for (const li of W.lights) {
      if (li.x + li.r < cx || li.x - li.r > cx + vw || li.y + li.r < cy || li.y - li.r > cy + vh)
        continue;
      const fl = noise(Math.floor(t * 9), li.x + li.y);
      const r = Math.max(4, Math.round((li.r * (1 - li.flicker * fl)) / 2) * 2);
      l.drawImage(lightSprite(r, li.color, li.intensity), li.x - r - cx, li.y - r - cy);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    if (dark > 0 || warm > 0) {
      const mix = (a: number, b: number) =>
        Math.round(255 + (a - 255) * dark + (b - 255) * warm * (1 - dark));
      ctx.fillStyle = `rgb(${mix(52, 255)}, ${mix(60, 214)}, ${mix(110, 178)})`;
      ctx.fillRect(0, 0, vw, vh);
    }

    // Brillos encima de la escena ya iluminada.
    ctx.globalCompositeOperation = 'lighter';
    for (const f of W.flames)
      ctx.drawImage(glowSprite(6, [255, 150, 70], 0.35), f.x - 6 - cx, f.y - 5 - cy);
    for (const g of W.glows)
      ctx.drawImage(glowSprite(g.r, g.color, 0.45), g.x - g.r - cx, g.y - g.r - cy);
    ctx.globalCompositeOperation = 'source-over';
    for (const f of W.flames) {
      const tall = noise(Math.floor(t * 10), f.x * 3 + f.y) > 0.45;
      ctx.fillStyle = P.lemon;
      ctx.fillRect(f.x - cx, f.y - cy - (tall ? 1 : 0), 1, tall ? 2 : 1);
      ctx.fillStyle = P.orange;
      ctx.fillRect(f.x - cx, f.y + 1 - cy, 1, 1);
    }
    this.particles.draw(ctx, cx, cy, t);
    if (this.hover) this.brackets(this.hover.rect);
  }

  /** Cielo de día por encima del de noche: azul, con el sol cruzando. */
  private drawDaySky(
    d: { day: number; dusk: number; tod: number },
    cx: number,
    cy: number,
    vw: number,
    vh: number,
  ): void {
    const ctx = this.ctx;
    const horizon = GROUND - 40 - cy;
    if (d.day > 0) {
      ctx.globalAlpha = d.day;
      const g = ctx.createLinearGradient(0, horizon - 230, 0, horizon + 10);
      g.addColorStop(0, '#3b7fc4');
      g.addColorStop(0.65, '#7fbde6');
      g.addColorStop(1, '#cfe9f2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }
    if (d.dusk > 0) {
      const g = ctx.createLinearGradient(0, horizon - 200, 0, horizon + 20);
      g.addColorStop(0, 'rgba(104, 56, 108, 0)');
      g.addColorStop(0.55, `rgba(232, 110, 120, ${0.5 * d.dusk})`);
      g.addColorStop(1, `rgba(247, 118, 34, ${0.75 * d.dusk})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
    const sunUp = Math.max(d.day, d.dusk);
    if (sunUp <= 0 || d.tod >= 0.97) return;
    const p = Math.min(1, d.tod / 0.95);
    const sx = Math.round(300 - 280 * p - cx * SKY_FX);
    const sy = Math.round(84 - Math.sin(Math.PI * p) * 62 - cy);
    const warmSun = d.dusk > 0.3;
    ctx.globalAlpha = Math.min(1, sunUp * 1.3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      glowSprite(30, warmSun ? [254, 140, 52] : [255, 240, 180], 0.55),
      sx - 30,
      sy - 30,
    );
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = warmSun ? P.orange : P.lemon;
    for (let y = -8; y <= 8; y++) {
      const w = Math.floor(Math.sqrt(64 - y * y));
      ctx.fillRect(sx - w, sy + y, w * 2 + 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawDawnSky(warm: number, cy: number, vw: number, vh: number): void {
    const ctx = this.ctx;
    const horizon = GROUND - 40 - cy;
    const g = ctx.createLinearGradient(0, horizon - 200, 0, horizon + 20);
    g.addColorStop(0, 'rgba(90, 60, 120, 0)');
    g.addColorStop(0.55, `rgba(232, 110, 120, ${0.45 * warm})`);
    g.addColorStop(1, `rgba(254, 174, 52, ${0.8 * warm})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  private brackets(r: Rect): void {
    const { ctx, camera } = this;
    const pulse = Math.floor(this.t * 3) % 2;
    const x0 = r.x - camera.px - 2 - pulse;
    const y0 = r.y - camera.py - 2 - pulse;
    const x1 = r.x + r.w - camera.px + 1 + pulse;
    const y1 = r.y + r.h - camera.py + 1 + pulse;
    ctx.fillStyle = P.gold;
    for (const [x, y, dx, dy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ] as const) {
      ctx.fillRect(dx > 0 ? x : x - 3, y, 4, 1);
      ctx.fillRect(x, dy > 0 ? y : y - 3, 1, 4);
    }
  }

  // ---------- Interacción ----------

  private hit(wx: number, wy: number): Spot | null {
    return (
      this.spots.find(
        (s) =>
          wx >= s.rect.x && wx < s.rect.x + s.rect.w && wy >= s.rect.y && wy < s.rect.y + s.rect.h,
      ) ?? null
    );
  }

  private click(cssX: number, cssY: number): void {
    const w = this.camera.toWorld(cssX, cssY);
    const h = this.hit(w.x, w.y);
    if (!h) return;
    this.cb.onSound?.('click', 0.5);
    this.cb.onHotspot?.(h.id, h.label, { x: cssX, y: cssY, wx: w.x, wy: w.y });
  }

  private bindInput(): void {
    const c = this.canvas;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        this.press = { x: p.x, y: p.y, moved: false, time: performance.now() };
        this.camera.dragging = true;
        this.camera.stopInertia();
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (this.press) this.press.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = local(e);
      const prev = this.pointers.get(e.pointerId);
      if (!prev) {
        const w = this.camera.toWorld(p.x, p.y);
        const h = this.hit(w.x, w.y);
        this.hover = h;
        c.style.cursor = h ? 'pointer' : 'grab';
        this.cb.onHover?.(h ? h.label : null, h ? p : null);
        return;
      }
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (d / this.pinch > 1.3) {
          this.zoomBy(1);
          this.pinch = d;
        } else if (d / this.pinch < 0.75) {
          this.zoomBy(-1);
          this.pinch = d;
        }
        return;
      }
      const now = performance.now();
      const dt = (now - (this.press?.time ?? now)) / 1000;
      if (this.press) {
        if (Math.hypot(p.x - this.press.x, p.y - this.press.y) > 5) this.press.moved = true;
        this.press.time = now;
      }
      if (this.press?.moved) {
        c.style.cursor = 'grabbing';
        this.camera.drag(p.x - prev.x, p.y - prev.y, dt);
        this.hover = null;
        this.cb.onHover?.(null, null);
      }
    });
    const end = (e: PointerEvent) => {
      const p = local(e);
      const wasClick = this.press && !this.press.moved && this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        this.camera.release();
        if (wasClick) this.click(p.x, p.y);
        this.press = null;
        c.style.cursor = 'grab';
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      this.camera.release();
      this.press = null;
    });
    c.addEventListener('pointerleave', () => {
      if (!this.pointers.size) {
        this.hover = null;
        this.cb.onHover?.(null, null);
      }
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.ctrlKey) {
          this.zoomBy(e.deltaY < 0 ? 1 : -1);
          return;
        }
        this.camera.drag(-e.deltaX, -e.deltaY, 0);
      },
      { passive: false },
    );
  }
}

/** Luz ambiente del edificio: blanco fuera; dentro de cada sala y bajo tierra, penumbra tintada. */
function ambientCanvas(W: RoomsBuild, L: RoomsLayout): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = L.x1 - L.x0;
  c.height = L.y1 - L.y0;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(-W.ox, -W.oy);
  for (const a of W.ambient) {
    ctx.fillStyle = `rgb(${a.color[0]}, ${a.color[1]}, ${a.color[2]})`;
    ctx.beginPath();
    a.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

function cloud(i: number): PixelBuffer {
  const b = new PixelBuffer(46, 14);
  const puffs: [number, number, number][] = [
    [10, 9, 6],
    [20, 6, 7],
    [31, 8, 6],
    [38, 10, 4],
  ];
  for (const [x, y, r] of puffs)
    b.ellipse(x + (i % 2) * 3, y, r, r * 0.75, (_px, py) =>
      py < y - r * 0.3 ? P.fog : py > y + 1 ? P.navy : P.slate,
    );
  return b;
}
