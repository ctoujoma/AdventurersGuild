import { useEffect, useMemo, useState } from 'preact/hooks';
import { ROOM_COST } from '../core/balance';
import { laxly, stairCost } from '../core/rooms';
import { ROOMS, type RoomType } from '../data/rooms';
import { pickTitle, targetsFor } from '../world/rooms/works';
import { help } from './HoldHelp';
import { Icon, type IconName } from './icons';
import type { Works } from './works';

interface Props {
  works: Works;
  /** La lista de obras y salas del gremio (pestaña «Obras»). */
  onMore: () => void;
}

/** Pestañas de la cinta, con sus salas (lo que más se construye, primero) y su icono. */
const TABS: { name: string; icon: IconName; rooms: RoomType[] }[] = [
  {
    name: 'Gente',
    icon: 'cama',
    rooms: ['dormitorio', 'servicio', 'enfermeria', 'capilla', 'veteranos'],
  },
  { name: 'Comida', icon: 'olla', rooms: ['cocina', 'bodega', 'despensa'] },
  { name: 'Entreno', icon: 'espadas', rooms: ['armas', 'tiro', 'biblioteca'] },
  { name: 'Defensa', icon: 'escudo', rooms: ['armeria', 'forja', 'torre', 'tesoro', 'recibidor'] },
  { name: 'Gremio', icon: 'jarra', rooms: ['salon', 'mapas'] },
];

const ICON: Record<RoomType, IconName> = {
  dormitorio: 'cama',
  servicio: 'cama',
  veteranos: 'star',
  enfermeria: 'cruz',
  capilla: 'vela',
  cocina: 'olla',
  bodega: 'barril',
  despensa: 'pan',
  armas: 'espadas',
  tiro: 'diana',
  biblioteca: 'libro',
  armeria: 'escudo',
  forja: 'yunque',
  torre: 'torre',
  tesoro: 'cofre',
  recibidor: 'puerta',
  salon: 'jarra',
  mapas: 'mapa',
};

/**
 * Cinta del modo obras, como en un refugio: las salas que se pueden construir en una fila que
 * se desliza, la escalera y, debajo, lo que lleva el plano con deshacer, pagar y salir.
 */
function Ribbon({ works: w, onMore }: Props) {
  const b = w.view.building;
  const [tab, setTab] = useState(0);
  const items = useMemo(
    () =>
      laxly(() =>
        TABS[tab]!.rooms.map((t) => {
          // Las únicas que ya están se amplían desde aquí (a los lados y, el salón, hacia arriba).
          const list = targetsFor(w.view, { kind: 'build', type: t });
          const grow = !!ROOMS[t].unique && b.rooms.some((r) => r.type === t);
          const cost = grow && list.length ? Math.min(...list.map((x) => x.cost)) : ROOM_COST[t][1];
          return { t, spots: list.length, grow, cost };
        }),
      ),
    [w.view, tab],
  );
  const stairs = useMemo(() => laxly(() => targetsFor(w.view, { kind: 'stair' })).length, [w.view]);
  const n = w.steps.length;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [n]);
  return (
    <div class="worksbar ribbon" role="toolbar" aria-label="Modo obras">
      <div class="ribbon-tabs" role="tablist">
        {TABS.map((x, i) => (
          <button
            key={x.name}
            role="tab"
            aria-selected={i === tab}
            class={`ribbon-tab ${i === tab ? 'is-on' : ''}`}
            onClick={() => setTab(i)}
          >
            <Icon name={x.icon} size={14} />
            {x.name}
          </button>
        ))}
      </div>
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
            <Icon name={ICON[t]} size={20} />
            <b>
              {grow ? 'Ampliar ' : ''}
              {grow ? ROOMS[t].name.toLowerCase() : ROOMS[t].name}
            </b>
            <span>
              <Icon name="coin" size={9} /> {cost}
            </span>
          </button>
        ))}
        {TABS[tab]!.name === 'Gremio' && (
          <button
            class="ribbon-room"
            disabled={!stairs}
            data-help="Un tramo une una planta con la de encima. Cada tramo cuesta un poco más."
            aria-label={`Tramo de escalera por ${stairCost(b)} monedas`}
            onClick={() => w.startPick({ kind: 'stair' })}
          >
            <Icon name="escalera" size={20} />
            <b>Escalera</b>
            <span>
              <Icon name="coin" size={9} /> {stairCost(b)}
            </span>
          </button>
        )}
      </div>
      <span class="worksbar-text ribbon-text">
        {n ? (
          <>
            {n} {n === 1 ? 'obra apuntada' : 'obras apuntadas'}
            {w.planCost < 0 && (
              <>
                {' '}
                · recuperas <Icon name="coin" size={10} /> {-w.planCost}
              </>
            )}
          </>
        ) : (
          'Elige una sala abajo o toca una de la casa'
        )}
        {w.issue && <span class="worksbar-issue">{w.issue}</span>}
      </span>
      <div class="ribbon-foot">
        <button
          class="btn-icon"
          aria-label="Lista de salas"
          {...help('Lista de salas: todas las salas por planta y las mejoras del patio.')}
          onClick={onMore}
        >
          <Icon name="lista" size={16} />
        </button>
        <button
          class="btn-icon"
          aria-label="Deshacer la última obra"
          {...help('Deshacer la última obra apuntada.')}
          disabled={!n}
          onClick={w.undo}
        >
          <Icon name="deshacer" size={16} />
        </button>
        <button
          class="btn btn-gold ribbon-pay"
          disabled={!n || !!w.issue}
          title={w.issue ?? undefined}
          aria-label={
            w.planCost >= 0
              ? `Pagar las obras: ${w.planCost} monedas`
              : `Pagar las obras: recuperas ${-w.planCost} monedas`
          }
          onClick={w.pay}
        >
          <Icon name="coin" size={14} /> Pagar{n ? ` ${Math.abs(w.planCost)}` : ''}
        </button>
        <button
          class={`btn ${leaving ? 'btn-red' : 'btn-wood'} ribbon-exit`}
          aria-label={leaving ? 'Descartar las obras y salir' : 'Salir del modo obras'}
          onClick={() => {
            // Con obras apuntadas, el primer toque pregunta y el segundo descarta.
            if (!n || leaving) w.discard();
            else setLeaving(true);
          }}
        >
          {leaving ? '¿Descartar?' : <Icon name="close" size={14} />}
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
