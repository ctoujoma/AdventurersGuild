// Hojas de la lejanía de un rumbo (de casa a lo más hondo), en móvil y escritorio, con buen tiempo
// y nevando: `node tools/textos/esbuild.mjs tools/visor-hoja.ts hoja <carpeta> [monte] [hora]`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PixelBuffer } from '../src/art/pixel';
import { png } from './visor-png';
import { ESCRITORIO, MOVIL, type Encuadre } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
import type { ExpWeather } from '../src/core/model';

const [dir, terrain = 'monte', hour = '11'] = process.argv.slice(2) as [
  string,
  MarchNow['terrain'],
  string,
];
mkdirSync(dir, { recursive: true });
const crew: MarchNow['crew'] = [
  { id: 'a', name: 'V', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'T', seed: 'toda-3', cls: 'explorador', sex: 'f', fate: 'ok' },
  { id: 'c', name: 'O', seed: 'odo-11', cls: 'mago', sex: 'm', fate: 'ok' },
];
const base: MarchNow = {
  seed: 'visor-prueba',
  terrain,
  crew,
  mode: 'walk',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.4,
  hour: Number(hour),
  weather: 'claro',
  day: 2,
};
const WS = [0, 0.15, 0.3, 0.45, 0.55, 0.65, 0.75, 0.85, 1];
function hoja(name: string, enc: Encuadre, weather: ExpWeather, sc: number) {
  const cols = 3;
  const out = new PixelBuffer(cols * (enc.w + 2), Math.ceil(WS.length / cols) * (enc.h + 2));
  WS.forEach((w, k) => {
    const v = new Visor(enc);
    const m = { ...base, wild: w, weather };
    v.frame(m, 3);
    const b = v.frame(m, 3.2, { travel: 200 });
    out.blit(b, (k % cols) * (enc.w + 2), Math.floor(k / cols) * (enc.h + 2));
  });
  writeFileSync(`${dir}/${name}.png`, png(out, sc));
}
hoja('movil', MOVIL, 'claro', 2);
hoja('escritorio', ESCRITORIO, 'claro', 1);
hoja('movil-nieve', MOVIL, 'nieve', 2);
hoja('escritorio-nieve', ESCRITORIO, 'nieve', 1);
console.log('hecho', dir);
