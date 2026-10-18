/**
 * La gente que se ve en la escena 3D: una figura plana por persona que anda por las salas y las
 * escaleras, se sienta en el salón, duerme en su cama y sale por el recibidor. Cada figura usa
 * un atlas con todos sus fotogramas (de pie, parpadeo, andando, sentada y en la cama) y la escena
 * solo cambia cuál se ve y dónde está.
 */
import { Group, PlaneGeometry, Vector3, type Mesh, type ShaderMaterial } from 'three';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { FEET_Y, heroSprites, type HeroSprites } from '../../art/heroes/hero';
import { bunkQuilt } from '../props';
import type { SceneHero } from '../scene';
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

/** Como mucho, tantas figuras animadas a la vez. */
export const MAX_ACTORS = 30;
const SPEED = 36;
const CLIMB = 30;

/** Fotogramas del atlas (cada uno de CELL × SPRITE de alto). */
const CELL = 24;
const TALL = 28;
const F = { idle: 0, blink: 2, walk: 3, walkL: 7, sit: 11, sleep: 12, cot: 16, mat: 17 } as const;
const FRAMES = 18;

type Tint = readonly [number, number, number];

interface Actor {
  hero: SceneHero;
  mat: ShaderMaterial;
  mesh: Mesh;
  x: number;
  /** Altura de los pies en el mundo (y hacia abajo) y planta en la que está o a la que va. */
  y: number;
  floor: number;
  lane: number;
  path: Place[];
  goal: Goal | null;
  pose: 'stand' | 'walk' | 'sit' | 'bed';
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
      const h = heroes.find((x) => x.id === id);
      if (!h || (!shown.has(id) && !(h.status === 'mision' && a.hero.status === 'ok'))) {
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
    for (const a of this.actors.values()) {
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
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      if (a.path.length) this.walk(a, dt);
      else if (a.leaving) {
        this.away.add(a.hero.id);
        this.remove(a.hero.id);
        continue;
      } else if (a.homeward) {
        this.hide(a);
        continue;
      } else if ((a.wait -= dt) <= 0) this.decide(a);
      this.place(a, t);
    }
  }

  /** La persona que hay en un punto de la vista (en píxeles de la vista), la de delante. */
  hit(v: View, x: number, y: number): string | null {
    let best: { id: string; z: number } | null = null;
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      const r = this.rectOf(a, v);
      if (!r || x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      const z = this.depth(a);
      if (!best || z < best.z) best = { id: a.hero.id, z };
    }
    return best?.id ?? null;
  }

  /** Recuadro en pantalla (en píxeles de la vista) de lo que se ve de alguien. */
  screenRect(id: string, v: View): Rect | null {
    const a = this.actors.get(id);
    return a && !a.gone ? this.rectOf(a, v) : null;
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
    const mat = this.look.surface(
      atlas(spr),
      [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)],
      { ambient: [0.44, 0.38, 0.46], sun: 0, wrap: 0.6, dither: 0.03, frames: FRAMES },
    );
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
    };
    this.actors.set(h.id, a);
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
    const people = [...this.actors.values()].map((a) => ({
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
    if (next.floor !== a.floor) {
      // Escalera: sube o baja en vertical por el hueco.
      const ty = floorY(next.floor);
      const dy = ty - a.y;
      const step = CLIMB * dt;
      a.dist += step;
      if (Math.abs(dy) <= step) {
        a.y = ty;
        a.floor = next.floor;
        a.path.shift();
      } else a.y += Math.sign(dy) * step;
    } else {
      const dx = next.x - a.x;
      const step = SPEED * dt;
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
    if (a.pose === 'sit') {
      // Sentado en el taburete: la cintura sobre el asiento.
      const top = a.y - (10 - 2 + 23) / k;
      return { frame: F.sit, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
    }
    const top = a.y - FEET_Y / k;
    let frame: number;
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
