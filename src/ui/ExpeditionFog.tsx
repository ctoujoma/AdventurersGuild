import { useEffect, useMemo, useRef } from 'preact/hooks';
import { fogField, paintFog, type Clear } from '../art/expFog';
import { WORLD_H, WORLD_W } from '../art/expGeo';
import type { MapStyle } from '../art/map';

interface Props {
  clears: readonly Clear[];
  style: MapStyle;
}

/** Fotogramas por segundo de la niebla: se mueve despacio, no hace falta más. */
const FPS = 5;
/** Al despejar, unos pocos más, y lo que tarda en retirarse (ms). */
const FPS_OPEN = 12;
const OPEN_MS = 1600;

/**
 * La niebla del mapa de rumbos, en su propio lienzo encima del dibujo. Solo se redibuja ella, a
 * pocos fotogramas: el campo de lejanía se calcula al cambiar lo visto y el ruido son mosaicos que
 * se desplazan (`art/expFog.ts`). Cuando se descubre terreno, la niebla de antes se retira poco a
 * poco. Con «menos movimiento», un fotograma quieto y sin retirada.
 */
export function ExpeditionFog({ clears, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
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
    const draw = (now: number, full: boolean) => {
      const p = from ? Math.min(1, (now - opened) / OPEN_MS) : 1;
      const opening = !!from && p < 1;
      paintFog(px, dens, far, (now - t0.current) / 1000, style, {
        full: full || opening,
        ...(opening ? { from, p } : {}),
      });
      ctx.putImageData(img, 0, 0);
      return opening;
    };
    let opening = draw(performance.now(), true);
    if (still) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / (opening ? FPS_OPEN : FPS)) return;
      last = now;
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
