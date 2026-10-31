import { describe, expect, it } from 'vitest';
import { validateGrid } from '../sprite';
import { BASE, BEARD, BODY_W, HAIR, HATS, HELMS, OUTFITS, OVERLAYS, WEAPONS } from './layers';
import {
  SIDE_ARM,
  SIDE_BASE,
  SIDE_BEARD,
  SIDE_HAIR,
  SIDE_HATS,
  SIDE_HELMS,
  SIDE_LEGS,
  SIDE_ROBE,
  SIDE_TORSO,
  SIDE_WEAPONS,
} from './layersSide';
import { SPRITE_H, SPRITE_W, generateLook, heroSprites, renderHero } from './hero';

// Todos los caracteres que pueden usar las capas de héroes.
const SLOTS = Object.fromEntries(
  [...'xXhHcCaAmMoOenrvVgGyYkwpPqQzZbB'].map((ch) => [ch, '#000000']),
);

const named = (prefix: string, rec: Record<string, readonly string[] | undefined>) =>
  Object.fromEntries(Object.entries(rec).flatMap(([k, g]) => (g ? [[`${prefix}:${k}`, g]] : [])));

describe('capas de héroes', () => {
  const layers = {
    BASE,
    BEARD,
    SIDE_BASE,
    SIDE_BEARD,
    ...named('outfit', OUTFITS),
    ...named('hair', HAIR),
    ...named('hat', HATS),
    ...named('helm', HELMS),
    ...named('weapon', WEAPONS),
    ...named('overlay', OVERLAYS),
    ...named('side-torso', SIDE_TORSO),
    ...named('side-legs', SIDE_LEGS),
    ...named('side-robe', SIDE_ROBE),
    ...named('side-arm', SIDE_ARM),
    ...named('side-hair', SIDE_HAIR),
    ...named('side-hat', SIDE_HATS),
    ...named('side-helm', SIDE_HELMS),
    ...Object.fromEntries(
      Object.entries(SIDE_WEAPONS).flatMap(([k, w]) => [
        ...(w.back ? [[`side-weapon-back:${k}`, w.back]] : []),
        ...(w.front ? [[`side-weapon-front:${k}`, w.front]] : []),
      ]),
    ),
  };

  for (const [name, grid] of Object.entries(layers)) {
    it(`${name} tiene filas de ${BODY_W} y colores conocidos`, () => {
      expect(validateGrid(grid as readonly string[], SLOTS, BODY_W)).toEqual([]);
    });
  }
});

describe('generateLook', () => {
  it('es determinista por semilla', () => {
    expect(generateLook('brom', 'guerrero', 'm')).toEqual(generateLook('brom', 'guerrero', 'm'));
  });

  it('genera variedad', () => {
    const looks = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(generateLook(`h${i}`, 'mago', 'f'))),
    );
    expect(looks.size).toBeGreaterThan(30);
  });

  it('solo los hombres llevan barba', () => {
    for (let i = 0; i < 50; i++) expect(generateLook(`f${i}`, 'picaro', 'f').beard).toBe(false);
  });
});

describe('heroSprites', () => {
  const look = generateLook('lysa', 'picaro', 'f');

  it('produce todos los fotogramas con el tamaño esperado', () => {
    const s = heroSprites(look);
    for (const f of [...s.idle, s.blink, ...s.walk, s.cheer, s.stretch, s.yawn]) {
      expect(f.w).toBe(SPRITE_W);
      expect(f.h).toBe(SPRITE_H);
      expect(f.countFilled()).toBeGreaterThan(120);
    }
    expect(s.walk).toHaveLength(8);
    expect(s.sit.h).toBeLessThan(SPRITE_H);
  });

  it('el ciclo de paso cambia de fotograma a fotograma', () => {
    const s = heroSprites(look);
    for (let i = 0; i < s.walk.length; i++)
      expect(s.walk[i]!.data.join()).not.toBe(s.walk[(i + 1) % s.walk.length]!.data.join());
    // Los gestos de frente no son el de siempre.
    for (const g of [s.cheer, s.stretch, s.yawn])
      expect(g.data.join()).not.toBe(s.idle[0].data.join());
    expect(s.idle[0].data.join()).not.toBe(s.idle[1].data.join());
  });

  it('el parche cambia el sprite', () => {
    const brom = generateLook('brom', 'guerrero', 'm');
    expect(renderHero(brom).data.join()).not.toBe(renderHero(brom, { eyepatch: true }).data.join());
  });
});

describe('sastrería', () => {
  const look = generateLook('sastre', 'guerrero', 'm');
  const all = (l: typeof look, m = {}) => {
    const s = heroSprites(l, m);
    return [s.idle[0], ...s.walk, renderHero(l, m)].map((b) => b.data.join()).join('|');
  };

  it('el tinte cambia la ropa y cada prenda se ve, también con la coraza puesta', async () => {
    const { renderPortrait } = await import('../portraits/portrait');
    expect(all({ ...look, dye: 'mar' })).not.toBe(all(look));
    expect(renderPortrait({ ...look, dye: 'mar' }).data).not.toEqual(renderPortrait(look).data);
    const armor = { gear: { icon: 'coraza' as const, rarity: 0 as const } };
    for (const garment of ['capa', 'tabardo', 'faja', 'bufanda'] as const) {
      const g = { ...look, garment };
      expect(all(g), garment).not.toBe(all(look));
      expect(all(g, armor), `${garment} con coraza`).not.toBe(all(look, armor));
      expect(renderPortrait(g).data, garment).not.toEqual(renderPortrait(look).data);
    }
  });

  it('la piel no se tiñe', () => {
    const plain = heroSprites(look).idle[0];
    const dyed = heroSprites({ ...look, dye: 'mar' }).idle[0];
    // La cara (filas de la cabeza) es igual con y sin tinte.
    for (let y = 6; y < 13; y++)
      for (let x = 4; x < 14; x++) expect(dyed.get(x, y)).toBe(plain.get(x, y));
  });
});

describe('equipo visible', () => {
  it('el equipo cambia el sprite y el retrato, y la rareza también', async () => {
    const { renderPortrait } = await import('../portraits/portrait');
    const look = generateLook('equipado', 'guerrero', 'm');
    const plain = heroSprites(look);
    const sword = heroSprites(look, { gear: { icon: 'espada', rarity: 0 } });
    const gold = heroSprites(look, { gear: { icon: 'espada', rarity: 2 } });
    expect(sword.idle[0].data).not.toEqual(plain.idle[0].data);
    expect(sword.walk[0].data).not.toEqual(plain.walk[0].data);
    expect(gold.idle[0].data).not.toEqual(sword.idle[0].data);
    for (const icon of [
      'coraza',
      'capa',
      'amuleto',
      'espada',
      'hacha',
      'escudo',
      'varita',
    ] as const)
      expect(renderPortrait(look, { gear: { icon, rarity: 1 } }).data).not.toEqual(
        renderPortrait(look).data,
      );
  });
});
