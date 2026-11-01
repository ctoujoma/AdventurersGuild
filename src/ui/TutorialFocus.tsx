import { useEffect, useRef, useState } from 'preact/hooks';
import type { ActId } from '../world/rooms/salas/kit';
import type { Focus } from './tutorialFocus';
import type { GameScene } from './SceneView';

interface Props {
  focus: Focus;
  scene: { current: GameScene | null };
  /**
   * Se ha encontrado (o no) dónde está lo que hay que tocar: la nota se aparta. `closing`: lo
   * que se señala es cerrar algo que tapa (la nota lo dice).
   */
  onSpot?: (y: number | null, closing: boolean) => void;
}

type R = { x: number; y: number; w: number; h: number };
/** Un sitio encontrado; `close`: es el botón de cerrar algo que tapa lo que se busca. */
type Spot = R & { close?: boolean };
const PAD = 6;
/** Lo que tarda en oscurecerse al cambiar de paso (ms). */
const DIM_DELAY = 2500;
/** Marcos que puede haber a la vez (lo principal y lo que también vale, como el tablón). */
const RINGS = 3;

const CLOSE = '[data-tut="cerrar"]';

/**
 * Si un elemento se puede tocar: está en pantalla y lo que hay en su centro es él (no un menú
 * abierto encima). El foco no cuenta, y la nota tampoco (se aparta sola).
 */
function onTop(el: HTMLElement, b: DOMRect): boolean {
  const x = b.left + b.width / 2;
  const y = b.top + b.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
  const hit = document.elementsFromPoint(x, y).find((e) => !e.closest('.tut-focus'));
  return !hit || el.contains(hit) || hit.contains(el) || !!hit.closest('.notebook, .notebook-mini');
}

/**
 * El botón de cerrar de lo que esté abierto encima de todo. El menú de obras de una sala no
 * cuenta: no tapa nada (tocar otra sala lo cambia).
 */
const closer = () => locate([`${CLOSE}:not(.room-menu *)`], null);

/**
 * Busca el primer sitio de la lista que se vea en pantalla y se pueda tocar (lo tapado no
 * vale). Lo de la escena, con algo abierto encima, es cerrar eso (`close`).
 */
function locate(targets: string[], scene: GameScene | null): Spot | null {
  for (const t of targets) {
    // Lo que está en la escena (una sala, un aviso, el tablón): antes hay que cerrar lo que lo tape.
    if (t.startsWith('sala:') || t.startsWith('escena:') || t.startsWith('cosa:')) {
      const close = t === CLOSE ? null : closer();
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
    if (t.startsWith('obra:')) {
      // Una casilla de obra marcada en la escena (comprar el solar, el «+» de ampliar…).
      const r = scene?.targetOnScreen(t);
      if (r && r.w > 0 && r.x + r.w > 0 && r.x < innerWidth && r.y + r.h > 0 && r.y < innerHeight)
        return r;
      continue;
    }
    if (t.startsWith('cosa:')) {
      const r = scene?.actOnScreen(t.slice(5) as ActId);
      if (r && r.w > 0 && r.x + r.w > 0 && r.x < innerWidth && r.y + r.h > 0 && r.y < innerHeight)
        return r;
      continue;
    }
    // Si hay varios (un panel encima de otro), el último es el de arriba; el que esté tapado
    // por otra cosa no vale.
    const els = [...document.querySelectorAll<HTMLElement>(t)];
    for (const el of els.reverse()) {
      const b = el.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0 || !onTop(el, b)) continue;
      return { x: b.left, y: b.top, w: b.width, h: b.height, close: t.startsWith(CLOSE) };
    }
  }
  return null;
}

const pad = (r: R): R => ({ x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 });
const box = (r: R) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`;

/**
 * El foco del tutorial: oscurece y bloquea todo menos lo que hay que tocar, que queda
 * recortado con un marco que late (puede haber más de un hueco: el botón del tablón y el
 * tablón de la sala). Si no hay nada que tocar en pantalla, se puede cerrar lo que esté
 * abierto (los botones de cerrar quedan libres).
 */
export function TutorialFocus({ focus, scene, onSpot }: Props) {
  const block = useRef<HTMLDivElement>(null);
  const rings = useRef<(HTMLDivElement | null)[]>([]);
  const key = [...focus.targets, ...(focus.also ?? [])].join('|') + (focus.scene ? '+escena' : '');
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
    let lastClosing = false;
    let lastClip = '';
    const loop = () => {
      const W = innerWidth;
      const H = innerHeight;
      // Nada a la vista (o tapado): lo que haya abierto se puede cerrar.
      const r = locate(focus.targets, scene.current) ?? closer();
      const closing = !!r?.close;
      const main = closing ? null : r;
      // Lo que también vale (solo si lo principal está a la vista, sin nada abierto encima).
      const extra = main
        ? (focus.also ?? [])
            .map((t) => locate([t], scene.current))
            .filter((x): x is Spot => !!x && !x.close)
        : [];
      const canvas = focus.scene ? document.querySelector('canvas')?.getBoundingClientRect() : null;
      const holes: R[] = canvas
        ? [{ x: canvas.left, y: canvas.top, w: canvas.width, h: canvas.height }]
        : [...(r ? [pad(r)] : []), ...extra.map(pad)];
      // Un velo con agujeros (regla par-impar): lo recortado no se ve oscuro ni se bloquea.
      const clip = `path(evenodd, '${box({ x: 0, y: 0, w: W, h: H })}${holes.map(box).join('')}')`;
      if (clip !== lastClip && block.current) {
        lastClip = clip;
        block.current.style.clipPath = clip;
      }
      const marks = [...(r ? [r] : []), ...extra];
      rings.current.forEach((el, i) => {
        if (!el) return;
        const m = marks[i];
        el.style.display = m ? 'block' : 'none';
        if (!m) return;
        const p = pad(m);
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        el.style.width = `${p.w}px`;
        el.style.height = `${p.h}px`;
      });
      const y = r ? r.y + r.h / 2 : null;
      if (y !== lastY || closing !== lastClosing) {
        lastY = y;
        lastClosing = closing;
        onSpot?.(y, closing);
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
      <div ref={block} class="tut-block" />
      {Array.from({ length: RINGS }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            rings.current[i] = el;
          }}
          class="tut-ring"
        />
      ))}
    </div>
  );
}
