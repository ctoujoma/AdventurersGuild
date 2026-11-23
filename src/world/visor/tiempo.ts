/**
 * El tiempo del bosque en el visor: lluvia (gotas en dos planos y salpicaduras en el camino) y
 * niebla (la del alba, que se levanta a media mañana; jirones que se mueven despacio). El tipo de
 * día sale de `expWeather` (una semilla por día); aquí solo se le da forma según la hora.
 */
import type { PixelBuffer } from '../../art/pixel';
import type { ExpWeather } from '../../core/model';
import type { Encuadre } from './encuadre';
import { pack, unpack, type Clima, type Luz } from './luz';
import { clamp01, hash, hash2, lerp, noise2, smooth } from './tonos';

/** Lo de alba que es (1 de madrugada al amanecer, se levanta de 7:30 a 10:30). */
const dawnFog = (h: number) =>
  h < 2 ? 0.55 : h < 7.5 ? 1 : h < 12 ? 1 - smooth(7.5, 10.5, h) : h > 21 ? 0.55 : 0;

export function climaOf(
  w: ExpWeather,
  hour: number,
  wild: number,
  day: number,
  seed: string,
): Clima {
  const j = hash2(day, seed.length, 5);
  const wave = 0.5 + 0.5 * Math.sin(hour * 0.9 + j * 6);
  switch (w) {
    case 'niebla':
      return { rain: 0, fog: lerp(0.25, 1, dawnFog(hour)), cloud: 0.55 };
    case 'lluvia':
      return { rain: 0.45 + 0.45 * wave, fog: 0.3, cloud: 1 };
    case 'tormenta':
      return { rain: 1, fog: 0.2, cloud: 1 };
    case 'nieve':
    case 'viento':
    case 'polvo':
      return { rain: 0, fog: 0.1, cloud: 0.45 };
    default:
      return {
        rain: 0,
        fog: dawnFog(hour) * 0.5 * smooth(0.12, 0.6, wild),
        cloud: 0.12 + j * 0.25,
      };
  }
}

interface Drop {
  x: number;
  y: number;
  v: number;
  len: number;
  far: boolean;
}

export class Lluvia {
  private drops: Drop[] = [];
  constructor(
    private e: Encuadre,
    seed: number,
  ) {
    const n = Math.round((e.w * e.h) / 45);
    for (let i = 0; i < n; i++) {
      const far = hash(i * 5 + seed) < 0.55;
      this.drops.push({
        x: hash(i * 3 + seed) * (e.w + 40),
        y: hash(i * 7 + seed) * (e.h + 20),
        v: far ? 90 + hash(i * 11) * 30 : 140 + hash(i * 13) * 50,
        len: far ? 3 : 4 + Math.round(hash(i * 17) * 2),
        far,
      });
    }
  }

  draw(b: PixelBuffer, l: Luz, time: number, travel: number): void {
    const r = l.clima.rain;
    if (r <= 0.02) return;
    const e = this.e;
    const n = Math.round(this.drops.length * r);
    const lite = tone([168, 186, 214], l);
    const dim = tone([110, 126, 160], l);
    const span = e.h + 20;
    const wspan = e.w + 40;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i]!;
      const y = (d.y + time * d.v) % span;
      const x0 = ((((d.x - y * 0.3 - travel * (d.far ? 0.3 : 1.1)) % wspan) + wspan) % wspan) - 20;
      // Las de lejos no bajan del suelo (caen tras los árboles).
      if (d.far && y > e.feet) continue;
      for (let k = 0; k < d.len; k++) {
        const X = Math.round(x0 - k * 0.3);
        const Y = Math.round(y - 10 - k);
        if (b.inside(X, Y)) b.data[Y * b.w + X] = d.far || k > 1 ? dim : lite;
      }
    }
    // Salpicaduras en el camino.
    const m = Math.round(e.w * 0.15 * r);
    for (let i = 0; i < m; i++) {
      const cyc = Math.floor(time * 6 + hash(i) * 6);
      const x = Math.floor(hash(cyc * 31 + i) * e.w);
      const y = e.feet - 4 + Math.floor(hash(cyc * 17 + i) * 9);
      b.set(x, y, lite);
      if (hash(cyc + i * 3) < 0.5) {
        b.set(x - 1, y - 1, dim);
        b.set(x + 1, y - 1, dim);
      }
    }
  }
}

const tone = (c: [number, number, number], l: Luz) =>
  pack([
    c[0] * (0.4 + 0.6 * l.tint[0]),
    c[1] * (0.4 + 0.6 * l.tint[1]),
    c[2] * (0.4 + 0.6 * l.tint[2]),
  ]);

// ---------- Niebla ----------

const TW = 256;
const TH = 64;
let tile: Float32Array | null = null;
function fogTile(): Float32Array {
  if (tile) return tile;
  tile = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      const a = noise2(x / 32, y / 9, 3, TW / 32);
      const c = noise2(x / 11, y / 4, 4, TW / 11);
      tile[y * TW + x] = a * 0.72 + c * 0.28;
    }
  return tile;
}

/**
 * Jirones de niebla: detrás (entre las colinas y los árboles cerca, más densa en el fondo del
 * valle) o delante (a ras de suelo, más tenue).
 */
export function drawMist(
  b: PixelBuffer,
  e: Encuadre,
  l: Luz,
  time: number,
  travel: number,
  where: 'lejos' | 'cerca',
): void {
  const f = l.clima.fog;
  if (f <= 0.04) return;
  const T = fogTile();
  const fc = l.fogColor;
  const lite = pack(fc);
  const [r, g, bl] = unpack(lite);
  const y0 = where === 'lejos' ? Math.round(e.hor - e.hor * 0.25) : e.ground - 4;
  const y1 = where === 'lejos' ? e.ground + 6 : e.feet + 3;
  const drift = time * (where === 'lejos' ? 1.5 : 3) + travel * (where === 'lejos' ? 0.3 : 0.9);
  const k = where === 'lejos' ? 1 : 0.7;
  const cap = where === 'lejos' ? 1 : 0.7;
  for (let y = y0; y < y1; y++) {
    // Más espesa en el fondo del valle (al pie de los montes y al ras del suelo).
    const u = (y - y0) / Math.max(1, y1 - y0);
    const band =
      where === 'lejos'
        ? 0.55 + 0.45 * Math.sin(Math.PI * clamp01(u * 1.2))
        : Math.sin(Math.PI * u);
    const ty = ((y + (where === 'lejos' ? 0 : 23)) % TH) * TW;
    for (let x = 0; x < e.w; x++) {
      const n = T[ty + (((Math.floor(x + drift) % TW) + TW) % TW)]!;
      const a = (n - 0.35) * 1.9 * f * band * k;
      if (a <= 0) continue;
      const i = y * b.w + x;
      // En cuatro velos (escalones de mezcla), tramados en grumos de 2 px de uno a otro.
      const q = Math.min(4, Math.floor(a * 5 * cap + hash2(x >> 1, y >> 1, 9) * 0.999)) / 5;
      if (q <= 0) continue;
      const [cr, cg, cb] = unpack(b.data[i]!);
      b.data[i] = pack([cr + (r - cr) * q, cg + (g - cg) * q, cb + (bl - cb) * q]);
    }
  }
}
