import { useEffect, useState } from 'preact/hooks';

/**
 * El fotograma de un brillo que se repite cada pocos segundos, un poco al azar (0: quieto). Para
 * los iconos y retratos con algo épico o legendario. Sin movimiento si el sistema lo pide.
 */
export function useShine(on: boolean, frames: number, every = 4500, step = 100): number {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!on || frames < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let t: number;
    const wait = () => {
      t = window.setTimeout(() => play(1), every * (0.6 + Math.random() * 0.8));
    };
    const play = (k: number) => {
      if (k >= frames) {
        setF(0);
        wait();
        return;
      }
      setF(k);
      t = window.setTimeout(() => play(k + 1), step);
    };
    wait();
    return () => clearTimeout(t);
  }, [on, frames, every, step]);
  return f;
}
