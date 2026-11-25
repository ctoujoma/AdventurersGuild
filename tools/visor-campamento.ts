// Capturas del campamento del visor (mantas por héroe y sastrería): `node tools/textos/esbuild.mjs tools/visor-campamento.ts camp <carpeta>`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { ESCRITORIO, MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
const [dir] = process.argv.slice(2);
mkdirSync(dir!, { recursive: true });
const crew: MarchNow['crew'] = [
  { id: 'a', name: 'V', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'T', seed: 'toda-3', cls: 'explorador', sex: 'f', fate: 'ok' },
  { id: 'c', name: 'O', seed: 'odo-11', cls: 'mago', sex: 'm', fate: 'ok' },
  { id: 'd', name: 'B', seed: 'bermudo-5', cls: 'clerigo', sex: 'm', fate: 'ok' },
];
const base: MarchNow = {
  seed: 'visor-prueba',
  terrain: 'bosque',
  crew,
  mode: 'camp',
  night: true,
  home: false,
  foe: 'bestia',
  wild: 0.5,
  hour: 23.5,
  weather: 'claro',
  day: 2,
};
const shots: [string, Partial<MarchNow>][] = [
  ['noche-sin-sastre', {}],
  ['noche-con-sastre', { dress: { a: { dye: 'mar' }, c: { dye: 'vino' }, d: { dye: 'ocre' } } }],
  ['velada', { hour: 20.3 }],
  ['alba', { hour: 6.3 }],
  ['viento', { weather: 'viento', hour: 21, terrain: 'monte' }],
];
for (const [name, m] of shots)
  for (const [tag, enc, sc] of [
    ['escritorio', ESCRITORIO, 3],
    ['movil', MOVIL, 2],
  ] as const) {
    const v = new Visor(enc);
    v.frame({ ...base, ...m }, 0);
    writeFileSync(
      `${dir}/${tag}-${name}.png`,
      png(v.frame({ ...base, ...m }, 3.2, { travel: 260 }), sc),
    );
  }
mkdirSync(`${dir}/gif`, { recursive: true });
const v = new Visor(ESCRITORIO);
for (let k = 0; k < 48; k++)
  writeFileSync(
    `${dir}/gif/${String(k).padStart(3, '0')}.png`,
    png(v.frame({ ...base, dress: { a: { dye: 'mar' } } }, k / 12), 1),
  );
