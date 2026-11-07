/**
 * El cielo de la vista por salas, pintado en 2D a pantalla completa por detrás del edificio:
 * estrellas, luna, sol, nubes, las capas lejanas con su paralaje y los colores del día, del
 * atardecer y del amanecer. Por las ventanas de las salas se ve este mismo cielo.
 */
import { bufferCanvas } from '../../art/canvas';
import {
  PHASES,
  SKY_BANDS,
  bank,
  cirrus,
  cumulus,
  paintCloud,
  skyStrip,
  type SkyPhase,
} from '../../art/clouds';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { GROUND, WORLD_X0 } from '../geometry';
import { hillLife, skyLife, treeLife } from './life';
import {
  FAR_FOREST_FX,
  LAKE_FRAMES,
  farForestCnc,
  groveCnc,
  hazed,
  mountainsCnc,
  skyStripCnc,
  untrammed,
} from './paisaje';
import { glowSprite } from '../lighting';
import {
  DECK_BAND,
  FOG_COLOR,
  GREY_BANDS,
  HAZE,
  deckAlpha,
  deckLayout,
  fogBank,
  paintDeckCloud,
} from './manto';
import { Rng } from '../../core/rng';
import {
  MOON_R,
  buildMoon,
  buildSky,
  groveTrees,
  parallaxLayers,
  stars,
  treelineTrees,
  type ParallaxLayer,
  type Star,
} from '../parallax';

const SKY_FX = 0.15;
/**
 * Las nubes, entre el cielo y las montañas (que van por delante y se mueven algo más): esto es
 * lo más rápido que va una capa de nubes, la de los cúmulos grandes.
 */
export const CLOUD_FX = 0.185;
/** Alto de la franja de estrellas (se repite hacia arriba). */
const STAR_H = 230;
/** Alto de las tiras del cielo de día (con el horizonte en GROUND, como las capas). */
const STRIP_H = GROUND + 40;
const STRIP_W = 256;

/**
 * Las capas de nubes: cada una en una franja de `band` de ancho que se repite, a `fx` de la
 * cámara. Arriba, los cirros (velos altos, casi quietos); en medio, los cúmulos grandes; abajo,
 * bancos tendidos y pequeños (lejos), que asoman entre los montes. `y` es la panza, contada
 * en la capa (con el horizonte en GROUND).
 */
interface CloudSpec {
  kind: 'cirrus' | 'cumulus' | 'bank';
  w: number;
  h: number;
  x: number;
  y: number;
  tower?: number;
}
/**
 * Por encima de la franja de siempre (al alejar del todo se ve mucho cielo): más nubes cada vez
 * más escasas, pequeñas y transparentes hacia arriba (`fade`), y sobre todo cirros, hasta que el
 * cielo se queda limpio. Así no hay un corte: se van acabando.
 */
const TOP = 40;
const FADE_H = 620;
const fadeAt = (y: number) => (y >= TOP ? 1 : Math.max(0, 1 - (TOP - y) / FADE_H));

function upperLayers(): { fx: number; band: number; speed: number; list: CloudSpec[] }[] {
  const rng = new Rng('nubes-altas');
  const cumuli: CloudSpec[] = [];
  const cirri: CloudSpec[] = [];
  for (let y = TOP - 10; y > TOP - FADE_H; y -= 46) {
    const f = fadeAt(y);
    // Cúmulos: menos y más pequeños cuanto más arriba.
    const n = Math.round(f * f * 4 + rng.next() * 0.8);
    for (let k = 0; k < n; k++) {
      const w = Math.round((50 + rng.next() * 90) * (0.55 + 0.45 * f));
      cumuli.push({
        kind: 'cumulus',
        w,
        h: Math.round(w * (0.3 + rng.next() * 0.08)),
        x: rng.int(0, 1300),
        y: y + rng.int(-14, 14),
        tower: 0.35 + rng.next() * 0.4,
      });
    }
    // Cirros: los que más aguantan arriba.
    const m = Math.round(f * 2 + rng.next() * 0.9);
    for (let k = 0; k < m; k++)
      cirri.push({
        kind: 'cirrus',
        w: 120 + rng.int(0, 160),
        h: 16 + rng.int(0, 10),
        x: rng.int(0, 1500),
        y: y + rng.int(-20, 20),
      });
  }
  return [
    { fx: 0.15, band: 1500, speed: 0.45, list: cirri },
    { fx: 0.178, band: 1300, speed: 1.6, list: cumuli },
  ];
}

