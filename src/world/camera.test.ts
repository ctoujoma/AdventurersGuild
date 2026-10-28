import { describe, expect, it } from 'vitest';
import { Camera, SKY_TOP } from './camera';
import { WORLD_H, WORLD_X0, WORLD_X1 } from './geometry';

describe('Camera', () => {
  it('no se sale del mundo (salvo un poco de cielo por arriba)', () => {
    const c = new Camera();
    c.setView(400, 600, 2);
    c.centerOn(-500, -500, false);
    expect(c.x).toBe(WORLD_X0);
    expect(c.y).toBe(-SKY_TOP);
    c.centerOn(5000, 5000, false);
    expect(c.x + c.vw).toBe(WORLD_X1);
    expect(c.y + c.vh).toBe(WORLD_H);
  });

  it('un enfoque suave fuera de los límites termina y suelta la cámara', () => {
    const c = new Camera();
    c.setView(400, 600, 2);
    c.centerOn(250, 5000);
    for (let i = 0; i < 200; i++) c.update(1 / 60);
    expect(c.y + c.vh).toBeCloseTo(WORLD_H, 0);
    c.centerOn(250, -5000, false);
    c.update(1 / 60);
    expect(c.y).toBe(-SKY_TOP);
  });

  it('con alcance, cualquier punto de él puede quedar en el centro aunque se salga del mundo', () => {
    const c = new Camera();
    c.world = { x0: 0, x1: 500, y0: 0, y1: 500 };
    c.reach = { x0: 20, x1: 480, y0: 30, y1: 470 };
    c.setView(400, 400, 1);
    c.centerOn(480, 30, false);
    expect(c.x + c.vw / 2).toBe(480);
    expect(c.y + c.vh / 2).toBe(30);
    c.centerOn(-500, 5000, false);
    expect(c.x + c.vw / 2).toBe(20);
    expect(c.y + c.vh / 2).toBe(470);
  });

  it('convierte entre pantalla y mundo', () => {
    const c = new Camera();
    c.setView(400, 400, 2);
    c.centerOn(250, 200, false);
    const w = c.toWorld(100, 60);
    const s = c.toScreen(w.x, w.y);
    expect(s).toEqual({ x: 100, y: 60 });
  });
});
