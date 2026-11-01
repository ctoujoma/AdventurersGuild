import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W, PLACE_INFO } from '../data/places';
import { colorMap } from './mapColor';
import { inkMap } from './mapInk';
import { SEA, at, terrain } from './mapTerrain';

describe('mapa de la comarca', () => {
  it('ningún lugar cae en el mar', () => {
    const t = terrain();
    for (const [name, p] of Object.entries(PLACE_INFO))
      expect(t.water[at(p.x, p.y)], name).not.toBe(SEA);
  });

  it('las dos versiones pintan el mapa entero', () => {
    for (const b of [inkMap(), colorMap()]) {
      expect([b.w, b.h]).toEqual([MAP_W, MAP_H]);
      expect(b.data.every((c) => c >>> 24 === 255)).toBe(true);
    }
  });
});
