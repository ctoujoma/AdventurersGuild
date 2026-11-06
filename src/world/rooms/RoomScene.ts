/**
 * La escena del gremio por salas, en 3D pixelado: cada sala es una caja de verdad detrás del
 * plano de corte, con sus muebles como figuras planas y la luz de sus faroles; fuera, el cielo,
 * el patio y los tejados. Se maneja igual que la taberna dibujada (mismos métodos), para que la
 * interfaz no tenga que saber cuál está mirando.
 *
 * La cámara es la 2D de siempre (arrastre, inercia, zoom entero y límites): lo que encuadra en
 * el plano de corte es justo lo que se ve, píxel a píxel. Los toques se resuelven ahí mismo.
 */
import { tinyDigits } from '../../art/digits';
import { GRASS_FRAMES, grassTuft, lawnTex, type TuftKind } from '../../art/grass';
import { Rng } from '../../core/rng';
import { inGarden, isShaft } from '../../core/rooms';
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
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
  WebGLRenderTarget,
  DepthTexture,
  UnsignedIntType,
  type ShaderMaterial,
} from 'three';
import { P, darker } from '../../art/palette';
import { PixelBuffer, bayer, rgba, toHex } from '../../art/pixel';
import type { Building, RaidResult, Room, RoomYield } from '../../core/model';
import { ROOMS } from '../../data/rooms';
import type { GardenEdgeId } from '../../data/custom';
import { Camera } from '../camera';
import { GROUND } from '../geometry';
import { Particles, type PKind } from '../particles';
import * as Prop from '../props';
import type {
  Point,
  SceneCallbacks,
  SceneCraft,
  SceneCraftEnd,
  SceneModel,
  SoundName,
} from '../scene';
import { itemIcon } from '../../art/items';
import { LANTERN, dummy, furnish, gearRoom, type Glow, type RGB } from './furniture';
import { chalkPlan } from './ruina';
import { towerLampY, watchtower } from './salas/torre';
import { CANDLE, takeWallActs, type ActId, type PoiKind, type Round } from './salas/kit';
import { FLIGHT_Z, flightArt, goesRight } from './stairs';
import { dress } from './salas/tintes';
import { Crowd, type Hit, type Poi, type Talk } from './crowd';
import { LAWN_D, tuftAllowed, yardBushes, yardTrees } from './patio';
import {
  CLOISTER_W,
  cloisterParts,
  type CloisterParts,
  COL_R,
  EDGE_Z,
  LIME,
  PARAPET,
  SPRING,
  LAMP_Z,
  PIECE_Z,
  VERGE_Z,
  cloisterEnd,
  cloisterSide,
  eaveFront,
  flowerFace,
  hedgeFace,
  leafTex,
  edgeArt,
  galleryFloor,
  paintGround,
  pieceArt,
  railFace,
  verge,
} from './jardin';
import { Pets, kindOf, type Perch, type PetId } from './pets';
import { IncidentArt } from './incidents';
import { FLAME_FRAMES, FLAME_H, FLAME_W, flameStrip } from './flame';
import { faces, sideTexel, type Mat } from './volume';
import { RaidShow } from './raid';
import { HEARTH_RIGHT, NO_LOOK, type SalonLook } from './salon';
import { FEW_LIGHTS, Look, MAX_LIGHTS, mesh, quad, sharedUniforms, type Corners } from './gl';
import { route, type Place } from './people';
import {
  CELL_W,
  DEPTH,
  PATIO_W,
  PARTITION,
  PITCH,
  ROOF_H,
  ROOM_H,
  SLAB,
  WALL,
  YARD_D,
  colX,
  gardenSlots,
  floorTop,
  floorY,
  focusPoint,
  interior,
  roofLift,
  roofRuns,
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
  DOOR_H,
  DOOR_U0,
  DOOR_U1,
  doorJamb,
  doorPanel,
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
/** Profundidad de las chimeneas del tejado: justo detrás del hastial (que tapa su pie). */
const CHIMNEY_Z = 8;
const OUTDOOR: Tint = [0.3, 0.28, 0.42];
/**
 * Luz con ambiente (Ajustes): la luz de fondo de las salas se multiplica por esto y los focos
 * por `MOOD_LAMPS`, así quedan charcos de luz alrededor de fuegos, faroles y velas.
 */
const MOOD_AMBIENT = 0.45;
const MOOD_LAMPS = 1.6;
const ROOM_LIT: Tint = [0.44, 0.38, 0.46];
const ROOM_DEEP: Tint = [0.42, 0.37, 0.52];
const ROOM_DIM: Tint = [0.34, 0.31, 0.46];
/** Sala rota: apagada y fría (azulada), que se distinga de lejos de las que se usan. */
const ROOM_RUIN: Tint = [0.28, 0.31, 0.46];
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
  /** Solo para enseñar un sitio (el anexo libre): borde claro, sin cruz. */
  info?: boolean;
}

