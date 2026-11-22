/**
 * El visor básico de una expedición (bloque 1; el bueno lo hace el agente de arte, ver
 * `docs/encargos/arte-expediciones.md`): el paisaje del rumbo pasa por detrás mientras andan, y se
 * oscurece poco a poco con la lejanía (`wild`, de 0 a 1). Reutiliza los dibujos de la tira de los
 * encargos (`tripStrip.ts`): andar (los heridos cojean), pelear, acampar de noche y volver con el
 * botín. Solo pinta: recibe `MarchNow` y el reloj de la animación.
 */
import { bufferCanvas } from '../art/canvas';
import { P } from '../art/palette';
import type { PixelBuffer } from '../art/pixel';
import { LAND_H, tripLand } from '../art/trip';
import type { FoeKind, JourneyNow } from '../core/journey';
import type { BossFight, ExpKind } from '../core/model';
import type { Terrain } from '../data/places';
import { GLYPH, STRIP_H, TripStrip, bubble, heroOf, px } from './tripStrip';

/** Lo que hacen ahora. */
export type MarchMode = 'walk' | 'fight' | 'camp';

export interface MarchNow {
  seed: string;
  terrain: Terrain;
  crew: BossFight['heroes'];
  mode: MarchMode;
  night: boolean;
  /** De vuelta a casa (andan hacia la izquierda). */
  home: boolean;
  /** Contra qué pelean, si pelean. */
  foe: FoeKind;
  /** Lo salvaje del sitio (0 cerca de casa, 1 muy lejos). */
  wild: number;
  /** El último suceso, si es reciente (sale en un bocadillo). */
  last?: ExpKind;
}

/** Margen que se recorta a la izquierda del paisaje (allí la tira dibuja la taberna). */
const CUT = 40;
const GAP = 11;

const KIND_GLYPH: Partial<Record<ExpKind, keyof typeof GLYPH>> = {
  camino: 'camino',
  hallazgo: 'faena',
  raciones: 'faena',
  pelea: 'pelea',
  herida: 'pelea',
  cura: 'vuelta',
  aviso: 'aviso',
  vuelta: 'vuelta',
};

export class ExpeditionStrip extends TripStrip {
  private landBuf: PixelBuffer | null = null;
  private marchKey = '';
  private scroll = 0;
  private lastTime = 0;

  drawMarch(ctx: CanvasRenderingContext2D, m: MarchNow, time: number): void {
    const { w } = this;
    // La tira de los encargos lee esto de su viaje: lo justo para el cielo, las peleas y la noche.
    const now = {
      journey: { seed: m.seed, foe: m.foe, terrain: m.terrain, events: [] },
      night: m.night,
    } as unknown as JourneyNow;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, STRIP_H);
    this.sky(ctx, now, time);
    // El paisaje pasa por detrás mientras andan (una vez y media de ancho, en bucle).
    const W = Math.round(w * 1.5) + CUT;
    const key = `${m.terrain}:${W}:${m.seed}`;
    if (key !== this.marchKey) {
      this.marchKey = key;
      this.landBuf = tripLand(m.terrain, W, [W + 20, W + 30], m.seed);
    }
    const dt = Math.min(0.5, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    if (m.mode === 'walk') this.scroll += dt * 8 * (m.home ? -1 : 1);
    const loop = W - CUT;
    const off = ((this.scroll % loop) + loop) % loop;
    const land = bufferCanvas(this.landBuf!);
    for (let x = -off; x < w; x += loop)
      ctx.drawImage(land, CUT, 0, loop, LAND_H, Math.round(x), 0, loop, LAND_H);
    // Lo salvaje: el verde se apaga y se cierra poco a poco.
    if (m.wild > 0) {
      ctx.globalAlpha = Math.min(0.45, m.wild * 0.45);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#3b5a3a';
      ctx.fillRect(0, 0, w, LAND_H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const crew = m.crew.map(heroOf);
    const dir = m.home ? 1 : -1;
    const lead = Math.round(m.home ? w * 0.4 : w * 0.6);
    const at = (i: number) => lead + dir * i * GAP;
    let fire: { x: number; y: number } | null = null;
    if (m.mode === 'fight') this.fight(ctx, now, crew, at, lead + 24, time);
    else if (m.mode === 'camp')
      fire = this.camp(ctx, crew, lead + dir * Math.round(((crew.length - 1) * GAP) / 2));
    else crew.forEach((h, i) => this.walk(ctx, h, at(i), time, i, m.home, false, m.home));
    if (m.night) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#5b649e';
      ctx.fillRect(0, 0, w, LAND_H);
      ctx.globalCompositeOperation = 'source-over';
      this.stars(ctx, now, time);
      if (fire) this.glow(ctx, fire.x, fire.y, time);
    }
    const g = m.last && KIND_GLYPH[m.last];
    if (g && m.mode !== 'camp') bubble(ctx, lead - 2 * dir, LAND_H - 34, GLYPH[g], P.navy);
    for (const f of this.later) f();
    this.later = [];
    // Abajo, una franja oscura (como la de los encargos, sin la línea del viaje).
    px(ctx, 0, LAND_H, P.black, w, STRIP_H - LAND_H);
  }
}