const CLOUD_LAYERS: { fx: number; band: number; speed: number; list: CloudSpec[] }[] = [
  {
    fx: 0.152,
    band: 1500,
    speed: 0.5,
    list: [
      { kind: 'cirrus', w: 220, h: 22, x: 40, y: 70 },
      { kind: 'cirrus', w: 160, h: 18, x: 520, y: 46 },
      { kind: 'cirrus', w: 260, h: 26, x: 900, y: 92 },
      { kind: 'cirrus', w: 140, h: 16, x: 1290, y: 58 },
    ],
  },
  {
    fx: 0.162,
    band: 1100,
    speed: 0.9,
    list: [
      { kind: 'bank', w: 96, h: 20, x: 20, y: 196 },
      { kind: 'bank', w: 64, h: 16, x: 230, y: 186 },
      { kind: 'bank', w: 120, h: 22, x: 420, y: 200 },
      { kind: 'bank', w: 70, h: 16, x: 690, y: 190 },
      { kind: 'bank', w: 104, h: 20, x: 880, y: 198 },
    ],
  },
  {
    fx: CLOUD_FX,
    band: 1300,
    speed: 1.8,
    list: [
      { kind: 'cumulus', w: 170, h: 62, x: 0, y: 150, tower: 0.85 },
      { kind: 'cumulus', w: 96, h: 38, x: 260, y: 110, tower: 0.5 },
      { kind: 'cumulus', w: 140, h: 46, x: 470, y: 160, tower: 0.4 },
      { kind: 'cumulus', w: 70, h: 28, x: 700, y: 96, tower: 0.55 },
      { kind: 'cumulus', w: 190, h: 56, x: 860, y: 140, tower: 0.6 },
      { kind: 'cumulus', w: 84, h: 30, x: 1140, y: 120, tower: 0.45 },
    ],
  },
];
/** Velo de bruma tras cada capa del paisaje: con el cielo cubierto y con niebla. */
const VEIL = [0.12, 0.08, 0.07, 0.05, 0.04];
const FOG_VEIL = [0.32, 0.18, 0.18, 0.14, 0.1];
/**
 * Bancos de niebla tras algunas capas: su alto (borde de arriba, con el horizonte en GROUND),
 * cuánto se ven, cuál de los tres y su deriva (píxeles por segundo).
 */
