import { describe, expect, it } from 'vitest';
import { ATLAS_W } from './crowd';

describe('atlas de la gente', () => {
  it('cabe en una textura de cualquier móvil (4096 px de ancho)', () => {
    expect(ATLAS_W).toBeLessThanOrEqual(4096);
  });
});
