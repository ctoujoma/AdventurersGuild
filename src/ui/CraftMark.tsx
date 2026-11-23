import { useEffect, useRef } from 'preact/hooks';
import { itemIcon, potionIcon, scissorsIcon } from '../art/items';
import type { SceneCraft } from '../world/scene';
import { BufferImage } from './BufferImage';
import type { GameScene } from './SceneView';
import { t } from '../textos';

interface Props {
  craft: SceneCraft;
  scene: { current: GameScene | null };
  /** Hay un incidente en la misma sala: el bocadillo se aparta a un lado. */
  aside: boolean;
  /** El segundo trabajo de la misma sala (a nivel 3 van dos a la vez): al lado del primero. */
  slot?: number;
}

/**
 * Lo que se hace en un taller, colgado sobre su sala: el dibujo de lo que sale (o de lo que se
 * desmonta, o las tijeras si se viste a un héroe) y una barrita con lo que lleva; gris si está parado. No se toca (no tapa a nadie:
 * los toques pasan a la escena) y se mueve con la cámara, como el aviso de los incidentes.
 */
export function CraftMark({ craft, scene, aside, slot = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const s = scene.current;
      const at = s?.roomTop(craft.room);
      if (el && s && at) {
        const p = s.screenOf(at.x, at.y);
        el.style.left = `${p.x + slot * 46}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [craft.room, slot]);
  const pct = Math.round(Math.max(0, Math.min(1, craft.frac)) * 100);
  const what = craft.hero
    ? t('barra.craftmark.vistiendo')
    : craft.undo
      ? t('barra.craftmark.desmontando')
      : t('barra.craftmark.haciendo');
  return (
    <div
      ref={ref}
      class={`craft-mark ${craft.stalled ? 'is-stalled' : ''} ${aside ? 'is-aside' : ''} ${craft.undo ? 'is-undo' : ''}`}
      role="status"
      aria-label={t('barra.craftmark.estado', { que: what, pct, parado: !!craft.stalled })}
    >
      <BufferImage
        buf={
          craft.hero
            ? scissorsIcon()
            : craft.potion
              ? potionIcon()
              : itemIcon(craft.icon, craft.rarity)
        }
        scale={2}
      />
      <span class="craft-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
