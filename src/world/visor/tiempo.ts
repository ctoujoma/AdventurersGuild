/**
 * El tiempo del bosque en el visor: lluvia (gotas en dos planos y salpicaduras en el camino) y
 * niebla (la del alba, que se levanta a media mañana; jirones que se mueven despacio). El tipo de
 * día sale de `expWeather` (una semilla por día); aquí solo se le da forma según la hora.
 */
import { bayer, type PixelBuffer } from '../../art/pixel';
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
      // Tormenta seca (las ruinas): negra, con polvo y relámpagos, sin una gota.
      return { rain: 0, fog: 0.35, cloud: 1, storm: 1, dust: 0.35, wind: 0.7 };
    case 'nieve':
      return { rain: 0, fog: 0.3, cloud: 0.85, snow: 0.55 + 0.45 * wave, wind: 0.15 };
    case 'viento':
      return { rain: 0, fog: 0.08, cloud: 0.35, wind: 0.55 + 0.45 * wave };
    case 'polvo':
      return { rain: 0, fog: 0.45 + 0.3 * wave, cloud: 0.15, dust: 0.6 + 0.3 * wave, wind: 0.6 };
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
  const gust = 1 + (l.clima.wind ?? 0) * 8;
  const drift =
    time * (where === 'lejos' ? 1.5 : 3) * gust + travel * (where === 'lejos' ? 0.3 : 0.9);
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

// ---------- Nieve, viento, polvo y relámpagos ----------

interface Mote {
  x: number;
  y: number;
  v: number;
  ph: number;
  far: boolean;
}

/**
 * Lo que vuela por el aire con el tiempo de cada rumbo: copos (en dos planos, que se mecen y se
 * inclinan con el viento), rachas (rayas claras que cruzan deprisa; en la sierra, nieve que el
 * viento levanta del suelo), motas de polvo y, con tormenta seca, el relámpago (fogonazo y rayo).
 */
export class Aire {
  private motes: Mote[] = [];
  constructor(
    private e: Encuadre,
    seed: number,
  ) {
    const n = Math.round((e.w * e.h) / 60);
    for (let i = 0; i < n; i++)
      this.motes.push({
        x: hash(i * 3 + seed) * (e.w + 40),
        y: hash(i * 7 + seed) * (e.h + 20),
        v: 0.6 + hash(i * 11 + seed) * 0.8,
        ph: hash(i * 13 + seed) * 6.28,
        far: hash(i * 5 + seed) < 0.55,
      });
  }

  draw(b: PixelBuffer, l: Luz, time: number, travel: number, snowy: boolean): void {
    const c = l.clima;
    const wind = c.wind ?? 0;
    if (c.snow) this.snow(b, l, time, travel, c.snow, wind);
    if (wind > 0.3) this.streaks(b, l, time, wind, snowy, c.dust ?? 0);
    if (c.dust) this.dust(b, l, time, travel, c.dust, wind);
    if (c.storm) this.storm(b, l, time, c.storm);
  }

  private snow(b: PixelBuffer, l: Luz, time: number, travel: number, k: number, wind: number) {
    const e = this.e;
    const n = Math.round(this.motes.length * k);
    const lite = tone([236, 242, 250], l);
    const dim = tone([176, 188, 210], l);
    const span = e.h + 20;
    const wspan = e.w + 40;
    for (let i = 0; i < n; i++) {
      const m = this.motes[i]!;
      const fall = m.far ? 9 : 16;
      const y = (m.y + time * fall * m.v) % span;
      const sway = Math.sin(time * 1.3 + m.ph) * (m.far ? 2 : 4);
      const x0 = m.x - y * wind * 1.4 + sway - time * wind * 30 - travel * (m.far ? 0.3 : 1.1);
      const x = Math.round((((x0 % wspan) + wspan) % wspan) - 20);
      const Y = Math.round(y - 10);
      if (m.far && Y > e.feet) continue;
      if (m.far) b.set(x, Y, dim);
      else {
        b.set(x, Y, lite);
        b.set(x + 1, Y, lite);
        b.set(x, Y + 1, lite);
        b.set(x + 1, Y + 1, dim);
      }
    }
  }

