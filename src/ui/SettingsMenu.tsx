import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { Cheat } from '../core/cheats';
import type { BossKind } from '../data/bosses';
import { BOSSES } from '../data/bosses';
import { GLOSSARY } from '../data/glossary';
import { canVibrate } from '../platform/haptics';
import type { Settings } from '../platform/settings';
import { WEATHER_KINDS, WEATHER_LABEL, type WeatherKind } from '../world/weather';
import { VERSION } from '../version';
import { Icon } from './icons';
import { t } from '../textos';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  /** Modo prueba: atajos y peleas contra jefes. */
  onCheat: (kind: Cheat) => string;
  onBoss: (boss: BossKind, won: boolean) => void;
  /** Modo prueba: el tiempo forzado (null: el que toque) y cómo cambiarlo. */
  weather?: WeatherKind | null;
  onWeather?: (k: WeatherKind | null) => void;
  onLightning?: () => void;
}

const CHEATS: { kind: Cheat; label: string }[] = [
  { kind: 'oro', label: t('pantallas.settingsmenu.n_500_monedas') },
  { kind: 'fama', label: t('pantallas.settingsmenu.n_50_reputacion') },
  { kind: 'dias', label: t('pantallas.settingsmenu.pasar_3_dias') },
  { kind: 'curar', label: t('pantallas.settingsmenu.curar_y_animar') },
  { kind: 'obras', label: t('pantallas.settingsmenu.mejoras_al_maximo') },
  { kind: 'asalto', label: t('pantallas.settingsmenu.asalto_esta_noche') },
  { kind: 'historia', label: t('pantallas.settingsmenu.avanzar_historia') },
  { kind: 'forastero', label: t('pantallas.settingsmenu.forastero_de_la_tormenta') },
  { kind: 'ladronNoche', label: t('pantallas.settingsmenu.ladron_nocturno') },
  { kind: 'mensajero', label: t('pantallas.settingsmenu.mensajero_tardio') },
  { kind: 'pesadilla', label: t('pantallas.settingsmenu.pesadilla') },
  { kind: 'gato', label: t('pantallas.settingsmenu.gato_cazador') },
];

const SPEEDS: Settings['speed'][] = [1, 1.5, 2];

