import { useState } from 'preact/hooks';
import { itemIcon, trophyIcon } from '../../art/items';
import { TROPHY_APPEAL, TROPHY_SLOTS } from '../../core/balance';
import type { GameState, Hero, Item } from '../../core/model';
import { RARITY_NAMES, itemEffect } from '../../data/items';
import { BufferImage } from '../BufferImage';

export type ArconTab = 'equipo' | 'tesoros' | 'trofeos';

interface Props {
  game: GameState;
  tab: ArconTab;
  onTab: (t: ArconTab) => void;
  /** Trofeo a resaltar (si se ha tocado uno en la pared). */
  focusTrophy?: string | null;
  onEquip: (heroId: string, itemId: string) => void;
  onUnequip: (heroId: string) => void;
  onSell: (itemId: string) => void;
  onSellTrophy: (id: string) => void;
  onHero: (id: string) => void;
}

const isGear = (i: Item) => !!i.kind && i.kind !== 'tesoro';
const inGuild = (h: Hero) => h.status === 'ok' || h.status === 'herido';

/**
 * El arcón del gremio: el equipo (en el tablero de la bodega y el que llevan puesto),
 * los tesoros para vender y los trofeos de la pared de la sala.
 */
export function ArconPanel({
  game,
  tab,
  onTab,
  focusTrophy,
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
  const TABS: [ArconTab, string, number][] = [
    ['equipo', 'Equipo', stock.length + worn.length],
    ['tesoros', 'Tesoros', treasures.length],
    ['trofeos', 'Trofeos', game.trophies.length],
  ];

  return (
    <>
      <div class="arcon-tabs" role="tablist" aria-label="Arcón">
        {TABS.map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            class={`btn ${tab === id ? 'btn-gold' : 'btn-wood'}`}
            onClick={() => onTab(id)}
          >
            {label} · {n}
          </button>
        ))}
      </div>

      {tab === 'equipo' && (
        <>
          <h3 class="sec-title">En el tablero de la bodega</h3>
          {!stock.length && (
            <p class="panel-note">
              No hay equipo libre. Los encargos marcados con «+ objeto» pueden traerlo.
            </p>
          )}
          <div class="list">
            {stock.map((it) => (
              <article key={it.id} class={`card-paper arcon-item rarity-${it.rarity ?? 0}`}>
                <div class="arcon-row">
                  <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={2} />
                  <div class="facility-info">
                    <b>{it.name}</b>
                    <span class="next-level">
                      {RARITY_NAMES[it.rarity ?? 0]} · {itemEffect(it)}
                    </span>
                    <span class="muted">{it.desc}</span>
                  </div>
                </div>
                {giving === it.id ? (
                  <div class="arcon-give">
                    <span class="tiny">¿A quién se lo das?</span>
                    <div class="arcon-takers">
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
                      <button class="btn btn-wood" onClick={() => setGiving(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="herocard-actions">
                    <button
                      class="btn btn-gold"
                      disabled={!takers.length}
                      onClick={() => setGiving(it.id)}
                    >
                      Dárselo a…
                    </button>
                    <button class="btn btn-wood" onClick={() => onSell(it.id)}>
                      Vender · {it.value}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <h3 class="sec-title">Lo que llevan puesto</h3>
          {!worn.length && <p class="panel-note">Nadie lleva equipo todavía.</p>}
          <div class="list">
            {worn.map((h) => (
              <article key={h.id} class={`card-paper arcon-item rarity-${h.item!.rarity ?? 0}`}>
                <div class="arcon-row">
                  <BufferImage buf={itemIcon(h.item!.icon ?? 'espada', h.item!.rarity)} scale={2} />
                  <div class="facility-info">
                    <b>{h.item!.name}</b>
                    <span class="next-level">{itemEffect(h.item!)}</span>
                    <button class="linklike" onClick={() => onHero(h.id)}>
                      Lo lleva {h.name}
                      {h.status === 'mision' ? ' (de misión)' : ''}
                    </button>
                  </div>
                </div>
                {inGuild(h) && (
                  <div class="herocard-actions">
                    <button class="btn btn-wood" onClick={() => onUnequip(h.id)}>
                      Devolver al tablero
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'tesoros' && (
        <>
          {!treasures.length && (
            <p class="panel-note">
              El arcón está vacío. Joyas, reliquias y demás cosas de valor acaban aquí para
              venderlas.
            </p>
          )}
          <div class="list">
            {treasures.map((it) => (
              <article key={it.id} class="card-paper facility">
                <div class="facility-info">
                  <b>{it.name}</b>
                  <span class="muted">{it.desc}</span>
                </div>
                <button class="btn btn-gold" onClick={() => onSell(it.id)}>
                  Vender · {it.value}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'trofeos' && (
        <>
          <p class="panel-note">
            {game.trophies.length
              ? `Caben ${TROPHY_SLOTS} en la pared del salón; cada uno expuesto suma ${TROPHY_APPEAL} de Atractivo y trae más visitantes.`
              : 'Un éxito brillante en un encargo peligroso deja un trofeo para la pared de la sala.'}
          </p>
          <div class="list">
            {game.trophies.map((t, i) => (
              <article
                key={t.id}
                class={`card-paper facility ${focusTrophy === t.id ? 'is-focus' : ''}`}
              >
                <BufferImage buf={trophyIcon(t.icon)} scale={2} />
                <div class="facility-info">
                  <b>{t.name}</b>
                  <span class="next-level">
                    {i < TROPHY_SLOTS ? 'En la pared de la sala' : 'Guardado: no queda pared'}
                  </span>
                  <span class="muted">
                    {t.desc} Lo trajeron {t.who} de {t.place}, el día {t.day}.
                  </span>
                </div>
                <button class="btn btn-wood" onClick={() => onSellTrophy(t.id)}>
                  Vender · {t.value}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
