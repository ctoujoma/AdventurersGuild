import { useEffect, useState } from 'preact/hooks';
import splashUrl from '../assets/splash.webp';

/**
 * Pantalla del desarrollador antes del título. La animación es `assets-src/splash-logo.gif`
 * convertida a WebP animado (mucho más ligero); HOLD es lo que dura una vuelta.
 */
const HOLD = 3000;
/** Salida: fundido rápido mientras la imagen se estira hacia la pantalla. */
const OUT = 420;

interface Props {
  onDone: () => void;
}

export function Splash({ onDone }: Props) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (phase === 'in') {
      const t = setTimeout(() => setPhase('out'), HOLD);
      return () => clearTimeout(t);
    }
    const t = setTimeout(onDone, OUT);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      class={`splash splash-${phase}`}
      role="img"
      aria-label="Presenta el desarrollador"
      onClick={() => setPhase('out')}
    >
      <img src={splashUrl} alt="" draggable={false} />
    </div>
  );
}
