import { describe, expect, it } from 'vitest';
import { RAISE_AMOUNT, restCap } from './balance';
import { partyMods, tripDays } from './classes';
import { endDay, newGame, reduce } from './game';
import type { GameState, Hero } from './model';
import { moraleBand, skill } from './party';
import { resolveMission } from './resolve';
import { Rng } from './rng';

const base = (s: GameState) => s.heroes[0]!;
const as = (h: Hero, patch: Partial<Hero>): Hero => ({ ...structuredClone(h), ...patch });

describe('habilidades de clase', () => {
  it('un explorador acorta los viajes largos un día', () => {
    const s = newGame('atajos');
    const q = { ...s.quests[0]!, days: 3 };
    const h = base(s);
    expect(tripDays(q, [as(h, { cls: 'explorador' })])).toBe(2);
    expect(tripDays(q, [as(h, { cls: 'guerrero' })])).toBe(3);
    expect(tripDays({ ...q, days: 2 }, [as(h, { cls: 'explorador' })])).toBe(2);
  });

  it('enviar con explorador usa los días cortos', () => {
    let s = newGame('envio-explorador');
    const q = { ...s.quests[0]!, days: 3 };
    s.quests[0] = q;
    s.heroes[0]!.cls = 'explorador';
    s = reduce(s, { type: 'send', questId: q.id, heroIds: [s.heroes[0]!.id] });
    expect(s.missions[0]!.daysLeft).toBe(q.days - 1);
  });

  it('un pícaro cobra más por el mismo éxito', () => {
    const s = newGame('picaro');
    const q = {
      ...s.quests[0]!,
      challenges: [{ skill: 'Combate' as const, diff: 1 }],
      item: undefined,
    };
    const run = (cls: Hero['cls']) => {
      const st = structuredClone(s);
      st.heroes = [as(base(s), { cls, attrs: { F: 10, D: 10, M: 10 }, lvl: 10, traits: [] })];
      const before = st.gold;
      resolveMission(
        st,
        { id: 'm', quest: q, heroIds: [st.heroes[0]!.id], daysLeft: 0 },
        new Rng('r'),
      );
      return st.gold - before;
    };
    expect(run('picaro')).toBeGreaterThan(run('guerrero'));
    expect(
      partyMods([{ cls: 'picaro', lvl: 1, attrs: { F: 1, D: 1, M: 1 }, traits: [] }]).gold,
    ).toBeGreaterThan(1);
  });

  it('un guerrero protege a sus compañeros de las heridas', () => {
    const s = newGame('escudo');
    const q = {
      ...s.quests[0]!,
      danger: 1 as const,
      challenges: [{ skill: 'Arcano' as const, diff: 99 }],
    };
    const hurt = (withWarrior: boolean) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const st = structuredClone(s);
        const a = as(base(s), { id: 'a', cls: 'mago', traits: [] });
        const b = as(base(s), { id: 'b', cls: withWarrior ? 'guerrero' : 'mago', traits: [] });
        st.heroes = [a, b];
        resolveMission(
          st,
          { id: 'm', quest: q, heroIds: ['a', 'b'], daysLeft: 0 },
          new Rng(`g${i}`),
        );
        if (st.heroes[0]!.status === 'herido') n++;
      }
      return n;
    };
    expect(hurt(true)).toBeLessThan(hurt(false));
  });
});

describe('moral', () => {
  it('cambia el rendimiento', () => {
    const h = base(newGame('moral'));
    const v = (morale: number) => skill({ ...h, morale, traits: [] }, 'Combate');
    expect(v(80)).toBe(v(50) + 1);
    expect(v(20)).toBe(v(50) - 1);
    expect(moraleBand(10)).toBe('harto');
  });

  it('se recupera descansando hasta el tope de la taberna', () => {
    let s = newGame('descanso');
    for (const h of s.heroes) h.morale = 30;
    s.heroes.forEach((h) => (h.traits = []));
    for (let d = 0; d < 20; d++) s = endDay(s);
    for (const h of s.heroes.filter((x) => x.status === 'ok'))
      expect(h.morale).toBe(restCap(s.fac.tab));
  });

  it('quien está harto acaba yéndose, salvo los leales', () => {
    let s = newGame('harto');
    s.heroes[0]!.traits = [];
    s.heroes[1]!.traits = [{ id: 'leal' }];
    s.fac.tab = 0;
    const ids = s.heroes.map((h) => h.id);
    for (let d = 0; d < 6; d++) {
      for (const h of s.heroes) h.morale = 0;
      s = endDay(s);
    }
    expect(s.heroes.some((h) => h.id === ids[0])).toBe(false);
    expect(s.heroes.some((h) => h.id === ids[1])).toBe(true);
  });

  it('un desanimado pide aumento y la respuesta cuenta', () => {
    let s = newGame('aumento');
    s.heroes[0]!.morale = 25;
    s.heroes[0]!.traits = [{ id: 'leal' }];
    for (let d = 0; d < 6 && !s.heroes[0]!.request; d++) {
      s.heroes[0]!.morale = 25;
      s = endDay(s);
    }
    const h = s.heroes[0]!;
    expect(h.request).toBe('raise');
    const yes = reduce(s, { type: 'answer', id: h.id, yes: true }).heroes[0]!;
    expect(yes.salary).toBe(h.salary + RAISE_AMOUNT);
    expect(yes.morale).toBeGreaterThan(h.morale);
    expect(yes.request).toBeUndefined();
    const no = reduce(s, { type: 'answer', id: h.id, yes: false }).heroes[0]!;
    expect(no.salary).toBe(h.salary);
    expect(no.morale).toBeLessThan(h.morale);
  });
});
