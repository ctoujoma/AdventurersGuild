/**
 * La gente que se ve en la escena 3D: una figura plana por persona que anda por las salas y las
 * escaleras, se sienta en el salón, duerme en su cama y sale por el recibidor. Cada figura usa
 * un atlas con todos sus fotogramas (de pie, parpadeo, andando, sentada y en la cama) y la escena
 * solo cambia cuál se ve y dónde está.
 */
import { Group, PlaneGeometry, Vector3, type Mesh, type ShaderMaterial } from 'three';
import { P } from '../../art/palette';
import { PixelBuffer, alpha } from '../../art/pixel';
import { FEET_Y, heroSprites, type HeroSprites } from '../../art/heroes/hero';
import { bunkQuilt } from '../props';
import { generateLook, type OutfitId } from '../../art/heroes/look';
import type { SceneHero, SceneVisitors } from '../scene';
import { GROUND } from '../geometry';
import { Look, mesh, type Shared } from './gl';
import { floorY, type RoomsLayout, type Rect } from './layout';
import {
  LANES,
  homes,
  outside,
  route,
  segments,
  spots,
  wander,
  workGoal,
  type Goal,
  type Place,
  type Segments,
  type SeatSpot,
  type Spots,
} from './people';
import { project, scaleAt, type View } from './view3d';

/** Como mucho, tantas figuras animadas a la vez (y de ellas, tantos visitantes). */
export const MAX_ACTORS = 30;
const MAX_VISITORS = 8;
/** Los visitantes llegan repartidos entre la mañana y poco antes del anochecer y se quedan un rato. */
const ARRIVE_FROM = 0.04;
const ARRIVE_SPAN = 0.68;
const STAY = 0.22;
/** Pinta de cada tipo de visitante. */
const VISITOR_LOOK: Record<string, OutfitId> = {
  campesino: 'explorador',
  mercader: 'picaro',
  noble: 'clerigo',
  espia: 'picaro',
};
const VISITOR_NAME: Record<string, string> = {
  campesino: 'Campesino',
  mercader: 'Mercader',
  noble: 'Noble',
  espia: 'Forastero callado',
};
const SPEED = 36;
const CLIMB = 30;

/** Fotogramas del atlas (cada uno de CELL × SPRITE de alto). */
const CELL = 24;
const TALL = 28;
const F = {
  idle: 0,
  blink: 2,
  walk: 3,
  walkL: 7,
  sit: 11,
  sleep: 12,
  cot: 16,
  mat: 17,
  down: 18,
  downL: 19,
} as const;
const FRAMES = 20;

type Tint = readonly [number, number, number];

interface Actor {
  hero: SceneHero;
  /** Sus fotogramas (para tocarle solo donde se le ve). */
  img: PixelBuffer;
  mat: ShaderMaterial;
  mesh: Mesh;
  x: number;
  /** Altura de los pies en el mundo (y hacia abajo) y planta en la que está o a la que va. */
  y: number;
  floor: number;
  lane: number;
  path: Place[];
  goal: Goal | null;
  pose: 'stand' | 'walk' | 'sit' | 'bed' | 'down';
  wait: number;
  dir: 1 | -1;
  dist: number;
  blinkAt: number;
  seat: SeatSpot | null;
  /** Saliendo de misión: al llegar al patio desaparece. */
  leaving: boolean;
  /** Trabajador del pueblo: de camino a casa al anochecer y ya fuera (no se ve). */
  homeward: boolean;
  gone: boolean;
  /** Segundos que lleva sentado (los visitantes no se van sin haber comido algo). */
  sat: number;
  /** Cogido con el dedo: dónde se le lleva (pies, en el mundo), colgando bajo el dedo. */
  held?: { x: number; y: number } | null;
  /** En un asalto: corre más (o menos) para llegar a su hora, y el golpe que está dando (0–1). */
  run?: number;
  swing?: number;
}

const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
};

