import { describe, expect, it } from 'vitest';
import { START_BEER, START_FOOD } from '../core/balance';
import { endDay, newGame } from '../core/game';
import type { GameState } from '../core/model';
import { loadGame, saveGame, type SaveStorage } from './storage';

function memory(): SaveStorage & { data: string | null } {
  return {
    data: null,
    read() {
      return this.data;
    },
    write(d) {
      this.data = d;
    },
    clear() {
      this.data = null;
    },
  };
}

describe('guardado', () => {
  it('guarda y carga la misma partida, que sigue igual', () => {
    const mem = memory();
    const s = endDay(newGame('guardar'));
    saveGame(s, mem);
    const loaded = loadGame(mem)!;
    expect(loaded).toEqual(s);
    expect(endDay(loaded)).toEqual(endDay(s));
  });

  it('una partida de antes de la despensa empieza con la comida y la cerveza de siempre', () => {
    const mem = memory();
    const old: Partial<GameState> = newGame('sin-despensa');
    delete old.food;
    delete old.beer;
    mem.write(JSON.stringify(old));
    expect(loadGame(mem)).toMatchObject({ food: START_FOOD, beer: START_BEER });
  });

  it('saca las instalaciones del edificio guardado', () => {
    const mem = memory();
    const s = newGame('antigua');
    for (const r of s.building.rooms)
      if (r.type === 'dormitorio' || r.type === 'enfermeria') r.level = 2;
    mem.write(JSON.stringify({ ...s, fac: { dorm: 1, enf: 0, tab: 1 } }));
    expect(loadGame(mem)!.fac).toMatchObject({
      dorm: 2,
      enf: 2,
      tab: 1,
      mapas: 0,
      arm: 0,
      cap: 0,
      forja: 0,
    });
  });

  it('ignora las partidas de antes de las salas', () => {
    const mem = memory();
    mem.write(JSON.stringify({ ...newGame('sin-salas'), building: undefined }));
    expect(loadGame(mem)).toBeNull();
  });

  it('ignora partidas rotas o de otra versión', () => {
    const mem = memory();
    mem.data = '{roto';
    expect(loadGame(mem)).toBeNull();
    mem.data = JSON.stringify({ ...newGame('v'), version: 0 });
    expect(loadGame(mem)).toBeNull();
  });

  it('una partida de tres rarezas pasa a cinco: el bueno a raro y el legendario a 4', () => {
    const mem = memory();
    const old = newGame('tres-rarezas') as GameState & { version: number };
    const it = (id: string, rarity: number) => ({ id, name: id, desc: '', value: 1, rarity });
    old.version = 4;
    old.inventory = [it('a', 0), it('b', 1), it('c', 2)] as GameState['inventory'];
    const h = old.heroes[0]!;
    h.worn = { arma: it('d', 2) as never };
    old.reports = [
      { id: 'r', fight: { heroes: [{ gear: { icon: 'espada', rarity: 1 } }] } } as never,
    ];
    old.goals = {
      active: [{ reward: { gold: 1, item: 1 } }] as never,
      done: {},
      log: [],
    };
    mem.write(JSON.stringify(old));
    const s = loadGame(mem)!;
    expect(s.version).toBe(5);
    expect(s.inventory.map((x) => x.rarity)).toEqual([0, 2, 4]);
    expect(s.heroes[0]!.worn?.arma?.rarity).toBe(4);
    expect(
      (s.reports[0] as never as { fight: { heroes: { gear: { rarity: number } }[] } }).fight
        .heroes[0]!.gear.rarity,
    ).toBe(2);
    expect(s.goals!.active[0]!.reward.item).toBe(2);
  });
});
