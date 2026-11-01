import { describe, expect, it } from 'vitest';
import { newGame, planIssue, reduce, tryWorks, type Action } from './game';
import { roomAt } from './rooms';
import type { GameState } from './model';
import { finishTutorial, startObras, tutorialOn, tutorialStep } from './tutorial';
import { obrasPath, obrasVeto } from './tutorialObras';

/** La taberna del tío el día que se paga la deuda: obras abiertas y la caja que se quiera. */
const paidOff = (gold: number): GameState => ({ ...newGame('obras'), gold, mode: 'libre' });
const idOf = (s: GameState, type: string) => s.building.rooms.find((r) => r.type === type)!.id;

describe('tutorial de obras: ampliar el salón y la cámara', () => {
  it('con un solar: la cocina se muda al solar nuevo y la cámara crece bajo él', () => {
    const s = paidOff(1000);
    const steps: Action[] = [
      { type: 'buyPlot' },
      { type: 'move', id: idOf(s, 'cocina'), col: 4, floor: 0 },
      { type: 'extend', id: idOf(s, 'salon'), dir: 'right' },
      { type: 'dig', col: 4, floor: -1 },
      { type: 'extend', id: idOf(s, 'tesoro'), dir: 'right' },
    ];
    const next = tryWorks(s, steps);
    if ('error' in next) throw new Error(next.error);
    expect(planIssue(next)).toBeNull();
    const after = reduce(s, { type: 'works', steps });
    const salon = after.building.rooms.find((r) => r.type === 'salon')!;
    const tesoro = after.building.rooms.find((r) => r.type === 'tesoro')!;
    expect([salon.col, salon.w]).toEqual([1, 3]);
    expect([tesoro.col, tesoro.w]).toEqual([3, 2]);
    expect(roomAt(after.building, 4, 0)?.type).toBe('cocina');
    // Solar 150, mudanza 15, ampliar el salón 54, excavar 60 y ampliar la cámara 72.
    expect(s.gold - after.gold).toBe(351);
  });

  it('sin solar: cocina y forja suben a la segunda planta', () => {
    const s = paidOff(1000);
    const steps: Action[] = [
      { type: 'move', id: idOf(s, 'cocina'), col: 1, floor: 2 },
      { type: 'extend', id: idOf(s, 'salon'), dir: 'right' },
      { type: 'move', id: idOf(s, 'forja'), col: 2, floor: 2 },
      { type: 'extend', id: idOf(s, 'tesoro'), dir: 'left' },
    ];
    const next = tryWorks(s, steps);
    if ('error' in next) throw new Error(next.error);
    expect(planIssue(next)).toBeNull();
    const after = reduce(s, { type: 'works', steps });
    const salon = after.building.rooms.find((r) => r.type === 'salon')!;
    const tesoro = after.building.rooms.find((r) => r.type === 'tesoro')!;
    expect([salon.col, salon.w]).toEqual([1, 3]);
    expect([tesoro.col, tesoro.w]).toEqual([2, 2]);
    // Dos mudanzas de 15, ampliar el salón 54 y la cámara 72.
    expect(s.gold - after.gold).toBe(156);
  });
});

describe('tutorial de obras: los pasos', () => {
  /** Recién pagada la deuda, con el tutorial de obras arrancado (ya pasado el respiro). */
  const started = (gold: number) => {
    const s = structuredClone(paidOff(gold));
    s.tutorial = { step: 0, track: 'obras', letter: true, wait: true };
    return reduce(s, { type: 'tutorial', op: 'listo' });
  };
  const at = (s: GameState) => tutorialStep(s)?.id;

  it('sigue el borrador paso a paso, vuelve atrás al deshacer y acaba al pagar', () => {
    let s = started(1000);
    expect(at(s)).toBe('o-martillo');
    const path = obrasPath(s);
    expect(path).toHaveLength(5);
    s = reduce(s, { type: 'tutorialWorks', steps: [] });
    expect(at(s)).toBe('o-solar');
    const ids = ['o-mudar', 'o-salon', 'o-excavar', 'o-camara', 'o-pagar'];
    for (let i = 1; i <= path.length; i++) {
      s = reduce(s, { type: 'tutorialWorks', steps: path.slice(0, i) });
      expect(at(s)).toBe(ids[i - 1]);
    }
    // Deshacer la última obra vuelve un paso; salir sin pagar, al martillo.
    expect(at(reduce(s, { type: 'tutorialWorks', steps: path.slice(0, 4) }))).toBe('o-camara');
    expect(at(reduce(s, { type: 'tutorialWorks', steps: null }))).toBe('o-martillo');
    s = reduce(s, { type: 'works', steps: path });
    s = reduce(s, { type: 'tutorialWorks', steps: null });
    expect(at(s)).toBe('o-fin');
    s = reduce(s, { type: 'tutorial', op: 'ok' });
    expect(tutorialOn(s)).toBe(false);
    expect(s.tips).toEqual(expect.arrayContaining(['obras', 'plano', 'excavar', 'servicio']));
  });

  it('el cuaderno pone lo que falta para el camino', () => {
    const s = started(100);
    expect(s.gold).toBe(351);
  });

  it('solo deja apuntar la obra del paso, y dice por qué', () => {
    let s = started(1000);
    s = reduce(s, { type: 'tutorialWorks', steps: [] });
    const st = tutorialStep(s)!;
    expect(obrasVeto(s, st, { type: 'buyPlot' })).toBeNull();
    expect(obrasVeto(s, st, { type: 'dig', col: 0, floor: -2 })).toMatch(/solar/);
  });

  it('empieza al pagar la deuda si se jugó con el tutorial', () => {
    const s = newGame('obras', { tutorial: true });
    finishTutorial(s);
    startObras(s);
    expect(s.tutorial?.track).toBe('obras');
    const off = { ...newGame('obras', { tutorial: true }), tips: ['*'] };
    startObras(off);
    expect(off.tutorial?.track).toBeUndefined();
    const none = newGame('obras');
    startObras(none);
    expect(none.tutorial).toBeUndefined();
  });
});
