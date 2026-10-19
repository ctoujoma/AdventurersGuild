import { describe, expect, it } from 'vitest';
import { newGame, tryWorks } from '../core/game';
import { touchedRooms } from './works';

describe('salas tocadas al pagar las obras', () => {
  it('salen las mejoradas y las movidas, no las demás', () => {
    const s = newGame('tocadas');
    s.mode = 'libre';
    s.gold = 5000;
    const salon = s.building.rooms.find((r) => r.type === 'salon')!;
    const after = tryWorks(s, [{ type: 'upgradeRoom', id: salon.id }]);
    if ('error' in after) throw new Error(after.error);
    expect(touchedRooms(s, after)).toEqual([salon.id]);
    expect(touchedRooms(s, s)).toEqual([]);
  });
});
