import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { GameScene } from './SceneView';
import { audio } from '../audio/audio';

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
  /** Lleno (la cola ha parado): el «!» tiembla de vez en cuando. */
  full?: boolean;
  /** Al tocarlo: recibe la burbuja, para que el efecto salga de ahí. */
  onTake: (el: HTMLElement) => void;
}

/**
 * Lo que espera a que lo recojan sobre una sala (decidido con el usuario, 27 de noviembre): flota,
 * late con un halo dorado y se toca para recogerlo (lo acabado en un taller, la bolsa de la caja,
 * las raciones y las jarras). Sigue a la cámara, como las marcas de los talleres. Entra con un
 * rebote; llena, tiembla de vez en cuando.
 */
export function CollectMark({
  room,
  scene,
  children,
  count,
  label,
  slot = 0,
  aside,
  full,
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
      class={`collect-mark ${aside ? 'is-aside' : ''} ${full ? 'is-full' : ''}`}
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

/** Qué se recoge: decide cuántos iconos vuelan y cómo suenan al llegar. */
export type CollectKind = 'oro' | 'pan' | 'jarra' | 'objeto';

/** Cuántos iconos vuelan: uno por ración o jarra (hasta 6); el oro, de 3 a 6 según la bolsa. */
function flyCount(kind: CollectKind, n: number): number {
  if (kind === 'objeto') return 1;
  if (kind === 'oro') return Math.max(3, Math.min(6, Math.round(n / 40)));
  return Math.max(1, Math.min(6, n));
}

const FLY_MS = 620;
const FLY_GAP = 80;
const SPARKS = ['#ffd35a', '#fff4c2', '#f2a33a', '#ffffff'];

/** Una copia del dibujo, sin el marco de la burbuja (un lienzo se copia con sus píxeles). */
function iconCopy(chip: Element): HTMLElement | null {
  const src = chip.firstElementChild;
  if (!src) return null;
  const copy = src.cloneNode(true) as Element;
  if (src instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement)
    copy.getContext('2d')?.drawImage(src, 0, 0);
  const wrap = document.createElement('span');
  wrap.className = 'collect-fly';
  wrap.appendChild(copy);
  return wrap;
}

/** Destello de chispas de píxel (cuadradas, a saltos y con algo de caída) en (x, y). */
function sparks(x: number, y: number, count: number, reach: number): void {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'collect-spark';
    const size = 3 + (i % 3) * 1.5;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${SPARKS[i % SPARKS.length]}`;
    document.body.appendChild(p);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const d = reach * (0.7 + Math.random() * 0.6);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    p.animate(
      [
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`, opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 14}px))`,
          opacity: 0,
        },
      ],
      { duration: 520, easing: 'steps(7, end)' },
    ).onfinish = () => p.remove();
  }
}

/** El marcador da un saltito y brilla (se puede repetir: vuelve a empezar). */
function bump(to: HTMLElement | null): void {
  if (!to) return;
  to.classList.remove('collect-bump');
  void to.offsetWidth;
  to.classList.add('collect-bump');
}

/**
 * El efecto de recoger (pulido con el usuario, 27 de noviembre):
 * - chispas de píxel donde estaba la burbuja y un «+6» que sube y se desvanece;
 * - de 1 a 6 iconos (el dibujo solo, sin el marco, con un contorno claro y un halo) que vuelan en
 *   arco, escalonados, hasta su marcador (el oro, el pan, la jarra o la pestaña de Héroes);
 * - cada uno que llega hace saltar el marcador y suena, un poco más agudo que el anterior; la
 *   cifra del marcador espera al primero y cuenta mientras llegan (`Counter`).
 */
export function collectFx(
  from: HTMLElement,
  target: string,
  kind: CollectKind,
  n = 1,
  plus?: string,
): void {
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const to = document.querySelector<HTMLElement>(target);
  const k = flyCount(kind, n);
  if (plus) {
    const tag = document.createElement('span');
    tag.className = 'collect-plus';
    tag.textContent = plus;
    tag.style.left = `${cx}px`;
    tag.style.top = `${r.top}px`;
    document.body.appendChild(tag);
    tag.animate(
      quiet
        ? [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
        : [
            { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
            { transform: 'translate(-50%, -14px) scale(1.15)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, -30px) scale(1)', opacity: 1, offset: 0.7 },
            { transform: 'translate(-50%, -46px) scale(1)', opacity: 0 },
          ],
      { duration: 1100, easing: 'ease-out' },
    ).onfinish = () => tag.remove();
  }
  if (quiet) {
    audio.gather(kind, 0);
    return bump(to);
  }
  sparks(cx, cy, 14, 30);
  const chip = from.querySelector('.collect-chip');
  if (!to || !chip) {
    audio.gather(kind, 0);
    return bump(to);
  }
  const t = to.getBoundingClientRect();
  const tx = t.left + t.width / 2;
  const ty = t.top + t.height / 2;
  to.dataset.landAt = String(performance.now() + FLY_MS);
  to.dataset.landFor = String((k - 1) * FLY_GAP + 150);
  for (let i = 0; i < k; i++) {
    const fly = iconCopy(chip);
    if (!fly) break;
    // Cada uno sale de un punto algo distinto y sube por un arco algo distinto.
    const sx = cx + (k > 1 ? (Math.random() - 0.5) * 28 : 0);
    const sy = cy + (k > 1 ? (Math.random() - 0.5) * 16 : 0);
    const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 60;
    const my = Math.min(sy, ty) - 70 - Math.random() * 50;
    fly.style.left = '0px';
    fly.style.top = '0px';
    document.body.appendChild(fly);
    const frames: Keyframe[] = [];
    const steps = 12;
    for (let j = 0; j <= steps; j++) {
      const u = Math.pow(j / steps, 1.35);
      const x = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * tx;
      const y = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * ty;
      const sc = j === 0 ? 0.6 : j === 1 ? 1.25 : 1.1 - 0.55 * (j / steps);
      frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${sc})` });
    }
    const a = fly.animate(frames, {
      duration: FLY_MS,
      delay: i * FLY_GAP,
      easing: 'linear',
      fill: 'backwards',
    });
    a.onfinish = () => {
      fly.remove();
      bump(to);
      audio.gather(kind, i);
    };
  }
}
