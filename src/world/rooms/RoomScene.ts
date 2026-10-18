/**
 * La escena del gremio por salas, en 3D pixelado: cada sala es una caja de verdad detrás del
 * plano de corte, con sus muebles como figuras planas y la luz de sus faroles; fuera, el cielo,
 * el patio y los tejados. Se maneja igual que la taberna dibujada (mismos métodos), para que la
 * interfaz no tenga que saber cuál está mirando.
 *
 * La cámara es la 2D de siempre (arrastre, inercia, zoom entero y límites): lo que encuadra en
 * el plano de corte es justo lo que se ve, píxel a píxel. Los toques se resuelven ahí mismo.
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type ShaderMaterial,
} from 'three';
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import type { Building, Room } from '../../core/model';
import { ROOMS } from '../../data/rooms';
import { Camera } from '../camera';
import { GROUND } from '../geometry';
import { Particles } from '../particles';
import * as Prop from '../props';
import type { Point, SceneCallbacks, SceneModel } from '../scene';
import { LANTERN, dummy, furnish, type Glow, type RGB } from './furniture';
import { Crowd } from './crowd';
import { Look, MAX_LIGHTS, mesh, quad, sharedUniforms, type Corners } from './gl';
import {
  DEPTH,
  PARTITION,
  PITCH,
  SLAB,
  WALL,
  floorTop,
  floorY,
  focusPoint,
  interior,
  roofLift,
  roomsLayout,
  sidesOf,
  type Rect,
  type RoomsLayout,
  type Side,
} from './layout';
import { Sky, type Daylight, type NightLight } from './sky';
import {
  backWall,
  bare,
  caveBack,
  caveCells,
  ceilingTex,
  facade,
  floorTex,
  groundTex,
  mirror,
  outerSide,
  palisade,
  roofTiles,
  ruined,
  scaffold,
  sideTex,
  stable,
  stairBack,
  stairCells,
  themeOf,
  watchtower,
  type Theme,
} from './textures';
import { EYE, eyeOf, frustum, scaleAt, type View } from './view3d';

/** Duración del día de la escena hasta que anochece (el reloj de verdad llega con el día vivo). */
const DAY_LENGTH = 720;
/** Terreno de más a cada lado del mundo (lo que la perspectiva deja ver al fondo). */
const TERRAIN_PAD = 640;
const DAWN_LIGHT = 0.65;
const NEAR = 20;
const FAR = EYE + 400;
/** Fondo del terreno que se ve a los lados y por detrás del edificio. */
const YARD_D = 220;

type Tint = readonly [number, number, number];
/** Luz de fondo de cada sitio (0–1 por canal): la noche sin faroles. */
const OUTDOOR: Tint = [0.3, 0.28, 0.42];
const ROOM_LIT: Tint = [0.44, 0.38, 0.46];
const ROOM_DEEP: Tint = [0.42, 0.37, 0.52];
const ROOM_DIM: Tint = [0.34, 0.31, 0.46];
const STAIRS: Tint = [0.4, 0.35, 0.5];
const CAVE: Tint = [0.3, 0.27, 0.4];
/** El corte de la tierra y la roca, que se vea aunque no le dé ningún farol. */
const EARTH: Tint = [0.62, 0.56, 0.72];

const smooth = (k: number) => k * k * (3 - 2 * k);

const noise = (a: number, b: number) => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};

/** Punto del espacio 3D a partir de una x y una y del mundo 2D (y hacia abajo) y una profundidad. */
const at = (x: number, y: number, depth: number) => new Vector3(x, GROUND - y, -depth);

export interface Spot {
  id: string;
  label: string;
  rect: Rect;
}

