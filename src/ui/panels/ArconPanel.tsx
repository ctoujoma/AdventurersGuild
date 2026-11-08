import { useState } from 'preact/hooks';
import { trophyIcon } from '../../art/items';
import { TROPHY_APPEAL, TROPHY_SLOTS } from '../../core/balance';
import type { GameState, Hero, Item } from '../../core/model';
import { itemName } from '../../data/items';
import { MatShelf } from '../mats';
import { ItemGrid, itemScore, type GridEntry } from '../ItemGrid';
import { CLASS_NAMES } from '../../data/labels';
import { skill, type SkillId } from '../../core/party';
import { BufferImage } from '../BufferImage';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { Tabs } from '../Tabs';
import { lookOf, marksOf, memberOf, heroFrame } from '../view';
import { SLOTS, SLOT_NAMES, slotOf, type Slot } from '../../core/gear';

export type ArconTab = 'equipo' | 'tesoros' | 'trofeos';

interface Props {
  game: GameState;
  tab: ArconTab;
  onTab: (t: ArconTab) => void;
  onEquip: (heroId: string, itemId: string) => void;
  onUnequip: (heroId: string, slot: Slot) => void;
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

type Filter = 'todo' | Slot;
const FILTERS: [Filter, string][] = [
  ['todo', 'Todo'],
  ['arma', 'Arma'],
  ['cuerpo', 'Cuerpo'],
  ['complemento', 'Complemento'],
];

/** A quién se da un objeto: los retratos de los de casa, con lo que gana cada uno. */
function GivePicks({
  game,
  it,
  takers,
  onGive,
}: {
  game: GameState;
  it: Item;
  takers: Hero[];
  onGive: (heroId: string) => void;
}) {
  return (
    <div class="picks arcon-picks" role="group" aria-label={`¿A quién le das ${itemName(it)}?`}>
      {takers.map((h) => {
        const slot = slotOf(it) ?? 'arma';
        const was = h.worn?.[slot];
        // Cómo le queda lo que mejora el objeto: de su cifra de ahora a la nueva.
        const gains = (Object.keys(it.bonus ?? {}) as SkillId[]).map((k) => {
          const now = skill(memberOf(h, game.fac), k);
          const then = skill(memberOf({ ...h, worn: { ...h.worn, [slot]: it } }, game.fac), k);
          return { k, now, then };
        });
        return (
          <button
            key={h.id}
            class="pick"
            aria-label={[
              `Dárselo a ${h.name}`,
              `${CLASS_NAMES[h.cls][h.sex]} de nivel ${h.lvl}`,
              was ? `cambia ${itemName(was)}` : `${SLOT_NAMES[slot].toLowerCase()} libre`,
              ...gains.map((g) => `${g.k} de ${g.now} a ${g.then}`),
            ].join('. ')}
            onClick={() => onGive(h.id)}
          >
            <Portrait
              look={lookOf(h)}
              marks={marksOf(h)}
              frame={heroFrame(h)}
              scale={1}
              alive={false}
            />
            <span class="pick-name" aria-hidden="true">
              {h.name.split(' ')[0]}
            </span>
            <span class="pick-skills" aria-hidden="true">
              <span>
                {CLASS_NAMES[h.cls][h.sex]} · {h.lvl}
              </span>
              {gains.map((g) => (
                <span key={g.k} class={g.then > g.now ? 'up' : ''}>
                  {g.k.slice(0, 3)} {g.now} → {g.then}
                </span>
              ))}
              <span class="pick-gear">
                {was ? `cambia ${itemName(was)}` : `${SLOT_NAMES[slot].toLowerCase()} libre`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * El arcón del gremio: el estante de materiales, el equipo en rejilla (el del tablero de la
 * bodega y el que llevan puesto, con filtro por ranura), los tesoros para vender y los trofeos de
 * la pared de la sala.
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
  const worn = game.heroes
    .filter((h) => h.status !== 'muerto')
    .flatMap((h) =>
      SLOTS.flatMap((slot) => (h.worn?.[slot] ? [{ h, slot, it: h.worn[slot]! }] : [])),
    );
  const takers = game.heroes.filter(inGuild);
  const [giving, setGiving] = useState(false);
  const [filter, setFilter] = useState<Filter>('todo');
  const [sel, setSel] = useState<string | null>(null);
  const fits = (it: Item) => filter === 'todo' || slotOf(it) === filter;
  // El arcón y lo puesto juntos, lo mejor primero; lo puesto lleva la inicial de quien lo lleva.
  const all: (GridEntry & { heroId?: string; slot?: Slot; canTake?: boolean })[] = [
    ...stock.map((it) => ({ it, key: `a:${it.id}` })),
    ...worn.map(({ h, slot, it }) => ({
      it,
      key: `p:${h.id}:${slot}`,
      who: h.name,
      heroId: h.id,
      slot,
      canTake: inGuild(h),
    })),
  ];
  const entries = all.filter((e) => fits(e.it)).sort((a, b) => itemScore(b.it) - itemScore(a.it));
  const chosen = entries.find((e) => e.key === sel);

  return (
    <>
      <MatShelf game={game} />
      <Tabs
        label="Arcón"
        value={tab}
        onChange={onTab}
        tabs={[
          { id: 'equipo', label: 'Equipo', icon: 'espadas', count: stock.length + worn.length },
          { id: 'tesoros', label: 'Tesoros', icon: 'cofre', count: treasures.length },
          {
            id: 'trofeos',
            label: 'Trofeos',
            icon: 'trofeo',
            count: game.trophies.length,
            help: `Caben ${TROPHY_SLOTS} en la pared del salón; cada uno expuesto suma ${TROPHY_APPEAL} de Atractivo y trae más visitantes.`,
          },
        ]}
      />

      {tab === 'equipo' && (
        <>
          <Tabs
            label="Filtrar por ranura"
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setSel(null);
            }}
            tabs={FILTERS.map(([id, label]) => ({ id, label }))}
          />
          <span class="row-sub item-count">
            {entries.length} {entries.length === 1 ? 'objeto' : 'objetos'}
            {worn.length ? ` · ${worn.length} ${worn.length === 1 ? 'puesto' : 'puestos'}` : ''} ·
            lo mejor primero
          </span>
          {!entries.length && (
            <p class="panel-note">
              {filter === 'todo'
                ? 'Vacío. Los encargos con «+ objeto» traen equipo, y los talleres lo hacen.'
                : 'Nada de esta ranura.'}
            </p>
          )}
          <ItemGrid
            label="Equipo"
            entries={entries}
            selected={sel}
            onPick={(k) => {
              setSel(k);
              setGiving(false);
            }}
          />
          <p class="row-sub item-hint">Toca para elegir · mantén pulsado para verlo</p>
          {chosen && (
            <div class="item-bar">
              {giving && !chosen.who && (
                <GivePicks
                  game={game}
                  it={chosen.it}
                  takers={takers}
                  onGive={(h) => {
                    onEquip(h, chosen.it.id);
                    setGiving(false);
                    setSel(null);
                  }}
                />
              )}
              <div class="item-bar-row">
                <b class="item-bar-name">{itemName(chosen.it)}</b>
                {chosen.who ? (
                  <>
                    <button class="btn btn-wood" onClick={() => onHero(chosen.heroId!)}>
                      <Icon name="heroe" size={12} /> {chosen.who.split(' ')[0]}
                    </button>
                    {chosen.canTake && (
                      <button
                        class="btn btn-wood"
                        onClick={() => {
                          onUnequip(chosen.heroId!, chosen.slot!);
                          setSel(null);
                        }}
                      >
                        Quitar
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      class={`btn ${giving ? 'btn-gold' : 'btn-wood'}`}
                      disabled={!takers.length}
                      aria-expanded={giving}
                      onClick={() => setGiving(!giving)}
                    >
                      <Icon name="heroe" size={12} /> Dar
                    </button>
                    <Sell
                      name={itemName(chosen.it)}
                      value={chosen.it.value}
                      onSell={() => {
                        onSell(chosen.it.id);
                        setSel(null);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          )}
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
                  <b>{itemName(it)}</b>
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
