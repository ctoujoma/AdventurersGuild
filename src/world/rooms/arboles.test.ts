import { describe, expect, it } from 'vitest';
import { bushCnc, oakCnc, pineCnc } from './arboles';

describe('árboles (luz con ambiente)', () => {
  it('salen siempre iguales con la misma semilla y con relieve', () => {
    for (const f of [pineCnc, oakCnc, bushCnc]) {
      const a = f('x');
      expect(a.data).toEqual(f('x').data);
      expect(a.relief).not.toBeNull();
    }
  });

  it('dos abetos de semilla distinta no son iguales', () => {
    expect(pineCnc('a', 80).data).not.toEqual(pineCnc('b', 80).data);
  });
});
