import type { GameState } from '../core/model';
import { roster } from '../core/game';

/** Fin de «La deuda»: victoria o ruina, con la puntuación. */
export function GameOver({ game, onNew }: { game: GameState; onNew: () => void }) {
  const over = game.over!;
  const win = over.kind === 'victoria';
  const dead = game.heroes.filter((h) => h.status === 'muerto').length;
  return (
    <div class="dawn gameover" role="dialog" aria-label={win ? 'Victoria' : 'Derrota'}>
      <div class={`dawn-sky ${win ? '' : 'dusk'}`} aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card">
        <span class="eyebrow">{win ? 'La deuda está pagada' : 'Se acabó'}</span>
        <h2>{win ? '¡Victoria!' : 'El prestamista llama a la puerta'}</h2>
        <p class="quote">{over.text}</p>
        <ul class="dawn-events">
          <li class="ev ev-info">Héroes en el gremio: {roster(game).length}</li>
          <li class="ev ev-bad">Caídos en estas semanas: {dead}</li>
          <li class="ev ev-good">Misiones completadas: {game.reports.length}</li>
          {win && <li class="ev ev-warn">Puntuación: {over.score}</li>}
        </ul>
        <div class="dawn-actions">
          <button class="btn btn-gold" onClick={onNew}>
            Nueva partida
          </button>
        </div>
      </article>
    </div>
  );
}
