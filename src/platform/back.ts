import { useEffect, useRef } from 'preact/hooks';

/**
 * Botón «atrás» del móvil (y del navegador): mientras haya algo abierto encima del juego se
 * deja una entrada de más en el historial, y al volver atrás se cierra lo de arriba en vez
 * de salir. Si se cierra desde la interfaz, se retira esa entrada para no dejar rastro.
 */
let guarded = false;
let skipNext = false;

export function useBackButton(open: boolean, closeTop: () => void): void {
  const close = useRef(closeTop);
  close.current = closeTop;

  useEffect(() => {
    const onPop = () => {
      if (skipNext) {
        skipNext = false;
        return;
      }
      guarded = false;
      close.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Tras cada render: si queda algo abierto y no hay entrada, se pone; si ya no hay nada,
  // se quita la que sobra.
  useEffect(() => {
    if (open && !guarded) {
      history.pushState({ jarro: 'capa' }, '');
      guarded = true;
    } else if (!open && guarded) {
      guarded = false;
      skipNext = true;
      history.back();
    }
  });
}
