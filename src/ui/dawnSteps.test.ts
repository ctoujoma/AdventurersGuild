import { describe, expect, it } from 'vitest';
import type { DawnEvent } from '../core/model';
import { MANY, dawnPages, delayAfter, stepsOf } from './dawnSteps';

const ev = (t: string, k?: DawnEvent['k'], big?: boolean): DawnEvent => ({
  t,
  ...(k ? { k } : {}),
  ...(big ? { big } : {}),
});

describe('la carta del amanecer, una a una', () => {
  it('con pocas noticias, cada una es un paso, en su orden', () => {
    const events = [ev('a'), ev('b', 'good'), ev('c', 'bad')];
    expect(stepsOf(events).map((s) => s.list[0]!.t)).toEqual(['a', 'b', 'c']);
  });

  it('con muchas, las pequeñas van juntas al final y plegadas', () => {
    const events = [
      ev('rango', 'good', true),
      ...Array.from({ length: MANY }, (_, i) => ev(`menuda ${i}`)),
      ev('pelea', 'bad'),
    ];
    const steps = stepsOf(events);
    expect(steps.map((s) => s.list[0]!.t)).toEqual(['rango', 'pelea', 'menuda 0']);
    expect(steps.at(-1)!.more).toBe(true);
    expect(steps.at(-1)!.list).toHaveLength(MANY);
  });

  it('«Mientras no estabas»: un día por página', () => {
    const pages = dawnPages(
      [ev('Día 4', undefined), ev('x', 'good'), ev('Día 5'), ev('y'), ev('z', 'warn')].map(
        (e, i) => (i === 0 || i === 2 ? { ...e, head: true } : e),
      ),
    );
    expect(pages.map((p) => p.head)).toEqual(['Día 4', 'Día 5']);
    expect(pages[1]!.steps).toHaveLength(2);
  });

  it('sin encabezados, una sola página', () => {
    expect(dawnPages([ev('a'), ev('b')])).toHaveLength(1);
    expect(dawnPages([])[0]!.steps).toEqual([]);
  });

  it('lo grande se deja ver más rato que lo demás', () => {
    expect(delayAfter({ list: [ev('a', 'good', true)] })).toBeGreaterThan(
      delayAfter({ list: [ev('b', 'good')] }),
    );
  });
});
