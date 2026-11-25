// Hoja de barracas: `node tools/textos/esbuild.mjs tools/visor-barracas.ts barracas <png>`.
import { writeFileSync } from 'node:fs';
import { PixelBuffer } from '../src/art/pixel';
import { png } from './visor-png';
import { barraca } from '../src/world/visor/capas-marismas';
import { biomaOf } from '../src/world/visor/bioma';
import { luzAt, lutOf } from '../src/world/visor/luz';
import { M, Tonos } from '../src/world/visor/tonos';

const [out] = process.argv.slice(2);
const cols = 6;
const n = 12;
const cw = 70;
const ch = 48;
const t = new Tonos(cols * cw, Math.ceil(n / cols) * ch);
for (let y = 0; y < t.h; y++)
  for (let x = 0; x < t.w; x++) t.set(x, y, M.hierba, y % ch > ch - 4 ? 3 : 2);
for (let i = 0; i < n; i++)
  barraca(t, (i % cols) * cw + 24, Math.floor(i / cols) * ch + ch - 4, i * 7 + 3, i < 6 ? 2 : 1);
const lut = lutOf(
  luzAt(11, { rain: 0, fog: 0, cloud: 0 }),
  { haze: 0, fog: 0 },
  biomaOf('pantano').ramps,
);
const b = new PixelBuffer(t.w, t.h);
for (let i = 0; i < t.d.length; i++) b.data[i] = t.d[i] ? lut[t.d[i]!]! : 0xffe0c8a0;
writeFileSync(out!, png(b, 3));
