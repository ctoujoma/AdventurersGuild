/**
 * Los efectos de los golpes del asalto (y del duelo con el ladrón): flechas, rayos y bolas de
 * fuego que vuelan hasta el blanco, el rastro del tajo, la estocada, el mazazo, la luz de la cura
 * y el grito de Provocar. Como en la pelea de jefes (`world/battle.ts`), pero a escala de sala y
 * siguiendo a la gente de la escena (`Crowd.where`).
 */
import { P } from '../../art/palette';

/** Dónde está alguien ahora (los pies), o null si ya no se ve. */
export type WhereFn = (id: string) => { x: number; y: number } | null;

export type ShotKind = 'arrow' | 'bolt' | 'fire';

interface Shot {
  kind: ShotKind;
  x0: number;
  y0: number;
  to: string;
  t: number;
  dur: number;
  /** Altura de la parábola (las flechas suben un poco). */
  arc: number;
  /** Lo que pasa al llegar (el número, las chispas y el sonido). */
  onHit: () => void;
  /** Por dónde va (para pintarla y su estela). */
  x: number;
  y: number;
  trail: { x: number; y: number }[];
}

export type FxKind =
  /** Rastro del tajo: un arco blanco de arriba abajo. */
  | 'slash'
  /** Estocada: una raya rápida hacia delante. */
  | 'thrust'
  /** Mazazo: estrella en el golpe y polvo en el suelo. */
  | 'smash'
  /** Puñalada: dos tajos en aspa, rojos. */
  | 'stab'
  /** Golpe crítico: una estrella blanca que se abre. */
  | 'crit'
  /** Explosión de la bola de fuego. */
  | 'boom'
  /** Chispas del hechizo en la punta del bastón. */
  | 'cast'
  /** La luz de la cura: una columna que cae y un halo. */
  | 'pillar'
  /** Provocar: ondas que salen del guerrero. */
  | 'shout';

interface Fx {
  kind: FxKind;
  id: string;
  t: number;
  dur: number;
  dir: 1 | -1;
  seed: number;
  /** Donde estaba al empezar (si el que lo lleva desaparece, sigue ahí). */
  x: number;
  y: number;
}

const DUR: Record<FxKind, number> = {
  slash: 0.28,
  thrust: 0.22,
  smash: 0.4,
  stab: 0.45,
  crit: 0.35,
  boom: 0.5,
  cast: 0.3,
  pillar: 0.9,
  shout: 0.8,
};

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

export class RaidFx {
  private shots: Shot[] = [];
  private fx: Fx[] = [];

  constructor(private where: WhereFn) {}

  get busy(): boolean {
    return this.shots.length > 0 || this.fx.length > 0;
  }

  /** Un proyectil de un punto hasta alguien; `delay` lo retrasa (la segunda flecha). */
  shoot(kind: ShotKind, x0: number, y0: number, to: string, onHit: () => void, delay = 0): void {
    const b = this.where(to);
    const d = b ? Math.abs(b.x - x0) : 30;
    const speed = kind === 'arrow' ? 260 : kind === 'bolt' ? 200 : 150;
    this.shots.push({
      kind,
      x0,
      y0,
      to,
      t: -delay,
      dur: Math.max(0.12, d / speed),
      arc: kind === 'arrow' ? Math.min(10, d * 0.15) : kind === 'fire' ? Math.min(14, d * 0.2) : 0,
      onHit,
      x: x0,
      y: y0,
      trail: [],
    });
  }

  /** Un efecto sobre alguien (o donde estaba). */
  add(kind: FxKind, id: string, dir: 1 | -1 = 1, delay = 0): void {
    const w = this.where(id);
    this.fx.push({
      kind,
      id,
      t: -delay,
      dur: DUR[kind],
      dir,
      seed: Math.random() * 6.28,
      x: w?.x ?? 0,
      y: w?.y ?? 0,
    });
  }

