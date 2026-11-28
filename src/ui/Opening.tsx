import type { Arrival } from '../core/model';
import { t } from '../textos';

interface Props {
  arrival: Arrival;
  /** Mejor llegada de intentos anteriores, para comparar. */
  best: Arrival | null;
  /** Vista de salas: se abren las obras. */
  rooms?: boolean;
  onOpen: () => void;
}

/**
 * Al pagar la deuda: el gremio es tuyo y empieza la aventura. Sin «otro intento» (usuario, 28 de
 * noviembre): tras la campaña, la partida sigue; para empezar otra, el menú de partidas.
 */
export function Opening({ arrival: a, best, rooms, onOpen }: Props) {
  const better = best && a.score > best.score;
  return (
    <div class="dawn opening" role="dialog" aria-label={t('pantallas.opening.el_gremio_es_tuyo')}>
      <div class="dawn-sky" aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card">
        <span class="eyebrow">{t('pantallas.opening.dia_la_deuda_esta', { dia: a.day })}</span>
        <h2>{t('pantallas.opening.el_gremio_es_tuyo')}</h2>
        <p class="opening-lead">{t('pantallas.opening.ahora_empieza_la_aventura')}</p>
        <div class="arrival">
          <span>
            <b>{a.heroes}</b> {t('pantallas.opening.heroes', { n: a.heroes })}
          </span>
          <span>
            <b>{a.gold}</b> {t('pantallas.opening.monedas', { n: a.gold })}
          </span>
          <span>
            <b>{a.rep}</b> {t('pantallas.opening.reputacion', { n: a.rep })}
          </span>
          <span>
            <b>{a.trophies}</b> {t('pantallas.opening.trofeos', { n: a.trophies })}
          </span>
          <span>
            <b>{a.facilities}</b> {t('pantallas.opening.mejoras', { n: a.facilities })}
          </span>
          <span>
            <b>{a.fallen}</b> {t('pantallas.opening.caidos', { n: a.fallen })}
          </span>
        </div>
        <p class="opening-score">
          {t('pantallas.opening.llegada')} <b>{a.score}</b>{' '}
          {t('pantallas.opening.puntos', {
            n: a.score,
            mejor: better ? 'si' : best ? 'no' : '',
            record: best?.score ?? 0,
          })}
        </p>
        <ul class="dawn-events">
          {rooms && <li class="ev ev-good">{t('pantallas.opening.se_acabaron_los_apanos')}</li>}
          <li class="ev ev-info">{t('pantallas.opening.sin_merlo_encima_cada')}</li>
          <li class="ev ev-warn">{t('pantallas.opening.los_veteranos_cobran_mas')}</li>
          <li class="ev ev-good">{t('pantallas.opening.las_hazanas_y_los')}</li>
        </ul>
        <div class="dawn-actions">
          <button class="btn btn-gold" onClick={onOpen}>
            {t('pantallas.opening.abrir_el_gremio_al')}
          </button>
        </div>
      </article>
    </div>
  );
}
