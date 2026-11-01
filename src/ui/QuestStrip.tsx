import { useEffect, useRef } from 'preact/hooks';
import type { JourneyNow } from '../core/journey';
import { STRIP_H, TripStrip, homeFrom } from '../world/tripStrip';

/** Ancho de la tira en píxeles del dibujo, más o menos: la escala sale de cuánto cabe. */
const AIM_W = 200;

/**
 * La tira animada del encargo en curso, arriba de la ficha (ver `world/tripStrip.ts`): un canvas
 * a escala entera que ocupa todo el ancho. Recibe `now` y nada más.
 */
export function QuestStrip({ now }: { now: JourneyNow }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    const el = box.current;
    const c = canvas.current;
    if (!el || !c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const strip = new TripStrip(AIM_W);
    let scale = 1;
    const fit = () => {
      const width = el.clientWidth || AIM_W * 2;
      scale = Math.max(1, Math.round(width / AIM_W));
      const w = Math.ceil(width / scale);
      c.width = w;
      c.height = STRIP_H;
      c.style.width = `${w * scale}px`;
      c.style.height = `${STRIP_H * scale}px`;
      strip.resize(w);
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    // A unos diez fotogramas por segundo: es pixel art y así gasta poco.
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      const tick = Math.floor((ms - start) / 100);
      if (tick === last) return;
      last = tick;
      strip.draw(ctx, nowRef.current, (ms - start) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  const what = now.waiting
    ? 'El grupo, parado ante el jefe'
    : now.fighting
      ? 'El grupo, peleando'
      : now.t >= homeFrom(now).back
        ? homeFrom(now).fast
          ? 'El grupo, en retirada'
          : 'El grupo, de vuelta a casa'
        : now.leg === 'ida'
          ? 'El grupo, de camino'
          : 'El grupo, en el sitio';
  return (
    <div ref={box} class={`trip-strip ${now.night ? 'is-night' : ''}`} data-strip>
      <canvas ref={canvas} class="trip-strip-canvas pixel" role="img" aria-label={what} />
    </div>
  );
}
