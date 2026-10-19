/**
 * Registro del arte de cada sala: la que está aquí pinta su pared y pone sus muebles; las demás
 * usan lo de siempre (`decorate` en textures.ts y `furnish` en furniture.ts). El salón tiene su
 * propio fichero (`../salon.ts`), que fue el modelo.
 */
import type { RoomType } from '../../../data/rooms';
import type { RoomArt } from './kit';
import { recibidor } from './recibidor';

export const ART: Partial<Record<RoomType, RoomArt>> = {
  recibidor,
};
