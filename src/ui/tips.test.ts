import { describe, expect, it } from 'vitest';
import { newGame, reduce } from '../core/game';
import { TIPS, nextTip } from './tips';

describe('notas del tío', () => {
  it('salen una vez cada una y se pueden apagar', () => {
    let s = newGame('tutorial');
    expect(nextTip(s)?.id).toBe('tablon');
    s = reduce(s, { type: 'tip', id: 'tablon' });
    expect(nextTip(s)?.id).not.toBe('tablon');
    s = reduce(s, { type: 'tip', id: '*' });
    expect(nextTip(s)).toBeNull();
  });

  it('el día 30, en la vista de salas, el tío explica las obras una a una', () => {
    let s = newGame('obras');
    s.tips = [...TIPS.filter((t) => !t.rooms).map((t) => t.id), 'trabajo'];
    s.mode = 'libre';
    s.day = 31;
    s.opening = {
      day: 31,
      heroes: 0,
      gold: 0,
      rep: 0,
      trophies: 0,
      facilities: 0,
      fallen: 0,
      score: 0,
      seen: true,
    };
    expect(nextTip(s)).toBeNull();
    expect(nextTip(s, true)?.id).toBe('obras');
    s = reduce(s, { type: 'tip', id: 'obras' });
    // Al día siguiente, el modo plano; y al otro, excavar.
    expect(nextTip(s, true)).toBeNull();
    s.day = 32;
    expect(nextTip(s, true)?.id).toBe('plano');
    s = reduce(s, { type: 'tip', id: 'plano' });
    s.day = 33;
    expect(nextTip(s, true)?.id).toBe('excavar');
    s = reduce(s, { type: 'tip', id: 'excavar' });
    // Y después, el dormitorio del servicio para los que piden trabajo.
    s.day = 34;
    expect(nextTip(s, true)?.id).toBe('servicio');
  });

  it('en la vista de salas, el tío presenta a los tres del pueblo', () => {
    const s = newGame('trabajo');
    s.tips = TIPS.filter((t) => !t.rooms).map((t) => t.id);
    s.day = 3;
    expect(nextTip(s)).toBeNull();
    expect(nextTip(s, true)?.id).toBe('trabajo');
    // Y unos días después, cómo llegan los visitantes.
    const t = reduce(s, { type: 'tip', id: 'trabajo' });
    expect(nextTip(t, true)).toBeNull();
    expect(nextTip({ ...t, day: 5 }, true)?.id).toBe('visitas');
    // Y lo de la comida: al día siguiente, o antes si esa noche no hay cena para todos.
    const v = reduce(t, { type: 'tip', id: 'visitas' });
    expect(nextTip({ ...v, day: 6 }, true)?.id).toBe('comida');
    const cook = v.workers.find((w) => w.village === 'cocinera')!;
    const hungry = reduce({ ...v, food: 0 }, { type: 'assign', who: cook.id, room: null });
    expect(nextTip(hungry, true)?.id).toBe('comida');
  });
});
