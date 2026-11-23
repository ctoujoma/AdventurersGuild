// Prueba suelta: los árboles del visor en grande.
// `node tools/textos/esbuild.mjs tools/visor-arbol.ts arbol <salida.png>`.
import { writeFileSync } from 'node:fs';
import { PixelBuffer } from '../src/art/pixel';
import { bush, fern, leafy, pine, pineSmall, rock } from '../src/world/visor/arboles';
import { luzAt, lutOf } from '../src/world/visor/luz';
import { M, Tonos } from '../src/world/visor/tonos';
import { png } from './visor-png';

const t = new Tonos(300, 100);
pine(t, 20, 95, 60, { seed: 1 });
pine(t, 60, 95, 80, { seed: 2, old: 0.9, trunk: 2 });
pine(t, 105, 95, 40, { seed: 3 });
pine(t, 140, 95, 70, { seed: 4, old: 0.5, trunk: 1 });
leafy(t, 190, 95, 34, { seed: 5, fruit: true });
leafy(t, 230, 95, 22, { seed: 6, tall: true });
pineSmall(t, 262, 95, 10, M.pino, 3);
fern(t, 275, 95, 8, 2);
bush(t, 290, 95, 10, 6, M.hoja, 4);
rock(t, 250, 95, 9, 5, 2, 0.8);
const lut = lutOf(luzAt(12, { rain: 0, fog: 0, cloud: 0 }), { haze: 0, fog: 0 });
const b = new PixelBuffer(300, 100);
for (let i = 0; i < t.d.length; i++) b.data[i] = t.d[i] ? lut[t.d[i]!]! : 0xffe0d0c0;
writeFileSync(process.argv[2]!, png(b, 4));
