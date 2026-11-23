import { describe, expect, it } from 'vitest';
import { HEADINGS } from '../core/expedition';
import { fogBuffer } from './expFog';
import { expPoint, maxDist } from './expGeo';
import { OX, OY, WORLD_H, WORLD_W, markBuffer, trailBuffer, worldBuffer } from './expMap';
import { worldTerrain } from './expTerrain';
import { colorMap } from './mapColor';
import { inkMap } from './mapInk';
import { SEA, terrain } from './mapTerrain';

describe('mapa de rumbos', () => {
  it('ningún camino de rumbo (ni sus parajes) cae en el mar', () => {
    const t = worldTerrain();
    for (const h of HEADINGS)
      for (let d = 0; d <= maxDist(h); d += 0.1)
        for (const side of [-1, 0, 1]) {
          const p = expPoint(h, d, side);
          const i = t.at(Math.round(p.x - OX), Math.round(p.y - OY));
          expect(t.water[i], `${h} ${d.toFixed(1)} ${side}`).not.toBe(SEA);
        }
  });

  it('la comarca va dentro tal cual', () => {
    const t = worldTerrain();
    const c = terrain();
    expect([t.W, t.H]).toEqual([WORLD_W, WORLD_H]);
    for (const [x, y] of [
      [0, 0],
      [120, 200],
      [399, 279],
      [250, 30],
    ] as const) {
      expect(t.water[t.at(x, y)]).toBe(c.water[c.at(x, y)]);
      expect(t.h[t.at(x, y)]).toBe(c.h[c.at(x, y)]);
    }
  });

  it('los dos estilos pintan el mapa entero y la comarca no cambia', () => {
    const ink = inkMap().data.slice();
    const color = colorMap().data.slice();
    for (const s of ['pergamino', 'color'] as const) {
      const b = worldBuffer(s);
      expect([b.w, b.h]).toEqual([WORLD_W, WORLD_H]);
      expect(b.data.every((c) => c >>> 24 === 255)).toBe(true);
    }
    expect(inkMap().data).toEqual(ink);
    expect(colorMap().data).toEqual(color);
  });

  it('la niebla deja despejada la comarca y tapa lo lejano', () => {
    for (const s of ['pergamino', 'color'] as const) {
      const f = fogBuffer([], s, 3);
      expect(f.get(OX + 200, OY + 140) >>> 24).toBe(0);
      expect(f.get(60, 60) >>> 24).toBe(255);
    }
  });

  it('la estela y las marcas se pintan', () => {
    const tr = trailBuffer([{ h: 'bosque', dist: 3, now: true }], 'color');
    expect(tr.data.some((c) => c >>> 24)).toBe(true);
    const kinds = ['cofre', 'cueva', 'mina', 'torre', 'ruinas', 'santuario', 'mercader'];
    for (const k of [...kinds, 'viajero', 'campamento', 'fardo', 'oso'])
      expect(markBuffer(k, 'pergamino').data.some((c) => c >>> 24)).toBe(true);
  });
});
