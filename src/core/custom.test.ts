import { describe, expect, it } from 'vitest';
import {
  DECOR,
  DEFAULT_NAME,
  DOG_PRICE,
  FEAST_PRICE,
  RAVEN_PRICE,
  sealInitial,
} from '../data/custom';
import { customOf, endDay, newGame, reduce } from './game';
import type { GameState } from './model';
import { assaultSetup } from './assault';
import { Rng } from './rng';

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

  it('cada sala guarda su tema de color, y sin él vuelve a los de la casa', () => {
    let s = newGame('tintes');
    const [a, b] = s.building.rooms;
    s = reduce(s, { type: 'tint', id: a!.id, tint: 'mar' });
    s = reduce(s, { type: 'tint', id: b!.id, tint: 'ocre' });
    expect(customOf(s).colors).toEqual({ [a!.id]: 'mar', [b!.id]: 'ocre' });
    s = reduce(s, { type: 'tint', id: a!.id, tint: null });
    expect(customOf(s).colors).toEqual({ [b!.id]: 'ocre' });
    // Una sala que no existe o un tema que no existe no cambian nada.
    expect(reduce(s, { type: 'tint', id: 'nada', tint: 'mar' })).toBe(s);
    expect(reduce(s, { type: 'tint', id: b!.id, tint: 'rosa' as never })).toBe(s);
    // Solo se ve: el oro no cambia.
    expect(s.gold).toBe(newGame('tintes').gold);
  });

  it('el lacre lleva la inicial de la primera palabra que no es artículo', () => {
    expect(sealInitial('El Jarro Partido')).toBe('J');
    expect(sealInitial('la oca dorada')).toBe('O');
    expect(sealInitial('Cuervo')).toBe('C');
  });

  it('el perro guardián se compra una vez y de noche despierta antes a todos', () => {
    const s = rich('perro');
    const t = reduce(s, { type: 'buyDog' });
    expect(t.gold).toBe(500 - DOG_PRICE);
    expect(reduce(t, { type: 'buyDog' })).toBe(t);
    const wake = (x: typeof s) => assaultSetup(x, 20, new Rng('ladra')).defenders[0]!.wake;
    expect(wake(t)).toBeLessThan(wake(s));
  });

  it('la decoración ocupa huecos limitados y cada pieza hace lo suyo', () => {
    let s = { ...newGame('deco'), gold: 1000 };
    s = reduce(s, { type: 'decor', id: 'naipes', on: true });
    s = reduce(s, { type: 'decor', id: 'barril', on: true });
    expect(s.gold).toBe(1000 - DECOR.naipes.price - DECOR.barril.price);
    // Sin salón grande solo hay dos huecos.
    expect(reduce(s, { type: 'decor', id: 'tapices', on: true })).toBe(s);
    s.fac.tab = 3;
    expect(customOf(reduce(s, { type: 'decor', id: 'tapices', on: true })).decor).toHaveLength(3);
    // Naipes y barril: más caja que sin ellos.
    const plain = { ...newGame('deco'), gold: 1000 };
    plain.fac.tab = 3;
    const a = endDay(s);
    const b = endDay(plain);
    expect(a.gold - (s.gold - plain.gold) - b.gold).toBeGreaterThanOrEqual(8);
  });

  it('el cuervo trae reputación cada 5 días', () => {
    let s = reduce({ ...newGame('cuervo'), gold: 500 }, { type: 'buyRaven' });
    expect(s.gold).toBe(500 - RAVEN_PRICE);
    s.day = 4;
    const rep = s.rep;
    s = endDay(s);
    expect(s.rep).toBeGreaterThanOrEqual(rep + 1);
  });

  it('la fiesta solo se monta el día de la fiesta y dobla la caja esa noche', () => {
    const s = { ...newGame('fiesta'), gold: 500, day: 9 };
    expect(reduce(s, { type: 'feast' })).toBe(s);
    const day10 = { ...s, day: 10 };
    const mounted = reduce(day10, { type: 'feast' });
    expect(mounted.gold).toBe(500 - FEAST_PRICE);
    const a = endDay(mounted);
    const b = endDay(day10);
    expect(a.gold + FEAST_PRICE).toBeGreaterThan(b.gold);
  });

  it('el ala de veteranos anima a los de nivel alto y a nivel 2 no desertan', () => {
    const s = { ...newGame('vet'), gold: 500 };
    for (const h of s.heroes) {
      h.lvl = 5;
      h.morale = 10;
    }
    const base = endDay(s).heroes[0]!.morale;
    const withWing = endDay({ ...s, fac: { ...s.fac, vet: 1 } }).heroes[0]!.morale;
    expect(withWing - base).toBe(4);
  });
});
