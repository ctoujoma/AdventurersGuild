import { useMemo, useState } from 'preact/hooks';
import { customOf } from '../../core/game';
import { appeal } from '../../core/salon';
import type { Custom, GameState } from '../../core/model';
import {
  CREST_COLORS,
  CREST_SYMBOLS,
  DECOR,
  FACADE,
  DOG_PRICE,
  FEAST_PRICE,
  RAVEN_PRICE,
  decorSlots,
  isFeastDay,
  type CrestColor,
  type DecorId,
  type FacadeId,
  type CrestSymbol,
} from '../../data/custom';
import { crestBoard } from '../../world/props';
import { BufferImage } from '../BufferImage';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Tabs } from '../Tabs';

interface Props {
  game: GameState;
  onCustom: (patch: Partial<Pick<Custom, 'name' | 'color' | 'symbol'>>) => void;
  onDog: () => void;
  onDecor: (id: DecorId, on: boolean) => void;
  onFacade: (id: FacadeId) => void;
  onRaven: () => void;
  onFeast: () => void;
}

type AdornoTab = 'letrero' | 'salon' | 'fachada' | 'animales';

/** Precio en un botón dorado: moneda y cifra. */
function Buy({
  price,
  gold,
  label,
  onBuy,
  disabled,
}: {
  price: number;
  gold: number;
  label: string;
  onBuy: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      class="btn btn-gold"
      aria-label={`${label} por ${price} monedas`}
      disabled={disabled || gold < price}
      onClick={onBuy}
    >
      <Icon name="coin" size={12} /> {price}
    </button>
  );
}

/**
 * Adornos de la taberna, en cuatro pestañas: el letrero (nombre y escudo), el salón (la fiesta
 * y la decoración), la fachada y los animales. Cada adorno es una baldosa con su precio; lo que
 * hace, manteniendo pulsado. El personal está con los héroes, en «Trabajo».
 */
export function TabernaPanel({
  game,
  onCustom,
  onDog,
  onDecor,
  onFacade,
  onRaven,
  onFeast,
}: Props) {
  const c = customOf(game);
  const decor = c.decor ?? [];
  const facade = c.facade ?? [];
  const slots = decorSlots(game.fac.tab);
  const feastToday = isFeastDay(game.day);
  const nextFeast = Math.ceil((game.day + 1) / 10) * 10;
  const [tab, setTab] = useState<AdornoTab>(
    feastToday && c.feast !== game.day ? 'salon' : 'letrero',
  );
  const [name, setName] = useState(c.name);
  const col = CREST_COLORS[c.color];
  const board = useMemo(() => crestBoard(col.field, col.dark, c.symbol), [c.color, c.symbol]);
  const commit = () => {
    if (name.trim() !== c.name) onCustom({ name });
  };

  return (
    <>
      <Tabs
        label="Adornos"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'letrero', label: 'Letrero' },
          {
            id: 'salon',
            label: 'Salón',
            alert: feastToday && c.feast !== game.day ? 1 : 0,
            help: 'Decoración del salón: un hueco más por cada nivel del salón. Y la fiesta de la comarca, cada 10 días.',
          },
          {
            id: 'fachada',
            label: 'Fachada',
            help: `La fachada da Atractivo (ahora ${appeal(game)}): trae más visitantes.`,
          },
          { id: 'animales', label: 'Animales' },
        ]}
      />

      {tab === 'letrero' && (
        <>
          <div class="tav-crest">
            <BufferImage buf={board} scale={4} label={`Letrero de ${c.name}`} />
            <label class="tav-name">
              <span class="row-sub">Nombre de la taberna</span>
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
          <div class="tav-swatches" role="radiogroup" aria-label="Color del escudo">
            {(Object.keys(CREST_COLORS) as CrestColor[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={c.color === k}
                aria-label={CREST_COLORS[k].name}
                class={`tav-swatch ${c.color === k ? 'on' : ''}`}
                style={{ background: CREST_COLORS[k].field }}
                title={CREST_COLORS[k].name}
                onClick={() => onCustom({ color: k })}
              />
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
        </>
      )}

      {tab === 'salon' && (
        <>
          <article
            class={`row ${feastToday ? 'tav-feast' : ''}`}
            {...help(
              'Cada 10 días el pueblo sale a la calle. Si la montas en la taberna, esa noche la caja se dobla y los que descansan ganan 10 de moral.',
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
                <Buy
                  price={FEAST_PRICE}
                  gold={game.gold}
                  label="Montar la fiesta"
                  onBuy={onFeast}
                />
              ))}
          </article>
          <h3 class="sec-title">
            Decoración{' '}
            <span class="row-sub">
              {decor.length}/{slots} huecos
            </span>
          </h3>
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
      )}

      {tab === 'fachada' && (
        <div class="adornos">
          {(Object.keys(FACADE) as FacadeId[]).map((k) => {
            const f = FACADE[k];
            const on = facade.includes(k);
            return (
              <article key={k} class={`adorno ${on ? 'on' : ''}`} {...help(f.desc)}>
                <b>{f.name}</b>
                <span class="row-sub">+{f.appeal} Atractivo</span>
                {on ? (
                  <span class="pill pill-ok">Puesto</span>
                ) : (
                  <Buy
                    price={f.price}
                    gold={game.gold}
                    label={`Poner ${f.name}`}
                    onBuy={() => onFacade(k)}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'animales' && (
        <div class="adornos">
          <article
            class={`adorno ${c.dog ? 'on' : ''}`}
            {...help(
              `${c.dog ? 'Duerme junto a la puerta y gruñe a quien no conoce.' : 'Ladra a los forasteros y no le teme a nada.'} Si asaltan la taberna, ladra y despierta a todos antes. Y más probabilidad de chivatazo.`,
            )}
          >
            <b>{c.dog ? 'Tizón, el perro' : 'Perro guardián'}</b>
            <span class="row-sub">Avisa de los asaltos</span>
            {c.dog ? (
              <span class="pill pill-ok">En casa</span>
            ) : (
              <Buy price={DOG_PRICE} gold={game.gold} label="Comprar el perro" onBuy={onDog} />
            )}
          </article>
          <article
            class={`adorno ${c.raven ? 'on' : ''}`}
            {...help(
              c.raven
                ? 'Vigila desde el letrero y vuela a otros pueblos con noticias del gremio.'
                : 'Lleva la fama del gremio a otros pueblos.',
            )}
          >
            <b>{c.raven ? 'Carbón, el cuervo' : 'Cuervo mensajero'}</b>
            <span class="row-sub">+1 de reputación cada 5 días</span>
            {c.raven ? (
              <span class="pill pill-ok">En casa</span>
            ) : (
              <Buy price={RAVEN_PRICE} gold={game.gold} label="Comprar el cuervo" onBuy={onRaven} />
            )}
          </article>
        </div>
      )}
    </>
  );
}
