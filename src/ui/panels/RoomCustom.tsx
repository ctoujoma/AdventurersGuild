import { useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { customOf, type Action } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import { paintState, paintStatus, paintingOf, roomTint } from '../../core/paint';
import {
  DECOR,
  FEAST_EVERY,
  FEAST_PRICE,
  TINTS,
  TINT_FROM,
  TINT_IDS,
  decorSlots,
  isFeastDay,
  type DecorId,
  type TintId,
} from '../../data/custom';
import { ROOMS } from '../../data/rooms';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Buy } from './TabernaPanel';

/** Lo que se le puede cambiar a una sala desde «Personalizar». */
export interface CustomProps {
  /** Encargar al pintor otro color (y cancelarlo). Sin él, solo se mira. */
  onAct?: (a: Action) => void;
  /** Modo prueba: cambiar el color de sus telas gratis y al momento (`null`: los de la casa). */
  onTint?: (room: string, tint: TintId | null) => void;
  /** Enseñar en la escena cómo quedaría la sala con un color, unos segundos. */
  onPreview?: (room: string, tint: TintId | null) => void;
  /** Poner o quitar un adorno del salón. */
  onDecor?: (id: DecorId, on: boolean) => void;
  /** Montar la fiesta de la comarca (el día que toca). */
  onFeast?: () => void;
}

/** Si la sala tiene telas que se pueden pintar ya (las que no tienen, o no a este nivel, no). */
const tintable = (room: Room, p: CustomProps) =>
  !room.works && room.level >= (TINT_FROM[room.type] ?? Infinity) && !!(p.onAct || p.onTint);

/** Si la sala tiene algo que personalizar: telas que pintar o, en el salón, adornos. */
export const canCustomize = (room: Room, p: CustomProps) =>
  tintable(room, p) || (room.type === 'salon' && !!p.onDecor);

/** El salón tiene algo que pedir hoy: es la fiesta y aún no está montada. */
export const feastPending = (game: GameState, room: Room) =>
  room.type === 'salon' && isFeastDay(game.day) && customOf(game).feast !== game.day;

/**
 * Los colores de las telas de la sala: se elige uno (los de la casa o un tema) y se encarga al
 * pintor del taller, que va andando y la pinta en unas horas. Cada color dice cómo está (candado,
 * sin dinero, sin taller, sin pintor, ocupado); el trabajo en marcha se ve y se puede cancelar.
 * `onTint` (gratis, al momento) solo llega en el modo prueba. Al tocar un color (se tenga o no),
 * la sala se ve unos segundos así en la escena (`onPreview`) y vuelve sola a la de verdad.
 */
function RoomTint({
  game,
  room,
  onAct,
  onTint,
  onPreview,
}: {
  game: GameState;
  room: Room;
  onAct?: (a: Action) => void;
  onTint?: (room: string, tint: TintId | null) => void;
  onPreview?: (room: string, tint: TintId | null) => void;
}) {
  const cur = roomTint(game, room.id);
  const job = paintingOf(game, room.id);
  const [pick, setPick] = useState<TintId | null>(job ? job.tint : cur);
  const [locked, setLocked] = useState<string | null>(null);
  const name = (id: TintId | null) => (id ? TINTS[id].name : 'De la casa');
  const swatch = (id: TintId | null, bg?: string) => {
    const st = paintStatus(game, room.id, id);
    const lock = st.state === 'lock';
    const text = lock ? `${name(id)}. ${st.why}` : name(id);
    return (
      <button
        key={id ?? 'casa'}
        role="radio"
        aria-checked={pick === id}
        aria-disabled={lock}
        aria-label={text}
        title={text}
        class={`tav-swatch room-swatch ${id ? '' : 'house'} ${pick === id ? 'on' : ''} ${lock ? 'locked' : ''} ${cur === id ? 'is-now' : ''}`}
        style={bg ? { background: bg } : undefined}
        onClick={() => {
          // Cómo quedaría: se ve unos segundos en la sala, aunque aún no se tenga.
          onPreview?.(room.id, id);
          // En el modo prueba se puede elegir igual, para probarlo gratis.
          setLocked(lock ? `${name(id)}: ${st.why}` : null);
          if (lock && !onTint) return;
          setPick(id);
        }}
      >
        {lock && <Icon name="candado" size={10} />}
      </button>
    );
  };
  const st = paintStatus(game, room.id, pick);
  // Sin taller o sin pintor, decirlo ya, aunque esté elegido el color de ahora.
  const gate = !job
    ? ([null, ...TINT_IDS] as (TintId | null)[])
        .filter((t) => t !== cur)
        .map((t) => paintStatus(game, room.id, t))
        .find((x) => x.state !== 'lock')
    : undefined;
  const blocked = gate && (gate.state === 'none' || gate.state === 'nobody') ? gate : null;
  const js = job ? paintState(game, job) : null;
  return (
    <div class="room-tint">
      <h4 class="qs-sub">Colores de las telas</h4>
      <span class="row-sub">Ahora: {name(cur)}</span>
      <div class="tav-swatches" role="radiogroup" aria-label="Colores de las telas">
        {swatch(null)}
        {TINT_IDS.map((id) => {
          const [, d, m, l] = TINTS[id].ramp;
          return swatch(id, `linear-gradient(${l} 0 30%, ${m} 30% 70%, ${d} 70%)`);
        })}
      </div>
      {onPreview && <small class="row-sub">Toca un color para ver cómo quedaría.</small>}
      {locked && <small class="lock-why">{locked}</small>}
      {job && js ? (
        <div class="paint-job" role="status">
          <span class="row-sub">
            Pintándola de {name(job.tint).toLowerCase()}:{' '}
            {js.walking
              ? 'el pintor va de camino.'
              : js.hoursLeft === null
                ? 'parado, el pintor no está en su taller.'
                : `acaba en ${Math.max(1, Math.ceil(js.hoursLeft))} h.`}
          </span>
          <span class="train-bar" aria-label={`${Math.round(js.frac * 100)} %`}>
            <i style={{ width: `${Math.round(js.frac * 100)}%` }} />
          </span>
          {onAct && (
            <button class="btn btn-wood" onClick={() => onAct({ type: 'cancelPaint', id: job.id })}>
              Cancelar · devuelve {job.gold}
            </button>
          )}
        </div>
      ) : st.state === 'ok' ? (
        <>
          <button
            class="btn btn-gold dress-go"
            disabled={!onAct}
            onClick={() => onAct?.({ type: 'paint', room: room.id, tint: pick })}
          >
            <Icon name="brocha" size={12} /> Pintar de {name(pick).toLowerCase()} · {st.cost}
          </button>
          <small class="lock-why">El pintor irá andando y la pintará en unas horas.</small>
        </>
      ) : st.state === 'same' ? (
        <small class="lock-why">
          {blocked && 'why' in blocked ? blocked.why : 'Ya es de este color. Elige otro.'}
        </small>
      ) : (
        <>
          <button class="btn btn-wood dress-go locked" disabled>
            <Icon name={st.state === 'lock' ? 'candado' : 'brocha'} size={12} /> Pintar · {st.cost}
          </button>
          <small class="lock-why">{st.why}</small>
        </>
      )}
      {onTint && cur !== pick && (
        <button class="btn btn-wood dress-go" onClick={() => onTint(room.id, pick)}>
          Probar gratis (modo prueba)
        </button>
      )}
    </div>
  );
}

