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
    for (const f of [...s.idle, s.blink, ...s.walk]) {
      expect(f.w).toBe(SPRITE_W);
      expect(f.h).toBe(SPRITE_H);
      expect(f.countFilled()).toBeGreaterThan(120);
    }
    expect(s.walk).toHaveLength(4);
    expect(s.sit.h).toBeLessThan(SPRITE_H);
  });

  it('el ciclo de paso cambia de fotograma a fotograma', () => {
    const s = heroSprites(look);
    expect(s.walk[0]!.data.join()).not.toBe(s.walk[1]!.data.join());
    expect(s.idle[0].data.join()).not.toBe(s.idle[1].data.join());
  });

  it('el parche cambia el sprite', () => {
    const brom = generateLook('brom', 'guerrero', 'm');
    expect(renderHero(brom).data.join()).not.toBe(renderHero(brom, { eyepatch: true }).data.join());
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
