import { describe, expect, it } from 'vitest';
import { GEAR } from '../data/items';
import type { ItemIcon } from '../core/model';
import { itemFrames, itemIcon, rackIcon } from './items';
import { LEGENDS } from './legendaries';
import { GRIDS } from './itemGrids';
import { FRAMES } from './legendaries';
import { renderPortrait } from './portraits/portrait';
import { renderHero } from './heroes/hero';
import { generateLook } from './heroes/look';

const ICONS = Object.keys(GRIDS) as ItemIcon[];
const sig = (b: { data: Uint32Array }) => b.data.join();

describe('iconos del equipo', () => {
  it('a 16 (y 32), en rejillas de 14 × 14, distintos por rareza', () => {
    for (const i of ICONS) {
      for (const r of GRIDS[i]) expect(r).toHaveLength(14);
      expect(GRIDS[i]).toHaveLength(14);
      const all = ([0, 1, 2] as const).map((r) => itemIcon(i, r));
      for (const b of all) expect([b.w, b.h]).toEqual([16, 16]);
      expect(new Set(all.map(sig)).size).toBe(3);
      expect(itemIcon(i, 0, 0, undefined, 32).w).toBe(32);
      expect(rackIcon(i, 2).w).toBe(14);
    }
  });

  it('cada legendario del botín tiene su dibujo propio', () => {
    for (const g of GEAR.filter((x) => x.rarity === 2)) {
      expect(LEGENDS[g.name], g.name).toBeDefined();
      expect(sig(itemIcon(g.icon!, 2, 0, g.name))).not.toBe(sig(itemIcon(g.icon!, 2)));
    }
  });

  it('épicos y legendarios se animan; los demás, quietos', () => {
    expect(itemFrames('espada', 0)).toHaveLength(1);
    expect(itemFrames('espada', 1)).toHaveLength(1);
    const f = itemFrames('espada', 2, 0, 'Hoja de Vadoverde');
    expect(f).toHaveLength(FRAMES);
    expect(new Set(f.map(sig)).size).toBeGreaterThan(1);
  });
});

describe('el equipo puesto', () => {
  const look = { ...generateLook('g1', 'guerrero', 'm'), headgear: 'sombrero' as const };
  const one = [{ icon: 'espada' as const, rarity: 1 as const }];
  const three = [
    ...one,
    { icon: 'coraza' as const, rarity: 1 as const },
    { icon: 'amuleto' as const, rarity: 1 as const },
  ];

  it('se ven las tres piezas, no solo una', () => {
    expect(sig(renderPortrait(look, { gear: three }))).not.toBe(
      sig(renderPortrait(look, { gear: one })),
    );
    expect(sig(renderHero(look, { gear: three }))).not.toBe(sig(renderHero(look, { gear: one })));
  });

  it('la corona va en lugar del sombrero', () => {
    const crown = [
      { icon: 'amuleto' as const, rarity: 2 as const, unique: 'Corona del Rey Ahogado' },
    ];
    const bare = { ...look, headgear: null };
    expect(sig(renderPortrait(look, { gear: crown }))).toBe(
      sig(renderPortrait(bare, { gear: crown })),
    );
    expect(sig(renderHero(look, { gear: crown }))).toBe(sig(renderHero(bare, { gear: crown })));
    expect(sig(renderPortrait(bare, { gear: crown }))).not.toBe(sig(renderPortrait(bare)));
  });

  it('las peleas guardadas (una sola pieza) se siguen dibujando', () => {
    expect(renderPortrait(look, { gear: { icon: 'hacha', rarity: 0 } }).w).toBe(40);
  });
});
