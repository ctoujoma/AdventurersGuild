/**
 * El cielo de la vista por salas, pintado en 2D a pantalla completa por detrás del edificio:
 * estrellas, luna, sol, nubes, las capas lejanas con su paralaje y los colores del día, del
 * atardecer y del amanecer. Por las ventanas de las salas se ve este mismo cielo.
 */
import { bufferCanvas, drawBuffer } from '../../art/canvas';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { GROUND, WORLD_X0 } from '../geometry';
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
/** La luna, a cierta distancia en x y por encima del horizonte. */
const MOON = { x: 84, up: 156 } as const;
/** Lo más alto que sube el sol sobre el horizonte, en píxeles. */
const SUN_UP = 170;

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
  private parallax: { c: HTMLCanvasElement; l: ParallaxLayer }[] = parallaxLayers().map((l) => ({
    c: bufferCanvas(l.buf),
    l,
  }));
  private starList: Star[] = stars();
  private clouds = [0, 1, 2, 3].map((i) => ({
    x: i * 170 + 20,
    y: 30 + ((i * 37) % 80),
    img: cloud(i),
    speed: 2 + i,
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
    ctx.drawImage(this.skyC, WORLD_X0 - Math.round(cx * SKY_FX), top);
    ctx.globalAlpha = Math.max(0, 1 - dl.day * 1.4);
    for (const s of dl.day > 0.7 ? [] : this.starList) {
      const sx = s.x + WORLD_X0 - Math.round(cx * SKY_FX);
      const sy = s.y + top;
      if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
      const tw = noise(s.x, Math.floor(t * 1.5 + s.y));
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
        Math.round(MOON.x - MOON_R - cx * SKY_FX),
        Math.round(hz - MOON.up - MOON_R),
      );
      ctx.globalAlpha = 1;
    }
    this.drawDay(ctx, dl, cx, hz, vw, vh);
    for (const cl of this.clouds) {
      const x = ((cl.x + t * cl.speed) % 900) - 60 + WORLD_X0 - cx * 0.2;
      drawBuffer(ctx, cl.img, x, cl.y + top);
    }
    if (nl.warm > 0) this.drawDawn(ctx, nl.warm, hz, vw, vh);
    for (const { c, l } of this.parallax) ctx.drawImage(c, WORLD_X0 - Math.round(cx * l.fx), top);
    if (dl.day > 0 || dl.dusk > 0) {
      ctx.globalCompositeOperation = 'screen';
      const h = (v: number) => Math.round(v * dl.day + v * 0.4 * dl.dusk);
      ctx.fillStyle = `rgb(${h(70) + Math.round(60 * dl.dusk)}, ${h(105)}, ${h(120)})`;
      ctx.fillRect(0, 0, vw, vh);
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
    const sx = Math.round(300 - 280 * p - cx * SKY_FX);
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
