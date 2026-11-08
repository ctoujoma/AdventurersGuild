import { describe, expect, it } from 'vitest';
import { MAT_LOOSE, MAT_SELL, STORE_CAP } from './balance';
import { newGame } from './game';
import type { GameState } from './model';
import { gainMats, hasMats, matCap, matOf, missing, spendMats } from './materials';

const withStore = (s: GameState, level: number, w = 1): GameState => {
  s.building.rooms.push({
    id: 'alm',
    type: 'almacen',
    col: s.building.cols,
    floor: 0,
    w,
    h: 1,
    level,
    spent: 0,
  });
  return s;
};

describe('materiales', () => {
  it('sin almacén caben unos pocos de cada básico; lo que no cabe se vende y se avisa', () => {
    const s = newGame('rincon');
    const gold = s.gold;
    const r = gainMats(s, { hierro: MAT_LOOSE + 2, cuero: 1 });
    expect(matOf(s, 'hierro')).toBe(MAT_LOOSE);
    expect(matOf(s, 'cuero')).toBe(1);
    expect(r.sold).toEqual({ hierro: 2 });
    expect(s.gold).toBe(gold + 2 * MAT_SELL);
    // Durante la deuda aún no se puede construir: se dice cuándo.
    expect(r.warn).toMatch(/Cuando pagues la deuda podrás construir un almacén/);
  });

  it('ya libre, el aviso pide construir el almacén; con almacén, ampliarlo', () => {
    const s = { ...newGame('libre'), mode: 'libre' as const };
    expect(gainMats(s, { tela: MAT_LOOSE + 1 }).warn).toMatch(/Construye un almacén/);
    const t = withStore(structuredClone(s), 1);
    expect(matCap(t, 'tela')).toBe(MAT_LOOSE + STORE_CAP[1]);
    expect(gainMats(t, { tela: 200 }).warn).toMatch(/Amplía el almacén/);
  });

  it('el almacén guarda más por nivel y por hueco; los raros solo con nivel 2', () => {
    const s = withStore(newGame('almacen'), 1, 2);
    expect(matCap(s, 'hierro')).toBe(MAT_LOOSE + STORE_CAP[1] * 2);
    expect(matCap(s, 'cristal')).toBe(0);
    const t = withStore(newGame('almacen2'), 2);
    expect(matCap(t, 'cristal')).toBe(STORE_CAP[2]);
  });

  it('gastar y lo que falta', () => {
    const s = newGame('gastar');
    gainMats(s, { hierro: 3 });
    expect(hasMats(s, { hierro: 2 })).toBe(true);
    expect(missing(s, { hierro: 5, cuero: 1 })).toEqual({ hierro: 2, cuero: 1 });
    spendMats(s, { hierro: 2 });
    expect(matOf(s, 'hierro')).toBe(1);
  });
});

describe('el almacén por niveles', () => {
  it('el nivel 2 avisa de que lo raro llega con las expediciones; el 3 pide plata', async () => {
    const { storeNext } = await import('./materials');
    const { levelRank } = await import('./balance');
    const s = newGame('niveles');
    expect(storeNext(s, 1)).toMatch(/que llega con las expediciones/);
    s.stats = { ...s.stats!, maxLvl: 5 };
    expect(storeNext(s, 1)).not.toMatch(/expediciones/);
    expect(storeNext(s, 3)).toBeNull();
    expect(levelRank('almacen', 2)).toBe(0);
    expect(levelRank('almacen', 3)).toBe(2);
  });
});
