/**
 * El cielo de la vista por salas, pintado en 2D a pantalla completa por detrás del edificio:
 * estrellas, luna, sol, nubes, las capas lejanas con su paralaje y los colores del día, del
 * atardecer y del amanecer. Por las ventanas de las salas se ve este mismo cielo.
 */
import { bufferCanvas, drawBuffer } from '../../art/canvas';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { GROUND, WORLD_X0 } from '../geometry';
import { hillLife, skyLife, treeLife } from './life';
import { glowSprite } from '../lighting';
import {
  MOON_R,
  buildMoon,
  buildSky,
  parallaxLayers,
  stars,
  type ParallaxLayer,
  type Star,
} from '../parallax';

const SKY_FX = 0.15;
/** Las nubes, entre el cielo y las montañas (que van por delante y se mueven algo más). */
export const CLOUD_FX = 0.17;
/** Alto de la franja de estrellas (se repite hacia arriba) y ancho de la de las nubes. */
const STAR_H = 230;
const CLOUD_W = 900;
/** La luna, a cierta distancia en x y por encima del horizonte. */
const MOON = { x: 84, up: 156 } as const;
/** Lo más alto que sube el sol sobre el horizonte, en píxeles. */
const SUN_UP = 170;

/**
 * Cuánto se ha corrido una capa lejana (que se mueve a `f` de la cámara) en una vista que empieza
 * en `cx` y mide `vw`. Va por el centro de la vista, no por su borde: al acercar o alejar (cambia
 * `vw` con el mismo centro), lo lejano se queda donde estaba.
 */
const pan = (cx: number, vw: number, f: number) => Math.round((cx + vw / 2) * f - vw / 2);

export interface Daylight {
  /** Luz del día (0–1), del atardecer (0–1) y avance del día (0 mañana – 1 noche). */
  day: number;
  dusk: number;
  tod: number;
}

export interface NightLight {
  /** Lo cerrada que está la noche y lo que calienta el amanecer (0–1). */
  dark: number;
  warm: number;
}

const noise = (a: number, b: number) => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000;
};

