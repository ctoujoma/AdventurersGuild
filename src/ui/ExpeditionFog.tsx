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

/**
 * La niebla del mapa de rumbos, en su propio lienzo encima del dibujo. Solo se redibuja ella, a
 * pocos fotogramas: el campo de lejanía se calcula al cambiar lo visto y el ruido es un mosaico
 * que se desplaza (`art/expFog.ts`). Con «menos movimiento», un fotograma quieto.
 */
export function ExpeditionFog({ clears, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const far = useMemo(() => fogField(clears), [clears]);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const img = ctx.createImageData(WORLD_W, WORLD_H);
    const px = new Uint32Array(img.data.buffer);
    const dens = new Float32Array(WORLD_W * WORLD_H);
    const draw = (t: number) => {
      paintFog(px, dens, far, t, style, t === 0);
      ctx.putImageData(img, 0, 0);
    };
    const still =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    draw(0);
    if (still) return;
    let last = t0;
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      last = now;
      draw((now - t0) / 1000);
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
