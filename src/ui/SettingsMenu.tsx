import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { Cheat } from '../core/cheats';
import type { BossKind } from '../data/bosses';
import { BOSSES } from '../data/bosses';
import { GLOSSARY } from '../data/glossary';
import { canVibrate } from '../platform/haptics';
import type { Settings } from '../platform/settings';
import { VERSION } from '../version';
import { Icon } from './icons';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  /** Modo prueba: atajos y peleas contra jefes. */
  onCheat: (kind: Cheat) => string;
  onBoss: (boss: BossKind, won: boolean) => void;
}

const CHEATS: { kind: Cheat; label: string }[] = [
  { kind: 'oro', label: '+500 monedas' },
  { kind: 'fama', label: '+50 reputación' },
  { kind: 'dias', label: 'Pasar 3 días' },
  { kind: 'curar', label: 'Curar y animar' },
  { kind: 'obras', label: 'Mejoras al máximo' },
  { kind: 'asalto', label: 'Asalto esta noche' },
  { kind: 'historia', label: 'Avanzar historia' },
];

const SPEEDS: Settings['speed'][] = [1, 1.5, 2];

/** Ajustes: volúmenes, velocidad de la escena, lectura, movimiento y vibración. */
export function SettingsMenu({ settings: s, onChange, onClose, onCheat, onBoss }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  // Silenciar o no está aquí (en el móvil ya no hay botón arriba).
  const [sound, setSound] = useState(audio.on);
  useEffect(() => audio.subscribe(setSound), []);
  // Cinco toques seguidos en el título abren el modo prueba.
  const [taps, setTaps] = useState(0);
  const tapTitle = () => {
    const n = taps + 1;
    setTaps(n);
    if (n >= 5 && !s.tester) set({ tester: true });
  };
  const [won, setWon] = useState(true);
  const [note, setNote] = useState<string | null>(null);
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
    <div class="card-backdrop save-backdrop as-sheet" onClick={onClose}>
      <article class="herocard settings" onClick={(e) => e.stopPropagation()} aria-label="Ajustes">
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="eyebrow">A tu gusto</span>
          <h3 onClick={tapTitle}>Ajustes</h3>
          <h4 class="qs-sub">Sonido</h4>
          <label class="set-check">
            <input type="checkbox" checked={sound} onChange={() => audio.toggle()} />
            <span>Sonido activado</span>
          </label>
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
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.dawnAll}
              onChange={(e) => set({ dawnAll: e.currentTarget.checked })}
            />
            <span>Carta del amanecer de golpe (sin abrir las noticias una a una)</span>
          </label>
          {canVibrate() && (
            <label class="set-check">
              <input
                type="checkbox"
                checked={s.vibrate}
                onChange={(e) => set({ vibrate: e.currentTarget.checked })}
              />
              <span>Vibración en golpes, monedas y asaltos</span>
            </label>
          )}
          <h4 class="qs-sub">Rendimiento</h4>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.fewLights}
              onChange={(e) => set({ fewLights: e.currentTarget.checked })}
            />
            <span>Pocas luces (solo las del centro de la vista), para móviles lentos</span>
          </label>
          {s.tester && (
            <>
              <h4 class="qs-sub">Modo prueba</h4>
              <p class="tiny">Atajos para probar sin esperar. Cambian la partida en curso.</p>
              <div class="tester-grid">
                {CHEATS.map((c) => (
                  <button
                    key={c.kind}
                    class="btn btn-wood"
                    onClick={() => setNote(onCheat(c.kind))}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {note && (
                <p class="tester-note" role="status">
                  {note}
                </p>
              )}
              <p class="tiny">
                Ver una pelea contra un jefe con los héroes de casa (no cambia nada):
              </p>
              <div class="set-choices" role="radiogroup" aria-label="Resultado">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    role="radio"
                    aria-checked={won === v}
                    class={`btn ${won === v ? 'btn-gold' : 'btn-wood'}`}
                    onClick={() => setWon(v)}
                  >
                    {v ? 'Ganan' : 'Pierden'}
                  </button>
                ))}
              </div>
              <div class="tester-grid">
                {(Object.keys(BOSSES) as BossKind[]).map((b) => (
                  <button key={b} class="btn btn-wood" onClick={() => onBoss(b, won)}>
                    {BOSSES[b].name}
                  </button>
                ))}
              </div>
              <label class="set-check">
                <input
                  type="checkbox"
                  checked={s.classicTime}
                  onChange={(e) => set({ classicTime: e.currentTarget.checked })}
                />
                <span>
                  Días a la antigua: el día solo corre con el juego abierto y se cierra con
                  «Anochecer»
                </span>
              </label>
              <label class="set-check">
                <input
                  type="checkbox"
                  checked={s.tester}
                  onChange={(e) => set({ tester: e.currentTarget.checked })}
                />
                <span>Modo prueba activado</span>
              </label>
            </>
          )}
          {/* El glosario, plegado: casi nadie lo lee entero y ocupaba cuatro pantallas. */}
          <details class="set-fold">
            <summary class="qs-sub">Qué es cada cosa</summary>
            <p class="tiny">
              Mantén pulsado un botón, un marcador del mapa o una cifra para ver qué es.
            </p>
            <dl class="glossary">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt>{g.term}</dt>
                  <dd>{g.text}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p class="tiny set-version">Versión {VERSION}</p>
        </div>
      </article>
    </div>
  );
}
