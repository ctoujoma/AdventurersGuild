import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { DAYS } from '../core/balance';
import { nextPayment, nextRank, rankOf, salaries } from '../core/game';
import type { GameState } from '../core/model';
import { Icon } from './icons';

/** Barra superior: día, nombre y rango del gremio, oro, reputación y próximo pago. */
export function Hud({ game }: { game: GameState }) {
  const [sound, setSound] = useState(audio.on);
  useEffect(() => audio.subscribe(setSound), []);
  const pay = nextPayment(game);
  const due = pay ? pay.amount + salaries(game) : 0;
  const close = pay ? pay.day - game.day <= 2 : false;
  const short = pay ? game.gold < due : false;
  const nr = nextRank(game);
  return (
    <header class="hud">
      <div class="hud-day">
        <span class="hud-k">Día</span>
        <b>{game.mode === 'libre' ? game.day : Math.min(game.day, DAYS)}</b>
        {game.mode !== 'libre' && <small>/{DAYS}</small>}
      </div>
      <div class="hud-name">
        <b>El Jarro Partido</b>
        <span>Gremio de {rankOf(game).name}</span>
      </div>
      <div class="hud-stats">
        <span class="hud-stat" title="Oro">
          <Icon name="coin" size={16} />
          <b>{game.gold}</b>
        </span>
        <span
          class="hud-stat"
          title={nr ? `Reputación: ${nr.at} para gremio de ${nr.name}` : 'Reputación'}
        >
          <Icon name="star" size={16} />
          <b>{game.rep}</b>
        </span>
        {pay && (
          <span
            class={`hud-stat ${close && short ? 'danger' : close || short ? 'warn' : ''}`}
            title={
              pay.amount
                ? `Pago del día ${pay.day}: ${pay.amount} al prestamista y ${due - pay.amount} en salarios`
                : `Salarios del día ${pay.day}: ${due}`
            }
          >
            <Icon name="bell" size={16} />
            <b>{due}</b>
            <small class="hud-due">d{pay.day}</small>
          </span>
        )}
        {game.raid?.warned && (
          <span
            class="hud-stat danger raid-warn"
            title={`Chivatazo: ${game.raid.band} llegará en ${game.raid.day - game.day} noches`}
          >
            <Icon name="flag" size={16} />
            <b>{Math.max(0, game.raid.day - game.day)}</b>
            <small class="hud-due">noches</small>
          </span>
        )}
        <button
          class="btn-icon"
          aria-label={sound ? 'Silenciar' : 'Activar sonido'}
          aria-pressed={sound}
          onClick={() => audio.toggle()}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={16} />
        </button>
      </div>
    </header>
  );
}
