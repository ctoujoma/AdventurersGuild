import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, capacity, facilityMax, restCap } from './balance';
import { canHire, canUpgrade, endDay, newGame, reduce, roster } from './game';
import { skill } from './party';
import { questEstimate } from './resolve';
import { beds } from './rooms';

describe('instalaciones nuevas', () => {
  it('los cuartos de veteranos suman camas: hasta 12 héroes', () => {
    expect(capacity(3)).toBe(8);
    expect(capacity(3, 2)).toBe(12);
    const s = newGame('camas');
    s.gold = 9999;
    s.building.rooms.find((r) => r.type === 'dormitorio')!.level = 3;
    expect(beds(s.building)).toBe(capacity(3));
    const full = () => {
      const c = s.candidates[0]!;
      while (s.heroes.length < 8) s.heroes.push({ ...c, id: `h${s.heroes.length}x` });
    };
    full();
    expect(roster(s).length).toBe(8);
    expect(canHire(s, s.candidates[0]!.id)).toMatch(/sitio/);
    s.building.rooms.push({
      id: 'v',
      type: 'veteranos',
      col: 1,
      floor: 2,
      w: 1,
      h: 1,
      level: 2,
      spent: 0,
    });
    expect(beds(s.building)).toBe(capacity(3, 2));
    expect(canHire(s, s.candidates[0]!.id)).toBeNull();
  });

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

describe('construcciones de fuera', () => {
  it('la forja mejora el objeto equipado', async () => {
    const { gearOf } = await import('./resolve');
    const item = { id: 'x', name: 'Espada', desc: '', value: 1, bonus: { Combate: 1 } };
    const s = newGame('forja');
    expect(gearOf(item, { ...s.fac, forja: 2 }).Combate).toBe(3);
  });

  it('el establo acorta los viajes largos', async () => {
    const { tripDays } = await import('./classes');
    const s = newGame('establo');
    const q = { ...s.quests[0]!, days: 3 };
    expect(tripDays(q, [s.heroes[0]!], 1)).toBe(2);
    expect(tripDays({ ...q, days: 2 }, [s.heroes[0]!], 1)).toBe(2);
  });

  it('el patio entrena a quien descansa', () => {
    let s = newGame('patio');
    s.fac.patio = 2;
    const xp = s.heroes[0]!.xp;
    s = endDay(s);
    expect(s.heroes[0]!.xp + s.heroes[0]!.lvl * 100).toBeGreaterThan(xp + 100);
  });

  it('la empalizada defiende y la torre siempre avisa', async () => {
    const { stepRaids } = await import('./raids');
    const { assaultSetup } = await import('./assault');
    const { Rng } = await import('./rng');
    const s = newGame('defensa');
    const base = assaultSetup(s, 20, new Rng('e')).yard;
    s.fac.empal = 2;
    expect(assaultSetup(s, 20, new Rng('e')).yard).toBeGreaterThan(base);
    s.fac.torre = 1;
    s.day = 20;
    s.rep = 400;
    s.gold = 9000;
    for (let i = 0; i < 50 && !s.raid; i++) stepRaids(s, new Rng(`r${i}`), []);
    expect(s.raid?.warned).toBe(true);
  });
});
