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

/** Cámara 2D con arrastre, inercia, zoom entero y enfoque suave a un punto. */
export class Camera {
  /** Por defecto, la taberna dibujada con su cielo de más por arriba. */
  world: CameraWorld = { x0: WORLD_X0, x1: WORLD_X1, y0: -SKY_TOP, y1: WORLD_H };
  /**
   * Lo que el centro de la vista tiene que poder alcanzar aunque se salga del mundo por un borde
   * (por ejemplo, para ver de frente una sala de una esquina del edificio).
   */
  reach: CameraWorld | null = null;
  x = 0;
  y = 0;
  zoom = 2;
  /** Tamaño de la vista en píxeles lógicos. */
  vw = 0;
  vh = 0;
  private vx = 0;
  private vy = 0;
  private target: { x: number; y: number } | null = null;
  dragging = false;

  setView(cssW: number, cssH: number, zoom = this.zoom): void {
    const cx = this.x + this.vw / 2;
    const cy = this.y + this.vh / 2;
    this.zoom = zoom;
    this.vw = Math.ceil(cssW / zoom);
    this.vh = Math.ceil(cssH / zoom);
    if (cx || cy) {
      this.x = cx - this.vw / 2;
      this.y = cy - this.vh / 2;
    }
    this.clamp();
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
    if (!r) return { minX, maxX, minY, maxY };
    return {
      minX: Math.min(minX, r.x0 - this.vw / 2),
      maxX: Math.max(maxX, r.x1 - this.vw / 2),
      minY: Math.min(minY, r.y0 - this.vh / 2),
      maxY: Math.max(maxY, r.y1 - this.vh / 2),
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

  centerOn(x: number, y: number, smooth = true): void {
    const tx = x - this.vw / 2;
    const ty = y - this.vh / 2;
    if (smooth) this.target = { x: tx, y: ty };
    else {
      this.target = null;
      this.x = tx;
      this.y = ty;
      this.clamp();
    }
    this.stopInertia();
  }

  update(dt: number): void {
    if (this.target) {
      // El destino, dentro de los límites: si no, nunca se llegaría y seguiría tirando.
      const b = this.bounds();
      this.target.x = Math.max(b.minX, Math.min(b.maxX, this.target.x));
      this.target.y = Math.max(b.minY, Math.min(b.maxY, this.target.y));
      const k = 1 - Math.pow(0.002, dt);
      this.x += (this.target.x - this.x) * k;
      this.y += (this.target.y - this.y) * k;
      if (Math.abs(this.target.x - this.x) < 0.3 && Math.abs(this.target.y - this.y) < 0.3)
        this.target = null;
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
