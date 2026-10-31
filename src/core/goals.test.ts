import { describe, expect, it } from 'vitest';
import { FEATS } from '../data/feats';
import { GOALS, GOAL_SLOTS } from '../data/goals';
import { ROOMS } from '../data/rooms';
import { FREE } from '../data/unlocks';
import { roomMax } from './balance';
import { endDay, newGame, reduce } from './game';
import { checkGoals, goalProgress, hasUnlock, unlockSource } from './goals';
import type { GameState } from './model';
import { Rng } from './rng';

const cumplir = (s: GameState, id: string) => {
  const g = s.goals!.active.find((a) => a.id === id)!;
  return g;
};

describe('objetivos', () => {
  it('siempre hay tres, desde el primer día y sin repetir', () => {
    const s = newGame('objetivos');
    expect(s.goals?.active).toHaveLength(GOAL_SLOTS);
    expect(new Set(s.goals!.active.map((g) => g.id)).size).toBe(GOAL_SLOTS);
  });

  it('al cumplir uno se cobra, se apunta y sale otro', () => {
    const s = structuredClone(newGame('cumplir'));
    s.goals!.active[0] = {
      id: 'encargos',
      text: 'Cumple 3 encargos',
      base: 0,
      target: 3,
      reward: { gold: 40 },
    };
    s.stats!.wins = 3;
    const gold = s.gold;
    const out: { t: string }[] = [];
    checkGoals(s, new Rng(1), out);
    expect(s.gold).toBe(gold + 40);
    expect(out[0]?.t).toMatch(/Objetivo cumplido: Cumple 3 encargos/);
    expect(s.goals!.log[0]).toMatchObject({ day: s.day, text: 'Cumple 3 encargos' });
    expect(s.goals!.done.encargos).toBe(1);
    expect(s.goals!.active).toHaveLength(GOAL_SLOTS);
  });

  it('con el juego abierto se cobran en el reloj', () => {
    const s = structuredClone(newGame('reloj'));
    s.goals!.active[0] = { id: 'jarras', text: 'x', base: 0, target: 30, reward: { gold: 30 } };
    s.beer = 40;
    const t = reduce(s, { type: 'tick', to: (s.clock ?? 0) + 1 });
    expect(t.goals!.done.jarras).toBe(1);
    expect(t.incidentNews?.some((n) => n.t.startsWith('Objetivo cumplido'))).toBe(true);
    // Sin nada cumplido, el reloj no copia los objetivos.
    const u = reduce(t, { type: 'tick', to: (t.clock ?? 0) + 1 });
    expect(u.goals).toBe(t.goals);
  });

  it('los de contar piden más cada vez; los de sala, solo con la sala un nivel por debajo', () => {
    const s = structuredClone(newGame('serie'));
    s.goals = { active: [], done: { encargos: 2 }, log: [] };
    // Fuerza que salga el de encargos quitando el resto.
    const rng = new Rng(3);
    for (let i = 0; i < 40 && !s.goals.active.some((g) => g.id === 'encargos'); i++) {
      s.goals.active = [];
      checkGoals(s, rng, []);
    }
    const g = cumplir(s, 'encargos');
    expect(g.target).toBe(3 + 2 * 2);
    expect(g.reward.gold).toBe(80);
    for (const a of s.goals.active)
      if (a.id.includes('-') && GOALS.find((d) => d.id === a.id && 'room' in d)) {
        const d = GOALS.find((x) => x.id === a.id)!;
        if (!('room' in d)) continue;
        const lv = Math.max(
          ...s.building.rooms.filter((r) => r.type === d.room).map((r) => r.level),
        );
        expect(lv).toBe(d.level - 1);
      }
  });

  it('el progreso no pasa de lo que pide', () => {
    const s = newGame('progreso');
    for (const g of s.goals!.active) {
      const p = goalProgress(s, g);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(g.target);
    }
  });

  it('los de sala existen y no pasan del nivel máximo', () => {
    for (const d of GOALS)
      if ('room' in d) {
        expect(ROOMS[d.room]).toBeDefined();
        expect(d.level).toBeLessThanOrEqual(roomMax(d.room));
      }
  });

  it('al amanecer también se cobran', () => {
    const s = structuredClone(newGame('amanecer'));
    s.goals!.active[0] = { id: 'raciones', text: 'x', base: 0, target: 1, reward: { gold: 5 } };
    const t = endDay(s);
    expect(t.goals!.done.raciones).toBe(1);
    expect(t.dawn.some((e) => e.t.startsWith('Objetivo cumplido'))).toBe(true);
    expect(t.goals!.active).toHaveLength(GOAL_SLOTS);
  });

  it('los de llegar a algo van en serie', () => {
    const s = structuredClone(newGame('en serie'));
    for (let i = 0; i < 30; i++) {
      s.goals!.active = [];
      checkGoals(s, new Rng(i), []);
      const ids = s.goals!.active.map((g) => g.id);
      expect(ids).not.toContain('plata');
      expect(ids).not.toContain('personal-7');
    }
  });
});

describe('cosas que se ven', () => {
  it('las de serie se tienen; las demás, al cobrar su premio', () => {
    const s = structuredClone(newGame('piezas'));
    for (const id of FREE) expect(hasUnlock(s, id)).toBe(true);
    expect(hasUnlock(s, 'roof:pizarra')).toBe(false);
    s.goals!.active[0] = {
      id: 'jarras',
      text: 'x',
      base: 0,
      target: 1,
      reward: { gold: 1, unlock: 'roof:pizarra' },
    };
    s.beer = 5;
    checkGoals(s, new Rng(1), []);
    expect(hasUnlock(s, 'roof:pizarra')).toBe(true);
  });

  it('cada pieza que no es de serie sale de algún sitio', () => {
    const all = [
      ...FEATS.flatMap((f) => f.rewards.map((r) => r.unlock)),
      ...GOALS.map((g) => g.reward.unlock),
    ].filter(Boolean);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) {
      expect(FREE.includes(id!)).toBe(false);
      expect(unlockSource(id!)).toBeTruthy();
    }
  });
});
