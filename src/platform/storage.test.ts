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

  it('ignora partidas rotas o de otra versión', () => {
    const mem = memory();
    mem.data = '{roto';
    expect(loadGame(mem)).toBeNull();
    mem.data = JSON.stringify({ ...newGame('v'), version: 0 });
    expect(loadGame(mem)).toBeNull();
  });
});
