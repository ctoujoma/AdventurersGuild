import { describe, expect, it } from 'vitest';
import { attr, chance, estimate, skill, type Member } from './party';

const brom: Member = {
  cls: 'guerrero',
  lvl: 3,
  attrs: { F: 7, D: 4, M: 2 },
  traits: [{ id: 'valiente' }, { id: 'bebedor' }, { id: 'tuerto' }],
};
const lysa: Member = {
  cls: 'picaro',
  lvl: 2,
  attrs: { F: 3, D: 7, M: 5 },
  traits: [{ id: 'codicioso' }, { id: 'afortunado' }],
};

describe('habilidades', () => {
  it('aplica los rasgos a los atributos', () => {
    expect(attr(brom, 'D')).toBe(2);
    expect(attr(brom, 'F')).toBe(7);
  });

  it('pondera atributos por clase y suma nivel y rasgos', () => {
    // (2·7 + 1·2) / 2 = 8, +2 por nivel, +2 valiente, +1 tuerto.
    expect(skill(brom, 'Combate')).toBe(13);
    // (2·7 + 1·5) / 2 = 9.5 → 10, +1 por nivel.
    expect(skill(lysa, 'Trampas')).toBe(11);
  });

  it('ignora los rasgos ocultos salvo que se pidan', () => {
    const maren: Member = {
      cls: 'clerigo',
      lvl: 2,
      attrs: { F: 4, D: 3, M: 6 },
      traits: [{ id: 'supersticioso', hidden: true }],
    };
    expect(skill(maren, 'Arcano')).toBe(6);
    expect(skill(maren, 'Arcano', true)).toBe(4);
  });
});

describe('estimación', () => {
  it('acota la probabilidad de cada desafío', () => {
    expect(chance(0, 30)).toBe(0.05);
    expect(chance(30, 0)).toBe(0.95);
    expect(chance(10, 10)).toBe(0.5);
  });

  it('sin grupo no hay opciones', () => {
    const e = estimate([{ skill: 'Combate', diff: 7 }], []);
    expect(e.total).toBe(0);
    expect(e.level).toBe(3);
  });

  it('suma la fuerza del grupo y multiplica las probabilidades', () => {
    const e = estimate(
      [
        { skill: 'Combate', diff: 13 },
        { skill: 'Trampas', diff: 9 },
      ],
      [brom, lysa],
    );
    expect(e.rows.map((r) => r.power)).toEqual([13 + 6, 3 + 11]);
    expect(e.total).toBeCloseTo(e.rows[0]!.p * e.rows[1]!.p);
    expect(e.level).toBe(0);
  });

  it('un gafe conocido empeora las tiradas', () => {
    const nim: Member = {
      cls: 'explorador',
      lvl: 1,
      attrs: { F: 3, D: 7, M: 4 },
      traits: [{ id: 'gafe' }],
    };
    const c = [{ skill: 'Combate' as const, diff: 12 }];
    const withJinx = estimate(c, [brom, nim]).rows[0]!.p;
    const hidden = estimate(c, [brom, { ...nim, traits: [{ id: 'gafe', hidden: true }] }]).rows[0]!
      .p;
    expect(withJinx).toBeLessThan(hidden);
  });
});
