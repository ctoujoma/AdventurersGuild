import { describe, expect, it } from 'vitest';
import { awaySeconds, catchUp, dueTonight } from './away';
import {
  AWAY_DAY_SECONDS,
  AWAY_MAX_DAYS,
  AWAY_MIN_SECONDS,
  DAY_SECONDS,
  DUSK,
  SCHEDULE,
} from './balance';
import { newGame } from './game';
import { raidChance, stepRaids } from './raids';
import { Rng } from './rng';

describe('tiempo que corre solo', () => {
  it('fuera corre más despacio que abierto, con un mínimo y un tope', () => {
    expect(awaySeconds(AWAY_MIN_SECONDS - 1)).toBe(0);
    expect(awaySeconds(AWAY_DAY_SECONDS)).toBe(DAY_SECONDS);
    expect(awaySeconds(AWAY_DAY_SECONDS / 2)).toBe(DAY_SECONDS / 2);
    expect(awaySeconds(AWAY_DAY_SECONDS * 1000)).toBe(AWAY_MAX_DAYS * DAY_SECONDS);
  });

  it('un rato corto solo mueve el reloj; uno largo pasa días y los cuenta', () => {
    const s = newGame('fuera');
    const short = catchUp(s, AWAY_DAY_SECONDS / 4);
    expect(short.days).toEqual([]);
    expect(short.state.day).toBe(s.day);
    expect(short.state.clock).toBeCloseTo(DAY_SECONDS / 4, 6);

    const long = catchUp(s, AWAY_DAY_SECONDS * 3.5);
    expect(long.days.map((d) => d.day)).toEqual([s.day + 1, s.day + 2, s.day + 3]);
    expect(long.state.day).toBe(s.day + 3);
    expect(long.state.clock).toBeCloseTo(DAY_SECONDS / 2, 6);
    // La carta junta los días con su encabezado, y no queda nada que ver en la escena.
    expect(long.state.dawn.filter((e) => e.head).map((e) => e.t)).toEqual([
      `Día ${s.day + 1}`,
      `Día ${s.day + 2}`,
      `Día ${s.day + 3}`,
    ]);
    expect(long.state.lastRaid).toBeNull();
    expect(long.state.lastFight).toBeNull();
  });

  it('no pasa de los días del tope ni toca una partida acabada', () => {
    const s = newGame('tope');
    expect(catchUp(s, AWAY_DAY_SECONDS * 100).days).toHaveLength(AWAY_MAX_DAYS);
    const over = { ...s, over: { kind: 'derrota' as const, text: 'x', score: 0 } };
    expect(catchUp(over, AWAY_DAY_SECONDS * 3).state).toBe(over);
  });

  it('fuera, los asaltos son menos probables', () => {
    // Con la misma suerte, una probabilidad más baja nunca programa un asalto que la alta no.
    const s = { ...newGame('asaltos'), day: 40, rep: 200, gold: 4000 };
    expect(raidChance(s)).toBeGreaterThan(0);
    let home = 0;
    let away = 0;
    for (let i = 0; i < 400; i++) {
      const a = structuredClone(s);
      stepRaids(a, new Rng(`a${i}`), []);
      if (a.raid) home++;
      const b = structuredClone(s);
      stepRaids(b, new Rng(`a${i}`), [], 0.4);
      if (b.raid) away++;
    }
    expect(away).toBeLessThan(home);
  });

  it('fuera nunca se pierde: la víspera de un pago que no llega, la taberna espera a la tarde', () => {
    const first = SCHEDULE[0]!;
    const s = { ...newGame('pago'), day: first.day - 1, clock: 0, gold: 0 };
    expect(dueTonight(s)).toBeGreaterThan(0);
    const broke = catchUp(s, AWAY_DAY_SECONDS * 5);
    expect(broke.state.over).toBeFalsy();
    expect(broke.state.day).toBe(s.day);
    expect(broke.state.clock).toBeCloseTo(DUSK * DAY_SECONDS, 6);
    expect(broke.waiting).toBe(dueTonight(broke.state));
    // Con dinero, el pago se hace solo y los días siguen.
    const rich = catchUp({ ...s, gold: 5000 }, AWAY_DAY_SECONDS * 3);
    expect(rich.waiting).toBeUndefined();
    expect(rich.state.paid).toBe(s.paid + first.amount);
    expect(rich.days.length).toBe(3);
  });
});
