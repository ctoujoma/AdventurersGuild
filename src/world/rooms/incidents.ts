/**
 * Los incidentes, dibujados en su sala mientras duran (`game.incidents`): ratas que corren por
 * la despensa, el fuego de la cocina con su humo y su luz, la gotera de la bodega, la pelea del
 * salón en una nube de polvo, el ladrón en la cámara, el recaudador en el recibidor y el noble
 * borracho en la barra. Es solo dibujo: no se toca (se resuelve con el aviso, como siempre). Al
 * acabar, se deshace en polvo.
 */
import { Group, PlaneGeometry, Vector3, type Mesh, type ShaderMaterial } from 'three';
import {
  BLAZE_F,
  BLAZE_H,
  BLAZE_W,
  BRAWL_F,
  NOBLE_F,
  blazeStrip,
  brawlStrip,
  bucket,
  dampStain,
  nobleStrip,
  puddleStrip,
  taxmanStrip,
  thiefStrip,
  toppledStool,
} from '../../art/incidents';
import { ratStrip, type Strip } from '../../art/pets';
import type { PixelBuffer } from '../../art/pixel';
import type { Building } from '../../core/model';
import type { IncidentKind } from '../../data/incidents';
import type { PKind, Particle } from '../particles';
import type { SceneIncident, SoundName } from '../scene';
import { GROUND } from '../geometry';
import { Look, mesh, type Shared } from './gl';
import { floorY, interior, type Rect, type RoomsLayout } from './layout';
import { FIRE, FRONT, MID, SOLID } from './salas/kit';
import { scaleAt } from './view3d';

/** Una luz del incidente (el fuego), en el mundo 2D. */
export interface IncidentLight {
  x: number;
  y: number;
  z: number;
  r: number;
  color: readonly [number, number, number];
  power: number;
  flicker: number;
  rect: Rect;
}

/** Para echar partículas en un punto del mundo (`land`: altura del suelo donde cae una gota). */
export type Emit = (
  kind: PKind,
  x: number,
  y: number,
  z: number,
  o?: Partial<Pick<Particle, 'vx' | 'vy' | 'max'>> & { land?: number },
) => void;

type Tint = readonly [number, number, number];

/** Dónde está el fogón de la cocina (ver `salas/cocina.ts`). */
const HEARTH_X = 25;
/** Dónde está la barra del salón (ver `furniture.ts`). */
const BAR_X = 44;
/** El noble, al final de la barra (a su derecha). */
const NOBLE_DX = 48;
const RAT_SPEED = 30;
/** Ratas a la vista como mucho (si faltan más toques, entra otra al irse una). */
const MAX_RATS = 4;
const THIEF_SPEED = 9;
/** Las ratas, como las de las salas rotas: más claras que la sala, para que se vean. */
const CRITTER: Tint = [0.62, 0.56, 0.6];
/** Lo menos que se alumbra a los demás (en las salas oscuras, si no, no se les ve). */
const LIFT: Tint = [0.58, 0.54, 0.56];

interface Actor {
  mat: ShaderMaterial;
  mesh: Mesh;
  /** Figura con su tira (n fotogramas y sus volteados) o algo que brilla solo (el fuego). */
  strip?: Strip;
  glow?: { w: number; h: number };
  /** Fotogramas en su textura (con los volteados); 1, si es un dibujo fijo. */
  cells: number;
  frame: number;
  x: number;
  /** Abajo del dibujo en el mundo 2D (los pies) y su profundidad. */
  bottom: number;
  z: number;
  dir: 1 | -1;
  /** Alto de más o de menos (las llamas cambian de alto). */
  stretch: number;
  critter?: boolean;
  /** Para los que se mueven: a dónde van, cuánto esperan y lo andado. */
  tx: number;
  wait: number;
  dist: number;
  /** Se va de la sala (espantada o al acabar): a qué velocidad, hasta `tx`, y ahí desaparece. */
  flee?: number;
}

