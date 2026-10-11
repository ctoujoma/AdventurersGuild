import { useState } from 'preact/hooks';
import { DEBT, SCHEDULE, capacity, facilityMax } from '../../core/balance';
import { canUpgrade, nextPayment, salaries, upgradeCost } from '../../core/game';
import type { Facilities, GameState } from '../../core/model';
import { FACILITY_INFO } from '../../data/labels';
import { Icon } from '../icons';

interface Props {
  game: GameState;
  focus: keyof Facilities | null;
  onUpgrade: (k: keyof Facilities) => void;
  onSell: (itemId: string) => void;
  onNewGame: () => void;
}

/** La deuda, las instalaciones, el arcón del botín y el Muro de los caídos. */
export function GremioPanel({ game, focus, onUpgrade, onSell, onNewGame }: Props) {
  const [confirm, setConfirm] = useState(false);
  const keys = Object.keys(FACILITY_INFO) as (keyof Facilities)[];
  const next = nextPayment(game);
  let cum = 0;
  return (
    <>
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

      <h3 class="sec-title">Instalaciones</h3>
      <div class="list">
        {keys.map((k) => {
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
      <p class="panel-note">
        Camas ocupadas: cuentan también quien está fuera o herido. Caben {capacity(game.fac.dorm)}.
      </p>

      <h3 class="sec-title">Arcón del botín</h3>
      {!game.inventory.length && (
        <p class="panel-note">El arcón está vacío. Los encargos con «+» traen objetos.</p>
      )}
      <div class="list">
        {game.inventory.map((it) => (
          <article key={it.id} class="card-paper facility">
            <div class="facility-info">
              <b>{it.name}</b>
              <span class="muted">{it.desc}</span>
            </div>
            <button class="btn btn-wood" onClick={() => onSell(it.id)}>
              Vender · {it.value}
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

      <div class="newgame">
        {confirm ? (
          <>
            <span>¿Empezar de cero? Esta partida se perderá.</span>
            <div class="herocard-actions">
              <button class="btn btn-red" onClick={onNewGame}>
                Sí, nueva partida
              </button>
              <button class="btn btn-wood" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <button class="btn btn-wood" onClick={() => setConfirm(true)}>
            Nueva partida
          </button>
        )}
      </div>
    </>
  );
}
