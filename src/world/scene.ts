import { bufferCanvas, drawBuffer } from '../art/canvas';
import { FEET_Y, heroSprites, type HeroSprites } from '../art/heroes/hero';
import { generateLook, type HeroLook, type HeroMarks } from '../art/heroes/look';
import type { TrophyIcon } from '../core/model';
import type { GearView } from './annex';
import { P } from '../art/palette';
import { PixelBuffer, alpha } from '../art/pixel';
import { UNCLE, buildWorld, type WorldBuild } from './build';
import { Camera } from './camera';
import { BAT_FRAMES, CAT_FRAMES, OWL_FRAMES, RAT_FRAMES, flagFrame } from './creatures';
import {
  B,
  BAR_SPOTS,
  F,
  FIRE_SPOT,
  GROUND,
  HALL_WALK,
  KEEPER_RANGE,
  ROOF,
  WORLD_H,
  SPAN,
  WORLD_X0,
  hotspots,
  roofTop,
  sickbeds,
  type Facilities,
  type HotspotDef,
} from './geometry';
import { ambientCanvas, glowSprite, lightSprite, shaftSprite } from './lighting';
import { buildSky, parallaxLayers, stars, type ParallaxLayer, type Star } from './parallax';
import { Particles } from './particles';
import { BATTLE_TIME, Battle, type BattleSound } from './battle';
import * as Prop from './props';

export type HeroStatus = 'ok' | 'herido' | 'mision' | 'candidato';

export interface SceneHero {
  id: string;
  name: string;
  status: HeroStatus;
  look: HeroLook;
  marks: HeroMarks;
}

export interface SceneModel {
  fac: Facilities;
  quests: number;
  loot: number;
  /** Caídos: una vela por cada uno en la capilla. */
  fallen: number;
  /** Escudo del gremio (letrero), personal contratado y perro guardián. */
  crest: { field: string; dark: string; symbol: string };
  staff: string[];
  dog: boolean;
  /** Decoración del salón, cuervo y fiesta de la comarca (el día o ya montada). */
  decor: string[];
  raven: boolean;
  feast: 'no' | 'dia' | 'montada';
  /** Equipo sin dueño (tablero de la bodega) y trofeos de la sala. */
  gear: GearView[];
  trophies: TrophyIcon[];
  heroes: SceneHero[];
}

export type SoundName =
  | 'click'
  | 'purr'
  | 'hoot'
  | 'sparks'
  | 'lute'
  | 'splash'
  | 'creak'
  | 'squeak'
  | 'bats'
  | 'build'
  | 'drip'
  | 'cheer'
  | BattleSound;

export interface Point {
  x: number;
  y: number;
  /** Punto del mundo (para anclar bocadillos a lo que se ha tocado). */
  wx?: number;
  wy?: number;
}

export interface SceneCallbacks {
  onHotspot?(id: string, label: string, at: Point): void;
  onHero?(id: string, at: Point): void;
  onHover?(label: string | null, at: Point | null): void;
  onSound?(name: SoundName, volume?: number): void;
  onFrame?(listener: Point): void;
}

export const ROOM_CENTERS: Record<string, Point> = {
  dormitorios: { x: 170, y: 182 },
  enfermeria: { x: 300, y: 182 },
  sala: { x: 262, y: 258 },
  tablon: { x: 240, y: 246 },
  barra: { x: 160, y: 262 },
  bodega: { x: 262, y: 326 },
  cofres: { x: 280, y: 330 },
  despacho: { x: 264, y: 104 },
  rellano: { x: 396, y: 180 },
  exterior: { x: 60, y: 250 },
  patio: { x: 10, y: 262 },
  camino: { x: -64, y: 262 },
  forja: { x: 542, y: 270 },
  establo: { x: 604, y: 268 },
  'patio-entreno': { x: -84, y: 280 },
  empalizada: { x: -100, y: 278 },
  torre: { x: -112, y: 220 },
  veteranos: { x: 464, y: 176 },
  puerta: { x: 130, y: 262 },
  armeria: { x: 312, y: 330 },
  capilla: { x: 468, y: 262 },
};

/** Puerta de la calle: por aquí salen los grupos y vuelven de las misiones. */
const DOOR_X = B.left + 2;
/** Hasta dónde andan por el patio antes de perderse en la noche. */
const YARD_END = -112;
const TRIP_SPEED = 44;

/** Altura de los pies: el patio queda un escalón por debajo de la sala. */
/** Duración de un día de juego en segundos de escena (hasta que se hace de noche). */
const DAY_LENGTH = 300;
/** Luz con la que acaba el amanecer y empieza la mañana. */
const DAWN_LIGHT = 0.65;

function feetAt(x: number): number {
  if (x >= DOOR_X) return F.hall.floor;
  if (x <= DOOR_X - 6) return GROUND;
  return Math.round(F.hall.floor + ((DOOR_X - x) / 6) * (GROUND - F.hall.floor));
}

type Activity = 'idle' | 'walk' | 'sit' | 'fire';

interface HeroActor {
  hero: SceneHero;
  spr: HeroSprites;
  x: number;
  act: Activity;
  next: Activity;
  target: number;
  timer: number;
  dir: 1 | -1;
  seat: number;
  dist: number;
  blinkAt: number;
  /** Saliendo hacia una misión o volviendo de ella. */
  trip: 'out' | 'in' | null;
}

interface Drawn {
  kind: 'hero' | 'cat' | 'owl' | 'bat' | 'rat';
  id: string;
  label: string;
  x: number;
  y: number;
  img: PixelBuffer;
  flip: boolean;
}

const noise = (a: number, b: number) => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};

const BLANKETS: Record<string, PixelBuffer> = {};
function blanket(w: number, ramp: readonly string[]): PixelBuffer {
  const key = `${w}:${ramp.join()}`;
  if (!BLANKETS[key]) {
    BLANKETS[key] = Prop.piece(w, 5, (b) => {
      b.rect(0, 1, w, 4, ramp[2]!);
      b.hline(1, 0, w - 2, ramp[2]!);
      b.hline(1, 1, w - 3, ramp[3]!);
      b.hline(0, 4, w, ramp[1]!);
    });
  }
  return BLANKETS[key]!;
}

