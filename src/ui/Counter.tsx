import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Número que corre hasta su nuevo valor y destella en verde si sube o en rojo si baja,
 * como las monedas al caer en la caja.
 */
export function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    from.current = value;
    setFlash(value > start ? 'up' : 'down');
    const t0 = performance.now();
    const dur = Math.min(700, 250 + Math.abs(value - start) * 4);
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - k) * (1 - k);
      setShown(Math.round(start + (value - start) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else setTimeout(() => setFlash(null), 250);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <b class={flash ? `count-${flash}` : undefined}>{shown}</b>;
}
