import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, facilityMax, restCap } from './balance';
import { canUpgrade, endDay, newGame, reduce } from './game';
import { skill } from './party';
import { questEstimate } from './resolve';

describe('instalaciones nuevas', () => {
  it('se compran hasta su nivel máximo', () => {
    let s = newGame('obras');
    s.gold = 5000;
    for (let i = 0; i < 5; i++) s = reduce(s, { type: 'upgrade', fac: 'cap' });
    expect(s.fac.cap).toBe(facilityMax('cap'));
    expect(canUpgrade(s, 'cap')).not.toBeNull();
  });

  it('la sala de mapas trae más encargos al tablón', () => {
    let s = newGame('mapas');
    s.fac.mapas = 2;
    s = endDay(s);
    expect(s.quests.length).toBe(BOARD_SIZE(s.fac.tab, 2));
    expect(BOARD_SIZE(1, 2)).toBe(BOARD_SIZE(1) + 2);
  });

  it('la armería mejora a todo el grupo', () => {
    const s = newGame('armeria');
    const q = { ...s.quests[0]!, challenges: [{ skill: 'Combate' as const, diff: 10 }] };
    const party = s.heroes.slice(0, 2);
    const none = questEstimate(q, party, s.fac).rows[0]!.power;
    const armed = questEstimate(q, party, { ...s.fac, arm: 1 }).rows[0]!.power;
    expect(armed).toBe(none + party.length);
    expect(skill({ ...party[0]!, gear: { Trampas: 1 } }, 'Trampas')).toBe(
      skill(party[0]!, 'Trampas') + 1,
    );
  });

  it('la capilla anima más rápido a quien descansa', () => {
    const rest = (cap: number) => {
      let s = newGame('capilla');
      s.fac.cap = cap;
      for (const h of s.heroes) h.morale = 20;
      s.heroes.forEach((h) => (h.traits = [{ id: 'leal' }]));
      s = endDay(s);
      return s.heroes[0]!.morale;
    };
    expect(rest(2)).toBeGreaterThan(rest(0));
    expect(rest(2)).toBeLessThanOrEqual(restCap(1));
  });
});
