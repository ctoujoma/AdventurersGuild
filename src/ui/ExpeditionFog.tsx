import { useEffect, useMemo, useRef } from 'preact/hooks';
import { fogField, fogKey, paintFog, type Clear, type FogRect } from '../art/expFog';
import { WORLD_H, WORLD_W } from '../art/expGeo';
import type { MapStyle } from '../art/map';

interface Props {
  clears: readonly Clear[];
  style: MapStyle;
  /** Lo que se ve del mapa, en sus píxeles (solo se repinta eso). */
  rect: FogRect;
}

/**
 * Tope de fotogramas por segundo. Solo se repinta cuando la niebla se ha movido un píxel (o al
 * moverse la vista o al retirarse), así que a menudo son menos.
 */
const FPS = 20;
/** Lo que tarda en retirarse al despejar (ms). */
const OPEN_MS = 1600;

/**
 * La niebla del mapa de rumbos, en su propio lienzo encima del dibujo. Solo se redibuja ella, a
 * pocos fotogramas: el campo de lejanía se calcula al cambiar lo visto y el ruido son mosaicos que
 * se desplazan (`art/expFog.ts`). Cuando se descubre terreno, la niebla de antes se retira poco a
 * poco. Con «menos movimiento», un fotograma quieto y sin retirada.
 */
export function ExpeditionFog({ clears, style, rect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef(rect);
  const moved = useRef(false);
  const k = `${rect.x0},${rect.y0},${rect.x1},${rect.y1}`;
  useEffect(() => {
    view.current = rect;
    moved.current = true;
  }, [k]);
  const far = useMemo(() => fogField(clears), [clears]);
  /** La lejanía que se veía antes del último cambio (de la que se retira la niebla). */
  const shown = useRef<Float32Array | null>(null);
  const t0 = useRef(0);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const img = ctx.createImageData(WORLD_W, WORLD_H);
    const px = new Uint32Array(img.data.buffer);
    const dens = new Float32Array(WORLD_W * WORLD_H);
    const still =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = !still && shown.current && shown.current !== far ? shown.current : undefined;
    shown.current = far;
    t0.current ||= performance.now();
    const opened = performance.now();
    let key = '';
    /** `all`: todo el mapa (el primer fotograma); si no, solo lo que se ve. */
    const draw = (now: number, full: boolean, all = false) => {
      const p = from ? Math.min(1, (now - opened) / OPEN_MS) : 1;
      const opening = !!from && p < 1;
      const t = (now - t0.current) / 1000;
      const R = all ? undefined : view.current;
      key = fogKey(t, style);
      paintFog(px, dens, far, t, style, {
        full: full || opening,
        ...(opening ? { from, p } : {}),
        ...(R ? { rect: R } : {}),
      });
      if (R) ctx.putImageData(img, 0, 0, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
      else ctx.putImageData(img, 0, 0);
      return opening;
    };
    let opening = draw(performance.now(), true, true);
    if (still) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      // Sin moverse la niebla ni la vista, no hay nada que repintar.
      if (!opening && !moved.current && fogKey((now - t0.current) / 1000, style) === key) return;
      last = now;
      moved.current = false;
      // Al acabar la retirada, un fotograma entero (lo hondo del pergamino queda pintado).
      const was = opening;
      opening = draw(now, was);
    });
    return () => cancelAnimationFrame(raf);
  }, [far, style]);
  return (
    <canvas
      ref={ref}
      class="pixel map-layer exp-map-fog"
      width={WORLD_W}
      height={WORLD_H}
      aria-hidden="true"
    />
  );
}
