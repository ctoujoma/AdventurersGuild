/**
 * Registro del arte de cada sala: la que está aquí pinta su pared y pone sus muebles; las demás
 * usan lo de siempre (`decorate` en textures.ts y `furnish` en furniture.ts). El salón tiene su
 * propio fichero (`../salon.ts`), que fue el modelo.
 */
import type { RoomType } from '../../../data/rooms';
import type { RoomArt } from './kit';
import { armeria } from './armeria';
import { bodega } from './bodega';
import { dormitorio, servicio, veteranos } from './camas';
import { capilla } from './capilla';
import { enfermeria } from './enfermeria';
import { armas, biblioteca, tiro } from './entrenamiento';
import { forja } from './forja';
import { mapas } from './mapas';
import { tesoro } from './tesoro';
import { cocina } from './cocina';
import { despensa } from './despensa';
import { recibidor } from './recibidor';

export const ART: Partial<Record<RoomType, RoomArt>> = {
  recibidor,
  cocina,
  despensa,
  bodega,
  dormitorio,
  servicio,
  veteranos,
  enfermeria,
  tesoro,
  armeria,
  forja,
  armas,
  tiro,
  biblioteca,
  capilla,
  mapas,
};
