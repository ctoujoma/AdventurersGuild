import { describe, expect, it } from 'vitest';
import { buildWorld } from './build';
import { Camera } from './camera';
import { B, ROOMS, WORLD_H, WORLD_W, capacity, hotspots, layout, sickbeds } from './geometry';

describe('geometría y mejoras', () => {
  it('pinta tantas camas como capacidad tienen los dormitorios y caben en el cuarto', () => {
    for (const dorm of [1, 2, 3]) {
      const l = layout({ dorm, enf: 0, tab: 1, mapas: 0, arm: 0, cap: 0 });
      expect(l.bunks.length * 2).toBe(capacity(dorm));
      expect(Math.max(...l.bunks) + 24).toBeLessThanOrEqual(ROOMS.dorm.x1);
    }
  });

  it('sin enfermería los heridos van a las literas', () => {
    expect(
      sickbeds({ dorm: 1, enf: 0, tab: 1, mapas: 0, arm: 0, cap: 0 }).every(
        (b) => b.kind === 'litera',
      ),
    ).toBe(true);
    expect(sickbeds({ dorm: 1, enf: 2, tab: 1, mapas: 0, arm: 0, cap: 0 })).toHaveLength(2);
  });

  it('la sala mejora con el nivel de la taberna', () => {
    const l1 = layout({ dorm: 1, enf: 0, tab: 1, mapas: 0, arm: 0, cap: 0 });
    const l3 = layout({ dorm: 1, enf: 0, tab: 3, mapas: 0, arm: 0, cap: 0 });
    expect(l3.tables.length).toBeGreaterThan(l1.tables.length);
    expect(l3.trophy && l3.lute && l3.chandelier && l3.tablecloths).toBe(true);
    expect(layout({ dorm: 1, enf: 0, tab: 0, mapas: 0, arm: 0, cap: 0 }).fire).toBe('apagado');
  });

  it('todos los puntos interactivos están dentro del mundo', () => {
    for (const h of hotspots({ dorm: 3, enf: 3, tab: 3, mapas: 2, arm: 2, cap: 2 })) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.x + h.w).toBeLessThanOrEqual(WORLD_W);
      expect(h.y + h.h).toBeLessThanOrEqual(WORLD_H);
    }
  });
});

describe('buildWorld', () => {
  it('construye las capas para todos los niveles sin fallar', () => {
    for (const lvl of [0, 1, 2, 3, 4]) {
      const w = buildWorld(
        {
          dorm: Math.min(3, lvl),
          enf: Math.min(3, lvl),
          tab: lvl,
          mapas: Math.min(2, lvl),
          arm: Math.min(2, lvl),
          cap: Math.min(2, lvl),
        },
        lvl * 2,
        4,
      );
      expect(w.back.w).toBe(WORLD_W);
      expect(w.back.h).toBe(WORLD_H);
      expect(w.front.countFilled()).toBeGreaterThan(100);
      // El edificio está pintado (el interior no queda transparente).
      expect(w.back.get(ROOMS.hall.x0 + 10, ROOMS.hall.y0 + 10) >>> 24).toBe(255);
      expect(w.back.get(B.left + 2, 250) >>> 24).toBe(255);
    }
  });

  it('las mejoras añaden luces y la chimenea se enciende', () => {
    const poor = buildWorld({ dorm: 0, enf: 0, tab: 0, mapas: 0, arm: 0, cap: 0 }, 0, 0);
    const rich = buildWorld({ dorm: 3, enf: 3, tab: 3, mapas: 2, arm: 2, cap: 2 }, 6, 6);
    expect(rich.lights.length).toBeGreaterThan(poor.lights.length);
    expect(poor.fire.level).toBe('apagado');
    expect(rich.fire.level).toBe('grande');
  });
});

describe('Camera', () => {
  it('no se sale del mundo', () => {
    const c = new Camera();
    c.setView(400, 600, 2);
    c.centerOn(-500, -500, false);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    c.centerOn(5000, 5000, false);
    expect(c.x + c.vw).toBe(WORLD_W);
    expect(c.y + c.vh).toBe(WORLD_H);
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
