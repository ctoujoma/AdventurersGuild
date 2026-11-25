// Maquetas de los rumbos del visor: `T1=nieve T2=viento node tools/textos/esbuild.mjs tools/visor-biomas.ts biomas <carpeta> monte [solo|hoja|gif]`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PixelBuffer } from '../src/art/pixel';
import { png } from './visor-png';
import { ESCRITORIO, MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
import type { ExpWeather } from '../src/core/model';
import { hash } from '../src/world/visor/tonos';
// El primer momento con relámpago (misma cuenta que `Aire.storm`).
let flashT = 3.2;
for (let c = 0; c < 40; c++)
  if (hash(c * 13 + 5) <= 0.75) {
    flashT = c * 7 + 1 + hash(c * 7) * 3 + 0.04;
    break;
  }

const [dir, terrain, only] = process.argv.slice(2) as [string, MarchNow['terrain'], string?];
mkdirSync(dir, { recursive: true });
const crew: MarchNow['crew'] = [
  { id: 'a', name: 'Violante', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'Toda', seed: 'toda-3', cls: 'explorador', sex: 'f', fate: 'ok' },
  { id: 'c', name: 'Odo', seed: 'odo-11', cls: 'mago', sex: 'm', fate: 'ok' },
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
  hour: 11,
  weather: 'claro',
  day: 2,
};
const shots: [string, Partial<MarchNow>][] = [
  ['cerca', { wild: 0.08, hour: 10.5 }],
  ['medio', { wild: 0.5, hour: 14 }],
  ['lejos', { wild: 0.95, hour: 15 }],
  ['atardecer', { wild: 0.6, hour: 18.6 }],
  ['noche', { mode: 'camp', wild: 0.6, hour: 23 }],
  ['t1', { wild: 0.6, hour: 12, weather: (process.env.T1 ?? 'claro') as ExpWeather }],
  ['t2', { wild: 0.75, hour: 15, weather: (process.env.T2 ?? 'claro') as ExpWeather }],
  ['t3', { wild: 0.75, hour: 15, weather: (process.env.T2 ?? 'claro') as ExpWeather }],
];
for (const [name, m] of shots) {
  if (only && only !== 'hoja' && !name.includes(only)) continue;
  if (only === 'hoja') continue;
  for (const [tag, enc, sc] of [
    ['movil', MOVIL, 2],
    ['escritorio', ESCRITORIO, 3],
  ] as const) {
    const v = new Visor(enc);
    const mm = { ...base, ...m };
    const tt = name === 't3' ? flashT : 3.2;
    v.frame(mm, tt - 0.1);
    writeFileSync(`${dir}/${tag}-${name}.png`, png(v.frame(mm, tt, { travel: 260 }), sc));
  }
}
if (!only || only === 'hoja') {
  const cols = 4;
  const ws = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1];
  const out = new PixelBuffer(cols * (MOVIL.w + 2), Math.ceil(ws.length / cols) * (MOVIL.h + 2));
  ws.forEach((w, k) => {
    const b = new Visor(MOVIL).frame({ ...base, wild: w, hour: 11 }, 3, { travel: 200 });
    out.blit(b, (k % cols) * (MOVIL.w + 2), Math.floor(k / cols) * (MOVIL.h + 2));
  });
  writeFileSync(`${dir}/hoja-lejania.png`, png(out, 2));
}
console.log('hecho');

// GIF del tiempo: fotogramas del t1 y el t2 (escritorio).
if (only === 'gif') {
  for (const name of ['t1', 't2']) {
    const m = { ...base, ...shots.find((s) => s[0] === name)![1] };
    mkdirSync(`${dir}/gif-${name}`, { recursive: true });
    const v = new Visor(ESCRITORIO);
    const t0 = m.weather === 'tormenta' ? flashT - 1.5 : 0;
    for (let k = 0; k < 40; k++)
      writeFileSync(
        `${dir}/gif-${name}/${String(k).padStart(3, '0')}.png`,
        png(v.frame(m, t0 + k / 12), 2),
      );
  }
}
