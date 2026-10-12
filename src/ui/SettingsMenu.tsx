import type { Settings } from '../platform/settings';
import { Icon } from './icons';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const SPEEDS: Settings['speed'][] = [1, 1.5, 2];

/** Ajustes: volúmenes, velocidad de la escena, letra grande y menos movimiento. */
export function SettingsMenu({ settings: s, onChange, onClose }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  const slider = (key: 'music' | 'sfx' | 'ambient', label: string) => (
    <label class="set-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(s[key] * 100)}
        onInput={(e) => set({ [key]: Number(e.currentTarget.value) / 100 })}
        aria-valuetext={`${Math.round(s[key] * 100)} %`}
      />
      <b>{Math.round(s[key] * 100)}</b>
    </label>
  );
  return (
    <div class="card-backdrop save-backdrop" onClick={onClose}>
      <article class="herocard settings" onClick={(e) => e.stopPropagation()} aria-label="Ajustes">
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="eyebrow">A tu gusto</span>
          <h3>Ajustes</h3>
          <h4 class="qs-sub">Sonido</h4>
          {slider('music', 'Música')}
          {slider('sfx', 'Efectos')}
          {slider('ambient', 'Ambiente')}
          <h4 class="qs-sub">Velocidad de la escena</h4>
          <p class="tiny">Noches, asaltos y el ir y venir de la taberna.</p>
          <div class="set-choices" role="radiogroup" aria-label="Velocidad">
            {SPEEDS.map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={s.speed === v}
                class={`btn ${s.speed === v ? 'btn-gold' : 'btn-wood'}`}
                onClick={() => set({ speed: v })}
              >
                ×{String(v).replace('.', ',')}
              </button>
            ))}
          </div>
          <h4 class="qs-sub">Lectura</h4>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.bigText}
              onChange={(e) => set({ bigText: e.currentTarget.checked })}
            />
            <span>Letra más grande en paneles y fichas</span>
          </label>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.calm}
              onChange={(e) => set({ calm: e.currentTarget.checked })}
            />
            <span>Menos movimiento en la interfaz</span>
          </label>
        </div>
      </article>
    </div>
  );
}