/** Ajustes: volúmenes, velocidad de la escena, lectura, movimiento y vibración. */
export function SettingsMenu({
  settings: s,
  onChange,
  onClose,
  onCheat,
  onBoss,
  weather,
  onWeather,
  onLightning,
}: Props) {
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
      <article
        class="herocard settings"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('pantallas.settingsmenu.ajustes')}
      >
        <button
          class="btn-icon herocard-x"
          data-tut="cerrar"
          aria-label={t('pantallas.settingsmenu.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="eyebrow">{t('pantallas.settingsmenu.a_tu_gusto')}</span>
          <h3 onClick={tapTitle}>{t('pantallas.settingsmenu.ajustes')}</h3>
          <h4 class="qs-sub">{t('pantallas.settingsmenu.sonido')}</h4>
          <label class="set-check">
            <input type="checkbox" checked={sound} onChange={() => audio.toggle()} />
            <span>{t('pantallas.settingsmenu.sonido_activado')}</span>
          </label>
          {slider('music', t('pantallas.settingsmenu.musica'))}
          {slider('sfx', t('pantallas.settingsmenu.efectos'))}
          {slider('ambient', t('pantallas.settingsmenu.ambiente'))}
          <h4 class="qs-sub">{t('pantallas.settingsmenu.velocidad_de_la_escena')}</h4>
          <p class="tiny">{t('pantallas.settingsmenu.noches_asaltos_y_el')}</p>
          <div
            class="set-choices"
            role="radiogroup"
            aria-label={t('pantallas.settingsmenu.velocidad')}
          >
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
          <h4 class="qs-sub">{t('pantallas.settingsmenu.lectura')}</h4>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.bigText}
              onChange={(e) => set({ bigText: e.currentTarget.checked })}
            />
            <span>{t('pantallas.settingsmenu.letra_mas_grande_en')}</span>
          </label>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.calm}
              onChange={(e) => set({ calm: e.currentTarget.checked })}
            />
            <span>{t('pantallas.settingsmenu.menos_movimiento_en_la')}</span>
          </label>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.dawnAll}
              onChange={(e) => set({ dawnAll: e.currentTarget.checked })}
            />
            <span>{t('pantallas.settingsmenu.carta_del_amanecer_de')}</span>
          </label>
          {canVibrate() && (
            <label class="set-check">
              <input
                type="checkbox"
                checked={s.vibrate}
                onChange={(e) => set({ vibrate: e.currentTarget.checked })}
              />
              <span>{t('pantallas.settingsmenu.vibracion_en_golpes_monedas')}</span>
            </label>
          )}
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.share}
              onChange={(e) => set({ share: e.currentTarget.checked })}
            />
            <span>{t('pantallas.settingsmenu.enviar_mi_partida_a')}</span>
          </label>
          <h4 class="qs-sub">{t('pantallas.settingsmenu.imagen')}</h4>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.moodLight}
              onChange={(e) => set({ moodLight: e.currentTarget.checked })}
            />
            <span>{t('pantallas.settingsmenu.luz_con_ambiente_salas')}</span>
          </label>
          {s.moodLight && (
            <div class="set-row">
              <span>{t('pantallas.settingsmenu.clima')}</span>
              <div
                class="set-choices"
                role="radiogroup"
                aria-label={t('pantallas.settingsmenu.clima')}
              >
                {(['normal', 'clear'] as const).map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={s.weather === v}
                    class={`btn ${s.weather === v ? 'btn-gold' : 'btn-wood'}`}
                    onClick={() => set({ weather: v })}
                  >
                    {v === 'normal'
                      ? t('pantallas.settingsmenu.normal')
                      : t('pantallas.settingsmenu.siempre_despejado')}
                  </button>
                ))}
              </div>
            </div>
          )}
          <h4 class="qs-sub">{t('pantallas.settingsmenu.rendimiento')}</h4>
          <label class="set-check">
            <input
              type="checkbox"
              checked={s.fewLights}
              onChange={(e) => set({ fewLights: e.currentTarget.checked })}
            />
            <span>{t('pantallas.settingsmenu.pocas_luces_solo_las')}</span>
          </label>
          {s.tester && (
            <>
              <h4 class="qs-sub">{t('pantallas.settingsmenu.modo_prueba')}</h4>
              <p class="tiny">{t('pantallas.settingsmenu.atajos_para_probar_sin')}</p>
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
              {onWeather && (
                <label class="set-row">
                  <span>{t('pantallas.settingsmenu.forzar_el_tiempo')}</span>
                  <select
                    value={weather ?? ''}
                    onChange={(e) =>
                      onWeather((e.currentTarget.value || null) as WeatherKind | null)
                    }
                  >
                    <option value="">{t('pantallas.settingsmenu.el_que_toque')}</option>
                    {WEATHER_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {WEATHER_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {onLightning && (
                <button class="btn btn-wood" onClick={onLightning}>
                  {t('pantallas.settingsmenu.relampago')}
                </button>
              )}
              <p class="tiny">{t('pantallas.settingsmenu.ver_una_pelea_contra')}</p>
              <div
                class="set-choices"
                role="radiogroup"
                aria-label={t('pantallas.settingsmenu.resultado')}
              >
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    role="radio"
                    aria-checked={won === v}
                    class={`btn ${won === v ? 'btn-gold' : 'btn-wood'}`}
                    onClick={() => setWon(v)}
                  >
                    {v ? t('pantallas.settingsmenu.ganan') : t('pantallas.settingsmenu.pierden')}
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
                <span>{t('pantallas.settingsmenu.dias_a_la_antigua')}</span>
              </label>
              <label class="set-check">
                <input
                  type="checkbox"
                  checked={s.tester}
                  onChange={(e) => set({ tester: e.currentTarget.checked })}
                />
                <span>{t('pantallas.settingsmenu.modo_prueba_activado')}</span>
              </label>
            </>
          )}
          {/* El glosario, plegado: casi nadie lo lee entero y ocupaba cuatro pantallas. */}
          <details class="set-fold">
            <summary class="qs-sub">{t('pantallas.settingsmenu.que_es_cada_cosa')}</summary>
            <p class="tiny">{t('pantallas.settingsmenu.manten_pulsado_un_boton')}</p>
            <dl class="glossary">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt>{g.term}</dt>
                  <dd>{g.text}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p class="tiny set-version">
            {t('pantallas.settingsmenu.version', { version: VERSION })}
          </p>
        </div>
      </article>
    </div>
  );
}
