import { describe, expect, it } from 'vitest';
import { RANKS, floorRank, floorsFor, levelRank } from './balance';
import { canWork, newGame } from './game';
import type { GameState, Room } from './model';
import { checkRank, rankUnlocks } from './ranks';
import { raidChance } from './raids';
import { bedsPerCell, problem } from './rooms';

/** La taberna del tío con dos plantas más (hasta la 4) y escaleras hasta ella. */
function tall(): GameState {
  const s = newGame('rangos');
  s.mode = 'libre';
  s.gold = 99999;
  const b = s.building;
  b.rooms = b.rooms.filter((r) => r.type !== 'torre');
  const add = (id: string, type: Room['type'], col: number, floor: number, w: number) =>
    b.rooms.push({ id, type, col, floor, w, h: 1, level: 1, spent: 0 });
  for (const f of [2, 3, 4]) {
    if (f > 2) add(`despensa${f}`, 'despensa', 0, f, 1);
    add(`dormitorio${f}`, 'dormitorio', 1, f, 3);
    if (f < 4) b.stairs.push({ at: 1, floor: f });
  }
  return s;
}

describe('rangos que abren cosas', () => {
  it('cada rango abre plantas o niveles de sala, y lo dice', () => {
    expect(floorsFor(0)).toBe(4);
    expect(floorRank(5)).toBe(2);
    expect(floorRank(6)).toBe(3);
    expect(levelRank('capilla', 3)).toBe(1);
    expect(levelRank('capilla', 2)).toBe(0);
    expect(rankUnlocks(1)).toContain('el nivel 3 de capilla');
    expect(rankUnlocks(2)).toContain('la planta 5');
    expect(rankUnlocks(3)).toEqual(expect.arrayContaining(['la planta 6']));
    expect(rankUnlocks(4).some((t) => t.includes('nivel 4'))).toBe(true);
  });

  it('las plantas de arriba se abren con el rango', () => {
    const s = tall();
    expect(problem(s.building)).toBeNull();
    const up = { type: 'addStair' as const, at: 1, floor: 4 };
    expect(canWork(s, up)).toMatch(/planta 5.*plata/);
    expect(canWork({ ...s, rep: RANKS[2]!.at }, up)).toBeNull();
  });

  it('avisa al subir de rango, pero no a las partidas de antes', () => {
    const s = newGame('aviso');
    const events: { t: string }[] = [];
    checkRank(s, events);
    expect(events).toEqual([]);
    expect(s.rankSeen).toBe(0);
    // Una partida de antes (sin rango apuntado) toma el que tenga sin avisar.
    const old = { ...newGame('vieja'), rep: RANKS[2]!.at, rankSeen: undefined };
    checkRank(old, events);
    expect(events).toEqual([]);
    expect(old.rankSeen).toBe(2);
    s.rep = RANKS[1]!.at;
    checkRank(s, events);
    expect(events[0]?.t).toMatch(/hierro.*nivel 3/);
    checkRank(s, events);
    expect(events).toHaveLength(1);
  });

  it('los niveles nuevos: camas con tope, y la almenara aleja a las bandas', () => {
    expect(bedsPerCell('dormitorio', 3)).toBe(4);
    expect(bedsPerCell('dormitorio', 4)).toBe(4);
    expect(bedsPerCell('veteranos', 3)).toBe(4);
    const s = { ...newGame('torre'), day: 40, rep: 100, gold: 1500 };
    const lit = { ...s, fac: { ...s.fac, torre: 3 } };
    expect(raidChance(lit)).toBeLessThan(raidChance({ ...s, fac: { ...s.fac, torre: 2 } }));
  });
});
