/**
 * El suelo y la hierba con «luz con ambiente» (ver `docs/plan-luz.md`): las mismas texturas de
 * siempre (`art/grass.ts`), pasadas al estilo nuevo. El ruido de píxel a píxel en verdes vivos
 * pasa a grumos de verdes apagados que siguen lo que había (el camino, las calvas, las franjas de
 * la siega y el borde sin segar se quedan donde estaban), y la tierra a tonos de tierra. Sin relieve:
 * en un suelo plano, el escalón entre la hierba y el camino dejaba una raya de sombra.
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
      let k = kind[i]!;
      // Las flores y piedras de un píxel (titilan al mover la cámara): toman lo que las rodea,
      // hierba o tierra. Las flores van aparte, en matas con su viento.
      if (!k) {
        let g = 0;
        let d = 0;
        for (let j = -1; j <= 1; j++)
          for (let q = -1; q <= 1; q++) {
            const xx = x + q;
            const yy = y + j;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const kk = kind[yy * w + xx];
            if (kk === 1) g++;
            else if (kk === 2) d++;
          }
        if (g + d >= 5) k = g >= d ? 1 : 2;
      }
      const clump = fbm(x + seed * 131, y, 7, 3, 61);
      const grain = hash(x >> 1, y);
      if (k === 1) {
        out.set(x, y, pick(GRASS, 0.42 * avg(x, y, 1) + 0.42 * clump + 0.16 * grain));
      } else if (k === 2) {
        out.set(x, y, pick(DIRT, 0.5 * avg(x, y, 2) + 0.35 * clump + 0.15 * grain));
      } else {
        out.set(x, y, SWAP_IN.get(c) ?? c);
      }
    }
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

/**
 * Una pieza de fuera (pozo, rótulo, muñecos, cuadra…) sin el contorno oscuro y con los colores
 * algo apagados: cada píxel del borde que es mucho más oscuro que el de dentro toma el color de
 * dentro, un poco más oscuro. La forma la da la luz, no la raya.
 */
export function softened(src: PixelBuffer): PixelBuffer {
  const out = src.clone();
  const { w, h, data } = src;
  const lum = (c: number) => (c & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + ((c >> 16) & 255) * 0.11;
  const op = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && data[y * w + x]! >>> 24 ? data[y * w + x]! : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x]!;
      if (!(c >>> 24)) continue;
      const nb: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      if (!nb.some(([i, j]) => !op(x + i, y + j))) continue;
      // El vecino de dentro más claro.
      let inner = 0;
      for (const [i, j] of nb) {
        const n = op(x + i, y + j);
        if (n && lum(n) > lum(inner)) inner = n;
      }
      if (!inner || lum(c) > lum(inner) * 0.7) continue;
      const k = 0.78;
      out.data[y * w + x] =
        ((255 << 24) |
          (Math.round(((inner >> 16) & 255) * k) << 16) |
          (Math.round(((inner >> 8) & 255) * k) << 8) |
          Math.round((inner & 255) * k)) >>>
        0;
    }
  // Los colores, algo menos saturados (como los de `moodGround`).
  for (let i = 0; i < out.data.length; i++) {
    const c = out.data[i]!;
    if (!(c >>> 24)) continue;
    const r = c & 255;
    const g = (c >> 8) & 255;
    const b = (c >> 16) & 255;
    const l = r * 0.3 + g * 0.59 + b * 0.11;
    const m = (v: number) => Math.round(v + (l - v) * 0.22);
    out.data[i] = ((255 << 24) | (m(b) << 16) | (m(g) << 8) | m(r)) >>> 0;
  }
  if (src.relief) out.relief = src.relief.slice();
  return out;
}
