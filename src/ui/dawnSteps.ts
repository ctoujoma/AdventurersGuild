/**
 * Cómo se abre la carta del amanecer: las noticias de una en una. Con muchas, las pequeñas van
 * juntas al final en una lista plegada; en la de «Mientras no estabas», un día cada vez.
 */
import type { DawnEvent } from '../core/model';

/** Lo que se abre de un toque: una noticia, o las pequeñas juntas. */
export interface Step {
  list: DawnEvent[];
  /** Las pequeñas, plegadas («Y además…»). */
  more?: boolean;
}

/** Una página: un día de los que pasaron con el juego cerrado (o el amanecer de hoy). */
export interface Page {
  head?: string;
  steps: Step[];
}

/** A partir de cuántas noticias se juntan las pequeñas. */
export const MANY = 8;

/** Lo que pesa: lo grande, lo bueno, lo malo y los avisos. El resto es información menuda. */
export const isSmall = (e: DawnEvent) => !e.big && (!e.k || e.k === 'info');

export function stepsOf(events: DawnEvent[]): Step[] {
  if (events.length <= MANY) return events.map((e) => ({ list: [e] }));
  const small = events.filter(isSmall);
  const steps: Step[] = events.filter((e) => !isSmall(e)).map((e) => ({ list: [e] }));
  if (small.length === 1) steps.push({ list: small });
  else if (small.length) steps.push({ list: small, more: true });
  return steps;
}

export function dawnPages(events: DawnEvent[]): Page[] {
  if (!events.some((e) => e.head)) return [{ steps: stepsOf(events) }];
  const pages: { head?: string; events: DawnEvent[] }[] = [];
  for (const e of events) {
    if (e.head || !pages.length) pages.push({ head: e.head ? e.t : undefined, events: [] });
    if (!e.head) pages.at(-1)!.events.push(e);
  }
  return pages.map((p) => ({ head: p.head, steps: stepsOf(p.events) }));
}

/** Lo que tarda en abrirse la siguiente sola (ms): más tras algo grande, para que luzca. */
export const delayAfter = (s: Step | undefined) =>
  !s ? 500 : s.list.some((e) => e.big) ? 1500 : s.list[0]!.k === 'bad' ? 1000 : 700;
