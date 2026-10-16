import { useEffect, useState } from 'preact/hooks';
import splashUrl from '../assets/splash.webp';

/**
 * Pantalla del desarrollador antes del título. La animación es `assets-src/splash-logo.gif`
 * convertida a WebP animado de una sola vuelta (se queda en el último fotograma).
 * El tiempo cuenta desde que la imagen ha cargado, y la salida empieza poco después del final.
 */
const ANIM = 3000;
/** Salida: fundido rápido mientras la imagen se estira hacia la pantalla. */
const OUT = 420;
/**
 * El WebP es de una sola vuelta y se queda quieto en el último fotograma. La salida empieza
 * un poco antes del final de la animación: así no se queda parado esperando el zoom.
 */
const HOLD = ANIM - 1400;
/** Si la imagen tarda demasiado en cargar, se pasa al título igualmente. */
const LOAD_TIMEOUT = 6000;

interface Props {
  onDone: () => void;
}

export function Splash({ onDone }: Props) {
  const [phase, setPhase] = useState<'load' | 'in' | 'out'>('load');

  useEffect(() => {
    const t =
      phase === 'load'
        ? setTimeout(() => setPhase('out'), LOAD_TIMEOUT)
        : phase === 'in'
          ? setTimeout(() => setPhase('out'), HOLD)
          : setTimeout(onDone, OUT);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      class={`splash splash-${phase}`}
      role="img"
      aria-label="Presenta el desarrollador"
      onClick={() => setPhase('out')}
    >
      <img
        src={splashUrl}
        alt=""
        draggable={false}
        onLoad={() => setPhase((p) => (p === 'load' ? 'in' : p))}
      />
    </div>
  );
}