/** Atlas de una persona: todos sus fotogramas uno al lado del otro. */
function atlas(spr: HeroSprites): PixelBuffer {
  const b = new PixelBuffer(CELL * FRAMES, TALL);
  const put = (img: PixelBuffer, i: number, dx = 3, flip = false) =>
    b.blit(img, i * CELL + dx, 0, flip);
  put(spr.idle[0], F.idle);
  put(spr.idle[1], F.idle + 1);
  put(spr.blink, F.blink);
  spr.walk.forEach((w, i) => {
    put(w, F.walk + i);
    put(w, F.walkL + i, 3, true);
  });
  put(spr.sit, F.sit);
  // En la cama: la cabeza en la almohada y la manta por encima de los hombros. Las literas
  // tienen la manta del color del nivel; el catre, sábana blanca.
  // (El fotograma empieza 2 píxeles a la izquierda de la litera y 4 del catre.)
  for (let lvl = 0; lvl < 4; lvl++) {
    const x = (F.sleep + lvl) * CELL;
    const q = bunkQuilt(lvl);
    b.blit(spr.sleep, x, 0);
    b.rect(x + 2, 12, 21, 6, q[2]!);
    b.hline(x + 2, 12, 21, q[3]!);
    b.hline(x + 2, 17, 21, q[1]!);
  }
  const x = F.cot * CELL;
  b.blit(spr.bed, x, 0);
  b.rect(x + 4, 14, 20, 4, P.white);
  b.hline(x + 4, 17, 20, P.mist);
  // En el jergón del servicio: una manta parda de lana.
  const m = F.mat * CELL;
  b.blit(spr.bed, m, 0);
  b.rect(m + 4, 14, 20, 4, P.clay);
  b.hline(m + 4, 14, 20, P.tan);
  b.hline(m + 4, 17, 20, P.rust);
  // En el suelo, caído: la figura de pie tumbada de lado (la cabeza a un lado o al otro).
  const src = spr.idle[0];
  for (const [i, left] of [
    [F.down, true],
    [F.downL, false],
  ] as const)
    for (let y = 2; y < Math.min(src.h, CELL + 2); y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x]!;
        if (!c) continue;
        const dx = left ? y - 2 : CELL + 1 - y;
        const dy = TALL - 2 - src.w + x;
        if (dy >= 0 && dy < TALL) b.data[dy * b.w + i * CELL + dx] = c;
      }
  return b;
}

/** Punto 3D a partir de una x y una y del mundo 2D (y hacia abajo) y una profundidad. */
const at = (x: number, y: number, depth: number) => new Vector3(x, GROUND - y, -depth);

export class Crowd {
  readonly group = new Group();
  private look: Look;
  private geo = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  private actors = new Map<string, Actor>();
  private L: RoomsLayout | null = null;
  private S: Spots | null = null;
  private segs: Segments = new Map();
  private homes = new Map<string, Goal>();
  /** Los que se han ido de misión por la puerta: al volver entran desde el patio. */
  private away = new Set<string>();
  /** De día cada uno va a lo suyo; al atardecer, andando a su cama; de noche, acostados. */
  private time: 'day' | 'dusk' | 'night' = 'day';
  /** Para no repetir decisiones iguales: un generador sencillo con semilla. */
  private seed = 1;
  /** Los visitantes de hoy. */
  private visitors: SceneVisitors = { day: 0, kinds: [] };
  /** Durante un asalto nadie decide por su cuenta: la escena dice a dónde va cada uno. */
  private scripted = false;
  /** La hora de la escena en el último fotograma (para saber qué dibujo tiene cada uno). */
  private now = 0;

  constructor(
    shared: Shared,
    private tint: (x: number, floor: number) => { ambient: Tint; sun: number },
  ) {
    this.look = new Look(shared);
  }

  private rnd = () => {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return (this.seed >>> 8) / 16777216;
  };

  /** El edificio ha cambiado: sitios nuevos y cada uno se recoloca si se ha quedado en el aire. */
  setLayout(L: RoomsLayout): void {
    this.L = L;
    this.S = spots(L);
    this.segs = segments(L);
    this.rehome();
    for (const a of this.actors.values()) {
      a.path = [];
      a.goal = null;
      a.seat = null;
      a.wait = this.rnd() * 2;
      if (!route(L, { x: a.x, floor: a.floor }, this.S.door, this.segs)) this.put(a, this.S.door);
      if (a.pose === 'sit' || a.pose === 'bed') a.pose = 'stand';
    }
  }

