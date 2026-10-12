import { describe, expect, it } from 'vitest';
import { canSend, endDay, newGame, reduce } from './game';
import type { GameState } from './model';
import { notoriety, raidChance, stepRaids } from './raids';
import { Rng } from './rng';

/** Partida con un asalto a punto de llegar esta noche. */
function underAttack(seed: string, strength: number): GameState {
  const s = newGame(seed);
  s.day = 20;
  s.gold = 1000;
  s.raid = { day: 20, band: 'los Hermanos Cuervo', strength, warned: true };
  return s;
}

describe('asaltos', () => {
  it('un gremio famoso y rico atrae a los bandidos', () => {
    const s = newGame('fama');
    s.day = 15;
    expect(raidChance(s)).toBe(0);
    s.rep = 150;
    s.gold = 4000;
    expect(notoriety(s)).toBeGreaterThan(200);
    expect(raidChance(s)).toBeGreaterThan(0);
    s.truce = 30;
    expect(raidChance(s)).toBe(0);
  });

  it('si los defensores ganan: tregua, fama y botín', () => {
    const s = underAttack('gana', 1);
    for (const h of s.heroes) h.attrs = { F: 10, D: 10, M: 10 };
    const r = stepRaids(s, new Rng('a'), [])!;
    expect(r.raid?.won).toBe(true);
    expect(s.gold).toBeGreaterThan(1000);
    expect(s.truce).toBeGreaterThan(s.day);
    expect(s.stats?.raids).toBe(1);
    expect(s.lastRaid?.defenders.length).toBe(2);
  });

  it('si pierden (o no hay nadie): saqueo', () => {
    const s = underAttack('pierde', 99);
    s.inventory.push({ id: 'x', name: 'Cáliz', desc: '', value: 40, kind: 'tesoro' });
    const r = stepRaids(s, new Rng('b'), [])!;
    expect(r.raid?.won).toBe(false);
    expect(s.gold).toBeLessThan(1000);
    const empty = underAttack('vacia', 1);
    for (const h of empty.heroes) h.status = 'mision';
    expect(stepRaids(empty, new Rng('c'), [])!.raid?.won).toBe(false);
  });

  it('quien está de guardia no sale de misión', () => {
    let s = newGame('guardia');
    const h = s.heroes[0]!;
    s = reduce(s, { type: 'guard', id: h.id, on: true });
    expect(canSend(s, s.quests[0]!.id, [h.id])).toMatch(/guardia/);
    s = reduce(s, { type: 'guard', id: h.id, on: false });
    expect(canSend(s, s.quests[0]!.id, [h.id])).toBeNull();
  });

  it('llegan solos con el tiempo y dejan informe', () => {
    let s = newGame('tiempo');
    let raids = 0;
    for (let d = 0; d < 60 && !s.over; d++) {
      s = endDay({ ...s, gold: 3000, rep: 200, tips: ['*'] });
      if (s.lastRaid) raids++;
    }
    expect(raids).toBeGreaterThan(0);
    expect(s.reports.some((r) => r.raid)).toBe(true);
  });
});
