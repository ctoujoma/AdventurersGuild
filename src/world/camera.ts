import { WORLD_H, WORLD_W } from './geometry';

/** Cámara 2D con arrastre, inercia, zoom entero y enfoque suave a un punto. */
export class Camera {
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
    const minX = this.vw >= WORLD_W ? (WORLD_W - this.vw) / 2 : 0;
    const maxX = this.vw >= WORLD_W ? minX : WORLD_W - this.vw;
    const minY = this.vh >= WORLD_H ? (WORLD_H - this.vh) / 2 : 0;
    const maxY = this.vh >= WORLD_H ? minY : WORLD_H - this.vh;
    return { minX, maxX, minY, maxY };
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
      this.x = tx;
      this.y = ty;
      this.clamp();
    }
    this.stopInertia();
  }

  update(dt: number): void {
    if (this.target) {
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
