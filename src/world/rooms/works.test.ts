import { describe, expect, it } from 'vitest';
import { canWork, newGame, type Action } from '../../core/game';
import type { GameState } from '../../core/model';
import { roomAt } from '../../core/rooms';
import { colX, floorTop } from './layout';
import { targetsFor } from './works';

function open(): GameState {
  const s = newGame('sitios');
  s.mode = 'libre';
  s.gold = 9999;
  return s;
}

const valid = (s: GameState, a: Action) => canWork(s, a) === null;

describe('sitios para las obras', () => {
  it('construir: solo huecos libres donde la sala cabe, y cada uno en su sitio del corte', () => {
    const s = open();
    const list = targetsFor(s, { kind: 'build', type: 'despensa' });
    expect(list.length).toBeGreaterThan(0);
    for (const t of list) {
      expect(valid(s, t.action)).toBe(true);
      const a = t.action as Extract<Action, { type: 'build' }>;
      expect(roomAt(s.building, a.col, a.floor)).toBeUndefined();
      expect(t.rect.x).toBe(colX(s.building, a.col));
      expect(t.rect.y).toBe(floorTop(a.floor));
    }
    // En el sótano sin excavar no se construye.
    expect(list.some((t) => (t.action as { floor: number }).floor < -1)).toBe(false);
  });

  it('antes de pagar la deuda no hay sitios: solo se arregla y se mejora', () => {
    const s = open();
    s.mode = 'deuda';
    expect(targetsFor(s, { kind: 'build', type: 'despensa' })).toHaveLength(0);
    expect(targetsFor(s, { kind: 'dig' })).toHaveLength(0);
  });

  it('mover, excavar y escalera dan sitios válidos y distintos', () => {
    const s = open();
    const cocina = s.building.rooms.find((r) => r.type === 'cocina')!;
    for (const pick of [
      { kind: 'move', id: cocina.id },
      { kind: 'dig' },
      { kind: 'stair' },
    ] as const) {
      const list = targetsFor(s, pick);
      expect(list.length, pick.kind).toBeGreaterThan(0);
      for (const t of list) expect(valid(s, t.action), JSON.stringify(t.action)).toBe(true);
      const keys = new Set(list.map((t) => JSON.stringify(t.action)));
      expect(keys.size).toBe(list.length);
    }
    expect(targetsFor(s, { kind: 'move', id: 'nada' })).toHaveLength(0);
  });
});

describe('ganar sitio tocando la escena', () => {
  it('marca los huecos que se pueden excavar y el solar de al lado, cada uno con su obra', () => {
    const s = open();
    const list = targetsFor(s, { kind: 'expand' });
    expect(list.some((t) => t.action.type === 'dig')).toBe(true);
    const plot = list.find((t) => t.action.type === 'buyPlot')!;
    expect(plot.label).toBe('Comprar solar');
    expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    for (const t of list) expect(valid(s, t.action)).toBe(true);
  });

  it('junto a una sala igual de nivel 1, construir sale como ampliarla', () => {
    const s = open();
    const list = targetsFor(s, { kind: 'build', type: 'mapas' });
    // La sala de mapas es única: no hay sitio. Una despensa nueva sí sale como sala nueva.
    expect(list).toHaveLength(0);
    expect(
      targetsFor(s, { kind: 'build', type: 'despensa' }).every((t) => t.label === 'Despensa'),
    ).toBe(true);
  });

  it('las salas únicas que ya están se amplían desde la cinta: a los lados y el salón hacia arriba', () => {
    const s = open();
    // Sin cocina, dormitorio ni capilla, el salón tiene sitio a la derecha y encima.
    const gone = ['cocina', 'dormitorio', 'capilla'];
    s.building.rooms = s.building.rooms.filter((r) => !gone.includes(r.type));
    const list = targetsFor(s, { kind: 'build', type: 'salon' });
    const dirs = list.map((t) => (t.action.type === 'extend' ? t.action.dir : null));
    expect(dirs).toContain('right');
    expect(dirs).toContain('up');
    for (const t of list) {
      expect(t.label).toBe('Ampliar salón');
      expect(valid(s, t.action)).toBe(true);
    }
  });
});
