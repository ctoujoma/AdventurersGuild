import { describe, expect, it } from 'vitest';
import { alpha } from '../../art/pixel';
import { uncleBuilding } from '../../core/rooms';
import { furnish } from './furniture';
import { chalkPlan, ruinThings } from './ruina';

const broken = (type: string) => uncleBuilding().rooms.find((r) => r.type === type)!;

describe('salas rotas', () => {
  it('arriba entra luz por el techo (fija, de día y de noche); bajo tierra, no', () => {
    const up = broken('enfermeria');
    const down = broken('forja');
    expect(up.level).toBe(0);
    expect(down.floor).toBeLessThan(0);
    expect(ruinThings(up, 110).some((t) => t.light?.steady)).toBe(true);
    expect(ruinThings(down, 110).some((t) => t.light)).toBe(false);
  });

  it('el plano en tiza dibuja los muebles que tendrá al repararla', () => {
    const room = broken('enfermeria');
    const plan = chalkPlan(furnish({ ...room, level: 1 }, 110, undefined), 110, 90, 59);
    let n = 0;
    for (let i = 0; i < plan.w * plan.h; i++) if (alpha(plan.data[i]!)) n++;
    expect(n).toBeGreaterThan(40);
  });
});
