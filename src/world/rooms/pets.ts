/**
 * Los animales del salón: el gato Bigotes (duerme junto a la chimenea y a ratos se levanta, da
 * una vuelta por la sala, se sienta o se lava y vuelve) y, si se ha comprado, Tizón, el perro
 * guardián (duerme en su sitio, a ratos levanta la cabeza y mueve el rabo). Se pueden tocar: el
 * gato ronronea y el perro se sienta y ladra. Son solo de adorno: no cambian nada del juego.
 */
import { Group, PlaneGeometry, Vector3, type Mesh, type ShaderMaterial } from 'three';
import { alpha } from '../../art/pixel';
import { CAT_F, DOG_F, catStrip, dogStrip, type Strip } from '../../art/pets';
import { GROUND } from '../geometry';
import { Look, mesh, type Shared } from './gl';
import { floorY, interior, type RoomsLayout } from './layout';
import { HEARTH_RIGHT } from './salon';
import { FRONT } from './salas/kit';
import { project, scaleAt, type View } from './view3d';

export type PetId = 'gato' | 'perro';

type Tint = readonly [number, number, number];

/**
 * Profundidad del gato: dormido, junto a la chimenea (detrás de la gente); de paseo, por delante
 * de todo (si no, las mesas lo tapan). El perro, en el suelo delante del hogar.
 */
const CAT_Z = 36;
const CAT_WALK_Z = FRONT - 4;
const DOG_Z = FRONT + 2;
/** El sitio del perro: a la izquierda del fuego (delante de las llamas no se le ve la cara). */
const DOG_RIGHT = HEARTH_RIGHT + 24;
/** Velocidad del gato andando (en el mundo, por segundo) y cada cuánto cambia de paso. */
const CAT_SPEED = 16;
const CAT_STEP = 3;

interface Pet {
  id: PetId;
  strip: Strip;
  mat: ShaderMaterial;
  mesh: Mesh;
  x: number;
  floor: number;
  z: number;
  dir: 1 | -1;
  state: 'sleep' | 'sit' | 'walk' | 'rest' | 'bark';
  /** Segundos que le quedan en lo que está haciendo. */
  timer: number;
  /** A dónde va (x y profundidad). */
  target: number;
  tz: number;
  dist: number;
  /** Desde cuándo hace lo que hace (para los fotogramas). */
  since: number;
}

const at = (x: number, y: number, depth: number) => new Vector3(x, GROUND - y, -depth);

export class Pets {
  readonly group = new Group();
  private look: Look;
  private geo = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  private pets = new Map<PetId, Pet>();
  /** Dónde duerme el gato y por dónde puede andar (en el mundo). */
  private home = 0;
  private range: [number, number] = [0, 0];
  private now = 0;
  private seed = 7;

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

  /** El salón (si lo hay y está en uso) y si hay perro: cada uno a su sitio. */
  setLayout(L: RoomsLayout, dog: boolean): void {
    const salon = L.rooms.find(
      ({ room }) =>
        room.type === 'salon' && room.level > 0 && !(room.works && room.works.kind !== 'extend'),
    );
    if (!salon) {
      for (const id of [...this.pets.keys()]) this.remove(id);
      return;
    }
    const r = interior(salon.rect);
    const floor = salon.room.floor;
    // El gato, junto al fuego (a la derecha de la chimenea, lejos del perro).
    this.home = r.x + r.w - HEARTH_RIGHT + 16;
    this.range = [r.x + 30, r.x + r.w - 24];
    // Si la obra ha sido en otra sala, cada uno sigue a lo suyo; si no, vuelve a su sitio.
    const [a, b] = this.range;
    const cat = this.pets.get('gato') ?? this.add('gato', catStrip(), CAT_Z);
    if (cat.floor !== floor || cat.x < a || cat.x > b || cat.state === 'walk') {
      cat.floor = floor;
      cat.x = this.home;
      cat.z = CAT_Z;
      this.set(cat, 'sleep', 8 + this.rnd() * 20);
    }
    if (dog) {
      const d = this.pets.get('perro') ?? this.add('perro', dogStrip(), DOG_Z);
      const x = r.x + r.w - DOG_RIGHT;
      if (d.floor !== floor || d.x !== x) {
        d.floor = floor;
        d.x = x;
        d.dir = 1;
        this.set(d, 'sleep', 10 + this.rnd() * 20);
      }
    } else this.remove('perro');
  }

