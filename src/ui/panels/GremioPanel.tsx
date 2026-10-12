import { DEBT, SCHEDULE, capacity, facilityMax } from '../../core/balance';
import { canUpgrade, nextPayment, salaries, upgradeCost } from '../../core/game';
import { defense, notoriety } from '../../core/raids';
import type { Facilities, GameState } from '../../core/model';
import { FACILITY_INFO } from '../../data/labels';
import { Icon } from '../icons';

interface Props {
  game: GameState;
  focus: keyof Facilities | null;
  onUpgrade: (k: keyof Facilities) => void;
  onArcon: () => void;
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
  onArcon,
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
                  {paid && <Icon name="check" size={8} class="sched-ok" />}
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

      <button class="card-paper libro-link" onClick={onArcon}>
        <b>Arcón y trofeos</b>
        <span class="muted">
          {game.inventory.length} {game.inventory.length === 1 ? 'objeto' : 'objetos'} en el arcón ·{' '}
          {game.trophies.length} {game.trophies.length === 1 ? 'trofeo' : 'trofeos'}
        </span>
      </button>

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
