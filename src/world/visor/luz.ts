/**
 * La luz del visor según la hora (0–24): un tinte que multiplica, una bruma hacia la que se van
 * los planos lejanos y el cielo de cada momento (noche, alba, día, atardecer), que pasa de uno a
 * otro tramando. Con eso se hace una tabla de 256 colores por capa (`lutOf`).
 */
import type { SkyPhase } from '../../art/clouds';
import { RAMPS, clamp01, lerp, type Mat, type Ramps } from './tonos';

type RGB = [number, number, number];
const hex = (s: string): RGB => {
  const v = parseInt(s.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
export const pack = (c: RGB): number =>
  ((255 << 24) |
    (Math.max(0, Math.min(255, Math.round(c[2]))) << 16) |
    (Math.max(0, Math.min(255, Math.round(c[1]))) << 8) |
    Math.max(0, Math.min(255, Math.round(c[0])))) >>>
  0;
export const unpack = (n: number): RGB => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

interface Key {
  h: number;
  sky: SkyPhase;
  tint: RGB;
  haze: string;
  /** Cuánto pesa la bruma de la distancia. */
  hz: number;
}

const NIGHT_TINT: RGB = [0.3, 0.35, 0.6];
const KEYS: readonly Key[] = [
  { h: 0, sky: 'night', tint: NIGHT_TINT, haze: '#1c2038', hz: 0.55 },
  { h: 4.6, sky: 'night', tint: NIGHT_TINT, haze: '#1c2038', hz: 0.55 },
  { h: 5.6, sky: 'dawn', tint: [0.6, 0.55, 0.74], haze: '#8a6ea0', hz: 0.8 },
  { h: 6.6, sky: 'dawn', tint: [1.02, 0.84, 0.8], haze: '#f0aaa4', hz: 0.9 },
  { h: 8.6, sky: 'day', tint: [1, 1, 1], haze: '#a8d2ee', hz: 0.72 },
  { h: 16.4, sky: 'day', tint: [1, 0.99, 0.95], haze: '#a8d2ee', hz: 0.72 },
  { h: 18.2, sky: 'dusk', tint: [1.06, 0.8, 0.6], haze: '#f49a66', hz: 0.9 },
  { h: 19.5, sky: 'dusk', tint: [0.64, 0.5, 0.64], haze: '#7a4482', hz: 0.8 },
  { h: 21, sky: 'night', tint: NIGHT_TINT, haze: '#1c2038', hz: 0.55 },
  { h: 24, sky: 'night', tint: NIGHT_TINT, haze: '#1c2038', hz: 0.55 },
];

/** El tiempo que hace en el visor (cada cosa de 0 a 1). */
export interface Clima {
  rain: number;
  fog: number;
  /** Cubierto (nubes grises y menos luz). */
  cloud: number;
  /** Nieve que cae (la sierra). */
  snow?: number;
  /** Viento: rachas, nubes que corren, nieve o polvo que vuela. */
  wind?: number;
  /** Polvo en el aire: la luz y la bruma se vuelven ocres (las ruinas). */
  dust?: number;
  /** Tormenta seca: cielo negro, relámpagos sin lluvia. */
  storm?: number;
}

/** El color del polvo en el aire. */
export const DUST: RGB = [206, 164, 112];

export interface Luz {
  hour: number;
  tint: RGB;
  haze: RGB;
  hz: number;
  /** El cielo: dos luces y cuánto de la segunda (se traman). */
  skyA: SkyPhase;
  skyB: SkyPhase;
  skyT: number;
  /** Lo de noche que es (0 día, 1 noche cerrada): estrellas, luna, ojos. */
  night: number;
  clima: Clima;
  fogColor: RGB;
}

export function luzAt(hour: number, clima: Clima): Luz {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.h <= h) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const t = clamp01((h - a.h) / Math.max(0.001, b.h - a.h));
  let tint = mix(a.tint, b.tint, t);
  let haze = mix(hex(a.haze), hex(b.haze), t);
  const night =
    h < 4.6 ? 1 : h < 5.9 ? 1 - (h - 4.6) / 1.3 : h < 19.6 ? 0 : h < 21 ? (h - 19.6) / 1.4 : 1;
  // Cubierto: menos luz, más gris.
  const grey: RGB = mix([150, 158, 176], [40, 44, 64], night);
  const ov = clamp01(clima.cloud * 0.8 + clima.rain * 0.5);
  tint = mix(tint, [tint[0] * 0.78, tint[1] * 0.8, tint[2] * 0.86], ov);
  haze = mix(haze, grey, ov * 0.7);
  let fogColor = mix(mix(haze, [200, 208, 222], 0.55 * (1 - night * 0.7)), haze, 0.2);
  // Polvo: todo más cálido y la bruma ocre (de noche, pardo oscuro).
  const dust = clamp01(clima.dust ?? 0);
  if (dust > 0) {
    const dc = mix(DUST, [60, 46, 40], night * 0.8);
    tint = mix(tint, [tint[0] * 1.04, tint[1] * 0.92, tint[2] * 0.74], dust);
    haze = mix(haze, dc, dust * 0.75);
    fogColor = mix(fogColor, dc, dust);
  }
  // Tormenta seca: luz plomiza y verdosa.
  const storm = clamp01(clima.storm ?? 0);
  if (storm > 0) tint = mix(tint, [tint[0] * 0.62, tint[1] * 0.64, tint[2] * 0.66], storm);
  return {
    hour: h,
    tint,
    haze,
    hz: lerp(a.hz, b.hz, t),
    skyA: a.sky,
    skyB: b.sky,
    skyT: a.sky === b.sky ? 0 : t,
    night,
    clima,
    fogColor,
  };
}

/** Qué pesa la bruma y la niebla en cada plano (de lejos a cerca). */
export interface Depth {
  haze: number;
  fog: number;
  /** Escalones que se oscurece (lo de delante, a contraluz). */
  dark?: number;
  /** Lo que se apaga (el bosque cerrado, en sombra): multiplica la luz. */
  dim?: number;
}

/** Tabla de colores de una capa: `lut[code]` (code = mat << 4 | escalón). */
export function lutOf(l: Luz, d: Depth, ramps: Ramps = RAMPS): Uint32Array {
  const lut = new Uint32Array(256);
  const hz = clamp01(d.haze * l.hz);
  const fg = clamp01(d.fog * l.clima.fog * 0.92);
  const desat = clamp01(l.clima.cloud * 0.25 + l.clima.rain * 0.2 + l.night * 0.15);
  for (const key of Object.keys(ramps)) {
    const m = Number(key) as Mat;
    const ramp = ramps[m];
    for (let i = 0; i < 16; i++) {
      const j = Math.max(0, Math.min(ramp.length - 1, i - (d.dark ?? 0)));
      let c = hex(ramp[j]!);
      const lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
      c = mix(c, [lum, lum, lum], desat);
      const dm = d.dim ?? 1;
      c = [c[0] * l.tint[0] * dm, c[1] * l.tint[1] * dm, c[2] * l.tint[2] * (0.1 + 0.9 * dm)];
      c = mix(c, l.haze, hz);
      c = mix(c, l.fogColor, fg);
      lut[(m << 4) | i] = pack(c);
    }
  }
  return lut;
}

/** Tiñe un color suelto (los muñecos) con la luz: misma cuenta que la tabla, sin bruma. */
export function tintColor(c: number, l: Luz, fog = 0): number {
  if (!(c >>> 24)) return c;
  let rgb = unpack(c);
  const desat = clamp01(l.clima.cloud * 0.2 + l.night * 0.15);
  const lum = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
  rgb = mix(rgb, [lum, lum, lum], desat);
  // Los muñecos se quedan algo más claros que el paisaje de noche (que se lean).
  const k = 0.25 * l.night;
  rgb = [
    rgb[0] * lerp(l.tint[0], 1, k),
    rgb[1] * lerp(l.tint[1], 1, k),
    rgb[2] * lerp(l.tint[2], 1, k),
  ];
  if (fog) rgb = mix(rgb, l.fogColor, clamp01(fog * l.clima.fog));
  return pack(rgb);
}

/** La luz cálida de una hoguera sobre un color ya teñido: lo destiñe y lo calienta (`k` 0–1). */
export function warmColor(c: number, l: Luz, k: number): number {
  const rgb = unpack(c);
  const t = l.tint;
  const day: RGB = [rgb[0] / t[0], rgb[1] / t[1], rgb[2] / t[2]];
  const warm: RGB = [day[0] * 1.2 + 34, day[1] * 0.8 + 10, day[2] * 0.42];
  return pack(mix(rgb, warm, clamp01(k)));
}

export const rgbOf = hex;
