import { useEffect, useMemo, useState } from 'preact/hooks';
import { ROOM_COST } from '../core/balance';
import { laxly, stairCost } from '../core/rooms';
import { GARDEN_PIECES, type GardenPieceId } from '../data/custom';
import { ROOMS, type RoomType } from '../data/rooms';
import { pickTitle, targetsFor, whyNoSpot } from '../world/rooms/works';
import { audio } from '../audio/audio';
import { help } from './HoldHelp';
import { Icon, type IconName } from './icons';
import { NO_GOLD, type Works } from './works';
import { t } from '../textos';

interface Props {
  works: Works;
  /** La lista de obras y salas del gremio (pestaña «Obras»). */
  onMore: () => void;
}

/** Pestañas de la cinta, con sus salas (lo que más se construye, primero) y su icono. */
const TABS: { name: string; icon: IconName; rooms: RoomType[] }[] = [
  {
    name: t('barra.worksbar.gente'),
    icon: 'cama',
    rooms: ['dormitorio', 'servicio', 'enfermeria', 'capilla', 'veteranos'],
  },
  { name: t('barra.worksbar.comida'), icon: 'olla', rooms: ['cocina', 'bodega', 'despensa'] },
  { name: t('barra.worksbar.entreno'), icon: 'espadas', rooms: ['armas', 'tiro', 'biblioteca'] },
  {
    name: t('barra.worksbar.defensa'),
    icon: 'escudo',
    rooms: ['armeria', 'torre', 'tesoro', 'recibidor'],
  },
  {
    name: t('barra.worksbar.talleres'),
    icon: 'yunque',
    rooms: ['forja', 'sastreria', 'alquimia', 'pintor'],
  },
  // La última es la del gremio (con la escalera).
  { name: t('barra.worksbar.gremio'), icon: 'jarra', rooms: ['salon', 'mapas', 'almacen'] },
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
  sastreria: 'banderin',
  alquimia: 'vela',
  pintor: 'brocha',
  almacen: 'cofre',
};

/** La última pestaña de la cinta (la cinta se rehace al volver de elegir sitio). */
let lastTab = 0;

/** Las piezas del jardín y el claustro, con su icono (gratis de momento). */
const GARDEN_TILES: [GardenPieceId | 'claustro', string, IconName][] = [
  ...(Object.keys(GARDEN_PIECES) as GardenPieceId[]).map(
    (k) => [k, GARDEN_PIECES[k], k] as [GardenPieceId, string, IconName],
  ),
  ['claustro', t('barra.worksbar.claustro'), 'claustro'],
];

/**
 * Cinta del modo obras, como en un refugio: las salas que se pueden construir en una fila que
 * se desliza, la escalera y, debajo, lo que lleva el plano con deshacer, pagar y salir.
 */
