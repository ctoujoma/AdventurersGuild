import { describe, expect, it } from 'vitest';
import { GEAR } from '../data/items';
import { appeal } from './salon';
import { canEquip, endDay, gearInStock, newGame, reduce } from './game';
import { generateQuest } from './generate';
import type { GameState, Item } from './model';
import { questEstimate, resolveMission } from './resolve';
import { Rng } from './rng';

const gear = (name: string, id = 'g1'): Item => ({ id, ...GEAR.find((g) => g.name === name)! });

function withStock(s: GameState, ...items: Item[]): GameState {
  return { ...s, inventory: [...s.inventory, ...items] };
}

describe('equipo', () => {
  it('se equipa, se cambia y se quita sin perder nada', () => {
    let s = withStock(
      newGame('equipo'),
      gear('Espada oxidada'),
      gear('Hacha de leñador enano', 'g2'),
    );
    const h = s.heroes[0]!.id;
    s = reduce(s, { type: 'equip', heroId: h, itemId: 'g1' });
    expect(s.heroes[0]!.item?.id).toBe('g1');
    expect(gearInStock(s).map((i) => i.id)).toEqual(['g2']);
    s = reduce(s, { type: 'equip', heroId: h, itemId: 'g2' });
    expect(s.heroes[0]!.item?.id).toBe('g2');
    expect(gearInStock(s).map((i) => i.id)).toEqual(['g1']);
    s = reduce(s, { type: 'unequip', heroId: h });
    expect(s.heroes[0]!.item).toBeUndefined();
    expect(gearInStock(s)).toHaveLength(2);
  });

  it('los tesoros no se equipan', () => {
    const s = withStock(newGame('tesoro'), {
      id: 't',
      name: 'Cáliz',
      desc: '',
      value: 9,
      kind: 'tesoro',
    });
    expect(canEquip(s, s.heroes[0]!.id, 't')).not.toBeNull();
  });

  it('suma a la estimación del encargo', () => {
    const s = newGame('suma');
    const q = { ...s.quests[0]!, challenges: [{ skill: 'Combate' as const, diff: 10 }] };
    const h = s.heroes[0]!;
    const base = questEstimate(q, [h], s.fac).rows[0]!.power;
    const armed = questEstimate(q, [{ ...h, item: gear('Hacha de leñador enano') }], s.fac)
      .rows[0]!;
    expect(armed.power).toBe(base + 2);
  });

  it('al despedir, el objeto vuelve al arcón', () => {
    let s = withStock(newGame('despedir'), gear('Espada oxidada'));
    const h = s.heroes[1]!.id;
    s = reduce(s, { type: 'equip', heroId: h, itemId: 'g1' });
    s = reduce(s, { type: 'fire', id: h });
    expect(gearInStock(s).map((i) => i.id)).toEqual(['g1']);
  });

  it('los encargos traen equipo de todas las rarezas', () => {
    const rng = new Rng('botin');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const q = generateQuest(rng, `q${i}`, i % 5, `i${i}`);
      if (q.item?.kind && q.item.kind !== 'tesoro') seen.add(q.item.rarity ?? 0);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe('trofeos', () => {
  it('una gran hazaña peligrosa deja un trofeo, fama y clientela', () => {
    const s = newGame('trofeo');
    const q = {
      ...s.quests[0]!,
      danger: 2 as const,
      challenges: [{ skill: 'Combate' as const, diff: 1 }],
    };
    const h = { ...s.heroes[0]!, attrs: { F: 10, D: 10, M: 10 }, lvl: 10, traits: [] };
    s.heroes = [h];
    const rep = s.rep;
    const r = resolveMission(s, { id: 'm', quest: q, heroIds: [h.id], daysLeft: 0 }, new Rng(1));
    expect(r.outcome).toBe('Éxito brillante');
    expect(s.trophies).toHaveLength(1);
    expect(s.rep).toBeGreaterThan(rep + 5);
    const sold = reduce(s, { type: 'sellTrophy', id: s.trophies[0]!.id });
    // En la pared del salón atrae gente.
    expect(appeal(s)).toBeGreaterThan(appeal(sold));
    expect(sold.trophies).toHaveLength(0);
    expect(sold.gold).toBe(s.gold + s.trophies[0]!.value);
  });

  it('las partidas siguen siendo deterministas', () => {
    let a = newGame('det');
    let b = newGame('det');
    for (let i = 0; i < 10; i++) {
      a = endDay(a);
      b = endDay(b);
    }
    expect(a).toEqual(b);
  });
});
