/**
 * El tiempo en el cielo: el manto de nubes del nublado y los bancos de niebla. El manto son
 * filas de cúmulos y bancos (los mismos de `art/clouds.ts`, con rampas grises) que se solapan,
 * pequeñas junto al horizonte y grandes arriba. Cada nube tiene su turno (`rank`): con pocas
 * nubes solo salen las primeras; cubierto, todas. Se pintan poco a poco, unas pocas por
 * fotograma y por orden de turno, para no dar un tirón.
 */
import { bufferCanvas } from '../../art/canvas';
import { bank, cumulus, paintCloud, PHASES, type SkyPhase } from '../../art/clouds';
import { PixelBuffer, rgba } from '../../art/pixel';
import { Rng } from '../../core/rng';
import { GROUND } from '../geometry';

/** Rampas del manto, de la sombra a la luz. Las nubes de los primeros turnos, más claras de día. */
const DECK_RAMP: Record<Exclude<SkyPhase, 'dawn'>, readonly string[]> = {
  day: ['#66728f', '#6c7894', '#7f8ba5', '#939eb5', '#a8b2c6', '#bdc5d4'],
  dusk: ['#4a3f5e', '#5d4c6a', '#735a74', '#8c6a7c', '#a67d84', '#c0948e'],
  night: ['#1f2440', '#262c4a', '#2f3655', '#394163', '#454e73', '#535d84'],
};
const LIGHT_DAY = ['#8693ad', '#9aa6bd', '#b0bacc', '#c6cedb', '#dae0e8', '#eceff4'];

/** Las franjas del cielo cubierto, de arriba al horizonte (para `skyStripCnc`). */
export const GREY_BANDS: Record<SkyPhase, readonly string[]> = {
  day: ['#6d7a96', '#75829d', '#7e8ba5', '#8894ad', '#929eb5', '#9ca7bd', '#a7b1c5', '#b2bbcc'],
  dusk: ['#3b3552', '#4a3f5c', '#5a4a66', '#6b5570', '#7d6178', '#906d7f', '#a47a85', '#b8888b'],
  dawn: ['#4a4866', '#575370', '#655e7a', '#746a84', '#84778d', '#958496', '#a6929f', '#b7a1a8'],
  night: ['#1a1e34', '#1e223a', '#222740', '#272c46', '#2c324c', '#313852', '#373e58', '#3d455f'],
};

/** Ancho de la franja del manto (se repite a lo ancho). */
export const DECK_BAND = 1400;

export interface DeckCloud {
  /** Izquierda en la franja y panza (con el horizonte en GROUND, como las capas). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Turno: sale cuando las nubes pasan de su turno. */
  rank: number;
  /** Paralaje y deriva (píxeles por segundo). */
  fx: number;
  speed: number;
  kind: 'cumulus' | 'bank';
  tower: number;
  seed: string;
  img?: Record<SkyPhase, HTMLCanvasElement>;
}

/** La forma del manto (sin pintar): filas desde el horizonte hacia arriba. */
export function deckLayout(): DeckCloud[] {
  const rng = new Rng('manto');
  const list: DeckCloud[] = [];
  let y = GROUND - 2;
  let k = 0;
  while (GROUND - y < 440) {
    const up = GROUND - y;
    const cw0 = Math.min(240, 34 + up * 1.2);
    const near = Math.min(1, up / 260);
    let x = rng.next() * cw0;
    while (x < DECK_BAND) {
      const w = Math.round(cw0 * (0.7 + rng.next() * 0.6));
      const isBank = up < 45;
      const h = Math.round(w * (isBank ? 0.2 + rng.next() * 0.06 : 0.3 + rng.next() * 0.08));
      list.push({
        x,
        y: Math.round(y + (rng.next() - 0.5) * (6 + h * 0.6)),
        w,
        h,
        rank: rng.next(),
        fx: 0.152 + 0.035 * near,
        speed: (0.6 + 1.6 * near) * (0.85 + rng.next() * 0.3),
        kind: isBank ? 'bank' : 'cumulus',
        tower: 0.15 + rng.next() * 0.45,
        seed: `manto-${list.length}`,
      });
      x += w * (0.5 + rng.next() * 0.45);
    }
    y -= (5 + up * 0.22 + k * 0.4) * (0.7 + rng.next() * 0.6);
    k++;
  }
  return list;
}

/** Turno a partir del cual sale el manto: con nubes a `cloud`, cuánto de cada una se ve (0–1). */
export function deckAlpha(cloud: number, rank: number): number {
  // Ventana estrecha: casi ninguna se queda a medias (translúcida) con las nubes quietas.
  const a = Math.max(0, Math.min(1, ((cloud - 0.25) / 0.7 - rank) / 0.03));
  // En cuartos: el fundido va por escalones, como lo demás.
  return Math.ceil(a * 4) / 4;
}