/** Un foco: dónde está, hasta dónde llega y la zona a la que alumbra (en 3D, y hacia arriba). */
interface Lamp {
  pos: Vector3;
  r: number;
  color: RGB;
  power: number;
  flicker: number;
  zone: [number, number, number, number];
  seed: number;
  /** Los faroles se notan menos de día; el fuego, igual. */
  fire: boolean;
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
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private cam3 = new PerspectiveCamera();
  private flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** Materiales del edificio (se rehacen con él) y los de las láminas de pantalla. */
  /** Día y focos: los mismos para el edificio, las láminas y la gente. */
  private shared = sharedUniforms();
  private look = new Look(this.shared);
  private keep = new Look(this.shared);
  private crowd = new Crowd(this.shared, (x, floor) => this.tintAt(x, floor));
  /** Persona señalada con el ratón y la que se ha buscado desde su ficha (un rato). */
  private hoverHero: string | null = null;
  private marker: { id: string; until: number } | null = null;
  private world = new Group();
  private lamps: Lamp[] = [];
  private towerRect: Rect | null = null;
  private flames: Mesh[] = [];
  private skyCanvas = document.createElement('canvas');
  private skyCtx = this.skyCanvas.getContext('2d')!;
  private skyTex = new CanvasTexture(this.skyCanvas);
  private skyScene = new Scene();
  private skyAt = '';
  private top = document.createElement('canvas');
  private topCtx = this.top.getContext('2d')!;
  private topTex = new CanvasTexture(this.top);
  private topScene = new Scene();
  private topLive = false;
  private sky = new Sky();
  private layout: RoomsLayout | null = null;
  private particles = new Particles();
  private spots: Spot[] = [];
  private hover: Spot | null = null;
  /** Sitios para una obra: mientras los hay, solo se tocan ellos. */
  private targets: Spot[] | null = null;
  private chosen: string | null = null;
  private targetsKey = '';
  private model: SceneModel | null = null;
  private key = '';
  private t = 0;
  private dayStart = 0;
  /** Hora del día que lleva el reloj de la partida (0 mañana, 1 noche); manda sobre la propia. */
  private clockTod: number | null = null;
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
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.setClearColor(P.black, 1);
    for (const tex of [this.skyTex, this.topTex]) {
      tex.magFilter = NearestFilter;
      tex.minFilter = NearestFilter;
      tex.generateMipmaps = false;
    }
    const sheet = this.keep.own(new PlaneGeometry(2, 2));
    this.skyScene.add(new Mesh(sheet, this.keep.screen(this.skyTex, false)));
    this.topScene.add(new Mesh(sheet, this.keep.screen(this.topTex, true)));
    this.scene.add(this.world);
    this.scene.add(this.crowd.group);
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.bindInput();
  }

  // ---------- API (la misma que la taberna dibujada) ----------

  /** Marca los sitios donde se puede hacer una obra (y el elegido), o los quita con null. */
  setTargets(list: Spot[] | null, chosen: string | null = null): void {
    // Elegir uno no mueve la cámara: solo una lista nueva de sitios.
    const key = list?.map((t) => `${t.id}:${t.rect.x},${t.rect.y}`).join(' ') ?? '';
    const fresh = key !== this.targetsKey;
    this.targetsKey = key;
    this.targets = list;
    this.chosen = chosen;
    this.hover = null;
    this.topLive = true;
    // Si no se ven todos, la cámara se aleja lo justo (sin pasarse) y los centra.
    if (!fresh || !list?.length || !this.cssW) return;
    const x0 = Math.min(...list.map((t) => t.rect.x)) - 16;
    const y0 = Math.min(...list.map((t) => t.rect.y)) - 16;
    const x1 = Math.max(...list.map((t) => t.rect.x + t.rect.w)) + 16;
    const y1 = Math.max(...list.map((t) => t.rect.y + t.rect.h)) + 16;
    const { px, py, vw, vh } = this.camera;
    // Abajo queda sitio para la barra de la obra (unos 90 píxeles de pantalla).
    const bar = 90 / this.camera.zoom;
    if (x0 >= px && x1 <= px + vw && y0 >= py && y1 <= py + vh - bar) return;
    const fit = Math.floor(Math.min(this.cssW / (x1 - x0), (this.cssH - 120) / (y1 - y0)));
    const z = Math.max(this.minZoom(this.cssW, this.cssH), Math.min(this.camera.zoom, fit));
    if (z !== this.camera.zoom) this.resize(this.cssW, this.cssH, z);
    this.camera.centerOn((x0 + x1) / 2, (y0 + y1) / 2 + 45 / z);
  }

  setModel(model: SceneModel): void {
    const prev = this.model?.building;
    this.model = model;
    const b = model.building;
    if (!b) return;
    const key = JSON.stringify([b, model.crest]);
    if (key === this.key) {
      this.crowd.setPeople(model.heroes);
      return;
    }
    this.key = key;
    const L = roomsLayout(b);
    this.layout = L;
    this.rebuild(L, model);
    this.crowd.setLayout(L);
    this.crowd.setPeople(model.heroes);
    this.camera.world = { x0: L.x0, x1: L.x1, y0: L.y0, y1: L.y1 };
    // La torre se toca donde se ve, encima del tejado.
    this.spots = L.rooms.map(({ room, rect }) => ({
      id: `sala:${room.id}`,
      label: roomLabel(b, room.id),
      rect: room.type === 'torre' ? (this.towerRect ?? rect) : rect,
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
    const { vw, vh } = this.camera;
    this.renderer.setSize(vw, vh, false);
    this.canvas.style.width = `${vw * z}px`;
    this.canvas.style.height = `${vh * z}px`;
    for (const c of [this.skyCanvas, this.top]) {
      c.width = vw;
      c.height = vh;
    }
    // Las texturas cambian de tamaño: three.js tiene que crearlas de nuevo.
    this.skyTex.dispose();
    this.topTex.dispose();
    this.skyAt = '';
    this.topLive = true;
    if (!this.framed && this.layout) this.frame();
  }

  /** La primera vez, la cámara mira al salón. */
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
      const dt = Math.max(0, Math.min(0.05, (now - (this.last || now)) / 1000));
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

  /** Suelta lo que la escena tiene en la tarjeta gráfica. */
  dispose(): void {
    this.stop();
    this.look.dispose();
    this.keep.dispose();
    this.crowd.dispose();
    this.skyTex.dispose();
    this.topTex.dispose();
    this.renderer.dispose();
  }

  /** Dónde se ve a alguien (arriba de su cabeza), en coordenadas del plano de corte. */
  heroPosition(id: string): Point | null {
    const r = this.heroRect(id);
    return r ? { x: r.x + r.w / 2, y: r.y } : null;
  }

  /** Centra la cámara en alguien y lo marca un rato. */
  focusHero(id: string): boolean {
    const p = this.heroPosition(id);
    if (!p) return false;
    this.camera.centerOn(p.x, p.y + 14);
    this.marker = { id, until: this.t + 4 };
    return true;
  }

  /** Recuadro de alguien en coordenadas del plano de corte (lo que tapa en pantalla). */
  private heroRect(id: string): Rect | null {
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    const r = this.crowd.screenRect(id, v);
    return r ? { x: r.x + camera.px, y: r.y + camera.py, w: r.w, h: r.h } : null;
  }

  /** Luz de fondo donde está alguien: fuera, en una sala o bajo tierra. */
  private tintAt(x: number, floor: number): { ambient: Tint; sun: number } {
    if (x < 0) return { ambient: OUTDOOR, sun: 1 };
    if (floor < 0) return { ambient: ROOM_DEEP, sun: 0 };
    return { ambient: ROOM_LIT, sun: 0.25 };
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

  /** La hora del reloj de la partida: el cielo y la gente la siguen. */
  setTime(tod: number): void {
    this.clockTod = Math.max(0, Math.min(1, tod));
  }

  /** Una entrega de la caja: unas monedas saltan en el salón. */
  pay(): void {
    const p = this.layout ? focusPoint(this.layout, 'barra') : null;
    if (!p) return;
    for (let i = 0; i < 6; i++)
      this.particles.spawn(
        'coin',
        p.x - 30 + (Math.random() - 0.5) * 30,
        p.y + 10 - Math.random() * 10,
      );
  }

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
  daylight(): Daylight {
    const n = this.night;
    if (n) {
      const p = this.nightP();
      if (p < 0.35) return { day: this.dayAtNightfall * (1 - smooth(p / 0.35)), dusk: 0, tod: 1 };
      if (p < 0.9) return { day: 0, dusk: 0, tod: 0 };
      return { day: smooth(Math.min(1, (p - 0.9) / 0.9)) * DAWN_LIGHT, dusk: 0, tod: 0 };
    }
    const tod = this.clockTod ?? Math.min(1, (this.t - this.dayStart) / DAY_LENGTH);
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

  private nightLight(): NightLight {
    if (!this.night) return { dark: 0, warm: 0 };
    const p = this.nightP();
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));
    return {
      dark: ramp(0, 0.35) * (1 - ramp(0.5, 0.9)),
      warm: ramp(0.45, 0.9) * (1 - ramp(1.05, 1.8)),
    };
  }

  // ---------- Montaje del edificio ----------

  private rebuild(L: RoomsLayout, model: SceneModel): void {
    // Lo de antes fuera (las láminas de cielo y partículas se quedan).
    this.world.clear();
    this.look.dispose();
    this.look = new Look(this.shared);
    this.lamps = [];
    this.flames = [];
    this.towerRect = null;
    const b = L.b;
    const g = this.world;

    // El plano de corte, en dos: lo de encima del suelo, a la luz del día, y la tierra.
    const F = facade(L);
    const fx1 = F.x + F.buf.w;
    const fy1 = F.y + F.buf.h;
    const cut = GROUND - F.y;
    this.plane(
      g,
      F.buf.crop(0, 0, F.buf.w, cut),
      [at(F.x, GROUND, 0), at(fx1, GROUND, 0), at(fx1, F.y, 0), at(F.x, F.y, 0)],
      { ambient: OUTDOOR, sun: 1 },
    );
    this.plane(
      g,
      F.buf.crop(0, cut, F.buf.w, F.buf.h - cut),
      [at(F.x, fy1, 0), at(fx1, fy1, 0), at(fx1, GROUND, 0), at(F.x, GROUND, 0)],
      { ambient: EARTH, sun: 0 },
    );

    // Salas, escaleras y huecos excavados.
    for (const { room, rect } of L.rooms) if (room.type !== 'torre') this.roomBox(room, rect, b);
    for (const s of stairCells(L)) {
      const left = b.rooms.some((r) => this.covers(r, s.s - 1, s.floor))
        ? 'sala'
        : s.floor < 0
          ? 'tierra'
          : 'aire';
      const right = b.rooms.some((r) => this.covers(r, s.s, s.floor))
        ? 'sala'
        : s.floor < 0
          ? 'tierra'
          : 'aire';
      this.box(
        s.rect,
        themeOf(s.floor),
        STAIRS,
        s.floor >= 0 ? 0.35 : 0,
        `escalera${s.s}${s.floor}`,
        {
          back: stairBack(themeOf(s.floor), interior(s.rect).w, s.rect.h, s.floor),
          sides: { left: [left], right: [right] },
          floor: s.floor,
        },
      );
    }
    for (const c of caveCells(L)) {
      const r = interior(c.rect);
      this.box(c.rect, 'cueva', CAVE, 0, `cueva${c.col}${c.floor}`, {
        back: caveBack(r.w, r.h, `cueva${c.col}${c.floor}`),
        sides: { left: ['tierra'], right: ['tierra'] },
        floor: c.floor,
      });
    }

    // Tejados: las dos vertientes, por detrás de su hastial.
    for (const run of F.runs) {
      const mid = (run.x0 + run.x1) / 2;
      const eave = run.base + 2;
      const ridge = run.base - run.h;
      const len = Math.round(Math.hypot((run.x1 - run.x0) / 2, run.h));
      const d = DEPTH + 6;
      const opts = { ambient: OUTDOOR, sun: 1, dither: 0 };
      this.plane(
        g,
        roofTiles(len, `tejado${run.x0}`),
        [at(run.x0, eave, d), at(run.x0, eave, 0), at(mid, ridge, 0), at(mid, ridge, d)],
        opts,
      );
      this.plane(
        g,
        roofTiles(len, `tejado${run.x1}`),
        [at(run.x1, eave, 0), at(run.x1, eave, d), at(mid, ridge, d), at(mid, ridge, 0)],
        opts,
      );
    }

    // El terreno de arriba: patio, hierba y lo de detrás del edificio. Va mucho más allá de lo
    // que deja ver la cámara: al fondo la perspectiva lo estrecha y si no se le vería el final.
    const yard = { ambient: OUTDOOR, sun: 1, dither: 0 };
    const back = DEPTH + 2;
    const x0 = L.x0 - TERRAIN_PAD;
    const x1 = L.x1 + TERRAIN_PAD;
    this.plane(
      g,
      groundTex(L.left - x0, YARD_D / 2, true, 'patio'),
      [
        at(x0, GROUND, 0),
        at(L.left, GROUND, 0),
        at(L.left, GROUND, YARD_D),
        at(x0, GROUND, YARD_D),
      ],
      yard,
    );
    this.plane(
      g,
      groundTex(x1 - L.right, YARD_D / 2, false, 'solares'),
      [
        at(L.right, GROUND, 0),
        at(x1, GROUND, 0),
        at(x1, GROUND, YARD_D),
        at(L.right, GROUND, YARD_D),
      ],
      yard,
    );
    this.plane(
      g,
      groundTex(L.right - L.left, (YARD_D - back) / 2, false, 'huerto'),
      [
        at(L.left, GROUND, back),
        at(L.right, GROUND, back),
        at(L.right, GROUND, YARD_D),
        at(L.left, GROUND, YARD_D),
      ],
      yard,
    );
    this.yard(L, model);

    // La torre del vigía, sobre el caballete del tejado que tenga debajo.
    const tower = L.rooms.find((x) => x.room.type === 'torre');
    if (tower) {
      const cx = tower.rect.x + tower.rect.w / 2;
      const base = floorY(tower.room.floor);
      const lift = roofLift(F.runs, cx, base) - 2;
      const img = watchtower(tower.room.level, model.crest);
      this.figure(g, img, cx, base - lift, DEPTH / 2, OUTDOOR, 1);
      const k = scaleAt(DEPTH / 2);
      const top = Math.min(tower.rect.y, base - lift - img.h / k);
      this.towerRect = { x: cx - img.w / 2, y: top, w: img.w, h: base - top };
      if (tower.room.level > 0) {
        this.lamps.push({
          pos: at(cx, base - lift - (img.h - 30) / k, DEPTH / 2 - 8),
          r: 60,
          color: [255, 168, 92],
          power: 0.9,
          flicker: 0.2,
          zone: [cx - 60, GROUND - base + lift, cx + 60, GROUND - base + lift + 140],
          seed: 7,
          fire: true,
        });
      }
    }
  }

  private covers(r: Room, c: number, f: number): boolean {
    return r.type !== 'torre' && c >= r.col && c < r.col + r.w && f >= r.floor && f < r.floor + r.h;
  }

  /** Caja de una sala con sus muebles, sus faroles y, si está en obras, el andamio delante. */
  private roomBox(room: Room, rect: Rect, b: Building): void {
    const r = interior(rect);
    const dim = ruined(room) || bare(room);
    const ambient = dim ? ROOM_DIM : room.floor < 0 ? ROOM_DEEP : ROOM_LIT;
    const sun =
      room.floor < 0 ? 0 : room.type === 'tesoro' || room.type === 'despensa' ? 0.15 : 0.55;
    const theme = themeOf(room.floor);
    const seed = `${room.id}${room.type}`;
    const sides = sidesOf(b, room);
    this.box(rect, theme, ambient, sun, seed, {
      back: backWall(room, r.w, r.h),
      floorTex: floorTex(room, theme, r.w, seed),
      sides,
      floor: room.floor,
      door: room.type === 'recibidor',
    });
    const zone = this.zoneOf(rect);
    const floor3 = GROUND - (r.y + r.h);
    const ceil3 = GROUND - r.y;
    for (const th of furnish(room, r.w)) {
      const k = scaleAt(th.z);
      const h = th.img.h / k;
      const x = r.x + th.x;
      const bottom = th.hang ? ceil3 - h - th.y : floor3 + th.y;
      this.figure(this.world, th.img, x, GROUND - bottom, th.z, ambient, sun);
      if (th.light) this.addLight(th.light, x, bottom, th.z, zone);
    }
    if (room.works) {
      const k = scaleAt(3);
      const img = scaffold(r.w * k, r.h * k);
      this.figure(this.world, img, r.x + r.w / 2, r.y + r.h, 3, ROOM_DIM, sun);
    }
  }

  /** Zona que alumbran los focos de un hueco: su interior y media pared de cada lado. */
  private zoneOf(rect: Rect): [number, number, number, number] {
    return [
      rect.x + 1,
      GROUND - (rect.y + rect.h + SLAB),
      rect.x + rect.w - 1,
      GROUND - (rect.y - SLAB),
    ];
  }

  private addLight(l: Glow, x: number, bottom: number, z: number, zone: Lamp['zone']): void {
    const k = scaleAt(z);
    const y = bottom + l.dy / k;
    this.lamps.push({
      pos: new Vector3(x, y, -z + 6),
      r: l.r,
      color: l.color,
      power: l.power,
      flicker: l.flicker,
      zone,
      seed: Math.round(x * 7 + y * 13),
      fire: l.flicker >= 0.2,
    });
    for (const f of l.flames ?? []) {
      // Tres llamas una dentro de otra: naranja, oro y limón.
      const layers: [number, number, string][] = [
        [12, 5, P.orange],
        [8, 4, P.gold],
        [4, 3, P.lemon],
      ];
      layers.forEach(([w, h, color], i) => {
        const m = mesh(
          quad(
            [
              new Vector3(-w / 2, 0, 0),
              new Vector3(w / 2, 0, 0),
              new Vector3(w / 2, h, 0),
              new Vector3(-w / 2, h, 0),
            ],
            this.look,
          ),
          this.look.flat(color),
        );
        m.scale.setScalar(f.size / k);
        m.position.set(x + f.dx / k, bottom + (f.dy + l.dy - 8) / k, -z + 0.6 + i * 0.05);
        this.world.add(m);
        this.flames.push(m);
      });
    }
  }

  /**
   * Caja de un hueco: fondo, suelo, techo y los dos lados (con puerta a lo que haya al otro lado
   * en cada planta); por fuera, la pared del edificio donde da al aire.
   */
  private box(
    rect: Rect,
    theme: Theme,
    ambient: Tint,
    sun: number,
    seed: string,
    o: {
      back: PixelBuffer;
      floorTex?: PixelBuffer;
      sides: { left: Side[]; right: Side[] };
      floor: number;
      door?: boolean;
    },
  ): void {
    const g = this.world;
    const r = interior(rect);
    const x0 = r.x;
    const x1 = r.x + r.w;
    const yt = r.y;
    const yb = r.y + r.h;
    const D = DEPTH;
    const opts = { ambient, sun };
    const flat = { ambient, sun, dither: 0 };
    this.plane(g, o.back, [at(x0, yb, D), at(x1, yb, D), at(x1, yt, D), at(x0, yt, D)], opts);
    this.plane(
      g,
      o.floorTex ?? floorTex(null, theme, r.w, seed),
      [at(x0, yb, 0), at(x1, yb, 0), at(x1, yb, D), at(x0, yb, D)],
      flat,
    );
    this.plane(
      g,
      ceilingTex(theme, r.w, seed),
      [at(x0, yt, D), at(x1, yt, D), at(x1, yt, 0), at(x0, yt, 0)],
      flat,
    );
    const doors = (s: Side[]) => s.flatMap((x, i) => (x === 'sala' || x === 'escalera' ? [i] : []));
    this.plane(
      g,
      sideTex(theme, r.h, doors(o.sides.left), `${seed}i`),
      [at(x0, yb, 0), at(x0, yb, D), at(x0, yt, D), at(x0, yt, 0)],
      flat,
    );
    this.plane(
      g,
      mirror(sideTex(theme, r.h, doors(o.sides.right), `${seed}d`)),
      [at(x1, yb, D), at(x1, yb, 0), at(x1, yt, 0), at(x1, yt, D)],
      flat,
    );
    // Paredes de fuera, planta a planta, donde el hueco da al aire.
    const outdoor = { ambient: OUTDOOR, sun: 1, dither: 0 };
    let doorDone = !o.door;
    for (const [side, list] of [
      ['left', o.sides.left],
      ['right', o.sides.right],
    ] as const)
      list.forEach((s, i) => {
        if (s !== 'aire') return;
        const f = o.floor + i;
        const top = floorTop(f) - SLAB;
        const bottom = floorY(f);
        const withDoor = !doorDone && i === 0;
        if (withDoor) doorDone = true;
        const tex = outerSide(themeOf(f), PITCH, withDoor, `${seed}f${side}${i}`);
        if (side === 'left') {
          const x = rect.x - WALL;
          this.plane(
            g,
            mirror(tex),
            [at(x, bottom, D), at(x, bottom, 0), at(x, top, 0), at(x, top, D)],
            outdoor,
          );
        } else {
          const x = rect.x + rect.w + WALL;
          this.plane(
            g,
            tex,
            [at(x, bottom, 0), at(x, bottom, D), at(x, top, D), at(x, top, 0)],
            outdoor,
          );
        }
      });
  }

  /** Lo de fuera: pozo, muñecos, establo, empalizada, el escudo y el farol de la puerta. */
  private yard(L: RoomsLayout, model: SceneModel): void {
    const g = this.world;
    const y = L.b.yard;
    const px = L.patio.x;
    const put = (img: PixelBuffer, x: number, depth: number, up = 0) =>
      this.figure(g, img, x, GROUND - up, depth, OUTDOOR, 1);
    put(Prop.well(), px + 40, 70);
    put(Prop.bush('patio1'), L.left - 30, 12);
    put(Prop.bush('patio2'), L.right + 40, 30);
    put(Prop.bush('patio3'), L.right + 80, 90);
    for (let i = 0; i < Math.min(2, y.patio); i++) put(dummy(), px + 110 + i * 30, 40 + i * 16);
    if (y.establo > 0) put(stable(y.establo), px + 120, 150);
    if (y.empal > 0)
      for (let x = px; x < L.left - 20; x += 38)
        put(palisade(y.empal > 1 ? 30 : 22), x + 20, YARD_D - 30);
    const door = L.rooms.find((x) => x.room.type === 'recibidor');
    if (door) {
      const dx = door.rect.x - WALL;
      put(Prop.crestBoard(model.crest.field, model.crest.dark, model.crest.symbol), dx - 22, 6, 54);
      put(Prop.lanternBody(), dx - 8, 4, 46);
      this.lamps.push({
        pos: at(dx - 8, GROUND - 52, 0),
        r: 60,
        color: LANTERN,
        power: 1,
        flicker: 0.1,
        zone: [px - 40, -SLAB, dx + PARTITION / 2, 140],
        seed: 3,
        fire: false,
      });
    }
  }

  /** Figura plana a `depth`, al tamaño de su dibujo en pantalla; (x, base) del mundo 2D. */
  private figure(
    g: Group,
    img: PixelBuffer,
    x: number,
    base: number,
    depth: number,
    ambient: Tint,
    sun: number,
  ): void {
    const k = scaleAt(depth);
    const w = img.w / k;
    const h = img.h / k;
    this.plane(
      g,
      img,
      [
        at(x - w / 2, base, depth),
        at(x + w / 2, base, depth),
        at(x + w / 2, base - h, depth),
        at(x - w / 2, base - h, depth),
      ],
      {
        ambient,
        sun,
        wrap: 0.6,
        dither: 0.03,
      },
    );
  }

  private plane(
    g: Group,
    img: PixelBuffer,
    corners: Corners,
    o: { ambient: Tint; sun: number; wrap?: number; dither?: number },
  ): ShaderMaterial {
    const m = this.look.surface(img, corners, o);
    g.add(mesh(quad(corners, this.look), m));
    return m;
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
    // A la cama: al atardecer van andando y de noche ya están acostados.
    const tod = this.clockTod ?? Math.min(1, (this.t - this.dayStart) / DAY_LENGTH);
    this.crowd.setNight(this.night && this.nightP() < 1.6 ? 'night' : tod > 0.82 ? 'dusk' : 'day');
    this.crowd.update(dt, this.t);
    if (this.marker && this.t > this.marker.until) this.marker = null;
    this.camera.update(dt);
    this.particles.update(dt, this.t);
  }

  private draw(): void {
    if (!this.layout || !this.camera.vw) return;
    const { camera } = this;
    const view: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    const t = this.t;
    const dl = this.daylight();
    const nl = this.nightLight();

    // Cámara: el ojo delante del corte y el encuadre justo de la vista.
    const e = eyeOf(view);
    this.cam3.position.set(e.x, GROUND - e.y, EYE);
    const f = frustum(view, NEAR);
    this.cam3.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, NEAR, FAR);
    this.cam3.projectionMatrixInverse.copy(this.cam3.projectionMatrix).invert();

    // Luz del día (o de la luna) y los focos más cercanos a la vista.
    const s = this.look.shared;
    const moon = 1 - dl.day;
    s.uDaylight.value.set(
      0.78 * dl.day + 0.3 * dl.dusk + 0.16 * moon + 0.22 * nl.warm,
      0.76 * dl.day + 0.12 * dl.dusk + 0.18 * moon + 0.12 * nl.warm,
      0.72 * dl.day + 0.32 * moon * (1 - 0.4 * nl.dark),
    );
    const lampK = 0.3 + 0.7 * (1 - dl.day);
    const fireK = 0.6 + 0.4 * (1 - dl.day);
    const cx = view.px + view.vw / 2;
    const cy = GROUND - (view.py + view.vh / 2);
    const x0 = view.px - 40;
    const x1 = view.px + view.vw + 40;
    const y0 = GROUND - (view.py + view.vh + 40);
    const y1 = GROUND - (view.py - 40);
    const near = this.lamps
      .filter((l) => l.zone[2] > x0 && l.zone[0] < x1 && l.zone[3] > y0 && l.zone[1] < y1)
      .sort(
        (a, b) => Math.hypot(a.pos.x - cx, a.pos.y - cy) - Math.hypot(b.pos.x - cx, b.pos.y - cy),
      );
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = near[i];
      if (!l) {
        s.uLightPos.value[i]!.w = 0;
        continue;
      }
      const fl = 1 - l.flicker * noise(Math.floor(t * 9), l.seed);
      const k = (l.fire ? fireK : lampK) * l.power * fl;
      s.uLightPos.value[i]!.set(l.pos.x, l.pos.y, l.pos.z, l.r);
      s.uLightColor.value[i]!.set(
        (l.color[0] / 255) * k,
        (l.color[1] / 255) * k,
        (l.color[2] / 255) * k,
      );
      s.uLightZone.value[i]!.set(...l.zone);
    }
    for (const m of this.flames)
      m.scale.y = m.scale.x * (0.6 + noise(Math.floor(t * 10), m.id) * 0.7);

    // El cielo, solo cuando cambia (la cámara se mueve o pasa un rato).
    const skyKey = `${view.px},${view.py},${Math.floor(t * 8)},${view.vw},${view.vh}`;
    if (skyKey !== this.skyAt) {
      this.skyAt = skyKey;
      this.sky.draw(this.skyCtx, view.px, view.py, view.vw, view.vh, t, dl, nl);
      this.skyTex.needsUpdate = true;
    }

    // Partículas y la marca de la sala señalada, en una lámina por delante.
    const live =
      this.particles.list.length > 0 ||
      !!this.hover ||
      !!this.hoverHero ||
      !!this.marker ||
      !!this.targets?.length;
    if (live || this.topLive) {
      const ctx = this.topCtx;
      ctx.clearRect(0, 0, view.vw, view.vh);
      if (this.targets) this.marks(this.targets);
      this.particles.draw(ctx, view.px, view.py, t);
      if (this.hover) this.brackets(this.hover.rect);
      for (const id of [this.hoverHero, this.marker?.id]) {
        const r = id ? this.heroRect(id) : null;
        if (r) this.brackets(r);
      }
      this.topTex.needsUpdate = true;
      this.topLive = live;
    }

    const r = this.renderer;
    r.clear();
    r.render(this.skyScene, this.flat);
    r.clearDepth();
    r.render(this.scene, this.cam3);
    if (live) r.render(this.topScene, this.flat);
  }

  /** Los sitios de una obra: un recuadro de puntos que late; el elegido, lleno y con marca. */
  private marks(list: Spot[]): void {
    const { topCtx: ctx, camera } = this;
    const beat = Math.floor(this.t * 2) % 2;
    for (const s of list) {
      const x = Math.round(s.rect.x - camera.px) + 2;
      const y = Math.round(s.rect.y - camera.py) + 2;
      const w = Math.round(s.rect.w) - 4;
      const h = Math.round(s.rect.h) - 4;
      const on = s.id === this.chosen;
      ctx.globalAlpha = on ? 0.45 : 0.18;
      ctx.fillStyle = on ? P.gold : P.lime;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = on ? P.lemon : P.lime;
      for (let i = beat; i < w; i += 4) {
        ctx.fillRect(x + i, y, 2, 1);
        ctx.fillRect(x + i, y + h - 1, 2, 1);
      }
      for (let i = beat; i < h; i += 4) {
        ctx.fillRect(x, y + i, 1, 2);
        ctx.fillRect(x + w - 1, y + i, 1, 2);
      }
      if (on) this.brackets(s.rect);
    }
  }

  private brackets(rc: Rect): void {
    const { topCtx: ctx, camera } = this;
    const pulse = Math.floor(this.t * 3) % 2;
    const x0 = rc.x - camera.px - 2 - pulse;
    const y0 = rc.y - camera.py - 2 - pulse;
    const x1 = rc.x + rc.w - camera.px + 1 + pulse;
    const y1 = rc.y + rc.h - camera.py + 1 + pulse;
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
      (this.targets ?? this.spots).find(
        (s) =>
          wx >= s.rect.x && wx < s.rect.x + s.rect.w && wy >= s.rect.y && wy < s.rect.y + s.rect.h,
      ) ?? null
    );
  }

  /** La persona que hay bajo un punto de la pantalla (no mientras se elige sitio para una obra). */
  private heroAt(cssX: number, cssY: number): string | null {
    if (this.targets) return null;
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    return this.crowd.hit(v, cssX / camera.zoom, cssY / camera.zoom);
  }

  private click(cssX: number, cssY: number): void {
    const w = this.camera.toWorld(cssX, cssY);
    const who = this.heroAt(cssX, cssY);
    if (who) {
      const p = this.heroPosition(who);
      this.cb.onHero?.(who, { x: cssX, y: cssY, wx: p?.x ?? w.x, wy: p?.y ?? w.y });
      return;
    }
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
        const who = this.heroAt(p.x, p.y);
        this.hoverHero = who;
        if (who) {
          this.hover = null;
          c.style.cursor = 'pointer';
          this.cb.onHover?.(this.crowd.nameOf(who), p);
          return;
        }
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
        this.hoverHero = null;
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
