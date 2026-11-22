import { EXP_EVENTS } from '../data/expEvents';
import { distAt, offering, optionIssue, optionRisk, RATION_PRICE } from '../core/expedition';
import type { Expedition, GameState } from '../core/model';
import { Icon } from './icons';
import { msg, t } from '../textos';
import { dangerClass } from '../data/labels';

interface Props {
  game: GameState;
  exp: Expedition;
  onChoose: (option: string) => void;
}

/**
 * La carta del suceso que espera (EX17): la cabecera (ilustración del agente de arte; mientras,
 * un marcador), lo que pasa, las opciones con su pista de riesgo en palabras (las de las clases
 * que no van, tachadas) y la barra del plazo.
 */
export function ExpeditionCard({ game, exp: e, onChoose }: Props) {
  const p = e.pending;
  if (!p) return null;
  const def = EXP_EVENTS[p.kind];
  const left = Math.max(0, p.until - e.hours);
  const total = Math.max(1, p.until - p.h);
  return (
    <section class={`exp-card is-${p.kind}`} aria-live="polite">
      <div class="exp-card-art" aria-hidden="true">
        <Icon name={p.kind === 'guardian' ? 'calavera' : def.site ? 'torre' : 'star'} size={28} />
      </div>
      <h4 class="exp-card-title">
        {t('expediciones.carta.titulo', { que: msg(`expediciones.sucesos.${p.kind}.titulo`) })}
      </h4>
      <p class="exp-card-text">
        {t(`expediciones.sucesos.${p.kind}.texto`, { rumbo: e.heading, n: e.heroIds.length })}
      </p>
      <div class="exp-card-options">
        {def.options.map((o) => {
          const issue = optionIssue(game, e, o.id);
          const struck = !!o.cls && !!issue;
          const risk = issue ? null : optionRisk(game, e, o.id);
          const cost =
            p.kind === 'santuario' && o.id === 'ofrenda'
              ? offering(distAt(e))
              : p.kind === 'mercader' && o.id === 'comprar'
                ? RATION_PRICE
                : 0;
          return (
            <button
              key={o.id}
              class={`btn btn-wood exp-option ${struck ? 'is-struck' : ''}`}
              disabled={!!issue}
              onClick={() => onChoose(o.id)}
            >
              <b>{t(`expediciones.sucesos.${p.kind}.${o.id}.nombre`)}</b>
              <span class="exp-option-hint">
                {issue ?? (
                  <>
                    <span class={`exp-risk danger-${dangerClass(risk!.level)}`}>
                      {t(`expediciones.carta.riesgo.${risk!.level}`)}
                    </span>
                    {o.attr && (
                      <span> · {t('expediciones.carta.depende', { atributo: o.attr })}</span>
                    )}
                    {cost > 0 && <span> · {t('expediciones.carta.cuesta', { n: cost })}</span>}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div class="exp-card-time">
        <span class="train-bar" aria-hidden="true">
          <i style={{ width: `${Math.round((left / total) * 100)}%` }} />
        </span>
        <span class="tiny">
          {p.kind === 'guardian'
            ? t('expediciones.carta.espera_guardian', { horas: left })
            : t('expediciones.carta.espera', { sitio: !!def.site, horas: left })}
        </span>
      </div>
    </section>
  );
}
