/**
 * El encuadre del visor: el mismo dibujo se pinta a cualquier ancho × alto; solo cambia dónde caen
 * el horizonte, el arranque del suelo y la fila de los pies.
 */
export interface Encuadre {
  w: number;
  h: number;
  /** Fila del horizonte (donde se apoyan los montes). */
  hor: number;
  /** Fila donde empieza el suelo llano (al pie de los árboles cerca). */
  ground: number;
  /** Fila de los pies de la gente (el camino). */
  feet: number;
}

/**
 * Un encuadre de `w` × `h` con el horizonte y el suelo en fracciones del alto; los pies, por
 * defecto, algo por debajo de la mitad del suelo.
 */
export function encuadre(
  w: number,
  h: number,
  hor: number,
  ground: number,
  feet?: number,
): Encuadre {
  const g = Math.round(h * ground);
  return {
    w,
    h,
    hor: Math.round(h * hor),
    ground: g,
    feet: feet === undefined ? Math.round(g + (h - g) * 0.42) : Math.round(h * feet),
  };
}

/** Móvil: el cuadro enmarcado (cámara cerca; abajo, ~18 px libres para los héroes del marco). */
export const MOVIL = encuadre(156, 140, 0.4, 0.56, 0.74);
/** Escritorio: la pantalla entera (mucho cielo). */
export const ESCRITORIO = encuadre(320, 200, 0.55, 0.7);
