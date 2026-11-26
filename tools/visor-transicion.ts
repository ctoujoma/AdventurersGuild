// Fotogramas de una transición del visor (de despejado a lluvia, y el paisaje que cambia al
// alejarse): `node tools/textos/esbuild.mjs tools/visor-transicion.ts trans <carpeta>`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
const [dir] = process.argv.slice(2);
mkdirSync(dir!, { recursive: true });
const base: MarchNow = {
  seed: 'visor-prueba',
  terrain: 'bosque',
  crew: [{ id: 'a', name: 'V', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' }],
  mode: 'walk',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.4,
  hour: 11,
  weather: 'claro',
  day: 2,
};
const v = new Visor(MOVIL);
for (let k = 0; k < 120; k++) {
  const t = k / 8;
  const m: MarchNow = { ...base, weather: t < 1 ? 'claro' : 'lluvia', wild: t < 10 ? 0.4 : 0.6 };
  writeFileSync(`${dir}/${String(k).padStart(3, '0')}.png`, png(v.frame(m, t), 2));
}
