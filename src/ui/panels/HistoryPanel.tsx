import { QUEST_LOG_KEEP } from '../../core/balance';
import type { GameState, Mission } from '../../core/model';
import { OUTCOME_CLASS } from '../../data/labels';
import { Icon } from '../icons';
import { listNames } from '../text';
import { dawnIn } from '../when';

interface Props {
  game: GameState;
  /** Abre el viaje de un grupo que sigue fuera. */
  onTrip: (id: string) => void;
  /** Abre el informe (si el correo aún lo guarda). */
  onReport: (id: string) => void;
}

const names = (s: GameState, m: Mission) =>
  listNames(m.heroIds.map((id) => s.heroes.find((h) => h.id === id)?.name ?? '?'));

/**
 * Historial de encargos: los que están en curso (fuera o de vuelta) y los cumplidos, con su
 * resultado y su informe. Se llega desde el Libro y desde el Tablón (el mismo panel).
 */
export function HistoryPanel({ game, onTrip, onReport }: Props) {
  const live = game.missions;
  const out = new Set(live.map((m) => m.id));
  // Los resueltos que aún vuelven salen arriba, en curso; aquí, los que ya están en casa.
  const done = (game.questLog ?? []).filter((e) => !out.has(e.id));
  const kept = new Set(game.reports.map((r) => r.id));
  return (
    <>
      <section>
        <h3 class="sec-title">En curso · {live.length}</h3>
        {live.length ? (
          <div class="rows">
            {live.map((m) => (
              <button key={m.id} class="row mail" onClick={() => onTrip(m.id)}>
                <Icon name="flag" size={16} />
                <span class="mail-info">
                  <b>{m.quest.title}</b>
                  <span class="row-sub">
                    {names(game, m)} · {m.quest.place}
                  </span>
                </span>
                <span class="mail-side">
                  {m.done ? (
                    <span class={`outcome-pill outcome-${OUTCOME_CLASS[m.done.outcome]}`}>
                      {m.done.outcome}
                    </span>
                  ) : (
                    <span class="outcome-pill outcome-mid">
                      {m.waiting ? 'Ante el jefe' : 'Fuera'}
                    </span>
                  )}
                  <small class="row-sub">
                    {m.done ? 'de vuelta' : 'vuelve'} {dawnIn(m.daysLeft)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p class="panel-note">Nadie está fuera de encargo.</p>
        )}
      </section>
      <section>
        <h3 class="sec-title">Cumplidos · {done.length}</h3>
        {done.length ? (
          <div class="rows">
            {done.map((e) => {
              const has = kept.has(e.report);
              const body = (
                <>
                  <span class={`seal seal-sm ${has ? '' : 'seal-read'}`} aria-hidden="true">
                    G
                  </span>
                  <span class="mail-info">
                    <b>{e.title}</b>
                    <span class="row-sub">
                      {e.who} · {e.place}
                    </span>
                  </span>
                  <span class="mail-side">
                    <span class={`outcome-pill outcome-${OUTCOME_CLASS[e.outcome]}`}>
                      {e.outcome}
                    </span>
                    <small class="row-sub">
                      {e.sent === e.day ? `día ${e.day}` : `días ${e.sent}–${e.day}`}
                    </small>
                  </span>
                </>
              );
              return has ? (
                <button
                  key={e.id}
                  class="row mail read"
                  aria-label={`${e.title}: ${e.outcome}. Leer el informe`}
                  onClick={() => onReport(e.report)}
                >
                  {body}
                </button>
              ) : (
                <div key={e.id} class="row mail read" title="El informe ya no se guarda">
                  {body}
                </div>
              );
            })}
          </div>
        ) : (
          <p class="panel-note">Todavía no ha vuelto ningún grupo.</p>
        )}
        <p class="panel-note">
          Se apuntan los últimos {QUEST_LOG_KEEP} encargos; el informe, mientras siga en el correo.
        </p>
      </section>
    </>
  );
}
