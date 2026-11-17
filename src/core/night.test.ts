import { describe, expect, it } from 'vitest';
import { BANDS } from '../data/raids';
import { DAY_SECONDS, NIGHT_ODDS, NIGHT_ODDS_ROUGH, WORK_END } from './balance';
import { newGame, nightLeft } from './game';
import type { GameState } from './model';
import { canHappen, nightOdds, NIGHT_EVENTS, rollNight } from './night';
import { Rng } from './rng';
import { roughNight } from './sky';

/** Una partida sin tutorial, en el día `day`, con oro (para que el ladrón quiera entrar). */
function at(day: number, seed = 'noches'): GameState {
  const s = newGame(seed);
  delete s.tutorial;
  s.mode = 'libre';
  s.day = day;
  s.gold = 300;
  return s;
}

/** Si esta noche ha pasado algo (lo apunta el registro de la noche). */
const happened = (s: GameState) => Object.values(s.nights?.last ?? {}).includes(s.day);

describe('la noche', () => {
  it('empieza cuando se van a dormir y dura hasta que acaba el día', () => {
    const s = newGame('noche');
    expect(nightLeft({ ...s, clock: 0 })).toBe(0);
    expect(nightLeft({ ...s, clock: WORK_END * DAY_SECONDS - 1 })).toBe(0);
    expect(nightLeft({ ...s, clock: WORK_END * DAY_SECONDS })).toBeCloseTo(
      (1 - WORK_END) * DAY_SECONDS,
    );
    expect(nightLeft({ ...s, clock: DAY_SECONDS })).toBe(0);
  });

  it('pasa algo una de cada dos noches, de media; algo más con niebla o tormenta', () => {
    let calm = 0;
    let calmN = 0;
    let rough = 0;
    let roughN = 0;
    for (let i = 0; i < 1500; i++) {
      const day = 8 + (i % 300);
      const s = at(day, `semilla${Math.floor(i / 300)}`);
      rollNight(s, new Rng(`n${i}`));
      if (roughNight(s.seed, day)) {
        roughN++;
        if (happened(s)) rough++;
      } else {
        calmN++;
        if (happened(s)) calm++;
      }
    }
    expect(calm / calmN).toBeCloseTo(NIGHT_ODDS, 1);
    expect(rough / roughN).toBeGreaterThan(calm / calmN);
    // Hay menos noches de niebla o tormenta: más margen.
    expect(Math.abs(rough / roughN - NIGHT_ODDS_ROUGH)).toBeLessThan(0.1);
  });

  it('elige entre los posibles por su peso y respeta el «cada cuánto»', () => {
    const got: Record<string, number> = {};
    for (let i = 0; i < 600; i++) {
      const s = at(10);
      rollNight(s, new Rng(`p${i}`));
      for (const [id, d] of Object.entries(s.nights!.last))
        if (d === s.day) got[id] = (got[id] ?? 0) + 1;
    }
    // Con el mismo peso, los dos salen parecido.
    expect(got.ladron).toBeGreaterThan(100);
    expect(got.mensajero).toBeGreaterThan(100);
    const s = at(10);
    s.nights = { rolled: 0, last: { ladron: 9, mensajero: 9 } };
    expect(NIGHT_EVENTS.filter((e) => !e.chance && canHappen(s, e))).toEqual([]);
  });

  it('la noche del asalto no pasa nada', () => {
    for (let i = 0; i < 50; i++) {
      const s = at(6);
      s.raid = { day: 7, band: BANDS[0]!, strength: 8, warned: true };
      rollNight(s, new Rng(`a${i}`));
      expect(happened(s)).toBe(false);
      expect(s.incidents ?? []).toEqual([]);
      expect(s.messenger ?? null).toBeNull();
    }
  });

  it('niebla y tormenta dan más', () => {
    const s = at(3);
    let d = 3;
    while (!roughNight(s.seed, d)) d++;
    expect(nightOdds({ ...s, day: d })).toBe(NIGHT_ODDS_ROUGH);
  });
});