interface Show {
  key: string;
  kind: IncidentKind;
  r: Rect;
  floor: number;
  /** Planta (para la luz de la sala). */
  level: number;
  actors: Actor[];
  timer: number;
  /** Otro reloj (la gotera alterna goteras; el recaudador, golpecitos y pausas). */
  beat: number;
  n: number;
  /** Las ratas: toques que faltan (cada toque espanta una). */
  taps?: number;
  /** Ya ha acabado: los que quedan se van de la sala. */
  gone?: boolean;
}

const at = (x: number, y: number, depth: number) => new Vector3(x, GROUND - y, -depth);

export class IncidentArt {
  readonly group = new Group();
  private look: Look;
  private geo = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  private shows = new Map<string, Show>();
  private seed = 11;
  /** Las tiras, hechas una vez. */
  private strips: Partial<Record<string, Strip>> = {};
  private blaze: PixelBuffer | null = null;
  emit?: Emit;
  /** El chillido de las ratas al espantarlas. */
  sound?: (name: SoundName, volume: number) => void;
  private out = 0;

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

  /**
   * Los incidentes de ahora: los nuevos aparecen; los que han acabado se van de la sala (o se
   * deshacen en polvo); y a cada toque a las ratas, una sale corriendo.
   */
  set(L: RoomsLayout, b: Building, list: readonly SceneIncident[]): void {
    const want = new Map<string, { inc: SceneIncident; r: Rect; floor: number; level: number }>();
    for (const inc of list) {
      const spot = L.rooms.find(({ room }) => room.id === inc.room);
      if (!spot || !b.rooms.some((r) => r.id === inc.room)) continue;
      const r = interior(spot.rect);
      // La clave lleva el sitio: si la sala se mueve, se vuelve a poner.
      const key = `${inc.kind}:${inc.room}:${r.x},${r.y},${r.w}`;
      want.set(key, { inc, r, floor: floorY(spot.room.floor), level: spot.room.floor });
    }
    // Los que siguen (aunque la sala se haya movido): esos no se deshacen en polvo.
    const still = new Set(list.map((i) => `${i.kind}:${i.room}`));
    for (const [key, s] of this.shows) {
      if (s.gone || want.has(key)) continue;
      this.shows.delete(key);
      if (still.has(key.split(':').slice(0, 2).join(':'))) {
        // Solo se ha movido la sala: se vuelve a poner en su sitio nuevo.
        for (const a of s.actors) this.drop(a);
        continue;
      }
      // Se ha resuelto (o ha salido mal): los que andan se van; lo demás, en polvo.
      this.leave(s);
      if (s.actors.length) this.shows.set(`${key}#fuera${this.out++}`, s);
    }
    for (const [key, w] of want) {
      const known = this.shows.get(key);
      if (!known) {
        const s = this.build(key, w.inc.kind, w.r, w.floor, w.level, w.inc.taps);
        this.shows.set(key, s);
        continue;
      }
      // Un toque a las ratas: se espanta una.
      if (known.kind === 'ratas' && w.inc.taps !== undefined && known.taps !== undefined)
        for (let i = w.inc.taps; i < known.taps; i++) this.scare(known);
      known.taps = w.inc.taps;
    }
  }

  /** Las luces de los incidentes (el fuego alumbra su cocina). */
  lights(): IncidentLight[] {
    const out: IncidentLight[] = [];
    for (const s of this.shows.values()) {
      if (s.kind !== 'fuego') continue;
      const a = s.actors[0]!;
      out.push({
        x: a.x,
        y: a.bottom - 14,
        z: a.z,
        r: 120,
        color: FIRE,
        power: 1.5,
        flicker: 0.4,
        rect: s.r,
      });
    }
    return out;
  }

