import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { DEBT, SCHEDULE, facilityMax } from '../../core/balance';
import { canUpgrade, nextPayment, salaries, upgradeCost } from '../../core/game';
import { defense, notoriety } from '../../core/raids';
import type { Facilities, GameState } from '../../core/model';
import { FACILITY_INFO } from '../../data/labels';
import { YARD } from '../../data/rooms';
import { help } from '../HoldHelp';
import { GoalRow } from './LibroPanel';
import { Icon, type IconName } from '../icons';

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
  /** Vista de salas: la lista de obras sustituye a la de mejoras (el patio sigue igual). */
  obras?: ComponentChildren;
  /** Abrir directamente en las salas (mientras se planea una reforma). */
  obrasFirst?: boolean;
}

const OUTSIDE: (keyof Facilities)[] = ['forja', 'establo', 'patio', 'empal', 'torre'];

/**
 * El gremio: la deuda y la seguridad de un vistazo y botones grandes para lo demás (salas,
 * adornos, arcón, libro, partidas y ajustes). «Salas» abre, en el mismo panel, la lista de
 * salas por planta y las mejoras del patio.
 */
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
  const [salas, setSalas] = useState(!!focus || !!obrasFirst);
  useEffect(() => {
    if (focus) setSalas(true);
  }, [focus]);
  const keys = Object.keys(FACILITY_INFO) as (keyof Facilities)[];
  const affordable = keys.filter((k) => upgradeCost(game, k) !== null && !canUpgrade(game, k));
  const next = nextPayment(game);
  const home = game.heroes.filter((h) => h.status === 'ok').length;
  const guards = game.heroes.filter((h) => h.guard).length;
  const def = Math.round(defense(game) * 10);
  const nights = game.raid ? Math.max(0, game.raid.day - game.day) : 0;

  const facility = (k: keyof Facilities) => {
    const level = game.fac[k];
    const info = FACILITY_INFO[k];
    const cost = upgradeCost(game, k);
    const why = canUpgrade(game, k);
    return (
      <article key={k} class={`row facility-row ${focus === k ? 'is-focus' : ''}`}>
        <div class="row-info" {...help(info.levels[level])}>
          <b>
            {info.name}{' '}
            <span class="pips" aria-label={`Nivel ${level} de ${facilityMax(k)}`}>
              {Array.from({ length: facilityMax(k) }, (_, i) => (
                <i key={i} class={i < level ? 'on' : ''} />
              ))}
            </span>
          </b>
          {level > 0 && <span class="row-sub">{info.effect(level)}</span>}
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

  if (salas)
    return (
      <>
        <button class="back" onClick={() => setSalas(false)}>
          ← Gremio
        </button>
        {obras ? (
          <>
            {obras}
            <section>
              <h3 class="sec-title">Fuera</h3>
              <div class="rows">{YARD.map(facility)}</div>
            </section>
          </>
        ) : (
          (
            [
              ['En la casa', keys.filter((x) => !OUTSIDE.includes(x))],
              ['Fuera', OUTSIDE],
            ] as const
          ).map(([title, list]) => (
            <section key={title}>
              <h3 class="sec-title">{title}</h3>
              <div class="rows">{list.map(facility)}</div>
            </section>
          ))
        )}
      </>
    );

  let cum = 0;
  const tile = (icon: IconName, label: string, onClick: () => void, extra?: ComponentChildren) => (
    <button class="tile" onClick={onClick}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
      {extra}
    </button>
  );

  return (
    <>
      {game.mode === 'libre' ? (
        <div class="debt">
          <div class="debt-top">
            <b>El gremio es tuyo</b>
            <span class="row-sub">deuda saldada</span>
          </div>
          <span class="row-sub">
            <Icon name="coin" size={10} /> Salarios: {salaries(game)} cada 7 días
            {next ? ` (día ${next.day})` : ''}
          </span>
          {(game.unpaid ?? 0) > 0 && (
            <span class="qs-warn">La semana pasada no pagaste. Otra más y se acabó.</span>
          )}
        </div>
      ) : (
        <div class="debt" {...help(`Más los salarios: ${salaries(game)} por semana.`)}>
          <div class="debt-top">
            <b>Deuda con Merlo</b>
            <span class="debt-num">
              {game.paid} / {DEBT}
            </span>
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
                  {paid && <Icon name="check" size={8} class="sched-ok" />}
                  día {p.day} · {p.amount}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div class="chips gremio-safe">
        {game.raid?.warned && (
          <span class="fact fact-alert" role="status">
            <Icon name="flag" size={12} /> {game.raid.band}: {nights}{' '}
            {nights === 1 ? 'noche' : 'noches'}
          </span>
        )}
        {!game.raid?.warned && (game.truce ?? 0) > game.day && (
          <span class="fact">Tregua hasta el día {game.truce}</span>
        )}
        <span
          class="fact"
          {...help(
            `Si asaltaran esta noche, se pararían ${def} de cada 10 (${home} en casa, ${guards} de guardia). Se pelea sala a sala: los de guardia salen al patio y los demás acuden desde la cama. La puerta y la cerradura de la cámara les dan tiempo.`,
          )}
        >
          <Icon name="escudo" size={12} /> Defensa {def}/10
        </span>
        <span
          class="fact"
          {...help('Notoriedad: cuanto más famoso y rico es el gremio, más tienta a los bandidos.')}
        >
          <Icon name="star" size={12} /> Notoriedad {notoriety(game)}
        </span>
        {(game.threat ?? 0) > 0 && (
          <span
            class="fact"
            {...help('Amenaza en la comarca: crece si una historia espera en el tablón.')}
          >
            <Icon name="calavera" size={12} /> Amenaza {game.threat}
          </span>
        )}
      </div>

      {game.goals && game.goals.active.length > 0 && (
        <section class="gremio-goals">
          <h3 class="sec-title">
            Objetivos{' '}
            <button class="linklike" onClick={onLibro}>
              ver en el Libro
            </button>
          </h3>
          <div class="rows">
            {game.goals.active.map((g) => (
              <GoalRow key={g.id} game={game} goal={g} />
            ))}
          </div>
        </section>
      )}

      <div class="tiles">
        {tile(
          'martillo',
          'Salas',
          () => setSalas(true),
          !obras && affordable.length > 0 ? (
            <span class="badge">{affordable.length}</span>
          ) : undefined,
        )}
        {tile('banderin', 'Adornos', onTaberna)}
        {tile('cofre', 'Arcón', onArcon)}
        {tile('libro', 'Libro', onLibro)}
        {tile('pergamino', 'Partidas', onSaves)}
        {tile('ajustes', 'Ajustes', onSettings)}
      </div>
      <button class="linklike gremio-title" onClick={onTitle}>
        Menú principal
      </button>
    </>
  );
}
