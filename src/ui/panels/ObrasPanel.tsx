import { useMemo } from 'preact/hooks';
import {
  DIG_COST,
  MAX_COLS,
  PLOT_COST,
  ROOM_COST,
  START_COLS,
  STAIR_COST,
  roomMax,
} from '../../core/balance';
import { canWork, type Action } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import { LOCKED, worksOpen } from '../../core/rooms';
import { ROOMS, type RoomType } from '../../data/rooms';
import { targetsFor, type Pick } from '../../world/rooms/works';
import { Icon } from '../icons';

interface Props {
  game: GameState;
  planning: boolean;
  onPick: (p: Pick) => void;
  onWork: (a: Action) => void;
  onRoom: (id: string) => void;
  onPlan: () => void;
}

const FLOOR_NAME = (f: number) =>
  f === 0 ? 'Planta baja' : f > 0 ? `Planta ${f}` : f === -1 ? 'Sótano' : `Sótano ${-f}`;

/** Estado corto de una sala para la lista. */
function stateOf(r: Room): string {
  if (r.works)
    return r.works.kind === 'build'
      ? 'en obras'
      : r.works.kind === 'move'
        ? 'mudándose'
        : 'ampliándose';
  if (r.level === 0) return r.type === 'torre' ? 'sin levantar' : 'rota';
  return `nivel ${r.level}`;
}

/**
 * Las obras del gremio: construir salas nuevas, ganar sitio (excavar, solares, escaleras),
 * planear una reforma y la lista de salas por planta.
 */
export function ObrasPanel({ game, planning, onPick, onWork, onRoom, onPlan }: Props) {
  const open = worksOpen(game);
  const b = game.building;
  // Qué salas se pueden construir y en cuántos sitios.
  const menu = useMemo(() => {
    if (!open) return [];
    return (Object.keys(ROOMS) as RoomType[])
      .filter((t) => !(ROOMS[t].unique && b.rooms.some((r) => r.type === t)))
      .map((t) => ({ t, spots: targetsFor(game, { kind: 'build', type: t }).length }));
  }, [game, open]);
  const digs = useMemo(() => (open ? targetsFor(game, { kind: 'dig' }) : []), [game, open]);
  const stairs = useMemo(() => (open ? targetsFor(game, { kind: 'stair' }) : []), [game, open]);
  const plotWhy = canWork(game, { type: 'buyPlot' });
  const floors = [...new Set(b.rooms.map((r) => r.floor))].sort((x, y) => y - x);

  return (
    <>
      {!open && <p class="panel-note">{LOCKED} Toca una sala para verla.</p>}
      {open && !planning && (
        <button class="card-paper libro-link" onClick={onPlan}>
          <b>Planear una reforma</b>
          <span class="muted">
            Prueba las obras sin pagar, mira lo que cuesta todo y paga al final.
          </span>
        </button>
      )}

      <section>
        <h3 class="sec-title">Salas</h3>
        <div class="list">
          {floors.map((f) => (
            <div key={f} class="obras-floor">
              <span class="tiny">{FLOOR_NAME(f)}</span>
              <div class="obras-rooms">
                {b.rooms
                  .filter((r) => r.floor === f)
                  .sort((x, y) => x.col - y.col)
                  .map((r) => (
                    <button
                      key={r.id}
                      class={`card-paper obras-room ${r.level === 0 || r.works ? 'is-off' : ''}`}
                      onClick={() => onRoom(r.id)}
                    >
                      <b>{ROOMS[r.type].name}</b>
                      <span class="pips" aria-hidden="true">
                        {Array.from({ length: roomMax(r.type) }, (_, i) => (
                          <i key={i} class={i < r.level ? 'on' : ''} />
                        ))}
                      </span>
                      <span class="muted">{stateOf(r)}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {open && (
        <section>
          <h3 class="sec-title">Construir</h3>
          <div class="obras-build">
            {menu.map(({ t, spots }) => {
              const cost = ROOM_COST[t][1]!;
              const why = spots
                ? undefined
                : game.gold < cost
                  ? `Te faltan ${cost - game.gold} monedas.`
                  : 'No queda sitio.';
              return (
                <button
                  key={t}
                  class="card-paper obras-room"
                  aria-label={`Construir ${ROOMS[t].name} por ${cost} monedas`}
                  data-help={ROOMS[t].desc}
                  disabled={!spots}
                  title={why}
                  onClick={() => onPick({ kind: 'build', type: t })}
                >
                  <b>{ROOMS[t].name}</b>
                  <span class="muted">{why ?? ROOMS[t].desc}</span>
                  <span class="obras-cost">
                    <Icon name="coin" size={10} /> {cost}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {open && (
        <section>
          <h3 class="sec-title">Más sitio</h3>
          <div class="list">
            <article class="card-paper facility">
              <div class="facility-info">
                <b>Excavar</b>
                <span class="muted">
                  Un hueco más en el sótano, junto a la escalera o a otro excavado. Cuanto más
                  hondo, más caro.
                </span>
              </div>
              <button
                class="btn btn-gold"
                aria-label="Excavar"
                disabled={!digs.length}
                title={digs.length ? undefined : 'No queda nada que excavar a tu alcance.'}
                onClick={() => onPick({ kind: 'dig' })}
              >
                <Icon name="coin" size={12} />{' '}
                {digs.length ? Math.min(...digs.map((d) => d.cost)) : DIG_COST[1]}
              </button>
            </article>
            <article class="card-paper facility">
              <div class="facility-info">
                <b>Comprar solar</b>
                <span class="muted">
                  {b.cols >= MAX_COLS
                    ? 'Ya no quedan solares a la venta.'
                    : 'El solar de la derecha: un hueco más de ancho en todas las plantas.'}
                </span>
              </div>
              {b.cols < MAX_COLS && (
                <button
                  class="btn btn-gold"
                  aria-label={`Comprar solar por ${PLOT_COST[b.cols - START_COLS]} monedas`}
                  disabled={!!plotWhy}
                  title={plotWhy ?? undefined}
                  onClick={() => onWork({ type: 'buyPlot' })}
                >
                  <Icon name="coin" size={12} /> {PLOT_COST[b.cols - START_COLS]}
                </button>
              )}
            </article>
            <article class="card-paper facility">
              <div class="facility-info">
                <b>Otra escalera</b>
                <span class="muted">
                  {b.stairs.length >= 2
                    ? 'Ya tienes dos escaleras.'
                    : 'Caminos más cortos entre plantas. Va de lo más hondo a lo más alto.'}
                </span>
              </div>
              {b.stairs.length < 2 && (
                <button
                  class="btn btn-gold"
                  aria-label={`Poner otra escalera por ${STAIR_COST} monedas`}
                  disabled={!stairs.length}
                  title={stairs.length ? undefined : 'No cabe en ningún sitio sin cortar una sala.'}
                  onClick={() => onPick({ kind: 'stair' })}
                >
                  <Icon name="coin" size={12} /> {STAIR_COST}
                </button>
              )}
            </article>
          </div>
        </section>
      )}
    </>
  );
}