  /** Avanza `dt` segundos del asalto. */
  update(dt: number): void {
    for (const s of this.shots) {
      s.t += dt;
      if (s.t < 0) continue;
      const b = this.where(s.to);
      const tx = b ? b.x : s.x;
      const ty = b ? b.y - 14 : s.y;
      const k = Math.min(1, s.t / s.dur);
      s.trail.unshift({ x: s.x, y: s.y });
      if (s.trail.length > 6) s.trail.pop();
      s.x = s.x0 + (tx - s.x0) * k;
      s.y = s.y0 + (ty - s.y0) * k - Math.sin(k * Math.PI) * s.arc;
    }
    for (const s of this.shots) if (s.t >= s.dur) s.onHit();
    this.shots = this.shots.filter((s) => s.t < s.dur);
    for (const e of this.fx) {
      e.t += dt;
      const w = this.where(e.id);
      if (w) {
        e.x = w.x;
        e.y = w.y;
      }
    }
    this.fx = this.fx.filter((e) => e.t < e.dur);
  }

  /** Se acaba todo de golpe (al saltarse el asalto): los proyectiles llegan ya. */
  flush(): void {
    for (const s of this.shots) s.onHit();
    this.shots = [];
    this.fx = [];
  }

  draw(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const dot = (x: number, y: number, c: string, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x - px), Math.round(y - py), w, h);
    };
    for (const e of this.fx) {
      if (e.t < 0) continue;
      const k = e.t / e.dur;
      this.effect(e, k, dot);
    }
    for (const s of this.shots) {
      if (s.t < 0) continue;
      const k = Math.min(1, s.t / s.dur);
      switch (s.kind) {
        case 'arrow': {
          // La flecha, inclinada según va (sube y baja).
          const b = this.where(s.to);
          const vx = (b ? b.x : s.x) - s.x0 || 1;
          const dir = Math.sign(vx);
          const slope = Math.cos(k * Math.PI) * (s.arc / Math.max(8, Math.abs(vx))) * 3;
          for (let i = 0; i < 7; i++)
            dot(s.x - dir * i, s.y + slope * i, i === 0 ? P.mist : i > 4 ? P.white : P.tan);
          break;
        }
        case 'bolt':
          // Un rayo azul con su estela que parpadea.
          s.trail.forEach((p, i) => i % 2 === 0 && dot(p.x, p.y, i < 3 ? P.cyan : P.sky));
          dot(s.x - 1, s.y - 1, P.sky, 3, 3);
          dot(s.x, s.y, P.white);
          if (Math.floor(s.t * 30) % 2) dot(s.x - 2, s.y, P.cyan, 5, 1);
          break;
        case 'fire':
          s.trail.forEach((p, i) => dot(p.x - 1, p.y - 1, i > 3 ? P.red : P.orange, 2, 2));
          dot(s.x - 2, s.y - 2, P.orange, 5, 5);
          dot(s.x - 1, s.y - 1, P.lemon, 3, 3);
          dot(s.x, s.y, P.white);
          break;
      }
    }
  }

  private effect(
    e: Fx,
    k: number,
    dot: (x: number, y: number, c: string, w?: number, h?: number) => void,
  ): void {
    const { x, y, dir } = e;
    const chest = y - 14;
    switch (e.kind) {
      case 'slash': {
        // Un arco que barre de arriba abajo delante del blanco y se apaga por la cola.
        const head = Math.min(1, k * 1.6);
        const tail = Math.max(0, k * 1.6 - 0.6);
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          if (u > head || u < tail) continue;
          const a = -1.1 + u * 2.2;
          const sx = x - dir * 2 + dir * Math.cos(a) * 7;
          const sy = chest + Math.sin(a) * 8;
          dot(sx, sy, u > head - 0.2 ? P.white : P.mist);
          if (u > head - 0.35) dot(sx - dir, sy, P.mist);
        }
        break;
      }
      case 'thrust': {
        // Una raya que entra hacia el blanco y un destello en la punta.
        const len = Math.round(10 * (1 - k));
        for (let i = 0; i < len; i++) dot(x - dir * (4 + i), chest + 1, i < 3 ? P.white : P.mist);
        if (k < 0.4) {
          dot(x - dir * 3, chest, P.white);
          dot(x - dir * 3, chest + 2, P.white);
          dot(x - dir * 4, chest + 1, P.lemon);
        }
        break;
      }
      case 'smash': {
        // Estrella en la cabeza y polvo que se abre a ras de suelo.
        if (k < 0.45) {
          const r = 2 + Math.round(k * 8);
          for (let i = -r; i <= r; i++) {
            dot(x + i, y - 20, Math.abs(i) < 2 ? P.white : P.lemon);
            dot(x, y - 20 + i, Math.abs(i) < 2 ? P.white : P.lemon);
          }
        }
        const r = 4 + easeOut(k) * 10;
        for (let i = 0; i < 14; i++) {
          if ((i + Math.floor(k * 10)) % 3 === 0) continue;
          const a = (i / 14) * Math.PI * 2;
          dot(x + Math.cos(a) * r, y - 1 + Math.sin(a) * r * 0.25, k < 0.5 ? P.sand : P.tan);
        }
        break;
      }
      case 'stab': {
        // Dos tajos en aspa, rojos, que crecen y se apagan.
        const r = Math.round(3 + easeOut(Math.min(1, k * 2)) * 6);
        const c = k < 0.3 ? P.white : k < 0.7 ? P.hot : P.wine;
        for (let i = -r; i <= r; i++) {
          dot(x + i, chest + i, c);
          dot(x + i, chest - i, c);
        }
        if (k < 0.25) dot(x - 2, chest - 2, P.white, 5, 5);
        break;
      }
      case 'crit': {
        const r = 3 + easeOut(k) * 9;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + e.seed;
          const c = k < 0.5 ? P.white : P.lemon;
          dot(x + Math.cos(a) * r, chest - 2 + Math.sin(a) * r, c);
          dot(x + Math.cos(a) * (r - 2), chest - 2 + Math.sin(a) * (r - 2), P.lemon);
        }
        break;
      }
      case 'boom': {
        const r = 3 + easeOut(k) * 12;
        if (k < 0.3) dot(x - r / 2, chest - r / 2, P.lemon, Math.max(1, r), Math.max(1, r));
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2 + e.seed;
          const c = k < 0.35 ? P.white : k < 0.6 ? P.lemon : k < 0.8 ? P.orange : P.red;
          dot(x + Math.cos(a) * r, chest + Math.sin(a) * r * 0.8, c);
        }
        break;
      }
      case 'cast': {
        // Chispas que giran en la punta del bastón (alto y hacia delante).
        const hx = x + dir * 8;
        const hy = y - 24;
        for (let i = 0; i < 4; i++) {
          const a = e.t * 18 + (i * Math.PI) / 2;
          const r = 3 * (1 - k);
          dot(hx + Math.cos(a) * r, hy + Math.sin(a) * r, i % 2 ? P.cyan : P.white);
        }
        break;
      }
      case 'pillar': {
        // La luz cae del techo sobre el curado, se estrecha y deja chispas que suben.
        const w = Math.max(1, Math.round(9 * (1 - k)));
        const top = y - 46;
        const grow = Math.min(1, k * 4);
        for (let yy = top; yy < top + (y - top) * grow; yy++) {
          if ((yy + Math.floor(e.t * 40)) % 4 === 0) continue;
          dot(x - w / 2, yy, k < 0.5 ? P.lemon : P.gold, w, 1);
        }
        dot(x - Math.max(1, w / 4), top, P.white, Math.max(1, w / 2), (y - top) * grow);
        // El halo sobre la cabeza.
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          dot(x + Math.cos(a) * 5, y - 29 + Math.sin(a) * 1.5, i % 3 ? P.lemon : P.white);
        }
        for (let i = 0; i < 4; i++)
          dot(
            x - 6 + ((i * 5 + Math.floor(e.t * 30)) % 12),
            y - 4 - ((e.t * 50 + i * 9) % 26),
            i % 2 ? P.white : P.lemon,
          );
        break;
      }
      case 'shout': {
        // Ondas hacia los dos lados (atrae los golpes).
        for (let ring = 0; ring < 3; ring++) {
          const r = 5 + ((k * 22 + ring * 7) % 22);
          for (const side of [1, -1]) {
            for (let i = -4; i <= 4; i++) {
              const a = (i / 4) * 0.8;
              dot(
                x + side * Math.cos(a) * r,
                y - 18 + Math.sin(a) * r,
                ring === 0 ? P.white : P.coral,
              );
            }
          }
        }
        break;
      }
    }
  }
}
