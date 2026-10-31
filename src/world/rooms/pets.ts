/**
 * Los animales del salón: el gato Bigotes (duerme junto a la chimenea y a ratos se levanta, da
 * una vuelta por la sala, se sienta o se lava y vuelve) y, si se ha comprado, Tizón, el perro
 * guardián (duerme en su sitio, a ratos levanta la cabeza y mueve el rabo). Se pueden tocar: el
 * gato ronronea y el perro se sienta y ladra. Fuera, si se ha comprado, Carbón, el cuervo, posado
 * en el rótulo: mira a un lado y a otro, grazna y a ratos se va volando (a llevar noticias a otros
 * pueblos) y vuelve. En las salas rotas, bichos: una rata que cruza corriendo (abajo y en la
 * bodega) y murciélagos colgados del techo (arriba). Son solo de adorno: no cambian nada del juego.
 */
import { Group, PlaneGeometry, Vector3, type Mesh, type ShaderMaterial } from 'three';
import { alpha } from '../../art/pixel';
import {
  BAT_F,
  CAT_F,
  DOG_F,
  RAT_F,
  RAVEN_F,
  batStrip,
  catStrip,
  dogStrip,
  ratStrip,
  ravenStrip,
  type Strip,
} from '../../art/pets';
import type { SoundName } from '../scene';
import { GROUND } from '../geometry';
import { Look, mesh, type Shared } from './gl';
import { floorY, interior, type RoomsLayout } from './layout';
import { HEARTH_RIGHT } from './salon';
import { FRONT, MID } from './salas/kit';
import type { Room } from '../../core/model';
import { project, scaleAt, type View } from './view3d';

/**
 * Quién es: el gato, el perro, el cuervo o un bicho de una sala rota (`rata:<sala>`,
 * `murcielago:<sala>:<n>`).
 */
export type PetId = string;
export type PetKind = 'gato' | 'perro' | 'cuervo' | 'rata' | 'murcielago';
export const kindOf = (id: PetId) => id.split(':')[0] as PetKind;

/** Donde se posa el cuervo (sus patas, en el mundo). */
export interface Perch {
  x: number;
  y: number;
  z: number;
}

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
/** Hasta dónde se va el cuervo al irse volando (arriba a la izquierda, hacia el camino). */
const RAVEN_AWAY = { dx: -260, dy: -140 };
/** Las ratas corren por delante de todo; los murciélagos cuelgan de las vigas, a media sala. */
const RAT_Z = FRONT - 3;
const BAT_Z = MID;
const RAT_SPEED = 34;
/** Como mucho, tantas salas con ratas y tantas con murciélagos (para no llenar la casa). */
const MAX_RATS = 3;
const MAX_BATS = 2;
/** La luz de los bichos: más clara que la de su sala, para que se vean en lo oscuro. */
const CRITTER_LIGHT = { ambient: [0.62, 0.56, 0.6] as Tint, sun: 0 };

/** Por dónde anda un bicho: de pared a pared de su sala, su suelo y su techo. */
interface Area {
  x0: number;
  x1: number;
  floor: number;
  ceil: number;
}

