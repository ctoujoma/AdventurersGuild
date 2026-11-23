/**
 * El visor de las expediciones (rumbo bosque): compone cada fotograma en un `PixelBuffer` con el
 * cielo de la hora, las capas del paisaje con paralaje, los animales, la gente (andar, pelear,
 * acampar), el tiempo (lluvia, niebla) y la luz de la hoguera. Las capas se dibujan una vez por
 * lejanía y se recolorean solo cuando cambia la luz; cada fotograma solo copia y pega.
 */
import { hashString } from '../../core/rng';
import { PixelBuffer } from '../../art/pixel';
import type { ExpWeather } from '../../core/model';
import { drawAnimals } from './animales';
import { buildCapas, type Capa } from './capas';
import { Nubes, drawMoon, drawStars, drawSun, skyBuffer } from './cielo';
import type { Encuadre } from './encuadre';
import { drawCamp, fireLight } from './fuego';
import { Gente } from './gente';
import { luzAt, lutOf, type Clima, type Luz } from './luz';
import type { MarchNow } from './marcha';
import { blitStrip, luzKey } from './pintar';
import { Lluvia, climaOf, drawMist } from './tiempo';
import { smooth } from './tonos';

/** Para forzar la hora o el tiempo (pruebas, capturas). */
export interface VisorForce {
  hour?: number;
  weather?: ExpWeather;
  /** Lo que lleva andado (para las capturas del paralaje). */
  travel?: number;
}

/** Píxeles de suelo por segundo al andar (8 pasos de 2 px). */
export const WALK_SPEED = 16;

const WILD_STEPS = 24;

export class Visor {
  private capas: Capa[] = [];
  private capasKey = '';
  private colored = new Map<string, PixelBuffer>();
  private colorKey = '';
  private sky: PixelBuffer | null = null;
  private skyKey = '';
  private nubes: Nubes;
  private lluvia: Lluvia;
  private gente = new Gente();
  readonly buf: PixelBuffer;
  private travel = 0;
  private last = -1;
  private seed = 0;
  private img: ImageData | null = null;

  constructor(readonly e: Encuadre) {
    this.buf = new PixelBuffer(e.w, e.h);
    this.nubes = new Nubes(e, 7);
    this.lluvia = new Lluvia(e, 11);
  }

  /** Las capas a esta lejanía (en escalones, para no redibujar a cada momento). */
  private layers(wild: number, seed: number): Capa[] {
    const w = Math.round(wild * WILD_STEPS) / WILD_STEPS;
    const key = `${w}:${seed}`;
    if (key !== this.capasKey) {
      this.capasKey = key;
      this.capas = buildCapas(this.e, w, seed);
      this.colorKey = '';
    }
    return this.capas;
  }

  private colorize(capas: Capa[], l: Luz): void {
    const key = `${l.hour.toFixed(1)}:${l.clima.fog.toFixed(2)}:${l.clima.cloud.toFixed(2)}:${l.clima.rain.toFixed(1)}`;
    if (key === this.colorKey) return;
    this.colorKey = key;
    for (const c of capas) {
      const lut = lutOf(l, c.depth);
      let out = this.colored.get(c.id);
      if (!out || out.w !== c.t.w || out.h !== c.t.h) {
        out = new PixelBuffer(c.t.w, c.t.h);
        this.colored.set(c.id, out);
      }
      const d = c.t.d;
      const o = out.data;
      for (let i = 0; i < d.length; i++) o[i] = d[i] ? lut[d[i]!]! : 0;
    }
  }

  /** La luz y el tiempo de ahora. */
  luz(m: MarchNow, f: VisorForce = {}): Luz {
    const hour = f.hour ?? m.hour ?? (m.night ? 23 : 12);
    const clima: Clima = climaOf(
      f.weather ?? m.weather ?? 'claro',
      hour,
      m.wild,
      m.day ?? 1,
      m.seed,
    );
    return luzAt(hour, clima);
  }

  /** Pinta el fotograma del tiempo `time` (segundos) y lo devuelve. */
  frame(m: MarchNow, time: number, f: VisorForce = {}): PixelBuffer {
    const e = this.e;
    const b = this.buf;
    this.seed = hashString(m.seed) % 1000;
    const dt = this.last < 0 ? 0 : Math.min(0.5, Math.max(0, time - this.last));
    this.last = time;
    const walking = m.mode === 'walk';
    const hurt = m.crew.some((c) => c.fate === 'herido');
    const speed = WALK_SPEED * (hurt ? 0.75 : 1);
    if (walking) this.travel += dt * speed * (m.home ? -1 : 1);
    const travel = f.travel ?? this.travel;
    const l = this.luz(m, f);
    const capas = this.layers(m.wild, this.seed);
    this.colorize(capas, l);
    // El cielo.
    const sk = `${l.hour.toFixed(1)}:${l.clima.cloud.toFixed(1)}:${l.clima.rain.toFixed(1)}`;
    if (sk !== this.skyKey || !this.sky) {
      this.skyKey = sk;
      this.sky = skyBuffer(e, l);
    }
    b.data.set(this.sky.data);
    drawStars(b, e, l, time, this.seed);
    drawMoon(b, e, l, m.day ?? 1);
    drawSun(b, e, l);
    const lk = luzKey(l);
    const ctx = { b, e, l, lk, time, travel, m, capas, seed: this.seed, walking };
    const layer = (id: Capa['id']) => {
      const c = capas.find((x) => x.id === id)!;
      blitStrip(b, this.colored.get(id)!, travel * c.speed, c.y);
    };
    layer('lejos');
    this.nubes.draw(b, l, time, travel, 1 + l.clima.rain);
    drawAnimals(ctx, 'cielo');
    layer('sierra');
    drawAnimals(ctx, 'sierra');
    layer('colinas');
    drawAnimals(ctx, 'colinas');
    layer('medio');
    drawAnimals(ctx, 'medio');
    drawMist(b, e, l, time, travel, 'lejos');
    layer('cerca');
    drawAnimals(ctx, 'cerca');
    layer('suelo');
    drawMist(b, e, l, time, travel, 'cerca');
    // La gente.
    const fire = m.mode === 'camp' ? drawCamp(ctx) : null;
    if (m.mode !== 'camp') this.gente.draw(ctx);
    layer('delante');
    this.lluvia.draw(b, l, time, travel);
    if (fire) fireLight(ctx, fire);
    this.gente.overlay(ctx);
    return b;
  }

  /** Pinta en un canvas del tamaño del encuadre. */
  draw(ctx: CanvasRenderingContext2D, m: MarchNow, time: number, f?: VisorForce): void {
    const b = this.frame(m, time, f);
    if (!this.img)
      this.img = new ImageData(new Uint8ClampedArray(b.data.buffer as ArrayBuffer), b.w, b.h);
    ctx.putImageData(this.img, 0, 0);
  }
}

/** Lo salvaje convertido en algo más suave en los extremos (para animales y tiempo). */
export const wildEase = (w: number) => smooth(0, 1, w);
