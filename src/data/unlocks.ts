/**
 * Cosas que se ven y se ganan: piezas de la fachada y temas de color de las salas. Unas vienen de
 * serie; las demás las dan las hazañas y los objetivos (`unlock` en su premio). Solo se ven.
 */
import type { RoofId, SignId, TintId, WallId } from './custom';
import { msg, tx, type Msg } from '../textos';

export type UnlockId =
  `roof:${RoofId}` | `walls:${WallId}` | `sign:${SignId}` | `tint:${TintId}` | 'boxes';

/** Lo que se tiene desde el principio. */
export const FREE: readonly UnlockId[] = [
  'roof:teja',
  'walls:tablas',
  // De momento de serie (falta decidir de qué hazaña u objetivo salen).
  'walls:troncos',
  'walls:ladrillo',
  'walls:tapial',
  'walls:pizarra',
  'walls:encalado',
  'sign:tablero',
  'tint:vino',
  'tint:bosque',
  'tint:lino',
];

/** Nombre para el premio («tejado de pizarra»), como mensaje (va en el Libro y en las cartas). */
export function unlockMsg(id: UnlockId): Msg {
  if (id === 'boxes') return msg('personalizar.premio.jardineras');
  const [kind, k] = id.split(':') as [string, string];
  const say = (key: string, name: string) =>
    msg(`personalizar.premio.${key}`, { nombre: msg('general.minus', { x: msg(name) }) });
  if (kind === 'roof') return say('tejado', `personalizar.tejados.${k}`);
  if (kind === 'walls') return say('paredes', `personalizar.paredes.${k}`);
  if (kind === 'sign') return say('rotulo', `personalizar.rotulos.${k}`);
  return say('tinte', `personalizar.tintes.${k}.nombre`);
}

/** Lo mismo, escrito. */
export const unlockName = (id: UnlockId): string => tx(unlockMsg(id));
