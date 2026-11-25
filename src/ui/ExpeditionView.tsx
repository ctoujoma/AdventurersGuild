import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { EXP_HOURS } from '../core/balance';
import { LifeBar } from './LifeBar';
import { distAt, expWeather, hoursHome, itemGlow, matGlow, riskNow } from '../core/expedition';
import type { BossFight, ExpKind, Expedition, GameState } from '../core/model';
import { ExpeditionCard } from './ExpeditionCard';
import { matsMsg, type Material } from '../core/materials';
import { dangerClass } from '../data/labels';
import { ESCRITORIO, MOVIL } from '../world/visor/encuadre';
import { Visor } from '../world/visor/escena';
import { GLOW_SFX, glowClass } from './glow';
import { Icon, type IconName } from './icons';
import { ItemImage, itemProps } from './ItemImage';
import { MatIcon } from './mats';
import { Portrait } from './Portrait';
import { marchNow } from './expedition';
import { lookOf, marksOf, heroFrame } from './view';
import { t, tx } from '../textos';

interface Props {
  game: GameState;
  exp: Expedition;
  onClose: () => void;
  onHero: (id: string) => void;
  onBack: () => void;
  onChoose: (option: string) => void;
  onMute: (on: boolean) => void;
  /** Ver una pelea del diario. */
  onWatch: (fight: BossFight) => void;
}

const KIND_ICON: Record<ExpKind, IconName> = {
  salida: 'flag',
  camino: 'pasos',
  hallazgo: 'cofre',
  raciones: 'pan',
  pelea: 'espadas',
  herida: 'cruz',
  cura: 'cruz',
  noche: 'fogata',
  aviso: 'banderin',
  vuelta: 'home',
  llegada: 'home',
  suceso: 'star',
  eleccion: 'check',
};

/** Desde qué ancho de pantalla el visor va a pantalla entera (320 × 200 a ×3). */
const DESK = '(min-width: 1000px)';
const wide = () => typeof matchMedia !== 'undefined' && matchMedia(DESK).matches;

