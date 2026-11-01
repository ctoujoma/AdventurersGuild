import { describe, expect, it } from 'vitest';
import { newGame, reduce, tryWorks, type Action } from './game';
import { targetsFor } from '../world/rooms/works';
import { laxly } from './rooms';

describe('borrador de obras guardado', () => {
  it('se guarda, se olvida y desaparece al pagar las obras', () => {
    const s = { ...newGame('borrador'), gold: 5000, mode: 'libre' as const };
    const t = laxly(() => targetsFor(s, { kind: 'stair' }))[0]!;
    const steps: Action[] = [t.action];
    expect('error' in tryWorks(s, steps)).toBe(false);
    const kept = reduce(s, { type: 'worksDraft', steps });
    expect(kept.worksDraft).toEqual(steps);
    expect(reduce(kept, { type: 'worksDraft', steps: null }).worksDraft).toBeUndefined();
    const paid = reduce(kept, { type: 'works', steps });
    expect(paid).not.toBe(kept);
    expect(paid.worksDraft).toBeUndefined();
  });
});
