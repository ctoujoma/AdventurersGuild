import { describe, expect, it } from 'vitest';
import { parallaxLayers } from './parallax';
import { YARD_D } from './rooms/layout';
import { CLOUD_FX } from './rooms/sky';
import { scaleAt } from './rooms/view3d';

describe('capas lejanas', () => {
  const fx = parallaxLayers().map((l) => l.fx);

  it('cuanto más cerca, más se mueven', () => {
    for (let i = 1; i < fx.length; i++) expect(fx[i]).toBeGreaterThan(fx[i - 1]!);
    expect(fx[0]).toBeGreaterThan(CLOUD_FX);
  });

  it('todas van más despacio que el final del terreno (si no, adelantan a lo de delante)', () => {
    // Lo que está a la profundidad del borde del terreno se mueve a scaleAt(YARD_D) de la cámara.
    for (const f of fx) expect(f).toBeLessThan(scaleAt(YARD_D));
  });
});
