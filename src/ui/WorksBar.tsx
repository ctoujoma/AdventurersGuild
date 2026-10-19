import { useEffect, useMemo, useState } from 'preact/hooks';
import { ROOM_COST } from '../core/balance';
import { laxly, stairCost } from '../core/rooms';
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
        ORDER.map((t) => {
          // Las únicas que ya están se amplían desde aquí (a los lados y, el salón, hacia arriba).
          const list = targetsFor(w.view, { kind: 'build', type: t });
          const grow = !!ROOMS[t].unique && b.rooms.some((r) => r.type === t);
          const cost = grow && list.length ? Math.min(...list.map((x) => x.cost)) : ROOM_COST[t][1];
          return { t, spots: list.length, grow, cost };
        }),
      ),
    [w.view],
  );
  const stairs = useMemo(() => laxly(() => targetsFor(w.view, { kind: 'stair' })).length, [w.view]);
  const n = w.steps.length;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [n]);
  return (
    <div class="worksbar ribbon" role="toolbar" aria-label="Modo obras">
      <div class="ribbon-rooms">
        {items.map(({ t, spots, grow, cost }) => (
          <button
            key={t}
            class="ribbon-room"
            disabled={!spots}
            data-help={ROOMS[t].desc}
            aria-label={`${grow ? 'Ampliar' : 'Construir'} ${ROOMS[t].name} por ${cost} monedas`}
            onClick={() => w.startPick({ kind: 'build', type: t })}
          >
            <b>
              {grow ? 'Ampliar ' : ''}
              {grow ? ROOMS[t].name.toLowerCase() : ROOMS[t].name}
            </b>
            <span>
              <Icon name="coin" size={9} /> {cost}
            </span>
          </button>
        ))}
        <button
          class="ribbon-room"
          disabled={!stairs}
          data-help="Un tramo une una planta con la de encima. Cada tramo cuesta un poco más."
          aria-label={`Tramo de escalera por ${stairCost(b)} monedas`}
          onClick={() => w.startPick({ kind: 'stair' })}
        >
          <b>Escalera</b>
          <span>
            <Icon name="coin" size={9} /> {stairCost(b)}
          </span>
        </button>
      </div>
      <span class="worksbar-text ribbon-text">
        {n ? (
          <>
            {n} {n === 1 ? 'obra' : 'obras'} · {w.planCost >= 0 ? 'cuesta' : 'recuperas'}{' '}
            <Icon name="coin" size={10} /> {Math.abs(w.planCost)}
          </>
        ) : (
          'Elige una sala abajo o toca una sala de la casa'
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
        <button
          class={`btn ${leaving ? 'btn-red' : 'btn-wood'}`}
          onClick={() => {
            // Con obras apuntadas, el primer toque pregunta y el segundo descarta.
            if (!n || leaving) w.discard();
            else setLeaving(true);
          }}
        >
          {leaving ? '¿Descartar?' : 'Salir'}
        </button>
      </div>
    </div>
  );
}

/**
 * Barra de abajo del modo obras: la cinta de salas y lo que lleva el borrador; mientras se elige
 * sitio para una obra de la cinta (o a dónde mover una sala), qué se está eligiendo y «Volver».
 */
export function WorksBar({ works: w, onMore }: Props) {
  if (!w.planning) return null;
  if (w.pick)
    return (
      <div class="daybar worksbar" role="status">
        <span class="worksbar-text">{pickTitle(w.view, w.pick)}</span>
        <button class="btn btn-wood" onClick={w.cancelPick}>
          Volver
        </button>
      </div>
    );
  return <Ribbon works={w} onMore={onMore} />;
}
