import { pickTitle } from '../world/rooms/works';
import { Icon } from './icons';
import type { Works } from './works';

interface Props {
  works: Works;
  /** Seguir planeando: abre la pestaña de obras. */
  onMore: () => void;
}

/** Barra de abajo mientras se elige sitio para una obra o se planea una reforma. */
export function WorksBar({ works: w, onMore }: Props) {
  if (w.pick) {
    const c = w.chosen;
    return (
      <div class="daybar worksbar" role="status">
        <span class="worksbar-text">
          {c ? (
            <>
              {c.label} · <Icon name="coin" size={10} /> {c.cost}
            </>
          ) : (
            pickTitle(w.view, w.pick)
          )}
        </span>
        {c && (
          <button class="btn btn-gold" onClick={w.confirm}>
            {w.planning ? 'Apuntar' : 'Hacer'}
          </button>
        )}
        <button class="btn btn-wood" onClick={w.cancelPick}>
          Cancelar
        </button>
      </div>
    );
  }
  if (!w.planning) return null;
  const n = w.steps.length;
  return (
    <div class="daybar worksbar" role="status">
      <span class="worksbar-text">
        Plano · {n} {n === 1 ? 'obra' : 'obras'}
        {n > 0 && (
          <>
            {' '}
            · {w.planCost >= 0 ? 'cuesta' : 'recuperas'} <Icon name="coin" size={10} />{' '}
            {Math.abs(w.planCost)}
          </>
        )}
      </span>
      <button class="btn btn-wood" onClick={onMore}>
        Obras
      </button>
      <button class="btn btn-wood" disabled={!n} onClick={w.undo}>
        Deshacer
      </button>
      <button class="btn btn-gold" disabled={!n} onClick={w.pay}>
        Pagar
      </button>
      <button class="btn btn-wood" onClick={w.discard}>
        Salir
      </button>
    </div>
  );
}