  update(dt: number, t: number): void {
    this.now = t;
    const cat = this.pets.get('gato');
    if (cat) this.cat(cat, dt);
    const dog = this.pets.get('perro');
    if (dog) this.dog(dog, dt);
    for (const p of this.pets.values()) this.place(p, t);
  }

  /**
   * Tocar a un animal: el gato se despierta y ronronea; el perro se sienta y ladra. Devuelve
   * dónde tiene la cabeza (en el mundo) para echar ahí las partículas.
   */
  touch(id: PetId): { x: number; y: number; z: number } | null {
    const p = this.pets.get(id);
    if (!p) return null;
    if (id === 'gato') {
      this.set(p, 'sit', 4 + this.rnd() * 3);
    } else this.set(p, 'bark', 1.6);
    const k = scaleAt(p.z);
    return { x: p.x + (p.dir * p.strip.w) / 4 / k, y: floorY(p.floor) - p.strip.h / k, z: p.z };
  }

  /** El animal que hay en un punto de la vista (en píxeles de la vista), si hay. */
  hit(v: View, x: number, y: number): PetId | null {
    let best: Pet | null = null;
    for (const p of this.pets.values()) {
      const r = this.rect(p, v);
      // Un par de píxeles de margen: son pequeños y el dedo no es fino.
      if (x < r.x - 2 || x > r.x + r.w + 2 || y < r.y - 3 || y > r.y + r.h + 1) continue;
      if (!this.solid(p, v, x, y)) continue;
      if (!best || p.z < best.z) best = p;
    }
    return best?.id ?? null;
  }

  label(id: PetId): string {
    return id === 'gato' ? 'Bigotes, el gato' : 'Tizón, el perro';
  }

  dispose(): void {
    this.group.clear();
    this.look.dispose();
    this.geo.dispose();
    this.pets.clear();
  }

  // ---------- Por dentro ----------