  /** La gente de la casa: altas, bajas y cambios (sale de misión, vuelve, se hiere…). */
  setPeople(heroes: readonly SceneHero[]): void {
    const order = (h: SceneHero) =>
      h.guard ? 0 : h.status === 'herido' ? 1 : h.status === 'ok' ? 2 : 3;
    const home = heroes.filter((h) => h.status !== 'mision').sort((a, b) => order(a) - order(b));
    const shown = new Set(home.slice(0, MAX_ACTORS).map((h) => h.id));
    for (const [id, a] of this.actors) {
      if (a.hero.visitor) continue;
      const h = heroes.find((x) => x.id === id);
      // El que acaba de salir de misión sigue hasta la puerta aunque ya no esté en casa.
      const going = h?.status === 'mision' && (a.leaving || a.hero.status === 'ok');
      if (!h || (!shown.has(id) && !going)) {
        this.remove(id);
        continue;
      }
      const was = a.hero.status;
      const work = a.hero.work;
      a.hero = h;
      if (work !== h.work && !a.gone && !a.leaving) a.wait = 0;
      if (was === h.status) continue;
      a.goal = null;
      a.path = [];
      a.seat = null;
      if (h.status === 'mision') {
        // Coge sus cosas y sale por el recibidor hasta perderse en el patio.
        a.leaving = true;
        this.go(a, { place: outside(), pose: 'stand' });
      } else if (was === 'mision' || was === 'candidato') {
        if (was === 'mision') this.put(a, outside());
        a.wait = 0;
      }
    }
    for (const h of home) {
      if (!shown.has(h.id) || this.actors.has(h.id)) continue;
      this.add(h);
    }
    this.rehome();
    // Quien ya tiene cama en el servicio deja de irse al pueblo.
    for (const a of this.actors.values()) {
      if (!a.gone || this.village(a)) continue;
      a.gone = false;
      a.mesh.visible = true;
      const g = this.homes.get(a.hero.id);
      if (this.time === 'night' && g) {
        this.put(a, g.place);
        this.arrive(a, g);
      } else {
        this.put(a, outside());
        a.wait = 0;
      }
    }
  }

  /** Los visitantes de hoy: si cambia el día, los de ayer se van. */
  setVisitors(v: SceneVisitors): void {
    if (v.day === this.visitors.day && v.kinds.length === this.visitors.kinds.length) return;
    if (v.day !== this.visitors.day)
      for (const a of [...this.actors.values()]) if (a.hero.visitor) this.remove(a.hero.id);
    this.visitors = v;
  }

  /** La hora del día: entran los visitantes que tocan y se van los que ya han estado un rato. */
  setClock(tod: number): void {
    if (!this.S || !this.L) return;
    const { day, kinds } = this.visitors;
    const n = kinds.length;
    let present = [...this.actors.values()].filter((a) => a.hero.visitor && !a.leaving).length;
    for (let i = 0; i < n; i++) {
      const id = `vis-${day}-${i}`;
      const at = ARRIVE_FROM + (i / Math.max(1, n)) * ARRIVE_SPAN;
      const a = this.actors.get(id);
      const due = tod >= at && tod < at + STAY && this.time === 'day';
      // Con el reloj rápido, que al menos se siente un rato antes de irse.
      const done = this.time !== 'day' || tod >= at + STAY * 2 || (a?.sat ?? 0) >= 6;
      if (due && !a && present < MAX_VISITORS && this.actors.size < MAX_ACTORS) {
        this.addVisitor(id, kinds[i]!, i);
        present++;
      } else if (!due && a && !a.leaving && (tod < at || done)) {
        // Ya ha comido y bebido: se va por donde vino.
        a.leaving = true;
        a.goal = null;
        this.go(a, { place: outside(), pose: 'stand' });
        present--;
      }
    }
  }

  private addVisitor(id: string, kind: string, i: number): void {
    const look = generateLook(
      `${id}-${kind}`,
      VISITOR_LOOK[kind] ?? 'explorador',
      i % 2 ? 'f' : 'm',
    );
    this.add({
      id,
      name: VISITOR_NAME[kind] ?? 'Visitante',
      status: 'ok',
      look,
      marks: {},
      visitor: true,
    });
    const a = this.actors.get(id)!;
    this.put(a, outside());
    // A una mesa libre o, si no queda ninguna, de pie en la barra.
    const free = this.S!.seats.filter((x) => !this.taken().has(x));
    const seat = free[Math.floor(this.rnd() * free.length)];
    const goal: Goal = seat
      ? { place: { x: seat.x, floor: seat.floor }, pose: 'sit', z: seat.z }
      : {
          place: this.S!.bar[Math.floor(this.rnd() * this.S!.bar.length)] ?? this.S!.door,
          pose: 'stand',
        };
    this.go(a, goal);
    a.wait = 999;
  }

