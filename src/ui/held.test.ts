import { describe, expect, it } from 'vitest';
import { Held } from './held';

describe('lo que espera a que se cierre lo abierto', () => {
  it('sin nada abierto sale ya; con algo abierto, al cerrarlo y en orden', () => {
    const h = new Held();
    const seen: string[] = [];
    h.when(false, () => seen.push('ya'));
    expect(seen).toEqual(['ya']);
    h.when(true, () => seen.push('cobro'));
    h.when(true, () => seen.push('jefe'));
    expect(seen).toEqual(['ya']);
    expect(h.waiting).toBe(2);
    h.free();
    expect(seen).toEqual(['ya', 'cobro', 'jefe']);
    h.free();
    expect(seen).toHaveLength(3);
  });
});