  /** Rachas: rayas que cruzan; en la sierra, nieve levantada a ras de suelo. */
  private streaks(
    b: PixelBuffer,
    l: Luz,
    time: number,
    wind: number,
    snowy: boolean,
    dust: number,
  ) {
    const e = this.e;
    const n = Math.round((e.w / 4) * wind);
    const col = dust > 0 ? tone([230, 196, 150], l) : tone([226, 234, 246], l);
    for (let i = 0; i < n; i++) {
      const sp = 0.5 + wind * 0.4;
      const cyc = Math.floor(time * sp + hash(i * 7));
      const u = (time * sp + hash(i * 7)) % 1;
      const y = Math.round(hash(cyc * 31 + i) * e.h * 0.9);
      const len = 10 + Math.round(hash(cyc * 17 + i) * 16);
      const x = Math.round(e.w + 30 - u * (e.w + 60));
      const wave = Math.sin(u * 9 + i) * 1.5;
      for (let k = 0; k < len; k++) {
        if ((k + i) % 3 === 0 && k > 2) continue;
        dith(b, x + k, Math.round(y + wave * (k / len)), col, 0.9 - (k / len) * 0.5);
      }
    }
    // Nieve que el viento levanta del suelo.
    if (snowy) {
      const m = Math.round(e.w * 1.6 * wind);
      for (let i = 0; i < m; i++) {
        const u = (time * (1.2 + hash(i) * 0.8) + hash(i * 3)) % 1;
        const x = Math.round(e.w + 10 - u * (e.w + 30));
        const y = Math.round(
          e.feet + 6 - Math.sin(u * 3.1) * (4 + hash(i * 5) * 14) - hash(i * 9) * 8,
        );
        b.set(x, y, col);
        if (hash(i * 13) < 0.4) b.set(x + 1, y, col);
      }
    }
  }

  private dust(b: PixelBuffer, l: Luz, time: number, travel: number, k: number, wind: number) {
    const e = this.e;
    const n = Math.round(this.motes.length * 0.5 * k);
    const a = tone([224, 186, 132], l);
    const d = tone([168, 128, 86], l);
    const wspan = e.w + 40;
    for (let i = 0; i < n; i++) {
      const m = this.motes[i]!;
      const x0 = m.x - time * (40 + wind * 90) * m.v - travel * (m.far ? 0.3 : 1.1);
      const x = Math.round((((x0 % wspan) + wspan) % wspan) - 20);
      const y = Math.round((m.y % e.h) + Math.sin(time * 2 + m.ph) * 3);
      b.set(x, y, m.far ? d : a);
      if (!m.far && hash(i) < 0.3) b.set(x + 1, y, d);
    }
  }

  /** Cada rato, un relámpago: fogonazo en escalones y el rayo a tirones de dos píxeles. */
  private storm(b: PixelBuffer, _l: Luz, time: number, k: number) {
    const e = this.e;
    const P = 7;
    const cyc = Math.floor(time / P);
    const t = time - cyc * P;
    if (hash(cyc * 13 + 5) > 0.75 * k) return;
    const at = 1 + hash(cyc * 7) * 3;
    const dt = t - at;
    if (dt < 0 || dt > 0.6) return;
    const flash =
      dt < 0.08 ? 0.55 : dt < 0.16 ? 0.1 : dt < 0.26 ? 0.35 : 0.12 * (1 - (dt - 0.26) / 0.34);
    const fc = pack([226, 222, 246]);
    for (let y = 0; y < e.h; y++)
      for (let x = 0; x < e.w; x++) {
        const i = y * b.w + x;
        const q = Math.floor(flash * (y < e.hor ? 1 : 0.5) * 4 + bayer(x, y) * 0.999) / 4;
        if (q > 0) b.data[i] = mixPix(b.data[i]!, fc, q);
      }
    if (dt > 0.3) return;
    // El rayo: de arriba al horizonte, quebrado, con una rama.
    let x = Math.round(e.w * (0.15 + hash(cyc * 3) * 0.7));
    const core = pack([250, 248, 255]);
    const glow = pack([170, 160, 230]);
    for (let y = 0; y < e.hor - 4; y += 2) {
      x += Math.round((hash(cyc * 97 + y) - 0.5) * 4);
      for (let j = 0; j < 2; j++) {
        b.set(x, y + j, core);
        b.set(x + 1, y + j, glow);
        b.set(x - 1, y + j, glow);
      }
      if (y === Math.round(e.hor * 0.4)) {
        let bx = x;
        for (let yy = y; yy < y + e.hor * 0.3; yy += 2) {
          bx += hash(cyc + yy) < 0.7 ? 2 : -1;
          b.set(bx, yy, glow);
          b.set(bx, yy + 1, core);
        }
      }
    }
  }
}

function mixPix(a: number, c: number, q: number): number {
  const [r, g, bl] = unpack(a);
  const [r2, g2, b2] = unpack(c);
  return pack([r + (r2 - r) * q, g + (g2 - g) * q, bl + (b2 - bl) * q]);
}

/** Un píxel a medias (tramado). */
function dith(b: PixelBuffer, x: number, y: number, c: number, a: number) {
  if (!b.inside(x, y)) return;
  if (hash2(x, y, 7) > a) return;
  b.data[y * b.w + x] = c;
}
