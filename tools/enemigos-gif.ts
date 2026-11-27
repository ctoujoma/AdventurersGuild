// Las animaciones de un enemigo calcado, una al lado de otra y en bucle (quieto, ataque, herido,
// muerte), para enseñarlas: `node tools/textos/esbuild.mjs tools/enemigos-gif.ts gif <carpeta>`.
// Saca PNG por fotograma (`<carpeta>/<enemigo>/000.png`…), que luego se juntan en un GIF.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { expFoeArt, expGuardianArt } from '../src/art/expFoes';
import type { FoeArt, FoePose } from '../src/art/foes';
import { PixelBuffer, alpha } from '../src/art/pixel';
import { foeFrame } from '../src/world/visor/gente';
const [dir] = process.argv.slice(2);
const FPS = 10;
const N = 80;
const ARTS: Record<string, FoeArt> = {
  huargo: expFoeArt('bosque', 3).art,
  oso: expFoeArt('bosque', 2).art,
  lobo: expFoeArt('bosque', 0).art,
  jabali: expFoeArt('bosque', 1).art,
  sanguijuela: expFoeArt('marismas', 0).art,
  gigante: expFoeArt('sierra', 3).art,
  dragon: expGuardianArt('sierra'),
};
/** Qué pose y cuánto lleva de ella en el segundo `t` de cada panel. */
const PANELS: ((t: number) => [FoePose, number])[] = [
  () => ['idle', 0],
  (t) => {
    const u = (t % 1.6) / 1.6; // carga y golpe como en la pelea (un turno), y un respiro
    return u < 0.3 ? ['windup', u / 0.3] : u < 0.58 ? ['strike', (u - 0.3) / 0.28] : ['idle', 0];
  },
  (t) => {
    const u = (t % 1.2) / 1.2;
    return u < 0.4 ? ['hurt', u / 0.4] : ['idle', 0];
  },
  (t) => {
    const u = (t % 4) / 4; // cae en algo más de dos segundos y se queda
    return u < 0.06 ? ['idle', 0] : ['down', (u - 0.06) / 0.55];
  },
];
for (const [name, art] of Object.entries(ARTS)) {
  const all = [...Object.values(art.poses), ...Object.values(art.seq ?? {}).flat()];
  const W = Math.max(...all.map((b) => b.w)) + 6;
  const H = Math.max(...all.map((b) => b.h)) + 6;
  mkdirSync(`${dir}/${name}`, { recursive: true });
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    const out = new PixelBuffer(W * PANELS.length, H);
    out.rect(0, 0, out.w, out.h, '#e6e0cc');
    PANELS.forEach((panel, i) => {
      const [pose, u] = panel(t);
      const img = foeFrame(art, pose, u, t);
      // Por los pies, como en el visor.
      const x0 = i * W + 3 + (W - 6) / 2 - art.foot;
      for (let y = 0; y < img.h; y++)
        for (let x = 0; x < img.w; x++) {
          const c = img.get(x, y);
          if (alpha(c)) out.data[(H - 3 - img.h + y) * out.w + Math.round(x0 + x)] = c;
        }
    });
    writeFileSync(`${dir}/${name}/${String(f).padStart(3, '0')}.png`, png(out, 3));
  }
}