/** La hoja de una puerta entre salas: gira sobre su gozne (al fondo del hueco) hacia `dir`. */
interface Door {
  mesh: Mesh;
  mat: ShaderMaterial;
  xm: number;
  yb: number;
  floor: number;
  open: number;
  dir: 1 | -1;
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

/**
 * Las luces de los talleres que se avivan con trabajo (ver `workshop`): el fuego de la forja y
 * los alambiques de la alquimia, por lo mucho que tiemblan.
 */
const WORK_FIRE: Partial<Record<string, number>> = { forja: 0.2, alquimia: 0.14 };

/** Lo que pasa en la sala con cada golpe de la gente (ver `Hit` en crowd.ts): dónde y qué suena. */
const HIT_AT: Record<Hit['kind'], { poi: PoiKind; v: number; sound?: SoundName }> = {
  martillo: { poi: 'yunque', v: 0.1, sound: 'hammer' },
  temple: { poi: 'artesa', v: 0.2, sound: 'hiss' },
  tijera: { poi: 'corte', v: 0.2 },
  tinte: { poi: 'tinte', v: 0.2 },
  remover: { poi: 'caldero', v: 0.15 },
  gota: { poi: 'alambique', v: 0.45 },
};

/** El oro de la cámara, en octavos: la escena solo se repinta cuando cambia de octavo. */
const vaultStep = (v = 0) => Math.round(Math.max(0, Math.min(1, v)) * 8);

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
  /** Luz con ambiente (Ajustes): menos luz de fondo en las salas y focos más fuertes. */
  moodLight = false;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private cam3 = new PerspectiveCamera();
  private flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** Materiales del edificio (se rehacen con él) y los de las láminas de pantalla. */
  /** Día y focos: los mismos para el edificio, las láminas y la gente. */
  private shared = sharedUniforms();
  /** Prueba de sombras: la profundidad de la escena, de una primera pasada. */
  private depthRT: WebGLRenderTarget | null = null;
  private noDepth = this.shared.uDepth.value;
  private look = new Look(this.shared);
  private keep = new Look(this.shared);
  private crowd = new Crowd(this.shared, (x, floor) => this.tintAt(x, floor));
  /** El gato y el perro del salón. */
  private pets = new Pets(this.shared, (x, floor) => this.tintAt(x, floor));
  /** Los incidentes en marcha, dibujados en su sala (y la luz del fuego). */
  private incidents = new IncidentArt(this.shared, (x, floor) => this.tintAt(x, floor));
  private incidentLamps: Lamp[] = [];
  /** Donde se posa el cuervo: encima del rótulo (o del farol, si el rótulo va pintado). */
  private perch: Perch | null = null;
  /** Persona señalada con el ratón y la que se ha buscado desde su ficha (un rato). */
  private hoverHero: string | null = null;
  private marker: { id: string; until: number } | null = null;
  private world = new Group();
  private lamps: Lamp[] = [];
  /** Bocas de las chimeneas del tejado (en el mundo 2D), por donde sale el humo. */
  private smokeAt: { x: number; y: number }[] = [];
  private smokeT = 0;
  private crossT = 0;
  /** Rayos de luz de las salas rotas (en el mundo) y cada cuánto sale una mota de polvo. */
  private shafts: { x: number; y0: number; y1: number; z: number }[] = [];
  private dustT = 0;
  private towerRect: Rect | null = null;
  private flames: Mesh[] = [];
  /** La hierba que mueve el viento: cada mata, con su sitio (el viento pasa por x). */
  private grass: { m: Mesh; x: number; seed: number }[] = [];
  private grassTick = -1;
  /** El fuego de cada forja, para avivarlo o bajarlo según haya trabajo (ver `workshop`). */
  private forgeLamps: { room: string; lamp: Lamp; base: number }[] = [];
  /** Los trabajos de taller de antes (para saber cuál acaba de terminar). */
  private crafted = new Map<string, SceneCraft>();
  /**
   * Las piezas recién acabadas: en la forja, un momento en el yunque brillando; en los demás
   * talleres, el dibujo de lo que se ha hecho, que sube un poco sobre su mesa y se apaga.
   */
  private finished: {
    room: string;
    at: number;
    until: number;
    rarity: number;
    icon: SceneCraft['icon'];
    x: number;
    y: number;
  }[] = [];
  /** Muebles que sueltan partículas (ver `Emit` en `salas/kit.ts`), con su zona en el mundo. */
  private emitters: {
    kind: PKind;
    rate: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    z: number;
  }[] = [];
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
  /** Las hojas de las puertas entre salas, que se abren cuando alguien pasa (ver `doorway`). */
  private doors: Door[] = [];
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
    this.scene.add(this.pets.group);
    this.scene.add(this.incidents.group);
    this.incidents.sound = (name, v) => this.cb.onSound?.(name, v);
    this.incidents.emit = (kind, x, y, z, o = {}) => {
      // (Las partículas se pintan sin perspectiva: se pasa el punto del mundo a la vista.)
      const c = this.camera;
      const view: View = { px: c.px, py: c.py, vw: c.vw, vh: c.vh };
      const p = project(view, x, y, z);
      const ay = o.land === undefined ? undefined : view.py + project(view, x, o.land, z).y;
      this.particles.spawn(kind, view.px + p.x, view.py + p.y, { ...o, ay });
    };
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.pets.sound = (name, v) => this.cb.onSound?.(name, v);
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
      model.look,
      model.garden,
      model.decor,
      model.tints,
      model.trophies,
      model.dog,
      model.raven,
      model.gear,
      vaultStep(model.vault),
    ]);
    if (model.visitors) this.crowd.setVisitors(model.visitors);
    this.crowd.setTints(model.tints ?? {});
    if (key === this.key) {
      this.crowd.setPeople(model.heroes);
      this.showIncidents();
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
    this.pets.setLayout(L, !!model.dog);
    this.pets.setCritters(L);
    this.pets.setRaven(model.raven ? this.perch : null);
    this.crowd.setPois(this.poisOf(L));
    this.crowd.setPeople(model.heroes);
    this.showIncidents();
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

  /** Pone en sus salas los incidentes de ahora (y la luz del fuego) y quita los que acabaron. */
  private showIncidents(): void {
    const L = this.layout;
    const m = this.model;
    if (!L || !m) return;
    this.workshop(m.crafts ?? [], m.craftEnds ?? []);
    this.incidents.set(L, m.building, m.incidents ?? [], m.clock);
    this.incidentLamps = this.incidents.lights().map((l) => ({
      pos: new Vector3(l.x, GROUND - l.y, -l.z + 6),
      glow: new Vector3(l.x, GROUND - l.y, -l.z),
      r: l.r,
      color: [...l.color],
      power: l.power,
      flicker: l.flicker,
      zone: this.zoneOf(l.rect),
      seed: Math.round(l.x * 7 + l.y * 13),
      fire: true,
      deep: true,
      halo: 22,
    }));
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

  /** Punto del mundo junto al techo de una sala (para colgar de él un aviso), o null. */
  roomTop(id: string): Point | null {
    const r = this.layout?.rooms.find((x) => x.room.id === id);
    return r ? { x: r.rect.x + r.rect.w / 2, y: r.rect.y + 14 } : null;
  }

  /** Dónde cae una sala en la pantalla (en píxeles de la página), o null. */
  roomOnScreen(id: string): { x: number; y: number; w: number; h: number } | null {
    const r = this.layout?.rooms.find((x) => x.room.id === id);
    if (!r) return null;
    const a = this.screenOf(r.rect.x, r.rect.y);
    const b = this.screenOf(r.rect.x + r.rect.w, r.rect.y + r.rect.h);
    const c = this.canvas.getBoundingClientRect();
    return {
      x: c.left + Math.min(a.x, b.x),
      y: c.top + Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  }

  /** Centra la cámara en una casilla de obra marcada (`obra:…`), si no se ve entera. */
  showTarget(id: string): void {
    const r = this.targets?.find((x) => x.id === id)?.rect;
    if (!r) return;
    const { px, py, vw, vh } = this.camera;
    if (r.x >= px && r.x + r.w <= px + vw && r.y >= py && r.y + r.h <= py + vh) return;
    this.camera.centerOn(r.x + r.w / 2, r.y + r.h / 2);
  }

  /** Dónde cae en la pantalla una casilla de obra marcada (`obra:…`), en píxeles de la página. */
  targetOnScreen(id: string): { x: number; y: number; w: number; h: number } | null {
    const r = this.targets?.find((x) => x.id === id)?.rect;
    if (!r) return null;
    const a = this.screenOf(r.x, r.y);
    const b = this.screenOf(r.x + r.w, r.y + r.h);
    const c = this.canvas.getBoundingClientRect();
    return {
      x: c.left + Math.min(a.x, b.x),
      y: c.top + Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  }

  /** Dónde cae en la pantalla una cosa tocable (el tablón, la barra…), en píxeles de la página. */
  actOnScreen(act: ActId): { x: number; y: number; w: number; h: number } | null {
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    const p = this.props.find((x) => x.act === act);
    if (!p) return null;
    const r = this.propRect(p, v);
    const c = this.canvas.getBoundingClientRect();
    return {
      x: c.left + (r.x - camera.px) * camera.zoom,
      y: c.top + (r.y - camera.py) * camera.zoom,
      w: r.w * camera.zoom,
      h: r.h * camera.zoom,
    };
  }

  /** De cerca: un paso de zoom si la cámara está lejos, y centrada en la sala. */
  closeUp(room: string, zoom = 3): void {
    if (this.camera.zoom < zoom) this.resize(this.cssW, this.cssH, zoom);
    this.focus(room);
  }

  screenOf(wx: number, wy: number): Point {
    return this.camera.toScreen(wx, wy);
  }

  focus(room: string): void {
    const p = this.layout ? focusPoint(this.layout, room) : null;
    if (p) this.camera.centerOn(p.x, p.y);
  }

  /**
   * El botón de casa: a la sala; con anexo, si ya se está mirando la sala, salta al anexo (y
   * desde el anexo, de vuelta), que con los dos edificios el camino arrastrando es largo.
   */
  home(): void {
    const L = this.layout;
    const sala = L ? focusPoint(L, 'sala') : null;
    const anexo = L ? focusPoint(L, 'anexo') : null;
    if (!sala) return;
    const cx = this.camera.x + this.camera.vw / 2;
    const near = Math.abs(cx - sala.x) < this.camera.vw / 4;
    const p = anexo && near ? anexo : sala;
    this.camera.centerOn(p.x, p.y);
  }

  /**
   * Como `focus`, pero con el sitio en la franja de arriba que deja un panel abierto (`seen`:
   * la parte de la vista, de 0 a 1, que queda sin tapar).
   */
  focusTop(name: string, seen: number): void {
    const p = this.layout ? focusPoint(this.layout, name) : null;
    if (!p) return;
    // El suelo del sitio, un poco por encima del borde del panel.
    const dy = this.camera.vh * (0.5 - Math.max(0.1, seen)) + ROOM_H / 2 + 6;
    this.camera.lift = dy;
    this.camera.centerOn(p.x, p.y + dy);
  }

  /** Al cerrar el panel, la cámara vuelve a sus límites. */
  releaseTop(): void {
    this.camera.unlift();
  }

  /** La entrada de la partida: la cámara empieza fuera, a la izquierda, y entra despacio hasta la sala. */
  travelIn(room: string): void {
    const p = this.layout ? focusPoint(this.layout, room) : null;
    if (!p) return;
    this.camera.jump(-1e6, p.y - this.camera.vh / 2);
    this.camera.centerOn(p.x, p.y, true, true);
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
    this.pets.dispose();
    this.incidents.dispose();
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
    // En una sala rota, la luz fría de la sala (lo que pasa por ella, a oscuras como ella).
    const room = this.layout?.rooms.find(
      ({ room: r, rect }) =>
        r.level === 0 &&
        !r.works &&
        r.type !== 'torre' &&
        r.floor === floor &&
        x >= rect.x &&
        x < rect.x + rect.w,
    );
    if (room) return { ambient: ROOM_RUIN, sun: 0.1 };
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

  /**
   * Los talleres: la gente sabe qué se hace en cada uno (y trabaja solo con trabajo); la fragua
   * se aviva con trabajo y se apaga sin él; al acabar, la pieza brilla en el yunque.
   */
  private workshop(list: SceneCraft[], ends: readonly SceneCraftEnd[]): void {
    this.crowd.setCrafts(list);
    const now = new Map(list.map((c) => [c.id, c]));
    for (const f of this.forgeLamps) {
      const here = list.filter((c) => c.room === f.room);
      const lit = here.some((c) => !c.stalled);
      f.lamp.power = f.base * (!here.length ? 0.55 : lit ? 1.35 : 0.75);
    }
    // Lo que ya no está: según cómo acabó (cancelado, o sin saberlo, no se celebra nada).
    for (const [id, c] of this.crafted)
      if (!now.has(id)) {
        const end = ends.find((e) => e.id === id);
        if (end && end.how !== 'cancelado') this.craftDone(c, end);
      }
    this.crafted = now;
  }

  /** Dónde se ve lo que se crea en cada taller: el yunque, la mesa de cortar, el alambique. */
  private doneSpot(room: string): PropSpot | undefined {
    return (
      this.spotOf(room, 'yunque') ??
      this.spotOf(room, 'corte') ??
      this.spotOf(room, 'alambique') ??
      this.spotOf(room, 'caldero')
    );
  }

  /** El sitio de un mueble de trabajo de una sala (el yunque, el banco…), si lo hay. */
  private spotOf(room: string, poi: PoiKind): PropSpot | undefined {
    return this.props.find((p) => p.room === room && p.poi === poi);
  }

  /** Donde se desmonta: el banco, o el yunque en la forja pequeña (que no tiene). */
  private benchOf(room: string): PropSpot | undefined {
    return this.spotOf(room, 'banco') ?? this.doneSpot(room);
  }

  /** Un punto de un mueble (de 0 a 1 en su ancho y su alto) en la vista, para las partículas. */
  private onProp(p: PropSpot, u: number, v: number): { x: number; y: number } {
    const c = this.camera;
    const view: View = { px: c.px, py: c.py, vw: c.vw, vh: c.vh };
    const s = project(view, p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * v, p.z);
    return { x: view.px + s.x, y: view.py + s.y };
  }

  /**
   * Acaba un trabajo, según cómo (`craftEnds`): hecho, la pieza brilla (más, y con monedas, si
   * es de las buenas); desmontado, se deshace en polvo y chispas y, si sale la receta, sube un
   * pergamino; vestido, destellos alrededor del héroe.
   */
  private craftDone(c: SceneCraft, end: SceneCraftEnd): void {
    if (end.how === 'vestido') {
      const w = c.hero ? this.crowd.where(c.hero) : null;
      if (!w) return;
      for (let i = 0; i < 12; i++)
        this.particles.spawn(
          'glint',
          w.x + (Math.random() - 0.5) * 16,
          w.y - 4 - Math.random() * 24,
          { max: 0.5 + Math.random() * 0.7 },
        );
      this.cb.onSound?.('coin', 0.35);
      return;
    }
    const spot = c.undo ? this.benchOf(c.room) : this.doneSpot(c.room);
    if (!spot) return;
    const p = this.onProp(spot, 0.5, 0.15);
    if (c.undo) {
      for (let i = 0; i < 12; i++)
        this.particles.spawn('puff', p.x + (Math.random() - 0.5) * 16, p.y + Math.random() * 6);
      for (let i = 0; i < 8; i++) this.particles.spawn('spark', p.x, p.y);
      if (end.how === 'receta') {
        this.particles.spawn('scroll', p.x - 3, p.y - 6);
        this.cb.onSound?.('coin', 0.4);
      }
      return;
    }
    const good = (end.rarity ?? 0) >= 1;
    this.finished.push({
      room: c.room,
      at: this.t,
      until: this.t + (good ? 2.6 : 1.8),
      rarity: end.rarity ?? 0,
      icon: c.icon,
      x: p.x,
      y: p.y,
    });
    const n = good ? 16 : 7;
    for (let i = 0; i < n; i++)
      this.particles.spawn(
        'glint',
        p.x + (Math.random() - 0.5) * (good ? 28 : 14),
        p.y - Math.random() * (good ? 18 : 8),
        { max: 0.5 + Math.random() * 0.6 },
      );
    if (good) for (let i = 0; i < 10; i++) this.particles.spawn('coin', p.x, p.y);
    this.cb.onSound?.('coin', good ? 0.6 : 0.3);
  }

  /**
   * La pieza al rojo en el yunque mientras se forja (y no está parado) y, al acabar, la pieza
   * fría un momento con un brillo que la recorre (dorado, si es de las buenas).
   */
  private hotPieces(): void {
    const { topCtx: ctx, camera } = this;
    this.finished = this.finished.filter((f) => this.t <= f.until);
    for (const f of this.finished) {
      const spot = this.spotOf(f.room, 'yunque');
      if (!spot) {
        // En los demás talleres: el dibujo de lo que se ha hecho sube un poco y se apaga.
        const k = (this.t - f.at) / (f.until - f.at);
        const x = Math.round(f.x - camera.px) - 6;
        const y = Math.round(f.y - camera.py - 14 - k * 10);
        this.paintFading(itemIcon(f.icon, f.rarity as 0 | 1), x, y, 1 - Math.max(0, k - 0.6) / 0.4);
        continue;
      }
      if ([...this.crafted.values()].some((c) => c.room === f.room && !c.undo)) continue;
      const wy = spot.y0 + (spot.y1 - spot.y0) * 0.12;
      if (this.crowd.covers((spot.x0 + spot.x1) / 2, wy, spot.z)) continue;
      const p = this.onProp(spot, 0.5, 0.12);
      const x = Math.round(p.x - camera.px) - 3;
      const y = Math.round(p.y - camera.py) - 1;
      // Con su borde oscuro, para que se lea sobre el yunque: la hoja y la empuñadura.
      ctx.fillStyle = P.black;
      ctx.fillRect(x - 1, y - 2, 11, 4);
      ctx.fillStyle = f.rarity >= 1 ? P.gold : P.mist;
      ctx.fillRect(x, y - 1, 7, 2);
      ctx.fillStyle = f.rarity >= 1 ? P.lemon : P.white;
      ctx.fillRect(x, y - 1, 7, 1);
      ctx.fillStyle = P.oak;
      ctx.fillRect(x + 7, y - 1, 2, 2);
      ctx.fillStyle = P.white;
      ctx.fillRect(x + (Math.floor(this.t * 9) % 7), y - 1, 1, 2);
    }
    for (const c of this.crafted.values()) {
      if (c.undo) continue;
      const spot = this.spotOf(c.room, 'yunque');
      if (!spot) continue;
      // Va en la capa de arriba: si alguien pasa por delante, no se pinta (que no le tape).
      const wy = spot.y0 + (spot.y1 - spot.y0) * 0.12;
      if (this.crowd.covers((spot.x0 + spot.x1) / 2, wy, spot.z)) continue;
      const p = this.onProp(spot, 0.5, 0.12);
      const x = Math.round(p.x - camera.px) - 3;
      const y = Math.round(p.y - camera.py) - 1;
      const hot = !c.stalled && Math.floor(this.t * 6) % 3 !== 0;
      ctx.fillStyle = c.stalled ? P.rust : P.orange;
      ctx.fillRect(x, y, 7, 2);
      ctx.fillStyle = hot ? P.lemon : P.gold;
      ctx.fillRect(x + 1, y, 4, 1);
      if (!c.stalled) {
        ctx.fillStyle = P.white;
        ctx.fillRect(x + 2 + (Math.floor(this.t * 3) % 3), y, 1, 1);
      }
    }
  }

  /** Pinta un dibujo en la capa de arriba, deshaciéndose en tramado con `k` (1 entero, 0 nada). */
  private paintFading(img: PixelBuffer, x: number, y: number, k: number): void {
    const ctx = this.topCtx;
    for (let j = 0; j < img.h; j++)
      for (let i = 0; i < img.w; i++) {
        const c = img.get(i, j);
        if (!c || bayer(x + i, y + j) >= k) continue;
        ctx.fillStyle = toHex(c);
        ctx.fillRect(x + i, y + j, 1, 1);
      }
  }

  /** Dónde saltan en pantalla las monedas de la caja (las de `pay`), en píxeles CSS. */
  payPoint(): Point | null {
    const p = this.layout ? focusPoint(this.layout, 'barra') : null;
    return p ? this.camera.toScreen(p.x - 30, p.y + 5) : null;
  }

  /** Ronda en la barra: notas y monedas, y los que se dan (`ids`) lo celebran dando saltos. */
  cheer(room = 'barra', ids: readonly string[] = []): void {
    this.crowd.celebrate(ids);
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
    this.grass = [];
    this.emitters = [];
    this.forgeLamps = [];
    this.pins = [];
    this.perch = null;
    this.shafts = [];
    this.pinnedAt = '';
    this.towerRect = null;
    this.props = [];
    this.doors = [];
    this.hoverProp = null;
    const b = L.b;
    const g = this.world;

    // El plano de corte, en dos: lo de encima del suelo, a la luz del día, y la tierra.
    const look = model.look ?? {};
    const F = facade(L, look, model.crest);
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
          back: stairBack(
            themeOf(s.floor),
            interior(s.rect).w,
            s.rect.h,
            s.floor,
            s.steps,
            s.flight,
          ),
          sides: { left: [left], right: [right] },
          floor: s.floor,
          // En el rellano de la planta baja de una escalera al borde, la puerta al jardín.
          garden: {
            left: s.floor === 0 && s.steps && inGarden(b, s.s - 1),
            right: s.floor === 0 && s.steps && inGarden(b, s.s),
          },
        },
      );
      const inner = interior(s.rect);
      const sun = s.floor >= 0 ? 0.35 : 0;
      // El tramo que sube desde aquí, a su profundidad (la gente lo pisa justo delante).
      if (s.flight)
        this.figure(
          g,
          flightArt(s.floor),
          inner.x + inner.w / 2,
          floorY(s.floor),
          FLIGHT_Z,
          STAIRS,
          sun,
        );
      // La luz del aplique del rellano (pintado en `stairBack`, a 22 del fondo desde arriba).
      if (s.steps) {
        const bh = Math.round(s.rect.h * BACK);
        const bx = goesRight(s.floor) ? 4 : Math.round(inner.w * BACK) - 5;
        this.addLight(
          { dy: 0, r: 46, color: CANDLE, power: 0.45, flicker: 0.12 },
          inner.x + bx / BACK,
          GROUND - floorY(s.floor) + (bh - 22) / BACK,
          DEPTH - 6,
          this.zoneOf(s.rect),
          sun < 0.2,
        );
      }
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
        roofTiles(len, `tejado${run.x0}`, look.roof),
        [at(run.x0, eave, d), at(run.x0, eave, 0), at(mid, ridge, 0), at(mid, ridge, d)],
        opts,
      );
      this.plane(
        g,
        roofTiles(len, `tejado${run.x1}`, look.roof),
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
    // Detrás del edificio, la hierba del terreno; en el jardín, su césped (más abajo) hasta
    // `LAWN_D`, y de ahí a los árboles, el terreno otra vez.
    const garden = L.garden;
    const behind: [number, number, number][] = garden
      ? [
          [L.left, garden.x, back],
          [garden.x, garden.x + garden.w, LAWN_D],
          [garden.x + garden.w, L.right, back],
        ]
      : [[L.left, L.right, back]];
    for (const [a, c, z] of behind)
      this.plane(
        g,
        groundTex(
          Math.round(c - a),
          (YARD_D - z) / 2,
          false,
          a === L.left ? 'huerto' : `huerto${a}`,
        ),
        [at(a, GROUND, z), at(c, GROUND, z), at(c, GROUND, YARD_D), at(a, GROUND, YARD_D)],
        yard,
      );
    // Dentro del ancho del edificio, donde la planta baja está vacía (un solar sin construir,
    // a menudo encima de un hueco excavado), también hay terreno: si no, se vería el hueco.
    const used: [number, number][] = [];
    for (const { room, rect } of L.rooms)
      if (room.type !== 'torre' && room.floor <= 0 && room.floor + room.h > 0)
        used.push([rect.x, rect.x + rect.w]);
    for (const s of stairCells(L)) if (s.floor === 0) used.push([s.rect.x, s.rect.x + s.rect.w]);
    // El jardín, aparte: césped cuidado con el camino pisado de una puerta a la otra (las
    // puertas están hacia `WALK_Z`, por donde cruza la gente), que acaba en un borde sin segar.
    if (garden) {
      const gx0 = garden.x;
      const gx1 = garden.x + garden.w;
      // El suelo elegido y el lecho de cada pieza (ver `jardin.ts`).
      const lawn = lawnTex(Math.round(gx1 - gx0), LAWN_D / 2, 'jardin', 8, 36, back);
      const gl = model.garden ?? {};
      const parts = cloisterParts(gl.cloister);
      paintGround(
        lawn,
        gl.ground ?? 'hierba',
        gl.slots ?? [],
        gardenSlots(b).map((r) => r.x + r.w / 2 - gx0),
        back,
        LAWN_D,
        parts.edificio || parts.anexo ? DEPTH : 0,
        parts,
      );
      this.plane(
        g,
        lawn,
        [at(gx0, GROUND, 0), at(gx1, GROUND, 0), at(gx1, GROUND, LAWN_D), at(gx0, GROUND, LAWN_D)],
        yard,
      );
      used.push([gx0, gx1]);
    }
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
    const ruin = ruined(room) && room.type !== 'torre';
    const dim = ruined(room) || bare(room);
    const ambient = ruin ? ROOM_RUIN : dim ? ROOM_DIM : room.floor < 0 ? ROOM_DEEP : ROOM_LIT;
    const sun =
      room.floor < 0
        ? 0
        : ruin
          ? 0.25
          : room.type === 'tesoro' || room.type === 'despensa'
            ? 0.15
            : 0.55;
    const theme = themeOf(room.floor);
    const seed = `${room.id}${room.type}`;
    const sides = sidesOf(b, room);
    // Sin nada debajo de su primer o último hueco, la pared de fuera baja hasta debajo del forjado.
    const free = (c: number) =>
      room.floor > 0 && !b.rooms.some((o) => this.covers(o, c, room.floor - 1));
    const back = backWall(room, r.w, r.h, this.salonLook());
    // Puerta al jardín en la planta baja, si no hay en medio una escalera sin rellano (que tapa
    // el paso; con rellano, la puerta va en ella). Como `opens` en `cutOff` (`core/rooms.ts`).
    const gate = (c: number, x: number) => room.floor === 0 && inGarden(b, c) && !isShaft(b, x);
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
      garden: {
        left: gate(room.col - 1, room.col),
        right: gate(room.col + room.w, room.col + room.w),
      },
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
        box: th.box || !!th.thick,
        thick: th.thick,
        round: th.round,
        mound: th.mound,
        mat: th.mat,
      });
      // Lo que suelta (destellos, vapor, burbujas): su zona, ya en el mundo.
      if (live)
        for (const e of th.emit ?? []) {
          const left = x - th.img.w / k / 2;
          const top = GROUND - bottom - h;
          this.emitters.push({
            kind: e.kind,
            rate: e.rate,
            x0: left + e.at[0] / k,
            y0: top + e.at[1] / k,
            x1: left + e.at[2] / k,
            y1: top + e.at[3] / k,
            z: th.z,
          });
        }
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
      if (th.light) {
        this.addLight(th.light, x, bottom, th.z, zone, sun < 0.2 || !!th.light.steady);
        // El fuego de los talleres: más vivo con trabajo, bajo sin él (ver `workshop`).
        if (WORK_FIRE[room.type] !== undefined && th.light.flicker >= WORK_FIRE[room.type]!)
          this.forgeLamps.push({ room: room.id, lamp: this.lamps.at(-1)!, base: th.light.power });
      }
      // El rayo de luz de una sala rota: ahí flota el polvo (ver `puffs`).
      if (th.light?.steady)
        this.shafts.push({ x, y0: GROUND - bottom - h, y1: GROUND - bottom, z: th.z });
    }
    if (ruin) {
      // El plano en tiza de lo que tendrá al repararla, en la pared del fondo.
      const plan = chalkPlan(
        furnish({ ...room, level: 1 }, r.w, this.salonLook()),
        r.w,
        r.h,
        DEPTH - 1,
      );
      this.figure(this.world, plan, r.x + r.w / 2, r.y + r.h, DEPTH - 1, ambient, sun);
    }
    if (room.works) {
      const k = scaleAt(3);
      const img = scaffold(r.w * k, r.h * k);
      this.figure(this.world, img, r.x + r.w / 2, r.y + r.h, 3, ROOM_DIM, sun);
    }
  }

  /** Lo que el salón enseña de la partida: decoración, escudo y trofeos. */
  private salonLook(): SalonLook {
    const m = this.model;
    if (!m) return NO_LOOK;
    return {
      decor: m.decor,
      crest: m.crest,
      trophies: m.trophies,
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
      /** La puerta al jardín de la planta baja, de cada lado. */
      garden?: { left: boolean; right: boolean };
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
        o.door !== undefined || o.garden?.left ? [0] : [],
        o.door,
        o.room,
      ),
      [at(x0, yb, 0), at(x0, yb, D), at(x0, yt, D), at(x0, yt, 0)],
      flat,
    );
    this.plane(
      g,
      mirror(
        sideTex(
          theme,
          r.h,
          doors(o.sides.right),
          `${seed}d`,
          o.garden?.right ? [0] : [],
          1,
          o.room,
        ),
      ),
      [at(x1, yb, D), at(x1, yb, 0), at(x1, yt, 0), at(x1, yt, D)],
      flat,
    );
    // El paso de cada puerta a la sala de la derecha (la de la izquierda la pone esa sala).
    for (const i of doors(o.sides.right))
      this.doorway(x1, x1 + PARTITION, floorY(o.floor + i), o.floor + i, theme, ambient, sun);
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
        const street = !doorDone && i === 0;
        if (street) doorDone = true;
        const tex = outerSide(
          themeOf(f),
          PITCH,
          street || (i === 0 && !!o.garden?.[side]),
          `${seed}f${side}${i}`,
          street ? o.door : 1,
          this.model?.look?.walls,
        );
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
    this.chimneys(L);
    const y = L.b.yard;
    const px = L.patio.x;
    const put = (img: PixelBuffer, x: number, depth: number, up = 0) =>
      this.figure(g, img, x, GROUND - up, depth, OUTDOOR, 1);
    put(Prop.well(), px + 40, 70);
    // Árboles y arbustos a los lados (ver `patio.ts`: nada cae en el jardín ni en el anexo).
    for (const t of yardTrees(L))
      put(
        t.conifer ? Prop.pine(`pino${t.x}`, t.h) : Prop.oakTree(`roble${t.x}`, t.h),
        t.x,
        t.depth,
      );
    this.plantGrass(L);
    for (const bu of yardBushes(L)) put(Prop.bush(bu.seed), bu.x, bu.depth);
    for (let i = 0; i < Math.min(2, y.patio); i++) put(dummy(), px + 110 + i * 30, 40 + i * 16);
    this.gardenArt(L, model);
    if (y.establo > 0) put(stable(y.establo), px + 120, 150);
    if (y.empal > 0)
      for (let x = px; x < L.left - 20; x += 38)
        put(palisade(y.empal > 1 ? 30 : 22), x + 20, YARD_D - 30);
    const door = L.rooms.find((x) => x.room.type === 'recibidor');
    if (door) {
      const dx = door.rect.x - WALL;
      // El rótulo: el tablero colgado de siempre, el de hierro que sale de la pared o, pintado
      // en el hastial (ver `facade`), ninguno aquí.
      const { field, dark, symbol } = model.crest;
      const sign = model.look?.sign ?? 'tablero';
      // El cuervo se posa encima (`ox`, `oy`: dónde, en píxeles del dibujo desde arriba al centro).
      const perch = (
        img: PixelBuffer,
        x: number,
        depth: number,
        up: number,
        ox: number,
        oy: number,
      ) => {
        const k = scaleAt(depth);
        this.perch = { x: x + ox / k, y: GROUND - up - (img.h - oy) / k, z: depth - 0.5 };
      };
      const lantern = Prop.lanternBody();
      perch(lantern, dx - 8, 4, 46, 0, 1);
      if (sign === 'tablero') {
        const img = Prop.crestBoard(field, dark, symbol);
        put(img, dx - 22, 6, 54);
        perch(img, dx - 22, 6, 54, 5, 1);
      } else if (sign === 'hierro') {
        const img = Prop.ironSign(field, dark, symbol);
        put(img, dx - 17, 2, 50);
        // En el brazo de hierro, hacia la punta.
        perch(img, dx - 17, 2, 50, -8, 3);
      }
      put(lantern, dx - 8, 4, 46);
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
   * Lo que se pone en el jardín (`GardenLook`): una pieza en cada trozo, detrás de por donde
   * cruza la gente; el borde de delante, bajo; y, con `lamps`, un farol entre trozo y trozo,
   * con su halo.
   */
  private gardenArt(L: RoomsLayout, model: SceneModel): void {
    const garden = L.garden;
    if (!garden) return;
    const g = this.world;
    // El canto del césped, delante del todo; con claustro, entre sus arcos (bajo ellos hay losas).
    const parts = cloisterParts(model.garden?.cloister);
    const il = parts.edificio ? CLOISTER_W : 0;
    const ir = parts.anexo ? CLOISTER_W : 0;
    const span = garden.w - il - ir;
    const mid = garden.x + il + span / 2;
    this.figure(g, verge(Math.round(span * scaleAt(VERGE_Z))), mid, GROUND, VERGE_Z, OUTDOOR, 1);
    const look = model.garden;
    if (!look) return;
    const slots = gardenSlots(L.b);
    (look.slots ?? []).forEach((p, i) => {
      const r = slots[i];
      if (!p || !r) return;
      for (const { img, dz } of pieceArt(p, `${i}`))
        this.figure(g, img, r.x + r.w / 2, GROUND, PIECE_Z + dz, OUTDOOR, 1);
    });
    if (look.edge)
      this.figure(
        g,
        edgeArt(look.edge, Math.round(span * scaleAt(EDGE_Z))),
        mid,
        GROUND,
        EDGE_Z,
        OUTDOOR,
        1,
        // El seto y las flores, con cuerpo: de arriba se les ve el lomo (la verja, no: se ve a
        // través).
        look.edge === 'verja' ? {} : { box: true, thick: 6 },
      );
    if (parts.edificio || parts.anexo) this.cloister(L, model, parts);
    if (look.edge) this.backEdge(garden, look.edge);
    if (look.lamps)
      for (const r of slots.slice(1)) {
        const lx = r.x;
        this.figure(g, Prop.lampPost(), lx, GROUND, LAMP_Z, OUTDOOR, 1);
        this.lamps.push({
          pos: at(lx, GROUND - 36, LAMP_Z),
          glow: at(lx, GROUND - 36, LAMP_Z),
          r: 72,
          color: LANTERN,
          power: 1.1,
          flicker: 0.1,
          zone: [lx - 80, -SLAB, lx + 80, 140],
          seed: lx,
          fire: false,
          halo: haloOf(60, 1, false),
        });
      }
  }

  /**
   * El claustro: soportales de piedra pegados a las dos fachadas que dan al jardín, de
   * `CLOISTER_W` de ancho y a todo el fondo, con tantas plantas como tenga cada edificio junto
   * al jardín. Cada planta: columnas de verdad (cilindros con capitel y basa) a lo hondo, los
   * arcos delante y de lado con su grosor (dos caras), el techo de vigas y, en las de arriba, el
   * suelo de la galería y el antepecho. Encima, un tejadillo con las tejas del edificio.
   */
  private cloister(L: RoomsLayout, model: SceneModel, parts: CloisterParts): void {
    const garden = L.garden;
    if (!garden) return;
    const g = this.world;
    const D = DEPTH;
    const lit = { ambient: OUTDOOR, sun: 1, dither: 0 };
    const shade = { ambient: OUTDOOR, sun: 0.55, dither: 0 };
    const deep = { ambient: OUTDOOR, sun: 0.25, dither: 0 };
    const cells = [
      ...L.rooms
        .filter(({ room }) => room.type !== 'torre')
        .flatMap(({ room, rect }) =>
          Array.from({ length: room.h }, (_, i) => ({ rect, floor: room.floor + i })),
        ),
      ...stairCells(L).map((c) => ({ rect: c.rect, floor: c.floor })),
    ];
    // Las columnas a lo hondo: la primera, detrás del arco de delante; la última, al fondo.
    const T = 2 * COL_R + 2;
    const zs = [0, 1, 2, 3].map((i) => COL_R + 1 + (i * (D - T)) / 3);
    for (const s of [1, -1] as const) {
      const xw = s === 1 ? garden.x : garden.x + garden.w;
      const touch = (r: Rect) => Math.abs(s === 1 ? r.x + r.w + WALL - xw : r.x - WALL - xw) < 1;
      const floors = new Set(
        cells.filter((c) => touch(c.rect) && c.floor >= 0).map((c) => c.floor),
      );
      // Las plantas de este lado: las que tenga el edificio junto al jardín, seguidas desde la
      // baja, y no más de las que se hayan hecho (`parts`).
      const want = s === 1 ? parts.edificio : parts.anexo;
      let top = -1;
      while (floors.has(top + 1) && top + 1 < want) top++;
      if (top < 0) continue;
      const xa = xw + s * CLOISTER_W;
      const xc = xa - s * (COL_R + 1);
      const [x0, x1] = s === 1 ? [xw, xa] : [xa, xw];
      const flip = (b: PixelBuffer) => (s === 1 ? b : mirror(b));
      // Una cara del costado, a `x`, mirando al jardín (o, con `back`, a la fachada).
      const sideAt = (img: PixelBuffer, x: number, yb: number, yt: number, o: typeof lit) =>
        this.plane(
          g,
          flip(img),
          s === 1
            ? [at(x, yb, 0), at(x, yb, D), at(x, yt, D), at(x, yt, 0)]
            : [at(x, yb, D), at(x, yb, 0), at(x, yt, 0), at(x, yt, D)],
          o,
        );
      // El tejado: el faldón del edificio que da al jardín sigue, con la misma pendiente y las
      // mismas tejas, hasta pasar los arcos; delante, el mismo canto de tejas que el hastial. Si
      // el claustro se queda más bajo que el edificio (hecho por partes), un tejadillo propio
      // contra la fachada, con las mismas tejas.
      const roof = model.look?.roof;
      const base = floorTop(top) - SLAB;
      const run = roofRuns(L).find(
        (r) => r.base === base && Math.abs((s === 1 ? r.x1 - 6 : r.x0 + 6) - xw) < 1.5,
      );
      const xr = run ? (s === 1 ? run.x1 : run.x0) : xw;
      const yr = run ? base + 2 : base - 16;
      const slope = run ? (run.h + 2) / ((run.x1 - run.x0) / 2) : 18 / (CLOISTER_W + 5);
      const xe = xa + s * 5;
      const ye = yr + slope * Math.abs(xe - xr);
      const d = D + 6;
      // La línea del tejado en cada x (lo de la planta de arriba que quede por encima, fuera).
      const roofY = (x: number) => yr + slope * s * (x - xr);
      const underRoof = (img: PixelBuffer, xAt: (i: number) => number, yt: number) => {
        for (let i = 0; i < img.w; i++) {
          const cut = Math.ceil(roofY(xAt(i)) - yt);
          for (let j = 0; j < Math.min(img.h, cut); j++) img.clear(i, j);
        }
        return img;
      };
      for (let f = 0; f <= top; f++) {
        const yt = floorTop(f) - SLAB;
        const yb = floorY(f);
        const up = f > 0;
        const spring = yt + SLAB + SPRING;
        // Delante, el arco: la cara de fuera a la luz y la de dentro, más honda, en sombra.
        let end = flip(cloisterEnd(CLOISTER_W, PITCH, up, SLAB, f < top));
        if (f === top) end = underRoof(end, (i) => x0 + i + 0.5, yt);
        this.plane(g, end, [at(x0, yb, 0), at(x1, yb, 0), at(x1, yt, 0), at(x0, yt, 0)], lit);
        this.plane(g, end, [at(x0, yb, T), at(x1, yb, T), at(x1, yt, T), at(x0, yt, T)], deep);
        // De lado, igual: fuera, a la luz; dentro (hacia la fachada), en sombra.
        const side = cloisterSide(
          D / 2,
          PITCH,
          up,
          SLAB,
          zs.map((z) => z / 2),
          f < top,
        );
        const cropAt = (x: number) =>
          f === top ? underRoof(side.crop(0, 0, side.w, side.h), () => x, yt) : side;
        sideAt(cropAt(xa), xa, yb, yt, shade);
        sideAt(cropAt(xa - s * T), xa - s * T, yb, yt, deep);
        // Las columnas, con su basa y su capitel.
        for (const z of zs) {
          const base = up ? yb - PARAPET + 2 : yb;
          this.block(
            g,
            xc - COL_R - 1,
            xc + COL_R + 1,
            base - 2,
            base,
            z - COL_R - 1,
            z + COL_R + 1,
          );
          this.block(
            g,
            xc - COL_R - 1,
            xc + COL_R + 1,
            spring - 2,
            spring + 1,
            z - COL_R - 1,
            z + COL_R + 1,
          );
          this.pillar(g, xc, z, COL_R, spring + 1, base - 2);
        }
        // El techo de vigas, visto desde abajo.
        const ceil = yt + SLAB;
        this.plane(
          g,
          ceilingTex(themeOf(f), CLOISTER_W, `claustro${xw}${f}`),
          [at(x0, ceil, D), at(x1, ceil, D), at(x1, ceil, 0), at(x0, ceil, 0)],
          deep,
        );
        if (up)
          this.plane(
            g,
            galleryFloor(CLOISTER_W, D / 2),
            [at(x0, yb, 0), at(x1, yb, 0), at(x1, yb, D), at(x0, yb, D)],
            shade,
          );
      }
      this.plane(
        g,
        roofTiles(Math.round(Math.hypot(xe - xr, ye - yr)), `claustro${xw}`, roof),
        s === 1
          ? [at(xe, ye, 0), at(xe, ye, d), at(xr, yr, d), at(xr, yr, 0)]
          : [at(xe, ye, d), at(xe, ye, 0), at(xr, yr, 0), at(xr, yr, d)],
        lit,
      );
      const ew = Math.round(Math.abs(xe - xr));
      const band = eaveFront(ew, ye - yr, roof);
      const [ex0, ex1] = s === 1 ? [xr, xe] : [xe, xr];
      this.plane(
        g,
        flip(band),
        [
          at(ex0, yr - 1 + band.h, -0.3),
          at(ex1, yr - 1 + band.h, -0.3),
          at(ex1, yr - 1, -0.3),
          at(ex0, yr - 1, -0.3),
        ],
        lit,
      );
    }
  }

  /**
   * El paso de una puerta entre dos salas, por el grueso del tabique (de `xa` a `xb`): el umbral,
   * el dintel, la jamba del fondo y la hoja, que gira sobre su gozne cuando pasa alguien.
   */
  private doorway(
    xa: number,
    xb: number,
    yb: number,
    floor: number,
    theme: Theme,
    ambient: Tint,
    sun: number,
  ): void {
    const g = this.world;
    const zf = DOOR_U0 * 2;
    const zh = DOOR_U1 * 2;
    const yt = yb - DOOR_H;
    const o = { ambient, sun, dither: 0 };
    const w = Math.round(xb - xa);
    const sill = new PixelBuffer(w, (zh - zf) / 2);
    for (let y = 0; y < sill.h; y++)
      for (let x = 0; x < w; x++) sill.set(x, y, x % 5 === 0 ? P.rust : P.oak);
    this.plane(g, sill, [at(xa, yb, zf), at(xb, yb, zf), at(xb, yb, zh), at(xa, yb, zh)], o);
    const dark = new PixelBuffer(w, 1);
    dark.hline(0, 0, w, P.ebony);
    this.plane(g, dark, [at(xa, yt, zh), at(xb, yt, zh), at(xb, yt, zf), at(xa, yt, zf)], o);
    this.plane(
      g,
      doorJamb(theme, w, `jamba${xa}${floor}`),
      [at(xa, yb, zh), at(xb, yb, zh), at(xb, yt, zh), at(xa, yt, zh)],
      o,
    );
    // La hoja, cerrada: en medio del grueso, de la jamba de delante al gozne.
    const xm = (xa + xb) / 2;
    const corners: Corners = [at(xm, yb, zf), at(xm, yb, zh), at(xm, yt, zh), at(xm, yt, zf)];
    const mat = this.look.surface(doorPanel(), corners, { ...o, side: DoubleSide });
    const mesh = new Mesh(quad(corners, this.look), mat);
    mesh.frustumCulled = false;
    g.add(mesh);
    this.doors.push({ mesh, mat, xm, yb, floor, open: 0, dir: 1 });
  }

  /** Abre las puertas por las que pasa alguien (hacia el lado contrario del que viene). */
  private swingDoors(dt: number): void {
    const zh = DOOR_U1 * 2;
    const len = (DOOR_U1 - DOOR_U0) * 2;
    for (const d of this.doors) {
      const who = this.crowd.near(d.xm, d.floor, 16);
      if (who !== null && d.open < 0.05) d.dir = who < d.xm ? 1 : -1;
      const target = who === null ? 0 : 1;
      let next = d.open + (target - d.open) * Math.min(1, dt * 6);
      if (Math.abs(next - target) < 0.003) next = target;
      if (next === d.open) continue;
      d.open = next;
      const a = d.open * 1.4;
      const xf = d.xm + d.dir * len * Math.sin(a);
      const zfree = zh - len * Math.cos(a);
      const yt = d.yb - DOOR_H;
      const c: Corners = [
        at(xf, d.yb, zfree),
        at(d.xm, d.yb, zh),
        at(d.xm, yt, zh),
        at(xf, yt, zfree),
      ];
      const pos = d.mesh.geometry.getAttribute('position') as Float32BufferAttribute;
      c.forEach((v, i) => pos.setXYZ(i, v.x, v.y, v.z));
      pos.needsUpdate = true;
      const u = d.mat.uniforms;
      const [p0, p1, , p3] = c;
      (u.uOrigin!.value as Vector3).copy(p0);
      (u.uAxisU!.value as Vector3).subVectors(p1, p0);
      (u.uAxisV!.value as Vector3).subVectors(p3, p0);
      (u.uNormal!.value as Vector3)
        .crossVectors(u.uAxisU!.value as Vector3, u.uAxisV!.value as Vector3)
        .normalize();
    }
  }

  /** Una columna de piedra de verdad: un cilindro de caras con la luz por delante a la izquierda. */
  private pillar(g: Group, cx: number, cz: number, r: number, yt: number, yb: number): void {
    const K = 10;
    const n = Math.max(4, Math.round(yb - yt));
    for (let i = 0; i < K; i++) {
      const a0 = (i / K) * Math.PI * 2;
      const a1 = ((i + 1) / K) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // La luz: de delante (z negativa) y de la izquierda.
      const l = Math.max(0, -0.55 * Math.cos(am) - 0.85 * Math.sin(am));
      const tone = l > 0.75 ? 4 : l > 0.45 ? 3 : l > 0.15 ? 2 : 1;
      const t = new PixelBuffer(1, n);
      for (let j = 0; j < n; j++) {
        const u = j / (n - 1);
        // El fuste, algo más oscuro abajo (la hierba y el polvo) y con estrías en las caras.
        const c = Math.max(0, tone - (u > 0.85 ? 1 : 0) - (i % 2 && tone > 1 ? 1 : 0));
        t.set(0, j, LIME[c]!);
      }
      const p = (a: number) => [cx + r * Math.cos(a), cz + r * Math.sin(a)] as const;
      const [xa, za] = p(a0);
      const [xb, zb] = p(a1);
      this.plane(g, t, [at(xa, yb, za), at(xb, yb, zb), at(xb, yt, zb), at(xa, yt, za)], {
        ambient: OUTDOOR,
        sun: 0.8,
        dither: 0,
      });
    }
  }

  /** Un bloque de piedra (capitel, basa): frente, lados y tapa, cada uno de su tono. */
  private block(
    g: Group,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
  ): void {
    const flat = (c: string) => {
      const b = new PixelBuffer(1, 1);
      b.set(0, 0, c);
      return b;
    };
    const o = { ambient: OUTDOOR, sun: 0.9, dither: 0 };
    this.plane(
      g,
      flat(LIME[3]),
      [at(x0, y1, z0), at(x1, y1, z0), at(x1, y0, z0), at(x0, y0, z0)],
      o,
    );
    this.plane(
      g,
      flat(LIME[4]),
      [at(x0, y0, z0), at(x1, y0, z0), at(x1, y0, z1), at(x0, y0, z1)],
      o,
    );
    this.plane(
      g,
      flat(LIME[2]),
      [at(x0, y1, z1), at(x0, y1, z0), at(x0, y0, z0), at(x0, y0, z1)],
      o,
    );
    this.plane(
      g,
      flat(LIME[1]),
      [at(x1, y1, z0), at(x1, y1, z1), at(x1, y0, z1), at(x1, y0, z0)],
      o,
    );
  }

  /**
   * El borde del fondo del jardín, igual que el de delante para que cierre igual: uno a lo ancho,
   * al fondo del césped, y a cada lado desde donde se acaba el edificio. El seto y las flores,
   * con cuerpo (cara, lomo y testeros); la verja, de barrotes que dejan ver a través.
   */
  private backEdge(garden: Rect, edge: GardenEdgeId): void {
    const g = this.world;
    const H = edge === 'flores' ? 9 : 14;
    // Lo que entra cada lado; la verja, sin grueso.
    const T = edge === 'verja' ? 0 : 8;
    const zb = LAWN_D - 18;
    const o = { ambient: OUTDOOR, sun: 1, dither: 0 };
    const top = GROUND - H;
    const xl = garden.x + 2;
    const xr = garden.x + garden.w - 2;
    // La cara, de `w` (`side`: a lo hondo, a media resolución) y el lomo, de `w` × `d`.
    const face = (w: number, seed: string, side: boolean) =>
      edge === 'seto'
        ? hedgeFace(w, H, seed, side ? 23 : 46)
        : edge === 'flores'
          ? flowerFace(w, H, seed)
          : side
            ? railFace(w, H, 2, 31)
            : railFace(w, H, 4, 62);
    const lid = (w: number, d: number, seed: string) =>
      edge === 'seto' ? leafTex(w, d, seed, true) : flowerFace(w, d, seed, true);
    // Al fondo: la cara que mira al jardín y el lomo.
    this.plane(
      g,
      face(Math.round(xr - xl), 'fondo', false),
      [at(xl, GROUND, zb), at(xr, GROUND, zb), at(xr, top, zb), at(xl, top, zb)],
      o,
    );
    if (T)
      this.plane(
        g,
        lid(Math.round(xr - xl), T / 2, 'fondo lomo'),
        [at(xl, top, zb), at(xr, top, zb), at(xr, top, zb + T), at(xl, top, zb + T)],
        o,
      );
    // A los lados, desde el fondo de los edificios hasta el del fondo.
    const z0 = DEPTH + 4;
    const len = Math.round((zb - z0) / 2);
    for (const [xo, xi] of [
      [xl, xl + T],
      [xr, xr - T],
    ] as const) {
      const right = xo === xr;
      this.plane(
        g,
        face(len, `lado${xo}`, true),
        right
          ? [at(xi, GROUND, zb), at(xi, GROUND, z0), at(xi, top, z0), at(xi, top, zb)]
          : [at(xi, GROUND, z0), at(xi, GROUND, zb), at(xi, top, zb), at(xi, top, z0)],
        { ...o, sun: 0.7 },
      );
      if (!T) continue;
      const [a, c] = right ? [xi, xo] : [xo, xi];
      this.plane(
        g,
        lid(Math.round(c - a), T, `lado lomo${xo}`),
        [at(a, top, z0), at(c, top, z0), at(c, top, zb), at(a, top, zb)],
        o,
      );
      this.plane(
        g,
        edge === 'seto'
          ? hedgeFace(Math.round(c - a), H, `testero${xo}`, 99)
          : flowerFace(Math.round(c - a), H, `testero${xo}`),
        [at(a, GROUND, z0), at(c, GROUND, z0), at(c, top, z0), at(a, top, z0)],
        o,
      );
    }
  }

  /**
   * Figura plana a `depth`, del tamaño de su dibujo; (x, base) del mundo 2D. Con `wall`, anclada
   * a esa pared (`pin`); con `box`, con volumen hasta ella (`volume`).
   */
  /**
   * Matas de hierba por el patio y alrededor, a varias profundidades: en la tierra pisada del
   * patio, pocas y en los bordes; en la hierba, muchas. Cada una cambia de fotograma con el
   * viento que pasa por su sitio (ver `draw`).
   */
  private plantGrass(L: RoomsLayout): void {
    const rng = new Rng('matas del patio');
    const kinds: TuftKind[] = ['mata', 'mata', 'alta', 'flores', 'trebol', 'mata', 'alta'];
    const art = new Map<string, ReturnType<typeof grassTuft>>();
    for (let i = 0; i < 220; i++) {
      const x = L.left - 460 + rng.next() * (L.right - L.left + 920);
      const z = 4 + rng.next() * (YARD_D - 30);
      if (!tuftAllowed(L, x, z)) continue;
      const kind = kinds[rng.int(0, kinds.length - 1)]!;
      const key = `${kind}${rng.int(0, 5)}`;
      let a = art.get(key);
      if (!a) art.set(key, (a = grassTuft(kind, key)));
      const k = scaleAt(z);
      const w = a.w / k;
      const h = a.h / k;
      const corners: Corners = [
        at(x - w / 2, GROUND, z),
        at(x + w / 2, GROUND, z),
        at(x + w / 2, GROUND - h, z),
        at(x - w / 2, GROUND - h, z),
      ];
      const m = mesh(
        quad(corners, this.look),
        this.look.surface(a.img, corners, {
          ambient: OUTDOOR,
          sun: 1,
          wrap: 0.6,
          dither: 0.03,
          frames: GRASS_FRAMES,
        }),
      );
      this.world.add(m);
      this.grass.push({ m, x, seed: rng.next() });
    }
  }

  /** El viento en `x` (más o menos −1 a 2): rachas que cruzan de izquierda a derecha. */
  private windAt(x: number, t: number): number {
    return (
      0.35 +
      Math.sin(t * 1.15 - x * 0.022) * 0.55 +
      Math.sin(t * 0.37 - x * 0.007) * 0.75 +
      Math.max(0, Math.sin(t * 0.21 - x * 0.004)) ** 6 * 1.2
    );
  }

  private figure(
    g: Group,
    img: PixelBuffer,
    x: number,
    base: number,
    depth: number,
    ambient: Tint,
    sun: number,
    o: {
      wall?: { r: Rect; back: PixelBuffer };
      box?: boolean;
      thick?: number;
      round?: Round;
      mound?: boolean;
      mat?: Mat;
    } = {},
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
    // Un montón: en vez de la figura plana, su cuerpo de revolución (ver `mound`).
    const m = o.mound
      ? this.mound(img, corners, x - w / 2, base - h, depth, k, ambient, sun)
      : mesh(
          quad(corners, this.look),
          this.look.surface(img, corners, { ambient, sun, wrap: 0.6, dither: 0.03 }),
        );
    // Con volumen, la cara y sus lados van juntos (y se anclan juntos).
    const obj = o.box || o.round ? new Group() : m;
    if (o.box || o.round) obj.add(m);
    if (o.round) this.cylinder(obj as Group, o.round, x - w / 2, base - h, depth, k, ambient, sun);
    else if (o.box)
      this.volume(obj as Group, img, x - w / 2, base - h, depth, ambient, sun, o.thick, o.mat);
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
    thick?: number,
    mat?: Mat,
  ): void {
    const k = scaleAt(depth);
    // Hasta la pared (lo empotrado) o, con `thick`, solo ese grosor (lo suelto por la sala).
    const back = thick ? Math.min(DEPTH - 0.5, depth + thick) : DEPTH - 0.5;
    // A lo hondo, un téxel cada dos de mundo (se ve muy de lado: no hace falta más).
    const n = Math.max(2, Math.round((back - depth) / 2));
    const X = (px: number) => left + px / k;
    const Y = (py: number) => top + py / k;
    const opts = { ambient, sun, wrap: 0.6, dither: 0.03 };
    for (const f of faces(img)) {
      const len = f.to - f.from;
      if (f.side === 'top') {
        const tex = new PixelBuffer(len, n);
        for (let i = 0; i < len; i++)
          for (let j = 0; j < n; j++) tex.set(i, j, sideTexel(f.colors[i]!, i, j, n, mat));
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
      // A lo hondo, de delante (0) al fondo (n): en la izquierda, la textura va al revés.
      for (let j = 0; j < len; j++)
        for (let i = 0; i < n; i++) {
          const d = f.side === 'left' ? n - 1 - i : i;
          tex.set(i, j, sideTexel(f.colors[j]!, j, d, n, mat));
        }
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

  /**
   * Un cilindro de verdad detrás del dibujo (cubas tumbadas, barriles de pie): caras alrededor,
   * con sus duelas y aros, que la luz sombrea según hacia dónde miran. Al mover la cámara se ve
   * el cuerpo redondo; el dibujo sigue delante (la tapa o el frente pintados).
   */
  private cylinder(
    g: Group,
    c: Round,
    left: number,
    top: number,
    depth: number,
    k: number,
    ambient: Tint,
    sun: number,
  ): void {
    const K = 16;
    const R = c.r / k;
    const cx = left + c.cx / k;
    const cy = top + c.cy / k;
    const opts = { ambient, sun, wrap: 0.35, dither: 0.03 };
    // Duelas (una clara y otra oscura) y aros, a lo largo del eje.
    const staves = (i: number, n: number, hoops: number[]) => {
      const t = new PixelBuffer(2, n);
      for (let j = 0; j < n; j++) {
        const u = j / Math.max(1, n - 1);
        const hoop = hoops.some((hp) => Math.abs(u - hp) < 0.6 / n + 0.02);
        const col = hoop ? c.hoop : i % 2 ? c.dark : c.wood;
        t.set(0, j, col);
        t.set(1, j, hoop ? c.hoop : c.dark);
      }
      return t;
    };
    if (c.axis === 'fondo') {
      const z0 = depth + 0.3;
      const z1 = depth + c.len;
      const n = Math.max(6, Math.round(c.len));
      const P = (a: number) => [cx + R * Math.cos(a), cy - R * Math.sin(a)] as const;
      for (let i = 0; i < K; i++) {
        const [x0, y0] = P((i / K) * Math.PI * 2);
        const [x1, y1] = P(((i + 1) / K) * Math.PI * 2);
        this.plane(
          g,
          staves(i, n, [0.12, 0.88]),
          [at(x1, y1, z0), at(x0, y0, z0), at(x0, y0, z1), at(x1, y1, z1)],
          opts,
        );
      }
      return;
    }
    // De pie: el frente toca el dibujo; el centro, un radio más al fondo.
    const zc = depth + R + 0.3;
    const yt = cy - c.len / 2 / k;
    const yb = cy + c.len / 2 / k;
    const n = Math.max(6, Math.round(c.len));
    const P = (a: number) => [cx + R * Math.cos(a), zc + R * Math.sin(a)] as const;
    for (let i = 0; i < K; i++) {
      const [x0, z0] = P((i / K) * Math.PI * 2);
      const [x1, z1] = P(((i + 1) / K) * Math.PI * 2);
      this.plane(
        g,
        staves(i, n, [0.2, 0.75]),
        [at(x0, yb, z0), at(x1, yb, z1), at(x1, yt, z1), at(x0, yt, z0)],
        opts,
      );
    }
    // La tapa de arriba: un redondel de madera con su borde.
    const s = Math.max(4, Math.round(c.r * 2));
    const lid = new PixelBuffer(s, s);
    lid.ellipse(s / 2, s / 2, s / 2, s / 2, c.dark);
    lid.ellipse(s / 2, s / 2, s / 2 - 1, s / 2 - 1, c.wood);
    this.plane(
      g,
      lid,
      [
        at(cx - R, yt, zc - R),
        at(cx + R, yt, zc - R),
        at(cx + R, yt, zc + R),
        at(cx - R, yt, zc + R),
      ],
      opts,
    );
  }

  /**
   * Un montón de verdad: cada fila del dibujo es un aro (de su ancho, con su centro) alrededor de
   * un eje vertical, aplastado en profundidad para no llegar a la pared. La mitad de delante
   * lleva el dibujo tal cual, visto de frente (así de frente se ve igual que la figura plana); la
   * de atrás, el mismo oro algo más oscuro (es lo que asoma por arriba y por los lados).
   */
  private mound(
    img: PixelBuffer,
    corners: Corners,
    left: number,
    top: number,
    depth: number,
    k: number,
    ambient: Tint,
    sun: number,
  ): Group {
    const K = 14;
    const rows: { c: number; r: number }[] = [];
    let t0 = img.h;
    for (let y = 0; y < img.h; y++) {
      let x0 = -1;
      let x1 = -1;
      for (let x = 0; x < img.w; x++)
        if (img.get(x, y)) {
          if (x0 < 0) x0 = x;
          x1 = x + 1;
        }
      if (x0 >= 0) t0 = Math.min(t0, y);
      rows.push(x0 < 0 ? { c: img.w / 2, r: 0 } : { c: (x0 + x1) / 2, r: (x1 - x0) / 2 });
    }
    const rMax = Math.max(1, ...rows.map((r) => r.r));
    // Lo hondo: casi como ancho, pero sin pasar de la pared del fondo.
    const rz = Math.min((rMax * 0.6) / k, (DEPTH - 0.5 - depth) / 2);
    const zc = depth + rz;
    const g = new Group();
    const half = (front: boolean, tex: PixelBuffer) => {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      // Las juntas entre filas: la de arriba de la primera fila sale en punta.
      for (let b = t0; b <= img.h; b++) {
        const row = rows[Math.min(img.h - 1, b)]!;
        const up = rows[Math.max(t0, b - 1)]!;
        const r = b === t0 ? row.r * 0.4 : Math.max(row.r, up.r);
        const c = b === t0 ? row.c : (row.c + up.c) / 2;
        for (let i = 0; i <= K; i++) {
          // De la izquierda a la derecha, por delante o por detrás.
          const a = Math.PI * (1 - i / K);
          const px = c + r * Math.cos(a);
          const dz = (r / rMax) * rz * Math.sin(a);
          pos.push(left + px / k, top + b / k, front ? zc - dz : zc + dz);
          // El color, un poco hacia dentro del borde: el contorno del dibujo no se estira por
          // el costado (de frente apenas se nota).
          const tx = c + Math.max(0, r - 0.7) * Math.cos(a);
          uv.push(Math.max(0, Math.min(1, tx / img.w)), 1 - b / img.h);
        }
      }
      const n = K + 1;
      for (let b = 0; b < img.h - t0; b++)
        for (let i = 0; i < K; i++) {
          const p = b * n + i;
          idx.push(p, p + n, p + 1, p + 1, p + n, p + n + 1);
        }
      const geo = new BufferGeometry();
      geo.setAttribute(
        'position',
        new Float32BufferAttribute(
          pos.map((v, j) => (j % 3 === 1 ? GROUND - v : j % 3 === 2 ? -v : v)),
          3,
        ),
      );
      geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const m = this.look.surface(tex, corners, {
        ambient,
        sun,
        wrap: 0.6,
        dither: 0.03,
        side: DoubleSide,
      });
      g.add(mesh(this.look.own(geo), m));
    };
    half(true, img);
    const dark = img.clone();
    dark.map((c) => (c ? rgba(darker(toHex(c), 1)) : 0));
    half(false, dark);
    return g;
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
    this.swingDoors(dt);
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
    this.pets.update(dt, this.t);
    this.incidents.update(dt, this.t);
    this.edgePan(dt);
    if (this.marker && this.t > this.marker.until) this.marker = null;
    this.camera.update(dt);
    this.puffs(dt);
    // Las gotas de la gotera salpican al caer.
    this.particles.update(dt, this.t, (p) => {
      if (p.kind !== 'drip') return;
      for (let i = 0; i < 3; i++) this.particles.spawn('splash', p.x, p.y - 1);
    });
  }

  /**
   * Chimeneas sobre el tejado: encima del hogar del salón y de la cocina (si están en uso), cada
   * una en la vertiente que tenga encima.
   */
  private chimneys(L: RoomsLayout): void {
    this.smokeAt = [];
    const runs = roofRuns(L);
    for (const { room, rect } of L.rooms) {
      if (room.level < 1 || (room.type !== 'salon' && room.type !== 'cocina')) continue;
      const r = interior(rect);
      const x = room.type === 'salon' ? r.x + r.w - HEARTH_RIGHT : r.x + r.w * 0.3;
      const run = runs.find((u) => x > u.x0 + 8 && x < u.x1 - 8);
      if (!run) continue;
      const roof = run.base - roofLift(runs, x, run.base);
      const img = Prop.chimneyStack();
      const k = scaleAt(CHIMNEY_Z);
      // Hundida un poco en el tejado: lo de debajo lo tapa el hastial.
      const base = roof + 10;
      this.figure(this.world, img, x, base, CHIMNEY_Z, OUTDOOR, 1);
      this.smokeAt.push({ x, y: base - img.h / k });
    }
  }

  /** Humo de las chimeneas: más seguido de noche, cuando se enciende más el fuego. */
  private puffs(dt: number): void {
    // Los talleres con trabajo: brasas que suben de la fragua; desmontando, chispas en el banco.
    for (const c of this.crafted.values()) {
      if (c.stalled) continue;
      const forge = this.spotOf(c.room, 'fuelle');
      if (forge && Math.random() < 5 * dt) {
        const p = this.onProp(forge, 0.35 + Math.random() * 0.3, 0.55);
        this.particles.spawn('ember', p.x, p.y);
      }
      const bench = c.undo ? this.benchOf(c.room) : undefined;
      if (bench && Math.random() < 2 * dt) {
        const p = this.onProp(bench, 0.3 + Math.random() * 0.4, 0.2);
        for (let i = 0; i < 3; i++) this.particles.spawn('spark', p.x, p.y);
      }
    }
    // Los golpes de la gente: martillazo (chispas), temple (vapor), tijeretazo (hilachas), tinte
    // y caldero (burbujas y vapor), la gota del alambique (destello); con su sonido si se ven.
    for (const h of this.crowd.hits.splice(0)) {
      const room = this.layout?.rooms.find(
        (r) => r.rect.x <= h.x && h.x <= r.rect.x + r.rect.w && floorY(r.room.floor) === h.y,
      )?.room.id;
      const at = HIT_AT[h.kind];
      const spot = room ? this.spotOf(room, at.poi) : undefined;
      if (!spot) continue;
      const p = this.onProp(spot, 0.5, at.v);
      const spread = (k: PKind, n: number, w: number) => {
        for (let i = 0; i < n; i++) this.particles.spawn(k, p.x + (Math.random() - 0.5) * w, p.y);
      };
      if (h.kind === 'martillo') spread('spark', 9, 0);
      else if (h.kind === 'temple') spread('steam', 14, 10);
      else if (h.kind === 'tijera') spread('dust', 3, 6);
      else if (h.kind === 'tinte' || h.kind === 'remover') {
        spread('bubble', 3, 12);
        spread('steam', 5, 12);
      } else this.particles.spawn('glint', p.x, p.y, { max: 0.6 });
      const c = this.camera;
      if (at.sound && p.x > c.px && p.x < c.px + c.vw && p.y > c.py && p.y < c.py + c.vh)
        this.cb.onSound?.(at.sound, 0.35);
    }
    // Lo que sueltan los muebles: cada uno a su ritmo, en un punto al azar de su zona.
    if (this.emitters.length) {
      const c = this.camera;
      const view: View = { px: c.px, py: c.py, vw: c.vw, vh: c.vh };
      for (const e of this.emitters) {
        if (Math.random() > e.rate * dt) continue;
        if (e.x1 < view.px - 20 || e.x0 > view.px + view.vw + 20) continue;
        const p = project(
          view,
          e.x0 + Math.random() * (e.x1 - e.x0),
          e.y0 + Math.random() * (e.y1 - e.y0),
          e.z,
        );
        this.particles.spawn(e.kind, view.px + p.x, view.py + p.y);
      }
    }
    // Motas de polvo que bajan despacio por el rayo de luz de las salas rotas.
    this.dustT -= dt;
    if (this.dustT <= 0 && this.shafts.length) {
      this.dustT = 0.35;
      const c = this.camera;
      const view: View = { px: c.px, py: c.py, vw: c.vw, vh: c.vh };
      for (const s of this.shafts) {
        const y = s.y0 + 8 + Math.random() * (s.y1 - s.y0 - 16);
        const p = project(view, s.x + (Math.random() - 0.5) * 14, y, s.z);
        this.particles.spawn('dust', view.px + p.x, view.py + p.y, { max: 3, vy: 2, vx: 0.6 });
      }
    }
    // Una cruz roja que sube, de vez en cuando, sobre cada herido acostado.
    this.crossT -= dt;
    if (this.crossT <= 0) {
      this.crossT = 2.6;
      // (Las partículas se pintan sin perspectiva: se pasa el punto de la cama a la vista.)
      const c = this.camera;
      const view: View = { px: c.px, py: c.py, vw: c.vw, vh: c.vh };
      for (const p of this.crowd.injured()) {
        const s = project(view, p.x, p.y, p.z);
        this.particles.spawn('cross', view.px + s.x - 3, view.py + s.y - 10);
      }
    }
    if (!this.smokeAt.length) return;
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = (this.night ? 0.12 : 0.25) * (0.7 + Math.random() * 0.6);
    for (const p of this.smokeAt)
      this.particles.spawn('chimney', p.x + (Math.random() - 0.5) * 3, p.y - 1);
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
    const boost =
      (window as unknown as { __lampK?: number }).__lampK ?? (this.moodLight ? MOOD_LAMPS : 1);
    const lampK = (0.3 + 0.7 * (1 - dl.day)) * boost;
    const fireK = (0.6 + 0.4 * (1 - dl.day)) * boost;
    const cx = view.px + view.vw / 2;
    const cy = GROUND - (view.py + view.vh / 2);
    const x0 = view.px - 40;
    const x1 = view.px + view.vw + 40;
    const y0 = GROUND - (view.py + view.vh + 40);
    const y1 = GROUND - (view.py - 40);
    const near = [...this.lamps, ...this.incidentLamps]
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
    // La hierba, con el viento que pasa por su sitio (unas 8 veces por segundo).
    const gt = Math.floor(t * 8);
    if (gt !== this.grassTick) {
      this.grassTick = gt;
      for (const gr of this.grass) {
        const w = this.windAt(gr.x, t) + (gr.seed - 0.5) * 0.4;
        const f = w < -0.4 ? 0 : w < 0.35 ? 1 : w < 1.05 ? 2 : 3;
        const u = (gr.m.material as ShaderMaterial).uniforms.uUvOffset!.value;
        u.x = f / GRASS_FRAMES;
      }
    }
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
      this.hotPieces();
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
    // Primera pasada (prueba de sombras): la escena a una textura, solo por su profundidad.
    const w = window as unknown as {
      __shadows?: boolean;
      __ambK?: number;
      __lampK?: number;
      __bands?: boolean;
    };
    // Prueba de luz (estudio del estilo nuevo), apagada salvo que se pida desde la consola.
    const shadows = w.__shadows === true;
    this.shared.uAmbK.value = w.__ambK ?? (this.moodLight ? MOOD_AMBIENT : 1);
    // El sol con dirección (luz con ambiente): sale por la derecha y se pone por la izquierda,
    // como el del cielo, y viene algo de delante; de noche, la luna, alta y de lado.
    const dl0 = this.daylight();
    const p = Math.min(1, 0.1 + dl0.tod * 0.95);
    const sunUp = Math.max(dl0.day, dl0.dusk) > 0.05;
    const sunDir = sunUp
      ? new Vector3(1 - 2 * p, 0.2 + 0.9 * Math.sin(Math.PI * p), 0.6)
      : new Vector3(-0.45, 0.75, 0.6);
    this.shared.uSunDir.value.copy(sunDir.normalize());
    this.shared.uSunK.value = this.moodLight ? 1 : 0;
    this.shared.uBands.value = (w.__bands ?? this.moodLight) ? 1 : 0;
    if (shadows) {
      const { vw, vh } = this.camera;
      if (!this.depthRT || this.depthRT.width !== vw || this.depthRT.height !== vh) {
        this.depthRT?.dispose();
        const dt = new DepthTexture(vw, vh);
        dt.type = UnsignedIntType;
        this.depthRT = new WebGLRenderTarget(vw, vh, { depthTexture: dt, depthBuffer: true });
      }
      this.shared.uShadows.value = 0;
      this.shared.uDepth.value =
        this.shared.uDepth.value === this.depthRT.depthTexture
          ? this.noDepth
          : this.shared.uDepth.value;
      r.setRenderTarget(this.depthRT);
      r.clear();
      r.render(this.scene, this.cam3);
      r.setRenderTarget(null);
      this.shared.uShadows.value = (window as unknown as { __dbg?: boolean }).__dbg ? 2 : 1;
      this.shared.uDepth.value = this.depthRT.depthTexture;
      this.shared.uProj.value.copy(this.cam3.projectionMatrix);
    } else this.shared.uShadows.value = 0;
    r.clear();
    r.render(this.skyScene, this.flat);
    r.clearDepth();
    r.render(this.scene, this.cam3);
    if (shadows) this.shared.uDepth.value = this.noDepth;
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
      if (s.info) {
        // Un sitio que solo se enseña: borde claro de puntos, sin cruz.
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = P.mist;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        for (let i = beat; i < w; i += 4) {
          ctx.fillRect(x + i, y, 2, 1);
          ctx.fillRect(x + i, y + h - 1, 2, 1);
        }
        for (let i = beat; i < h; i += 4) {
          ctx.fillRect(x, y + i, 1, 2);
          ctx.fillRect(x + w - 1, y + i, 1, 2);
        }
        continue;
      }
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
      out.push({
        x: (p.x0 + p.x1) / 2,
        floor: room.floor,
        kind,
        half: (p.x1 - p.x0) / 2,
        z: p.z,
      });
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

  /** El animal que hay bajo un punto de la pantalla (no mientras se elige sitio para una obra). */
  private petAt(cssX: number, cssY: number): PetId | null {
    if (this.targets) return null;
    const { camera } = this;
    const v: View = { px: camera.px, py: camera.py, vw: camera.vw, vh: camera.vh };
    return this.pets.hit(v, cssX / camera.zoom, cssY / camera.zoom);
  }

  /** Tocar al gato (ronronea con corazones) o al perro (se sienta y ladra). */
  private pat(id: PetId): void {
    const head = this.pets.touch(id);
    if (!head) return;
    const c = this.camera;
    const view: View = { px: c.px, py: c.py, vw: c.vw, vh: c.vh };
    const s = project(view, head.x, head.y, head.z);
    const x = view.px + s.x;
    const y = view.py + s.y;
    const kind = kindOf(id);
    if (kind === 'rata') this.cb.onSound?.('squeak');
    else if (kind === 'murcielago') this.cb.onSound?.('bats');
    else if (kind === 'gato') {
      for (let i = 0; i < 4; i++) this.particles.spawn('heart', x - 4 + i * 2, y - 2 - i * 3);
      this.cb.onSound?.('purr');
    } else if (kind === 'perro') {
      this.particles.spawn('bark', x - 2, y - 6);
      this.particles.spawn('bark', x + 2, y - 4, { max: 0.9 });
      this.cb.onSound?.('bark');
    } else {
      for (let i = 0; i < 2; i++) this.particles.spawn('feather', x - 1 + i * 3, y + 2);
      this.cb.onSound?.('caw');
    }
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
    const pet = this.petAt(cssX, cssY);
    if (pet) {
      this.pat(pet);
      this.cb.onHotspot?.(`bicho:${pet}`, this.pets.label(pet), {
        x: cssX,
        y: cssY,
        wx: w.x,
        wy: w.y,
      });
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
        const pet = who ? null : this.petAt(p.x, p.y);
        if (pet) {
          this.hover = null;
          this.hoverProp = null;
          c.style.cursor = 'pointer';
          this.cb.onHover?.(this.pets.label(pet), p);
          return;
        }
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
        if (wasClick) {
          swallowGhostClick(c);
          this.click(p.x, p.y);
        }
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

/**
 * Tras un toque en la escena, el navegador manda un «click» al mismo punto. Si el toque ha
 * abierto algo encima (la ficha de un héroe), ese click cae en lo nuevo: en el fondo, que la
 * cierra al momento (en horizontal parecía que tocar a un héroe no hacía nada), o en un botón
 * de la ficha. Se descarta el click que llegue enseguida fuera del lienzo.
 */
function swallowGhostClick(canvas: HTMLCanvasElement): void {
  const stop = (e: MouseEvent) => {
    if (e.target === canvas) return;
    e.preventDefault();
    e.stopPropagation();
    done();
  };
  const done = () => {
    window.removeEventListener('click', stop, true);
    clearTimeout(t);
  };
  window.addEventListener('click', stop, true);
  const t = setTimeout(done, 400);
}
