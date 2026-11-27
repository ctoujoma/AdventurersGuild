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
import { biomaOf, type Bioma } from './bioma';
import { Nubes, drawMoon, drawStars, drawSun, skyBuffer } from './cielo';
import type { Encuadre } from './encuadre';
import { drawCamp, fireLight } from './fuego';
import { Gente } from './gente';
import { luzAt, lutOf, type Clima, type Luz } from './luz';
import type { MarchNow } from './marcha';
import { blitStrip, luzKey } from './pintar';
import { Aire, Lluvia, climaOf, drawMist } from './tiempo';
import { smooth } from './tonos';
import { drawRays, drawVida } from './vida';
import { drawEscondite, drawSuceso, drawSucesoFondo } from './sucesos';

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
/** Segundos que tarda el tiempo en llegar a lo que toca (lluvia, niebla, nubes…). */
const CLIMA_TAU = 6;
/** Segundos del fundido entre un paisaje y el siguiente (al alejarse, mojarse o nevar). */
const FADE = 1.6;
const CLIMA_KEYS = ['rain', 'fog', 'cloud', 'snow', 'wind', 'dust', 'storm'] as const;
/** Bayer 4×4: el fundido por puntos, como se hace en pixel art. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;

export class Visor {
  private capas: Capa[] = [];
  private capasKey = '';
  private colored = new Map<string, PixelBuffer>();
  /** El paisaje de antes, mientras se funde con el nuevo (`fade` de 0 a 1). */
  private prev: { capas: Capa[]; colored: Map<string, PixelBuffer> } | null = null;
  private fade = 1;
  /** El tiempo que se ve: se acerca poco a poco al que toca. */
  private clima: Clima | null = null;
  private colorKey = '';
  private sky: PixelBuffer | null = null;
  private skyKey = '';
  private nubes: Nubes;
  private nubesKey = '';
  private lluvia: Lluvia;
  private aire: Aire;
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
    this.aire = new Aire(e, 13);
  }

  /** Las capas a esta lejanía (en escalones, para no redibujar a cada momento). */
  private layers(wild: number, seed: number, bio: Bioma, snow: number, rain: number): Capa[] {
    const w = Math.round(wild * WILD_STEPS) / WILD_STEPS;
    const sn = Math.round(snow * 4) / 4;
    const wet = rain > 0.05 ? 1 : 0;
    const key = `${w}:${seed}:${bio.id}:${sn}:${wet}`;
    if (key !== this.capasKey) {
      // La primera vez, de golpe; luego, fundido desde lo que se veía.
      if (this.capasKey) {
        this.prev = { capas: this.capas, colored: this.colored };
        this.colored = new Map();
        this.fade = 0;
      }
      this.capasKey = key;
      this.capas = buildCapas(this.e, w, seed, bio.paisaje, { snow: sn, wet });
      this.colorKey = '';
    }
    return this.capas;
  }

  private colorize(capas: Capa[], l: Luz, bio: Bioma): void {
    const key = `${bio.id}:${l.hour.toFixed(1)}:${l.clima.fog.toFixed(2)}:${l.clima.cloud.toFixed(2)}:${l.clima.rain.toFixed(1)}:${(l.clima.dust ?? 0).toFixed(2)}:${(l.clima.storm ?? 0).toFixed(1)}`;
    if (key === this.colorKey) return;
    this.colorKey = key;
    for (const c of capas) {
      const lut = lutOf(l, c.depth, bio.ramps);
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

  /**
   * El tiempo que se ve, acercándose al que toca (`CLIMA_TAU`): la lluvia empieza poco a poco y
   * la niebla entra despacio. El primer fotograma (o con el tiempo forzado), tal cual.
   */
  private smoothed(target: Luz, dt: number, snap: boolean): Luz {
    const cur = this.clima;
    if (!cur || snap || dt <= 0) {
      if (!cur || snap) this.clima = { ...target.clima };
      return cur && !snap ? luzAt(target.hour, cur) : target;
    }
    const k = 1 - Math.exp(-dt / CLIMA_TAU);
    const next: Clima = { ...target.clima };
    for (const key of CLIMA_KEYS) {
      const a = cur[key] ?? 0;
      const b = target.clima[key] ?? 0;
      // Escalones de 0,02 para no recolorear a cada fotograma.
      const v = Math.abs(b - a) < 0.02 ? b : a + (b - a) * k;
      next[key] = v;
    }
    this.clima = next;
    return luzAt(target.hour, next);
  }

  /** Pinta el fotograma del tiempo `time` (segundos) y lo devuelve. */
  frame(m: MarchNow, time: number, f: VisorForce = {}): PixelBuffer {
    const e = this.e;
    const b = this.buf;
    this.seed = hashString(m.seed) % 1000;
    const dt = this.last < 0 ? 0 : Math.min(0.5, Math.max(0, time - this.last));
    this.last = time;
    // Al ganar una pelea se quedan un momento celebrando antes de seguir.
    const walking = m.mode === 'walk' && !this.gente.holds(m, time);
    const hurt = m.crew.some((c) => c.fate === 'herido');
    const speed = WALK_SPEED * (hurt ? 0.75 : 1);
    if (walking) this.travel += dt * speed * (m.home ? -1 : 1);
    const travel = f.travel ?? this.travel;
    const l = this.smoothed(this.luz(m, f), dt, !!f.weather);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / FADE);
      if (this.fade >= 1) this.prev = null;
    }
    const bio = biomaOf(m.terrain);
    const capas = this.layers(m.wild, this.seed, bio, l.clima.snow ?? 0, l.clima.rain);
    this.colorize(capas, l, bio);
    // El cielo.
    const sk = `${l.hour.toFixed(1)}:${l.clima.cloud.toFixed(1)}:${l.clima.rain.toFixed(1)}:${(l.clima.dust ?? 0).toFixed(1)}`;
    if (sk !== this.skyKey || !this.sky) {
      this.skyKey = sk;
      this.sky = skyBuffer(e, l);
    }
    b.data.set(this.sky.data);
    // Las nubes, repartidas por la semilla y el día (cada día, su cielo).
    const nk = `${this.seed}:${m.day ?? 1}`;
    if (nk !== this.nubesKey) {
      this.nubesKey = nk;
      this.nubes = new Nubes(e, 7 + ((this.seed * 31 + (m.day ?? 1) * 101) % 997));
    }
    drawStars(b, e, l, time, this.seed);
    drawMoon(b, e, l, m.day ?? 1);
    drawSun(b, e, l);
    const lk = luzKey(l);
    const ctx = { b, e, l, lk, time, travel, m, capas, seed: this.seed, walking };
    const layer = (id: Capa['id']) => {
      const c = capas.find((x) => x.id === id);
      const old = this.prev?.capas.find((x) => x.id === id);
      const fade = this.fade;
      if (old && this.prev && fade < 1) {
        const ob = this.prev.colored.get(id);
        if (ob) blitStrip(b, ob, travel * old.speed, old.y, (x, y) => bayer(x, y) >= fade);
        if (c)
          blitStrip(b, this.colored.get(id)!, travel * c.speed, c.y, (x, y) => bayer(x, y) < fade);
        return;
      }
      if (!c) return;
      blitStrip(b, this.colored.get(id)!, travel * c.speed, c.y);
    };
    layer('lejos');
    this.nubes.draw(b, l, time, travel, 1 + l.clima.rain + (l.clima.wind ?? 0) * 5);
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
    drawSucesoFondo(ctx);
    layer('suelo');
    drawVida(ctx);
    drawSuceso(ctx);
    drawMist(b, e, l, time, travel, 'cerca');
    // La gente.
    const fire = m.mode === 'camp' ? drawCamp(ctx) : null;
    if (m.mode !== 'camp') this.gente.draw(ctx);
    drawEscondite(ctx);
    layer('delante');
    layer('copas');
    drawRays(ctx);
    this.lluvia.draw(b, l, time, travel);
    this.aire.draw(b, l, time, travel, bio.id === 'sierra');
    if (fire) fireLight(ctx, fire);
    this.gente.overlay(ctx);
    // El golpe de un grande: todo el cuadro tiembla un píxel.
    if (this.gente.shake) shiftY(b, this.gente.shake);
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

/** Corre el cuadro `dy` píxeles en vertical (repite la fila del borde). */
function shiftY(b: PixelBuffer, dy: number): void {
  const w = b.w;
  if (dy > 0) {
    b.data.copyWithin(dy * w, 0, (b.h - dy) * w);
  } else {
    b.data.copyWithin(0, -dy * w, b.h * w);
    b.data.copyWithin((b.h + dy) * w, (b.h + dy - 1) * w, (b.h + dy) * w);
  }
}
