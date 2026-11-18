import type { Cover } from '../world/rooms/RoomScene';

/** Lo que tapa la escena: los paneles (menos el mapa, que la tapa entera) y las fichas en hoja. */
export const SHEETS = '.panel:not(.panel-full), .card-backdrop.as-sheet > *';

/**
 * El recuadro de `el` dentro de `root` según la maqueta, sin las transformaciones (así vale
 * también mientras el panel sube con su animación).
 */
function boxIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return n === root ? { x, y, w: el.offsetWidth, h: el.offsetHeight } : null;
}

/**
 * Lo que tapan los paneles y fichas abiertos de la escena (`stage`): por abajo (en vertical, una
 * hoja que sube) o por la derecha (en horizontal, una columna a un lado).
 */
export function coverOf(stage: HTMLElement): Cover {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  let right = 0;
  let bottom = 0;
  for (const el of stage.querySelectorAll<HTMLElement>(SHEETS)) {
    const b = boxIn(el, stage);
    if (!b || !b.w || !b.h) continue;
    if (b.w < W * 0.7 && b.x + b.w >= W - 2) right = Math.max(right, W - b.x);
    else bottom = Math.max(bottom, H - b.y);
  }
  return { right: Math.max(0, Math.round(right)), bottom: Math.max(0, Math.round(bottom)) };
}
