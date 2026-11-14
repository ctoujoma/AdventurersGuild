import { describe, expect, it } from 'vitest';
import type { Building } from '../../core/model';
import { uncleBuilding } from '../../core/rooms';
import { seatsOf } from '../../core/salon';
import { galleryOf } from './galeria';
import { roomsLayout } from './layout';
import { insides, route, segments, spots } from './people';

/** La casa del tío con el salón de 3×2 (sin lo que había encima). */
function tall(): Building {
  const b = uncleBuilding();
  const s = b.rooms.find((r) => r.type === 'salon')!;
  const salon = { ...s, w: 3, h: 2, level: 3 };
  const over = (r: Building['rooms'][number]) =>
    r !== s &&
    r.floor <= salon.floor + 1 &&
    r.floor + r.h > salon.floor &&
    r.col < salon.col + 3 &&
    r.col + r.w > salon.col;
  return { ...b, rooms: [...b.rooms.filter((r) => r !== s && !over(r)), salon] };
}

describe('la galería del salón', () => {
  it('solo en el de dos alturas y tres huecos, con seis plazas más', () => {
    const b = tall();
    const salon = b.rooms.find((r) => r.type === 'salon')!;
    expect(galleryOf(salon, 362, 'recta')!.seats).toHaveLength(6);
    expect(galleryOf({ ...salon, h: 1 }, 362)).toBeNull();
    expect(galleryOf({ ...salon, w: 2 }, 236)).toBeNull();
    expect(seatsOf(b)).toBe(5 * 2 + 6);
  });

  it('las dos escaleras van del suelo del salón al de la galería', () => {
    const salon = tall().rooms.find((r) => r.type === 'salon')!;
    for (const kind of ['recta', 'caracol'] as const) {
      const g = galleryOf(salon, 362, kind)!;
      expect(g.steps[0]!.y).toBe(0);
      expect(g.steps.at(-1)!.y).toBeCloseTo(106);
      // Arriba se llega por donde se anda en la galería.
      const top = g.steps.at(-1)!.x;
      expect(top).toBeGreaterThanOrEqual(g.walk[0]);
      expect(top).toBeLessThanOrEqual(g.walk[1]);
    }
  });

  it('a una mesa de arriba se sube por la escalera del salón, no por la de la casa', () => {
    const L = roomsLayout(tall());
    const salon = L.rooms.find((r) => r.room.type === 'salon')!;
    const S = spots(L);
    const up = S.seats.filter((s) => s.floor === salon.room.floor + 1);
    expect(up).toHaveLength(6);
    // La galería es un tramo aparte en la planta de arriba.
    const segs = segments(L).get(salon.room.floor + 1)!;
    expect(segs.some(([a, b]) => up.every((s) => s.x >= a && s.x <= b))).toBe(true);
    const from = { x: salon.rect.x + salon.rect.w / 2, floor: salon.room.floor };
    const path = route(L, from, { x: up[0]!.x, floor: up[0]!.floor })!;
    expect(path).not.toBeNull();
    const [fl] = insides(L).flights;
    // Sube por su tramo: del pie a lo alto de la escalera de dentro.
    const i = path.findIndex((p) => p.floor === salon.room.floor + 1);
    expect(path[i]!.flight).toBe(fl);
    expect(path[i - 1]!.x).toBeCloseTo(fl!.steps[0]!.x);
  });
});
