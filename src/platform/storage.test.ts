import { describe, expect, it } from 'vitest';
import { endDay, newGame } from '../core/game';
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
});
