import { describe, expect, it } from 'vitest';
import { generateLook, type OutfitId } from '../heroes/look';
import * as parts from './parts';
import { PORTRAIT_H, PORTRAIT_W, renderPortrait } from './portrait';

const isPart = (v: unknown): v is parts.Part =>
  Array.isArray(v) && v.every((s) => Array.isArray(s) && s.length === 3);

describe('piezas de retrato', () => {
  const all: [string, parts.Part][] = [];
  for (const [name, value] of Object.entries(parts)) {
    if (isPart(value)) all.push([name, value]);
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) if (isPart(v)) all.push([`${name}.${k}`, v]);
    }
  }

  it('hay piezas de todos los tipos', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  for (const [name, part] of all) {
    it(`${name} cabe en la rejilla de ${parts.W}×${parts.H}`, () => {
      expect(() => parts.toGrid(part)).not.toThrow();
    });
  }
});

describe('renderPortrait', () => {
  const outfits: OutfitId[] = ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador', 'tabernero'];

  it('pinta retratos completos para todas las clases y marcas', () => {
    for (const o of outfits) {
      for (const sex of ['m', 'f'] as const) {
        const p = renderPortrait(generateLook(`${o}-${sex}`, o, sex), {
          injured: true,
          eyepatch: true,
        });
        expect(p.w).toBe(PORTRAIT_W);
        expect(p.h).toBe(PORTRAIT_H);
      }
    }
  });

  it('es determinista y el parpadeo cierra los ojos', () => {
    const look = generateLook('isolde', 'mago', 'f');
    expect(renderPortrait(look).data.join()).toBe(renderPortrait({ ...look }).data.join());
    expect(renderPortrait(look, {}, true).data.join()).not.toBe(renderPortrait(look).data.join());
  });
});
