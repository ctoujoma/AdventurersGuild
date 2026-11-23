// Capturas del visor de las expediciones sin el juego:
// `node tools/textos/esbuild.mjs tools/visor.ts visor <carpeta> [solo]`.
// Vuelca PNG (a ×2 el móvil y ×3 el escritorio) de cada momento y una tira del paralaje.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PixelBuffer } from '../src/art/pixel';
import { png } from './visor-png';
import { ESCRITORIO, MOVIL, type Encuadre } from '../src/world/visor/encuadre';
import { Visor, type VisorForce } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';

const [dir = 'capturas/expediciones/visor-bosque', only] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });

const crew: MarchNow['crew'] = [
  { id: 'a', name: 'Violante', seed: 'violante-7', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'Toda', seed: 'toda-3', cls: 'explorador', sex: 'f', fate: 'herido' },
  { id: 'c', name: 'Odo', seed: 'odo-11', cls: 'mago', sex: 'm', fate: 'ok' },
];

const base: MarchNow = {
  seed: 'visor-prueba',
  terrain: 'bosque',
  crew,
  mode: 'walk',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.1,
  hour: 11,
  weather: 'claro',
  day: 2,
};

interface Shot {
  name: string;
  m: Partial<MarchNow>;
  f?: VisorForce;
  time?: number;
}

const SHOTS: Shot[] = [
  { name: 'andar-cerca', m: { wild: 0.05, hour: 10.5 } },
  { name: 'andar-medio', m: { wild: 0.4, hour: 14 } },
  { name: 'andar-lejos', m: { wild: 0.95, hour: 15 } },
  { name: 'atardecer', m: { wild: 0.7, hour: 18.6 } },
  { name: 'lobos', m: { wild: 0.92, hour: 19 } },
  { name: 'pelea', m: { mode: 'fight', wild: 0.55, hour: 13, foe: 'bestia' }, time: 1.4 },
  { name: 'pelea-bandidos', m: { mode: 'fight', wild: 0.35, hour: 16, foe: 'bandido' }, time: 0.4 },
  { name: 'campamento', m: { mode: 'camp', wild: 0.8, hour: 23.5 } },
  { name: 'velada', m: { mode: 'camp', wild: 0.5, hour: 20.2 } },
  { name: 'amanecer', m: { mode: 'camp', wild: 0.3, hour: 6.4 } },
  { name: 'alba-niebla', m: { mode: 'camp', wild: 0.6, hour: 6.2, weather: 'niebla' } },
  { name: 'manana-niebla', m: { wild: 0.6, hour: 8, weather: 'niebla' } },
  { name: 'lluvia', m: { wild: 0.5, hour: 12, weather: 'lluvia' } },
  { name: 'vuelta', m: { wild: 0.3, hour: 16.5, home: true } },
];

const FRAMES: [string, Encuadre, number][] = [
  ['movil', MOVIL, 2],
  ['escritorio', ESCRITORIO, 3],
];

for (const s of SHOTS) {
  if (only && !s.name.includes(only)) continue;
  for (const [tag, enc, scale] of FRAMES) {
    const v = new Visor(enc);
    const m = { ...base, ...s.m };
    // Unos fotogramas antes, para que se asiente lo que depende del tiempo (la pelea).
    const t = s.time ?? 3.2;
    v.frame(m, 0, s.f);
    const b = v.frame(m, t, { travel: 260, ...s.f });
    writeFileSync(`${dir}/${tag}-${s.name}.png`, png(b, scale));
  }
}

/** Hoja de fotogramas: `n` momentos seguidos de una escena, en rejilla de 4 columnas. */
function sheet(name: string, m: MarchNow, from: number, step: number, n: number) {
  const v = new Visor(MOVIL);
  const cols = 4;
  const rows = Math.ceil(n / cols);
  const out = new PixelBuffer(cols * (MOVIL.w + 2), rows * (MOVIL.h + 2));
  v.frame(m, from - step);
  for (let k = 0; k < n; k++) {
    const b = v.frame(m, from + k * step);
    out.blit(b, (k % cols) * (MOVIL.w + 2), Math.floor(k / cols) * (MOVIL.h + 2));
  }
  writeFileSync(`${dir}/hoja-${name}.png`, png(out, 2));
}
if (only === 'hoja') {
  sheet('pelea', { ...base, mode: 'fight', wild: 0.55, foe: 'bestia' }, 0, 0.24, 24);
  sheet('ciervos', { ...base, wild: 0.4, hour: 14 }, 0, 0.5, 16);
  sheet('lobos', { ...base, wild: 0.9, hour: 18.8 }, 0, 0.6, 8);
  // La lejanía, de casa a lo más hondo (mismo sitio del camino).
  const cols = 4;
  const ws = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1];
  const out = new PixelBuffer(cols * (MOVIL.w + 2), Math.ceil(ws.length / cols) * (MOVIL.h + 2));
  ws.forEach((w, k) => {
    const b = new Visor(MOVIL).frame({ ...base, wild: w, hour: 11 }, 3, { travel: 200 });
    out.blit(b, (k % cols) * (MOVIL.w + 2), Math.floor(k / cols) * (MOVIL.h + 2));
  });
  writeFileSync(`${dir}/hoja-lejania.png`, png(out, 2));
}

// Tira del paralaje: fotogramas andando (para un GIF con ffmpeg).
if (!only || only === 'gif') {
  for (const [tag, enc, scale] of FRAMES) {
    mkdirSync(`${dir}/fotogramas-${tag}`, { recursive: true });
    const v = new Visor(enc);
    const m = { ...base, wild: 0.45, hour: 17.4 };
    for (let k = 0; k < 48; k++) {
      const b = v.frame(m, k / 12);
      writeFileSync(`${dir}/fotogramas-${tag}/${String(k).padStart(3, '0')}.png`, png(b, scale));
    }
  }
}
console.log('hecho', dir);
