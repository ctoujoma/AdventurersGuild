import { describe, expect, it } from 'vitest';
import { DEPTH } from './layout';
import { BACK, EYE, eyeOf, frustum, nativeSize, project, scaleAt } from './view3d';

const view = { px: 120, py: 40, vw: 211, vh: 377 };

describe('cámara de la vista 3D', () => {
  it('el plano de corte se ve píxel a píxel, como la cámara 2D', () => {
    for (const [x, y] of [
      [120, 40],
      [200, 333],
      [331, 417],
    ] as const) {
      const p = project(view, x, y, 0);
      expect(p.x).toBeCloseTo(x - view.px, 9);
      expect(p.y).toBeCloseTo(y - view.py, 9);
    }
  });

  it('la pared del fondo sale siempre a la misma escala, se mire desde donde se mire', () => {
    expect(scaleAt(DEPTH)).toBeCloseTo(BACK, 9);
    for (const v of [view, { ...view, px: -300, py: 900 }]) {
      const a = project(v, 10, 20, DEPTH);
      const b = project(v, 110, 70, DEPTH);
      expect(b.x - a.x).toBeCloseTo(100 * BACK, 9);
      expect(b.y - a.y).toBeCloseTo(50 * BACK, 9);
    }
  });

  it('el encuadre llena justo la vista en el plano de corte, con el ojo por encima del centro', () => {
    const near = 20;
    const f = frustum(view, near);
    const e = eyeOf(view);
    const k = EYE / near;
    expect(f.left * k).toBeCloseTo(view.px - e.x, 9);
    expect(f.right * k).toBeCloseTo(view.px + view.vw - e.x, 9);
    expect(f.top * k).toBeCloseTo(e.y - view.py, 9);
    expect(f.bottom * k).toBeCloseTo(e.y - view.py - view.vh, 9);
    expect(e.y).toBeLessThan(view.py + view.vh / 2);
  });

  it('las figuras planas miden en pantalla lo mismo que su dibujo', () => {
    for (const d of [0, 12, DEPTH / 2, DEPTH - 4]) {
      const w = nativeSize(24, d);
      const a = project(view, 200, 300, d);
      const b = project(view, 200 + w, 300, d);
      expect(b.x - a.x).toBeCloseTo(24, 9);
    }
  });
});
