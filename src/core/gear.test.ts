import { describe, expect, it } from 'vitest';
import { betterGear, gearPower } from './gear';
import type { Item } from './model';

const item = (id: string, over: Partial<Item>): Item => ({
  id,
  name: id,
  desc: '',
  value: 10,
  kind: 'arma',
  icon: 'espada',
  ...over,
});

describe('equipo mejor en el arcón', () => {
  it('cuenta bonos, temple y efecto', () => {
    expect(gearPower(item('a', { bonus: { Combate: 2, Trampas: 1 } }))).toBe(3);
    expect(gearPower(item('b', { bonus: { Combate: 2 }, plus: 2, perk: 'luck' }))).toBe(5);
    expect(gearPower(item('c', {}))).toBe(0);
  });

  it('avisa si no lleva nada en la ranura y elige lo mejor de cada una', () => {
    const stock = [
      item('corta', { bonus: { Combate: 2 } }),
      item('hoja', { bonus: { Combate: 5 } }),
      item('capa', { kind: 'armadura', icon: 'capa', bonus: { Supervivencia: 2 } }),
    ];
    const up = betterGear({}, stock);
    expect(up.map((u) => [u.slot, u.item.id])).toEqual([
      ['arma', 'hoja'],
      ['cuerpo', 'capa'],
    ]);
  });

  it('no avisa si lo que lleva da lo mismo o más', () => {
    const worn = { arma: item('suya', { bonus: { Combate: 3 }, plus: 1 }) };
    expect(betterGear({ worn }, [item('otra', { bonus: { Combate: 4 } })])).toEqual([]);
    expect(betterGear({ worn }, [item('mejor', { bonus: { Combate: 5 } })])).toHaveLength(1);
  });

  it('los tesoros y lo que no da nada no cuentan', () => {
    const stock = [
      item('copa', { kind: 'tesoro', icon: undefined, bonus: { Combate: 9 } }),
      item('palo', {}),
    ];
    expect(betterGear({}, stock)).toEqual([]);
  });
});
