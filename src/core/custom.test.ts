import { describe, expect, it } from 'vitest';
import { DEFAULT_NAME, DISHES, DOG_DEFENSE, DOG_PRICE, STAFF, sealInitial } from '../data/custom';
import { customOf, endDay, newGame, reduce, salaries } from './game';
import type { GameState } from './model';
import { defense } from './raids';

const rich = (seed: string): GameState => ({ ...newGame(seed), gold: 500 });

describe('tu taberna', () => {
  it('nombre por defecto, recortado y nunca vacío', () => {
    let s = newGame('nombre');
    expect(customOf(s).name).toBe(DEFAULT_NAME);
    s = reduce(s, { type: 'custom', patch: { name: '  La Oca Dorada  ' } });
    expect(customOf(s).name).toBe('La Oca Dorada');
    s = reduce(s, { type: 'custom', patch: { name: 'x'.repeat(60) } });
    expect(customOf(s).name.length).toBe(24);
    s = reduce(s, { type: 'custom', patch: { name: '   ' } });
    expect(customOf(s).name).toBe(DEFAULT_NAME);
    s = reduce(s, { type: 'custom', patch: { color: 'mar', symbol: 'dragon' } });
    expect(customOf(s)).toMatchObject({ color: 'mar', symbol: 'dragon' });
  });

  it('el lacre lleva la inicial de la primera palabra que no es artículo', () => {
    expect(sealInitial('El Jarro Partido')).toBe('J');
    expect(sealInitial('la oca dorada')).toBe('O');
    expect(sealInitial('Cuervo')).toBe('C');
  });

  it('contratar cuesta la entrada y suma salario; despedir no devuelve nada', () => {
    let s = rich('personal');
    const base = salaries(s);
    s = reduce(s, { type: 'staff', id: 'bardo', on: true });
    expect(s.gold).toBe(500 - STAFF.bardo.fee);
    expect(salaries(s)).toBe(base + STAFF.bardo.salary);
    expect(reduce(s, { type: 'staff', id: 'bardo', on: true })).toBe(s);
    s = reduce(s, { type: 'staff', id: 'bardo', on: false });
    expect(customOf(s).staff).toEqual([]);
    expect(s.gold).toBe(500 - STAFF.bardo.fee);
    const poor = { ...newGame('pobre'), gold: 5 };
    expect(reduce(poor, { type: 'staff', id: 'mozo', on: true })).toBe(poor);
  });

  it('el bardo trae 8 monedas al día', () => {
    const s = rich('bardo');
    s.fac.tab = 1;
    const withBard = reduce(s, { type: 'staff', id: 'bardo', on: true });
    const a = endDay({ ...withBard, gold: s.gold });
    const b = endDay(s);
    expect(a.gold - b.gold).toBe(8);
  });

  it('el mozo acelera la curación', () => {
    const s = rich('mozo');
    const h = s.heroes[0]!;
    h.status = 'herido';
    h.days = 4;
    const withMozo = reduce(s, { type: 'staff', id: 'mozo', on: true });
    const healed = (x: GameState) => x.heroes.find((y) => y.id === h.id)!.days;
    expect(healed(endDay(withMozo))).toBe(healed(endDay(s)) - 1);
  });

  it('el plato de la casa cuesta y anima (el doble con cocinera)', () => {
    const s = rich('plato');
    for (const h of s.heroes) h.morale = 10;
    const morale = (x: GameState) => x.heroes[0]!.morale;
    const plain = endDay(s);
    const stew = endDay(reduce(s, { type: 'custom', patch: { dish: 'guiso' } }));
    expect(morale(stew) - morale(plain)).toBe(DISHES.guiso.morale);
    expect(plain.gold - stew.gold).toBe(DISHES.guiso.cost);
    let cook = reduce(s, { type: 'custom', patch: { dish: 'guiso' } });
    cook = reduce(cook, { type: 'staff', id: 'cocinera', on: true });
    expect(morale(endDay(cook)) - morale(plain)).toBe(DISHES.guiso.morale * 2);
  });

  it('el perro guardián se compra una vez y defiende', () => {
    const s = rich('perro');
    const d = defense(s);
    const t = reduce(s, { type: 'buyDog' });
    expect(t.gold).toBe(500 - DOG_PRICE);
    expect(defense(t)).toBe(d + DOG_DEFENSE);
    expect(reduce(t, { type: 'buyDog' })).toBe(t);
  });
});
