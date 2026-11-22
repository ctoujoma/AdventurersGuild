import { QUEST_LOG_KEEP } from '../../core/balance';
import type { GameState, Mission } from '../../core/model';
import { OUTCOME_CLASS, outcomeLabel } from '../../data/labels';
import { Icon } from '../icons';
import { listNames } from '../text';
import { dawnIn } from '../when';
import { t, tx } from '../../textos';
import { placeName } from '../../data/places';

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
        <h3 class="sec-title">{t('paneles.history.en_curso', { length: live.length })}</h3>
        {live.length ? (
          <div class="rows">
            {live.map((m) => (
              <button key={m.id} class="row mail" onClick={() => onTrip(m.id)}>
                <Icon name="flag" size={16} />
                <span class="mail-info">
                  <b>{tx(m.quest.title)}</b>
                  <span class="row-sub">
                    {names(game, m)} · {placeName(m.quest.place)}
                  </span>
                </span>
                <span class="mail-side">
                  {m.done ? (
                    <span class={`outcome-pill outcome-${OUTCOME_CLASS[m.done.outcome]}`}>
                      {outcomeLabel(m.done.outcome)}
                    </span>
                  ) : (
                    <span class="outcome-pill outcome-mid">
                      {m.waiting ? t('paneles.history.ante_el_jefe') : t('paneles.history.fuera')}
                    </span>
                  )}
                  <small class="row-sub">
                    {t('paneles.history.vuelve', { hecho: !!m.done, cuando: dawnIn(m.daysLeft) })}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p class="panel-note">{t('paneles.history.nadie_esta_fuera_de')}</p>
        )}
      </section>
      <section>
        <h3 class="sec-title">{t('paneles.history.cumplidos', { length: done.length })}</h3>
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
                    <b>{tx(e.title)}</b>
                    <span class="row-sub">
                      {tx(e.who)} · {placeName(e.place)}
                    </span>
                  </span>
                  <span class="mail-side">
                    <span class={`outcome-pill outcome-${OUTCOME_CLASS[e.outcome]}`}>
                      {outcomeLabel(e.outcome)}
                    </span>
                    <small class="row-sub">
                      {e.sent === e.day
                        ? t('paneles.history.dia', { dia: e.day })
                        : t('paneles.history.dias', { sent: e.sent, dia: e.day })}
                    </small>
                  </span>
                </>
              );
              return has ? (
                <button
                  key={e.id}
                  class="row mail read"
                  aria-label={t('paneles.history.leer_el_informe', {
                    titulo: tx(e.title),
                    outcome: outcomeLabel(e.outcome),
                  })}
                  onClick={() => onReport(e.report)}
                >
                  {body}
                </button>
              ) : (
                <div key={e.id} class="row mail read" title={t('paneles.history.el_informe_ya_no')}>
                  {body}
                </div>
              );
            })}
          </div>
        ) : (
          <p class="panel-note">{t('paneles.history.todavia_no_ha_vuelto')}</p>
        )}
        <p class="panel-note">
          {t('paneles.history.se_apuntan_los_ultimos', {
            quest_log_keep: QUEST_LOG_KEEP,
          })}
        </p>
      </section>
    </>
  );
}
