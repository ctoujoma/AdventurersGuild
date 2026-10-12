import { DEBT, SCHEDULE, capacity, facilityMax } from '../../core/balance';
import { canUpgrade, nextPayment, salaries, upgradeCost } from '../../core/game';
import { defense, notoriety } from '../../core/raids';
import type { Facilities, GameState } from '../../core/model';
import { FACILITY_INFO } from '../../data/labels';
import { itemIcon, trophyIcon } from '../../art/items';
import { TROPHY_INCOME, TROPHY_SLOTS } from '../../core/balance';
import { RARITY_NAMES, itemEffect } from '../../data/items';
import { BufferImage } from '../BufferImage';
import { Icon } from '../icons';

interface Props {
  game: GameState;
  focus: keyof Facilities | null;
  onUpgrade: (k: keyof Facilities) => void;
  onSell: (itemId: string) => void;
  onSellTrophy: (id: string) => void;
  onSaves: () => void;
  onSettings: () => void;
  onLibro: () => void;
  onTaberna: () => void;
  onTitle: () => void;
}

/** La deuda, las instalaciones, el arcón del botín y el Muro de los caídos. */
export function GremioPanel({
  game,
  focus,
  onUpgrade,
  onSell,
  onSellTrophy,
  onSaves,
  onSettings,
  onTitle,
  onLibro,
  onTaberna,
}: Props) {
  const keys = Object.keys(FACILITY_INFO) as (keyof Facilities)[];
  const OUTSIDE: (keyof Facilities)[] = ['forja', 'establo', 'patio', 'empal', 'torre'];
  const next = nextPayment(game);
  let cum = 0;
  return (
    <>
      {game.mode === 'libre' ? (
        <div class="card-paper debt">
          <div class="debt-top">
            <h3>El gremio es tuyo</h3>
            <span class="muted">deuda saldada</span>
          </div>
          <span class="tiny">
            Cada 7 días se pagan los salarios: ahora, {salaries(game)} monedas
            {next ? ` (día ${next.day})` : ''}. Dos semanas sin pagar y el gremio quiebra.
          </span>
          <span class="tiny">
            Sin la deuda, otros gremios pujan por los mismos encargos: pagan menos. Y los veteranos
            de nivel 6 o más piden subidas mayores.
          </span>
          {(game.unpaid ?? 0) > 0 && (
            <span class="qs-warn">¡La semana pasada no pagaste! Otra más y se acabó.</span>
          )}
        </div>
      ) : (
        <div class="card-paper debt">
          <div class="debt-top">
            <h3>La deuda</h3>
            <span class="muted">con Merlo, el prestamista</span>
          </div>
          <div class="debt-num">
            <b>{game.paid}</b> / {DEBT} pagado
          </div>
          <div class="bar">
            <i style={{ width: `${(game.paid / DEBT) * 100}%` }} />
          </div>
          <div class="sched">
            {SCHEDULE.map((p) => {
              cum += p.amount;
              const paid = game.paid >= cum;
              return (
                <span key={p.day} class={paid ? 'paid' : p === next ? 'next' : ''}>
                  Día {p.day} · {p.amount}
                  {paid ? ' ✓' : ''}
                </span>
              );
            })}
          </div>
          <span class="tiny">
            Cada pago incluye los salarios de la semana: ahora, {salaries(game)} monedas.
          </span>
        </div>
      )}

      <div class={`card-paper security ${game.raid?.warned ? 'alert' : ''}`}>
        <div class="debt-top">
          <h3>Seguridad</h3>
          <span class="muted">notoriedad {notoriety(game)}</span>
        </div>
        <span class="tiny">
          {game.raid?.warned
            ? `¡Chivatazo! ${game.raid.band} llegará en ${Math.max(0, game.raid.day - game.day)} noches. Deja a alguien fuerte en casa o de guardia.`
            : (game.truce ?? 0) > game.day
              ? `Tregua: los bandidos no se atreven hasta el día ${game.truce}.`
              : 'Cuanto más famoso y rico es el gremio, más tienta a los bandidos.'}
        </span>
        {(game.threat ?? 0) > 0 && (
          <span class="tiny">
            Amenaza en la comarca: <b>{game.threat}</b>
            {(game.threat ?? 0) >= 40 ? ' · los caminos no son seguros' : ''}. Crece si una historia
            espera en el tablón o sale mal.
          </span>
        )}
        <span class="tiny">
          Defensa esta noche: <b>{defense(game)}</b> (
          {game.heroes.filter((h) => h.status === 'ok').length} en casa,{' '}
          {game.heroes.filter((h) => h.guard).length} de guardia)
        </span>
      </div>

      <button class="card-paper libro-link" onClick={onTaberna}>
        <b>Tu taberna</b>
        <span class="muted">Nombre, escudo, plato de la casa, personal y perro</span>
      </button>

      <button class="card-paper libro-link" onClick={onLibro}>
        <b>Libro de hazañas</b>
        <span class="muted">
          Logros con premio
          {game.mode === 'libre' ? ', desafíos del mes' : ''} y récords
        </span>
      </button>

      {(
        [
          ['En la casa', OUTSIDE.length ? keys.filter((x) => !OUTSIDE.includes(x)) : keys],
          ['Fuera de la casa', OUTSIDE],
        ] as const
      ).map(([title, list]) => (
        <section key={title}>
          <h3 class="sec-title">{title}</h3>
          <div class="list">
            {list.map((k) => {
              const level = game.fac[k];
              const info = FACILITY_INFO[k];
              const cost = upgradeCost(game, k);
              const why = canUpgrade(game, k);
              return (
                <article key={k} class={`card-paper facility ${focus === k ? 'is-focus' : ''}`}>
                  <div class="facility-info">
                    <b>{info.name}</b>
                    <span class="pips" aria-label={`Nivel ${level} de ${facilityMax(k)}`}>
                      {Array.from({ length: facilityMax(k) }, (_, i) => (
                        <i key={i} class={i < level ? 'on' : ''} />
                      ))}
                    </span>
                    <span class="muted">
                      {info.levels[level]} · {info.effect(level)}
                    </span>
                    {cost !== null && (
                      <span class="next-level">
                        Siguiente: {info.levels[level + 1]} · {info.effect(level + 1)}
                      </span>
                    )}
                  </div>
                  {cost !== null ? (
                    <button
                      class="btn btn-gold"
                      aria-label={`Mejorar ${info.name} por ${cost} monedas`}
                      disabled={!!why}
                      title={why ?? undefined}
                      onClick={() => onUpgrade(k)}
                    >
                      <Icon name="coin" size={12} /> {cost}
                    </button>
                  ) : (
                    <span class="pill pill-ok">Máximo</span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <p class="panel-note">
        Camas ocupadas: cuentan también quien está fuera o herido. Caben {capacity(game.fac.dorm)}.
      </p>

      <h3 class="sec-title">Arcón del botín</h3>
      {!game.inventory.length && (
        <p class="panel-note">El arcón está vacío. Los encargos con «+» traen objetos.</p>
      )}
      {game.inventory.some((i) => i.kind && i.kind !== 'tesoro') && (
        <p class="panel-note">
          El equipo cuelga en el tablero de la bodega. Se pone desde la ficha de cada héroe.
        </p>
      )}
      <div class="list">
        {game.inventory.map((it) => (
          <article key={it.id} class={`card-paper facility rarity-${it.rarity ?? 0}`}>
            {it.icon && <BufferImage buf={itemIcon(it.icon, it.rarity)} scale={2} />}
            <div class="facility-info">
              <b>{it.name}</b>
              {it.icon && (
                <span class="next-level">
                  {RARITY_NAMES[it.rarity ?? 0]} · {itemEffect(it)}
                </span>
              )}
              <span class="muted">{it.desc}</span>
            </div>
            <button class="btn btn-wood" onClick={() => onSell(it.id)}>
              Vender · {it.value}
            </button>
          </article>
        ))}
      </div>

      <h3 class="sec-title">Trofeos</h3>
      {!game.trophies.length ? (
        <p class="panel-note">
          Las grandes hazañas (éxito brillante en encargos peligrosos) dejan un trofeo para la pared
          de la sala.
        </p>
      ) : (
        <p class="panel-note">
          Caben {TROPHY_SLOTS} en la sala; cada uno expuesto atrae {TROPHY_INCOME} monedas al día.
        </p>
      )}
      <div class="list">
        {game.trophies.map((t, i) => (
          <article key={t.id} class="card-paper facility">
            <BufferImage buf={trophyIcon(t.icon)} scale={2} />
            <div class="facility-info">
              <b>{t.name}</b>
              <span class="next-level">
                {i < TROPHY_SLOTS ? 'En la pared de la sala' : 'Guardado: no queda pared'}
              </span>
              <span class="muted">
                {t.desc} Lo trajeron {t.who} de {t.place}, día {t.day}.
              </span>
            </div>
            <button class="btn btn-wood" onClick={() => onSellTrophy(t.id)}>
              Vender · {t.value}
            </button>
          </article>
        ))}
      </div>

      <h3 class="sec-title">Muro de los caídos</h3>
      <div class="card-paper wall">
        {game.fallen.map((f, i) => (
          <div key={i} class="fallen">
            <b>{f.name}</b>
            <span>{f.epitaph}</span>
          </div>
        ))}
      </div>

      <div class="newgame herocard-actions">
        <button class="btn btn-wood" onClick={onSaves}>
          Guardar y cargar
        </button>
        <button class="btn btn-wood" onClick={onSettings}>
          Ajustes
        </button>
        <button class="btn btn-wood" onClick={onTitle}>
          Menú principal
        </button>
      </div>
    </>
  );
}
