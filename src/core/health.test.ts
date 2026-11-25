import { describe, expect, it } from 'vitest';
import { HP_GRAVE, HP_LIGHT, LIGHT_WORK_MIN } from './balance';
import { newGame, reduce } from './game';
import { healthOf, hpFromBedDays, setHp, workFactor } from './health';

describe('la vida que se guarda', () => {
  it('sano, leve y grave según la vida; grave es en cama', () => {
    const s = newGame('vida');
    const h = s.heroes[0]!;
    expect(healthOf(h)).toBe('sano');
    setHp(h, 0.4);
    expect(healthOf(h)).toBe('leve');
    expect(h.status).toBe('ok');
    setHp(h, 0.1);
    expect(healthOf(h)).toBe('grave');
    expect(h.status).toBe('herido');
  });

  it('el leve trabaja peor cuanto más herido, hasta la mitad al borde de grave', () => {
    const s = newGame('rinde');
    const h = s.heroes[0]!;
    setHp(h, HP_LIGHT);
    expect(workFactor(h)).toBe(1);
    setHp(h, (HP_LIGHT + HP_GRAVE) / 2);
    expect(workFactor(h)).toBeCloseTo((1 + LIGHT_WORK_MIN) / 2, 6);
    setHp(h, HP_GRAVE + 0.0001);
    expect(workFactor(h)).toBeCloseTo(LIGHT_WORK_MIN, 3);
  });

  it('el leve no hace guardia (y quien la hacía la deja hasta estar sano)', () => {
    const s = newGame('guardia');
    const h = s.heroes[0]!;
    h.guard = true;
    setHp(h, 0.3);
    expect(h.guard).toBeUndefined();
    expect(h.guardBefore).toBe(true);
    expect(reduce(s, { type: 'guard', id: h.id, on: true })).toBe(s);
  });

  it('las partidas de antes: los días de cama pasan a vida de grave', () => {
    expect(hpFromBedDays(1)).toBeLessThan(HP_GRAVE);
    expect(hpFromBedDays(4)).toBeLessThan(hpFromBedDays(2));
  });
});
