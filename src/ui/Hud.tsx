import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { DAYS, RANKS } from '../core/balance';
import { customOf, nextPayment, nextRank, rankOf, salaries } from '../core/game';
import { beerCap, dailyYield, foodCap, hungryTonight } from '../core/larder';
import { goldCap, vaultFull } from '../core/vault';
import { listNames, plural } from './text';
import { rankUnlocks } from '../core/ranks';
import { isRealTime, left as timeLeft, shortLeft } from './when';
import type { GameState } from '../core/model';
import { Counter } from './Counter';
import { Icon } from './icons';

type Tip = 'oro' | 'rep' | 'comida' | 'cerveza' | 'pago' | 'asalto';

/**
 * Barra superior: día, nombre y rango del gremio, oro, reputación, comida, cerveza y próximo pago. Al tocar
 * una cifra sale debajo una línea que explica qué es. El sonido está en Ajustes; en pantallas anchas,
 * también aquí.
 */
export function Hud({ game, onSettings }: { game: GameState; onSettings: () => void }) {
  const [sound, setSound] = useState(audio.on);
  useEffect(() => audio.subscribe(setSound), []);
  const pay = nextPayment(game);
  const due = pay ? pay.amount + salaries(game) : 0;
  const close = pay ? pay.day - game.day <= 2 : false;
  const short = pay ? game.gold < due : false;
  const nr = nextRank(game);
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 6000);
    return () => clearTimeout(t);
  }, [tip]);
  const toggle = (t: Tip) => setTip((cur) => (cur === t ? null : t));
  const left = pay ? pay.day - game.day : 0;
  const nights = game.raid ? Math.max(0, game.raid.day - game.day) : 0;
  const clock = game.clock ?? 0;
  const when =
    left <= 0 ? 'hoy' : left === 1 && !isRealTime() ? 'mañana' : `en ${timeLeft(left, clock)}`;
  const made = dailyYield(game);
  const opens = nr ? rankUnlocks(RANKS.indexOf(nr)) : [];
  const hungry = hungryTonight(game);
  const tips: Record<Tip, string> = {
    oro: `Oro: ${game.gold} de ${goldCap(game)} que caben en la cámara del tesoro.${vaultFull(game) ? ' Está casi llena: lo que no quepa se perderá. Gasta, mejórala o hazla más grande.' : ''}`,
    rep: nr
      ? `Reputación: ${game.rep}. Con ${nr.at} el gremio pasa a ser de ${nr.name}: mejores encargos y héroes${opens.length ? `, y se abre ${listNames(opens)}` : ''}.`
      : `Reputación: ${game.rep}. Ya sois el gremio más famoso de la comarca.`,
    comida: `Raciones: ${game.food} de ${foodCap(game.building)} que caben. La cocina hace ${made.food} al día; comen los visitantes y cenan los de casa.${hungry ? ` Esta noche ${hungry} se ${hungry === 1 ? 'quedaría' : 'quedarían'} sin cenar.` : ''}`,
    cerveza: `Jarras: ${game.beer} de ${beerCap(game.building)} que caben. La bodega saca ${made.beer} al día y cada visitante se toma una.`,
    pago: !pay
      ? ''
      : pay.amount
        ? `Próximo pago, el día ${pay.day} (${when}): ${pay.amount} al prestamista y ${due - pay.amount} en salarios. Total ${due}.${short ? ' Ahora mismo no llega.' : ''}`
        : `Salarios del día ${pay.day} (${when}): ${due} monedas.${short ? ' Ahora mismo no llega.' : ''}`,
    asalto: game.raid
      ? `Chivatazo: ${game.raid.band} llega en ${isRealTime() ? timeLeft(nights, clock) : `${nights} ${plural(nights, 'noche', 'noches')}`}. Prepara las defensas.`
      : '',
  };
  return (
    <header class="hud">
      <div class="hud-day">
        <span class="hud-k">Día</span>
        <b>{game.mode === 'libre' ? game.day : Math.min(game.day, DAYS)}</b>
        {game.mode !== 'libre' && <small>/{DAYS}</small>}
      </div>
      <div class="hud-name">
        <b>{customOf(game).name}</b>
        <span>Gremio de {rankOf(game).name}</span>
      </div>
      <div class="hud-stats">
        <button
          class={`hud-stat ${game.gold >= goldCap(game) ? 'danger' : vaultFull(game) ? 'warn' : ''}`}
          aria-label={tips.oro}
          aria-expanded={tip === 'oro'}
          onClick={() => toggle('oro')}
        >
          <Icon name="coin" size={16} />
          <Counter value={game.gold} />
        </button>
        <button
          class="hud-stat"
          aria-label={tips.rep}
          aria-expanded={tip === 'rep'}
          onClick={() => toggle('rep')}
        >
          <Icon name="star" size={16} />
          <Counter value={game.rep} />
        </button>
        <button
          class={`hud-stat ${hungry ? 'warn' : ''}`}
          aria-label={tips.comida}
          aria-expanded={tip === 'comida'}
          onClick={() => toggle('comida')}
        >
          <Icon name="pan" size={16} />
          <Counter value={game.food} />
        </button>
        <button
          class="hud-stat"
          aria-label={tips.cerveza}
          aria-expanded={tip === 'cerveza'}
          onClick={() => toggle('cerveza')}
        >
          <Icon name="jarra" size={16} />
          <Counter value={game.beer} />
        </button>
        {pay && (
          <button
            class={`hud-stat ${close && short ? 'danger' : close || short ? 'warn' : ''}`}
            aria-label={tips.pago}
            aria-expanded={tip === 'pago'}
            onClick={() => toggle('pago')}
          >
            <Icon name="bell" size={16} />
            <b>{due}</b>
            <small class="hud-due">{left <= 0 ? 'hoy' : shortLeft(left, clock)}</small>
          </button>
        )}
        {game.raid?.warned && (
          <button
            class="hud-stat danger raid-warn"
            aria-label={tips.asalto}
            aria-expanded={tip === 'asalto'}
            onClick={() => toggle('asalto')}
          >
            <Icon name="flag" size={16} />
            {isRealTime() ? (
              <b>{shortLeft(nights, clock)}</b>
            ) : (
              <>
                <b>{nights}</b>
                <small class="hud-due">{nights === 1 ? 'noche' : 'noches'}</small>
              </>
            )}
          </button>
        )}
        <button
          class="btn-icon hud-sound"
          aria-label={sound ? 'Silenciar' : 'Activar sonido'}
          aria-pressed={sound}
          onClick={() => audio.toggle()}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={16} />
        </button>
        <button class="btn-icon" aria-label="Ajustes" onClick={onSettings}>
          <Icon name="ajustes" size={16} />
        </button>
      </div>
      {tip && tips[tip] && (
        <p class="hud-tip" role="status" onClick={() => setTip(null)}>
          {tips[tip]}
        </p>
      )}
    </header>
  );
}
