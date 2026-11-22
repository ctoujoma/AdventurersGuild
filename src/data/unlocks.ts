/**
 * Cosas que se ven y se ganan: piezas de la fachada y temas de color de las salas. Unas vienen de
 * serie; las demás las dan las hazañas y los objetivos (`unlock` en su premio). Solo se ven.
 */
import {
  ROOFS,
  SIGNS,
  TINTS,
  WALLS,
  type RoofId,
  type SignId,
  type TintId,
  type WallId,
} from './custom';
import { t } from '../textos';

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

/** Nombre para el premio («tejado de pizarra»). */
export function unlockName(id: UnlockId): string {
  if (id === 'boxes') return t('personalizar.premio.jardineras');
  const [kind, k] = id.split(':') as [string, string];
  const say = (key: string, name: string) =>
    t(`personalizar.premio.${key}`, { nombre: name.toLowerCase() });
  if (kind === 'roof') return say('tejado', ROOFS[k as RoofId]);
  if (kind === 'walls') return say('paredes', WALLS[k as WallId]);
  if (kind === 'sign') return say('rotulo', SIGNS[k as SignId]);
  return say('tinte', TINTS[k as TintId].name);
}
