import { describe, expect, it } from 'vitest';
import { ROOMS, type RoomType } from '../../data/rooms';
import type { Room } from '../../core/model';
import { furnish, gearRoom } from './furniture';
import { uncleBuilding } from '../../core/rooms';
import { NO_LOOK } from './salon';
import { SPOT } from './salas/recibidor';
import { ART, artMax } from './salas';
import { SILL, cellsOf } from './salas/kit';
import { CELL_W, DEPTH, PARTITION } from './layout';
import { scaleAt } from './view3d';

const room = (type: RoomType, r: Partial<Room> = {}): Room => ({
  id: 'x',
  type,
  col: 0,
  floor: 0,
  w: 1,
  h: 1,
  level: 1,
  spent: 0,
  ...r,
});

describe('muebles de la vista 3D', () => {
  it('cada sala en uso tiene sus muebles dentro y su farol encendido', () => {
    for (const type of Object.keys(ROOMS) as RoomType[]) {
      if (type === 'torre') continue;
      for (let w = 1; w <= ROOMS[type].maxW; w++)
        for (let level = 1; level <= artMax(type); level++) {
          const iw = w * CELL_W - PARTITION;
          const things = furnish(room(type, { w, level }), iw);
          expect(things.some((t) => t.hang && t.light)).toBe(true);
          for (const t of things) {
            const half = t.img.w / scaleAt(t.z) / 2;
            const at = `${type} ${w} ${level}`;
            expect(t.x - half, at).toBeGreaterThanOrEqual(-1);
            expect(t.x + half, at).toBeLessThanOrEqual(iw + 1);
            expect(t.z).toBeGreaterThan(0);
            expect(t.z).toBeLessThan(DEPTH);
          }
        }
    }
  });

  it('nada alto delante de una ventana: lo de debajo, más bajo que el alféizar (también en los niveles que solo se ven)', () => {
    for (const type of Object.keys(ART) as RoomType[]) {
      for (let w = 1; w <= ROOMS[type].maxW; w++)
        for (let level = 1; level <= artMax(type); level++) {
          const r = room(type, { w, level });
          const iw = w * CELL_W - PARTITION;
          const wins = cellsOf(r, iw).map((c) => c.win);
          for (const t of furnish(r, iw)) {
            const half = t.img.w / scaleAt(t.z) / 2;
            // Contra la pared (o colgado delante): si pisa el marco de una ventana, es bajo.
            if (!t.hang && t.z < DEPTH - 12) continue;
            const over = wins.some((x) => t.x + half > x - 13 && t.x - half < x + 13);
            if (!over) continue;
            expect(t.img.h, `${type} ${w} ${level}`).toBeLessThanOrEqual(t.hang ? 11 : SILL + 2);
          }
        }
    }
  });

  it('el fuego tiembla y tiene llamas; las salas rotas o en obras no dan luz', () => {
    for (const type of ['salon', 'cocina', 'forja'] as const) {
      const fire = furnish(room(type), CELL_W - PARTITION).find((t) => t.light?.flames);
      expect(fire?.light?.flicker).toBeGreaterThanOrEqual(0.2);
    }
    expect(furnish(room('salon', { level: 0 }), 110).some((t) => t.light)).toBe(false);
    expect(
      furnish(room('salon', { works: { kind: 'build', nights: 1 } }), 110).some((t) => t.light),
    ).toBe(false);
  });

  it('el equipo sin dueño se cuelga en la armería o se guarda en arcones', () => {
    const b = uncleBuilding();
    const arm = b.rooms.find((r) => r.type === 'armeria')!;
    // La del tío está por reparar: el equipo va a ella igualmente, en arcones.
    expect(gearRoom(b)).toBe(arm.id);
    const gear = Array.from({ length: 5 }, () => ({ icon: 'espada' as const, rarity: 0 as const }));
    const look = { ...NO_LOOK, gear, gearRoom: 'x' };
    const iw = CELL_W - PARTITION;
    const chests = (t: ReturnType<typeof furnish>) =>
      t.filter((x) => x.img.w === 18 && x.img.h === 14).length;
    expect(chests(furnish(room('armeria', { level: 0 }), iw, look))).toBe(2);
    // Reparada, un estante de 4 y lo que sobra (1) en un arcón.
    const lvl1 = furnish(room('armeria'), iw, look);
    expect(lvl1.filter((x) => x.y === 22)).toHaveLength(1);
    expect(chests(lvl1)).toBe(1);
    // Sin armería, a la cámara del tesoro.
    b.rooms = b.rooms.filter((r) => r !== arm);
    expect(gearRoom(b)).toBe(b.rooms.find((r) => r.type === 'tesoro')!.id);
  });

  it('recibidor: nada pasa del alféizar bajo la ventana ni se pone delante del armero', () => {
    const iw = CELL_W - PARTITION;
    // La ventana del hueco, vista en el fondo (de 65 a 95) y lo que mide hasta el alféizar.
    const win = [65, 95];
    for (const level of [1, 2, 3]) {
      const things = furnish(room('recibidor', { level }), iw).filter((t) => !t.hang);
      for (const t of things) {
        const half = t.img.w / scaleAt(t.z) / 2;
        if (t.x + half > win[0]! && t.x - half < win[1]!) expect(t.img.h).toBeLessThanOrEqual(32);
        // Los de guardia están delante del armero: ahí no hay muebles.
        for (const g of SPOT.guards) expect(Math.abs(t.x - g), `${level}`).toBeGreaterThan(half);
      }
    }
  });
});
