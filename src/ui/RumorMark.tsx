import { useEffect, useRef } from 'preact/hooks';
import type { Rumor } from '../core/model';
import { Icon } from './icons';
import type { GameScene } from './SceneView';

interface Props {
  rumor: Rumor;
  /** Sala donde se oye (el salón). */
  room: string;
  clock: number;
  speed: number;
  scene: { current: GameScene | null };
  onTake: () => void;
}

/**
 * Un rumor en la barra: un bocadillo que brilla sobre una mesa del salón unos segundos. Tocarlo
 * a tiempo abre un encargo especial. Se mueve con la cámara, como los avisos de incidente.
 */
export function RumorMark({ rumor, room, clock, speed, scene, onTake }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const s = scene.current;
      const at = s?.roomTop(room);
      if (el && s && at) {
        // Más abajo que el aviso de incidente: a la altura de las mesas.
        const p = s.screenOf(at.x - 30, at.y + 46);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [rumor.id, room]);
  const left = Math.max(0, rumor.until - clock);
  const frac = Math.max(0, Math.min(1, left / Math.max(1, rumor.until - rumor.from)));
  const secs = Math.ceil(left / Math.max(1, speed));
  return (
    <button
      ref={ref}
      class="rumor"
      style={{ '--left': frac }}
      aria-label={`Un rumor en la barra. Tócalo para apuntarlo. Quedan ${secs} s.`}
      onClick={onTake}
    >
      <Icon name="star" size={14} />
      <span>¿Qué se oye?</span>
      <i class="rumor-bar" aria-hidden="true" style={{ width: `${Math.round(frac * 100)}%` }} />
    </button>
  );
}
