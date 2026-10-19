/** Medidas del mundo 2D: la altura del suelo y hasta dónde llega (cámara, cielo y paisaje). */

export const WORLD_H = 384;
export const GROUND = 300;
/**
 * El mundo visible va más allá del corte del edificio (de 0 a 512): un patio con el camino
 * real a la izquierda, donde llegan los asaltos, y terreno a la derecha para crecer.
 */
export const WORLD_X0 = -128;
export const WORLD_X1 = 640;
export const SPAN = WORLD_X1 - WORLD_X0;

/** Paredes exteriores del edificio (cortadas) y su interior. */
