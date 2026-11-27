import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { BossFight, GameState } from '../core/model';
import { ESCRITORIO, type Encuadre, encuadre } from '../world/visor/encuadre';
import { Visor } from '../world/visor/escena';
import { WIN_AFTER, fightSpan } from '../world/visor/gente';
import { replayNow } from './expedition';
import { Icon } from './icons';
import { t, tx } from '../textos';

interface Props {
  game: GameState;
  fight: BossFight;
  onClose: () => void;
}

/** Pantalla apaisada: el encuadre ancho del escritorio; vertical (móvil de pie): el cuadro. */
const WIDE = '(min-aspect-ratio: 1/1)';

/**
 * De pie, el cuadro del móvil (156 de ancho) estirado hacia arriba hasta llenar el alto que hay
 * (más cielo y más suelo), entre el cuadro de siempre (140) y 260.
 */
function tallFrame(): Encuadre {
  const w = Math.max(1, innerWidth - 48);
  const h = Math.max(1, innerHeight - 150);
  const tall = Math.round(Math.min(260, Math.max(140, (156 * h) / w)));
  return encuadre(156, tall, 0.42, 0.58, 0.76);
}

/**
 * «Ver la pelea» de una expedición (usuario, 26 de noviembre): la misma escena que el visor en
 * directo (el paraje, la hora, el tiempo y los enemigos con su dibujo), y al acabar, cómo fue.
 * Sustituye, para las expediciones, a la pantalla de las peleas de los encargos. En una ventana
 * flotante centrada, la pelea tan grande como quepa (usuario, 27 de noviembre).
 */
export function ExpFightReplay({ game, fight: f, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const desk = typeof matchMedia !== 'undefined' && matchMedia(WIDE).matches;
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    const m = replayNow(game, f);
    if (!c || !ctx || !m) return;
    const enc = desk ? ESCRITORIO : tallFrame();
    c.width = enc.w;
    c.height = enc.h;
    c.style.setProperty('--replay-ar', `${enc.w} / ${enc.h}`);
    c.style.setProperty('--replay-arn', String(enc.w / enc.h));
    // Al empezar, todos en pie (quién cayó se cuenta al final).
    const now = { ...m, crew: m.crew.map((h) => ({ ...h, fate: 'ok' as const })) };
    // La pelea entera (hasta que caen los que caen por turnos) y, si ganan, como en directo: los
    // que quedan caen y el grupo lo celebra; luego, el cartel.
    const span = fightSpan(now);
    const end = span + (f.won ? WIN_AFTER : 0.6);
    const after = { ...now, mode: 'walk' as const };
    const visor = new Visor(enc);
    setDone(false);
    audio.play('horn', 0.5);
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      const tick = Math.floor((ms - start) / 83);
      if (tick === last) return;
      last = tick;
      const time = (ms - start) / 1000;
      if (time >= end) {
        cancelAnimationFrame(raf);
        setDone(true);
        audio.play(f.won ? 'cheer' : 'thud', 0.6);
        return;
      }
      visor.draw(ctx, time < span || !f.won ? now : after, time);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const fell = f.heroes.filter((h) => h.fate !== 'ok').map((h) => h.name);
  return (
    <div class="card-backdrop replay-backdrop" onClick={onClose}>
      <article
        class={`replay-win ${desk ? 'is-wide' : 'is-tall'}`}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('expediciones.repeticion.titulo')}
      >
        <header class="replay-head">
          <span class="eyebrow">{tx(f.where)}</span>
          <h3>{tx(f.foe)}</h3>
          <button
            class="btn-icon replay-x"
            aria-label={t('expediciones.repeticion.cerrar')}
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        <div class="replay-stage">
          <canvas ref={canvas} class="replay-canvas pixel" role="img" aria-label={tx(f.foe)} />
          {done && (
            <div class={`exp-replay-end ${f.won ? 'is-won' : 'is-lost'}`} role="status">
              <b>
                {f.won ? t('expediciones.repeticion.ganan') : t('expediciones.repeticion.pierden')}
              </b>
              {fell.length > 0 && (
                <span>{t('expediciones.repeticion.caen', { quien: fell, n: fell.length })}</span>
              )}
            </div>
          )}
        </div>
        <div class="exp-replay-acts">
          <button class="btn btn-wood" onClick={() => setRun((r) => r + 1)}>
            <Icon name="espadas" size={14} /> {t('expediciones.repeticion.otra_vez')}
          </button>
          <button class="btn btn-gold" onClick={onClose}>
            {t('expediciones.repeticion.cerrar')}
          </button>
        </div>
      </article>
    </div>
  );
}
