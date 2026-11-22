import type { GameState } from '../core/model';
import { roster } from '../core/game';
import { t, tx } from '../textos';

/** Fin de «La deuda»: victoria o ruina, con la puntuación. */
export function GameOver({ game, onNew }: { game: GameState; onNew: () => void }) {
  const over = game.over!;
  const win = over.kind === 'victoria';
  const dead = game.heroes.filter((h) => h.status === 'muerto').length;
  return (
    <div
      class="dawn gameover"
      role="dialog"
      aria-label={win ? t('pantallas.gameover.victoria') : t('pantallas.gameover.derrota')}
    >
      <div class={`dawn-sky ${win ? '' : 'dusk'}`} aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card">
        <span class="eyebrow">
          {win ? t('pantallas.gameover.la_deuda_esta_pagada') : t('pantallas.gameover.se_acabo')}
        </span>
        <h2>
          {win
            ? t('pantallas.gameover.victoria_2')
            : t('pantallas.gameover.el_prestamista_llama_a')}
        </h2>
        <p class="quote">{tx(over.text)}</p>
        <ul class="dawn-events">
          <li class="ev ev-info">
            {t('pantallas.gameover.heroes_en_el_gremio', { length: roster(game).length })}
          </li>
          <li class="ev ev-bad">{t('pantallas.gameover.caidos_en_estas_semanas', { dead })}</li>
          <li class="ev ev-good">
            {t('pantallas.gameover.misiones_completadas', {
              n: game.stats?.missions ?? game.reports.length,
            })}
          </li>
          {win && (
            <li class="ev ev-warn">{t('pantallas.gameover.puntuacion', { puntos: over.score })}</li>
          )}
        </ul>
        <div class="dawn-actions">
          <button class="btn btn-gold" onClick={onNew}>
            {t('pantallas.gameover.nueva_partida')}
          </button>
        </div>
      </article>
    </div>
  );
}
