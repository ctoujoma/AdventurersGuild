import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { Icon } from './icons';

export function Hud({ gold }: { gold: number }) {
  const [sound, setSound] = useState(audio.on);
  useEffect(() => audio.subscribe(setSound), []);
  return (
    <header class="hud">
      <div class="hud-day">
        <span class="hud-k">Día</span>
        <b>4</b>
        <small>/30</small>
      </div>
      <div class="hud-name">
        <b>El Jarro Partido</b>
        <span>Gremio de cobre</span>
      </div>
      <div class="hud-stats">
        <span class="hud-stat" title="Oro">
          <Icon name="coin" size={16} />
          <b>{gold}</b>
        </span>
        <span class="hud-stat" title="Reputación">
          <Icon name="star" size={16} />
          <b>18</b>
        </span>
        <span class="hud-stat warn" title="Próximo pago: día 7">
          <Icon name="bell" size={16} />
          <b>216</b>
        </span>
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
