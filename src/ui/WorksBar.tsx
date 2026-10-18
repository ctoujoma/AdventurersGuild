import { useMemo } from 'preact/hooks';
import { ROOM_COST, STAIR_COST } from '../core/balance';
import { laxly } from '../core/rooms';
import { ROOMS, type RoomType } from '../data/rooms';
import { pickTitle, targetsFor } from '../world/rooms/works';
import { Icon } from './icons';
import type { Works } from './works';

interface Props {
  works: Works;
  /** La lista de obras y salas del gremio (pestaña «Obras»). */
  onMore: () => void;
}

/** Orden de la cinta: lo que más se construye primero. */
const ORDER: RoomType[] = [
  'dormitorio',
  'servicio',
  'cocina',
  'bodega',
  'despensa',
  'enfermeria',
  'armas',
  'tiro',
  'biblioteca',
  'capilla',
  'mapas',
  'armeria',
  'forja',
  'veteranos',
  'torre',
  'salon',
  'tesoro',
  'recibidor',
];

/**
 * Cinta del modo obras, como en un refugio: las salas que se pueden construir en una fila que
 * se desliza, la escalera y, debajo, lo que lleva el plano con deshacer, pagar y salir.
 */
function Ribbon({ works: w, onMore }: Props) {
  const b = w.view.building;
  const items = useMemo(
    () =>
      laxly(() =>
        ORDER.filter((t) => !(ROOMS[t].unique && b.rooms.some((r) => r.type === t))).map((t) => ({
          t,
          spots: targetsFor(w.view, { kind: 'build', type: t }).length,
        })),
      ),
    [w.view],
  );
  const stairs = useMemo(
    () => (b.stairs.length < 2 ? laxly(() => targetsFor(w.view, { kind: 'stair' })).length : 0),
    [w.view],
  );
  const n = w.steps.length;
  return (
    <div class="worksbar ribbon" role="toolbar" aria-label="Modo obras">
      <div class="ribbon-rooms">
        {items.map(({ t, spots }) => (
          <button
            key={t}
            class="ribbon-room"
            disabled={!spots}
            data-help={ROOMS[t].desc}
            aria-label={`Construir ${ROOMS[t].name} por ${ROOM_COST[t][1]} monedas`}
            onClick={() => w.startPick({ kind: 'build', type: t })}
          >
            <b>{ROOMS[t].name}</b>
            <span>
              <Icon name="coin" size={9} /> {ROOM_COST[t][1]}
            </span>
          </button>
        ))}
        {b.stairs.length < 2 && (
          <button
            class="ribbon-room"
            disabled={!stairs}
            aria-label={`Otra escalera por ${STAIR_COST} monedas`}
            onClick={() => w.startPick({ kind: 'stair' })}
          >
            <b>Escalera</b>
            <span>
              <Icon name="coin" size={9} /> {STAIR_COST}
            </span>
          </button>
        )}
      </div>
      <span class="worksbar-text ribbon-text">
        {n ? (
          <>
            {n} {n === 1 ? 'obra' : 'obras'} · {w.planCost >= 0 ? 'cuesta' : 'recuperas'}{' '}
            <Icon name="coin" size={10} /> {Math.abs(w.planCost)}
          </>
        ) : (
          'Toca un hueco marcado o una sala'
        )}
        {w.issue && <span class="worksbar-issue">{w.issue}</span>}
      </span>
      <div class="ribbon-foot">
        <button class="btn btn-wood" onClick={onMore}>
          Salas
        </button>
        <button class="btn btn-wood" disabled={!n} onClick={w.undo}>
          Deshacer
        </button>
        <button
          class="btn btn-gold"
          disabled={!n || !!w.issue}
          title={w.issue ?? undefined}
          onClick={w.pay}
        >
          Pagar
        </button>
        <button class="btn btn-wood" onClick={w.discard}>
          Salir
        </button>
      </div>
    </div>
  );
}

/** Barra de abajo mientras se elige sitio para una obra o se está en el modo obras. */
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
        {c && !w.planning && (
          <button class="btn btn-gold" onClick={w.confirm}>
            Hacer
          </button>
        )}
        <button class="btn btn-wood" onClick={w.cancelPick}>
          {w.planning ? 'Volver' : 'Cancelar'}
        </button>
      </div>
    );
  }
  if (!w.planning) return null;
  return <Ribbon works={w} onMore={onMore} />;
}