/** Lo que se compra para el salón: la fiesta de la comarca y la decoración (con sus huecos). */
function SalonAdornos({
  game,
  onDecor,
  onFeast,
}: {
  game: GameState;
  onDecor: (id: DecorId, on: boolean) => void;
  onFeast?: () => void;
}) {
  const c = customOf(game);
  const decor = c.decor ?? [];
  const slots = decorSlots(game.fac.tab);
  const feastToday = isFeastDay(game.day);
  const nextFeast = Math.ceil((game.day + 1) / FEAST_EVERY) * FEAST_EVERY;
  return (
    <>
      <article
        class={`row ${feastToday ? 'tav-feast' : ''}`}
        {...help(
          `Cada ${FEAST_EVERY} días el pueblo sale a la calle. Si la montas en la taberna, esa noche la caja se dobla y los que descansan ganan 10 de moral.`,
        )}
      >
        <Icon name="banderin" size={22} />
        <span class="row-info">
          <b>{feastToday ? '¡Hoy es la fiesta!' : 'Fiesta de la comarca'}</b>
          <span class="row-sub">
            {feastToday ? 'La caja se dobla esta noche.' : `Día ${nextFeast}`}
          </span>
        </span>
        {feastToday &&
          (c.feast === game.day ? (
            <span class="pill pill-ok">Montada</span>
          ) : (
            onFeast && (
              <Buy price={FEAST_PRICE} gold={game.gold} label="Montar la fiesta" onBuy={onFeast} />
            )
          ))}
      </article>
      <h4 class="qs-sub">
        Decoración{' '}
        <span class="row-sub">
          {decor.length}/{slots} huecos · uno más por cada nivel del salón
        </span>
      </h4>
      <div class="adornos">
        {(Object.keys(DECOR) as DecorId[]).map((k) => {
          const d = DECOR[k];
          const on = decor.includes(k);
          return (
            <article
              key={k}
              class={`adorno ${on ? 'on' : ''}`}
              {...help(`${d.desc} ${on ? 'Quitarla no devuelve el dinero.' : ''}`.trim())}
            >
              <b>{d.name}</b>
              <span class="row-sub">+{d.appeal} Atractivo</span>
              {on ? (
                <button class="btn btn-wood" onClick={() => onDecor(k, false)}>
                  Quitar
                </button>
              ) : (
                <Buy
                  price={d.price}
                  gold={game.gold}
                  label={`Poner ${d.name}`}
                  disabled={decor.length >= slots}
                  onBuy={() => onDecor(k, true)}
                />
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

/**
 * La hoja «Personalizar» de una sala, encima de su ficha: los colores de sus telas y, en el
 * salón, los adornos que se compran. Solo aspecto (y el Atractivo de los adornos): lo que la sala
 * hace está en la ficha. Se abre sobre la escena, no dentro del panel.
 */
export function RoomCustom({
  game,
  room,
  onClose,
  ...p
}: CustomProps & { game: GameState; room: Room; onClose: () => void }) {
  const sheet = (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet room-custom"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Personalizar: ${ROOMS[room.type].name}`}
      >
        <button class="btn-icon herocard-x" data-tut="cerrar" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <header class="qs-head">
            <span class="eyebrow">Personalizar</span>
            <h3>{ROOMS[room.type].name}</h3>
          </header>
          {tintable(room, p) && (
            <RoomTint
              game={game}
              room={room}
              onAct={p.onAct}
              onTint={p.onTint}
              onPreview={p.onPreview}
            />
          )}
          {room.type === 'salon' && p.onDecor && (
            <SalonAdornos game={game} onDecor={p.onDecor} onFeast={p.onFeast} />
          )}
        </div>
      </article>
    </div>
  );
  const host = document.querySelector('.stage');
  return host ? createPortal(sheet, host) : sheet;
}
