// Capturas de la pelea del visor con los enemigos de cada rumbo:
// `node tools/textos/esbuild.mjs tools/visor-pelea.ts pelea <carpeta> [rumbo]`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { ESCRITORIO, MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
import type { Heading } from '../src/core/model';
const [dir, rumbo = 'bosque'] = process.argv.slice(2);
const heading = rumbo as Heading;
const terrain = (
  { bosque: 'bosque', sierra: 'monte', marismas: 'pantano', ruinas: 'ruina' } as const
)[heading];
mkdirSync(`${dir}/gif`, { recursive: true });
const crew: MarchNow['crew'] = [
  { id: 'a', name: 'V', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'T', seed: 'toda-3', cls: 'explorador', sex: 'f', fate: 'ok' },
  { id: 'c', name: 'O', seed: 'odo-11', cls: 'mago', sex: 'm', fate: 'ok' },
];
for (let idx = 0; idx < 4; idx++) {
  const m: MarchNow = {
    seed: 'visor-pelea',
    terrain,
    crew,
    mode: 'fight',
    night: false,
    home: false,
    foe: 'bestia',
    wild: 0.5,
    hour: 11,
    weather: 'claro',
    day: 2,
    rival: { heading, idx },
  };
  for (const [tag, enc, sc] of [
    ['escritorio', ESCRITORIO, 3],
    ['movil', MOVIL, 3],
  ] as const) {
    const v = new Visor(enc);
    v.frame(m, 0);
    writeFileSync(`${dir}/${tag}-${idx}.png`, png(v.frame(m, 3.4), sc));
  }
  const v = new Visor(MOVIL);
  for (let k = 0; k < 60; k++)
    writeFileSync(
      `${dir}/gif/${idx}-${String(k).padStart(3, '0')}.png`,
      png(v.frame(m, k / 10), 2),
    );
}
