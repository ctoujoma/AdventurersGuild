import { describe, expect, it } from 'vitest';
import { TRAIN_CAP } from '../core/balance';
import { newGame, reduce } from '../core/game';
import type { GameState, Room } from '../core/model';
import { canDrag, planDrop } from './drop';

const roomOf = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;

/** Aplica lo que diga soltar a alguien en una sala. */
function drop(s: GameState, who: string, room: string): GameState {
  const d = planDrop(s, who, room);
  if (!d.ok) throw new Error(d.text);
  return d.actions.reduce(reduce, s);
}

describe('arrastrar y soltar en las salas', () => {
  it('a trabajar, de guardia y a descansar', () => {
    let s = newGame('soltar');
    const h = s.heroes[0]!;
    expect(canDrag(s, h.id)).toBe(true);
    s = drop(s, h.id, roomOf(s, 'salon').id);
    expect(s.heroes[0]!.job).toBe(roomOf(s, 'salon').id);
    // Del salón a la puerta: deja el trabajo y se pone de guardia.
    s = drop(s, h.id, roomOf(s, 'recibidor').id);
    expect(s.heroes[0]).toMatchObject({ guard: true });
    expect(s.heroes[0]!.job).toBeUndefined();
    // De la guardia a la cocina directamente, si hay sitio (está Remedios y queda un puesto).
    s = drop(s, h.id, roomOf(s, 'cocina').id);
    expect(s.heroes[0]!.guard).toBeUndefined();
    expect(s.heroes[0]!.job).toBe(roomOf(s, 'cocina').id);
    // Y al dormitorio, a descansar.
    s = drop(s, h.id, roomOf(s, 'dormitorio').id);
    expect(s.heroes[0]!.job).toBeUndefined();
    expect(planDrop(s, h.id, roomOf(s, 'dormitorio').id)).toMatchObject({ ok: false });
  });

  it('dice por qué no: sala llena, rota o sin nada que hacer', () => {
    const s = newGame('no');
    const [a, b] = s.heroes;
    const full = drop(s, a!.id, roomOf(s, 'cocina').id);
    expect(planDrop(full, b!.id, roomOf(s, 'cocina').id)).toMatchObject({
      ok: false,
      text: expect.stringMatching(/puestos/),
    });
    expect(planDrop(s, a!.id, roomOf(s, 'enfermeria').id).text).toMatch(/en uso/);
    expect(planDrop(s, a!.id, roomOf(s, 'tesoro').id).text).toMatch(/nada que hacer/);
    // Los trabajadores no entrenan ni hacen guardia.
    const cook = s.workers[0]!;
    expect(planDrop(s, cook.id, roomOf(s, 'recibidor').id).ok).toBe(false);
    // De misión no se le puede coger.
    const sent = reduce(s, { type: 'send', questId: s.quests[0]!.id, heroIds: [a!.id] });
    expect(canDrag(sent, a!.id)).toBe(false);
  });

  it('a entrenar, salvo que ya esté en el tope de la sala', () => {
    const s = newGame('gimnasio');
    s.building.rooms.push({
      id: 'arm',
      type: 'armas',
      col: 4,
      floor: 0,
      w: 1,
      h: 1,
      level: 1,
      spent: 0,
    });
    const h = s.heroes[0]!;
    h.attrs.F = 3;
    expect(planDrop(s, h.id, 'arm')).toMatchObject({
      ok: true,
      text: expect.stringMatching(/Fuerza/),
    });
    h.attrs.F = TRAIN_CAP[1];
    expect(planDrop(s, h.id, 'arm').text).toMatch(/Mejora la sala/);
  });
});
