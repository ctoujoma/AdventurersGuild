import { useEffect, useState } from 'preact/hooks';
import { haptic } from '../platform/haptics';

/** Cuánto hay que mantener pulsado para que salga la explicación. */
const HOLD_MS = 450;

/**
 * Ayuda sin botones: manteniendo pulsado cualquier cosa con `data-help` sale una línea que
 * explica qué es. Al soltar no se activa lo que se tenía debajo. Con ratón basta el
 * `title` de siempre, que se pone junto (ver `help()`).
 */
export function HoldHelp() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(
    null,
  );

  useEffect(() => {
    let timer = 0;
    let start: { x: number; y: number } | null = null;
    let swallow = false;
    const down = (e: PointerEvent) => {
      setTip(null);
      const el = (e.target as Element | null)?.closest?.('[data-help]');
      if (!el) return;
      start = { x: e.clientX, y: e.clientY };
      timer = window.setTimeout(() => {
        swallow = true;
        const r = el.getBoundingClientRect();
        const below = r.top < 90;
        setTip({
          text: el.getAttribute('data-help') ?? '',
          x: r.left + r.width / 2,
          y: below ? r.bottom : r.top,
          below,
        });
        haptic('select');
      }, HOLD_MS);
    };
    const move = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
        clearTimeout(timer);
        start = null;
      }
    };
    const up = () => {
      clearTimeout(timer);
      start = null;
    };
    // Lo que se mantuvo pulsado para leer no se activa al soltar.
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const menu = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('[data-help]')) e.preventDefault();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('click', click, true);
    document.addEventListener('contextmenu', menu, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('contextmenu', menu, true);
    };
  }, []);

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 5000);
    return () => clearTimeout(t);
  }, [tip]);

  if (!tip) return null;
  const half = Math.min(280, window.innerWidth - 24) / 2;
  const x = Math.max(12 + half, Math.min(window.innerWidth - 12 - half, tip.x));
  return (
    <p
      class={`hold-help ${tip.below ? 'below' : ''}`}
      role="status"
      style={{ left: `${x}px`, top: `${tip.y}px` }}
    >
      {tip.text}
    </p>
  );
}

/** Atributos de ayuda para un elemento: pulsación larga en el móvil y `title` con ratón. */
export const help = (text: string) => ({ 'data-help': text, title: text });
