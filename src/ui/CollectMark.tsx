import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { GameScene } from './SceneView';

interface Props {
  /** La sala sobre la que flota (id). */
  room: string;
  scene: { current: GameScene | null };
  /** El dibujo de lo que espera (el objeto, la bolsa, el pan o la jarra). */
  children: ComponentChildren;
  /** Lo que se lee en la esquina («×2», «+12»). */
  count?: string;
  /** Para lectores de pantalla: qué se recoge. */
  label: string;
  /** El segundo (o tercero) de la misma sala: al lado del primero. */
  slot?: number;
  /** Hay otra marca en la sala (un incidente): se aparta a un lado. */
  aside?: boolean;
  /** Al tocarlo: recibe la burbuja, para que el efecto salga de ahí. */
  onTake: (el: HTMLElement) => void;
}

/**
 * Lo que espera a que lo recojan sobre una sala (decidido con el usuario, 27 de noviembre): flota,
 * late con un halo dorado y se toca para recogerlo (lo acabado en un taller, la bolsa de la caja,
 * las raciones y las jarras). Sigue a la cámara, como las marcas de los talleres.
 */
export function CollectMark({
  room,
  scene,
  children,
  count,
  label,
  slot = 0,
  aside,
  onTake,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const s = scene.current;
      const at = s?.roomTop(room);
      if (el && s && at) {
        const p = s.screenOf(at.x, at.y);
        el.style.left = `${p.x + slot * 54}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [room, slot]);
  return (
    <button
      ref={ref}
      class={`collect-mark ${aside ? 'is-aside' : ''}`}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onTake(e.currentTarget);
      }}
    >
      <span class="collect-halo" aria-hidden="true" />
      <span class="collect-chip">{children}</span>
      {count && <span class="collect-count">{count}</span>}
    </button>
  );
}

/**
 * El efecto de recoger: un destello de chispas donde estaba y el dibujo vuela hasta su marcador
 * (el oro, el pan, la jarra o la pestaña de Héroes, donde está el arcón), que da un saltito.
 */
export function collectFx(from: HTMLElement, target: string): void {
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const to = document.querySelector<HTMLElement>(target);
  const bump = () => {
    if (!to) return;
    to.classList.remove('collect-bump');
    void to.offsetWidth;
    to.classList.add('collect-bump');
  };
  if (quiet) return bump();
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i');
    p.className = 'collect-spark';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    document.body.appendChild(p);
    const a = (i / 12) * Math.PI * 2;
    const d = 26 + (i % 3) * 10;
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.3)`,
          opacity: 0,
        },
      ],
      { duration: 480, easing: 'cubic-bezier(.2,.8,.4,1)' },
    ).onfinish = () => p.remove();
  }
  const chip = from.querySelector('.collect-chip');
  if (!to || !chip) return bump();
  const t = to.getBoundingClientRect();
  const fly = chip.cloneNode(true) as HTMLElement;
  fly.classList.add('collect-fly');
  fly.style.left = `${cx}px`;
  fly.style.top = `${cy}px`;
  document.body.appendChild(fly);
  fly.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      {
        transform: `translate(calc(-50% + ${t.left + t.width / 2 - cx}px), calc(-50% + ${t.top + t.height / 2 - cy}px)) scale(0.45)`,
        opacity: 0.3,
      },
    ],
    { duration: 650, easing: 'cubic-bezier(.5,-0.3,.7,1)' },
  ).onfinish = () => {
    fly.remove();
    bump();
  };
}