/** Pinta una nube del manto con las cuatro luces. Sin la panza: el borde de abajo, ondulado. */
export function paintDeckCloud(c: DeckCloud): void {
  const rng = new Rng(c.seed);
  const shape = c.kind === 'bank' ? bank(c.seed, c.w, c.h) : cumulus(c.seed, c.w, c.h, c.tower);
  const cut = 5 + Math.floor(rng.next() * 2);
  const ph = rng.next() * 6;
  const img = {} as Record<SkyPhase, HTMLCanvasElement>;
  // El alba, con la nube del atardecer (bajo el manto apenas se distinguen): un cuarto menos
  // de memoria.
  for (const phase of PHASES) {
    if (phase === 'dawn') continue;
    const ramp = phase === 'day' && c.rank < 0.3 ? LIGHT_DAY : DECK_RAMP[phase];
    const b = paintCloud(shape, phase, ramp);
    for (let x = 0; x < c.w; x++) {
      const y0 =
        c.h - cut - 2 + Math.round(Math.sin(x / 7 + ph) * 1.5 + Math.sin(x / 3.1 + ph * 2) * 0.6);
      for (let y = Math.max(0, y0); y < c.h; y++) b.data[y * c.w + x] = 0;
    }
    img[phase] = bufferCanvas(b);
  }
  img.dawn = img.dusk;
  c.img = img;
}

/**
 * Un banco de niebla de `w` de ancho (se repite): el borde de arriba mellado en dos escalas y,
 * debajo, dos escalones de espesor (el de arriba, tramado). Del color `color`.
 */
export function fogBank(seed: string, color: string, w = 512, h = 140): HTMLCanvasElement {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  const waves = Array.from({ length: 4 }, (_, i) => ({
    k: (i + 1) * (i < 2 ? 1 : 3),
    a: i < 2 ? 7 - i * 2 : 2,
    p: rng.next() * Math.PI * 2,
  }));
  const c = rgba(color) & 0xffffff;
  const thin = (c | (0x70 << 24)) >>> 0;
  const mid = (c | (0xa8 << 24)) >>> 0;
  const thick = (c | (0xd8 << 24)) >>> 0;
  for (let x = 0; x < w; x++) {
    // Periódico en `w` y en escalones de 2 píxeles.
    const xx = x - (x % 2);
    let top = 18;
    for (const v of waves) top += Math.sin((xx / w) * Math.PI * 2 * v.k + v.p) * v.a;
    top = Math.round(top / 2) * 2;
    for (let y = Math.max(0, top); y < h; y++) {
      const d = y - top;
      if (d < 6) {
        // Tramado de 2×2: la mitad de los grumos.
        if (((xx >> 1) + (y >> 1)) % 2 === 0) b.data[y * w + x] = thin;
      } else b.data[y * w + x] = d < 20 ? mid : thick;
    }
  }
  return bufferCanvas(b);
}

/** Colores de la bruma y la niebla según la luz. */
export const HAZE: Record<SkyPhase, [number, number, number]> = {
  day: [170, 179, 196],
  dusk: [150, 138, 150],
  dawn: [170, 156, 170],
  night: [34, 40, 64],
};
export const FOG_COLOR: Record<SkyPhase, string> = {
  day: '#c3cad6',
  dusk: '#b4a8b2',
  dawn: '#c0afbb',
  night: '#2c3350',
};

/** Rampa de la nieve en el paisaje, de la sombra a la luz. */
const SNOW_RAMP: [number, number, number][] = [
  [125, 138, 166],
  [163, 175, 196],
  [201, 210, 223],
  [232, 237, 243],
  [255, 255, 255],
];

/**
 * Una capa del paisaje, nevada: lo verde claro (prados, colinas) se cubre de nieve con la
 * sombra del dibujo de debajo; lo verde oscuro (los bosques) se queda, algo más frío; y en el
 * canto de arriba de todo, un copete blanco de uno o dos píxeles.
 */
export function snowyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const sctx = src.getContext('2d');
  const octx = out.getContext('2d');
  if (!sctx || !octx || !w || !h) return out;
  const img = sctx.getImageData(0, 0, w, h);
  const d = img.data;
  const a = (x: number, y: number) => (y < 0 ? 0 : d[(y * w + x) * 4 + 3]!);
  const res = octx.createImageData(w, h);
  const o = res.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3]! < 128) continue;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      let c: [number, number, number] = [r, g, b];
      const green = g > r * 1.02 && g > b * 0.95;
      if (a(x, y - 1) < 128) c = SNOW_RAMP[4]!;
      else if (a(x, y - 2) < 128 && ((x * 7 + y * 3) & 3) !== 0) c = SNOW_RAMP[3]!;
      else if (green && l > 70) c = SNOW_RAMP[Math.max(1, Math.min(4, Math.round((l - 50) / 40)))]!;
      else if (green) c = [r * 0.8 + 30, g * 0.8 + 32, b * 0.8 + 44];
      // Los tejados de las casas lejanas y lo marrón que mira arriba, ya cubiertos por el copete.
      o[i] = c[0];
      o[i + 1] = c[1];
      o[i + 2] = c[2];
      o[i + 3] = 255;
    }
  octx.putImageData(res, 0, 0);
  return out;
}