const FOG_BANKS: Partial<Record<number, { y: number; k: number; which: number; drift: number }>> = {
  0: { y: GROUND - 34, k: 1, which: 0, drift: 1.2 },
  2: { y: GROUND + 6, k: 0.85, which: 1, drift: 2 },
  4: { y: GROUND + 34, k: 0.6, which: 2, drift: 3 },
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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
  private cloudLayers = [...upperLayers(), ...CLOUD_LAYERS].map((l, li) => ({
    ...l,
    list: l.list.map((c, i) => {
      const seed = `nube-${li}-${i}`;
      const shape =
        c.kind === 'cumulus'
          ? cumulus(seed, c.w, c.h, c.tower)
          : c.kind === 'bank'
            ? bank(seed, c.w, c.h)
            : null;
      const img = {} as Record<SkyPhase, HTMLCanvasElement>;
      for (const ph of PHASES)
        img[ph] = bufferCanvas(shape ? paintCloud(shape, ph) : cirrus(seed, c.w, c.h, ph));
      // Cada una a su paso: unas algo más deprisa que otras.
      return { ...c, img, fade: fadeAt(c.y), speed: l.speed * (0.8 + ((i * 7) % 5) * 0.1) };
    }),
  }));
  private strips = {
    day: bufferCanvas(wide(skyStrip(SKY_BANDS.day, STRIP_H, 30, GROUND - 20))),
    dusk: bufferCanvas(wide(skyStrip(SKY_BANDS.dusk, STRIP_H, 10, GROUND - 25))),
    dawn: bufferCanvas(wide(skyStrip(SKY_BANDS.dawn, STRIP_H, 10, GROUND - 25))),
  };
  /** Con «luz con ambiente», el fondo nuevo (ver `paisaje.ts`). */
  mood = false;
  /** El tiempo (ver `weather.ts`): nubes (0–1) y niebla (0–1). */
  weather = { cloud: 0, fog: 0, rain: 0 };
  /** El manto del nublado, por orden de turno (las primeras en salir, primero). */
  private deck = deckLayout().sort((a, b) => a.rank - b.rank);
  private deckBuilt = 0;
  private greyCache?: Record<SkyPhase, HTMLCanvasElement>;
  private fogCache?: Record<SkyPhase, HTMLCanvasElement[]>;

  /**
   * Pinta unas pocas nubes más del manto (hasta `ms` milisegundos), si las nubes ya piden
   * alguna que falta. Devuelve si pintó alguna (para volver a dibujar el cielo).
   */
  buildDeck(ms = 4): boolean {
    const want = this.deck.findIndex((c) => deckAlpha(this.weather.cloud + 0.06, c.rank) <= 0);
    const need = want < 0 ? this.deck.length : want;
    if (this.deckBuilt >= need) return false;
    const t0 = performance.now();
    while (this.deckBuilt < need && performance.now() - t0 < ms)
      paintDeckCloud(this.deck[this.deckBuilt++]!);
    return true;
  }

  private get grey() {
    this.greyCache ??= Object.fromEntries(
      PHASES.map((ph) => [
        ph,
        bufferCanvas(skyStripCnc(GREY_BANDS[ph], STRIP_W, STRIP_H, 10, GROUND - 10)),
      ]),
    ) as Record<SkyPhase, HTMLCanvasElement>;
    return this.greyCache;
  }

  private get fogBanks() {
    this.fogCache ??= Object.fromEntries(
      PHASES.map((ph) => [ph, [0, 1, 2].map((i) => fogBank(`niebla-${i}`, FOG_COLOR[ph]))]),
    ) as Record<SkyPhase, HTMLCanvasElement[]>;
    return this.fogCache;
  }
  private cncCache?: {
    strips: { day: HTMLCanvasElement; dusk: HTMLCanvasElement; dawn: HTMLCanvasElement };
    right: HTMLCanvasElement;
    left: HTMLCanvasElement;
    night: HTMLCanvasElement;
    dusk: HTMLCanvasElement;
    dawn: HTMLCanvasElement;
    woods: { day: HTMLCanvasElement; night: HTMLCanvasElement };
    lake: { y0: number; day: HTMLCanvasElement[]; night: HTMLCanvasElement[] };
    day: HTMLCanvasElement[];
    /** Las capas que cambian también de noche (las arboledas); las demás, las de siempre. */
    nights: (HTMLCanvasElement | null)[];
  };
  /** Se pinta la primera vez que hace falta. */
  private get cnc() {
    if (!this.cncCache) {
      const m = mountainsCnc();
      this.cncCache = {
        strips: {
          day: bufferCanvas(skyStripCnc(SKY_BANDS.day, STRIP_W, STRIP_H, 30, GROUND - 20)),
          dusk: bufferCanvas(skyStripCnc(SKY_BANDS.dusk, STRIP_W, STRIP_H, 10, GROUND - 25)),
          dawn: bufferCanvas(skyStripCnc(SKY_BANDS.dawn, STRIP_W, STRIP_H, 10, GROUND - 25)),
        },
        right: bufferCanvas(m.right),
        left: bufferCanvas(m.left),
        night: bufferCanvas(m.night),
        dusk: bufferCanvas(m.dusk),
        dawn: bufferCanvas(m.dawn),
        ...(() => {
          const f = farForestCnc({ day: m.right, night: m.night });
          return {
            woods: { day: bufferCanvas(f.day), night: bufferCanvas(f.night) },
            lake: {
              y0: f.lake.y0,
              day: f.lake.day.map(bufferCanvas),
              night: f.lake.night.map(bufferCanvas),
            },
          };
        })(),
        ...this.moodLayers(),
      };
    }
    return this.cncCache;
  }

  /**
   * Las capas de delante con luz con ambiente: las colinas sin tramado y las arboledas con los
   * árboles nuevos; todas apagadas por la bruma cuanto más lejos.
   */
  private moodLayers() {
    const HAZE = [0, 0.3, 0.2, 0.1, 0.04];
    const groves: Record<number, { day: PixelBuffer; night: PixelBuffer }> = {
      3: groveCnc(treelineTrees(), GROUND + 2, 0.12),
      4: groveCnc(groveTrees(), GROUND + 4, 0.03),
    };
    return {
      day: this.parallax.map(({ l }, i) =>
        bufferCanvas(groves[i]?.day ?? hazed(i === 1 ? untrammed(l.day) : l.day, HAZE[i] ?? 0)),
      ),
      nights: this.parallax.map((_, i) => (groves[i] ? bufferCanvas(groves[i].night) : null)),
    };
  }

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
    // Lo cubierto del cielo: con el manto entero no se ven el sol, la luna ni las estrellas.
    const { cloud, fog } = this.weather;
    const ov = smoothstep(0.55, 0.95, cloud);
    ctx.globalAlpha = Math.max(0, 1 - dl.day * 1.4) * (1 - ov);
    // Las estrellas se repiten a lo ancho y, por encima de su franja, también hacia arriba.
    const w = this.skyC.width;
    const k0 = Math.floor(-skyX / w);
    for (let ky = 0; dl.day <= 0.7 && ov < 0.99 && top - ky * STAR_H > -STAR_H; ky++)
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
    const moonA = Math.max(0, 1 - dl.day * 1.25) * (1 - ov);
    if (moonA > 0) {
      ctx.globalAlpha = moonA;
      ctx.drawImage(
        this.moonC,
        Math.round(MOON.x - MOON_R - pan(cx, vw, SKY_FX)),
        Math.round(hz - MOON.up - MOON_R),
      );
      ctx.globalAlpha = 1;
    }
    // Encima de la noche, el cielo de cada luz (opaco): día, atardecer y alba.
    const strips = this.mood ? this.cnc.strips : this.strips;
    this.strip(ctx, strips.day, dl.day, top, vw, vh);
    this.strip(ctx, strips.dusk, dl.dusk, top, vw, vh);
    this.strip(ctx, strips.dawn, nl.warm, top, vw, vh);
    // Encima, el cielo gris del nublado con la luz de cada hora.
    if (ov > 0.01) {
      const g = this.grey;
      const lit0 = Math.min(1, dl.day + dl.dusk + nl.warm);
      this.strip(ctx, g.night, ov * (1 - lit0), top, vw, vh);
      this.strip(ctx, g.day, ov * dl.day, top, vw, vh);
      this.strip(ctx, g.dusk, ov * dl.dusk, top, vw, vh);
      this.strip(ctx, g.dawn, ov * nl.warm, top, vw, vh);
    }
    if (ov < 0.99) this.drawSun(ctx, dl, cx, hz, vw, 1 - ov);
    // Las nubes, de la capa de más lejos a la de más cerca: la de noche debajo (opaca, tapa las
    // estrellas) y encima, la de cada luz con su peso.
    const wt: Record<SkyPhase, number> = {
      night: 1,
      day: Math.min(1, dl.day),
      dusk: dl.dusk,
      dawn: nl.warm,
    };
    for (const l of this.cloudLayers) {
      const x0 = WORLD_X0 - pan(cx, vw, l.fx);
      for (const cl of l.list) {
        const x = ((cl.x + t * cl.speed) % l.band) - cl.w + x0;
        const y = Math.round(cl.y - cl.h + top);
        if (y > vh || y + cl.h < 0) continue;
        for (let k = Math.floor(-(x + cl.w) / l.band); x + k * l.band < vw; k++) {
          const at = Math.round(x + k * l.band);
          if (at + cl.w < 0) continue;
          // Las de arriba, transparentes: la de noche ya no va opaca debajo (si no, oscurece).
          const lit = Math.min(1, wt.day + wt.dusk + wt.dawn);
          for (const ph of PHASES) {
            const a =
              (cl.fade >= 1 ? wt[ph] : cl.fade * (ph === 'night' ? Math.max(0, 1 - lit) : wt[ph])) *
              (1 - ov);
            if (a <= 0.01) continue;
            ctx.globalAlpha = a;
            ctx.drawImage(cl.img[ph], at, y);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    // El manto del nublado: cada nube, si ya le toca y está pintada.
    if (cloud > 0.25) {
      const lit = Math.min(1, wt.day + wt.dusk + wt.dawn);
      for (let i = 0; i < this.deckBuilt; i++) {
        const cl = this.deck[i]!;
        const a = deckAlpha(cloud, cl.rank);
        if (a <= 0) break;
        const x0 = WORLD_X0 - pan(cx, vw, cl.fx);
        const x = ((cl.x + t * cl.speed) % DECK_BAND) - cl.w + x0;
        const y = Math.round(cl.y - cl.h + top);
        if (y > vh || y + cl.h < 0) continue;
        for (let k = Math.floor(-(x + cl.w) / DECK_BAND); x + k * DECK_BAND < vw; k++) {
          const at = Math.round(x + k * DECK_BAND);
          if (at + cl.w < 0) continue;
          for (const ph of PHASES) {
            const pa = a * (ph === 'night' ? Math.max(0, 1 - lit) : wt[ph]);
            if (pa <= 0.01) continue;
            ctx.globalAlpha = Math.min(1, pa);
            ctx.drawImage(cl.img![ph], at, y);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    // La bruma y la niebla, del color de la hora: tras cada capa del paisaje, un velo encima de
    // todo lo de detrás (así lo lejano se pierde más). Y bancos de niebla entre capas.
    const litH = Math.min(1, wt.day + wt.dusk + wt.dawn);
    const sumH = wt.day + wt.dusk + wt.dawn || 1;
    const haze = [0, 1, 2].map(
      (c) =>
        HAZE.night[c]! * (1 - litH) +
        ((HAZE.day[c]! * wt.day + HAZE.dusk[c]! * wt.dusk + HAZE.dawn[c]! * wt.dawn) * litH) / sumH,
    );
    const veil = (i: number, fx: number) => {
      const a = ov * VEIL[i]! + fog * FOG_VEIL[i]!;
      if (a > 0.005) {
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = `rgb(${haze.map(Math.round).join(',')})`;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalAlpha = 1;
      }
      const fb = FOG_BANKS[i];
      if (!fb || fog <= 0.01) return;
      const banks = this.fogBanks;
      const bx = WORLD_X0 - pan(cx, vw, fx) + t * fb.drift;
      const by = top + fb.y;
      for (const ph of PHASES) {
        const pa = fog * fb.k * (ph === 'night' ? 1 - litH : wt[ph]);
        if (pa <= 0.01) continue;
        ctx.globalAlpha = Math.min(1, pa);
        const c = banks[ph][fb.which]!;
        repeat(ctx, c, bx, by, vw);
        // Lo de debajo del banco, tan espeso como su parte de abajo.
        if (by + c.height < vh) ctx.drawImage(c, 0, c.height - 1, 1, 1, 0, by + c.height, vw, vh);
      }
      ctx.globalAlpha = 1;
    };
    // Cuánto se ve el paisaje de día (con sus colores) sobre las siluetas de la noche.
    const dayK = Math.min(1, dl.day + dl.dusk * 0.6 + nl.warm * 0.5);
    const light = { day: dayK, dark: Math.max(nl.dark, 1 - dl.day - dl.dusk) };
    skyLife(ctx, WORLD_X0 - pan(cx, vw, SKY_FX), top, vw, t, light);
    this.parallax.forEach(({ c, d, l }, i) => {
      const x = WORLD_X0 - pan(cx, vw, l.fx);
      if (this.mood && i === 0) {
        // Los montes nuevos: la cara al sol pasa de la derecha (mañana) a la izquierda (tarde).
        const m = this.cnc;
        repeat(ctx, m.night, x, top, vw);
        if (dayK > 0) {
          const p = Math.min(1, 0.1 + dl.tod * 0.95);
          const wl = Math.min(1, Math.max(0, (p - 0.35) / 0.3));
          ctx.globalAlpha = dayK;
          repeat(ctx, m.right, x, top, vw);
          if (wl > 0) {
            ctx.globalAlpha = dayK * wl;
            repeat(ctx, m.left, x, top, vw);
          }
          // Y la luz rosada del ocaso y del alba en las cumbres.
          for (const [c, a] of [
            [m.dusk, dl.dusk],
            [m.dawn, nl.warm],
          ] as const)
            if (a > 0.01) {
              ctx.globalAlpha = Math.min(1, a);
              repeat(ctx, c, x, top, vw);
            }
          ctx.globalAlpha = 1;
        }
        // Delante, el bosque lejano con su bruma.
        const fx = WORLD_X0 - pan(cx, vw, FAR_FOREST_FX);
        // El agua del lago, de fotograma en fotograma (fundidos: no salta).
        const lk = (t / 0.75) % LAKE_FRAMES;
        const f0 = Math.floor(lk);
        const f1 = (f0 + 1) % LAKE_FRAMES;
        const water = (set: HTMLCanvasElement[], a: number) => {
          ctx.globalAlpha = a;
          repeat(ctx, set[f0]!, fx, top + m.lake.y0, vw);
          ctx.globalAlpha = a * (lk - f0);
          repeat(ctx, set[f1]!, fx, top + m.lake.y0, vw);
          ctx.globalAlpha = 1;
        };
        repeat(ctx, m.woods.night, fx, top, vw);
        water(m.lake.night, 1);
        if (dayK > 0) {
          ctx.globalAlpha = dayK;
          repeat(ctx, m.woods.day, fx, top, vw);
          water(m.lake.day, dayK);
          ctx.globalAlpha = 1;
        }
        veil(i, l.fx);
        return;
      }
      const night = this.mood ? this.cnc.nights[i] : null;
      if (night) repeat(ctx, night, x, top, vw);
      else tile(ctx, c, x, top, vw);
      if (dayK > 0) {
        ctx.globalAlpha = dayK;
        if (night) repeat(ctx, this.cnc.day[i]!, x, top, vw);
        else tile(ctx, this.mood ? this.cnc.day[i]! : d, x, top, vw);
        ctx.globalAlpha = 1;
      }
      if (i === 1) hillLife(ctx, x, top, vw, t, light);
      if (i === 3) treeLife(ctx, x, top, vw, t, light);
      veil(i, l.fx);
    });
    // Con lluvia, todo más oscuro (el manto cargado).
    if (this.weather.rain > 0.01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = Math.min(1, this.weather.rain * 0.75);
      ctx.fillStyle = '#7d879e';
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Con el cielo cubierto o niebla, todo con menos color (la luz es plana).
    const gray = ov * 0.4 + fog * 0.35;
    if (gray > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = Math.min(1, gray);
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Al atardecer, el paisaje se tiñe de cálido.
    if (dl.dusk > 0) {
      ctx.globalCompositeOperation = 'multiply';
      // Con el sol tapado (nublado, niebla), menos dorado.
      const d = dl.dusk * (1 - 0.65 * Math.max(ov, fog));
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

  /**
   * Una tira de cielo (`STRIP_W` de ancho, con el horizonte en GROUND) a lo ancho de la vista,
   * con `a` de peso; por encima de la tira, su primer color.
   */
  private strip(
    ctx: CanvasRenderingContext2D,
    c: HTMLCanvasElement,
    a: number,
    top: number,
    vw: number,
    vh: number,
  ): void {
    if (a <= 0.01) return;
    ctx.globalAlpha = Math.min(1, a);
    if (top > 0) ctx.drawImage(c, 0, 0, STRIP_W, 1, 0, 0, vw, top);
    for (let x = 0; x < vw; x += STRIP_W) ctx.drawImage(c, x, top);
    const below = top + c.height;
    if (below < vh) ctx.drawImage(c, 0, c.height - 1, STRIP_W, 1, 0, below, vw, vh - below);
    ctx.globalAlpha = 1;
  }

  /** El sol, que cruza: blanco y amarillo a mediodía; grande, naranja y rayado al ponerse. */
  private drawSun(
    ctx: CanvasRenderingContext2D,
    d: Daylight,
    cx: number,
    hz: number,
    vw: number,
    k = 1,
  ) {
    const sunUp = Math.max(d.day, d.dusk);
    if (sunUp <= 0) return;
    // Sale ya alto por la mañana, cruza y al atardecer baja hasta perderse tras los montes.
    const p = Math.min(1, 0.1 + d.tod * 0.95);
    const sx = Math.round(300 - 280 * p - pan(cx, vw, SKY_FX));
    const sy = Math.round(hz - 10 - (Math.sin(Math.PI * p) * 1.15 - 0.15) * SUN_UP);
    if (sy > hz + 20) return;
    // El de siempre: un halo suave y el disco, limón de día y naranja al atardecer.
    const warmSun = d.dusk > 0.3;
    ctx.globalAlpha = Math.min(1, sunUp * 1.3) * k;
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
}

/** Ensancha una tira de cielo de 4 a `STRIP_W` (se repite el tramado). */
function wide(b: PixelBuffer): PixelBuffer {
  const o = new PixelBuffer(STRIP_W, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < STRIP_W; x++) o.data[y * STRIP_W + x] = b.get(x & 3, y);
  return o;
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

/** Como `tile`, pero sin espejo (para las capas que ya se repiten sin junta). */
function repeat(
  ctx: CanvasRenderingContext2D,
  c: HTMLCanvasElement,
  x: number,
  y: number,
  vw: number,
) {
  const w = c.width;
  for (let k = Math.floor(-x / w); x + k * w < vw; k++) ctx.drawImage(c, x + k * w, y);
}
