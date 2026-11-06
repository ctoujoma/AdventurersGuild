import { describe, expect, it } from 'vitest';
import { alpha } from '../../art/pixel';
import { mountainsCnc, skyStripCnc } from './paisaje';

describe('paisaje (luz con ambiente)', () => {
  const m = mountainsCnc();
  const topOf = (x: number) => {
    for (let y = 0; y < m.right.h; y++) if (alpha(m.right.get(x, y))) return y;
    return m.right.h;
  };

  it('todas las versiones de los montes tienen la misma silueta', () => {
    for (let i = 0; i < m.right.data.length; i += 97) {
      const a = alpha(m.right.data[i]!) > 0;
      for (const b of [m.left, m.night, m.dusk, m.dawn]) expect(alpha(b.data[i]!) > 0).toBe(a);
    }
  });

  it('se repiten sin junta: la cresta sigue del último píxel al primero', () => {
    expect(Math.abs(topOf(m.right.w - 1) - topOf(0))).toBeLessThanOrEqual(3);
  });

  it('el cielo va de la primera banda a la última', () => {
    const s = skyStripCnc(['#000000', '#ffffff'], 16, 100, 10, 90);
    expect(s.get(3, 0)).toBe(s.get(5, 0));
    expect(s.get(3, 99)).not.toBe(s.get(3, 0));
  });
});
