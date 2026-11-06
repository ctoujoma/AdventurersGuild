/**
 * El suelo y la hierba con «luz con ambiente» (ver `docs/plan-luz.md`): las mismas texturas de
 * siempre (`art/grass.ts`), pasadas al estilo nuevo. El ruido de píxel a píxel en verdes vivos
 * pasa a grumos de verdes apagados que siguen lo que había (el camino, las calvas, las franjas de
 * la siega y el borde sin segar se quedan donde estaban), la tierra a tonos de tierra y todo con
 * algo de relieve, para que el sol le dé.
 */
import { P } from '../../art/palette';
import { PixelBuffer, rgba } from '../../art/pixel';
import { fbm } from './paisaje';

const GRASS = ['#24372a', '#2e4430', '#3a5234', '#476139', '#57703e', '#6b8043', '#86934e'];
const DIRT = ['#46332a', '#574032', '#6a4f3b', '#7f6247'];
const SWAP: Record<string, string> = {
  [P.lemon]: '#e6cd6c',
  [P.white]: '#e8e4d4',
  [P.coral]: '#d88c7c',
  [P.rose]: '#a8708a',
  [P.sky]: '#7fa6c4',
  [P.ocean]: '#58779a',
  [P.gold]: '#d4aa58',
  [P.tan]: '#c9a27a',
  [P.steel]: '#7d7b74',
  [P.fog]: '#a29f96',
  [P.slate]: '#5d5d5e',
  [P.mist]: '#c4c2b8',
};

const classOf = (ramp: string[]) => new Map(ramp.map((c, i) => [rgba(c), i]));
const GRASS_IN = classOf([P.deep, P.forest, P.leaf, P.lime]);
const DIRT_IN = classOf([P.umber, P.bark, P.mocha, P.cocoa]);
const SWAP_IN = new Map(Object.entries(SWAP).map(([a, b]) => [rgba(a), rgba(b)]));

const hash = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};
const pick = (r: string[], v: number) =>
  rgba(r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))]!);

/** Una textura de suelo (hierba, tierra, césped) pasada al estilo nuevo. */
export function moodGround(src: PixelBuffer, seed = 0): PixelBuffer {
  const { w, h, data } = src;
  const out = new PixelBuffer(w, h);
  const cls = new Int8Array(w * h).fill(-1);
  const kind = new Int8Array(w * h); // 1: hierba, 2: tierra
  for (let i = 0; i < data.length; i++) {
    const g = GRASS_IN.get(data[i]!);
    const d = DIRT_IN.get(data[i]!);
    if (g !== undefined) [cls[i], kind[i]] = [g, 1];
    else if (d !== undefined) [cls[i], kind[i]] = [d, 2];
  }
  // La media de lo que había alrededor (5 × 3, solo lo de su clase): guarda las franjas y los
  // bordes, quita el ruido.
  const avg = (x: number, y: number, k: number) => {
    let s = 0;
    let n = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -2; i <= 2; i++) {
        const xx = x + i;
        const yy = y + j;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (kind[q] !== k) continue;
        s += cls[q]!;
        n++;
      }
    return n ? s / n / 3 : 0.5;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = data[i]!;
      if (!(c >>> 24)) continue;
      const k = kind[i]!;
      const clump = fbm(x + seed * 131, y, 7, 3, 61);
      const grain = hash(x >> 1, y);
      if (k === 1) {
        const v = 0.42 * avg(x, y, 1) + 0.42 * clump + 0.16 * grain;
        // Alguna brizna clara suelta y alguna mata oscura.
        const t = grain > 0.96 ? v + 0.22 : grain < 0.04 ? v - 0.2 : v;
        out.level = 1 + Math.round(clump * 3);
        out.set(x, y, pick(GRASS, t));
      } else if (k === 2) {
        out.level = 0;
        out.set(x, y, pick(DIRT, 0.5 * avg(x, y, 2) + 0.35 * clump + 0.15 * grain));
      } else {
        out.level = 2;
        out.set(x, y, SWAP_IN.get(c) ?? c);
      }
    }
  out.level = 0;
  return out;
}

/** Las matas de hierba (con sus fotogramas), con los verdes apagados. */
export function moodTuft(src: PixelBuffer): PixelBuffer {
  const out = src.clone();
  const TUFT = new Map([
    [rgba(P.deep), rgba('#2a3d2c')],
    [rgba(P.forest), rgba('#3a5233')],
    [rgba(P.leaf), rgba('#56703c')],
    [rgba(P.lime), rgba('#7d8f4a')],
  ]);
  for (let i = 0; i < out.data.length; i++) {
    const c = out.data[i]!;
    out.data[i] = TUFT.get(c) ?? SWAP_IN.get(c) ?? c;
  }
  return out;
}
