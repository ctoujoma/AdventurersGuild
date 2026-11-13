import { describe, expect, it } from 'vitest';
import { roomMax } from '../core/balance';
import { ROOMS, type RoomType } from './rooms';
import { ROOM_INFO, roomEffect } from './roomInfo';

const TYPES = Object.keys(ROOMS) as RoomType[];

describe('qué da cada nivel de sala («Ahora» y «Mejora»)', () => {
  it('todas las salas tienen su texto', () => {
    for (const t of TYPES) expect(ROOM_INFO[t], t).toBeTypeOf('function');
  });

  it('cada nivel posible de cada sala dice algo, sea del tamaño que sea', () => {
    for (const t of TYPES)
      for (let cells = 1; cells <= ROOMS[t].maxW * ROOMS[t].maxH; cells++)
        for (let l = 0; l <= roomMax(t); l++) {
          const text = roomEffect(t, l, cells);
          expect(text.trim().length, `${t} nivel ${l}`).toBeGreaterThan(5);
          expect(text, `${t} nivel ${l}`).not.toMatch(/undefined|NaN|null/);
        }
  });

  it('mejorar siempre dice algo nuevo: cada nivel se distingue del anterior', () => {
    for (const t of TYPES)
      for (let l = 0; l < roomMax(t); l++)
        expect(roomEffect(t, l + 1, 2), `${t} del ${l} al ${l + 1}`).not.toBe(roomEffect(t, l, 2));
  });

  it('las cifras salen del núcleo', () => {
    expect(roomEffect('dormitorio', 2, 2)).toContain('6 camas');
    expect(roomEffect('despensa', 2, 1)).toContain('60 raciones');
    expect(roomEffect('servicio', 1, 2)).toContain('4 camas');
    expect(roomEffect('pintor', 3)).toContain('2 pintores');
    expect(roomEffect('salon', 3)).toContain('+2 encargos');
  });
});
