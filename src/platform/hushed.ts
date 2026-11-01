/** Los avisos descartados, guardados aparte de la partida (con su semilla, para no mezclar). */
const KEY = 'jarro:avisos';

/** `id` del aviso → día en que se descartó. */
type Hushed = Record<string, number>;

export function loadHushed(seed: string): Hushed {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
      seed?: string;
      hushed?: Hushed;
    } | null;
    return v?.seed === seed && v.hushed ? v.hushed : {};
  } catch {
    return {};
  }
}

export function saveHushed(seed: string, hushed: Hushed) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ seed, hushed }));
  } catch {
    // Sin almacenamiento: se olvidan al cerrar.
  }
}
