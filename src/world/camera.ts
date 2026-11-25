import { WORLD_H, WORLD_X0, WORLD_X1 } from './geometry';

/** Cielo de más por encima del mundo, para ver el sol sobre el tejado al subir la cámara. */
export const SKY_TOP = 36;

/** Rectángulo del mundo por el que se puede mover la cámara. */
export interface CameraWorld {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Cámara 2D con arrastre, inercia, zoom y enfoque suave a un punto. El zoom puede pasar por
 * valores no enteros (al animarse o con el pellizco); la escena lo deja quieto en uno nítido.
 */
export class Camera {
  /** Por defecto, la taberna dibujada con su cielo de más por arriba. */
  world: CameraWorld = { x0: WORLD_X0, x1: WORLD_X1, y0: -SKY_TOP, y1: WORLD_H };
  /**
   * Lo que el centro de la vista tiene que poder alcanzar aunque se salga del mundo por un borde
   * (por ejemplo, para ver de frente una sala de una esquina del edificio).
   */
  reach: CameraWorld | null = null;
  /** Bajada de más (en mundo) para dejar algo a la vista sobre un panel; 0 normalmente. */
  lift = 0;
  /** Lo mismo hacia la derecha, para dejar algo a la vista junto a un panel de lado. */
  liftX = 0;
  /**
   * Lo que tapan por abajo y por la derecha los paneles y barras abiertos (en píxeles CSS): la
   * cámara puede pasar el borde del mundo eso, para ver lo que quedaría debajo (en obras, lo más
   * hondo del sótano bajo la barra).
   */
  coverCss = { right: 0, bottom: 0 };
  x = 0;
  y = 0;
  zoom = 2;
  /** Tamaño de la vista en píxeles lógicos. */
  vw = 0;
  vh = 0;
  private vx = 0;
  private vy = 0;
  /** El destino de un enfoque suave: el centro de la vista (así vale aunque cambie el zoom). */
  private target: { cx: number; cy: number } | null = null;
  /** Tamaño de la vista en píxeles CSS (para `zoomAround`). */
  private cssW = 0;
  private cssH = 0;
  /** Lo que queda del camino por segundo al ir a un destino (más alto, más lento). */
  private ease = 0.002;
  dragging = false;

  setView(cssW: number, cssH: number, zoom = this.zoom): void {
    const cx = this.x + this.vw / 2;
    const cy = this.y + this.vh / 2;
    this.cssW = cssW;
    this.cssH = cssH;
    this.zoom = zoom;
    this.vw = Math.ceil(cssW / zoom);
    this.vh = Math.ceil(cssH / zoom);
    if (cx || cy) {
      this.x = cx - this.vw / 2;
      this.y = cy - this.vh / 2;
    }
    this.clamp();
  }

  /**
   * Cambia el zoom dejando quieto el punto del mundo que se ve en (ax, ay) de la vista (en
   * píxeles CSS, con la posición sin redondear: la escena corre el lienzo lo que falta).
   */
  zoomAround(zoom: number, ax: number, ay: number): void {
    const wx = this.x + ax / this.zoom;
    const wy = this.y + ay / this.zoom;
    this.zoom = zoom;
    this.vw = Math.ceil(this.cssW / zoom);
    this.vh = Math.ceil(this.cssH / zoom);
    this.x = wx - ax / zoom;
    this.y = wy - ay / zoom;
    this.clamp();
  }

  /** Corre la cámara (y su destino, si va hacia uno) tanto como se ha corrido lo que se mira. */
  shiftBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    if (this.target) {
      this.target.cx += dx;
      this.target.cy += dy;
    }
  }

  private bounds() {
    const { x0, x1, y0, y1 } = this.world;
    const w = x1 - x0;
    const h = y1 - y0;
    const minX = this.vw >= w ? x0 + (w - this.vw) / 2 : x0;
    const maxX = this.vw >= w ? minX : x1 - this.vw;
    const minY = this.vh >= h ? y0 + (h - this.vh) / 2 : y0;
    const maxY = this.vh >= h ? minY : y1 - this.vh;
    const r = this.reach;
    const padX = this.coverCss.right / this.zoom;
    const padY = this.coverCss.bottom / this.zoom;
    if (!r)
      return {
        minX,
        maxX: maxX + Math.max(this.liftX, padX),
        minY,
        maxY: maxY + Math.max(this.lift, padY),
      };
    return {
      minX: Math.min(minX, r.x0 - this.vw / 2),
      maxX: Math.max(maxX, r.x1 - this.vw / 2) + Math.max(this.liftX, padX),
      minY: Math.min(minY, r.y0 - this.vh / 2),
      maxY: Math.max(maxY, r.y1 - this.vh / 2) + Math.max(this.lift, padY),
    };
  }

