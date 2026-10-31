import { describe, expect, it } from 'vitest';
import { SCHEDULE, TRAIN_CAP } from '../core/balance';
import { newGame, salaries } from '../core/game';
import type { GameState, Room } from '../core/model';
import { finishedWorks, gatherAlerts } from './alerts';

const roomOf = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;
const ids = (s: GameState, done?: string[]) => gatherAlerts(s, done).map((a) => a.id);

describe('avisos de la campanita', () => {
  it('una partida nueva no tiene nada pendiente', () => {
    expect(gatherAlerts(newGame('tranquila'))).toEqual([]);
  });

  it('el pago que no llega, solo cuando está cerca, y el primero de la lista', () => {
    const s = newGame('pago');
    const pay = SCHEDULE[0]!;
    s.gold = 0;
    s.day = pay.day - 5;
    expect(ids(s).some((id) => id.startsWith('pago:'))).toBe(false);
    s.day = pay.day - 1;
    const a = gatherAlerts(s)[0]!;
    expect(a.id).toBe(`pago:${pay.day}`);
    expect(a.k).toBe('bad');
    expect(a.text).toMatch(/^Mañana toca pagar/);
    expect(a.go).toEqual({ panel: 'gremio' });
    // Con oro de sobra, nada.
    s.gold = pay.amount + salaries(s);
    expect(ids(s).some((id) => id.startsWith('pago:'))).toBe(false);
  });

  it('los encargos que se van esta noche: uno lleva a su hoja; varios, al tablón', () => {
    const s = newGame('caduca');
    for (const q of s.quests) q.expires = 3;
    s.quests[0]!.expires = 1;
    const one = gatherAlerts(s).find((a) => a.id.startsWith('caduca'))!;
    expect(one.go).toEqual({ quest: s.quests[0]!.id });
    s.quests[1]!.expires = 1;
    const many = gatherAlerts(s).find((a) => a.id.startsWith('caducan'))!;
    expect(many.text).toMatch(/^2 encargos/);
    expect(many.go).toEqual({ panel: 'tablon' });
  });

  it('el grupo que vuelve esta noche', () => {
    const s = newGame('vuelve');
    const q = s.quests[0]!;
    s.missions.push({ id: 'm1', quest: q, heroIds: [s.heroes[0]!.id], daysLeft: 2 });
    expect(ids(s)).not.toContain('vuelve:m1');
    s.missions[0]!.daysLeft = 1;
    expect(ids(s)).toContain('vuelve:m1');
  });

  it('los heridos sin nadie en la enfermería llevan a ella', () => {
    const s = newGame('heridos');
    const h = s.heroes[0]!;
    h.status = 'herido';
    h.days = 3;
    const a = gatherAlerts(s).find((x) => x.id === 'heridos')!;
    expect(a.text).toContain(h.name);
    expect(a.go).toEqual({ room: roomOf(s, 'enfermeria').id });
  });

  it('la sala sin nadie lleva a la sala; quien no tiene tarea, a Tareas', () => {
    const s = newGame('casa');
    const cook = s.workers.find((w) => w.trade === 'cocina')!;
    cook.room = undefined;
    const cocina = roomOf(s, 'cocina');
    expect(gatherAlerts(s).find((a) => a.id === `vacia:${cocina.id}`)?.go).toEqual({
      room: cocina.id,
    });
    expect(gatherAlerts(s).find((a) => a.id === `tarea:${cook.id}`)?.go).toEqual({
      crew: cook.id,
    });
  });

  it('quien entrena en el tope de la sala', () => {
    const s = newGame('tope');
    // Al empezar no hay sala de armas: la forja hace de ella.
    const sala = roomOf(s, 'forja');
    sala.type = 'armas';
    sala.level = 1;
    const h = s.heroes[0]!;
    h.job = sala.id;
    h.attrs.F = TRAIN_CAP[sala.level]!;
    expect(gatherAlerts(s).find((a) => a.id === `tope:${h.id}`)?.go).toEqual({ room: sala.id });
  });

  it('la obra terminada se avisa mientras la interfaz la recuerde', () => {
    const before = newGame('obra');
    const r = roomOf(before, 'bodega');
    r.works = { kind: 'extend', nights: 1 };
    const after = structuredClone(before);
    delete roomOf(after, 'bodega').works;
    expect(finishedWorks(before, after)).toEqual([r.id]);
    expect(ids(after, [r.id])).toContain(`obra:${r.id}`);
    // Si la sala sigue en obras (o ya no está), nada.
    expect(ids(before, [r.id])).not.toContain(`obra:${r.id}`);
  });
});
