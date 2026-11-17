import { describe, expect, it } from 'vitest';
import { newGame } from '../../core/game';
import { sharedUniforms } from './gl';
import { IncidentArt } from './incidents';
import { roomsLayout } from './layout';

/** Un ladrón nocturno en la cámara del tesoro que pelea con el de guardia y acaba `how`. */
const duel = (how: 'bien' | 'mal') => {
  const b = newGame('farol').building;
  const L = roomsLayout(b);
  const vault = b.rooms.find((r) => r.type === 'tesoro')!;
  const art = new IncidentArt(sharedUniforms(), () => ({ ambient: [1, 1, 1], sun: 0 }));
  const inc = { id: 'i1', kind: 'nocturno' as const, room: vault.id, from: 0, until: 22 };
  const clock = { day: 1, secs: 30 };
  art.set(L, b, [inc], clock);
  const run = (s: number) => {
    for (let i = 0; i < s / 0.05; i++) art.update(0.05, 0);
  };
  run(0.2);
  const x = art.thiefAt(vault.id)!.x;
  art.duel(vault.id, x - 15);
  run(0.2);
  expect(art.lanterns()[0]?.fallen).toBe(true);
  art.set(L, b, [], clock, [{ id: 'i1', kind: 'nocturno', room: vault.id, how }]);
  return { art, run };
};

describe('el farol del ladrón nocturno al acabar el duelo', () => {
  it('si le pillan, sigue encendido en el suelo un momento, se apaga y se va', () => {
    const { art, run } = duel('bien');
    run(0.6);
    expect(art.lanterns()[0]).toMatchObject({ fallen: true, power: 1 });
    run(1.1);
    const p = art.lanterns()[0]!.power;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    run(1);
    expect(art.lanterns()).toEqual([]);
    expect(art.group.children.length).toBe(0);
  });

  it('si se escapa, lo recoge y se lo lleva (tapado), y se va con él', () => {
    const { art, run } = duel('mal');
    run(0.1);
    expect(art.lanterns()[0]?.fallen).toBe(false);
    run(120);
    expect(art.lanterns()).toEqual([]);
    expect(art.group.children.length).toBe(0);
  });
});
