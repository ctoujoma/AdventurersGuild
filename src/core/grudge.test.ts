import { describe, expect, it } from 'vitest';
import { CACHE, CACHE_OWED_MORALE, REFUSE_GRUDGE, VET_LEVEL } from './balance';
import { endDay, newGame, reduce } from './game';

describe('negar lo que piden', () => {
  it('negar un aumento deja rencor: su moral no sube del todo durante unos días', () => {
    let s = newGame('rencor');
    const id = s.heroes[0]!.id;
    s.heroes[0]!.request = 'raise';
    s = reduce(s, { type: 'answer', id, yes: false });
    const h = s.heroes.find((x) => x.id === id)!;
    expect(h.grudge).toEqual({ cap: REFUSE_GRUDGE.cap, until: s.day + REFUSE_GRUDGE.days });
    // Muy animado: la moral le va bajando hacia el tope.
    h.morale = 100;
    const next = endDay({ ...s, tips: ['*'] });
    expect(next.heroes.find((x) => x.id === id)!.morale).toBeLessThan(100);
  });

  it('el caché negado le quita moral mientras no se pague, y se puede pagar después', () => {
    let s = newGame('cache');
    const id = s.heroes[0]!.id;
    s.heroes[0]!.lvl = VET_LEVEL;
    s.heroes[0]!.cacheAt = VET_LEVEL;
    s.heroes[0]!.request = 'cache';
    s.heroes[0]!.morale = 80;
    const salary = s.heroes[0]!.salary;
    s = reduce(s, { type: 'answer', id, yes: false });
    expect(s.heroes[0]!.owed).toBe(CACHE[VET_LEVEL]);
    expect(s.heroes[0]!.morale).toBe(80 - CACHE_OWED_MORALE);
    expect(s.heroes[0]!.grudge).toBeUndefined();
    // No se pasa con los días: muy animado, va bajando hacia el tope.
    s.heroes[0]!.morale = 100;
    for (let i = 0; i < 3; i++) s = endDay({ ...s, tips: ['*'] });
    const h = s.heroes.find((x) => x.id === id)!;
    expect(h.owed).toBe(CACHE[VET_LEVEL]);
    expect(h.morale).toBeLessThan(100);
    // Pagarlo luego: sube el sueldo, se le pasa y recupera lo perdido.
    const before = h.morale;
    s = reduce(s, { type: 'payOwed', id });
    const p = s.heroes.find((x) => x.id === id)!;
    expect(p.owed).toBeUndefined();
    expect(p.salary).toBe(salary + CACHE[VET_LEVEL]!);
    expect(p.morale).toBe(Math.min(100, before + CACHE_OWED_MORALE));
  });

  it('se pasa con los días', () => {
    let s = newGame('pasa');
    const id = s.heroes[0]!.id;
    s.heroes[0]!.request = 'raise';
    s = reduce(s, { type: 'answer', id, yes: false });
    for (let i = 0; i <= REFUSE_GRUDGE.days; i++) s = endDay({ ...s, tips: ['*'] });
    expect(s.heroes.find((x) => x.id === id)?.grudge).toBeUndefined();
  });
});
