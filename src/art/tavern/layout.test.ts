import { describe, expect, it } from 'vitest';
import { capacity, sickbeds, tavernLayout } from './layout';

describe('tavernLayout', () => {
  it('pinta tantas camas como capacidad tienen los dormitorios', () => {
    for (const dorm of [1, 2, 3]) {
      const l = tavernLayout({ dorm, enf: 0, tab: 1 });
      expect(l.bunks.length * 2).toBe(capacity(dorm));
    }
  });

  it('las literas caben en el dormitorio (x de 14 a 102)', () => {
    const l = tavernLayout({ dorm: 3, enf: 0, tab: 1 });
    expect(Math.max(...l.bunks) + 18).toBeLessThanOrEqual(102);
  });

  it('la enfermería cerrada no tiene camillas y los heridos van a las literas', () => {
    expect(tavernLayout({ dorm: 1, enf: 0, tab: 1 }).cots).toEqual([]);
    expect(sickbeds({ dorm: 1, enf: 0, tab: 1 }).every((b) => b.kind === 'litera')).toBe(true);
    expect(sickbeds({ dorm: 1, enf: 2, tab: 1 })).toHaveLength(2);
  });

  it('la sala mejora con el nivel de la taberna', () => {
    const l1 = tavernLayout({ dorm: 1, enf: 0, tab: 1 });
    const l3 = tavernLayout({ dorm: 1, enf: 0, tab: 3 });
    expect(l3.tables.length).toBeGreaterThan(l1.tables.length);
    expect(l1.trophy).toBe(false);
    expect(l3.trophy && l3.banner && l3.tablecloths).toBe(true);
    expect(tavernLayout({ dorm: 1, enf: 0, tab: 0 }).fire).toBe('apagado');
  });
});