function Ribbon({ works: w, onMore }: Props) {
  const b = w.view.building;
  // Al volver de elegir sitio, la misma pestaña; si se llega eligiendo algo del jardín (desde
  // Adornos), la suya.
  const [tab, pickTab] = useState(
    w.pick?.kind === 'garden'
      ? TABS.length
      : w.gardenOpen
        ? lastTab
        : Math.min(lastTab, TABS.length - 1),
  );
  const setTab = (i: number) => {
    lastTab = i;
    pickTab(i);
  };
  // La pestaña del jardín va la última, solo con el patio trasero pagado.
  const garden = w.gardenOpen && tab === TABS.length;
  const items = useMemo(
    () =>
      laxly(() =>
        (TABS[tab]?.rooms ?? []).map((t) => {
          // Las únicas que ya están se amplían desde aquí (a los lados y, el salón, hacia arriba).
          const list = targetsFor(w.view, { kind: 'build', type: t });
          const grow = !!ROOMS[t].unique && b.rooms.some((r) => r.type === t);
          const cost = grow && list.length ? Math.min(...list.map((x) => x.cost)) : ROOM_COST[t][1];
          return {
            t,
            spots: list.length,
            grow,
            cost,
            why: list.length ? '' : whyNoSpot(w.view, t),
          };
        }),
      ),
    [w.view, tab],
  );
  const stairs = useMemo(() => laxly(() => targetsFor(w.view, { kind: 'stair' })).length, [w.view]);
  const n = w.steps.length;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [n]);
  return (
    <div class="worksbar ribbon" role="toolbar" aria-label={t('barra.worksbar.modo_obras')}>
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
        {w.gardenOpen && (
          <button
            role="tab"
            aria-selected={garden}
            class={`ribbon-tab ${garden ? 'is-on' : ''}`}
            onClick={() => setTab(TABS.length)}
          >
            <Icon name="arbol" size={14} />
            {t('barra.worksbar.jardin')}
          </button>
        )}
      </div>
      <div class="ribbon-rooms">
        {garden &&
          GARDEN_TILES.map(([k, name, icon]) => (
            <button
              key={k}
              class={`ribbon-room ${w.pick?.kind === 'garden' && w.pick.piece === k ? 'is-on' : ''}`}
              data-help={
                k === 'claustro'
                  ? t('barra.worksbar.soportales_con_arcos_pegados')
                  : t('barra.worksbar.toca_un_trozo_del')
              }
              aria-label={t('barra.worksbar.gratis', { nombre: name })}
              onClick={() => {
                lastTab = TABS.length;
                w.startPick({ kind: 'garden', piece: k });
              }}
            >
              <Icon name={icon} size={20} />
              <b>{name}</b>
              <span>{t('barra.worksbar.gratis_2')}</span>
            </button>
          ))}
        {items.map(({ t: type, spots, grow, cost, why }) => (
          <button
            key={type}
            class={`ribbon-room ${spots ? '' : 'is-off'}`}
            aria-disabled={!spots}
            data-help={ROOMS[type].desc}
            aria-label={`${grow ? t('barra.worksbar.ampliar') : t('barra.worksbar.construir')} ${ROOMS[type].name} por ${cost} monedas`}
            onClick={() => {
              // Sin sitio, se dice por qué (el rango, falta excavar…).
              if (!spots) {
                w.toast(why);
                audio.play('deselect');
              } else w.startPick({ kind: 'build', type });
            }}
          >
            <Icon name={ICON[type]} size={20} />
            <b>
              {grow
                ? t('barra.worksbar.ampliar_sala', { sala: ROOMS[type].name.toLowerCase() })
                : ROOMS[type].name}
            </b>
            <span>
              <Icon name="coin" size={9} /> {cost}
            </span>
          </button>
        ))}
        {tab === TABS.length - 1 && (
          <button
            class="ribbon-room"
            disabled={!stairs}
            data-help={t('barra.worksbar.un_tramo_une_una')}
            aria-label={t('barra.worksbar.tramo_de_escalera_por', { stair_cost: stairCost(b) })}
            onClick={() => w.startPick({ kind: 'stair' })}
          >
            <Icon name="escalera" size={20} />
            <b>{t('barra.worksbar.escalera')}</b>
            <span>
              <Icon name="coin" size={9} /> {stairCost(b)}
            </span>
          </button>
        )}
      </div>
      <span class="worksbar-text ribbon-text">
        {n ? (
          <>
            {t('barra.worksbar.obras_apuntadas', { n })}
            {w.planCost < 0 && (
              <>
                {' '}
                {t('barra.worksbar.recuperas')} <Icon name="coin" size={10} /> {-w.planCost}
              </>
            )}
          </>
        ) : (
          t('barra.worksbar.elige_una_sala_abajo')
        )}
        {w.issue && (
          <span class="worksbar-issue">
            {w.issue}
            {w.issue.startsWith(NO_GOLD) && <> {t('barra.worksbar.guardalo_para_luego_con')}</>}
          </span>
        )}
      </span>
      <div class="ribbon-foot">
        <button
          class="btn-icon"
          aria-label={t('barra.worksbar.lista_de_salas')}
          {...help(t('barra.worksbar.lista_de_salas_todas'))}
          onClick={onMore}
        >
          <Icon name="lista" size={16} />
        </button>
        <button
          class="btn-icon"
          aria-label={t('barra.worksbar.deshacer_la_ultima_obra')}
          {...help(t('barra.worksbar.deshacer_la_ultima_obra_2'))}
          disabled={!n}
          onClick={w.undo}
        >
          <Icon name="deshacer" size={16} />
        </button>
        <button
          class="btn btn-gold ribbon-pay"
          data-tut="pagar"
          disabled={!n || !!w.issue}
          title={w.issue ?? undefined}
          aria-label={
            w.planCost >= 0
              ? t('barra.worksbar.pagar_las_obras_monedas', { plan_cost: w.planCost })
              : t('barra.worksbar.pagar_las_obras_recuperas', { oro: -w.planCost })
          }
          onClick={w.pay}
        >
          <Icon name="coin" size={14} />{' '}
          {n
            ? t('barra.worksbar.pagar_oro', { oro: Math.abs(w.planCost) })
            : t('barra.worksbar.pagar')}
        </button>
        {leaving && (
          <button
            class="btn btn-wood ribbon-keep"
            aria-label={t('barra.worksbar.guardar_el_borrador_para')}
            {...help(t('barra.worksbar.guarda_lo_apuntado_sin'))}
            onClick={w.keep}
          >
            {t('barra.worksbar.guardar')}
          </button>
        )}
        <button
          class={`btn ${leaving ? 'btn-red' : 'btn-wood'} ribbon-exit`}
          aria-label={
            leaving
              ? t('barra.worksbar.descartar_las_obras_y')
              : t('barra.worksbar.salir_del_modo_obras')
          }
          onClick={() => {
            // Con obras apuntadas, el primer toque pregunta (guardar o descartar).
            if (!n || leaving) w.discard();
            else setLeaving(true);
          }}
        >
          {leaving ? t('barra.worksbar.descartar') : <Icon name="close" size={14} />}
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
          {t('barra.worksbar.volver')}
        </button>
      </div>
    );
  return <Ribbon works={w} onMore={onMore} />;
}
