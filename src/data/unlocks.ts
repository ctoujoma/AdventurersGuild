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

export type UnlockId =
  `roof:${RoofId}` | `walls:${WallId}` | `sign:${SignId}` | `tint:${TintId}` | 'boxes';

/** Lo que se tiene desde el principio. */
export const FREE: readonly UnlockId[] = [
  'roof:teja',
  'walls:tablas',
  'sign:tablero',
  'tint:vino',
  'tint:bosque',
  'tint:lino',
];

/** Nombre para el premio («tejado de pizarra»). */
export function unlockName(id: UnlockId): string {
  if (id === 'boxes') return 'jardineras para la fachada';
  const [kind, k] = id.split(':') as [string, string];
  if (kind === 'roof') return `tejado de ${ROOFS[k as RoofId].toLowerCase()}`;
  if (kind === 'walls') return `paredes de ${WALLS[k as WallId].toLowerCase()}`;
  if (kind === 'sign') return `rótulo ${SIGNS[k as SignId].toLowerCase()}`;
  return `telas color ${TINTS[k as TintId].name.toLowerCase()}`;
}
