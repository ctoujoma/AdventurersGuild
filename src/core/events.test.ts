import { describe, expect, it } from 'vitest';
import { CHAINS } from '../data/chains';
import { offerChain } from './chains';
import { maybeEvent, stepThreat } from './events';
import { endDay, newGame, reduce } from './game';
import type { GameState } from './model';
import { resolveMission } from './resolve';
import { Rng } from './rng';

describe('desaparecidos', () => {
  it('cuando alguien desaparece hay un encargo de rescate, y rescatarle lo trae', () => {
    let s: GameState = newGame('rescate');
    // Fuerza una desaparición: misión imposible y sin clérigo.
    const h = { ...s.heroes[1]!, traits: [] };
    s.heroes = [s.heroes[0]!, h];
    const q = {
      ...s.quests[0]!,
      danger: 3 as const,
      challenges: [{ skill: 'Arcano' as const, diff: 99 }],
    };
    for (let i = 0; i < 60 && h.status !== 'desaparecido'; i++) {
      h.status = 'mision';
      resolveMission(s, { id: 'm', quest: q, heroIds: [h.id], daysLeft: 0 }, new Rng(`d${i}`));
    }
    expect(h.status).toBe('desaparecido');
    const rq = s.quests.find((x) => x.rescue === h.id)!;
    expect(rq).toBeDefined();
    expect(rq.place).toBe(q.place);
    // Un campeón va a por él.
    s.heroes[0] = { ...s.heroes[0]!, attrs: { F: 10, D: 10, M: 10 }, lvl: 10, traits: [] };
    s = reduce(s, { type: 'send', questId: rq.id, heroIds: [s.heroes[0]!.id] });
    for (let d = 0; d < 6 && s.missions.length; d++) s = endDay(s);
    expect(s.heroes.find((x) => x.id === h.id)!.status).not.toBe('desaparecido');
  });
});

describe('sucesos', () => {
  it('aparecen a veces, se eligen y dejan constancia', () => {
    let s = newGame('sucesos');
    s.day = 10;
    s.gold = 500;
    for (let i = 0; i < 200 && !s.event; i++) maybeEvent(s, new Rng(`e${i}`));
    expect(s.event).toBeTruthy();
    s = reduce(s, { type: 'choose', index: 0 });
    expect(s.event).toBeNull();
    expect(s.lastChoice).toBeTruthy();
  });
});

describe('amenaza regional', () => {
  it('crece si una historia espera en el tablón y se lleva ingresos', () => {
    const s = newGame('amenaza');
    s.rep = CHAINS[0]!.rep;
    offerChain(s, new Rng('o'), []);
    for (let d = 0; d < 30; d++) stepThreat(s, new Rng(`t${d}`), [], 10);
    expect(s.threat).toBeGreaterThanOrEqual(40);
    let lost = 0;
    for (let d = 0; d < 50; d++) lost += stepThreat(s, new Rng(`c${d}`), [], 10);
    expect(lost).toBeGreaterThan(0);
  });
});