  private add(id: PetId, strip: Strip, z: number): Pet {
    const mat = this.look.surface(
      strip.img,
      [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)],
      {
        ambient: [0.44, 0.38, 0.46],
        sun: 0,
        wrap: 0.6,
        dither: 0.03,
        halo: 0.3,
        frames: strip.n * 2,
      },
    );
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -4;
    const m = mesh(this.geo, mat);
    this.group.add(m);
    const p: Pet = {
      id,
      strip,
      mat,
      mesh: m,
      x: 0,
      floor: 0,
      z,
      dir: 1,
      state: 'sleep',
      timer: 0,
      target: 0,
      tz: z,
      dist: 0,
      since: 0,
    };
    this.pets.set(id, p);
    return p;
  }

  private remove(id: PetId): void {
    const p = this.pets.get(id);
    if (!p) return;
    this.group.remove(p.mesh);
    p.mat.dispose();
    this.pets.delete(id);
  }

  private set(p: Pet, state: Pet['state'], timer: number): void {
    p.state = state;
    p.timer = timer;
    p.since = this.now;
  }

  /** Bigotes: duerme, se sienta un rato (a veces se lava), da una vuelta y vuelve al fuego. */
  private cat(c: Pet, dt: number): void {
    c.timer -= dt;
    if (c.state === 'walk') {
      // En línea recta hacia su sitio (de lado y hacia delante o hacia el fuego a la vez).
      const dx = c.target - c.x;
      const dz = c.tz - c.z;
      const left = Math.hypot(dx, dz);
      const step = CAT_SPEED * dt;
      if (left <= step) {
        c.x = c.target;
        c.z = c.tz;
        if (Math.abs(c.x - this.home) < 1) this.set(c, 'sleep', 25 + this.rnd() * 30);
        else this.set(c, 'sit', 4 + this.rnd() * 5);
      } else {
        c.x += (dx / left) * step;
        c.z += (dz / left) * step;
        c.dist += step;
        if (Math.abs(dx) > 0.5) c.dir = dx > 0 ? 1 : -1;
      }
      return;
    }
    if (c.timer > 0) return;
    if (c.state === 'sleep') {
      this.set(c, 'sit', 3);
      return;
    }
    // De vuelta al fuego o a otro sitio del salón.
    const [a, b] = this.range;
    const home = this.rnd() < 0.45;
    c.target = home ? this.home : a + this.rnd() * (b - a);
    c.tz = home ? CAT_Z : CAT_WALK_Z;
    this.set(c, 'walk', 0);
  }

  /** Tizón: duerme; a ratos levanta la cabeza y mueve el rabo. Tras ladrar, se queda alerta. */
  private dog(d: Pet, dt: number): void {
    d.timer -= dt;
    if (d.timer > 0) return;
    if (d.state === 'bark') this.set(d, 'rest', 5 + this.rnd() * 3);
    else if (d.state === 'rest') this.set(d, 'sleep', 20 + this.rnd() * 25);
    else this.set(d, 'rest', 5 + this.rnd() * 5);
  }

  /** El fotograma que toca (sin voltear: de 0 a `n`). */
  private frame(p: Pet, t: number): number {
    const age = t - p.since;
    if (p.id === 'gato') {
      switch (p.state) {
        case 'walk':
          return CAT_F.walk + (Math.floor(p.dist / CAT_STEP) % 2);
        case 'sit':
          // Sentado, a ratos se lava la cara.
          return age > 1.2 && age % 3 < 1.2 && Math.floor(age * 4) % 2 ? CAT_F.groom : CAT_F.sit;
        default:
          return CAT_F.sleep + (Math.floor(t / 1.4) % 2);
      }
    }
    switch (p.state) {
      case 'bark':
        // Dos ladridos: la boca abierta en cada uno.
        return DOG_F.bark + (age % 0.8 < 0.3 ? 1 : 0);
      case 'rest':
        // Mueve el rabo al levantar la cabeza, y luego de vez en cuando.
        return DOG_F.rest + (age < 2 || age % 4 < 1 ? Math.floor(t * 6) % 2 : 0);
      default:
        return DOG_F.sleep + (Math.floor(t / 1.6) % 2);
    }
  }

  /** Dónde se ve: abajo a la izquierda en el mundo y su tamaño. */
  private box(p: Pet): { left: number; bottom: number; w: number; h: number } {
    const k = scaleAt(p.z);
    const w = p.strip.w / k;
    return { left: p.x - w / 2, bottom: floorY(p.floor), w, h: p.strip.h / k };
  }

  /** El fotograma de la tira (los de la izquierda van detrás de los de la derecha). */
  private cell(p: Pet, t: number): number {
    // Dormido, el gato no se voltea (se hace un ovillo siempre igual).
    const left = p.dir < 0 && !(p.id === 'gato' && p.state === 'sleep');
    return this.frame(p, t) + (left ? p.strip.n : 0);
  }

  private place(p: Pet, t: number): void {
    const b = this.box(p);
    const origin = at(b.left, b.bottom, p.z);
    p.mesh.position.copy(origin);
    p.mesh.scale.set(b.w, b.h, 1);
    const u = p.mat.uniforms;
    u.uOrigin!.value.copy(origin);
    u.uAxisU!.value.set(b.w, 0, 0);
    u.uAxisV!.value.set(0, b.h, 0);
    u.uUvOffset!.value.set(this.cell(p, t) / (p.strip.n * 2), 0);
    const look = this.tint(p.x, p.floor);
    u.uAmbient!.value.set(...look.ambient);
    u.uSun!.value = look.sun;
  }

  private rect(p: Pet, v: View): { x: number; y: number; w: number; h: number } {
    const b = this.box(p);
    const p0 = project(v, b.left, b.bottom - b.h, p.z);
    const p1 = project(v, b.left + b.w, b.bottom, p.z);
    return { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
  }

  /** Si cerca de ese punto se ve algo de su dibujo (dos píxeles de margen). */
  private solid(p: Pet, v: View, x: number, y: number): boolean {
    const r = this.rect(p, v);
    const { w, h } = p.strip;
    const px = Math.floor(((x - r.x) / r.w) * w);
    const py = Math.floor(((y - r.y) / r.h) * h);
    const cell = this.cell(p, this.now);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qx >= w || qy < 0 || qy >= h) continue;
        if (alpha(p.strip.img.get(cell * w + qx, qy))) return true;
      }
    return false;
  }
}