interface Pet {
  id: PetId;
  strip: Strip;
  mat: ShaderMaterial;
  mesh: Mesh;
  x: number;
  floor: number;
  /** Altura de las patas, si no está en el suelo de su planta (el cuervo). */
  y?: number;
  z: number;
  dir: 1 | -1;
  state:
    | 'sleep'
    | 'sit'
    | 'walk'
    | 'rest'
    | 'bark'
    | 'perch'
    | 'look'
    | 'caw'
    | 'fly'
    | 'away'
    | 'run'
    | 'sniff'
    | 'hang';
  /** Los bichos: por dónde andan y, los murciélagos, dónde se cuelgan. */
  area?: Area;
  hx?: number;
  /** Volando: de dónde a dónde, cuánto lleva y si se va (o vuelve). */
  fly?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    t: number;
    dur: number;
    out: boolean;
  } | null;
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
  private perch: Perch | null = null;
  /** Para que se oiga lo que hacen por su cuenta (el graznido). */
  sound?: (name: SoundName, volume: number) => void;

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
      this.remove('gato');
      this.remove('perro');
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

  /** Carbón, posado en el rótulo (o fuera, si no hay cuervo o no hay dónde posarse). */
  setRaven(perch: Perch | null): void {
    this.perch = perch;
    if (!perch) {
      this.remove('cuervo');
      return;
    }
    const known = this.pets.get('cuervo');
    const r = known ?? this.add('cuervo', ravenStrip(), perch.z);
    r.z = perch.z;
    if (r.state === 'fly' && r.fly && !r.fly.out) {
      r.fly.x1 = perch.x;
      r.fly.y1 = perch.y;
    } else if (r.state !== 'fly' && r.state !== 'away') {
      r.x = perch.x;
      r.y = perch.y;
      r.dir = -1;
      if (!known) this.set(r, 'perch', 4 + this.rnd() * 6);
    }
  }

  /**
   * Los bichos de las salas rotas: una rata en las de abajo (y en la bodega) y un par de
   * murciélagos en las de arriba. Los de una sala reparada se van.
   */
  setCritters(L: RoomsLayout): void {
    const broken = (room: Room) => room.level === 0 && !room.works && room.type !== 'torre';
    const want = new Map<PetId, { area: Area; bat: boolean; hx: number; floor: number }>();
    let rats = 0;
    let bats = 0;
    for (const { room, rect } of L.rooms) {
      const r = interior(rect);
      const area: Area = {
        x0: r.x + 8,
        x1: r.x + r.w - 8,
        floor: floorY(room.floor),
        ceil: r.y,
      };
      const cellar = room.type === 'bodega' && room.level > 0;
      if ((broken(room) && room.floor <= 0) || cellar) {
        if (rats++ < MAX_RATS)
          want.set(`rata:${room.id}`, { area, bat: false, hx: 0, floor: room.floor });
      } else if (broken(room) && bats++ < MAX_BATS)
        for (let i = 0; i < 2; i++)
          want.set(`murcielago:${room.id}:${i}`, {
            area,
            bat: true,
            hx: r.x + r.w * (0.3 + i * 0.12),
            floor: room.floor,
          });
    }
    for (const id of [...this.pets.keys()])
      if ((kindOf(id) === 'rata' || kindOf(id) === 'murcielago') && !want.has(id)) this.remove(id);
    for (const [id, w] of want) {
      const known = this.pets.get(id);
      const p = known ?? this.add(id, w.bat ? batStrip() : ratStrip(), w.bat ? BAT_Z : RAT_Z);
      p.area = w.area;
      p.hx = w.hx;
      p.floor = w.floor;
      if (known) continue;
      if (w.bat) this.hang(p);
      else this.set(p, 'away', 3 + this.rnd() * 12);
    }
  }

  update(dt: number, t: number): void {
    this.now = t;
    for (const p of this.pets.values()) {
      const k = kindOf(p.id);
      if (k === 'rata') this.rat(p, dt);
      else if (k === 'murcielago') this.bat(p, dt, t);
    }
    const raven = this.pets.get('cuervo');
    if (raven) this.raven(raven, dt);
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
    const kind = kindOf(id);
    if (kind === 'gato') this.set(p, 'sit', 4 + this.rnd() * 3);
    else if (kind === 'perro') this.set(p, 'bark', 1.6);
    else if (kind === 'rata') {
      // Se va corriendo, más deprisa, por el lado más cercano.
      const a = p.area!;
      p.target = p.x - a.x0 < a.x1 - p.x ? a.x0 : a.x1;
      p.dir = p.target > p.x ? 1 : -1;
      this.set(p, 'run', -1);
    } else if (kind === 'murcielago') {
      // Salen volando todos los de la sala.
      const room = id.split(':')[1];
      for (const q of this.pets.values())
        if (kindOf(q.id) === 'murcielago' && q.id.split(':')[1] === room)
          this.set(q, 'fly', 3.5 + this.rnd());
    } else if (p.state !== 'fly') this.set(p, 'caw', 1);
    const b = this.box(p);
    return { x: p.x + (p.dir * b.w) / 4, y: b.bottom - b.h, z: p.z };
  }

  /** El animal que hay en un punto de la vista (en píxeles de la vista), si hay. */
  hit(v: View, x: number, y: number): PetId | null {
    let best: Pet | null = null;
    for (const p of this.pets.values()) {
      if (p.state === 'away') continue;
      const r = this.rect(p, v);
      // Un par de píxeles de margen: son pequeños y el dedo no es fino.
      if (x < r.x - 2 || x > r.x + r.w + 2 || y < r.y - 3 || y > r.y + r.h + 1) continue;
      if (!this.solid(p, v, x, y)) continue;
      if (!best || p.z < best.z) best = p;
    }
    return best?.id ?? null;
  }

  label(id: PetId): string {
    return {
      gato: 'Bigotes, el gato',
      perro: 'Tizón, el perro',
      cuervo: 'Carbón, el cuervo',
      rata: 'Una rata',
      murcielago: 'Murciélagos',
    }[kindOf(id)];
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

  /** Un murciélago, colgado de su viga. */
  private hang(p: Pet): void {
    const a = p.area!;
    const k = scaleAt(p.z);
    p.x = p.hx!;
    p.y = a.ceil + p.strip.h / k;
    this.set(p, 'hang', 40 + this.rnd() * 60);
  }

  /**
   * La rata: escondida; a ratos cruza la sala corriendo, se para a husmear y se mete en otro
   * agujero. Corriendo, `timer` es lo que falta para pararse (negativo: ya no se para; tocada,
   * menos de -0,5, y corre más).
   */
  private rat(p: Pet, dt: number): void {
    const a = p.area!;
    p.timer -= dt;
    if (p.state === 'away') {
      if (p.timer > 0) return;
      const fromLeft = this.rnd() < 0.5;
      p.x = fromLeft ? a.x0 : a.x1;
      p.target = fromLeft ? a.x1 : a.x0;
      p.dir = fromLeft ? 1 : -1;
      this.set(p, 'run', 0.6 + this.rnd() * 1.5);
      return;
    }
    if (p.state === 'sniff') {
      if (p.timer <= 0) this.set(p, 'run', -0.1);
      return;
    }
    if (p.state !== 'run') return;
    if (p.timer <= 0 && p.timer > -0.1 - dt) {
      this.set(p, 'sniff', 0.8 + this.rnd() * 0.8);
      return;
    }
    const step = RAT_SPEED * (p.timer < -0.5 ? 2.4 : 1) * dt;
    const left = p.target - p.x;
    if (Math.abs(left) <= step) this.set(p, 'away', 12 + this.rnd() * 25);
    else {
      p.x += Math.sign(left) * step;
      p.dist += step;
    }
  }

  /** Los murciélagos: colgados; si se les molesta (o a ratos), revolotean por la sala y vuelven. */
  private bat(p: Pet, dt: number, t: number): void {
    const a = p.area!;
    p.timer -= dt;
    if (p.state === 'hang') {
      if (p.timer <= 0) this.set(p, 'fly', 2 + this.rnd() * 2);
      return;
    }
    if (p.state !== 'fly') return;
    if (p.timer <= 0) {
      this.hang(p);
      return;
    }
    const s = (p.hx! * 13) % 7;
    const cx = (a.x0 + a.x1) / 2;
    const span = (a.x1 - a.x0) / 2 - 10;
    const nx = cx + Math.sin(t * 2.2 + s) * span * 0.8 + Math.sin(t * 5.1 + s) * 6;
    p.dir = nx > p.x ? 1 : -1;
    p.x = nx;
    p.y = a.ceil + 22 + Math.cos(t * 1.7 + s) * 12;
  }

  /** Carbón: posado mira a un lado y a otro y grazna; a ratos se va volando y luego vuelve. */
  private raven(r: Pet, dt: number): void {
    const f = r.fly;
    const p = this.perch;
    if (r.state === 'fly' && f) {
      f.t += dt;
      const u = Math.min(1, f.t / f.dur);
      // Al irse, despacio al arrancar; al volver, frena al posarse. Y un poco de arco.
      const e = f.out ? u * u : 1 - (1 - u) * (1 - u);
      r.x = f.x0 + (f.x1 - f.x0) * e;
      r.y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * 12;
      r.dir = f.x1 > f.x0 ? 1 : -1;
      if (u < 1) return;
      r.fly = null;
      if (f.out) this.set(r, 'away', 25 + this.rnd() * 30);
      else {
        r.dir = -1;
        this.set(r, 'perch', 5 + this.rnd() * 6);
      }
      return;
    }
    r.timer -= dt;
    if (r.timer > 0 || !p) return;
    if (r.state === 'away') {
      // De vuelta: entra volando desde el camino.
      r.fly = {
        x0: p.x + RAVEN_AWAY.dx,
        y0: p.y + RAVEN_AWAY.dy,
        x1: p.x,
        y1: p.y,
        t: 0,
        dur: 3.5,
        out: false,
      };
      r.x = r.fly.x0;
      r.y = r.fly.y0;
      this.set(r, 'fly', 0);
      return;
    }
    if (r.state !== 'perch') {
      this.set(r, 'perch', 4 + this.rnd() * 8);
      return;
    }
    const roll = this.rnd();
    if (roll < 0.15) {
      r.fly = {
        x0: r.x,
        y0: r.y ?? p.y,
        x1: p.x + RAVEN_AWAY.dx,
        y1: p.y + RAVEN_AWAY.dy,
        t: 0,
        dur: 3.5,
        out: true,
      };
      this.set(r, 'fly', 0);
    } else if (roll < 0.4) {
      this.set(r, 'caw', 1);
      this.sound?.('caw', 0.35);
    } else this.set(r, 'look', 1.2 + this.rnd());
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
    const kind = kindOf(p.id);
    if (kind === 'rata')
      return p.state === 'sniff' ? RAT_F.run : RAT_F.run + (Math.floor(p.dist / 3) % 2);
    if (kind === 'murcielago')
      return p.state === 'fly' ? BAT_F.fly + (Math.floor(t * 12 + (p.hx ?? 0)) % 2) : BAT_F.hang;
    if (kind === 'gato') {
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
    if (kind === 'cuervo') {
      switch (p.state) {
        case 'fly':
          return RAVEN_F.fly + (Math.floor(t * 8) % 2);
        case 'look':
          return RAVEN_F.look;
        case 'caw':
          // Dos graznidos: el pico abierto en cada uno.
          return age % 0.5 < 0.25 ? RAVEN_F.caw : RAVEN_F.perch;
        default:
          return RAVEN_F.perch;
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
    return { left: p.x - w / 2, bottom: p.y ?? floorY(p.floor), w, h: p.strip.h / k };
  }

  /** El fotograma de la tira (los de la izquierda van detrás de los de la derecha). */
  private cell(p: Pet, t: number): number {
    // Dormido, el gato no se voltea (se hace un ovillo siempre igual).
    const left = p.dir < 0 && !(p.id === 'gato' && p.state === 'sleep');
    return this.frame(p, t) + (left ? p.strip.n : 0);
  }

  private place(p: Pet, t: number): void {
    p.mesh.visible = p.state !== 'away';
    const b = this.box(p);
    const origin = at(b.left, b.bottom, p.z);
    p.mesh.position.copy(origin);
    p.mesh.scale.set(b.w, b.h, 1);
    const u = p.mat.uniforms;
    u.uOrigin!.value.copy(origin);
    u.uAxisU!.value.set(b.w, 0, 0);
    u.uAxisV!.value.set(0, b.h, 0);
    u.uUvOffset!.value.set(this.cell(p, t) / (p.strip.n * 2), 0);
    // Los bichos, algo más claros que su sala rota (con su luz fría, ni se veían).
    const critter = kindOf(p.id) === 'rata' || kindOf(p.id) === 'murcielago';
    const look = critter ? CRITTER_LIGHT : this.tint(p.x, p.floor);
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
