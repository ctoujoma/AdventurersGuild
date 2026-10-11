import { describe, expect, it } from 'vitest';
import { validateGrid } from '../sprite';
import { BASE, BEARD, BODY_W, HAIR, HATS, HELMS, OUTFITS, OVERLAYS, WEAPONS } from './layers';
import { SPRITE_H, SPRITE_W, generateLook, renderHero } from './hero';

// Todos los caracteres que pueden usar las capas de héroes.
const SLOTS = Object.fromEntries([...'xXhHcCaAmMoOenrvVgGyYkw'].map((ch) => [ch, '#000000']));

describe('capas de héroes', () => {
  const layers = {
    BASE,
    BEARD,
    ...Object.fromEntries(Object.entries(OUTFITS).map(([k, g]) => [`outfit:${k}`, g])),
    ...Object.fromEntries(Object.entries(HAIR).map(([k, g]) => [`hair:${k}`, g])),
    ...Object.fromEntries(Object.entries(HATS).map(([k, g]) => [`hat:${k}`, g])),
    ...Object.fromEntries(Object.entries(HELMS).map(([k, g]) => [`helm:${k}`, g])),
    ...Object.fromEntries(Object.entries(WEAPONS).map(([k, g]) => [`weapon:${k}`, g])),
    ...Object.fromEntries(Object.entries(OVERLAYS).map(([k, g]) => [`overlay:${k}`, g])),
  };

  for (const [name, grid] of Object.entries(layers)) {
    it(`${name} tiene filas de ${BODY_W} y colores conocidos`, () => {
      expect(validateGrid(grid, SLOTS, BODY_W)).toEqual([]);
    });
  }

  it('los trajes cubren las 22 filas del cuerpo', () => {
    for (const grid of Object.values(OUTFITS)) expect(grid).toHaveLength(BASE.length);
  });
});

describe('generateLook', () => {
  it('es determinista por semilla', () => {
    expect(generateLook('brom', 'guerrero', 'm')).toEqual(generateLook('brom', 'guerrero', 'm'));
  });

  it('genera variedad', () => {
    const looks = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(generateLook(`h${i}`, 'mago', 'f'))),
    );
    expect(looks.size).toBeGreaterThan(20);
  });

  it('solo los hombres llevan barba', () => {
    for (let i = 0; i < 50; i++) expect(generateLook(`f${i}`, 'picaro', 'f').beard).toBe(false);
  });
});

describe('renderHero', () => {
  it('produce un sprite contorneado del tamaño esperado', () => {
    const sprite = renderHero(generateLook('lysa', 'picaro', 'f'), { injured: true });
    expect(sprite.w).toBe(SPRITE_W);
    expect(sprite.h).toBe(SPRITE_H);
    expect(sprite.data.filter(Boolean).length).toBeGreaterThan(150);
  });

  it('el parche cambia el sprite', () => {
    const look = generateLook('brom', 'guerrero', 'm');
    const a = renderHero(look).data.join();
    const b = renderHero(look, { eyepatch: true }).data.join();
    expect(a).not.toBe(b);
  });
});
