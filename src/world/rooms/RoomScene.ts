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
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type ShaderMaterial,
} from 'three';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import type { Building, RaidResult, Room, RoomYield } from '../../core/model';
import { ROOMS } from '../../data/rooms';
import { Camera } from '../camera';
import { GROUND } from '../geometry';
import { Particles } from '../particles';
import * as Prop from '../props';
import type { Point, SceneCallbacks, SceneModel } from '../scene';
import { LANTERN, dummy, furnish, gearRoom, type Glow, type RGB } from './furniture';
import { towerLampY, watchtower } from './salas/torre';
import { takeWallActs, type ActId, type PoiKind } from './salas/kit';
import { dress } from './salas/tintes';
import { Crowd, type Poi, type Talk } from './crowd';
import { FLAME_FRAMES, FLAME_H, FLAME_W, flameStrip } from './flame';
import { faces } from './volume';
import { RaidShow } from './raid';
import { NO_LOOK, type SalonLook } from './salon';
import { FEW_LIGHTS, Look, MAX_LIGHTS, mesh, quad, sharedUniforms, type Corners } from './gl';
import { route, type Place } from './people';
import {
  CELL_W,
  DEPTH,
  PATIO_W,
  PARTITION,
  PITCH,
  ROOF_H,
  SLAB,
  WALL,
  YARD_D,
  colX,
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
  earthBuf,
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
  type Theme,
} from './textures';
import { BACK, EYE, LIFT, eyeOf, frustum, pinShift, project, scaleAt, type View } from './view3d';

/** Duración del día de la escena hasta que anochece (el reloj de verdad llega con el día vivo). */
const DAY_LENGTH = 720;
/**
 * Terreno de más a cada lado del mundo: al fondo la perspectiva lo estrecha a la mitad y, con
 * el zoom más alejado y una esquina en el centro, la vista llega muy lejos.
 */
const TERRAIN_PAD = 3200;
/** Ancho del trozo de terreno o de tierra que se repite hasta allí. */
const TILE = 512;
const DAWN_LIGHT = 0.65;
const NEAR = 20;
const FAR = EYE + 400;
/** Lo que tarda en levantarse una sala al pagar las obras (s). */
const RAISE = 2.4;

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

/** Un mueble anclado: su malla, su esquina de arriba a la izquierda, su escala y su pared. */
interface Pin {
  mesh: Object3D;
  x: number;
  y: number;
  k: number;
  wx: number;
  wy: number;
}

export interface Spot {
  id: string;
  label: string;
  rect: Rect;
  /** Casilla tachada: se ve, pero no se puede hacer la obra (si tapa una sala, se toca la sala). */
  blocked?: boolean;
  /** Obra que quita algo (un tramo de escalera): en coral, con lo que devuelve. */
  remove?: boolean;
}

/** Un foco: dónde está, hasta dónde llega y la zona a la que alumbra (en 3D, y hacia arriba). */
interface Lamp {
  pos: Vector3;
  /** Centro del halo: la llama tal como está dibujada (a la profundidad de su figura). */
  glow: Vector3;
  r: number;
  color: RGB;
  power: number;
  flicker: number;
  zone: [number, number, number, number];
  seed: number;
  /** Los faroles se notan menos de día; el fuego, igual. */
  fire: boolean;
  /** En una sala a la que no llega el sol (bajo tierra, el tesoro): alumbra igual de día. */
  deep?: boolean;
  /** Radio (en píxeles de pantalla) del halo que se ve en el aire alrededor de la llama. */
  halo: number;
}

/**
 * El halo de cada luz: grande en los fuegos, mediano en los faroles y las arañas y pequeño en
 * las velas y los apliques.
 */
const haloOf = (r: number, power: number, fire: boolean) =>
  fire ? 22 : r >= 70 ? Math.round(14 * Math.sqrt(power)) : Math.max(7, Math.round(r / 4));

/** Lo que se lee al pasar el ratón por encima de cada cosa tocable de las salas. */
const ACT_LABEL: Record<ActId, string> = {
  tablon: 'Tablón de encargos',
  mapa: 'Mapa de la comarca',
  candidatos: 'La barra: quien busca trabajo',
  equipo: 'Equipo del gremio',
};

/** Iconos de 7×5 de los bocadillos (k negro, r rojo, w blanco, g oro, y limón, o roble, m plata, t y c pan). */
const TALK_ICONS: Record<Talk, string[]> = {
  puntos: ['.......', '.......', '.k.k.k.', '.......', '.......'],
  exclama: ['...r...', '...r...', '...r...', '.......', '...r...'],
  pregunta: ['..kkk..', '.....k.', '...kk..', '.......', '...k...'],
  jarra: ['.www...', '.gggo..', '.gygo..', '.gggo..', '.ggg...'],
  moneda: ['..ggg..', '.gyggg.', '.gyggg.', '.ggggg.', '..ggg..'],
  corazon: ['.rr.rr.', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  nota: ['...kk..', '...k.k.', '...k...', '.kkk...', '.kk....'],
  espada: ['......m', '.....m.', '.o.mm..', '..oo...', '.o.o...'],
  pan: ['.......', '..ttt..', '.ttttt.', 'ccccccc', '.......'],
  risa: ['.......', '.k...k.', '.......', '.k...k.', '..kkk..'],
};
const TALK_INK: Record<string, string> = {
  k: P.black,
  r: P.red,
  w: P.white,
  g: P.gold,
  y: P.lemon,
  o: P.oak,
  m: P.fog,
  t: P.tan,
  c: P.clay,
};

/** Una cosa tocable de una sala: su recuadro en el mundo a su profundidad. */
interface PropSpot {
  act?: ActId;
  /** Sitio al que va la gente a hacer algo (sin `act`, no se toca: solo se usa). */
  poi?: PoiKind;
  room: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z: number;
}

/** El oro de la cámara, en octavos: la escena solo se repinta cuando cambia de octavo. */
const vaultStep = (v = 0) => Math.round(Math.max(0, Math.min(1, v)) * 8);

/** Cifras de 3×5 píxeles para los precios de las marcas de obra. */
const DIGITS = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001001001001',
  '111101111101111',
  '111101111001111',
];

