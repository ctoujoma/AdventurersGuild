import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, DUSK } from './balance';
import { yieldReady, yieldsReady } from './collect';
import { endDay, newGame, reduce } from './game';
import { yieldsOf } from './larder';

/** La partida del tío, sin objetivos que sumen (la cocina de Remedios ya hace raciones). */
function home(seed: string) {
  const s = newGame(seed);
  const far = { id: 'encargos', text: '', base: 0, target: 999, reward: {} };
  s.goals = { active: [far, far, far], done: {}, log: [] };
  s.tips = ['*'];
  return s;
}

describe('recoger lo que da la taberna', () => {
  it('la cocina junta raciones durante el día; recogerlas no las cuenta dos veces', () => {
    const s0 = home('cocina');
    const kitchen = yieldsOf(s0).find((y) => y.food)!;
    expect(kitchen).toBeDefined();
    let s = reduce(s0, { type: 'tick', to: (DUSK * DAY_SECONDS) / 2 });
    const ready = yieldReady(s, kitchen.room);
    expect(ready.food).toBeGreaterThan(0);
    const food0 = s.food;
    s = reduce(s, { type: 'collect', what: 'sala', id: kitchen.room });
    expect(s.food).toBe(food0 + ready.food);
    expect(yieldReady(s, kitchen.room).food).toBe(0);
    // Al cerrar el día, lo mismo que sin recoger nada.
    const plain = endDay(reduce(s0, { type: 'tick', to: (DUSK * DAY_SECONDS) / 2 }));
    expect(endDay(s).food).toBe(plain.food);
  });

  it('al anochecer se recoge solo todo lo que quede', () => {
    let s = home('anochecer');
    s = reduce(s, { type: 'tick', to: (DUSK * DAY_SECONDS) / 2 });
    expect(yieldsReady(s).length).toBeGreaterThan(0);
    s = reduce(s, { type: 'dusk' });
    expect(yieldsReady(s)).toEqual([]);
    expect(s.tillTaken ?? 0).toBe(s.till ?? 0);
  });
});
