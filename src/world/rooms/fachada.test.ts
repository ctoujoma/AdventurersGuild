import { describe, expect, it } from 'vitest';
import { uncleBuilding } from '../../core/rooms';
import { ROOFS, WALLS, type RoofId, type WallId } from '../../data/custom';
import { roomsLayout } from './layout';
import { facade, outerSide, roofTiles } from './textures';

const L = roomsLayout(uncleBuilding());
const crest = { field: '#124e89', dark: '#262b44', symbol: 'llave' };
const pixels = (look: Parameters<typeof facade>[1] = {}, c = crest) =>
  facade(L, look, c).buf.data.join(',');

describe('fachada por partes', () => {
  it('sin elegir nada, la fachada es la de siempre (teja, tablas y el tablero)', () => {
    expect(pixels({})).toBe(pixels({ roof: 'teja', walls: 'tablas', sign: 'tablero' }));
    expect(roofTiles(40, 's').data.join()).toBe(roofTiles(40, 's', 'teja').data.join());
  });

  it('cada tejado y cada pared se ven distintos', () => {
    const roofs = (Object.keys(ROOFS) as RoofId[]).map((r) => roofTiles(40, 's', r).data.join());
    expect(new Set(roofs).size).toBe(roofs.length);
    const gables = (Object.keys(ROOFS) as RoofId[]).map((roof) => pixels({ roof }));
    expect(new Set(gables).size).toBe(gables.length);
    const walls = (Object.keys(WALLS) as WallId[]).map((walls) => pixels({ walls }));
    expect(new Set(walls).size).toBe(walls.length);
    const sides = (Object.keys(WALLS) as WallId[]).map((w) =>
      outerSide('madera', 106, false, 's', 1, w).data.join(),
    );
    expect(new Set(sides).size).toBe(sides.length);
  });

  it('el escudo pintado y las jardineras cambian el hastial', () => {
    expect(pixels({ sign: 'pintado' })).not.toBe(pixels({}));
    expect(pixels({ boxes: true })).not.toBe(pixels({}));
  });
});
