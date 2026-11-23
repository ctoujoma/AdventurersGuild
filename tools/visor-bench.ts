// Cuánto tarda el visor por fotograma: `node tools/textos/esbuild.mjs tools/visor-bench.ts bench`.
import { ESCRITORIO, MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';

const m: MarchNow = {
  seed: 's',
  terrain: 'bosque',
  crew: [
    { id: 'a', name: 'A', seed: 'a', cls: 'guerrero', sex: 'f', fate: 'ok' },
    { id: 'b', name: 'B', seed: 'b', cls: 'mago', sex: 'm', fate: 'ok' },
    { id: 'c', name: 'C', seed: 'c', cls: 'picaro', sex: 'm', fate: 'herido' },
  ],
  mode: 'walk',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.5,
  hour: 12,
  weather: 'claro',
  day: 1,
};
for (const enc of [MOVIL, ESCRITORIO])
  for (const mode of ['walk', 'fight', 'camp'] as const)
    for (const weather of ['claro', 'lluvia', 'niebla'] as const) {
      const v = new Visor(enc);
      const h0 = mode === 'camp' ? 23 : 8;
      const t0 = performance.now();
      v.frame({ ...m, mode, weather, hour: h0 }, 0);
      const t1 = performance.now();
      for (let k = 1; k <= 60; k++) v.frame({ ...m, mode, weather, hour: h0 + k * 0.01 }, k / 12);
      const per = (performance.now() - t1) / 60;
      console.log(
        `${enc.w} ${mode} ${weather}: primero ${(t1 - t0).toFixed(0)} ms; luego ${per.toFixed(2)} ms`,
      );
    }
