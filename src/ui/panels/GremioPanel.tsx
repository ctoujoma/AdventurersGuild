import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { DEBT, SCHEDULE, facilityMax } from '../../core/balance';
import { canUpgrade, nextPayment, roster, salaries, upgradeCost } from '../../core/game';
import { beds } from '../../core/rooms';
import { defense, notoriety } from '../../core/raids';
import type { Facilities, GameState } from '../../core/model';
import { FACILITY_INFO } from '../../data/labels';
import { YARD } from '../../data/rooms';
import { Icon } from '../icons';
import { Tabs } from '../Tabs';

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
  /** Vista de salas: la pestaña de obras sustituye a la de mejoras (el patio sigue igual). */
  obras?: ComponentChildren;
  /** Abrir directamente en las obras (mientras se planea una reforma). */
  obrasFirst?: boolean;
}

type GremioTab = 'gremio' | 'mejoras';
const OUTSIDE: (keyof Facilities)[] = ['forja', 'establo', 'patio', 'empal', 'torre'];

/** El gremio en dos pestañas: la deuda, la seguridad y lo demás; y las mejoras de la casa. */
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
  obras,
  obrasFirst,
}: Props) {
  const [tab, setTab] = useState<GremioTab>(focus || obrasFirst ? 'mejoras' : 'gremio');
  useEffect(() => {
    if (focus) setTab('mejoras');
  }, [focus]);
  const keys = Object.keys(FACILITY_INFO) as (keyof Facilities)[];
  const affordable = keys.filter((k) => upgradeCost(game, k) !== null && !canUpgrade(game, k));
  const next = nextPayment(game);
  const home = game.heroes.filter((h) => h.status === 'ok').length;
  const guards = game.heroes.filter((h) => h.guard).length;
  let cum = 0;

  const facility = (k: keyof Facilities) => {
    const level = game.fac[k];
    const info = FACILITY_INFO[k];
    const cost = upgradeCost(game, k);
    const why = canUpgrade(game, k);
    return (
      <article
        key={k}
        class={`card-paper facility ${focus === k ? 'is-focus' : ''}`}
        data-help={info.levels[level]}
      >
        <div class="facility-info">
          <span class="facility-name">
            <b>{info.name}</b>
            <span class="pips" aria-label={`Nivel ${level} de ${facilityMax(k)}`}>
              {Array.from({ length: facilityMax(k) }, (_, i) => (
                <i key={i} class={i < level ? 'on' : ''} />
              ))}
            </span>
          </span>
          {level > 0 && <span class="muted">{info.effect(level)}</span>}
          {cost !== null && <span class="next-level">Mejora: {info.effect(level + 1)}</span>}
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
  };

  return (
    <>
      <Tabs
        label="Gremio"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'gremio', label: 'Gremio' },
          obras
            ? { id: 'mejoras', label: 'Obras' }
            : { id: 'mejoras', label: 'Mejoras', alert: affordable.length },
        ]}
      />

      {tab === 'mejoras' && obras && (
        <>
          {obras}
          <section>
            <h3 class="sec-title">Fuera</h3>
            <div class="list">{YARD.map(facility)}</div>
          </section>
        </>
      )}

      {tab === 'mejoras' && !obras && (
        <>
          {(
            [
              ['En la casa', keys.filter((x) => !OUTSIDE.includes(x))],
              ['Fuera', OUTSIDE],
            ] as const
          ).map(([title, list]) => (
            <section key={title}>
              <h3 class="sec-title">{title}</h3>
              <div class="list">{list.map(facility)}</div>
            </section>
          ))}
          <p class="panel-note">
            Camas para héroes: {beds(game.building)} (ocupadas {roster(game).length}). Quien está
            fuera o herido también ocupa cama.
          </p>
        </>
      )}

      {tab === 'gremio' && (
        <>
          {game.mode === 'libre' ? (
            <div class="card-paper debt">
              <div class="debt-top">
                <h3>El gremio es tuyo</h3>
                <span class="muted">deuda saldada</span>
              </div>
              <span class="tiny">
                Salarios: {salaries(game)} monedas cada 7 días{next ? ` (día ${next.day})` : ''}.
              </span>
              {(game.unpaid ?? 0) > 0 && (
                <span class="qs-warn">La semana pasada no pagaste. Otra más y se acabó.</span>
              )}
            </div>
          ) : (
            <div class="card-paper debt">
              <div class="debt-top">
                <h3>La deuda</h3>
                <span class="muted">con Merlo</span>
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
              <span class="tiny">Más los salarios: {salaries(game)} por semana.</span>
            </div>
          )}

          <div class={`card-paper security ${game.raid?.warned ? 'alert' : ''}`}>
            <div class="debt-top">
              <h3>Seguridad</h3>
              <span
                class="muted"
                data-help="Cuanto más famoso y rico es el gremio, más tienta a los bandidos."
              >
                notoriedad {notoriety(game)}
              </span>
            </div>
            {game.raid?.warned ? (
              <span class="tiny">
                ¡Chivatazo! {game.raid.band} llega en {Math.max(0, game.raid.day - game.day)}{' '}
                noches.
              </span>
            ) : (
              (game.truce ?? 0) > game.day && (
                <span class="tiny">Tregua hasta el día {game.truce}.</span>
              )
            )}
            <span
              class="tiny"
              data-help="Se pelea sala a sala: los de guardia salen al patio y los demás acuden desde la cama. La puerta y la cerradura de la cámara les dan tiempo."
            >
              Si asaltaran esta noche, se pararían <b>{Math.round(defense(game) * 10)}</b> de cada
              10 ({home} en casa, {guards} de guardia)
            </span>
            {(game.threat ?? 0) > 0 && (
              <span class="tiny" data-help="Crece si una historia espera en el tablón.">
                Amenaza en la comarca: <b>{game.threat}</b>
              </span>
            )}
          </div>

          <div class="gremio-links">
            <button class="card-paper libro-link" onClick={onTaberna}>
              <b>Tu taberna</b>
              <span class="muted">Nombre, escudo, personal…</span>
            </button>
            <button class="card-paper libro-link" onClick={onArcon}>
              <b>Arcón y trofeos</b>
              <span class="muted">
                {game.inventory.length} {game.inventory.length === 1 ? 'objeto' : 'objetos'} ·{' '}
                {game.trophies.length} {game.trophies.length === 1 ? 'trofeo' : 'trofeos'}
              </span>
            </button>
            <button class="card-paper libro-link" onClick={onLibro}>
              <b>Libro de hazañas</b>
              <span class="muted">Logros y récords</span>
            </button>
          </div>

          {game.fallen.length > 0 && (
            <>
              <h3 class="sec-title">Muro de los caídos</h3>
              <div class="card-paper wall">
                {game.fallen.map((f, i) => (
                  <div key={i} class="fallen">
                    <b>{f.name}</b>
                    <span>{f.epitaph}</span>
                  </div>
                ))}
              </div>
            </>
          )}

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
      )}
    </>
  );
}
