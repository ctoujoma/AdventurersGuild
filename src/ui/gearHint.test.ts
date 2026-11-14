import { describe, expect, it } from 'vitest';
import { newGame } from '../core/game';
import type { Item } from '../core/model';
import { gearHintText, upgradesFor } from './gearHint';

const item = (id: string, over: Partial<Item>): Item => ({
  id,
  name: id,
  desc: '',
  value: 10,
  kind: 'arma',
  icon: 'espada',
  bonus: { Combate: 2 },
  ...over,
});

describe('aviso de equipo mejor', () => {
  it('dice qué hay y para quién', () => {
    const espada = { slot: 'arma' as const, item: item('e', {}) };
    const botas = {
      slot: 'complemento' as const,
      item: item('b', { kind: 'armadura', icon: 'botas' }),
    };
    expect(gearHintText('Brena', [espada])).toBe('Hay una espada mejor en el arcón para Brena.');
    expect(gearHintText('Brena', [botas])).toBe('Hay unas botas mejores en el arcón para Brena.');
    expect(gearHintText('Tom', [espada, botas])).toBe(
      'Hay una espada y unas botas mejores en el arcón para Tom.',
    );
  });

  it('solo para quien puede cambiarse de equipo', () => {
    const s = newGame('aviso-equipo');
    s.inventory = [item('e', {})];
    const h = s.heroes[0]!;
    delete h.worn;
    expect(upgradesFor(s, h)).toHaveLength(1);
    h.status = 'mision';
    expect(upgradesFor(s, h)).toEqual([]);
  });
});
