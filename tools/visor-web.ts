// Prueba del visor en un navegador de verdad (el camino del canvas, como en ExpeditionView):
// lo empaqueta `tools/visor-web.mjs` y lo abre Chromium.
import { ESCRITORIO, MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';

const m: MarchNow = {
  seed: 'web',
  terrain: 'bosque',
  crew: [
    { id: 'a', name: 'A', seed: 'a-1', cls: 'guerrero', sex: 'f', fate: 'ok' },
    { id: 'b', name: 'B', seed: 'b-2', cls: 'explorador', sex: 'm', fate: 'herido' },
  ],
  mode: 'walk',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.4,
  hour: 17.5,
  weather: 'claro',
  day: 1,
};
const out: string[] = [];
for (const enc of [MOVIL, ESCRITORIO]) {
  const c = document.createElement('canvas');
  c.width = enc.w;
  c.height = enc.h;
  c.style.width = `${enc.w * 2}px`;
  c.style.imageRendering = 'pixelated';
  document.body.append(c);
  const ctx = c.getContext('2d')!;
  const v = new Visor(enc);
  const t0 = performance.now();
  for (let k = 0; k < 36; k++) v.draw(ctx, m, k / 12);
  out.push(`${enc.w}: ${((performance.now() - t0) / 36).toFixed(2)} ms`);
}
document.title = out.join(' · ');
