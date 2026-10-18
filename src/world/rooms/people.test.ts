import { describe, expect, it } from 'vitest';
import { maxOut, uncleBuilding } from '../../core/rooms';
import { colX, floorTop, roomsLayout } from './layout';
import { homes, outside, route, segments, spots, wander, type Place } from './people';

const L0 = () => roomsLayout(uncleBuilding());
const centerOf = (L: ReturnType<typeof L0>, type: string): Place => {
  const r = L.rooms.find((x) => x.room.type === type)!;
  return { x: r.rect.x + r.rect.w / 2, floor: r.room.floor };
};

describe('la gente de la casa', () => {
  it('cada planta tiene sus tramos; el patio se junta con el recibidor', () => {
    const S = segments(L0());
    const ground = S.get(0)!;
    expect(ground).toHaveLength(1);
    expect(ground[0]![0]).toBeLessThan(0);
    // Planta 2: solo la sala de mapas y la escalera, juntas.
    expect(S.get(2)).toHaveLength(1);
  });

  it('del recibidor al dormitorio se sube por la escalera', () => {
    const L = L0();
    const path = route(L, centerOf(L, 'recibidor'), centerOf(L, 'dormitorio'))!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual(centerOf(L, 'dormitorio'));
    // Sube en la escalera: dos puntos seguidos con la misma x y distinta planta.
    const climb = path.findIndex(
      (p, i) => i > 0 && p.x === path[i - 1]!.x && p.floor !== path[i - 1]!.floor,
    );
    expect(climb).toBeGreaterThan(0);
    const sx = L.stairs[0]!;
    expect(path[climb]!.x).toBeGreaterThan(sx);
    expect(path[climb]!.x).toBeLessThan(sx + 40);
  });

  it('a la bodega se baja y al patio se sale por la puerta; a un hueco vacío no se llega', () => {
    const L = L0();
    expect(route(L, centerOf(L, 'mapas'), centerOf(L, 'bodega'))).not.toBeNull();
    expect(route(L, centerOf(L, 'salon'), outside())).toEqual([outside()]);
    expect(route(L, centerOf(L, 'salon'), { x: colX(L.b, 2) + 60, floor: 2 })).toBeNull();
    expect(floorTop(0)).toBeLessThan(floorTop(-1));
  });

  it('con dos escaleras se va por la más corta', () => {
    const b = uncleBuilding();
    maxOut(b);
    b.stairs = [1, 3];
    const L = roomsLayout(b);
    const from = { x: colX(b, 3) + 60, floor: 0 };
    const to = { x: colX(b, 3) + 60, floor: 1 };
    const path = route(L, from, to)!;
    expect(path[0]!.x).toBeCloseTo(L.stairs[1]! + 20, 5);
  });

  it('cada uno tiene su sitio: heridos en catres, guardias en el recibidor, candidatos en la barra', () => {
    const b = uncleBuilding();
    b.rooms.find((r) => r.type === 'enfermeria')!.level = 1;
    const S = spots(roomsLayout(b));
    expect(S.cots.length).toBeGreaterThan(0);
    expect(S.beds.length).toBeGreaterThan(0);
    const h = homes(
      [
        { id: 'a', status: 'herido' },
        { id: 'b', status: 'ok', guard: true },
        { id: 'c', status: 'ok' },
        { id: 'd', status: 'candidato' },
        { id: 'e', status: 'mision' },
      ],
      S,
    );
    expect(h.get('a')?.bed?.kind).toBe('catre');
    expect(h.get('b')?.place).toEqual(S.guard[0]);
    expect(h.get('c')?.bed?.kind).toBe('litera');
    expect(h.get('d')?.place).toEqual(S.bar[0]);
    expect(h.has('e')).toBe(false);
  });

  it('de día se va al salón o a dar una vuelta por las salas en uso', () => {
    const S = spots(L0());
    let i = 0;
    const seq = [0.1, 0.5, 0.3, 0.5, 0.9, 0.2, 0.5];
    const rnd = () => seq[i++ % seq.length]!;
    const goals = Array.from({ length: 6 }, () => wander(S, new Set(), rnd)!);
    expect(goals.some((g) => g.pose === 'sit')).toBe(true);
    for (const g of goals) expect(route(L0(), S.door, g.place)).not.toBeNull();
  });
});