export class WorldScene {
  readonly camera = new Camera();
  private ctx: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private world: WorldBuild | null = null;
  private backC: HTMLCanvasElement | null = null;
  private frontC: HTMLCanvasElement | null = null;
  private outerC: HTMLCanvasElement | null = null;
  private outerFrontC: HTMLCanvasElement | null = null;
  private ambientC: HTMLCanvasElement | null = null;
  private skyC: HTMLCanvasElement;
  private parallax: { c: HTMLCanvasElement; l: ParallaxLayer }[];
  private starList: Star[] = stars();
  private clouds: { x: number; y: number; img: PixelBuffer; speed: number }[];
  private particles = new Particles();
  private heroes = new Map<string, HeroActor>();
  private model: SceneModel | null = null;
  private worldKey = '';
  private spots: HotspotDef[] = [];
  private drawn: Drawn[] = [];
  private hover: { id: string; rect: { x: number; y: number; w: number; h: number } } | null = null;
  private t = 0;
  /** Noche que pasa en escena al terminar el día: oscurece, amanece y vuelve la luz. */
  private night: { start: number; dur: number; hold: number; done: (() => void) | null } | null =
    null;
  /** Asalto que se está viendo en el patio durante la noche. */
  private battle: Battle | null = null;
  /** Velocidad elegida en Ajustes (multiplica el paso del tiempo de la escena). */
  speed = 1;
  /** Cuándo empezó el día en curso (tiempo de escena) y cuánta luz había al caer la noche. */
  private dayStart = 0;
  private dayAtNightfall = 0;
  /** Brindis en curso: los héroes de la sala alzan la jarra hasta este instante. */
  private toastUntil = 0;
  /** Zoom de antes del asalto: la cámara se acerca al patio mientras dura la pelea. */
  private raidZoom: number | null = null;
  private last = 0;
  private raf = 0;
  private keeper = { x: 150, dir: 1 as 1 | -1, target: 150, timer: 2, walking: false, dist: 0 };
  private signImg: PixelBuffer = Prop.signBoard();
  private signKey = '';
  private staffSpr = {
    cocinera: heroSprites(generateLook('cocinera', 'tabernero', 'f'), {}),
    bardo: heroSprites({ ...generateLook('bardo', 'picaro', 'm'), headgear: 'gorra' }, {}),
    mozo: heroSprites({ ...generateLook('mozo', 'explorador', 'm'), headgear: null }, {}),
  };
  private nextNote = 0;
  private keeperSpr = heroSprites(
    { ...UNCLE, hairStyle: 'corto', hairColor: 1, beard: true, skin: 2 },
    {},
  );
  private cat = {
    x: 334,
    state: 'sleep' as 'sleep' | 'sit' | 'walk',
    target: 334,
    timer: 20,
    dir: 1 as 1 | -1,
    dist: 0,
  };
  private owl = { blinkAt: 2, lookUntil: 0 };
  private bats = [
    { x: 214, y: 93, hx: 214, flyUntil: 0, seed: 1 },
    { x: 226, y: 93, hx: 226, flyUntil: 0, seed: 2 },
  ];
  private rat = { x: 419, active: false, dir: -1 as 1 | -1, next: 12 };
  private sign = { kick: 0 };
  private marker: { id: string; until: number } | null = null;
  private timers = {
    smoke: 0,
    ember: 0,
    steam: 0,
    drip: 2,
    leaf: 3,
    zzz: 0,
    dust: 0,
    shooting: 14,
  };
  private shooting: { x: number; y: number; life: number } | null = null;
  private pointers = new Map<number, Point>();
  private press: { x: number; y: number; moved: boolean; time: number } | null = null;
  private pinch = 0;
  private cssW = 0;
  private cssH = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: SceneCallbacks = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.skyC = bufferCanvas(buildSky());
    this.parallax = parallaxLayers().map((l) => ({ c: bufferCanvas(l.buf), l }));
    this.clouds = [0, 1, 2, 3].map((i) => ({
      x: i * 150 + 20,
      y: 30 + ((i * 37) % 80),
      img: cloud(i),
      speed: 2 + i,
    }));
    this.camera.centerOn(250, 244, false);
    for (let i = 0; i < 12; i++) {
      const left = i % 3 === 0;
      this.particles.spawn(
        'firefly',
        left ? 10 + Math.random() * 70 : 436 + Math.random() * 70,
        228 + Math.random() * 64,
      );
    }
    for (let i = 0; i < 3; i++) this.particles.spawn('moth', 89, 247, { ax: 89, ay: 247 });
    this.bindInput();
  }

  // ---------- API ----------

  setModel(model: SceneModel): void {
    const prev = this.model;
    this.model = model;
    const key = JSON.stringify([
      model.fac,
      model.loot,
      model.quests,
      model.fallen,
      model.gear,
      model.trophies,
    ]);
    if (key !== this.worldKey) {
      this.worldKey = key;
      this.world = buildWorld(model.fac, model.loot, model.quests, model.fallen, {
        gear: model.gear,
        trophies: model.trophies,
      });
      this.backC = bufferCanvas(this.world.back);
      this.frontC = bufferCanvas(this.world.front);
      this.outerC = bufferCanvas(this.world.outer.back);
      this.outerFrontC = bufferCanvas(this.world.outer.front);
      this.ambientC = ambientCanvas(this.world.ambient);
      this.spots = hotspots(model.fac, model.trophies.length);
      if (prev) this.celebrateUpgrades(prev.fac, model.fac);
    }
    const sk = JSON.stringify(model.crest);
    if (sk !== this.signKey) {
      this.signKey = sk;
      this.signImg = Prop.crestBoard(model.crest.field, model.crest.dark, model.crest.symbol);
    }
    // Héroes: crear, actualizar o quitar.
    for (const id of [...this.heroes.keys()])
      if (!model.heroes.some((h) => h.id === id)) this.heroes.delete(id);
    for (const h of model.heroes) {
      const a = this.heroes.get(h.id);
      const spr = heroSprites(h.look, h.marks);
      if (a) {
        const was = a.hero.status;
        a.hero = h;
        a.spr = spr;
        if (was !== h.status) {
          a.act = 'idle';
          a.timer = 0.5;
          a.seat = -1;
          a.trip = null;
          if (h.status === 'candidato') a.x = BAR_SPOTS[0]!;
          if (h.status === 'mision' && was === 'ok') {
            // Recoge sus cosas y sale por la puerta hasta perderse en la noche.
            a.trip = 'out';
            a.act = 'walk';
            a.target = YARD_END;
            a.next = 'idle';
          } else if (h.status === 'ok' && was === 'mision') {
            a.trip = 'in';
            a.x = YARD_END;
            a.act = 'walk';
            a.target = HALL_WALK.min + Math.random() * 40;
            a.next = 'idle';
          }
        }
      } else {
        const x = HALL_WALK.min + Math.random() * (HALL_WALK.max - HALL_WALK.min);
        this.heroes.set(h.id, {
          hero: h,
          spr,
          x,
          act: 'idle',
          next: 'idle',
          target: x,
          timer: Math.random() * 3,
          dir: 1,
          seat: -1,
          dist: 0,
          blinkAt: Math.random() * 4,
          trip: null,
        });
      }
    }
  }

  resize(cssW: number, cssH: number, zoom?: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    // Nunca más pequeño que el mundo: la vista siempre queda llena. El zoom más lejano
    // puede ser fraccionario (encaja el mundo justo); los demás pasos son enteros.
    const minZoom = this.minZoom(cssW, cssH);
    const z = Math.max(
      minZoom,
      zoom ?? Math.max(2, Math.ceil(minZoom), Math.floor(Math.min(cssW / 180, cssH / 230))),
    );
    this.camera.setView(cssW, cssH, z);
    this.canvas.width = this.camera.vw;
    this.canvas.height = this.camera.vh;
    this.canvas.style.width = `${this.camera.vw * z}px`;
    this.canvas.style.height = `${this.camera.vh * z}px`;
    this.light.width = this.camera.vw;
    this.light.height = this.camera.vh;
    this.ctx.imageSmoothingEnabled = false;
  }

  private minZoom(cssW: number, cssH: number): number {
    return Math.max(1, Math.ceil(Math.max(cssW / SPAN, cssH / WORLD_H) * 100) / 100);
  }

  zoomBy(step: number): void {
    const min = this.minZoom(this.cssW, this.cssH);
    const cur = this.camera.zoom;
    // Pasos enteros y, por debajo del primero que llena la vista, el zoom que encaja todo.
    const z =
      step > 0
        ? Math.min(6, Math.floor(cur) + 1)
        : Math.max(min, Number.isInteger(cur) ? cur - 1 : Math.floor(cur));
    if (z !== cur) this.resize(this.cssW, this.cssH, z);
  }

  /** Posición en pantalla (px CSS) de un punto del mundo. */
  screenOf(wx: number, wy: number): Point {
    return this.camera.toScreen(wx, wy);
  }

  focus(room: keyof typeof ROOM_CENTERS | string): void {
    const p = ROOM_CENTERS[room];
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

  /** Dónde está ahora un héroe (para centrar la cámara y señalarlo). */
  heroPosition(id: string): Point | null {
    const a = this.heroes.get(id);
    if (!a || !this.model || !this.world) return null;
    const same = (st: HeroStatus) =>
      this.model!.heroes.filter((h) => h.status === st).findIndex((h) => h.id === id);
    switch (a.hero.status) {
      case 'ok':
        return a.act === 'sit' && a.seat >= 0
          ? { x: this.world.layout.seats[a.seat]!.x, y: F.hall.floor - 26 }
          : { x: a.x, y: F.hall.floor - 24 };
      case 'candidato': {
        const i = same('candidato');
        return i >= 0 && i < BAR_SPOTS.length ? { x: BAR_SPOTS[i]!, y: F.hall.floor - 24 } : null;
      }
      case 'herido': {
        const beds = sickbeds(this.model.fac);
        const i = same('herido');
        return i >= 0 && i < beds.length ? { x: beds[i]!.x + 4, y: F.upper.floor - 28 } : null;
      }
      default:
        return null;
    }
  }

  /** Centra la cámara en un héroe y le pone una flecha encima un rato. */
  focusHero(id: string): boolean {
    const p = this.heroPosition(id);
    if (!p) return false;
    this.camera.centerOn(p.x, p.y + 10);
    this.marker = { id, until: this.t + 4 };
    return true;
  }

  /**
   * Pasa la noche en la escena: la taberna se apaga, el cielo clarea por el horizonte y
   * `done` se llama al salir el sol (ahí se abre el resumen del amanecer).
   */
  nightfall(done: () => void, dur = 2.6, hold = 0): void {
    this.night?.done?.();
    this.dayAtNightfall = this.daylight().day;
    this.night = { start: this.t, dur, hold, done };
  }

  /** Noche con asalto: la pelea en el patio y, al acabar, el amanecer. */
  raidNight(
    raid: { won: boolean; bandits: number; defenders: string[]; hurt: string[] },
    done: () => void,
  ): void {
    const defenders = raid.defenders
      .map((id) => this.heroes.get(id))
      .filter((a): a is HeroActor => !!a)
      .map((a) => ({
        id: a.hero.id,
        look: a.hero.look,
        marks: a.hero.marks,
        hurt: raid.hurt.includes(a.hero.id),
      }));
    this.battle = new Battle(
      { won: raid.won, bandits: raid.bandits, defenders },
      {
        feetAt,
        burst: (kind, x, y, n) => {
          for (let i = 0; i < n; i++) this.particles.spawn(kind, x, y);
        },
        coin: (x, y) => {
          for (let i = 0; i < 8; i++) this.particles.spawn('coin', x, y);
        },
        sound: (n, v) => this.cb.onSound?.(n, v ?? 1),
      },
    );
    this.raidZoom = this.camera.zoom;
    this.resize(this.cssW, this.cssH, Math.min(6, Math.floor(this.camera.zoom) + 1));
    this.camera.centerOn(-52, 262);
    this.nightfall(done, 2.6, BATTLE_TIME + 0.6);
  }

  /** Guirnalda de banderines entre dos puntos, con su comba. */
  private bunting(
    x0: number,
    x1: number,
    y: number,
    sag: number,
    colors: readonly string[],
    cx: number,
    cy: number,
  ): void {
    const ctx = this.ctx;
    const yAt = (x: number) => Math.round(y + sag * Math.sin((Math.PI * (x - x0)) / (x1 - x0)));
    ctx.fillStyle = P.bark;
    for (let x = x0; x <= x1; x++) ctx.fillRect(x - cx, yAt(x) - cy, 1, 1);
    let i = 0;
    for (let x = x0 + 3; x < x1 - 3; x += 7, i++) {
      ctx.fillStyle = colors[i % colors.length]!;
      const top = yAt(x + 2) + 1;
      for (let r = 0; r < 4; r++) ctx.fillRect(x + r / 2 - cx, top + r - cy, 5 - r, 1);
    }
  }

  /** Decoración del salón, la fiesta de la comarca y sus confetis. */
  private drawDecor(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    if (!this.model) return;
    const { decor, crest, feast } = this.model;
    const floor = F.hall.floor;
    const px = (x: number, y: number, c: string, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - cx, y - cy, w, h);
    };
    if (decor.includes('tapices'))
      this.bunting(196, 316, F.hall.top + 2, 4, [crest.field, P.gold, crest.dark], cx, cy);
    if (decor.includes('tarima')) {
      px(292, floor - 3, P.clay, 26, 1);
      px(292, floor - 2, P.rust, 26, 2);
      for (let x = 296; x < 318; x += 6) px(x, floor - 2, P.bark, 1, 2);
    }
    if (decor.includes('naipes')) {
      // Cartas y monedas en la primera mesa.
      const tx = 236;
      const ty = floor - 16;
      px(tx - 9, ty, P.white, 2, 3);
      px(tx - 6, ty - 1, P.white, 2, 3);
      px(tx - 8, ty + 1, P.red);
      px(tx - 5, ty, P.black);
      px(tx - 12, ty + 1, P.gold, 2, 2);
      px(tx - 12, ty, P.lemon, 2, 1);
    }
    if (decor.includes('barril')) {
      // Barrilito con espita sobre la barra.
      const bx = 186;
      const by = floor - 30;
      px(bx, by, P.oak, 9, 8);
      px(bx, by + 1, P.steel, 9, 1);
      px(bx, by + 6, P.steel, 9, 1);
      px(bx + 1, by, P.clay, 7, 1);
      px(bx + 9, by + 4, P.gold, 2, 1);
      px(bx + 10, by + 5, P.gold, 1, 1);
    }
    if (feast === 'no') return;
    const party = [P.red, P.gold, P.sky, P.lime, P.rose];
    // El pueblo está de fiesta: banderines y farolillos sobre la puerta.
    this.bunting(4, 94, 206, 6, party, cx, cy);
    for (const [lx, ly] of [
      [22, 210],
      [48, 212],
      [74, 210],
    ] as const) {
      px(lx, ly, P.bark, 1, 2);
      px(lx - 2, ly + 2, Math.sin(t * 3 + lx) > 0 ? P.orange : P.red, 5, 5);
      px(lx - 1, ly + 3, P.lemon, 3, 3);
    }
    if (feast === 'montada') {
      this.bunting(106, 196, F.hall.top + 3, 5, party, cx, cy);
      this.bunting(316, 420, F.hall.top + 3, 5, party, cx, cy);
      if (Math.random() < 0.12)
        this.particles.spawn('spark', 140 + Math.random() * 260, F.hall.top + 6, { vy: 6 });
    }
  }

  /** Saltar la pelea: se pasa directamente al amanecer. */
  skipRaid(): void {
    if (!this.battle || !this.night) return;
    this.battle.finish();
    const a = 0.35 * this.night.dur;
    this.night.start = this.t - a - this.night.hold;
  }

  /** Avance de la noche en la escala original (0–1.8), con la meseta oscura alargada. */
  private nightP(): number {
    const n = this.night!;
    const te = this.t - n.start;
    const a = 0.35 * n.dur;
    const plateau = n.hold > 0 ? n.hold : 0.15 * n.dur;
    if (te < a) return te / n.dur;
    if (te < a + plateau) return 0.35 + (0.15 * (te - a)) / plateau;
    return 0.5 + (te - a - plateau) / n.dur;
  }

  /** Celebración en la barra cuando un grupo vuelve con éxito: notas, monedas y brindis. */
  cheer(room = 'barra'): void {
    const p = ROOM_CENTERS[room];
    if (!p) return;
    for (let i = 0; i < 12; i++)
      this.particles.spawn('note', p.x + (Math.random() - 0.5) * 70, p.y - 6 - Math.random() * 14);
    for (let i = 0; i < 6; i++)
      this.particles.spawn('heart', p.x + (Math.random() - 0.5) * 50, p.y - 4 - Math.random() * 10);
    for (let i = 0; i < 14; i++)
      this.particles.spawn('coin', p.x + (Math.random() - 0.5) * 60, p.y - Math.random() * 16);
    this.cb.onSound?.('cheer');
    this.toastUntil = this.t + 3.4;
    // Los que pasean por la sala se paran a brindar.
    for (const a of this.heroes.values())
      if (a.act === 'walk' && !a.trip && feetAt(a.x) === F.hall.floor) {
        a.act = 'idle';
        a.target = a.x;
        a.timer = 3.6;
      }
  }

  /** Luz de la noche que pasa: oscuridad (0–1) y calor del amanecer (0–1). */
  private nightLight(): { dark: number; warm: number } {
    const n = this.night;
    if (!n) return { dark: 0, warm: 0 };
    const p = this.nightP();
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));
    // Durante un asalto la noche no es tan cerrada: hay que ver la pelea.
    const dark = ramp(0, 0.35) * (1 - ramp(0.5, 0.9)) * (this.battle ? 0.55 : 1);
    const warm = ramp(0.45, 0.9) * (1 - ramp(1.05, 1.8));
    return { dark, warm };
  }

  /**
   * Luz del día (0 noche – 1 pleno día) y del atardecer (0–1). El día avanza solo mientras
   * juegas: mañana, mediodía, tarde, atardecer y noche, que se queda hasta terminar el día.
   * Al caer la noche (fin del día) la luz se apaga y con el amanecer vuelve a subir.
   */
  daylight(): { day: number; dusk: number; tod: number } {
    const smooth = (k: number) => k * k * (3 - 2 * k);
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

  /** Cielo de día por encima del de noche: azul, con el sol cruzando y nubes claras. */
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
    // El sol: sale por la derecha, cruza alto y se pone por la izquierda.
    const sunUp = Math.max(d.day, d.dusk);
    if (sunUp <= 0 || d.tod >= 0.97) return;
    const a = Math.PI * Math.min(1, d.tod / 0.95);
    const sx = Math.round(560 - (560 + 60) * (d.tod / 0.95) - cx * 0.08);
    const sy = Math.round(horizon + 10 - Math.sin(a) * 120);
    const warmSun = d.dusk > 0.3;
    ctx.globalAlpha = Math.min(1, sunUp * 1.3);
    // El halo es un foco aditivo (fondo negro): se suma al cielo, no se pinta encima.
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
    ctx.fillStyle = warmSun ? P.lemon : P.white;
    for (let y = -4; y <= 2; y++) {
      const w = Math.floor(Math.sqrt(16 - (y + 1) * (y + 1)));
      ctx.fillRect(sx - w - 1, sy + y - 1, w * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Cielo del amanecer: resplandor en el horizonte y el sol asomando por la derecha. */
  private drawDawnSky(warm: number, cx: number, cy: number, vw: number, vh: number): void {
    const ctx = this.ctx;
    const horizon = GROUND - 40 - cy;
    const g = ctx.createLinearGradient(0, horizon - 200, 0, horizon + 20);
    g.addColorStop(0, 'rgba(90, 60, 120, 0)');
    g.addColorStop(0.55, `rgba(232, 110, 120, ${0.45 * warm})`);
    g.addColorStop(1, `rgba(254, 174, 52, ${0.8 * warm})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    // Sol tramado: sube unos píxeles mientras dura el amanecer.
    const sx = Math.round(470 - cx * 0.08);
    const sy = Math.round(horizon + 18 - warm * 26);
    ctx.globalAlpha = Math.min(1, warm * 1.4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(28, [254, 174, 52], 0.5), sx - 28, sy - 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.lemon;
    for (let y = -9; y <= 9; y++) {
      const w = Math.floor(Math.sqrt(81 - y * y));
      ctx.fillRect(sx - w, sy + y, w * 2 + 1, 1);
    }
    ctx.fillStyle = P.white;
    for (let y = -5; y <= 3; y++) {
      const w = Math.floor(Math.sqrt(25 - (y + 1) * (y + 1)));
      ctx.fillRect(sx - w - 1, sy + y - 1, w * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Efecto de obra en una habitación (al mejorar). */
  celebrate(room: string): void {
    const p = ROOM_CENTERS[room];
    if (!p) return;
    for (let i = 0; i < 26; i++)
      this.particles.spawn('puff', p.x + (Math.random() - 0.5) * 80, p.y + 10 + Math.random() * 20);
    for (let i = 0; i < 10; i++)
      this.particles.spawn('coin', p.x + (Math.random() - 0.5) * 60, p.y + Math.random() * 20);
    this.cb.onSound?.('build');
  }

  // ---------- Simulación ----------

  private celebrateUpgrades(a: Facilities, b: Facilities): void {
    if (b.dorm > a.dorm) this.celebrate('dormitorios');
    if (b.enf > a.enf) this.celebrate('enfermeria');
    if (b.tab > a.tab) this.celebrate('sala');
    if (b.mapas > a.mapas) this.celebrate('despacho');
    if (b.arm > a.arm) this.celebrate('armeria');
    if (b.cap > a.cap) this.celebrate('capilla');
    if (b.forja > a.forja) this.celebrate('forja');
    if (b.establo > a.establo) this.celebrate('establo');
    if (b.patio > a.patio) this.celebrate('patio-entreno');
    if (b.empal > a.empal) this.celebrate('empalizada');
    if (b.torre > a.torre) this.celebrate('torre');
  }

  private update(dt: number): void {
    this.t += dt;
    const t = this.t;
    if (this.battle) {
      this.battle.update(dt);
      if (this.battle.done) {
        this.battle = null;
        if (this.raidZoom !== null) this.resize(this.cssW, this.cssH, this.raidZoom);
        this.raidZoom = null;
      }
    }
    if (this.night) {
      const p = this.nightP();
      if (p >= 0.85 && this.night.done) {
        const done = this.night.done;
        this.night.done = null;
        done();
      }
      if (p >= 1.8) {
        this.night = null;
        this.dayStart = t;
      }
    }
    this.camera.update(dt);
    if (!this.world || !this.model) return;
    const W = this.world;

    // Héroes de la sala.
    const seatsTaken = new Set(
      [...this.heroes.values()].filter((a) => a.seat >= 0).map((a) => a.seat),
    );
    for (const a of this.heroes.values()) {
      if (a.hero.status !== 'ok' && a.trip !== 'out') continue;
      a.timer -= dt;
      if (a.act === 'walk') {
        const step = (a.trip ? TRIP_SPEED : 20) * dt * Math.sign(a.target - a.x);
        if (a.trip && Math.sign(a.x - DOOR_X) !== Math.sign(a.x + step - DOOR_X))
          this.cb.onSound?.('creak', 0.7);
        if (Math.abs(a.target - a.x) <= Math.abs(step)) {
          a.x = a.target;
          a.trip = null;
          a.act = a.next;
          a.timer =
            a.act === 'sit'
              ? 8 + Math.random() * 10
              : a.act === 'fire'
                ? 5 + Math.random() * 5
                : 2 + Math.random() * 4;
        } else {
          a.x += step;
          a.dist += Math.abs(step);
          a.dir = step > 0 ? 1 : -1;
        }
      } else if (a.timer <= 0) {
        if (a.seat >= 0) seatsTaken.delete(a.seat);
        a.seat = -1;
        const r = Math.random();
        const seats = W.layout.seats;
        const free = seats.map((_, i) => i).filter((i) => !seatsTaken.has(i));
        if (r < 0.4 && free.length) {
          a.seat = free[Math.floor(Math.random() * free.length)]!;
          seatsTaken.add(a.seat);
          a.target = seats[a.seat]!.x;
          a.next = 'sit';
        } else if (r < 0.62 && W.layout.fire !== 'apagado') {
          a.target = FIRE_SPOT - Math.random() * 10;
          a.next = 'fire';
        } else {
          a.target = HALL_WALK.min + Math.random() * (HALL_WALK.max - HALL_WALK.min);
          a.next = 'idle';
        }
        a.act = 'walk';
      }
    }

    // Tabernero.
    const k = this.keeper;
    k.timer -= dt;
    if (k.walking) {
      const step = 14 * dt * Math.sign(k.target - k.x);
      if (Math.abs(k.target - k.x) <= Math.abs(step)) {
        k.x = k.target;
        k.walking = false;
        k.timer = 3 + Math.random() * 5;
      } else {
        k.x += step;
        k.dist += Math.abs(step);
        k.dir = step > 0 ? 1 : -1;
      }
    } else if (k.timer <= 0) {
      k.target = KEEPER_RANGE.min + Math.random() * (KEEPER_RANGE.max - KEEPER_RANGE.min);
      k.walking = true;
    }

    // Gato.
    const c = this.cat;
    c.timer -= dt;
    if (c.state === 'walk') {
      const step = 16 * dt * Math.sign(c.target - c.x);
      if (Math.abs(c.target - c.x) <= Math.abs(step)) {
        c.x = c.target;
        c.state = Math.abs(c.x - 334) < 1 ? 'sleep' : 'sit';
        c.timer = c.state === 'sleep' ? 25 + Math.random() * 30 : 4 + Math.random() * 5;
      } else {
        c.x += step;
        c.dist += Math.abs(step);
        c.dir = step > 0 ? 1 : -1;
      }
    } else if (c.timer <= 0) {
      if (c.state === 'sleep') {
        c.state = 'sit';
        c.timer = 3;
      } else {
        c.target = Math.random() < 0.45 ? 334 : 200 + Math.random() * 110;
        c.state = 'walk';
      }
    }

    // Búho.
    if (t > this.owl.blinkAt) this.owl.blinkAt = t + 2.5 + Math.random() * 4;

    // Murciélagos.
    for (const b of this.bats) {
      if (t < b.flyUntil) {
        const p = t * 2.4 + b.seed * 2;
        b.x = 200 + Math.sin(p) * 80 + Math.sin(p * 2.3) * 20;
        b.y = 100 + Math.cos(p * 1.3) * 14;
      } else {
        b.x += (b.hx - b.x) * Math.min(1, dt * 4);
        b.y += (93 - b.y) * Math.min(1, dt * 4);
      }
    }

    // Rata.
    const rt = this.rat;
    rt.next -= dt;
    if (!rt.active && rt.next <= 0) {
      rt.active = true;
      rt.dir = -1;
    }
    if (rt.active) {
      rt.x += rt.dir * 46 * dt;
      if (rt.x < 342) rt.dir = 1;
      if (rt.dir === 1 && rt.x >= 419) {
        rt.active = false;
        rt.x = 419;
        rt.next = 18 + Math.random() * 20;
      }
    }

    this.sign.kick *= Math.pow(0.4, dt);

    // Partículas ambientales.
    const T = this.timers;
    T.smoke -= dt;
    if (T.smoke <= 0 && W.layout.fire !== 'apagado') {
      T.smoke = 0.32;
      this.particles.spawn('smoke', 344 + Math.random() * 8, 52);
      if (Math.random() < 0.08) this.particles.spawn('ember', 348, 52, { vy: -18 });
    }
    T.ember -= dt;
    if (T.ember <= 0 && W.layout.fire !== 'apagado') {
      T.ember = W.layout.fire === 'grande' ? 0.12 : 0.22;
      this.particles.spawn(
        'ember',
        W.fire.x + 4 + Math.random() * (W.fire.w - 8),
        F.hall.floor - 10,
        { max: 0.9 + Math.random() * 0.5 },
      );
    }
    T.steam -= dt;
    if (T.steam <= 0 && this.model.fac.tab >= 2) {
      T.steam = 0.4;
      this.particles.spawn('steam', 344 + Math.random() * 8, 270);
    }
    T.drip -= dt;
    if (T.drip <= 0) {
      T.drip = 2.4 + Math.random() * 1.5;
      this.particles.spawn('drip', 282, 303, { vy: 0, ay: 351, vx: 0 });
    }
    T.leaf -= dt;
    if (T.leaf <= 0) {
      T.leaf = 2 + Math.random() * 4;
      this.particles.spawn('leaf', 430 + Math.random() * 80, 130 + Math.random() * 70);
    }
    T.dust -= dt;
    if (T.dust <= 0) {
      T.dust = 0.5;
      for (const s of W.shafts) {
        if (Math.random() < 0.6) {
          const ty = Math.random() * (s.floor - s.y) * 0.7;
          this.particles.spawn(
            'dust',
            s.x + Math.random() * s.w + ty * 0.6,
            s.y + ty + Math.random() * s.h,
          );
        }
      }
    }
    T.zzz -= dt;
    if (T.zzz <= 0) {
      T.zzz = 1.8;
      const beds = sickbeds(this.model.fac);
      this.model.heroes
        .filter((h) => h.status === 'herido')
        .slice(0, beds.length)
        .forEach((_, i) => this.particles.spawn('zzz', beds[i]!.x + 6, F.upper.floor - 30));
    }
    T.shooting -= dt;
    if (T.shooting <= 0) {
      T.shooting = 18 + Math.random() * 25;
      this.shooting = { x: 40 + Math.random() * 300, y: 10 + Math.random() * 60, life: 0.9 };
    }
    if (this.shooting) {
      this.shooting.life -= dt;
      this.shooting.x += 160 * dt;
      this.shooting.y += 60 * dt;
      if (this.shooting.life <= 0) this.shooting = null;
    }

    this.particles.update(dt, t, (p) => {
      if (p.kind === 'drip') {
        for (let i = 0; i < 3; i++) this.particles.spawn('splash', p.x, p.ay - 1);
        this.cb.onSound?.('drip', 0.25);
      }
    });
    this.cb.onFrame?.({
      x: this.camera.x + this.camera.vw / 2,
      y: this.camera.y + this.camera.vh / 2,
    });
  }

  // ---------- Pintado ----------

  private draw(): void {
    const { ctx, camera } = this;
    const W = this.world;
    if (!W || !this.backC || !this.frontC || !this.ambientC || !this.model) return;
    const cx = camera.px;
    const cy = camera.py;
    const vw = camera.vw;
    const vh = camera.vh;
    const t = this.t;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.black;
    ctx.fillRect(0, 0, vw, vh);

    // Cielo, estrellas, estrella fugaz, nubes y capas lejanas.
    const dl = this.daylight();
    ctx.drawImage(this.skyC, WORLD_X0 - Math.round(cx * 0.08), -cy);
    ctx.globalAlpha = Math.max(0, 1 - dl.day * 1.4);
    for (const s of dl.day > 0.7 ? [] : this.starList) {
      const sx = s.x + WORLD_X0 - Math.round(cx * 0.08);
      const sy = s.y - cy;
      if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
      const tw = noise(s.x, Math.floor(t * 1.5 + s.y));
      if (!s.bright && tw < 0.25) continue;
      ctx.fillStyle = s.bright && tw > 0.6 ? P.white : tw > 0.5 ? P.mist : P.fog;
      ctx.fillRect(sx, sy, 1, 1);
      if (s.bright && tw > 0.85) {
        ctx.fillStyle = P.fog;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillStyle = P.white;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    this.drawDaySky(dl, cx, cy, vw, vh);
    if (this.shooting && dl.day < 0.3) {
      const s = this.shooting;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i < 2 ? P.white : i < 5 ? P.mist : P.fog;
        ctx.fillRect(Math.round(s.x - i * 2.6 - cx * 0.08), Math.round(s.y - i - cy), 1, 1);
      }
    }
    for (const cl of this.clouds) {
      const x = ((cl.x + t * cl.speed) % (SPAN + 80)) - 60 + WORLD_X0 - cx * 0.15;
      drawBuffer(ctx, cl.img, x, cl.y - cy);
    }
    const { dark, warm } = this.nightLight();
    if (warm > 0) this.drawDawnSky(warm, cx, cy, vw, vh);
    for (const { c, l } of this.parallax) {
      ctx.drawImage(c, WORLD_X0 - Math.round(cx * l.fx), -cy);
    }
    if (dl.day > 0 || dl.dusk > 0) {
      // De día, las montañas y la arboleda se aclaran con la luz y la distancia.
      ctx.globalCompositeOperation = 'screen';
      const h = (v: number) => Math.round(v * dl.day + v * 0.4 * dl.dusk);
      ctx.fillStyle = `rgb(${h(70) + Math.round(60 * dl.dusk)}, ${h(105)}, ${h(120)})`;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Mundo (fondo) + elementos exteriores animados.
    if (this.outerC) ctx.drawImage(this.outerC, WORLD_X0 - cx, -cy);
    ctx.drawImage(this.backC, -cx, -cy);
    const drawn: Drawn[] = [];
    const at = (img: PixelBuffer, x: number, y: number, flip = false) =>
      drawBuffer(ctx, img, x - cx, y - cy, flip);

    // Banderín y búho en el tejado.
    at(flagFrame(t, this.model.crest.field, this.model.crest.dark), ROOF.apexX, ROOF.apexY - 19);
    const owlImg =
      t < this.owl.lookUntil
        ? OWL_FRAMES.look
        : t > this.owl.blinkAt - 0.15
          ? OWL_FRAMES.blink
          : OWL_FRAMES.open;
    const owlX = 226;
    const owlY = Math.round(roofTop(owlX + 5)) - owlImg.h + 1;
    at(owlImg, owlX, owlY);
    drawn.push({
      kind: 'owl',
      id: 'buho',
      label: 'Un búho',
      x: owlX,
      y: owlY,
      img: owlImg,
      flip: false,
    });

    // Letrero que se balancea.
    const swing = Math.sin(t * 1.3) * 1.2 + this.sign.kick * Math.sin(t * 7);
    const sx = Math.round(60 + swing);
    ctx.fillStyle = P.slate;
    for (const [ax, bx] of [
      [64, sx + 4],
      [88, sx + 27],
    ] as const) {
      for (let i = 0; i <= 8; i++)
        ctx.fillRect(Math.round(ax + ((bx - ax) * i) / 8) - cx, 168 + i - cy, 1, 1);
    }
    at(this.signImg, sx, 176);
    if (this.model.raven) {
      // De vez en cuando sacude las alas.
      const flap = Math.sin(t * 0.7) > 0.93;
      at(Prop.raven(flap && Math.floor(t * 10) % 2 === 0), sx + 11, 169 - (flap ? 1 : 0));
    }

    // Murciélagos del desván.
    for (const b of this.bats) {
      const flying = t < b.flyUntil || Math.abs(b.x - b.hx) > 1;
      const img = flying
        ? Math.floor(t * 12 + b.seed) % 2
          ? BAT_FRAMES.up
          : BAT_FRAMES.down
        : BAT_FRAMES.hang;
      at(img, b.x - 3, b.y);
      drawn.push({
        kind: 'bat',
        id: 'murcielago',
        label: 'Murciélagos',
        x: b.x - 3,
        y: b.y,
        img,
        flip: false,
      });
    }

    // Rata de la bodega.
    if (this.rat.active) {
      const img = RAT_FRAMES[Math.floor(t * 12) % 2]!;
      at(img, this.rat.x - 6, F.cellar.floor - 5, this.rat.dir > 0);
      drawn.push({
        kind: 'rat',
        id: 'rata',
        label: 'Una rata',
        x: this.rat.x - 6,
        y: F.cellar.floor - 5,
        img,
        flip: this.rat.dir > 0,
      });
    }

    // Tabernero detrás de la barra.
    const k = this.keeper;
    const kImg = k.walking
      ? this.keeperSpr.walk[Math.floor(k.dist / 3.5) % 4]!
      : this.blinkOr(this.keeperSpr, 0.37);
    at(kImg, k.x - 9, 286 - FEET_Y, k.walking && k.dir < 0);

    // Personal contratado: la cocinera junto a la barra, el bardo ante la chimenea y el mozo
    // en la enfermería.
    const staff = this.model.staff;
    if (staff.includes('cocinera'))
      at(this.blinkOr(this.staffSpr.cocinera, 0.71), 178 - 9, 286 - FEET_Y);
    if (staff.includes('bardo')) {
      const lift = this.model.decor.includes('tarima') ? 3 : 0;
      at(this.blinkOr(this.staffSpr.bardo, 0.13), 304 - 9, F.hall.floor - FEET_Y - lift);
      if (t > this.nextNote) {
        this.particles.spawn('note', 306, F.hall.floor - 24);
        this.nextNote = t + 1.1 + Math.random();
      }
    }
    if (staff.includes('mozo'))
      at(this.blinkOr(this.staffSpr.mozo, 0.52), 336 - 9, F.upper.floor - FEET_Y);
    // Perro guardián a la puerta.
    if (this.model.dog) at(Prop.dog(Math.floor(t * 3) % 2 === 0), 66, GROUND - 10);
    this.drawDecor(ctx, cx, cy, t);

    // Heridos en cama.
    const beds = sickbeds(this.model.fac);
    const quilt = [
      [P.plum, P.bark, P.rust, P.oak],
      [P.plum, P.bark, P.rust, P.oak],
      [P.plum, P.wine, P.red, P.coral],
      [P.navy, P.ocean, P.sky, P.mist],
    ][this.model.fac.dorm]!;
    this.model.heroes
      .filter((h) => h.status === 'herido')
      .slice(0, beds.length)
      .forEach((h, i) => {
        const bed = beds[i]!;
        const a = this.heroes.get(h.id);
        if (!a) return;
        const head = a.spr.bed;
        const hx = bed.kind === 'camilla' ? bed.x - 3 : bed.x - 2;
        const hy = bed.kind === 'camilla' ? F.upper.floor - 27 : F.upper.floor - 29;
        at(head, hx, hy);
        if (bed.kind === 'camilla')
          at(blanket(22, [P.navy, P.ocean, P.sky, P.mist]), bed.x + 5, F.upper.floor - 14);
        else at(blanket(14, quilt), bed.x + 7, F.upper.floor - 17);
        drawn.push({ kind: 'hero', id: h.id, label: h.name, x: hx, y: hy, img: head, flip: false });
      });

    // Sentados (detrás de las mesas).
    for (const a of this.heroes.values()) {
      if (a.hero.status !== 'ok' || a.act !== 'sit' || a.seat < 0) continue;
      const seat = W.layout.seats[a.seat]!;
      const img = a.spr.sit;
      const x = seat.x - 9;
      const y = F.hall.floor - 9 - img.h + 1;
      at(img, x, y, !seat.faceRight);
      drawn.push({
        kind: 'hero',
        id: a.hero.id,
        label: a.hero.name,
        x,
        y,
        img,
        flip: !seat.faceRight,
      });
    }

    // Capa delantera (barra, mesas, barandilla, arbustos).
    ctx.drawImage(this.frontC, -cx, -cy);
    if (this.outerFrontC) ctx.drawImage(this.outerFrontC, WORLD_X0 - cx, -cy);

    // Candidatos en la barra.
    const cands = this.model.heroes
      .filter((h) => h.status === 'candidato')
      .slice(0, BAR_SPOTS.length);
    cands.forEach((h, i) => {
      const a = this.heroes.get(h.id);
      if (!a) return;
      const img = this.blinkOr(a.spr, i * 0.7);
      const x = BAR_SPOTS[i]! - 9;
      const y = F.hall.floor - FEET_Y;
      this.shadow(BAR_SPOTS[i]!, F.hall.floor);
      at(img, x, y);
      drawn.push({ kind: 'hero', id: h.id, label: h.name, x, y, img, flip: false });
    });

    // Gato.
    const cat = this.cat;
    const catImg =
      cat.state === 'walk'
        ? CAT_FRAMES.walk[Math.floor(cat.dist / 3) % 2]!
        : cat.state === 'sit'
          ? CAT_FRAMES.sit
          : CAT_FRAMES.sleep[Math.floor(t / 1.4) % 2]!;
    const catX = Math.round(cat.x - 8);
    const catY = F.hall.floor - catImg.h + 1;
    at(catImg, catX, catY, cat.dir < 0 && cat.state !== 'sleep');
    drawn.push({
      kind: 'cat',
      id: 'gato',
      label: 'Bigotes, el gato',
      x: catX,
      y: catY,
      img: catImg,
      flip: cat.dir < 0 && cat.state !== 'sleep',
    });

    // Héroes de pie o andando.
    const walkers = [...this.heroes.values()].filter(
      (a) => (a.hero.status === 'ok' && a.act !== 'sit') || a.trip === 'out',
    );
    walkers.sort((a, b) => a.hero.id.localeCompare(b.hero.id));
    for (const a of walkers) {
      if (this.battle?.hidden.has(a.hero.id)) continue;
      const walking = a.act === 'walk';
      const img = walking
        ? a.spr.walk[Math.floor(a.dist / 3.5) % 4]!
        : this.blinkOr(a.spr, a.blinkAt);
      const feet = feetAt(a.x);
      const x = Math.round(a.x - 9);
      const y = feet - FEET_Y;
      // En el patio se funden con la oscuridad (al salir) o aparecen de ella (al volver).
      const fade = Math.max(0, Math.min(1, (a.x - YARD_END) / 30));
      ctx.globalAlpha = a.trip ? fade : 1;
      this.shadow(a.x, feet);
      const flip = walking ? a.dir < 0 : false;
      // Brindis: los que están quietos en la sala saltan y alzan la jarra; al chocar, chispas.
      const toasting = !walking && !a.trip && t < this.toastUntil && feet === F.hall.floor;
      const beat = Math.sin(t * 9 + a.x * 0.7);
      const hop = toasting && beat > 0.3 ? -2 : 0;
      at(img, x, y + hop, flip);
      if (toasting) {
        const up = beat > 0 ? 0 : 2;
        const mx = x + 14;
        const my = y + hop + 6 + up;
        ctx.fillStyle = P.sand;
        ctx.fillRect(mx - cx, my - cy, 4, 1);
        ctx.fillStyle = P.oak;
        ctx.fillRect(mx - cx, my + 1 - cy, 4, 4);
        ctx.fillStyle = P.clay;
        ctx.fillRect(mx + 4 - cx, my + 2 - cy, 1, 2);
        if (beat > 0.97) this.particles.spawn('spark', mx + 2, my - 1);
      }
      ctx.globalAlpha = 1;
      drawn.push({ kind: 'hero', id: a.hero.id, label: a.hero.name, x, y, img, flip });
    }
    this.drawn = drawn;
    this.battle?.draw(ctx, cx, cy);

    // ---------- Luz ----------
    const l = this.lctx;
    l.globalCompositeOperation = 'copy';
    l.drawImage(this.ambientC, WORLD_X0 - cx, -cy);
    l.globalCompositeOperation = 'lighter';
    if (dl.day > 0 || dl.dusk > 0) {
      // Luz del día (y la anaranjada del atardecer) sobre todo lo que se ve.
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
    // Antorchas de los bandidos durante un asalto.
    for (const tch of this.battle?.lights() ?? []) {
      const r = tch.r + Math.round(noise(Math.floor(t * 9), tch.x) * 4);
      l.drawImage(lightSprite(r, tch.color, 1), tch.x - r - cx, tch.y - r - cy);
    }
    for (const s of W.shafts) {
      const sp = shaftSprite(s);
      l.drawImage(sp.canvas, sp.x - cx, sp.y - cy);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    if (dark > 0 || warm > 0) {
      // Noche azul y profunda; luego el amanecer lo tiñe todo de rosa y naranja.
      const mix = (a: number, b: number) =>
        Math.round(255 + (a - 255) * dark + (b - 255) * warm * (1 - dark));
      ctx.fillStyle = `rgb(${mix(52, 255)}, ${mix(60, 214)}, ${mix(110, 178)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    ctx.globalCompositeOperation = 'source-over';

    // ---------- Emisivos ----------
    ctx.globalCompositeOperation = 'lighter';
    for (const f of W.flames) {
      const g = glowSprite(6, [255, 150, 70], 0.35);
      ctx.drawImage(g, f.x - 6 - cx, f.y - 5 - cy);
    }
    for (const g of W.glows)
      ctx.drawImage(glowSprite(g.r, g.color, 0.45), g.x - g.r - cx, g.y - g.r - cy);
    for (const g of this.battle?.glows() ?? []) {
      const r = Math.round(g.r / 2);
      ctx.drawImage(glowSprite(r, g.color, 0.5), g.x - r - cx, g.y - r - cy);
    }
    if (W.layout.fire !== 'apagado') {
      const big = W.layout.fire === 'grande' ? 30 : 24;
      const fl = noise(Math.floor(t * 8), 3);
      ctx.drawImage(
        glowSprite(big, [255, 140, 60], 0.38 + fl * 0.08),
        W.fire.x + W.fire.w / 2 - big - cx,
        F.hall.floor - 10 - big - cy,
      );
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const f of W.flames) {
      const tall = noise(Math.floor(t * 10), f.x * 3 + f.y) > 0.45;
      ctx.fillStyle = P.lemon;
      ctx.fillRect(f.x - cx, f.y - cy - (tall ? 1 : 0), 1, tall ? 2 : 1);
      ctx.fillStyle = P.orange;
      ctx.fillRect(f.x - cx, f.y + 1 - cy, 1, 1);
      if (tall) {
        ctx.fillStyle = P.white;
        ctx.fillRect(f.x - cx, f.y - cy, 1, 1);
      }
    }
    if (W.layout.fire !== 'apagado') this.drawFire(W);
    this.battle?.drawFx(ctx, cx, cy);
    this.particles.draw(ctx, cx, cy, t);

    // Resalte del punto bajo el cursor y flecha sobre el héroe buscado.
    if (this.hover) this.brackets(this.hover.rect);
    if (this.marker && t < this.marker.until) {
      const p = this.heroPosition(this.marker.id);
      if (p) {
        const bob = Math.floor(t * 4) % 2;
        const ax = Math.round(p.x) - cx;
        const ay = Math.round(p.y) - 10 - bob - cy;
        ctx.fillStyle = P.black;
        ctx.fillRect(ax - 3, ay - 1, 7, 4);
        ctx.fillRect(ax - 2, ay + 3, 5, 1);
        ctx.fillRect(ax - 1, ay + 4, 3, 1);
        ctx.fillStyle = P.gold;
        ctx.fillRect(ax - 2, ay, 5, 2);
        ctx.fillRect(ax - 1, ay + 2, 3, 1);
        ctx.fillRect(ax, ay + 3, 1, 1);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(ax - 2, ay, 2, 1);
      }
    }
  }

  private blinkOr(spr: HeroSprites, seed: number): PixelBuffer {
    const t = this.t + seed * 3.1;
    if (t % 4.2 < 0.13) return spr.blink;
    return spr.idle[Math.floor(t / 0.9) % 2]!;
  }

  private shadow(x: number, floor: number): void {
    const { ctx, camera } = this;
    ctx.fillStyle = 'rgba(24, 20, 37, 0.45)';
    ctx.fillRect(Math.round(x - 5) - camera.px, floor - 1 - camera.py, 10, 1);
    ctx.fillRect(Math.round(x - 3) - camera.px, floor - camera.py, 6, 1);
  }

  private drawFire(W: WorldBuild): void {
    const { ctx, camera } = this;
    const t = this.t;
    const frame = Math.floor(t * 12);
    const tall = W.layout.fire === 'grande' ? 16 : 12;
    const base = F.hall.floor - 7;
    for (let i = 0; i < W.fire.w; i++) {
      const center = 1 - Math.abs(i - W.fire.w / 2) / (W.fire.w / 2);
      const h = Math.max(
        1,
        Math.round(tall * (0.35 + center * 0.75) * (0.6 + noise(frame, i) * 0.5)),
      );
      for (let k = 0; k < h; k++) {
        const f = k / h;
        ctx.fillStyle =
          f < 0.3 ? P.red : f < 0.55 ? P.orange : f < 0.8 ? P.gold : f < 0.95 ? P.lemon : P.white;
        if (f > 0.85 && noise(frame + k, i) < 0.4) continue;
        ctx.fillRect(W.fire.x + i - camera.px, base - k - camera.py, 1, 1);
      }
    }
  }

  private brackets(r: { x: number; y: number; w: number; h: number }): void {
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

  private hit(
    wx: number,
    wy: number,
  ): {
    kind: Drawn['kind'] | 'spot';
    id: string;
    label: string;
    rect: { x: number; y: number; w: number; h: number };
  } | null {
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const d = this.drawn[i]!;
      const lx = Math.floor(wx - d.x);
      const ly = Math.floor(wy - d.y);
      const sx = d.flip ? d.img.w - 1 - lx : lx;
      if (lx < 0 || ly < 0 || lx >= d.img.w || ly >= d.img.h) continue;
      if (alpha(d.img.get(sx, ly)))
        return {
          kind: d.kind,
          id: d.id,
          label: d.label,
          rect: { x: d.x, y: d.y, w: d.img.w, h: d.img.h },
        };
    }
    for (const s of this.spots) {
      if (wx >= s.x && wx < s.x + s.w && wy >= s.y && wy < s.y + s.h)
        return { kind: 'spot', id: s.id, label: s.label, rect: s };
    }
    return null;
  }

  private click(cssX: number, cssY: number): void {
    const w = this.camera.toWorld(cssX, cssY);
    const h = this.hit(w.x, w.y);
    if (!h) return;
    const at = { x: cssX, y: cssY, wx: w.x, wy: w.y };
    this.cb.onSound?.('click', 0.5);
    switch (h.kind) {
      case 'hero':
        this.cb.onHero?.(h.id, at);
        return;
      case 'cat':
        for (let i = 0; i < 4; i++)
          this.particles.spawn('heart', this.cat.x - 2 + i * 2, F.hall.floor - 12 - i * 3);
        this.cb.onSound?.('purr');
        if (this.cat.state === 'sleep') this.cat.timer = Math.min(this.cat.timer, 1.5);
        break;
      case 'owl':
        this.owl.lookUntil = this.t + 1.6;
        this.cb.onSound?.('hoot');
        break;
      case 'bat':
        for (const b of this.bats) b.flyUntil = this.t + 5;
        this.cb.onSound?.('bats');
        break;
      case 'rat':
        this.rat.dir = 1;
        this.cb.onSound?.('squeak');
        break;
      case 'spot':
        if (h.id === 'chimenea' && this.world?.layout.fire !== 'apagado') {
          for (let i = 0; i < 24; i++)
            this.particles.spawn('spark', 346 + (Math.random() - 0.5) * 20, F.hall.floor - 12);
          this.cb.onSound?.('sparks');
        }
        if (h.id === 'laud') {
          for (let i = 0; i < 5; i++)
            setTimeout(() => this.particles.spawn('note', 270 + Math.random() * 6, 230), i * 280);
          this.cb.onSound?.('lute');
        }
        if (h.id === 'pozo') {
          for (let i = 0; i < 6; i++) this.particles.spawn('splash', 26, 286);
          this.cb.onSound?.('splash');
        }
        if (h.id === 'letrero') {
          this.sign.kick = 3;
          this.cb.onSound?.('creak');
        }
        break;
    }
    this.cb.onHotspot?.(h.id, h.label, at);
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
        // Ratón sin pulsar: resaltar lo que hay debajo.
        const w = this.camera.toWorld(p.x, p.y);
        const h = this.hit(w.x, w.y);
        this.hover = h ? { id: h.id, rect: h.rect } : null;
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

function cloud(i: number): PixelBuffer {
  const b = new PixelBuffer(46, 14);
  const puffs: [number, number, number][] = [
    [10, 9, 6],
    [20, 6, 7],
    [31, 8, 6],
    [38, 10, 4],
  ];
  for (const [x, y, r] of puffs) {
    b.ellipse(x + (i % 2) * 3, y, r, r * 0.75, (_px, py) =>
      py < y - r * 0.3 ? P.fog : py > y + 1 ? P.navy : P.slate,
    );
  }
  return b;
}
