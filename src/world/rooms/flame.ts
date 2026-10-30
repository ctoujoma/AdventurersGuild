/**
 * La llama de los fuegos (hogares, fraguas, fogones): una tira de fotogramas en pixel art que
 * se mecen de lado a lado. La escena la pinta sin luz (brilla por sí sola) y va cambiando de
 * fotograma al azar, con el halo de su foco alrededor.
 */
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';

export const FLAME_W = 9;
export const FLAME_H = 12;
export const FLAME_FRAMES = 4;

/** Colores de fuera a dentro: el borde rojizo, el naranja, el oro, el limón y el centro blanco. */
const HEAT = [P.red, P.orange, P.gold, P.lemon, P.white] as const;

export function flameStrip(): PixelBuffer {
  const b = new PixelBuffer(FLAME_W * FLAME_FRAMES, FLAME_H);
  for (let f = 0; f < FLAME_FRAMES; f++) {
    const phase = (f * Math.PI) / 2;
    const ox = f * FLAME_W;
    for (let y = 0; y < FLAME_H; y++) {
      // 0 abajo, 1 en la punta.
      const up = (FLAME_H - 1 - y) / (FLAME_H - 1);
      // Redonda abajo y en punta arriba; la punta se va a un lado y al otro.
      const half = (FLAME_W / 2) * Math.pow(1 - up, 0.75) * (0.78 + 0.22 * Math.min(1, up * 6));
      const cx = (FLAME_W - 1) / 2 + Math.sin(phase + up * 3.4) * up * 2;
      for (let x = 0; x < FLAME_W; x++) {
        const d = Math.abs(x - cx) / Math.max(0.6, half);
        if (d > 1) continue;
        const heat = (1 - d) * (1.05 - up * 0.75);
        // De fuera a dentro; el rojo, solo en los bordes de la punta, y el blanco, en el corazón.
        const i =
          heat > 0.72 && up < 0.3
            ? 4
            : heat > 0.5
              ? 3
              : heat > 0.27
                ? 2
                : heat > 0.08 || up < 0.5
                  ? 1
                  : 0;
        b.set(ox + x, y, HEAT[i]!);
      }
    }
    // Una chispa suelta encima de la punta, en fotogramas alternos.
    if (f % 2) b.set(ox + Math.round((FLAME_W - 1) / 2 + Math.sin(phase + 3) * 2), 0, P.gold);
  }
  return b;
}
