// Capturas de los sucesos del visor (lo que tienen delante al esperar, y el jefe a la vista):
// `node tools/textos/esbuild.mjs tools/visor-sucesos.ts sucesos <carpeta>`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { ESCRITORIO, MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
import type { ExpEvent } from '../src/data/expEvents';
const [dir] = process.argv.slice(2);
mkdirSync(dir!, { recursive: true });
const crew: MarchNow['crew'] = [
  { id: 'a', name: 'V', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'T', seed: 'toda-3', cls: 'explorador', sex: 'f', fate: 'ok' },
  { id: 'c', name: 'O', seed: 'odo-11', cls: 'mago', sex: 'm', fate: 'ok' },
];
const EVS: ExpEvent[] = [
  'cofre',
  'santuario',
  'mercader',
  'viajero',
  'campamento',
  'oso',
  'cueva',
  'torre',
  'ruinas',
  'jefe',
  'guardian',
];
for (const kind of EVS)
  for (const [tag, enc, sc] of [
    ['escritorio', ESCRITORIO, 2],
    ['movil', MOVIL, 2],
  ] as const) {
    const m: MarchNow = {
      seed: 'visor-sucesos',
      terrain: 'bosque',
      crew,
      mode: 'wait',
      night: false,
      home: false,
      foe: 'bestia',
      wild: 0.45,
      hour: 10.5,
      weather: 'claro',
      day: 2,
      event: { kind, foe: kind === 'jefe' ? 2 : undefined },
    };
    const v = new Visor(enc);
    v.frame(m, 0, { travel: 300 });
    writeFileSync(`${dir}/${tag}-${kind}.png`, png(v.frame(m, 0.2, { travel: 300 }), sc));
  }