export class Sky {
  private skyC = bufferCanvas(buildSky());
  private moonC = bufferCanvas(buildMoon());
  private parallax: { c: HTMLCanvasElement; d: HTMLCanvasElement; l: ParallaxLayer }[] =
    parallaxLayers().map((l) => ({ c: bufferCanvas(l.buf), d: bufferCanvas(l.day), l }));
  private starList: Star[] = stars();
  private clouds = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: i * 150 + ((i * 53) % 70),
    y: 24 + ((i * 37) % 96),
    img: cloud(i),
    day: bufferCanvas(dayCloud(i)),
    speed: 1.5 + ((i * 7) % 5) * 0.6,
  }));

  /**
   * Pinta el cielo de una vista que empieza en la x `cx` del mundo. `hz` es la altura en la vista
   * del horizonte (el fondo del terreno): como en una cámara de verdad, lo lejano (montes, sol y
   * luna) se queda a esa altura aunque la cámara suba o baje.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    vw: number,
    vh: number,
    t: number,
    dl: Daylight,
    nl: NightLight,
    hz: number,
  ): void {
    // Las capas se dibujaron con el horizonte en GROUND: se bajan o suben hasta `hz`.
    const top = Math.round(hz - GROUND);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.black;
    ctx.fillRect(0, 0, vw, vh);
    const skyX = WORLD_X0 - pan(cx, vw, SKY_FX);
    tile(ctx, this.skyC, skyX, top, vw);
    ctx.globalAlpha = Math.max(0, 1 - dl.day * 1.4);
    // Las estrellas se repiten a lo ancho y, por encima de su franja, también hacia arriba.
    const w = this.skyC.width;
    const k0 = Math.floor(-skyX / w);
    for (let ky = 0; dl.day <= 0.7 && top - ky * STAR_H > -STAR_H; ky++)
      for (let k = k0; skyX + k * w < vw; k++)
        for (const s of this.starList) {
          if (ky > 0 && s.y >= STAR_H) continue;
          const sx = s.x + skyX + k * w;
          const sy = s.y + top - ky * STAR_H;
          if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
          const tw = noise(s.x + k * 7 + ky * 13, Math.floor(t * 1.5 + s.y));
          if (!s.bright && tw < 0.25) continue;
          ctx.fillStyle = s.bright && tw > 0.6 ? P.white : tw > 0.5 ? P.mist : P.fog;
          ctx.fillRect(sx, sy, 1, 1);
        }
    ctx.globalAlpha = 1;
    const moonA = Math.max(0, 1 - dl.day * 1.25);
    if (moonA > 0) {
      ctx.globalAlpha = moonA;
      ctx.drawImage(
        this.moonC,
        Math.round(MOON.x - MOON_R - pan(cx, vw, SKY_FX)),
        Math.round(hz - MOON.up - MOON_R),
      );
      ctx.globalAlpha = 1;
    }
    this.drawDay(ctx, dl, cx, hz, vw, vh);
    // Cuánto se ve el paisaje de día (con sus colores) sobre las siluetas de la noche.
    const dayK = Math.min(1, dl.day + dl.dusk * 0.6 + nl.warm * 0.5);
    // Las nubes van y vienen en una franja de CLOUD_W que se repite a lo ancho; de día, blancas.
    for (const cl of this.clouds) {
      const x = ((cl.x + t * cl.speed) % CLOUD_W) - 60 + WORLD_X0 - pan(cx, vw, CLOUD_FX);
      for (let k = Math.floor(-x / CLOUD_W) - 1; x + k * CLOUD_W < vw; k++) {
        if (dayK < 1) {
          ctx.globalAlpha = 1 - dayK;
          drawBuffer(ctx, cl.img, x + k * CLOUD_W, cl.y + top);
        }
        if (dayK > 0) {
          ctx.globalAlpha = dayK;
          ctx.drawImage(cl.day, Math.round(x + k * CLOUD_W), Math.round(cl.y + top));
        }
      }
    }
    ctx.globalAlpha = 1;
    if (nl.warm > 0) this.drawDawn(ctx, nl.warm, hz, vw, vh);
    const light = { day: dayK, dark: Math.max(nl.dark, 1 - dl.day - dl.dusk) };
    skyLife(ctx, WORLD_X0 - pan(cx, vw, SKY_FX), top, vw, t, light);
    // El cielo, más claro de día (solo el cielo: el paisaje ya trae sus colores).
    if (dl.day > 0 || dl.dusk > 0) {
      ctx.globalCompositeOperation = 'screen';
      const h = (v: number) => Math.round(v * dl.day + v * 0.4 * dl.dusk);
      ctx.fillStyle = `rgb(${h(70) + Math.round(60 * dl.dusk)}, ${h(105)}, ${h(120)})`;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
    }
    this.parallax.forEach(({ c, d, l }, i) => {
      const x = WORLD_X0 - pan(cx, vw, l.fx);
      tile(ctx, c, x, top, vw);
      if (dayK > 0) {
        ctx.globalAlpha = dayK;
        tile(ctx, d, x, top, vw);
        ctx.globalAlpha = 1;
      }
      if (i === 1) hillLife(ctx, x, top, vw, t, light);
      if (i === 3) treeLife(ctx, x, top, vw, t, light);
    });
    // Al atardecer, el paisaje se tiñe de cálido.
    if (dl.dusk > 0) {
      ctx.globalCompositeOperation = 'multiply';
      const d = dl.dusk;
      ctx.fillStyle = `rgb(255, ${Math.round(255 - 55 * d)}, ${Math.round(255 - 95 * d)})`;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (nl.dark > 0) {
      ctx.globalCompositeOperation = 'multiply';
      const k = (v: number) => Math.round(255 + (v - 255) * nl.dark);
      ctx.fillStyle = `rgb(${k(52)}, ${k(60)}, ${k(110)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Cielo de día por encima del de noche: azul, con el sol cruzando. */
  private drawDay(
    ctx: CanvasRenderingContext2D,
    d: Daylight,
    cx: number,
    hz: number,
    vw: number,
    vh: number,
  ): void {
    const horizon = hz - 40;
    if (d.day > 0) {
      ctx.globalAlpha = d.day;
      const g = ctx.createLinearGradient(0, horizon - 230, 0, horizon + 10);
      g.addColorStop(0, '#3b7fc4');
      g.addColorStop(0.65, '#7fbde6');
      g.addColorStop(1, '#cfe9f2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }
    if (d.dusk > 0) {
      const g = ctx.createLinearGradient(0, horizon - 200, 0, horizon + 20);
      g.addColorStop(0, 'rgba(104, 56, 108, 0)');
      g.addColorStop(0.55, `rgba(232, 110, 120, ${0.5 * d.dusk})`);
      g.addColorStop(1, `rgba(247, 118, 34, ${0.75 * d.dusk})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
    const sunUp = Math.max(d.day, d.dusk);
    if (sunUp <= 0) return;
    // Sale ya alto por la mañana, cruza y al atardecer baja hasta perderse tras los montes.
    const p = Math.min(1, 0.1 + d.tod * 0.95);
    const sx = Math.round(300 - 280 * p - pan(cx, vw, SKY_FX));
    const sy = Math.round(hz - 10 - (Math.sin(Math.PI * p) * 1.15 - 0.15) * SUN_UP);
    if (sy > hz + 20) return;
    const warmSun = d.dusk > 0.3;
    ctx.globalAlpha = Math.min(1, sunUp * 1.3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      glowSprite(30, warmSun ? [254, 140, 52] : [255, 240, 180], 0.55),
      sx - 30,
      sy - 30,
    );
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = warmSun ? P.orange : P.lemon;
    for (let y = -8; y <= 8; y++) {
      const w = Math.floor(Math.sqrt(64 - y * y));
      ctx.fillRect(sx - w, sy + y, w * 2 + 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawDawn(
    ctx: CanvasRenderingContext2D,
    warm: number,
    hz: number,
    vw: number,
    vh: number,
  ): void {
    const horizon = hz - 40;
    const g = ctx.createLinearGradient(0, horizon - 200, 0, horizon + 20);
    g.addColorStop(0, 'rgba(90, 60, 120, 0)');
    g.addColorStop(0.55, `rgba(232, 110, 120, ${0.45 * warm})`);
    g.addColorStop(1, `rgba(254, 174, 52, ${0.8 * warm})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }
}

/**
 * Pinta una capa lejana a lo ancho de la vista: copia sí, copia en espejo, para que en las
 * juntas el monte o el cielo sigan sin un salto (al alejar mucho la cámara, una sola no basta).
 */
function tile(
  ctx: CanvasRenderingContext2D,
  c: HTMLCanvasElement,
  x: number,
  y: number,
  vw: number,
) {
  const w = c.width;
  for (let k = Math.floor(-x / w); x + k * w < vw; k++) {
    const at = x + k * w;
    if (k % 2 === 0) {
      ctx.drawImage(c, at, y);
      continue;
    }
    ctx.save();
    ctx.translate(at + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  }
}

/** Nube de día: bultos blancos con la panza gris y la luz arriba. */
function dayCloud(i: number): PixelBuffer {
  const big = i % 3 === 0;
  const b = new PixelBuffer(big ? 70 : 48, big ? 22 : 16);
  const puffs: [number, number, number][] = big
    ? [
        [12, 14, 7],
        [24, 10, 9],
        [38, 8, 10],
        [51, 12, 8],
        [61, 15, 5],
      ]
    : [
        [10, 10, 6],
        [20, 7, 7],
        [31, 9, 6],
        [39, 11, 4],
      ];
  for (const [x, y, r] of puffs)
    b.ellipse(x + (i % 2) * 3, y, r, r * 0.75, (px, py) => {
      const u = (py - y) / (r * 0.75);
      return u < -0.45 ? P.white : u > 0.45 ? P.fog : (px + py) % 7 === 0 ? P.white : P.mist;
    });
  // La panza plana y gris.
  for (let x = 0; x < b.w; x++)
    for (let y = b.h - 3; y < b.h; y++) if (b.get(x, y) >>> 24) b.set(x, y, P.fog);
  return b;
}

function cloud(i: number): PixelBuffer {
  const b = new PixelBuffer(46, 14);
  const puffs: [number, number, number][] = [
    [10, 9, 6],
    [20, 6, 7],
    [31, 8, 6],
    [38, 10, 4],
  ];
  for (const [x, y, r] of puffs)
    b.ellipse(x + (i % 2) * 3, y, r, r * 0.75, (_px, py) =>
      py < y - r * 0.3 ? P.fog : py > y + 1 ? P.navy : P.slate,
    );
  return b;
}
