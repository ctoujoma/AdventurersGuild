import { useMemo, useState } from 'preact/hooks';
import { customOf } from '../../core/game';
import type { Custom, GameState } from '../../core/model';
import {
  CREST_COLORS,
  CREST_SYMBOLS,
  DISHES,
  DOG_PRICE,
  STAFF,
  type CrestColor,
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
}

/** Tu taberna: nombre, escudo del letrero, plato de la casa, personal y perro guardián. */
export function TabernaPanel({ game, onCustom, onStaff, onDog }: Props) {
  const c = customOf(game);
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
    </>
  );
}
