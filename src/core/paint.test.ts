import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, PAINT_GOLD, PAINT_WALK } from './balance';
import { customOf, endDay, newGame, reduce } from './game';
import type { GameState } from './model';
import { painterAt, paintState, paintStatus, paintingOf } from './paint';

/** Partida con un taller del pintor (y su pintor, si `painter`). */
function withShop(seed: string, painter = true): { s: GameState; shop: string; room: string } {
  const s = newGame(seed);
  const shop = {
    id: 'taller-pintor',
    type: 'pintor' as const,
    col: s.building.cols,
    floor: 0,
    w: 1,
    h: 1,
    level: 1,
    spent: 0,
  };
  s.building.cols++;
  s.building.rooms.push(shop);
  if (painter)
    s.workers.push({
      id: 'w-pintor',
      seed: 'pintor',
      name: 'Tano',
      sex: 'm',
      skill: 4,
      trade: 'pintor',
      xp: 0,
      salary: 5,
      fee: 0,
      room: shop.id,
      quote: '',
    });
  s.gold = 500;
  s.unlocks = ['tint:mar'];
  const room = s.building.rooms.find((r) => r.type === 'cocina')!.id;
  return { s, shop: shop.id, room };
}

describe('el taller del pintor', () => {
  it('sin taller o sin pintor, los colores de las salas no se pueden cambiar', () => {
    const s = newGame('sin-taller');
    const room = s.building.rooms.find((r) => r.type === 'cocina')!.id;
    expect(paintStatus(s, room, 'vino')).toMatchObject({ state: 'none' });
    const empty = withShop('sin-pintor', false);
    expect(paintStatus(empty.s, empty.room, 'vino')).toMatchObject({ state: 'nobody' });
    expect(reduce(empty.s, { type: 'paint', room: empty.room, tint: 'vino' })).toBe(empty.s);
  });

  it('dice si el color está bloqueado, si falta dinero o si ya es de ese color', () => {
    const { s, room } = withShop('estados');
    expect(paintStatus(s, room, 'ocre')).toMatchObject({ state: 'lock' });
    expect(paintStatus(s, room, null)).toMatchObject({ state: 'same' });
    expect(paintStatus({ ...s, gold: 2 }, room, 'mar')).toMatchObject({ state: 'gold' });
    expect(paintStatus(s, room, 'mar')).toEqual({ state: 'ok', cost: PAINT_GOLD });
  });

  it('cobra, el pintor va a la sala y no pinta hasta que llega; al acabar, cambia el color', () => {
    const { s, room } = withShop('pintar');
    s.clock = DAY_SECONDS * 0.2;
    let t = reduce(s, { type: 'paint', room, tint: 'mar' });
    expect(t.gold).toBe(s.gold - PAINT_GOLD);
    const p = paintingOf(t, room)!;
    expect(painterAt(t, 'w-pintor')).toBe(room);
    expect(paintState(t, p)).toMatchObject({ walking: true, frac: 0 });
    // Otra sala no puede: el único pintor está ocupado.
    const other = t.building.rooms.find((r) => r.type === 'bodega')!.id;
    expect(paintStatus(t, other, 'mar')).toMatchObject({ state: 'busy' });
    expect(paintStatus(t, room, 'vino')).toMatchObject({ state: 'painting' });
    // Llega (lo dice la escena) y empieza a pintar.
    t = reduce(t, { type: 'arrived', heroId: 'w-pintor', room });
    expect(paintState(t, paintingOf(t, room)!).walking).toBe(false);
    t = reduce(t, { type: 'tick', to: t.clock! + DAY_SECONDS * 0.05 });
    expect(paintState(t, paintingOf(t, room)!).frac).toBeGreaterThan(0);
    expect(customOf(t).colors?.[room]).toBeUndefined();
    // Al acabar, la sala luce el color nuevo y el pintor vuelve a su taller.
    t = endDay(t, true);
    expect(paintingOf(t, room)).toBeUndefined();
    expect(customOf(t).colors?.[room]).toBe('mar');
    expect(t.stats?.painted).toBe(1);
    expect(painterAt(t, 'w-pintor')).toBeNull();
    expect(t.dawn.some((e) => /ha acabado de pintar/.test(e.t))).toBe(true);
  });

  it('con el juego abierto no empieza hasta que llega; cerrado, a las horas de camino', () => {
    const { s, room } = withShop('camino');
    s.clock = DAY_SECONDS * 0.2;
    const t = reduce(s, { type: 'paint', room, tint: 'mar' });
    // Abierto: pasan las horas de camino y más, y sin llegar no se pinta nada.
    const later = reduce(t, {
      type: 'tick',
      to: t.clock! + DAY_SECONDS * ((PAINT_WALK + 3) / 24),
    });
    expect(paintingOf(later, room)!.done).toBe(0);
    expect(paintState(later, paintingOf(later, room)!).walking).toBe(true);
    // Pasa la noche sin llegar: sigue esperando (mañana irá a la sala).
    const next = endDay(later);
    expect(paintingOf(next, room)!.wait).toBe(true);
    expect(paintingOf(next, room)!.done).toBe(0);
    // Con el juego cerrado (sin escena), se le da por llegado y pinta.
    const away = endDay(later, true);
    const p = paintingOf(away, room);
    expect(p ? p.done > 0 : customOf(away).colors?.[room] === 'mar').toBe(true);
  });

  it('cancelar devuelve lo pagado; sin pintor, se cancela solo', () => {
    const { s, room } = withShop('cancelar');
    const t = reduce(s, { type: 'paint', room, tint: 'mar' });
    const back = reduce(t, { type: 'cancelPaint', id: paintingOf(t, room)!.id });
    expect(back.gold).toBe(s.gold);
    expect(back.paints).toBeUndefined();
    const fired = structuredClone(t);
    fired.workers = fired.workers.filter((w) => w.id !== 'w-pintor');
    const next = endDay(fired, true);
    expect(next.paints).toBeUndefined();
    expect(customOf(next).colors?.[room]).toBeUndefined();
  });
});
