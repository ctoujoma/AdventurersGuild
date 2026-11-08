import { describe, expect, it } from 'vitest';
import { CACHE_GRUDGE, REFUSE_GRUDGE } from './balance';
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

  it('negar el caché pesa más, se acumula y se pasa al pagarle lo siguiente', () => {
    let s = newGame('cache');
    const id = s.heroes[0]!.id;
    s.heroes[0]!.lvl = 5;
    s.heroes[0]!.request = 'cache';
    s = reduce(s, { type: 'answer', id, yes: false });
    expect(s.heroes[0]!.grudge?.cap).toBe(CACHE_GRUDGE.cap);
    s.heroes[0]!.request = 'raise';
    s = reduce(s, { type: 'answer', id, yes: false });
    expect(s.heroes[0]!.grudge?.cap).toBe(CACHE_GRUDGE.cap + REFUSE_GRUDGE.cap);
    s.heroes[0]!.request = 'raise';
    s = reduce(s, { type: 'answer', id, yes: true });
    expect(s.heroes[0]!.grudge).toBeUndefined();
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
