import { useEffect, useRef, useState } from 'preact/hooks';
import type { Focus } from './tutorialFocus';
import type { GameScene } from './SceneView';

interface Props {
  focus: Focus;
  scene: { current: GameScene | null };
  /** Se ha encontrado (o no) dónde está lo que hay que tocar: la nota se aparta. */
  onSpot?: (y: number | null) => void;
}

type R = { x: number; y: number; w: number; h: number };
const PAD = 6;
/** Lo que tarda en oscurecerse al cambiar de paso (ms). */
const DIM_DELAY = 2000;

/** Busca el primer sitio de la lista que se vea en pantalla. */
function locate(targets: string[], scene: GameScene | null): R | null {
  for (const t of targets) {
    // Lo que está en la escena (una sala, un aviso): antes hay que cerrar lo que lo tape.
    if (t.startsWith('sala:') || t.startsWith('escena:')) {
      const close = locate(['[data-tut="cerrar"]'], null);
      if (close) return close;
    }
    if (t.startsWith('escena:')) {
      const r = locate([t.slice(7)], null);
      if (r) return r;
      continue;
    }
    if (t.startsWith('sala:')) {
      const r = scene?.roomOnScreen(t.slice(5));
      if (r && r.w > 0) return r;
      continue;
    }
    // Si hay varios (un panel encima de otro), el último es el de arriba.
    const els = [...document.querySelectorAll<HTMLElement>(t)];
    for (const el of els.reverse()) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) return { x: b.left, y: b.top, w: b.width, h: b.height };
    }
  }
  return null;
}

/**
 * El foco del tutorial: oscurece y bloquea todo menos lo que hay que tocar, que queda
 * recortado con un marco que late. Si no hay nada que tocar en pantalla, se puede cerrar lo
 * que esté abierto (los botones de cerrar quedan libres).
 */
export function TutorialFocus({ focus, scene, onSpot }: Props) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const key = focus.targets.join('|') + (focus.scene ? '+escena' : '');
  // Al cambiar de paso, primero se ve la pantalla tal cual; el oscurecido y el marco entran
  // al cabo de un momento (lo de fuera ya está bloqueado desde el principio).
  const [dim, setDim] = useState(false);
  useEffect(() => {
    setDim(false);
    const t = setTimeout(() => setDim(true), DIM_DELAY);
    return () => clearTimeout(t);
  }, [key]);
  useEffect(() => {
    let raf = 0;
    let lastY: number | null | undefined;
    const loop = () => {
      const W = innerWidth;
      const H = innerHeight;
      let r = locate(focus.targets, scene.current);
      // Nada a la vista: lo que haya abierto se puede cerrar.
      const hole = r ?? locate(['[data-tut="cerrar"]'], null);
      const canvas = focus.scene ? document.querySelector('canvas')?.getBoundingClientRect() : null;
      const open: R | null = canvas
        ? { x: canvas.left, y: canvas.top, w: canvas.width, h: canvas.height }
        : hole
          ? { x: hole.x - PAD, y: hole.y - PAD, w: hole.w + PAD * 2, h: hole.h + PAD * 2 }
          : null;
      const set = (el: HTMLDivElement | null, x: number, y: number, w: number, h: number) => {
        if (!el) return;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.width = `${Math.max(0, w)}px`;
        el.style.height = `${Math.max(0, h)}px`;
      };
      if (open) {
        set(top.current, 0, 0, W, open.y);
        set(bottom.current, 0, open.y + open.h, W, H - open.y - open.h);
        set(left.current, 0, open.y, open.x, open.h);
        set(right.current, open.x + open.w, open.y, W - open.x - open.w, open.h);
      } else {
        set(top.current, 0, 0, W, H);
        set(bottom.current, 0, 0, 0, 0);
        set(left.current, 0, 0, 0, 0);
        set(right.current, 0, 0, 0, 0);
      }
      if (!r && hole) r = hole;
      if (ring.current) {
        ring.current.style.display = r ? 'block' : 'none';
        if (r) set(ring.current, r.x - PAD, r.y - PAD, r.w + PAD * 2, r.h + PAD * 2);
      }
      const y = r ? r.y + r.h / 2 : null;
      if (y !== lastY) {
        lastY = y;
        onSpot?.(y);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return (
    <div
      class={`tut-focus ${focus.scene ? 'tut-scene' : ''} ${dim ? 'is-dim' : ''}`}
      aria-hidden="true"
    >
      <div ref={top} class="tut-block" />
      <div ref={bottom} class="tut-block" />
      <div ref={left} class="tut-block" />
      <div ref={right} class="tut-block" />
      <div ref={ring} class="tut-ring" />
    </div>
  );
}