  clamp(): void {
    const b = this.bounds();
    this.x = Math.max(b.minX, Math.min(b.maxX, this.x));
    this.y = Math.max(b.minY, Math.min(b.maxY, this.y));
  }

  /** Desplaza en píxeles CSS (arrastre). */
  drag(dxCss: number, dyCss: number, dt: number): void {
    const dx = dxCss / this.zoom;
    const dy = dyCss / this.zoom;
    this.x -= dx;
    this.y -= dy;
    if (dt > 0) {
      this.vx = this.vx * 0.5 + (-dx / dt) * 0.5;
      this.vy = this.vy * 0.5 + (-dy / dt) * 0.5;
    }
    this.target = null;
    this.clamp();
  }

  release(): void {
    this.dragging = false;
  }

  stopInertia(): void {
    this.vx = 0;
    this.vy = 0;
  }

  centerOn(x: number, y: number, smooth = true, slow = false): void {
    this.ease = slow ? 0.25 : 0.002;
    if (smooth) this.target = { cx: x, cy: y };
    else {
      this.target = null;
      this.x = x - this.vw / 2;
      this.y = y - this.vh / 2;
      this.clamp();
    }
    this.stopInertia();
  }

  /**
   * Quita la bajada de más y vuelve, suave, a los límites de siempre (si iba hacia algún sitio,
   * sigue yendo: el destino se ajusta a los límites al andar).
   */
  unlift(): void {
    if (!this.lift && !this.liftX) return;
    this.lift = 0;
    this.liftX = 0;
    if (this.target) return;
    this.target = { cx: this.x + this.vw / 2, cy: this.y + this.vh / 2 };
    this.ease = 0.002;
  }

  /** Pone la cámara de golpe en un punto (esquina de arriba a la izquierda), dentro de los límites. */
  jump(x: number, y: number): void {
    this.target = null;
    this.x = x;
    this.y = y;
    this.stopInertia();
    this.clamp();
  }

  update(dt: number): void {
    if (this.target) {
      // El destino, dentro de los límites: si no, nunca se llegaría y seguiría tirando.
      const b = this.bounds();
      const tx = Math.max(b.minX, Math.min(b.maxX, this.target.cx - this.vw / 2));
      const ty = Math.max(b.minY, Math.min(b.maxY, this.target.cy - this.vh / 2));
      this.target.cx = tx + this.vw / 2;
      this.target.cy = ty + this.vh / 2;
      const k = 1 - Math.pow(this.ease, dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
      if (Math.abs(tx - this.x) < 0.3 && Math.abs(ty - this.y) < 0.3) this.target = null;
      this.clamp();
      return;
    }
    if (this.dragging) return;
    if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const f = Math.pow(0.04, dt);
      this.vx *= f;
      this.vy *= f;
      const before = { x: this.x, y: this.y };
      this.clamp();
      if (before.x !== this.x) this.vx = 0;
      if (before.y !== this.y) this.vy = 0;
    }
  }

  /** Posición entera para pintar (el pixel art no admite medios píxeles). */
  get px(): number {
    return Math.round(this.x);
  }

  get py(): number {
    return Math.round(this.y);
  }

  toWorld(cssX: number, cssY: number): { x: number; y: number } {
    return { x: this.px + cssX / this.zoom, y: this.py + cssY / this.zoom };
  }

  toScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.px) * this.zoom, y: (wy - this.py) * this.zoom };
  }
}

/** Lo que dura un paso de zoom animado (ms). */
export const ZOOM_TIME = 220;
/** Lo más cerca que se puede acercar. */
export const MAX_ZOOM = 6;

const dprNow = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

/**
 * El zoom nítido más cercano a `z`: un número entero de píxeles de la pantalla por cada píxel
 * del juego (en un teléfono con 3 por píxel CSS, también 4/3 o 5/3).
 */
export const crispNear = (z: number, dpr = dprNow()) => Math.max(1, Math.round(z * dpr)) / dpr;

/** El zoom nítido más grande que no pasa de `z`. */
export const crispBelow = (z: number, dpr = dprNow()) =>
  Math.max(1, Math.floor(z * dpr + 1e-6)) / dpr;

/**
 * El zoom de un paso desde `cur`: el entero de al lado (en su valor nítido), sin bajar de `min`
 * ni pasar de `MAX_ZOOM`.
 */
export function stepZoom(cur: number, step: number, min: number, dpr = dprNow()): number {
  if (step > 0) {
    for (let n = Math.floor(cur + 1e-6) + 1; n <= MAX_ZOOM; n++) {
      const z = Math.min(MAX_ZOOM, crispNear(n, dpr));
      if (z > cur + 0.01) return z;
    }
    return Math.max(cur, min);
  }
  for (let n = Math.ceil(cur - 1e-6) - 1; n >= 1; n--) {
    const z = crispNear(n, dpr);
    if (z < cur - 0.01) return Math.max(min, z);
  }
  return Math.min(cur, min);
}