  /** Cambia la hora: al atardecer van a la cama andando y de noche ya están acostados. */
  setNight(time: 'day' | 'dusk' | 'night'): void {
    if (time === this.time) return;
    this.time = time;
    if (time === 'day') {
      // Los del pueblo llegan por la mañana, cada uno a su hora.
      for (const a of this.actors.values()) {
        a.homeward = false;
        if (a.gone) {
          a.gone = false;
          a.mesh.visible = true;
          a.path = [];
          a.pose = 'stand';
          this.put(a, outside());
        }
      }
    }
    if (time !== 'night') {
      for (const a of this.actors.values()) a.wait = this.rnd() * 3;
      return;
    }
    for (const a of [...this.actors.values()]) {
      if (a.hero.visitor) {
        this.remove(a.hero.id);
        continue;
      }
      if (a.leaving || a.gone) continue;
      if (this.village(a)) {
        this.hide(a);
        continue;
      }
      const g = this.homes.get(a.hero.id);
      if (!g) continue;
      a.path = [];
      this.seatFree(a);
      this.put(a, g.place);
      this.arrive(a, g);
    }
  }

  update(dt: number, t: number): void {
    this.now = t;
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      if (a.held) {
        this.place(a, t);
        continue;
      }
      if (this.scripted) {
        if (a.path.length) this.walk(a, dt);
        if (a.swing) a.swing = Math.max(0, a.swing - dt * 3);
        this.place(a, t);
        continue;
      }
      if (a.pose === 'sit') a.sat += dt;
      if (a.path.length) this.walk(a, dt);
      else if (a.leaving) {
        if (!a.hero.visitor) this.away.add(a.hero.id);
        this.remove(a.hero.id);
        continue;
      } else if (a.homeward) {
        this.hide(a);
        continue;
      } else if ((a.wait -= dt) <= 0) this.decide(a);
      this.place(a, t);
    }
  }

  /**
   * La persona que hay en un punto de la vista (en píxeles de la vista): la de delante entre las
   * que se ven justo ahí; si el dedo cae en el hueco de todas, la de delante de su recuadro.
   */
  hit(v: View, x: number, y: number): string | null {
    let best: { id: string; z: number; solid: boolean } | null = null;
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      const r = this.rectOf(a, v);
      if (!r || x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      const z = this.depth(a);
      const solid = this.solidAt(a, v, x, y);
      if (!best || (solid && !best.solid) || (solid === best.solid && z < best.z))
        best = { id: a.hero.id, z, solid };
    }
    return best?.id ?? null;
  }

  /** Si en ese punto se ve algo de su dibujo (con un píxel de margen, que el dedo no es fino). */
  private solidAt(a: Actor, v: View, x: number, y: number): boolean {
    const f = this.frame(a, this.now);
    const k = scaleAt(f.z);
    const p0 = project(v, f.left, f.bottom - TALL / k, f.z);
    const p1 = project(v, f.left + CELL / k, f.bottom, f.z);
    const px = Math.floor(((x - p0.x) / (p1.x - p0.x)) * CELL);
    const py = Math.floor(((y - p0.y) / (p1.y - p0.y)) * TALL);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qx >= CELL || qy < 0 || qy >= TALL) continue;
        if (alpha(a.img.get(f.frame * CELL + qx, qy))) return true;
      }
    return false;
  }

  /** Recuadro en pantalla (en píxeles de la vista) de lo que se ve de alguien. */
  screenRect(id: string, v: View): Rect | null {
    const a = this.actors.get(id);
    return a && !a.gone ? this.rectOf(a, v) : null;
  }

  /** Coge a alguien con el dedo: queda colgando bajo ese punto de la vista (en píxeles de la vista). */
  hold(id: string, v: View, sx: number, sy: number): void {
    const a = this.actors.get(id);
    if (!a || a.gone) return;
    if (!a.held) {
      this.seatFree(a);
      a.path = [];
      a.pose = 'stand';
      a.goal = null;
    }
    // A una profundidad fija la perspectiva es lineal: se deshace con dos puntos.
    const z = this.depth(a);
    const p0 = project(v, 0, 0, z);
    const p1 = project(v, 100, 100, z);
    const k = scaleAt(z);
    a.held = {
      x: ((sx - p0.x) * 100) / (p1.x - p0.x),
      y: ((sy - p0.y) * 100) / (p1.y - p0.y) + 16 / k,
    };
  }

  /** Lo suelta: en ese sitio (y de ahí va a lo suyo) o, si no vale, vuelve a donde estaba. */
  drop(id: string, p: Place | null): void {
    const a = this.actors.get(id);
    if (!a?.held) return;
    a.held = null;
    // Donde cae se queda un momento (le llega su tarea nueva) y luego va a lo suyo.
    if (p) this.put(a, p);
    a.wait = p ? 0.8 : 0;
  }

  /** Quien está a la vista ahora mismo (ni fuera, ni en el pueblo, ni cogido con el dedo). */
  visible(): SceneHero[] {
    return [...this.actors.values()]
      .filter((a) => !a.gone && !a.held && !a.homeward)
      .map((a) => a.hero);
  }

  // ---------- Asalto: la escena lleva a cada uno ----------

  /** Empieza o acaba un asalto. Al acabar, los bandidos se van y cada uno vuelve a lo suyo. */
  setScripted(on: boolean): void {
    if (on === this.scripted) return;
    this.scripted = on;
    if (on) return;
    for (const a of [...this.actors.values()]) {
      if (a.hero.bandit) {
        this.remove(a.hero.id);
        continue;
      }
      a.run = undefined;
      a.swing = undefined;
      a.path = [];
      if (a.gone) continue;
      const g = this.homes.get(a.hero.id);
      if (this.time === 'night' && g) {
        this.put(a, g.place);
        this.arrive(a, g);
      } else {
        a.pose = 'stand';
        a.goal = null;
        a.wait = this.rnd() * 2;
      }
    }
  }

  /** Un bandido que aparece en un sitio. */
  addBandit(id: string, look: SceneHero['look'], marks: SceneHero['marks'], p: Place): void {
    if (this.actors.has(id)) return;
    this.add({ id, name: 'Bandido', status: 'ok', look, marks, bandit: true });
    const a = this.actors.get(id)!;
    this.put(a, p);
    a.pose = 'stand';
  }

  /** Echa a correr hasta un sitio para llegar en `dur` segundos (si le da tiempo). */
  runTo(id: string, p: Place, dur: number): void {
    const a = this.actors.get(id);
    if (!a || a.gone || a.pose === 'down' || !this.L) return;
    this.standUp(a);
    const path = route(this.L, { x: a.x, floor: a.floor }, p, this.segs) ?? [p];
    let len = 0;
    let x = a.x;
    let f = a.floor;
    for (const q of path) {
      len +=
        q.floor !== f ? (Math.abs(floorY(q.floor) - floorY(f)) * SPEED) / CLIMB : Math.abs(q.x - x);
      x = q.x;
      f = q.floor;
    }
    a.run = Math.max(0.6, Math.min(4, len / Math.max(0.3, dur) / SPEED));
    a.path = path;
    a.goal = { place: p, pose: 'stand' };
    a.pose = 'walk';
  }

  /** Aparece directamente en un sitio (al saltarse el asalto). */
  warp(id: string, p: Place): void {
    const a = this.actors.get(id);
    if (!a || a.gone) return;
    this.standUp(a);
    a.path = [];
    this.put(a, p);
    if (a.pose === 'walk') a.pose = 'stand';
  }

  /** Se levanta de la cama (o de la silla) de un salto. */
  wake(id: string): void {
    const a = this.actors.get(id);
    if (a) this.standUp(a);
  }

  /** Cae al suelo. */
  knock(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    a.path = [];
    a.goal = null;
    a.swing = 0;
    a.pose = 'down';
  }

  /** Da un golpe hacia un lado. */
  strike(id: string, dir: 1 | -1): void {
    const a = this.actors.get(id);
    if (!a || a.pose === 'down') return;
    a.dir = dir;
    a.swing = 1;
  }

  /** Se acerca un poco (para ponerse cara a cara con quien pelea). */
  nudge(id: string, dx: number): void {
    const a = this.actors.get(id);
    if (!a || a.path.length || a.pose === 'down') return;
    a.x += dx;
    a.dir = dx > 0 ? 1 : -1;
    a.dist += Math.abs(dx);
  }

  /** Dónde está alguien (los pies) y si va andando. */
  where(id: string): (Place & { y: number; moving: boolean; down: boolean }) | null {
    const a = this.actors.get(id);
    if (!a || a.gone) return null;
    return { x: a.x, floor: a.floor, y: a.y, moving: a.path.length > 0, down: a.pose === 'down' };
  }

  /** Desaparece de la escena (un bandido que se pierde por el camino). */
  vanish(id: string): void {
    this.remove(id);
  }

  private standUp(a: Actor): void {
    if (a.pose !== 'bed' && a.pose !== 'sit') return;
    this.seatFree(a);
    a.goal = null;
    a.pose = 'stand';
  }

  nameOf(id: string): string {
    return this.actors.get(id)?.hero.name ?? '';
  }

  dispose(): void {
    this.group.clear();
    this.look.dispose();
    this.geo.dispose();
    this.actors.clear();
  }

  // ---------- Por dentro ----------

  private add(h: SceneHero): void {
    const spr = heroSprites(h.look, h.marks);
    const k = scaleAt(LANES[0]);
    const img = atlas(spr);
    const mat = this.look.surface(img, [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)], {
      ambient: [0.44, 0.38, 0.46],
      sun: 0,
      wrap: 0.6,
      dither: 0.03,
      frames: FRAMES,
    });
    // Delante de lo que esté a su misma profundidad (el taburete, la cama).
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -4;
    const m = mesh(this.geo, mat);
    m.scale.set(CELL / k, TALL / k, 1);
    this.group.add(m);
    const start = this.homes.get(h.id)?.place ?? this.S?.door ?? { x: 12, floor: 0 };
    const a: Actor = {
      hero: h,
      img,
      mat,
      mesh: m,
      x: start.x,
      y: floorY(start.floor),
      floor: start.floor,
      lane: LANES[hash(h.id) % LANES.length]!,
      path: [],
      goal: null,
      pose: 'stand',
      wait: this.rnd() * 2,
      dir: 1,
      dist: 0,
      blinkAt: this.rnd() * 4,
      seat: null,
      leaving: false,
      homeward: false,
      gone: false,
      sat: 0,
    };
    this.actors.set(h.id, a);
    if (h.visitor || h.bandit) return;
    if (this.village(a) && this.time !== 'day') {
      // De noche, los del pueblo están en su casa.
      this.hide(a);
      return;
    }
    if (this.away.delete(h.id) && this.S) {
      // Vuelve de misión: entra por la puerta desde el patio.
      this.put(a, outside());
      a.wait = 0;
      return;
    }
    // Al aparecer de día ya está en algún sitio de la casa; de noche, en su cama.
    if (this.S && h.status === 'ok' && !h.guard && this.time === 'day') {
      const g = this.workOf(a) ?? wander(this.S, this.taken(), this.rnd);
      if (g && route(this.L!, start, g.place, this.segs)) {
        this.put(a, g.place);
        this.arrive(a, g);
      }
    } else {
      const g = this.homes.get(h.id);
      if (g) this.arrive(a, g);
    }
  }

  private remove(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    this.group.remove(a.mesh);
    a.mat.dispose();
    (a.mat.uniforms.map!.value as { dispose(): void }).dispose();
    this.actors.delete(id);
  }

  private rehome(): void {
    if (!this.S) return;
    const people = [...this.actors.values()]
      .filter((a) => !a.hero.visitor)
      .map((a) => ({
        id: a.hero.id,
        status: a.hero.status,
        guard: a.hero.guard,
        staff: a.hero.staff,
      }));
    this.homes = homes(people, this.S);
  }

  private taken(): Set<SeatSpot> {
    const out = new Set<SeatSpot>();
    for (const a of this.actors.values()) if (a.seat) out.add(a.seat);
    return out;
  }

  private seatFree(a: Actor): void {
    a.seat = null;
  }

  /** Del pueblo y sin cama en el servicio: duerme en su casa. */
  private village(a: Actor): boolean {
    return a.hero.staff === 'pueblo' || (a.hero.staff === 'casa' && !this.homes.has(a.hero.id));
  }

  /** Ya se ha ido a su casa del pueblo: no se ve hasta mañana. */
  private hide(a: Actor): void {
    a.homeward = false;
    a.gone = true;
    a.path = [];
    a.goal = null;
    a.mesh.visible = false;
    this.seatFree(a);
  }

  /** A qué puesto va alguien que trabaja en una sala (si es de día y está en casa). */
  private workOf(a: Actor): Goal | null {
    const h = a.hero;
    if (!this.S || !h.work || this.time !== 'day' || h.status !== 'ok' || h.guard) return null;
    const mates = [...this.actors.values()].filter((x) => x.hero.work === h.work);
    return workGoal(this.S, h.work, mates.indexOf(a), mates.length, this.rnd);
  }

  /** Qué hace ahora alguien que está parado. */
  private decide(a: Actor): void {
    if (!this.S) return;
    const h = a.hero;
    if (h.visitor) {
      a.wait = 999;
      return;
    }
    if (this.time !== 'day' && this.village(a)) {
      // Se acabó el día: vuelve al pueblo por el patio.
      a.homeward = true;
      this.go(a, { place: outside(), pose: 'stand' });
      return;
    }
    const home = this.homes.get(h.id);
    const job = this.workOf(a);
    if (job) {
      // En el salón van de mesa en mesa; en las demás salas, cada uno a lo suyo.
      a.wait = 4 + this.rnd() * 8;
      if (Math.abs(job.place.x - a.x) < 4 && job.place.floor === a.floor) return;
      this.go(a, job);
      return;
    }
    const free = h.status === 'ok' && !h.guard && this.time === 'day';
    const g = free ? wander(this.S, this.taken(), this.rnd) : home;
    a.wait = free ? 5 + this.rnd() * 9 : 3 + this.rnd() * 3;
    if (!g) return;
    // Si ya está ahí, se queda.
    if (Math.abs(g.place.x - a.x) < 4 && g.place.floor === a.floor && g.pose === a.pose) return;
    this.go(a, g);
  }

  private go(a: Actor, g: Goal): void {
    this.seatFree(a);
    const path = this.L ? route(this.L, { x: a.x, floor: a.floor }, g.place, this.segs) : null;
    if (!path) {
      // No hay camino (se ha quedado en una sala que ya no está): aparece en su sitio.
      this.put(a, g.place);
      this.arrive(a, g);
      return;
    }
    a.goal = g;
    a.path = path;
    a.pose = 'walk';
    if (g.pose === 'sit' && this.S) a.seat = this.S.seats.find((s) => s.x === g.place.x) ?? null;
  }

  private arrive(a: Actor, g: Goal): void {
    a.pose = g.pose;
    a.goal = g;
    if (g.pose === 'sit' && this.S)
      a.seat = this.S.seats.find((s) => s.x === g.place.x && s.floor === g.place.floor) ?? null;
  }

  private put(a: Actor, p: Place): void {
    a.x = p.x;
    a.floor = p.floor;
    a.y = floorY(p.floor);
  }

  private walk(a: Actor, dt: number): void {
    const next = a.path[0]!;
    const run = a.run ?? 1;
    if (next.floor !== a.floor) {
      // Escalera: sube o baja en vertical por el hueco.
      const ty = floorY(next.floor);
      const dy = ty - a.y;
      const step = CLIMB * run * dt;
      a.dist += step;
      if (Math.abs(dy) <= step) {
        a.y = ty;
        a.floor = next.floor;
        a.path.shift();
      } else a.y += Math.sign(dy) * step;
    } else {
      const dx = next.x - a.x;
      const step = SPEED * run * dt;
      a.dist += step;
      if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
      if (Math.abs(dx) <= step) {
        a.x = next.x;
        a.path.shift();
      } else a.x += Math.sign(dx) * step;
    }
    if (!a.path.length) {
      if (a.goal && !a.leaving) this.arrive(a, a.goal);
      else a.pose = 'stand';
    }
  }

  private depth(a: Actor): number {
    if ((a.pose === 'sit' || a.pose === 'bed') && a.goal?.z !== undefined) return a.goal.z;
    return a.lane;
  }

  /** Fotograma, tamaño y esquina de abajo a la izquierda (en el mundo 2D) de alguien. */
  private frame(a: Actor, t: number): { frame: number; left: number; bottom: number; z: number } {
    const z = this.depth(a);
    const k = scaleAt(z);
    const bed = a.pose === 'bed' ? a.goal?.bed : undefined;
    if (bed) {
      // La figura se pone encima del mueble, alineada con su dibujo.
      const ground = floorY(bed.floor);
      if (bed.kind === 'litera') {
        const left = bed.x - 14 / k;
        const top = ground - 40 / k + (bed.top - 12) / k;
        return { frame: F.sleep + bed.level, left, bottom: top + TALL / k, z };
      }
      if (bed.kind === 'jergon') {
        // En el suelo, con la cabeza en un extremo del jergón.
        const left = bed.x - 15 / k;
        const top = ground - 5 / k - 12 / k + 1 / k;
        return { frame: F.mat, left, bottom: top + TALL / k, z };
      }
      const left = bed.x - 18 / k;
      const top = ground - 14 / k - 12 / k + 1 / k;
      return { frame: F.cot, left, bottom: top + TALL / k, z };
    }
    if (a.held) {
      // Colgando del dedo, pataleando un poco.
      const step = Math.floor(t * 8) % 4;
      return {
        frame: F.walk + step,
        left: a.held.x - CELL / 2 / k,
        bottom: a.held.y - FEET_Y / k + TALL / k,
        z,
      };
    }
    if (a.pose === 'sit') {
      // Sentado en el taburete: la cintura sobre el asiento.
      const top = a.y - (10 - 2 + 23) / k;
      return { frame: F.sit, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
    }
    const top = a.y - FEET_Y / k;
    let frame: number;
    if (a.pose === 'down') {
      return {
        frame: a.dir > 0 ? F.down : F.downL,
        left: a.x - CELL / 2 / k,
        bottom: top + TALL / k,
        z,
      };
    }
    if (a.swing) {
      // Golpe: el paso largo de andar, echándose hacia delante.
      const lunge = (a.dir * 3 * Math.sin(a.swing * Math.PI)) / k;
      frame = (a.dir > 0 ? F.walk : F.walkL) + 1;
      return { frame, left: a.x - CELL / 2 / k + lunge, bottom: top + TALL / k, z };
    }
    if (a.pose === 'walk') {
      const step = Math.floor(a.dist / 6) % 4;
      frame = (a.dir > 0 ? F.walk : F.walkL) + step;
    } else {
      const blink = (t + a.blinkAt) % 4 < 0.15;
      frame = blink ? F.blink : F.idle + (Math.floor((t + a.blinkAt) * 1.2) % 2);
    }
    return { frame, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
  }

  private place(a: Actor, t: number): void {
    const f = this.frame(a, t);
    const k = scaleAt(f.z);
    const w = CELL / k;
    const h = TALL / k;
    const origin = at(f.left, f.bottom, f.z);
    a.mesh.position.copy(origin);
    a.mesh.scale.set(w, h, 1);
    const u = a.mat.uniforms;
    u.uOrigin!.value.copy(origin);
    u.uAxisU!.value.set(w, 0, 0);
    u.uAxisV!.value.set(0, h, 0);
    u.uUvOffset!.value.set(f.frame / FRAMES, 0);
    const look = this.tint(a.x, a.floor);
    u.uAmbient!.value.set(...look.ambient);
    u.uSun!.value = look.sun;
  }

  private rectOf(a: Actor, v: View): Rect | null {
    if (!this.L) return null;
    const f = this.frame(a, 0);
    const k = scaleAt(f.z);
    const bed = a.pose === 'bed';
    // Solo lo dibujado: el cuerpo de pie (18 de ancho) o la cabeza en la almohada.
    const x0 = f.left + (bed ? 0 : 3 / k);
    const x1 = f.left + (bed ? 16 / k : 21 / k);
    const y0 = f.bottom - TALL / k;
    const y1 = bed ? y0 + 16 / k : f.bottom;
    const p0 = project(v, x0, y0, f.z);
    const p1 = project(v, x1, y1, f.z);
    return { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
  }
}
