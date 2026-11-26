// Hoja de los enemigos y guardianes de las expediciones:
// `node tools/textos/esbuild.mjs tools/visor-enemigos.ts enemigos <png> [antes]`.
import { writeFileSync } from 'node:fs';
import { PixelBuffer } from '../src/art/pixel';
import { png } from './visor-png';
import { expFoeArt, GUARDIAN_OF } from '../src/art/expFoes';
import { guardianArt } from '../src/art/bosses';
import type { Heading } from '../src/core/model';

const [out] = process.argv.slice(2);
const HS: Heading[] = ['bosque', 'sierra', 'marismas', 'ruinas'];
const CELL = 72;
const ROW = 110;
const COLX = [4, 80, 156, 232];
const GX = 352;
const W = GX + 230;
const sheet = new PixelBuffer(W, ROW * HS.length);
for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, '#e9e2d2');
const blit = (b: PixelBuffer, x: number, y: number) => {
  for (let j = 0; j < b.h; j++)
    for (let i = 0; i < b.w; i++) {
      const c = b.data[j * b.w + i]!;
      if (c >>> 24) sheet.data[(y + j) * sheet.w + x + i] = c;
    }
};
HS.forEach((h, r) => {
  const y0 = r * ROW;
  for (let i = 0; i < sheet.w; i++) sheet.set(i, y0 + ROW - 1, '#c9bea8');
  for (let k = 0; k < 4; k++) {
    const f = expFoeArt(h, k);
    const x0 = COLX[k]!;
    // Arriba, los que salen (quietos); abajo, el golpe.
    const idle = f.art.poses.idle;
    for (let n = 0; n < f.count; n++)
      blit(
        idle,
        x0 + n * Math.min(20, Math.floor((CELL - idle.w) / Math.max(1, f.count - 1) || 0)),
        y0 + 52 - idle.h,
      );
    const st = f.art.poses.strike;
    blit(st, x0, y0 + 104 - st.h);
  }
  const g = guardianArt(GUARDIAN_OF[h]);
  blit(g.poses.ready, GX, y0 + ROW - 4 - g.poses.ready.h);
  blit(g.poses.strike, GX + 112, y0 + ROW - 4 - g.poses.strike.h);
});
writeFileSync(out!, png(sheet, 3));
