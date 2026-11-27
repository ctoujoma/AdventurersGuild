import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Número que corre hasta su nuevo valor y destella en verde si sube o en rojo si baja,
 * como las monedas al caer en la caja. Si lo que sube viene volando (recoger, `collectFx` deja
 * en su marcador `data-land-at`), espera a que llegue el primero y cuenta mientras llegan.
 */
export function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const from = useRef(value);
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    from.current = value;
    const host = el.current?.closest<HTMLElement>('[data-land-at]');
    const land = value > start && host ? Number(host.dataset.landAt) : 0;
    const flying = land > performance.now();
    const t0 = flying ? land : performance.now();
    const dur = flying
      ? Math.max(400, Number(host!.dataset.landFor) || 0)
      : Math.min(700, 250 + Math.abs(value - start) * 4);
    let raf = 0;
    let lit = false;
    const step = (now: number) => {
      if (now < t0) {
        raf = requestAnimationFrame(step);
        return;
      }
      if (!lit) {
        lit = true;
        setFlash(value > start ? 'up' : 'down');
      }
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - k) * (1 - k);
      setShown(Math.round(start + (value - start) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else setTimeout(() => setFlash(null), 250);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <b ref={el} class={flash ? `count-${flash}` : undefined}>
      {shown}
    </b>
  );
}