/** El visor: el paisaje con el grupo en directo y, debajo, cómo van y su diario. */
export function ExpeditionView({
  game,
  exp: e,
  onClose,
  onHero,
  onBack,
  onChoose,
  onMute,
  onWatch,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const now = marchNow(game, e);
  const nowRef = useRef(now);
  nowRef.current = now;

  // El visor (`world/visor/`): en el móvil, el cuadro de 156 × 140 a ×2; en escritorio, 320 × 200
  // a ×3. Se pinta a unos 12 fotogramas por segundo.
  const [desk, setDesk] = useState(wide);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(DESK);
    const on = () => setDesk(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const enc = desk ? ESCRITORIO : MOVIL;
    c.width = enc.w;
    c.height = enc.h;
    const visor = new Visor(enc);
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      const tick = Math.floor((ms - start) / 83);
      if (tick === last) return;
      last = tick;
      visor.draw(ctx, nowRef.current, (ms - start) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [desk]);

  // Lo que encuentran con el visor abierto suena y brilla según su rareza (EX18).
  const seen = useRef(e.log.length);
  const [flash, setFlash] = useState<{ g: number; key: number } | null>(null);
  useEffect(() => {
    const fresh = e.log.slice(seen.current).filter((l) => l.k === 'hallazgo' || l.g);
    seen.current = e.log.length;
    if (!fresh.length) return;
    const g = Math.max(...fresh.map((l) => l.g ?? 0)) as 0 | 1 | 2 | 3;
    audio.play(GLOW_SFX[g], g === 0 ? 0.6 : 1);
    if (!g) return;
    setFlash({ g, key: Date.now() });
    const id = setTimeout(() => setFlash(null), g === 3 ? 2600 : 1500);
    return () => clearTimeout(id);
  }, [e.log.length]);

  const heroes = e.heroIds.map((id) => game.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const dist = distAt(e);
  const risk = riskNow(game, e);
  const sky = expWeather(e);
  const mats = Object.keys(e.bag.mats).filter(
    (m) => (e.bag.mats[m as Material] ?? 0) > 0,
  ) as Material[];
  const day = Math.floor(e.hours / EXP_HOURS) + 1;
  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet tripsheet expview"
        onClick={(ev) => ev.stopPropagation()}
        aria-label={t('expediciones.expeditionview.titulo', { rumbo: e.heading })}
      >
        <button
          class="btn-icon herocard-x"
          aria-label={t('expediciones.expeditionview.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class={`exp-visor ${desk ? 'is-desk' : 'is-frame'}`}>
            <canvas
              ref={canvas}
              class="exp-visor-canvas pixel"
              role="img"
              aria-label={t(`expediciones.expeditionview.ahora.${now.mode}`, { vuelta: now.home })}
            />
            {flash && (
              <span
                key={flash.key}
                class={`exp-flash glow-${flash.g}`}
                style={{ left: now.home ? '40%' : '60%' }}
                aria-hidden="true"
              />
            )}
          </div>
          <header class="qs-head">
            <span class="eyebrow">
              {t('expediciones.expeditionview.dia', { dia: day, vuelta: !!e.turn })}
            </span>
            <h3>{t('expediciones.expeditionview.titulo', { rumbo: e.heading })}</h3>
            <label class="exp-mute">
              <input
                type="checkbox"
                checked={!!e.mute}
                onChange={(ev) => onMute((ev.target as HTMLInputElement).checked)}
              />
              <Icon name={e.mute ? 'mute' : 'bell'} size={12} />
              {e.mute ? t('expediciones.carta.silenciada') : t('expediciones.carta.silenciar')}
            </label>
          </header>
          <ExpeditionCard game={game} exp={e} onChoose={onChoose} />
          <div class="chips qs-facts">
            <span class="fact">
              <Icon name="pasos" size={12} />
              {t('expediciones.expeditionview.lejos', { dias: Math.floor(dist) })}
            </span>
            <span class="fact">
              <Icon name="pan" size={12} />
              {t('expediciones.expeditionview.raciones', { n: e.rations })}
            </span>
            {sky !== 'claro' && (
              <span class="fact exp-sky">{t(`expediciones.expeditionview.tiempo.${sky}`)}</span>
            )}
            <span class={`danger danger-${dangerClass(risk)}`}>
              {t(`expediciones.expeditionview.riesgo.${risk}`)}
            </span>
          </div>
          <div class="chips exp-bag" aria-label={t('expediciones.expeditionview.mochila')}>
            <b class="qs-sub">{t('expediciones.expeditionview.mochila')}</b>
            {e.bag.gold > 0 && (
              <span class="fact">
                <Icon name="coin" size={12} />
                {e.bag.gold}
              </span>
            )}
            {mats.map((m) => (
              <span
                key={m}
                class={`fact ${glowClass(matGlow(m))}`}
                title={tx(matsMsg({ [m]: e.bag.mats[m] }))}
              >
                <MatIcon m={m} size={12} />
                {e.bag.mats[m]}
              </span>
            ))}
            {(e.bag.items ?? []).map((it) => (
              <span
                key={it.id}
                class={`fact exp-bag-item ${glowClass(itemGlow(it.rarity))}`}
                title={tx(it.name)}
              >
                <ItemImage {...itemProps(it)} scale={1} />
              </span>
            ))}
            {!e.bag.gold && !mats.length && !e.bag.items?.length && (
              <span class="tiny">{t('expediciones.expeditionview.vacia')}</span>
            )}
          </div>
          <div class="exp-crew">
            {heroes.map((h) => (
              <button key={h.id} class="exp-member" onClick={() => onHero(h.id)}>
                <Portrait
                  look={lookOf(h)}
                  marks={marksOf(h)}
                  frame={heroFrame(h)}
                  scale={1}
                  alive={false}
                />
                <span class="pick-name">{h.name.split(' ')[0]}</span>
                <LifeBar hero={h} />
              </button>
            ))}
          </div>
          <h4 class="qs-sub">{t('expediciones.expeditionview.diario')}</h4>
          <ol class="trip-log exp-log">
            {[...e.log].reverse().map((l, i) => (
              <li
                key={`${l.h}-${i}`}
                class={`exp-line is-${l.k} ${l.won === false ? 'is-bad' : ''} ${glowClass(l.g)}`}
              >
                <Icon name={KIND_ICON[l.k]} size={12} />
                <span class="exp-when">
                  {t('expediciones.expeditionview.cuando', {
                    dia: Math.floor(l.h / EXP_HOURS) + 1,
                  })}
                </span>
                <span>
                  {tx(l.t)}
                  {l.fight && (
                    <button class="btn btn-wood exp-watch" onClick={() => onWatch(l.fight!)}>
                      <Icon name="espadas" size={10} />
                      {t('expediciones.carta.ver_pelea')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {e.turn ? (
          <p class="qs-warn exp-home" role="status">
            {t('expediciones.expeditionview.de_vuelta', {
              dias: Math.floor(hoursHome(e) / EXP_HOURS),
            })}
          </p>
        ) : (
          <button class="btn btn-wood qs-send" onClick={onBack}>
            <Icon name="home" size={16} />
            {t('expediciones.expeditionview.volver')}
          </button>
        )}
      </article>
    </div>
  );
}