function tinyDigits(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.fillStyle = color;
  [...text].forEach((ch, i) => {
    const g = DIGITS[Number(ch)];
    if (!g) return;
    for (let k = 0; k < 15; k++)
      if (g[k] === '1') ctx.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1);
  });
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
  /** «Pocas luces» en Ajustes: solo los focos más cercanos al centro (para móviles lentos). */
  fewLights = false;
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
  /** La tira de fotogramas de las llamas (la misma para todas). */
  private flameImg = flameStrip();
  /** Muebles anclados a la pared del fondo de su sala (ver `pin`) y la vista con la que se ajustaron. */
  private pins: Pin[] = [];
  private pinnedAt = '';
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
  /** Lo tocable de las salas (el tablón, el mapa…) y lo que hay bajo el ratón. */
  private props: PropSpot[] = [];
  private hoverProp: PropSpot | null = null;
  /** Sitios para una obra: mientras los hay, solo se tocan ellos. */
  private targets: Spot[] | null = null;
  private chosen: string | null = null;
  private targetsKey = '';
  /** Lo que dio cada sala anoche: cifras que suben y se desvanecen encima de la sala. */
  /** Cifras que suben: comida o cerveza del día y, en obras, el precio (`coin`) de lo apuntado. */
  private floats: {
    rect: Rect | null;
    id?: string;
    n: number;
    beer: boolean;
    coin?: boolean;
    t0: number;
  }[] = [];
  /** Último sitio tocado en el mundo (para poner ahí el precio de una obra sin sala). */
  private lastTap: { x: number; y: number } | null = null;
  /** Salas que se están levantando tras pagar las obras (andamio, polvo y martillazos). */
  private raising: { id: string; t0: number; knock: number }[] = [];
  /** Marcas de siempre del modo obras: se tocan ellas y también las salas, sin mover la cámara. */
  private soft = false;
  private model: SceneModel | null = null;
  private key = '';
  /** El edificio con el que la gente buscó sitio por última vez. */
  private shape = '';
  private t = 0;
  private dayStart = 0;
  /** Hora del día que lleva el reloj de la partida (0 mañana, 1 noche); manda sobre la propia. */
  private clockTod: number | null = null;
  private dayAtNightfall = 0;
  private night: {
    start: number;
    dur: number;
    /** Segundos de más a oscuras (mientras dura un asalto, hasta que acabe). */
    hold: number;
    done: (() => void) | null;
  } | null = null;
  /** El asalto de esta noche: espera a que oscurezca y luego se ve entero (o se salta). */
  private raid: RaidShow | null = null;
  private raidPlan: RaidResult['plan'] | null = null;
  /** Zoom de antes del asalto (durante la pelea se acerca un poco). */
  private raidZoom: number | null = null;
  /** Por dónde entrarían los bandidos hasta la cámara: puntos del camino (en el mundo). */
  private routeIds = '';
  private routePts: { x: number; y: number }[] | null = null;
  private last = 0;
  private raf = 0;
  private pointers = new Map<number, Point>();
  private press: { x: number; y: number; moved: boolean; time: number } | null = null;
  /** Alguien cogido con el dedo: dónde está el dedo (css), la sala de debajo y si vale soltarlo ahí. */
  private drag: {
    id: string;
    x: number;
    y: number;
    moved: boolean;
    room: string | null;
    ok: boolean;
  } | null = null;
  /** Modo obras: la sala elegida, que se puede coger para moverla, y la que se lleva con el dedo. */
  private grabbable: string | null = null;
  private roomDrag: { id: string; x: number; y: number; moved: boolean; rect: Rect } | null = null;
  private pinch = 0;
  /** Rueda del ratón: lo que se lleva girado y cuándo fue el último salto de zoom. */
  private wheel = 0;
  private wheelAt = 0;
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
  setTargets(list: Spot[] | null, chosen: string | null = null, soft = false): void {
    // Elegir uno no mueve la cámara: solo una lista nueva de sitios.
    const key = list?.map((t) => `${t.id}:${t.rect.x},${t.rect.y}`).join(' ') ?? '';
    const fresh = key !== this.targetsKey;
    this.targetsKey = key;
    this.targets = list;
    this.chosen = chosen;
    this.soft = soft;
    this.hover = null;
    this.hoverProp = null;
    this.topLive = true;
    // Si no se ven todos, la cámara se aleja lo justo (sin pasarse) y los centra.
    if (soft || !fresh || !list?.length || !this.cssW) return;
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

  /** En el modo obras, la sala elegida se puede coger con el dedo para moverla (o ninguna). */
  setGrabbable(id: string | null): void {
    this.grabbable = id;
  }

  /** Rectángulo de una sala en el mundo (para anclar menús encima de ella). */
  roomRect(id: string): Rect | null {
    return this.spots.find((s) => s.id === `sala:${id}`)?.rect ?? null;
  }

  /** Marca el camino que harían los bandidos (ids de sala, del recibidor a la cámara), o lo quita. */
  setRoute(ids: string[] | null): void {
    const key = ids?.join(' ') ?? '';
    if (key === this.routeIds && (this.routePts !== null) === !!ids) return;
    this.routeIds = key;
    this.routePts = ids ? this.routePoints(ids) : null;
    this.topLive = true;
  }

  private routePoints(ids: string[]): { x: number; y: number }[] | null {
    const L = this.layout;
    if (!L) return null;
    const centers: Place[] = [{ x: -PATIO_W + 30, floor: 0 }];
    for (const id of ids) {
      const r = L.rooms.find((x) => x.room.id === id);
      if (!r) continue;
      const i = interior(r.rect);
      centers.push({ x: i.x + i.w / 2, floor: r.room.floor });
    }
    const out: { x: number; y: number }[] = [];
    const lift = 8;
    centers.forEach((c, k) => {
      if (k === 0) {
        out.push({ x: c.x, y: floorY(c.floor) - lift });
        return;
      }
      const prev = centers[k - 1]!;
      const path = route(L, prev, c) ?? [c];
      for (const q of path) out.push({ x: q.x, y: floorY(q.floor) - lift });
    });
    return out;
  }

  setModel(model: SceneModel): void {
    const prev = this.model?.building;
    this.model = model;
    const b = model.building;
    if (!b) return;
    const key = JSON.stringify([
      b,
      model.crest,
      model.facade,
      model.decor,
      model.tints,
      model.trophies,
      model.dog,
      model.gear,
      vaultStep(model.vault),
    ]);
    if (model.visitors) this.crowd.setVisitors(model.visitors);
    this.crowd.setTints(model.tints ?? {});
    if (key === this.key) {
      this.crowd.setPeople(model.heroes);
      return;
    }
    this.key = key;
    const L = roomsLayout(b);
    this.layout = L;
    this.rebuild(L, model);
    // Solo si cambia el edificio la gente busca sitio de nuevo: un escudo o un adorno nuevos
    // no sacan a nadie de la cama.
    const shape = JSON.stringify(b);
    if (shape !== this.shape) {
      this.shape = shape;
      this.crowd.setLayout(L);
    }
    this.crowd.setPois(this.poisOf(L));
    this.crowd.setPeople(model.heroes);
    if (this.routePts) this.routePts = this.routePoints(this.routeIds.split(' '));
    this.camera.world = { x0: L.x0, x1: L.x1, y0: L.y0, y1: L.y1 };
    // Cualquier sala puede quedar en el centro (y verse de frente), aunque esté en una esquina.
    this.camera.reach = { x0: L.left, x1: L.right, y0: floorTop(L.top), y1: floorY(L.deepest) };
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

  /**
   * Lo más lejos: lo que llene la pantalla de mundo o, si el edificio ya no cabe, lo justo para
   * verlo entero (con su tejado y sitio para los botones), sin bajar de un píxel de la pantalla
   * por píxel del juego (ni de medio de CSS, que se perdería el dibujo).
   */
  private minZoom(cssW: number, cssH: number): number {
    const L = this.layout;
    if (!L) return 1;
    const cover = Math.max(cssW / (L.x1 - L.x0), cssH / (L.y1 - L.y0));
    const w = L.right - L.left + 60;
    const h = floorY(L.deepest) + SLAB - (floorTop(L.top) - SLAB - ROOF_H) + 140;
    const fit = Math.min(cssW / w, cssH / h);
    const px = Math.max(0.5, 1 / (window.devicePixelRatio || 1));
    return Math.max(px, Math.ceil(Math.min(cover, fit) * 100) / 100);
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

  /** Un paso de zoom dejando quieto el punto del mundo que hay bajo (cssX, cssY). */
  zoomAt(step: number, cssX: number, cssY: number): void {
    const before = this.camera.toWorld(cssX, cssY);
    const z = this.camera.zoom;
    this.zoomBy(step);
    if (this.camera.zoom === z) return;
    const after = this.camera.toWorld(cssX, cssY);
    this.camera.drag(
      (after.x - before.x) * this.camera.zoom,
      (after.y - before.y) * this.camera.zoom,
      0,
    );
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

  nightfall(done: () => void, dur = 2.6, hold = 0): void {
    this.night?.done?.();
    this.dayAtNightfall = this.daylight().day;
    this.night = { start: this.t, dur, hold, done };
  }

  /**
   * Noche con asalto: al oscurecer llegan los bandidos y se ve la pelea sala a sala tal como la
   * ha decidido el núcleo; al acabar (o al saltarla), amanece.
   */
  raidNight(raid: Pick<RaidResult, 'plan'>, done: () => void): void {
    if (!raid.plan || !this.layout) return this.nightfall(done);
    this.raidPlan = raid.plan;
    this.nightfall(done, 2.6, Infinity);
  }

  skipRaid(): void {
    if (this.raid) this.raid.finish();
    else if (this.raidPlan && this.night) {
      // Aún no había empezado: se da por visto y amanece.
      this.raidPlan = null;
      this.night.hold = 0;
    }
  }

  /** La hora del reloj de la partida: el cielo y la gente la siguen. */
  setTime(tod: number): void {
    this.clockTod = Math.max(0, Math.min(1, tod));
  }

  /** Al amanecer, lo que hizo cada sala sube flotando sobre ella (raciones y jarras). */
  yields(list: RoomYield[]): void {
    list.forEach((y, i) => {
      const spot = this.spots.find((s) => s.id === `sala:${y.room}`);
      const n = y.food ?? y.beer ?? 0;
      if (spot && n > 0)
        this.floats.push({ rect: spot.rect, n, beer: !y.food, t0: this.t + 0.3 + i * 0.35 });
    });
  }

  /**
   * Las obras pagadas se levantan a la vista: cada sala tocada sale con andamio, polvo y
   * martillazos un par de segundos, una detrás de otra.
   */
  raise(ids: string[]): void {
    const gap = Math.min(0.5, 2 / Math.max(1, ids.length));
    ids.forEach((id, i) => {
      const t0 = this.t + i * gap;
      this.raising.push({ id, t0, knock: t0 });
    });
  }

  /**
   * El precio de una obra apuntada sube flotando: sobre su sala (si la tiene) o donde se tocó.
   * Negativo, lo que se recupera.
   */
  priceTag(id: string | null, n: number): void {
    const at = this.lastTap;
    const rect = id ? null : at ? { x: at.x - 40, y: at.y - 20, w: 80, h: 40 } : null;
    if (!id && !rect) return;
    this.floats.push({ rect, id: id ?? undefined, n, beer: false, coin: true, t0: this.t });
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
    const plateau = 0.15 * n.dur + n.hold;
    if (te < a) return te / n.dur;
    if (te < a + plateau) return 0.35 + (0.15 * (te - a)) / plateau;
    return 0.5 + (te - a - plateau) / n.dur;
  }

  private nightLight(): NightLight {
    if (!this.night) return { dark: 0, warm: 0 };
    const p = this.nightP();
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));
    return {
      // Con asalto, algo menos oscuro: que se vea la pelea.
      dark: ramp(0, 0.35) * (1 - ramp(0.5, 0.9)) * (this.raid ? 0.45 : 1),
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
    this.pins = [];
    this.pinnedAt = '';
    this.towerRect = null;
    this.props = [];
    this.hoverProp = null;
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
    // Más tierra a los lados y negro debajo: al alejar la cámara o centrar una sala de una
    // esquina, la vista se sale del mundo. Un trozo de tierra que se repite (`TILE`).
    const n = Math.ceil(TERRAIN_PAD / TILE);
    const tx0 = F.x - n * TILE;
    const tx1 = fx1 + n * TILE;
    const dark = { ambient: EARTH, sun: 0, repeat: n };
    this.plane(
      g,
      earthBuf(TILE, fy1 - GROUND, true),
      [at(tx0, fy1, 0), at(F.x, fy1, 0), at(F.x, GROUND, 0), at(tx0, GROUND, 0)],
      dark,
    );
    this.plane(
      g,
      earthBuf(TILE, fy1 - GROUND, false),
      [at(fx1, fy1, 0), at(tx1, fy1, 0), at(tx1, GROUND, 0), at(fx1, GROUND, 0)],
      dark,
    );
    const black = new PixelBuffer(1, 1);
    black.set(0, 0, P.black);
    this.plane(
      g,
      black,
      [
        at(tx0, fy1 + TERRAIN_PAD, 0),
        at(tx1, fy1 + TERRAIN_PAD, 0),
        at(tx1, fy1, 0),
        at(tx0, fy1, 0),
      ],
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
          back: stairBack(themeOf(s.floor), interior(s.rect).w, s.rect.h, s.floor, s.steps),
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
    // A los lados, un trozo de patio y otro de hierba que se repiten (`TILE`) hasta muy lejos.
    const reps = (from: number) => Math.ceil((from + TERRAIN_PAD) / TILE);
    const nl = reps(L.left - L.x0);
    const nr = reps(L.x1 - L.right);
    const x0 = L.left - nl * TILE;
    const x1 = L.right + nr * TILE;
    this.plane(
      g,
      groundTex(TILE, YARD_D / 2, true, 'patio', false),
      [
        at(x0, GROUND, 0),
        at(L.left, GROUND, 0),
        at(L.left, GROUND, YARD_D),
        at(x0, GROUND, YARD_D),
      ],
      { ...yard, repeat: nl },
    );
    this.plane(
      g,
      groundTex(TILE, YARD_D / 2, false, 'solares'),
      [
        at(L.right, GROUND, 0),
        at(x1, GROUND, 0),
        at(x1, GROUND, YARD_D),
        at(L.right, GROUND, YARD_D),
      ],
      { ...yard, repeat: nr },
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
    // Dentro del ancho del edificio, donde la planta baja está vacía (un solar sin construir,
    // a menudo encima de un hueco excavado), también hay terreno: si no, se vería el hueco.
    const used: [number, number][] = [];
    for (const { room, rect } of L.rooms)
      if (room.type !== 'torre' && room.floor <= 0 && room.floor + room.h > 0)
        used.push([rect.x, rect.x + rect.w]);
    for (const s of stairCells(L)) if (s.floor === 0) used.push([s.rect.x, s.rect.x + s.rect.w]);
    used.sort((a, c) => a[0] - c[0]);
    let gx = L.left;
    for (const [a, c] of [...used, [L.right, L.right] as [number, number]]) {
      if (a > gx + 1)
        this.plane(
          g,
          groundTex(Math.round(a - gx), back / 2, false, `solar${Math.round(gx)}`),
          [at(gx, GROUND, 0), at(a, GROUND, 0), at(a, GROUND, back), at(gx, GROUND, back)],
          yard,
        );
      gx = Math.max(gx, c);
    }
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
          pos: at(cx, base - lift - (img.h - towerLampY(tower.room.level)) / k, DEPTH / 2 - 8),
          glow: at(cx, base - lift - (img.h - towerLampY(tower.room.level)) / k, DEPTH / 2),
          r: 60,
          color: [255, 168, 92],
          power: 0.9,
          flicker: 0.2,
          zone: [cx - 60, GROUND - base + lift, cx + 60, GROUND - base + lift + 140],
          seed: 7,
          fire: true,
          halo: haloOf(60, 0.9, false),
        });
      }
    }
  }

  private covers(r: Room, c: number, f: number): boolean {
    return r.type !== 'torre' && c >= r.col && c < r.col + r.w && f >= r.floor && f < r.floor + r.h;
  }

  /** Caja de una sala con sus muebles, sus faroles y, si está en obras, el andamio delante. */
  private roomBox(plain: Room, rect: Rect, b: Building): void {
    // Vestida con su tema de color: el arte de las telas lo lee de ella.
    const room = dress(plain, this.model?.tints);
    const r = interior(rect);
    const dim = ruined(room) || bare(room);
    const ambient = dim ? ROOM_DIM : room.floor < 0 ? ROOM_DEEP : ROOM_LIT;
    const sun =
      room.floor < 0 ? 0 : room.type === 'tesoro' || room.type === 'despensa' ? 0.15 : 0.55;
    const theme = themeOf(room.floor);
    const seed = `${room.id}${room.type}`;
    const sides = sidesOf(b, room);
    // Sin nada debajo de su primer o último hueco, la pared de fuera baja hasta debajo del forjado.
    const free = (c: number) =>
      room.floor > 0 && !b.rooms.some((o) => this.covers(o, c, room.floor - 1));
    const back = backWall(room, r.w, r.h, this.salonLook());
    // Lo tocable que se ha pintado en la pared (en sus píxeles), pasado al mundo.
    const live = room.level > 0 && !(room.works && room.works.kind !== 'extend');
    const tx = r.w / back.w;
    const ty = r.h / back.h;
    if (live)
      for (const a of takeWallActs())
        this.props.push({
          act: a.act,
          room: room.id,
          x0: r.x + a.x * tx,
          y0: r.y + a.y * ty,
          x1: r.x + (a.x + a.w) * tx,
          y1: r.y + (a.y + a.h) * ty,
          z: DEPTH,
        });
    this.box(rect, theme, ambient, sun, seed, {
      back,
      floorTex: floorTex(room, theme, r.w, seed),
      sides,
      floor: room.floor,
      door: room.type === 'recibidor' ? room.level : undefined,
      hang: { left: free(room.col), right: free(room.col + room.w - 1) },
      room,
    });
    // En voladizo (sin nada debajo), la cara de abajo del suelo, que se ve desde el patio.
    if (room.floor > 0) {
      const under = { ambient: OUTDOOR, sun: 0.6, dither: 0 };
      const y = r.y + r.h + SLAB;
      const last = room.col + room.w - 1;
      for (let c = room.col; c <= last; c++) {
        if (b.rooms.some((o) => this.covers(o, c, room.floor - 1))) continue;
        // Hasta la cara de fuera del muro donde da al aire; si no, hasta media pared.
        const x0 = c === room.col && sides.left[0] === 'aire' ? rect.x - WALL : colX(b, c);
        const x1 =
          c === last && sides.right[0] === 'aire' ? rect.x + rect.w + WALL : colX(b, c) + CELL_W;
        this.plane(
          this.world,
          ceilingTex('madera', Math.round(x1 - x0), `${seed}bajo${c}`),
          [at(x0, y, DEPTH), at(x1, y, DEPTH), at(x1, y, 0), at(x0, y, 0)],
          under,
        );
      }
    }
    const zone = this.zoneOf(rect);
    const floor3 = GROUND - (r.y + r.h);
    const ceil3 = GROUND - r.y;
    for (const th of furnish(room, r.w, this.salonLook())) {
      const k = scaleAt(th.z);
      const h = th.img.h / k;
      const x = r.x + th.x;
      const bottom = th.hang ? ceil3 - h - th.y : floor3 + th.y;
      this.figure(this.world, th.img, x, GROUND - bottom, th.z, ambient, sun, {
        wall: { r, back },
        box: th.box,
      });
      if ((th.act || th.poi) && live)
        this.props.push({
          act: th.act,
          poi: th.poi,
          room: room.id,
          x0: x - th.img.w / k / 2,
          y0: GROUND - bottom - h,
          x1: x + th.img.w / k / 2,
          y1: GROUND - bottom,
          z: th.z,
        });
      if (th.light) this.addLight(th.light, x, bottom, th.z, zone, sun < 0.2);
    }
    if (room.works) {
      const k = scaleAt(3);
      const img = scaffold(r.w * k, r.h * k);
      this.figure(this.world, img, r.x + r.w / 2, r.y + r.h, 3, ROOM_DIM, sun);
    }
  }

  /** Lo que el salón enseña de la partida: decoración, escudo, trofeos y el perro. */
  private salonLook(): SalonLook {
    const m = this.model;
    if (!m) return NO_LOOK;
    return {
      decor: m.decor,
      crest: m.crest,
      trophies: m.trophies,
      dog: m.dog,
      gear: m.gear,
      gearRoom: m.building ? gearRoom(m.building) : null,
      vault: vaultStep(m.vault) / 8,
    };
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

  private addLight(
    l: Glow,
    x: number,
    bottom: number,
    z: number,
    zone: Lamp['zone'],
    deep = false,
  ): void {
    const k = scaleAt(z);
    const y = bottom + l.dy / k;
    this.lamps.push({
      pos: new Vector3(x, y, -z + 6),
      glow: new Vector3(x, y, -z),
      r: l.r,
      color: l.color,
      power: l.power,
      flicker: l.flicker,
      zone,
      seed: Math.round(x * 7 + y * 13),
      fire: l.flicker >= 0.2,
      deep,
      halo: l.flames?.length
        ? Math.max(8, Math.round(22 * Math.max(...l.flames.map((f) => f.size))))
        : haloOf(l.r, l.power, false),
    });
    for (const f of l.flames ?? []) {
      // Una llama de pixel art que cambia de fotograma (ver `draw`); sin luz: brilla sola.
      const w = FLAME_W * f.size * 0.9;
      const h = FLAME_H * f.size * 0.9;
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
        this.look.glow(this.flameImg, FLAME_FRAMES),
      );
      m.scale.setScalar(1 / k);
      m.position.set(x + f.dx / k, bottom + (f.dy + l.dy - 8) / k, -z + 0.6);
      this.world.add(m);
      this.flames.push(m);
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
      /** La puerta de la calle (en el recibidor), con su nivel. */
      door?: number;
      /** Sin sala debajo del hueco de cada lado (en voladizo). */
      hang?: { left: boolean; right: boolean };
      /** La sala (para los acabados de sus lados). */
      room?: Room;
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
      sideTex(
        theme,
        r.h,
        doors(o.sides.left),
        `${seed}i`,
        o.door !== undefined ? [0] : [],
        o.door,
        o.room,
      ),
      [at(x0, yb, 0), at(x0, yb, D), at(x0, yt, D), at(x0, yt, 0)],
      flat,
    );
    this.plane(
      g,
      mirror(sideTex(theme, r.h, doors(o.sides.right), `${seed}d`, [], 1, o.room)),
      [at(x1, yb, D), at(x1, yb, 0), at(x1, yt, 0), at(x1, yt, D)],
      flat,
    );
    // Paredes de fuera, planta a planta, donde el hueco da al aire.
    const outdoor = { ambient: OUTDOOR, sun: 1, dither: 0 };
    let doorDone = o.door === undefined;
    for (const [side, list] of [
      ['left', o.sides.left],
      ['right', o.sides.right],
    ] as const)
      list.forEach((s, i) => {
        if (s !== 'aire') return;
        const f = o.floor + i;
        const top = floorTop(f) - SLAB;
        const bottom = floorY(f) + (i === 0 && o.hang?.[side] ? SLAB : 0);
        const withDoor = !doorDone && i === 0;
        if (withDoor) doorDone = true;
        const tex = outerSide(themeOf(f), PITCH, withDoor, `${seed}f${side}${i}`, o.door);
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
    // Árboles a varias profundidades a los lados: con la perspectiva, cada uno se mueve a su
    // paso al mover la cámara (los de más al fondo, menos).
    const trees: [number, number, boolean, number][] = [
      [px - 40, 36, true, 92],
      [px - 95, 120, false, 78],
      [px - 150, 62, true, 84],
      [px - 210, 180, true, 96],
      [px - 270, 95, false, 70],
      [px + 20, 206, false, 74],
      [L.right + 120, 48, true, 90],
      [L.right + 175, 150, false, 80],
      [L.right + 235, 82, true, 76],
      [L.right + 300, 196, true, 98],
      [L.right + 360, 120, false, 72],
    ];
    for (const [tx, depth, conifer, h] of trees)
      put(conifer ? Prop.pine(`pino${tx}`, h) : Prop.oakTree(`roble${tx}`, h), tx, depth);
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
      // La fachada: lo que se ve desde el camino.
      const facade = model.facade ?? [];
      if (facade.includes('letrero')) put(Prop.nameBoard(), dx - 26, 3, 74);
      if (facade.includes('flores')) {
        put(Prop.flowerPot('flores1'), dx - 36, 5);
        put(Prop.flowerPot('flores2'), dx - 50, 9);
      }
      if (facade.includes('banderines'))
        put(Prop.bunting(120, model.crest.field, P.lemon), dx - 70, 30, 62);
      if (facade.includes('faroles'))
        for (const lx of [px + 70, px + 150]) {
          put(Prop.lampPost(), lx, 24);
          this.lamps.push({
            pos: at(lx, GROUND - 36, 24),
            glow: at(lx, GROUND - 36, 24),
            r: 50,
            color: LANTERN,
            power: 0.9,
            flicker: 0.1,
            zone: [lx - 60, -SLAB, lx + 60, 140],
            seed: lx,
            fire: false,
            halo: haloOf(50, 0.9, false),
          });
        }
      this.lamps.push({
        pos: at(dx - 8, GROUND - 52, 0),
        glow: at(dx - 8, GROUND - 51, 4),
        r: 60,
        color: LANTERN,
        power: 1,
        flicker: 0.1,
        zone: [px - 40, -SLAB, dx + PARTITION / 2, 140],
        seed: 3,
        fire: false,
        halo: haloOf(60, 1, false),
      });
    }
  }

  /**
   * Figura plana a `depth`, del tamaño de su dibujo; (x, base) del mundo 2D. Con `wall`, anclada
   * a esa pared (`pin`); con `box`, con volumen hasta ella (`volume`).
   */
  private figure(
    g: Group,
    img: PixelBuffer,
    x: number,
    base: number,
    depth: number,
    ambient: Tint,
    sun: number,
    o: { wall?: { r: Rect; back: PixelBuffer }; box?: boolean } = {},
  ): void {
    const k = scaleAt(depth);
    const w = img.w / k;
    const h = img.h / k;
    const corners: Corners = [
      at(x - w / 2, base, depth),
      at(x + w / 2, base, depth),
      at(x + w / 2, base - h, depth),
      at(x - w / 2, base - h, depth),
    ];
    const m = mesh(
      quad(corners, this.look),
      this.look.surface(img, corners, { ambient, sun, wrap: 0.6, dither: 0.03 }),
    );
    // Con volumen, la cara y sus lados van juntos (y se anclan juntos).
    const obj = o.box ? new Group() : m;
    if (o.box) {
      obj.add(m);
      this.volume(obj as Group, img, x - w / 2, base - h, depth, ambient, sun);
    }
    g.add(obj);
    const wall = o.wall;
    if (!wall) return;
    // El ancla: la junta de téxeles de la pared que cae junto al mueble (vista con la sala en el
    // centro). Los téxeles de la pared no miden justo un píxel (su ancho se redondea), así que
    // vale la de al lado y no la esquina de la pared.
    const { r, back } = wall;
    const tw = r.w / back.w;
    const th = r.h / back.h;
    const ex = r.x + r.w / 2;
    const ey = r.y + r.h / 2 - LIFT;
    const xl = x - w / 2;
    const yt = base - h;
    const wx = r.x + Math.round((ex + ((xl - ex) * k) / BACK - r.x) / tw) * tw;
    const wy = r.y + Math.round((ey + ((yt - ey) * k) / BACK - r.y) / th) * th;
    this.pins.push({ mesh: obj, x: xl, y: yt, k, wx, wy });
  }

  /**
   * Los lados y la parte de arriba de una figura con volumen: salen de su silueta (`faces`) y van
   * de su cara hasta la pared del fondo, como una caja. La perspectiva hace que al mover la
   * cámara se le vea el costado.
   */
  private volume(
    g: Group,
    img: PixelBuffer,
    left: number,
    top: number,
    depth: number,
    ambient: Tint,
    sun: number,
  ): void {
    const k = scaleAt(depth);
    const back = DEPTH - 0.5;
    // A lo hondo, un téxel cada dos de mundo (se ve muy de lado: no hace falta más).
    const n = Math.max(2, Math.round((back - depth) / 2));
    const X = (px: number) => left + px / k;
    const Y = (py: number) => top + py / k;
    const opts = { ambient, sun, wrap: 0.6, dither: 0.03 };
    for (const f of faces(img)) {
      const len = f.to - f.from;
      if (f.side === 'top') {
        const tex = new PixelBuffer(len, n);
        for (let i = 0; i < len; i++) for (let j = 0; j < n; j++) tex.set(i, j, f.colors[i]!);
        const y = Y(f.at);
        const [x0, x1] = [X(f.from), X(f.to)];
        this.plane(
          g,
          tex,
          [at(x0, y, depth), at(x1, y, depth), at(x1, y, back), at(x0, y, back)],
          opts,
        );
        continue;
      }
      const tex = new PixelBuffer(n, len);
      for (let j = 0; j < len; j++) for (let i = 0; i < n; i++) tex.set(i, j, f.colors[j]!);
      const x = X(f.at);
      const [y0, y1] = [Y(f.from), Y(f.to)];
      // Cada cara mira hacia fuera (las de detrás no se pintan): la izquierda, del fondo hacia
      // delante; la derecha, de delante hacia el fondo.
      const corners: Corners =
        f.side === 'left'
          ? [at(x, y1, back), at(x, y1, depth), at(x, y0, depth), at(x, y0, back)]
          : [at(x, y1, depth), at(x, y1, back), at(x, y0, back), at(x, y0, depth)];
      this.plane(g, tex, corners, opts);
    }
  }

  /**
   * Cada mueble, a un número entero de píxeles de la pared del fondo de su sala. Por su
   * profundidad, al mover la cámara avanzan a otro paso que la pared (la perspectiva) y, al
   * redondear cada uno a su píxel por su lado, el mueble bailaba un píxel adelante y atrás contra
   * la pared. Así la distancia que da la perspectiva se redondea una sola vez y cambia de píxel
   * en píxel, siempre hacia el mismo lado.
   */
  private pin(view: View): void {
    const key = `${view.px},${view.py},${view.vw},${view.vh}`;
    if (key === this.pinnedAt) return;
    this.pinnedAt = key;
    for (const p of this.pins) {
      const d = pinShift(view, p, p.k, p.wx, p.wy);
      p.mesh.position.x = d.x;
      p.mesh.position.y = -d.y;
    }
  }

  private plane(
    g: Group,
    img: PixelBuffer,
    corners: Corners,
    o: { ambient: Tint; sun: number; wrap?: number; dither?: number; repeat?: number },
  ): ShaderMaterial {
    const m = this.look.surface(img, corners, o);
    g.add(mesh(quad(corners, this.look), m));
    return m;
  }

  // ---------- Simulación y dibujo ----------

  private update(dt: number): void {
    this.t += dt;
    if (this.night) this.raidStep(dt);
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
    this.crowd.setClock(this.night ? 1 : tod);
    this.crowd.update(dt, this.t);
    this.edgePan(dt);
    if (this.marker && this.t > this.marker.until) this.marker = null;
    this.camera.update(dt);
    this.particles.update(dt, this.t);
  }

  /** El asalto: empieza a oscuras, la cámara sigue a los bandidos y, al acabar, sigue la noche. */
  private raidStep(dt: number): void {
    const n = this.night!;
    const dark = this.t - n.start >= 0.35 * n.dur;
    if (this.raidPlan && dark && this.layout) {
      this.crowd.setScripted(true);
      this.raid = new RaidShow(this.raidPlan, this.layout, this.crowd, {
        burst: (kind, x, y, k) => {
          for (let i = 0; i < k; i++)
            this.particles.spawn(
              kind,
              x + (Math.random() - 0.5) * 8,
              y + (Math.random() - 0.5) * 6,
            );
        },
        sound: (name, v) => this.cb.onSound?.(name, v ?? 1),
      });
      this.raidPlan = null;
      this.raidZoom = this.camera.zoom;
      const z = Math.min(6, Math.max(3, Math.floor(this.camera.zoom) + 1));
      if (this.cssW && z !== this.camera.zoom) this.resize(this.cssW, this.cssH, z);
    }
    const raid = this.raid;
    if (!raid) return;
    if (!raid.done) {
      raid.update(dt);
      const f = raid.focus();
      if (f && !this.pointers.size) this.camera.centerOn(f.x, f.y);
      return;
    }
    // Se acabó: la noche sigue su curso hasta el amanecer.
    if (n.hold === Infinity) n.hold = Math.max(0, this.t - n.start - 0.5 * n.dur);
    if (this.nightP() >= 0.85) {
      this.crowd.setScripted(false);
      this.raid = null;
      if (this.raidZoom !== null && this.cssW) this.resize(this.cssW, this.cssH, this.raidZoom);
      this.raidZoom = null;
    }
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
    this.pin(view);
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
    const n = Math.min(near.length, this.fewLights ? FEW_LIGHTS : MAX_LIGHTS);
    const tex = s.uLights.value;
    const data = tex.image.data as unknown as Float32Array;
    const row = MAX_LIGHTS * 4;
    for (let i = 0; i < n; i++) {
      const l = near[i]!;
      const fl = 1 - l.flicker * noise(Math.floor(t * 9), l.seed);
      const k = (l.deep ? 1 : l.fire ? fireK : lampK) * l.power * fl;
      data.set([l.pos.x, l.pos.y, l.pos.z, l.r], i * 4);
      data.set(
        [(l.color[0] / 255) * k, (l.color[1] / 255) * k, (l.color[2] / 255) * k, l.halo],
        row + i * 4,
      );
      data.set(l.zone, 2 * row + i * 4);
      data.set([l.glow.x, l.glow.y, l.glow.z, 0], 3 * row + i * 4);
    }
    s.uLightCount.value = n;
    tex.needsUpdate = true;
    // Cada llama, a su aire: otro fotograma y algo más alta o más baja cada poco.
    for (const m of this.flames) {
      const tick = Math.floor(t * 9);
      const u = (m.material as ShaderMaterial).uniforms.uUvOffset!.value;
      u.x = Math.floor(noise(tick, m.id) * FLAME_FRAMES) / FLAME_FRAMES;
      m.scale.y = m.scale.x * (0.8 + noise(tick, m.id + 17) * 0.4);
    }

    // El cielo, solo cuando cambia (la cámara se mueve o pasa un rato).
    const skyKey = `${view.px},${view.py},${Math.floor(t * 8)},${view.vw},${view.vh}`;
    if (skyKey !== this.skyAt) {
      this.skyAt = skyKey;
      // El horizonte: donde acaba el terreno, al fondo (con la perspectiva, sube y baja con la cámara).
      const hz = project(view, view.px + view.vw / 2, GROUND, YARD_D).y;
      this.sky.draw(this.skyCtx, view.px, view.vw, view.vh, t, dl, nl, hz);
      this.skyTex.needsUpdate = true;
    }

    // Partículas y la marca de la sala señalada, en una lámina por delante.
    const live =
      this.particles.list.length > 0 ||
      !!this.hover ||
      !!this.hoverProp ||
      !!this.hoverHero ||
      !!this.marker ||
      !!this.targets?.length ||
      this.floats.length > 0 ||
      !!this.drag?.moved ||
      !!this.roomDrag?.moved ||
      this.raising.length > 0 ||
      !!this.raid ||
      !!this.routePts ||
      (!this.night && !!this.model?.heroes.some((h) => h.train)) ||
      this.crowd.drilling() ||
      this.crowd.bubbles().length > 0;
    if (live || this.topLive) {
      const ctx = this.topCtx;
      ctx.clearRect(0, 0, view.vw, view.vh);
      if (this.routePts && !this.raid) this.raidRoute(this.routePts);
      if (this.targets) this.marks(this.targets);
      this.roomGhost();
      this.scaffolds();
      this.dropMark();
      this.trainBars();
      this.talkBubbles();
      this.flyingArrows();
      this.raid?.draw(ctx, view.px, view.py);
      this.particles.draw(ctx, view.px, view.py, t);
      this.floatUp();
      if (this.hover) this.brackets(this.hover.rect);
      if (this.hoverProp) this.brackets(this.propRect(this.hoverProp, view));
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
      if (s.blocked) {
        // Tachada: borde rojo de puntos y una cruz en medio.
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = P.red;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.red;
        for (let i = beat; i < w; i += 4) {
          ctx.fillRect(x + i, y, 2, 1);
          ctx.fillRect(x + i, y + h - 1, 2, 1);
        }
        for (let i = beat; i < h; i += 4) {
          ctx.fillRect(x, y + i, 1, 2);
          ctx.fillRect(x + w - 1, y + i, 1, 2);
        }
        const cx = Math.round(x + w / 2);
        const cy = Math.round(y + h / 2);
        for (let k = -4; k <= 4; k++) {
          ctx.fillRect(cx + k, cy + k, 1, 1);
          ctx.fillRect(cx + k, cy - k, 1, 1);
        }
        continue;
      }
      const tone = s.remove ? P.coral : P.lime;
      ctx.globalAlpha = on ? 0.45 : 0.18;
      ctx.fillStyle = on ? P.gold : tone;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = on ? P.lemon : tone;
      for (let i = beat; i < w; i += 4) {
        ctx.fillRect(x + i, y, 2, 1);
        ctx.fillRect(x + i, y + h - 1, 2, 1);
      }
      for (let i = beat; i < h; i += 4) {
        ctx.fillRect(x, y + i, 1, 2);
        ctx.fillRect(x + w - 1, y + i, 1, 2);
      }
      if (on) this.brackets(s.rect);
      // El precio en medio, en una placa oscura, como en las obras de un refugio.
      const cost = /· (\d+)$/.exec(s.label)?.[1];
      if (cost) {
        const tw = cost.length * 4 + 6;
        const cx = Math.round(x + w / 2 - tw / 2);
        const cy = Math.round(y + h / 2 - 4);
        ctx.fillStyle = P.black;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(cx - 2, cy - 2, tw + 3, 9);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.gold;
        ctx.fillRect(cx, cy + 1, 3, 3);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(cx + 1, cy + 1, 1, 1);
        // Lo que devuelve, en verde, como el precio que sube al quitarlo.
        tinyDigits(ctx, cost, cx + 5, cy, on ? P.lemon : s.remove ? P.lime : P.white);
      }
    }
  }

  /** Las cifras de lo que dio cada sala: «+12» con su pan o su jarra, en una placa oscura y a doble tamaño. */
  private floatUp(): void {
    const { topCtx: ctx, camera } = this;
    const LIFE = 3.2;
    this.floats = this.floats.filter((f) => this.t - f.t0 < LIFE);
    for (const f of this.floats) {
      const k = this.t - f.t0;
      const rect = f.rect ?? (f.id ? this.roomRect(f.id) : null);
      if (k < 0 || !rect) continue;
      const text = String(Math.abs(f.n));
      const tw = 10 + text.length * 4;
      const x = Math.round(rect.x + rect.w / 2 - camera.px - tw);
      const y = Math.round(rect.y + rect.h * 0.4 - camera.py - Math.min(1, k / 1.2) * 16);
      const alpha = k > LIFE - 0.8 ? (LIFE - k) / 0.8 : Math.min(1, k * 4);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2, 2);
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = P.black;
      ctx.fillRect(-2, -2, tw + 3, 9);
      ctx.globalAlpha = alpha;
      // La moneda, el pan o la jarra.
      if (f.coin) {
        ctx.fillStyle = P.gold;
        ctx.fillRect(0, 1, 5, 3);
        ctx.fillRect(1, 0, 3, 5);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(1, 1, 2, 2);
      } else if (f.beer) {
        ctx.fillStyle = P.gold;
        ctx.fillRect(0, 1, 4, 4);
        ctx.fillStyle = P.white;
        ctx.fillRect(0, 0, 4, 1);
        ctx.fillStyle = P.lemon;
        ctx.fillRect(4, 2, 1, 2);
      } else {
        ctx.fillStyle = P.tan;
        ctx.fillRect(0, 1, 5, 3);
        ctx.fillRect(1, 0, 3, 1);
        ctx.fillStyle = P.clay;
        ctx.fillRect(0, 4, 5, 1);
      }
      // El signo y la cifra (en obras, menos lo que se gasta y más lo que se recupera).
      const spent = f.coin && f.n > 0;
      const c = spent ? P.coral : f.coin ? P.lime : f.beer ? P.lemon : P.white;
      ctx.fillStyle = c;
      ctx.fillRect(6, 2, 3, 1);
      if (!spent) ctx.fillRect(7, 1, 1, 3);
      tinyDigits(ctx, text, 10, 0, c);
      ctx.restore();
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
    const inside = (s: Spot) =>
      wx >= s.rect.x && wx < s.rect.x + s.rect.w && wy >= s.rect.y && wy < s.rect.y + s.rect.h;
    const room = this.spots.find(inside) ?? null;
    const target = this.targets?.find((t) => inside(t) && !(t.blocked && room));
    if (target || (this.targets && !this.soft)) return target ?? null;
    return room;
  }

  /**
   * Los sitios a los que la gente va a hacer algo: leer el tablón y los mapas, calentarse en la
   * chimenea y rezar ante el altar (con la planta de su sala).
   */
  private poisOf(L: RoomsLayout): Poi[] {
    const out: Poi[] = [];
    for (const p of this.props) {
      const kind: PoiKind | undefined =
        p.poi ?? (p.act === 'tablon' || p.act === 'mapa' ? 'read' : undefined);
      const room = L.rooms.find((r) => r.room.id === p.room)?.room;
      if (!kind || !room) continue;
      out.push({ x: (p.x0 + p.x1) / 2, floor: room.floor, kind, half: (p.x1 - p.x0) / 2 });
    }
    return out;
  }

  /** Los bocadillos de quien habla: un globo blanco con su icono encima de la cabeza. */
  private talkBubbles(): void {
    const { topCtx: ctx, camera } = this;
    for (const b of this.crowd.bubbles()) {
      const r = this.heroRect(b.id);
      if (!r) continue;
      const w = 11;
      const h = 9;
      const x = Math.round(r.x + r.w / 2 - camera.px - 2);
      const y = Math.round(r.y - camera.py) - h + 3;
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 1, y, w + 2, h);
      ctx.fillRect(x, y - 1, w, h + 2);
      ctx.fillRect(x + 1, y + h, 3, 2);
      ctx.fillStyle = P.white;
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x + 2, y + h, 1, 1);
      TALK_ICONS[b.talk].forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const c = TALK_INK[row[i]!];
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect(x + 2 + i, y + 2 + j, 1, 1);
        }
      });
    }
  }

  /** Recuadro de una cosa tocable en el plano de corte (donde se ve con la vista de ahora). */
  private propRect(p: PropSpot, v: View): Rect {
    const a = project(v, p.x0, p.y0, p.z);
    const b = project(v, p.x1, p.y1, p.z);
    return { x: a.x + v.px, y: a.y + v.py, w: b.x - a.x, h: b.y - a.y };
  }

  /** La cosa tocable bajo un punto de la pantalla (la de delante), salvo en obras. */
  private propAt(cssX: number, cssY: number): PropSpot | null {
    if (this.targets) return null;
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    const x = camera.px + cssX / camera.zoom;
    const y = camera.py + cssY / camera.zoom;
    let best: PropSpot | null = null;
    for (const p of this.props) {
      if (!p.act) continue;
      const r = this.propRect(p, v);
      if (x < r.x || x >= r.x + r.w || y < r.y || y >= r.y + r.h) continue;
      if (!best || p.z < best.z) best = p;
    }
    return best;
  }

  /** La persona que hay bajo un punto de la pantalla (no mientras se elige sitio para una obra). */
  private heroAt(cssX: number, cssY: number): string | null {
    if (this.targets && !this.soft) return null;
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    return this.crowd.hit(v, cssX / camera.zoom, cssY / camera.zoom);
  }

  private click(cssX: number, cssY: number): void {
    const w = this.camera.toWorld(cssX, cssY);
    this.lastTap = w;
    const who = this.heroAt(cssX, cssY);
    if (who) {
      const p = this.heroPosition(who);
      this.cb.onHero?.(who, { x: cssX, y: cssY, wx: p?.x ?? w.x, wy: p?.y ?? w.y });
      return;
    }
    const prop = this.propAt(cssX, cssY);
    if (prop) {
      this.cb.onSound?.('click', 0.5);
      this.cb.onHotspot?.(`cosa:${prop.act!}:${prop.room}`, ACT_LABEL[prop.act!], {
        x: cssX,
        y: cssY,
        wx: w.x,
        wy: w.y,
      });
      return;
    }
    const h = this.hit(w.x, w.y);
    if (!h) return;
    this.cb.onSound?.('click', 0.5);
    this.cb.onHotspot?.(h.id, h.label, { x: cssX, y: cssY, wx: w.x, wy: w.y });
  }

  // ---------- Arrastrar personas ----------

  /** La sala que hay bajo un punto de la pantalla (id), si hay. */
  private roomAt(cssX: number, cssY: number): string | null {
    const w = this.camera.toWorld(cssX, cssY);
    const h = this.hit(w.x, w.y);
    return h?.id.startsWith('sala:') ? h.id.slice(5) : null;
  }

  private moveDrag(p: Point): void {
    const d = this.drag!;
    d.x = p.x;
    d.y = p.y;
    if (!d.moved && this.press && Math.hypot(p.x - this.press.x, p.y - this.press.y) > 6) {
      d.moved = true;
      this.press.moved = true;
      this.cb.onSound?.('click', 0.4);
    }
    if (!d.moved) return;
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    this.crowd.hold(d.id, v, p.x / camera.zoom, p.y / camera.zoom);
    d.room = this.roomAt(p.x, p.y);
    d.ok = !!this.cb.onDragOver?.(d.id, d.room, p)?.ok;
    this.hover = null;
    this.cb.onHover?.(null, null);
  }

  /** Suelta a quien se lleva: si la sala vale, se queda allí; si no, vuelve a donde estaba. */
  private endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const r = d.ok && d.room ? this.layout?.rooms.find((x) => x.room.id === d.room) : undefined;
    if (r) {
      const w = this.camera.toWorld(d.x, d.y);
      const x = Math.max(r.rect.x + 12, Math.min(r.rect.x + r.rect.w - 12, w.x));
      this.crowd.drop(d.id, { x, floor: r.room.floor });
      this.cb.onDrop?.(d.id, d.room);
      this.cb.onSound?.('build', 0.5);
    } else {
      this.crowd.drop(d.id, null);
      this.cb.onDrop?.(d.id, null);
    }
  }

  /** La casilla de mudanza bajo un punto de la pantalla (si es válida). */
  private moveTargetAt(cssX: number, cssY: number): Spot | null {
    const w = this.camera.toWorld(cssX, cssY);
    return (
      this.targets?.find(
        (t) =>
          !t.blocked &&
          w.x >= t.rect.x &&
          w.x < t.rect.x + t.rect.w &&
          w.y >= t.rect.y &&
          w.y < t.rect.y + t.rect.h,
      ) ?? null
    );
  }

  /** Suelta la sala que se llevaba: en una casilla válida se muda; si no, se queda donde estaba. */
  private endRoomDrag(p: Point): void {
    this.roomDrag = null;
    const t = this.moveTargetAt(p.x, p.y);
    if (t) {
      const w = this.camera.toWorld(p.x, p.y);
      this.lastTap = w;
      this.cb.onHotspot?.(t.id, t.label, { x: p.x, y: p.y, wx: w.x, wy: w.y });
      this.cb.onSound?.('build', 0.5);
    } else this.cb.onRoomDrop?.();
  }

  /** El andamio de las salas que se levantan: lo que falta por subir, en sombra, y el polvo. */
  private scaffolds(): void {
    if (!this.raising.length) return;
    const { topCtx: ctx, camera, t } = this;
    this.raising = this.raising.filter((s) => {
      if (t < s.t0 + RAISE) return true;
      const r = this.roomRect(s.id);
      if (!r) return false;
      // Acabada: cae el andamio en una nube de polvo.
      for (let i = 0; i < 18; i++)
        this.particles.spawn('puff', r.x + Math.random() * r.w, r.y + r.h - Math.random() * 20);
      this.cb.onSound?.('build', 0.6);
      return false;
    });
    for (const s of this.raising) {
      const k = (t - s.t0) / RAISE;
      const r = this.roomRect(s.id);
      if (k < 0 || !r) continue;
      const x = Math.round(r.x - camera.px);
      const y = Math.round(r.y - camera.py);
      const w = Math.round(r.w);
      const h = Math.round(r.h);
      // La sala sube de abajo arriba: lo que falta, en sombra.
      const up = Math.min(1, k / 0.85);
      const rest = Math.round(h * (1 - up));
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = P.black;
      ctx.fillRect(x, y, w, rest);
      // El andamio: postes y tablones de madera, que se van al final.
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      const poles: number[] = [];
      for (let px = 4; px < w - 6; px += Math.max(30, Math.floor((w - 10) / 3))) poles.push(px);
      poles.push(w - 7);
      for (const px of poles) {
        ctx.fillStyle = P.black;
        ctx.fillRect(x + px - 1, y, 5, h);
        ctx.fillStyle = P.oak;
        ctx.fillRect(x + px, y, 3, h);
      }
      for (let py = h - 6; py > 4; py -= 28) {
        ctx.fillStyle = P.black;
        ctx.fillRect(x + 2, y + py - 1, w - 4, 5);
        ctx.fillStyle = P.clay;
        ctx.fillRect(x + 3, y + py, w - 6, 3);
      }
      ctx.globalAlpha = 1;
      // Martillazos con su polvo donde se está subiendo.
      if (k < 0.85 && t >= s.knock) {
        s.knock = t + 0.28 + Math.random() * 0.18;
        const wx = r.x + 8 + Math.random() * (r.w - 16);
        const wy = r.y + r.h * (1 - up);
        for (let i = 0; i < 3; i++) this.particles.spawn('puff', wx, wy + Math.random() * 6);
        this.particles.spawn('dust', wx, wy);
        this.cb.onSound?.('hammer', 0.7);
      }
    }
  }

  /** Lo que se ve mientras se lleva una sala: su silueta bajo el dedo, verde si cabe ahí. */
  private roomGhost(): void {
    const d = this.roomDrag;
    if (!d?.moved) return;
    const { topCtx: ctx, camera } = this;
    const t = this.moveTargetAt(d.x, d.y);
    const w = camera.toWorld(d.x, d.y);
    const r = t?.rect ?? { ...d.rect, x: w.x - d.rect.w / 2, y: w.y - d.rect.h / 2 };
    const x = Math.round(r.x - camera.px) + 1;
    const y = Math.round(r.y - camera.py) + 1;
    const rw = Math.round(r.w) - 2;
    const rh = Math.round(r.h) - 2;
    const c = t ? P.lime : P.red;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, rw, rh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, rw, 2);
    ctx.fillRect(x, y + rh - 2, rw, 2);
    ctx.fillRect(x, y, 2, rh);
    ctx.fillRect(x + rw - 2, y, 2, rh);
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    this.drag.ok = false;
    this.endDrag();
  }

  /** El camino de los bandidos: puntos rojos que avanzan del patio a la cámara del tesoro. */
  private raidRoute(pts: { x: number; y: number }[]): void {
    const { topCtx: ctx, camera } = this;
    const shift = Math.floor(this.t * 12) % 8;
    let walked = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]!;
      const b = pts[k]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 0; d < len; d++) {
        if ((walked + d + 8 - shift) % 8 >= 4) continue;
        const x = Math.round(a.x + ((b.x - a.x) * d) / len - camera.px);
        const y = Math.round(a.y + ((b.y - a.y) * d) / len - camera.py);
        ctx.fillStyle = P.black;
        ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.fillStyle = P.red;
        ctx.fillRect(x, y, 1, 1);
      }
      walked += len;
    }
    // Al final, la cámara: una marca dorada.
    const end = pts.at(-1);
    if (!end) return;
    const x = Math.round(end.x - camera.px);
    const y = Math.round(end.y - camera.py);
    ctx.fillStyle = P.black;
    ctx.fillRect(x - 3, y - 3, 7, 7);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = P.lemon;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  /** Encima de quien entrena, su barra: se va llenando a lo largo del día. */
  private trainBars(): void {
    const tod = this.clockTod ?? 0;
    if (this.night || tod > 0.82) return;
    const { topCtx: ctx, camera } = this;
    for (const h of this.crowd.visible()) {
      if (!h.train) continue;
      const r = this.heroRect(h.id);
      if (!r) continue;
      const fill = Math.min(1, h.train.at + h.train.perDay * tod);
      const W = 16;
      const x = Math.round(r.x + r.w / 2 - camera.px - W / 2);
      const y = Math.round(r.y - camera.py) + 6;
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 1, y - 1, W + 2, 5);
      ctx.fillStyle = P.steel;
      ctx.fillRect(x, y, W, 3);
      ctx.fillStyle = fill >= 1 ? P.lemon : P.lime;
      ctx.fillRect(x, y, Math.max(1, Math.round(W * fill)), 3);
    }
  }

  /** Las flechas que cruzan la sala de tiro: astil, punta de hierro y plumas blancas. */
  private flyingArrows(): void {
    const { topCtx: ctx, camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    for (const a of this.crowd.arrows(v)) {
      const len = Math.max(5, Math.round(7 * a.k));
      const x = Math.round(a.x);
      const y = Math.round(a.y);
      const tail = x - a.dir * len;
      ctx.fillStyle = P.oak;
      ctx.fillRect(Math.min(x, tail), y, len, 1);
      ctx.fillStyle = P.fog;
      ctx.fillRect(x - (a.dir > 0 ? 1 : 0), y, 2, 1);
      ctx.fillStyle = P.white;
      ctx.fillRect(tail - (a.dir > 0 ? 0 : 1), y - 1, 1, 3);
    }
  }

  /** La sala bajo el dedo mientras se lleva a alguien: verde si vale, roja si no. */
  private dropMark(): void {
    const d = this.drag;
    const r = d?.room ? this.layout?.rooms.find((x) => x.room.id === d.room) : undefined;
    if (!d || !r) return;
    const { topCtx: ctx, camera } = this;
    const x = Math.round(r.rect.x - camera.px) + 1;
    const y = Math.round(r.rect.y - camera.py) + 1;
    const w = Math.round(r.rect.w) - 2;
    const h = Math.round(r.rect.h) - 2;
    const c = d.ok ? P.lime : P.red;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  /** Llevando a alguien cerca del borde, la cámara se desliza hacia allí. */
  private edgePan(dt: number): void {
    const d = this.drag?.moved ? this.drag : this.roomDrag?.moved ? this.roomDrag : null;
    if (!d || !this.cssW) return;
    const EDGE = 36;
    const speed = 260 * dt;
    const dx = d.x < EDGE ? speed : d.x > this.cssW - EDGE ? -speed : 0;
    const dy = d.y < EDGE ? speed : d.y > this.cssH - EDGE ? -speed : 0;
    if (dx || dy) {
      this.camera.drag(dx, dy, 0);
      if (d === this.drag) this.moveDrag({ x: d.x, y: d.y });
    }
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
        this.camera.stopInertia();
        // Sobre alguien que se puede coger, el dedo lo lleva; si no, mueve la cámara.
        const who = this.targets || this.raid ? null : this.heroAt(p.x, p.y);
        const w = this.camera.toWorld(p.x, p.y);
        const grab = this.grabbable ? this.roomRect(this.grabbable) : null;
        if (who && this.cb.canDrag?.(who))
          this.drag = { id: who, x: p.x, y: p.y, moved: false, room: null, ok: false };
        else if (
          grab &&
          w.x >= grab.x &&
          w.x < grab.x + grab.w &&
          w.y >= grab.y &&
          w.y < grab.y + grab.h
        )
          this.roomDrag = { id: this.grabbable!, x: p.x, y: p.y, moved: false, rect: grab };
        else this.camera.dragging = true;
      } else if (this.pointers.size === 2) {
        this.cancelDrag();
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
        const prop = who ? null : this.propAt(p.x, p.y);
        this.hoverProp = prop;
        if (prop) {
          this.hover = null;
          c.style.cursor = 'pointer';
          this.cb.onHover?.(ACT_LABEL[prop.act!], p);
          return;
        }
        if (who) {
          this.hover = null;
          c.style.cursor = 'pointer';
          this.cb.onHover?.(this.crowd.hoverOf(who), p);
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
      if (this.drag) {
        this.moveDrag(p);
        return;
      }
      if (this.roomDrag) {
        const d = this.roomDrag;
        d.x = p.x;
        d.y = p.y;
        if (!d.moved && this.press && Math.hypot(p.x - this.press.x, p.y - this.press.y) > 6) {
          d.moved = true;
          this.press.moved = true;
          this.cb.onRoomDrag?.(d.id);
          this.cb.onSound?.('click', 0.4);
        }
        if (d.moved) {
          this.hover = null;
          this.cb.onHover?.(null, null);
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
        this.hoverProp = null;
        this.cb.onHover?.(null, null);
      }
    });
    const end = (e: PointerEvent) => {
      const p = local(e);
      if (this.roomDrag?.moved) {
        this.pointers.delete(e.pointerId);
        this.endRoomDrag(p);
        this.press = null;
        return;
      }
      this.roomDrag = null;
      if (this.drag?.moved) {
        this.pointers.delete(e.pointerId);
        this.endDrag();
        this.press = null;
        return;
      }
      this.drag = null;
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
      this.cancelDrag();
      if (this.roomDrag?.moved) this.cb.onRoomDrop?.();
      this.roomDrag = null;
      this.camera.release();
      this.press = null;
    });
    c.addEventListener('pointerleave', () => {
      if (!this.pointers.size) {
        this.hover = null;
        this.hoverProp = null;
        this.hoverHero = null;
        this.cb.onHover?.(null, null);
      }
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // La rueda acerca y aleja (hacia donde apunta el ratón); de lado o con mayúsculas, mueve.
        const side = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX;
        if (!e.ctrlKey && Math.abs(side) > Math.abs(e.deltaY) * (e.shiftKey ? 0 : 1)) {
          this.camera.drag(-side, 0, 0);
          return;
        }
        // Una rueda da saltos de unos 100; un panel táctil, muchos pasitos: se van sumando, y
        // tras cada paso de zoom se espera un momento (si no, un solo gesto lo cruzaría entero).
        const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
        const now = performance.now();
        if (now - this.wheelAt < 140) {
          this.wheel = 0;
          return;
        }
        this.wheel += e.deltaY * unit * (e.ctrlKey ? 4 : 1);
        if (Math.abs(this.wheel) < 40) return;
        const p = local(e);
        this.zoomAt(this.wheel < 0 ? 1 : -1, p.x, p.y);
        this.wheel = 0;
        this.wheelAt = now;
      },
      { passive: false },
    );
  }
}
