import { describe, expect, it } from 'vitest';
import { packUnits } from '../core/combat';
import { BOSSES } from './bosses';
import { expRival, minionsAt } from './rivales';

describe('esbirros de cada jefe', () => {
  it('los guardianes y los grandes traen los suyos con la lejanía; los demás, ninguno', () => {
    const colmillo = expRival('bosque', 0, 0);
    expect(colmillo.minion).toBe('lobo');
    expect([3, 6, 9].map((d) => minionsAt(colmillo, d))).toEqual([0, 1, 2]);
    expect(minionsAt(expRival('bosque', 0), 12)).toBe(0);
    expect(expRival('bosque', 3).minion).toBe('lobo');
    expect(expRival('bosque', 0, 1).minion).toBe('jabato');
  });

  it('el Rey Ahogado, segundo guardián de las marismas, siempre con dos ahogados', () => {
    const rey = expRival('marismas', 0, 1);
    expect(rey).toMatchObject({ engine: 'ahogado', minion: 'ahogado' });
    expect(minionsAt(rey, 1)).toBe(2);
    expect(BOSSES.ahogado.minion).toBe('ahogado');
  });

  it('los esbirros son unidades aparte, más flojas, detrás del jefe', () => {
    const u = packUnits('bestia', 10, 1, 2);
    expect(u.map((x) => x.id)).toEqual(['jefe', 'esbirro-0', 'esbirro-1']);
    expect(u[1]!.kind).toBe('esbirro');
    expect(u[1]!.max).toBeLessThan(u[0]!.max);
    expect(packUnits('bestia', 10, 1, 0)[0]!.max).toBeGreaterThan(u[0]!.max);
  });
});
