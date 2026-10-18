import { useMemo, useState } from 'preact/hooks';
import { customOf } from '../../core/game';
import type { Custom, GameState } from '../../core/model';
import {
  CREST_COLORS,
  CREST_SYMBOLS,
  DECOR,
  DISHES,
  DOG_PRICE,
  FEAST_PRICE,
  RAVEN_PRICE,
  STAFF,
  decorSlots,
  isFeastDay,
  type CrestColor,
  type DecorId,
  type CrestSymbol,
  type Dish,
  type StaffId,
} from '../../data/custom';
import { crestBoard } from '../../world/props';
import { BufferImage } from '../BufferImage';

interface Props {
  game: GameState;
  onCustom: (patch: Partial<Pick<Custom, 'name' | 'color' | 'symbol' | 'dish'>>) => void;
  onStaff: (id: StaffId, on: boolean) => void;
  onDog: () => void;
  onDecor: (id: DecorId, on: boolean) => void;
  onRaven: () => void;
  onFeast: () => void;
}

/**
 * Tu taberna: nombre y escudo del letrero, la fiesta de la comarca, la decoración del salón,
 * el plato de la casa, el personal y los animales.
 */
export function TabernaPanel({ game, onCustom, onStaff, onDog, onDecor, onRaven, onFeast }: Props) {
  const c = customOf(game);
  const decor = c.decor ?? [];
  const slots = decorSlots(game.fac.tab);
  const feastToday = isFeastDay(game.day);
  const nextFeast = Math.ceil((game.day + 1) / 10) * 10;
  const [name, setName] = useState(c.name);
  const col = CREST_COLORS[c.color];
  const board = useMemo(() => crestBoard(col.field, col.dark, c.symbol), [c.color, c.symbol]);
  const commit = () => {
    if (name.trim() !== c.name) onCustom({ name });
  };

  return (
    <>
      <div class="card-paper tav-crest">
        <BufferImage buf={board} scale={4} label={`Letrero de ${c.name}`} />
        <label class="tav-name">
          <span class="muted">Nombre de la taberna</span>
          <input
            type="text"
            maxLength={24}
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      </div>

      <section>
        <h3 class="sec-title">Escudo</h3>
        <div class="tav-swatches" role="radiogroup" aria-label="Color del escudo">
          {(Object.keys(CREST_COLORS) as CrestColor[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={c.color === k}
              class={`tav-swatch ${c.color === k ? 'on' : ''}`}
              style={{ background: CREST_COLORS[k].field }}
              title={CREST_COLORS[k].name}
              onClick={() => onCustom({ color: k })}
            >
              <span>{CREST_COLORS[k].name}</span>
            </button>
          ))}
        </div>
        <div class="tav-symbols" role="radiogroup" aria-label="Símbolo del escudo">
          {(Object.keys(CREST_SYMBOLS) as CrestSymbol[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={c.symbol === k}
              class={`btn ${c.symbol === k ? 'btn-gold' : 'btn-wood'}`}
              onClick={() => onCustom({ symbol: k })}
            >
              {CREST_SYMBOLS[k]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 class="sec-title">Fiesta de la comarca</h3>
        <article class={`card-paper facility ${feastToday ? 'tav-feast' : ''}`}>
          <div class="facility-info">
            <b>{feastToday ? '¡Hoy es la fiesta!' : `Próxima fiesta: día ${nextFeast}`}</b>
            <span class="muted">
              Cada 10 días el pueblo sale a la calle. Si la montas en la taberna, esa noche la caja
              se dobla y los que descansan ganan 10 de moral.
            </span>
          </div>
          {feastToday &&
            (c.feast === game.day ? (
              <span class="pill pill-ok">Montada</span>
            ) : (
              <button class="btn btn-gold" disabled={game.gold < FEAST_PRICE} onClick={onFeast}>
                Montarla · {FEAST_PRICE}
              </button>
            ))}
        </article>
      </section>

      <section>
        <h3 class="sec-title">
          Decoración del salón{' '}
          <span class="muted">
            ({decor.length}/{slots} huecos{slots < 3 ? '; uno más con el salón grande' : ''})
          </span>
        </h3>
        <div class="list">
          {(Object.keys(DECOR) as DecorId[]).map((k) => {
            const d = DECOR[k];
            const on = decor.includes(k);
            return (
              <article key={k} class="card-paper facility">
                <div class="facility-info">
                  <b>{d.name}</b>
                  <span class="muted">{d.desc}</span>
                  <span class="tiny">
                    {on ? 'En el salón (quitarla no devuelve el dinero)' : `${d.price} monedas`}
                  </span>
                </div>
                {on ? (
                  <button class="btn btn-wood" onClick={() => onDecor(k, false)}>
                    Quitar
                  </button>
                ) : (
                  <button
                    class="btn btn-gold"
                    disabled={game.gold < d.price || decor.length >= slots}
                    onClick={() => onDecor(k, true)}
                  >
                    Poner
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h3 class="sec-title">Plato de la casa</h3>
        <div class="list" role="radiogroup" aria-label="Plato de la casa">
          {(Object.keys(DISHES) as Dish[]).map((k) => {
            const d = DISHES[k];
            return (
              <button
                key={k}
                role="radio"
                aria-checked={c.dish === k}
                class="card-paper tav-option"
                onClick={() => onCustom({ dish: k })}
              >
                <b>{d.name}</b>
                <span class="muted">{d.desc}</span>
                <span class="tiny">{d.cost ? `${d.cost} monedas cada noche` : 'Sin coste'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 class="sec-title">Personal</h3>
        <div class="list">
          {(Object.keys(STAFF) as StaffId[]).map((k) => {
            const p = STAFF[k];
            const on = c.staff.includes(k);
            return (
              <article key={k} class="card-paper facility">
                <div class="facility-info">
                  <b>{p.name}</b>
                  <span class="muted">{p.desc}</span>
                  <span class="tiny">
                    {on
                      ? `Trabaja aquí · ${p.salary} monedas de salario por semana`
                      : `Contratar: ${p.fee} monedas y ${p.salary} de salario por semana`}
                  </span>
                </div>
                {on ? (
                  <button class="btn btn-wood" onClick={() => onStaff(k, false)}>
                    Despedir
                  </button>
                ) : (
                  <button
                    class="btn btn-gold"
                    disabled={game.gold < p.fee}
                    onClick={() => onStaff(k, true)}
                  >
                    Contratar
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h3 class="sec-title">Perro guardián</h3>
        <article class="card-paper facility">
          <div class="facility-info">
            <b>{c.dog ? 'Tizón' : 'Un chucho del mercado'}</b>
            <span class="muted">
              {c.dog
                ? 'Duerme junto a la puerta y gruñe a quien no conoce.'
                : 'Ladra a los forasteros y no le teme a nada.'}
            </span>
            <span class="tiny">
              +3 de defensa y más probabilidad de chivatazo antes de un asalto.
            </span>
          </div>
          {!c.dog && (
            <button class="btn btn-gold" disabled={game.gold < DOG_PRICE} onClick={onDog}>
              {DOG_PRICE} monedas
            </button>
          )}
        </article>
      </section>

      <section>
        <h3 class="sec-title">Cuervo mensajero</h3>
        <article class="card-paper facility">
          <div class="facility-info">
            <b>{c.raven ? 'Carbón' : 'Un cuervo amaestrado'}</b>
            <span class="muted">
              {c.raven
                ? 'Vigila desde el letrero y vuela a otros pueblos con noticias del gremio.'
                : 'Lleva la fama del gremio a otros pueblos.'}
            </span>
            <span class="tiny">+1 de reputación cada 5 días.</span>
          </div>
          {!c.raven && (
            <button class="btn btn-gold" disabled={game.gold < RAVEN_PRICE} onClick={onRaven}>
              {RAVEN_PRICE} monedas
            </button>
          )}
        </article>
      </section>
    </>
  );
}
