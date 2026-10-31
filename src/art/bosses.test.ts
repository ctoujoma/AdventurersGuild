import { describe, expect, it } from 'vitest';
import { BOSSES, type BossKind } from '../data/bosses';
import { bossArt, type BossPose } from './bosses';

const POSES: BossPose[] = ['ready', 'windup', 'strike', 'thrust', 'up', 'down'];

describe('dibujo de los jefes', () => {
  it('cada jefe nuevo tiene su dibujo, distinto del de su base', () => {
    for (const k of Object.keys(BOSSES) as BossKind[]) {
      const base = BOSSES[k].base;
      if (!base) continue;
      const own = bossArt(k).poses.ready;
      const from = bossArt(base).poses.ready;
      expect(own.w).toBe(from.w);
      let diff = 0;
      for (let i = 0; i < own.data.length; i++) if (own.data[i] !== from.data[i]) diff++;
      // No basta con otros colores: cambia la forma (corona, cetro, cuernos, humo…).
      let shape = 0;
      for (let i = 0; i < own.data.length; i++) if (!own.data[i] !== !from.data[i]) shape++;
      expect(diff).toBeGreaterThan(200);
      expect(shape).toBeGreaterThan(30);
    }
  });

  it('todas las poses tienen dibujo y la boca o el arma caen dentro', () => {
    for (const k of Object.keys(BOSSES) as BossKind[]) {
      const a = bossArt(k);
      for (const p of POSES) {
        const b = a.poses[p];
        expect(b.data.some((c) => c !== 0)).toBe(true);
        if (p === 'down') continue;
        const m = a.mouth[p];
        expect(a.foot.x + m.x).toBeGreaterThanOrEqual(0);
        expect(a.foot.x + m.x).toBeLessThanOrEqual(b.w);
      }
    }
  });

  it('la Reina se desploma (no hay agua en la cripta); el Rey Ahogado se hunde', () => {
    expect(bossArt('reina').fall).toBeUndefined();
    expect(bossArt('ahogado').fall).toBe('sink');
  });
});
