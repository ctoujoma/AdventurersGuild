import { useState } from 'preact/hooks';
import { itemIcon, trophyIcon } from '../../art/items';
import { TROPHY_APPEAL, TROPHY_SLOTS } from '../../core/balance';
import type { GameState, Hero, Item } from '../../core/model';
import { RARITY_NAMES, itemEffect } from '../../data/items';
import { BufferImage } from '../BufferImage';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Tabs } from '../Tabs';

export type ArconTab = 'equipo' | 'tesoros' | 'trofeos';

interface Props {
  game: GameState;
  tab: ArconTab;
  onTab: (t: ArconTab) => void;
  onEquip: (heroId: string, itemId: string) => void;
  onUnequip: (heroId: string) => void;
  onSell: (itemId: string) => void;
  onSellTrophy: (id: string) => void;
  onHero: (id: string) => void;
}

const isGear = (i: Item) => !!i.kind && i.kind !== 'tesoro';
const inGuild = (h: Hero) => h.status === 'ok' || h.status === 'herido';

/** Botón de vender: moneda y precio. */
function Sell({ name, value, onSell }: { name: string; value: number; onSell: () => void }) {
  return (
    <button
      class="btn btn-wood"
      aria-label={`Vender ${name} por ${value} monedas`}
      onClick={onSell}
    >
      <Icon name="coin" size={12} /> {value}
    </button>
  );
}

/**
 * El arcón del gremio: el equipo (en el tablero de la bodega y el que llevan puesto), los
 * tesoros para vender y los trofeos de la pared de la sala. Una fila por cosa; su descripción,
 * manteniendo pulsado.
 */
export function ArconPanel({
  game,
  tab,
  onTab,
  onEquip,
  onUnequip,
  onSell,
  onSellTrophy,
  onHero,
}: Props) {
  const stock = game.inventory.filter(isGear);
  const treasures = game.inventory.filter((i) => !isGear(i));
  const worn = game.heroes.filter((h) => h.item && h.status !== 'muerto');
  const takers = game.heroes.filter(inGuild);
  const [giving, setGiving] = useState<string | null>(null);

  const gear = (it: Item) => (
    <span class={`row-info rarity-${it.rarity ?? 0}`} {...help(it.desc)}>
      <b>{it.name}</b>
      <span class="row-sub">
        <em>{RARITY_NAMES[it.rarity ?? 0]}</em> · {itemEffect(it)}
      </span>
    </span>
  );

  return (
    <>
      <Tabs
        label="Arcón"
        value={tab}
        onChange={onTab}
        tabs={[
          { id: 'equipo', label: 'Equipo', icon: 'espadas', count: stock.length + worn.length },
          { id: 'tesoros', label: 'Tesoros', icon: 'coin', count: treasures.length },
          {
            id: 'trofeos',
            label: 'Trofeos',
            icon: 'star',
            count: game.trophies.length,
            help: `Caben ${TROPHY_SLOTS} en la pared del salón; cada uno expuesto suma ${TROPHY_APPEAL} de Atractivo y trae más visitantes.`,
          },
        ]}
      />

      {tab === 'equipo' && (
        <>
          <h3 class="sec-title">En el tablero de la bodega</h3>
          {!stock.length && (
            <p class="panel-note">Vacío. Los encargos con «+ objeto» pueden traer equipo.</p>
          )}
          <div class="rows">
            {stock.map((it) => (
              <div key={it.id} class="row-group">
                <article class="row">
                  <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={2} />
                  {gear(it)}
                  <div class="row-actions">
                    <button
                      class={`btn ${giving === it.id ? 'btn-gold' : 'btn-wood'}`}
                      disabled={!takers.length}
                      aria-expanded={giving === it.id}
                      onClick={() => setGiving(giving === it.id ? null : it.id)}
                    >
                      <Icon name="heroe" size={12} /> Dar
                    </button>
                    <Sell name={it.name} value={it.value} onSell={() => onSell(it.id)} />
                  </div>
                </article>
                {giving === it.id && (
                  <div class="arcon-takers" role="group" aria-label={`¿A quién le das ${it.name}?`}>
                    {takers.map((h) => (
                      <button
                        key={h.id}
                        class="btn btn-wood"
                        onClick={() => {
                          onEquip(h.id, it.id);
                          setGiving(null);
                        }}
                      >
                        {h.name}
                        {h.item ? ' (cambia)' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <h3 class="sec-title">Lo llevan puesto</h3>
          {!worn.length && <p class="panel-note">Nadie lleva equipo todavía.</p>}
          <div class="rows">
            {worn.map((h) => (
              <article key={h.id} class="row">
                <BufferImage buf={itemIcon(h.item!.icon ?? 'espada', h.item!.rarity)} scale={2} />
                <span class="row-info" {...help(h.item!.desc)}>
                  <b>{h.item!.name}</b>
                  <button class="linklike row-sub" onClick={() => onHero(h.id)}>
                    {h.name}
                    {h.status === 'mision' ? ' (de misión)' : ''} · {itemEffect(h.item!)}
                  </button>
                </span>
                {inGuild(h) && (
                  <button class="btn btn-wood" onClick={() => onUnequip(h.id)}>
                    Quitar
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'tesoros' && (
        <>
          {!treasures.length && (
            <p class="panel-note">Vacío. Joyas, reliquias y demás cosas de valor acaban aquí.</p>
          )}
          <div class="rows">
            {treasures.map((it) => (
              <article key={it.id} class="row">
                <span class="row-info" {...help(it.desc)}>
                  <b>{it.name}</b>
                </span>
                <Sell name={it.name} value={it.value} onSell={() => onSell(it.id)} />
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'trofeos' && (
        <>
          {!game.trophies.length && (
            <p class="panel-note">
              Un éxito brillante en un encargo peligroso deja un trofeo para la pared del salón.
            </p>
          )}
          <div class="rows">
            {game.trophies.map((t, i) => (
              <article key={t.id} class="row">
                <BufferImage buf={trophyIcon(t.icon)} scale={2} />
                <span
                  class="row-info"
                  {...help(`${t.desc} Lo trajeron ${t.who} de ${t.place}, el día ${t.day}.`)}
                >
                  <b>{t.name}</b>
                  <span class="row-sub">
                    {i < TROPHY_SLOTS ? 'En la pared del salón' : 'Guardado: no queda pared'}
                  </span>
                </span>
                <Sell name={t.name} value={t.value} onSell={() => onSellTrophy(t.id)} />
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
