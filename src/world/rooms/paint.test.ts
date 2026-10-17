import { describe, expect, it } from 'vitest';
import { maxOut, uncleBuilding } from '../../core/rooms';
import { alpha } from '../../art/pixel';
import { roomsLayout } from './layout';
import { paintRooms } from './paint';

const opts = {
  crest: { field: '#a22633', dark: '#3e2731', symbol: 'jarra' },
  yard: { establo: 0, patio: 0, empal: 0 },
};

describe('pintar el gremio por salas', () => {
  it('pinta la taberna del tío entera: cada sala tiene su caja y las rotas no dan luz', () => {
    const L = roomsLayout(uncleBuilding());
    const W = paintRooms(L, opts);
    expect(W.back.w).toBe(L.x1 - L.x0);
    expect(W.back.h).toBe(L.y1 - L.y0);
    for (const { rect } of L.rooms) {
      const c = W.back.get(
        Math.round(rect.x + rect.w / 2 - W.ox),
        Math.round(rect.y + rect.h / 2 - W.oy),
      );
      expect(alpha(c)).toBe(255);
    }
    const lit = L.rooms.filter((x) => x.room.level > 0 && x.room.type !== 'torre').length;
    expect(W.lights.length).toBeGreaterThanOrEqual(lit);
    for (const l of W.lights) {
      expect(l.x).toBeGreaterThan(L.x0);
      expect(l.x).toBeLessThan(L.x1);
      expect(l.y).toBeGreaterThan(L.y0);
      expect(l.y).toBeLessThan(L.y1);
    }
  });

  it('con todo al máximo, con patio y obras, también se pinta', () => {
    const b = uncleBuilding();
    maxOut(b);
    b.yard = { establo: 2, patio: 2, empal: 2 };
    b.rooms.find((r) => r.type === 'cocina')!.works = { kind: 'build', nights: 1 };
    const W = paintRooms(roomsLayout(b), { ...opts, yard: b.yard });
    expect(W.ambient.length).toBeGreaterThan(b.rooms.length);
  });
});
