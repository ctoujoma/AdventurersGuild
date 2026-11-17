import { describe, expect, it } from 'vitest';
import { Camera, SKY_TOP, crispBelow, crispNear, stepZoom } from './camera';
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

  it('al cambiar el zoom deja quieto el punto que se le dice', () => {
    const c = new Camera();
    c.setView(400, 600, 2);
    c.centerOn(250, 200, false);
    const before = { x: c.x + 100 / 2, y: c.y + 80 / 2 };
    c.zoomAround(3, 100, 80);
    expect(c.zoom).toBe(3);
    expect(c.vw).toBe(Math.ceil(400 / 3));
    expect(c.x + 100 / 3).toBeCloseTo(before.x, 6);
    expect(c.y + 80 / 3).toBeCloseTo(before.y, 6);
  });

  it('un enfoque suave llega al punto aunque el zoom cambie por el camino', () => {
    const c = new Camera();
    c.setView(400, 600, 2);
    c.centerOn(300, 250, false);
    c.centerOn(250, 200);
    for (let i = 0; i < 10; i++) c.update(1 / 60);
    c.zoomAround(3, 200, 300);
    for (let i = 0; i < 300; i++) c.update(1 / 60);
    expect(c.x + c.vw / 2).toBeCloseTo(250, 0);
    expect(c.y + c.vh / 2).toBeCloseTo(200, 0);
  });
});

describe('zoom nítido', () => {
  it('un número entero de píxeles de la pantalla por píxel del juego', () => {
    expect(crispNear(2, 1)).toBe(2);
    expect(crispNear(1.4, 3)).toBeCloseTo(4 / 3);
    expect(crispNear(2, 2.625)).toBeCloseTo(5 / 2.625);
    expect(crispBelow(1.625, 3)).toBeCloseTo(4 / 3);
    expect(crispBelow(1.5, 2)).toBe(1.5);
  });

  it('los pasos van de entero en entero, sin bajar del mínimo ni pasar de 6', () => {
    expect(stepZoom(2, 1, 1, 1)).toBe(3);
    expect(stepZoom(1.5, 1, 1, 2)).toBe(2);
    expect(stepZoom(4 / 3, -1, 0.7, 3)).toBe(1);
    expect(stepZoom(1, -1, 0.7, 1)).toBe(0.7);
    expect(stepZoom(2, -1, 1.6, 1)).toBe(1.6);
    expect(stepZoom(6, 1, 1, 1)).toBe(6);
    // Con 2,625 por píxel CSS, el «2» nítido es 5/2,625: de ahí, el siguiente paso sube.
    expect(stepZoom(5 / 2.625, 1, 1, 2.625)).toBeCloseTo(8 / 2.625);
  });
});