  update(dt: number, t: number): void {
    for (const [key, s] of this.shows) {
      s.timer -= dt;
      s.beat -= dt;
      this.runOff(s, dt);
      if (!s.gone) this.step(s, dt, t);
      else if (!s.actors.length) {
        this.shows.delete(key);
        continue;
      }
      for (const a of s.actors) this.place(a, s);
    }
  }

  clear(): void {
    for (const s of this.shows.values()) for (const a of s.actors) this.drop(a);
    this.shows.clear();
  }

  dispose(): void {
    this.clear();
    this.group.clear();
    this.look.dispose();
    this.geo.dispose();
  }

  // ---------- Por dentro ----------

  private strip(name: string, make: () => Strip): Strip {
    return (this.strips[name] ??= make());
  }

  private figure(s: Strip, x: number, bottom: number, z: number, cells = s.n * 2): Actor {
    const mat = this.look.surface(s.img, [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)], {
      ambient: [0.5, 0.46, 0.5],
      sun: 0,
      wrap: 0.6,
      dither: 0.03,
      halo: 0.3,
      frames: cells,
    });
    return this.actor(mat, { strip: s, cells }, x, bottom, z);
  }

  /** Algo fijo de un solo dibujo (el taburete, el cubo, la mancha del techo). */
  private still(img: PixelBuffer, x: number, bottom: number, z: number): Actor {
    return this.figure({ img, w: img.w, h: img.h, n: 1 }, x, bottom, z, 1);
  }

  private flame(x: number, bottom: number, z: number, size: number): Actor {
    this.blaze ??= blazeStrip();
    const mat = this.look.glow(this.blaze, BLAZE_F);
    const glow = { w: BLAZE_W * size, h: BLAZE_H * size };
    return this.actor(mat, { glow, cells: BLAZE_F }, x, bottom, z);
  }

  private actor(
    mat: ShaderMaterial,
    o: Pick<Actor, 'strip' | 'glow' | 'cells'>,
    x: number,
    bottom: number,
    z: number,
  ): Actor {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -4;
    const m = mesh(this.geo, mat);
    this.group.add(m);
    return {
      mat,
      mesh: m,
      ...o,
      frame: 0,
      x,
      bottom,
      z,
      dir: 1,
      stretch: 1,
      tx: x,
      wait: 0,
      dist: 0,
    };
  }

  private drop(a: Actor): void {
    this.group.remove(a.mesh);
    a.mat.dispose();
  }

  private poof(a: Actor): void {
    const k = scaleAt(a.z);
    const w = (a.strip?.w ?? a.glow!.w) / k;
    const h = (a.strip?.h ?? a.glow!.h) / k;
    const kind: PKind = a.glow ? 'steam' : 'puff';
    for (let i = 0; i < 5; i++)
      this.emit?.(kind, a.x + (this.rnd() - 0.5) * w, a.bottom - this.rnd() * h, a.z);
  }

  /** Una rata más, por un lado de la sala o en cualquier sitio. */
  private rat(s: Show, edge: boolean): Actor {
    const { r } = s;
    const left = this.rnd() < 0.5;
    const x = edge ? (left ? r.x + 4 : r.x + r.w - 4) : r.x + 12 + this.rnd() * (r.w - 24);
    const z = FRONT - 3 + Math.floor(this.rnd() * 4) * 6;
    const a = this.figure(this.strip('rata', ratStrip), x, s.floor, z);
    a.critter = true;
    a.tx = edge ? r.x + 20 + this.rnd() * (r.w - 40) : x;
    a.wait = edge ? 0 : this.rnd() * 1.5;
    return a;
  }

  /** Hacia la pared más cercana de su sala (para irse). */
  private exit(s: Show, a: Actor, speed: number): void {
    a.tx = a.x - s.r.x < s.r.x + s.r.w - a.x ? s.r.x + 2 : s.r.x + s.r.w - 2;
    a.flee = speed;
    a.wait = 0;
  }

  /** Un toque a las ratas: una sale corriendo, con su chillido y una nube de polvo. */
  private scare(s: Show): void {
    const a = s.actors.find((x) => !x.flee);
    if (!a) return;
    this.exit(s, a, RAT_SPEED * 3);
    this.poof(a);
    this.sound?.('squeak', 0.5);
  }

  /** Al acabar: los que andan se van por la pared más cercana; lo demás, en polvo. */
  private leave(s: Show): void {
    s.gone = true;
    const speed = { ratas: RAT_SPEED * 3, ladron: 45, recaudador: 16, noble: 12 }[s.kind as string];
    if (s.kind === 'ratas') this.sound?.('squeak', 0.4);
    for (const a of [...s.actors]) {
      if (speed) {
        this.exit(s, a, speed);
        continue;
      }
      this.poof(a);
      this.drop(a);
      s.actors.splice(s.actors.indexOf(a), 1);
    }
  }

  /** Los que se van: corren hasta la pared y ahí desaparecen. */
  private runOff(s: Show, dt: number): void {
    for (const a of [...s.actors]) {
      if (!a.flee) continue;
      const left = a.tx - a.x;
      const step = a.flee * dt;
      if (Math.abs(left) > step) {
        a.x += Math.sign(left) * step;
        a.dist += step;
        a.dir = left > 0 ? 1 : -1;
        const n = a.strip?.n ?? 1;
        a.frame = n > 1 ? Math.floor(a.dist / 3) % n : 0;
        continue;
      }
      this.drop(a);
      s.actors.splice(s.actors.indexOf(a), 1);
    }
  }

  /** Lo que se pone en la sala para cada incidente. */
  private build(
    key: string,
    kind: IncidentKind,
    r: Rect,
    floor: number,
    level: number,
    taps?: number,
  ): Show {
    const s: Show = { key, kind, r, floor, level, actors: [], timer: 0, beat: 0, n: 0, taps };
    const mid = r.x + r.w / 2;
    const A = s.actors;
    switch (kind) {
      case 'ratas':
        for (let i = 0; i < Math.min(MAX_RATS, taps ?? MAX_RATS); i++) A.push(this.rat(s, false));
        break;
      case 'fuego': {
        const x = r.x + HEARTH_X;
        A.push(this.flame(x, floor - 2, SOLID - 4, 1.1));
        A.push(this.flame(x + 20, floor, FRONT + 8, 0.6));
        break;
      }
      case 'gotera': {
        const x = r.x + r.w * 0.62;
        const p = this.strip('charco', puddleStrip);
        A.push(this.figure(p, x, floor, MID));
        A.push(this.still(bucket(), x + 26, floor, MID - 2));
        A.push(this.still(dampStain(), x, r.y + 4, MID));
        A.push(this.still(dampStain(), x + 26, r.y + 4, MID - 2));
        break;
      }
      case 'pelea':
        A.push(this.figure(this.strip('pelea', brawlStrip), mid, floor, FRONT - 2));
        A.push(this.still(toppledStool(), mid + 30, floor, FRONT));
        break;
      case 'ladron': {
        const a = this.figure(this.strip('ladron', thiefStrip), r.x + 20, floor, FRONT + 2);
        a.tx = r.x + r.w - 20;
        A.push(a);
        break;
      }
      case 'recaudador':
        A.push(
          this.figure(this.strip('recaudador', taxmanStrip), r.x + r.w * 0.3, floor, FRONT + 4),
        );
        break;
      case 'noble': {
        const a = this.figure(
          this.strip('noble', nobleStrip),
          r.x + BAR_X + NOBLE_DX,
          floor,
          FRONT - 1,
        );
        a.frame = NOBLE_F.up;
        A.push(a);
        break;
      }
    }
    return s;
  }

  /** Cada incidente, a lo suyo. */
  private step(s: Show, dt: number, t: number): void {
    const A = s.actors;
    const emit = this.emit;
    switch (s.kind) {
      case 'ratas':
        // Corren de un sitio a otro de la sala, se paran a husmear y vuelven a correr.
        for (const a of A) {
          if (a.flee) continue;
          if (a.wait > 0) {
            a.wait -= dt;
            continue;
          }
          const left = a.tx - a.x;
          const step = RAT_SPEED * dt;
          if (Math.abs(left) <= step) {
            a.x = a.tx;
            a.tx = s.r.x + 10 + this.rnd() * (s.r.w - 20);
            a.wait = this.rnd() < 0.5 ? 0.3 + this.rnd() * 1.2 : 0;
          } else {
            a.x += Math.sign(left) * step;
            a.dist += step;
            a.dir = left > 0 ? 1 : -1;
          }
          a.frame = a.wait > 0 ? 0 : Math.floor(a.dist / 3) % 2;
        }
        // Si quedan más toques que ratas a la vista, entra otra corriendo.
        if (s.timer <= 0 && A.filter((a) => !a.flee).length < Math.min(MAX_RATS, s.taps ?? 0)) {
          s.timer = 0.8;
          A.push(this.rat(s, true));
        }
        break;
      case 'fuego': {
        const tick = Math.floor(t * 9);
        A.forEach((a, i) => {
          a.frame = (tick + i * 3) % BLAZE_F;
          a.stretch = 0.85 + 0.3 * Math.abs(Math.sin(t * 7 + i * 2));
        });
        if (s.timer > 0) break;
        s.timer = 0.07;
        // Humo espeso que sube, ascuas y alguna chispa.
        const a = A[s.n++ % A.length]!;
        const k = scaleAt(a.z);
        const top = a.bottom - (a.glow!.h * a.stretch) / k;
        emit?.('smoke', a.x + (this.rnd() - 0.5) * 8, top, a.z, { max: 3 + this.rnd() * 2 });
        if (this.rnd() < 0.6) emit?.('ember', a.x + (this.rnd() - 0.5) * 12, top + 6, a.z);
        if (this.rnd() < 0.15) emit?.('spark', a.x, top + 4, a.z);
        if (s.n % 5 === 0) emit?.('chimney', a.x + (this.rnd() - 0.5) * 6, top, a.z);
        break;
      }
      case 'gotera': {
        const puddle = A[0]!;
        if (s.beat <= 0) puddle.frame = 0;
        if (s.timer > 0) break;
        // Una gota de cada mancha, por turnos: al charco y al cubo.
        s.timer = 0.6 + this.rnd() * 0.5;
        const into = s.n++ % 2;
        const x = A[into ? 1 : 0]!.x;
        const land = into
          ? A[1]!.bottom - A[1]!.strip!.h / scaleAt(A[1]!.z) + 1
          : puddle.bottom - 1;
        emit?.('drip', x, s.r.y + 8, A[into ? 3 : 2]!.z, { vy: 0, vx: 0, land, max: 3 });
        if (!into) {
          puddle.frame = 1;
          s.beat = 0.9;
        }
        break;
      }
      case 'pelea': {
        const cloud = A[0]!;
        // La nube va y viene por la sala, temblando, y cambia de forma a cada golpe.
        const base = s.r.x + s.r.w / 2;
        cloud.x = base + Math.sin(t * 0.8) * 16 + (this.rnd() - 0.5) * 2;
        if (s.beat <= 0) {
          s.beat = 0.1 + this.rnd() * 0.12;
          cloud.frame = (cloud.frame + 1 + Math.floor(this.rnd() * (BRAWL_F - 1))) % BRAWL_F;
          cloud.dir = this.rnd() < 0.5 ? 1 : -1;
        }
        if (s.timer > 0) break;
        s.timer = 0.18;
        const k = scaleAt(cloud.z);
        const top = cloud.bottom - cloud.strip!.h / k;
        const w = cloud.strip!.w / k;
        if (this.rnd() < 0.6) emit?.('star', cloud.x + (this.rnd() - 0.5) * w, top + 2, cloud.z);
        emit?.('puff', cloud.x + (this.rnd() - 0.5) * w, cloud.bottom - 4, cloud.z);
        break;
      }
      case 'ladron': {
        // De puntillas de un lado a otro; al llegar, se para, mira atrás y se le cae una moneda.
        const a = A[0]!;
        if (a.wait > 0) {
          a.wait -= dt;
          if (a.wait < 0.8) a.dir = a.tx > a.x ? 1 : -1;
          break;
        }
        const left = a.tx - a.x;
        const step = THIEF_SPEED * dt;
        if (Math.abs(left) <= step) {
          a.x = a.tx;
          a.tx = a.x < s.r.x + s.r.w / 2 ? s.r.x + s.r.w - 20 : s.r.x + 20;
          a.wait = 1.6;
          a.dir = a.dir === 1 ? -1 : 1;
          emit?.('coin', a.x - a.dir * 4, a.bottom - 14, a.z);
        } else {
          a.x += Math.sign(left) * step;
          a.dist += step;
          a.dir = left > 0 ? 1 : -1;
        }
        a.frame = a.wait > 0 ? 0 : Math.floor(a.dist / 4) % 2;
        break;
      }
      case 'recaudador': {
        // Golpecitos con el pie, una pausa; y a ratos, un «¡!» de impaciencia.
        const a = A[0]!;
        if (s.beat <= 0) s.beat = 3;
        a.frame = s.beat > 1.2 ? Math.floor(t * 3.5) % 2 : 0;
        a.dir = s.beat > 2.6 ? -1 : 1;
        if (s.timer > 0) break;
        s.timer = 4 + this.rnd() * 2;
        const k = scaleAt(a.z);
        emit?.('bark', a.x - 1, a.bottom - a.strip!.h / k - 4, a.z);
        break;
      }
      case 'noble': {
        // Se tambalea de un lado a otro y canta (mal).
        const a = A[0]!;
        const sway = Math.sin(t * 2.2);
        a.frame = sway < -0.5 ? NOBLE_F.left : sway > 0.5 ? NOBLE_F.right : NOBLE_F.up;
        a.x = s.r.x + BAR_X + NOBLE_DX + Math.sin(t * 0.6) * 6;
        if (s.timer > 0) break;
        s.timer = 1.4 + this.rnd();
        const k = scaleAt(a.z);
        emit?.('note', a.x + 2, a.bottom - a.strip!.h / k, a.z);
        break;
      }
    }
  }

  private place(a: Actor, s: Show): void {
    const k = scaleAt(a.z);
    const fw = a.strip?.w ?? a.glow!.w;
    const fh = a.strip?.h ?? a.glow!.h;
    const w = fw / k;
    const h = (fh * a.stretch) / k;
    const origin = at(a.x - w / 2, a.bottom, a.z);
    a.mesh.position.copy(origin);
    a.mesh.scale.set(w, h, 1);
    const u = a.mat.uniforms;
    if (a.glow) {
      u.uUvOffset!.value.set(a.frame / a.cells, 0);
      return;
    }
    // Mirando a la izquierda, los fotogramas volteados (los fijos no se voltean).
    const cell = a.cells > 1 && a.dir < 0 ? a.frame + a.strip!.n : a.frame;
    u.uUvOffset!.value.set(cell / a.cells, 0);
    u.uOrigin!.value.copy(origin);
    u.uAxisU!.value.set(w, 0, 0);
    u.uAxisV!.value.set(0, h, 0);
    // La luz de su sala, algo más clara (en las salas oscuras no se les veía).
    const room = this.tint(a.x, s.level);
    const amb = a.critter ? CRITTER : room.ambient.map((c, i) => Math.max(c, LIFT[i]!));
    u.uAmbient!.value.set(amb[0]!, amb[1]!, amb[2]!);
    u.uSun!.value = room.sun;
  }
}
