import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { BossFight, GameState } from '../core/model';
import { ESCRITORIO, MOVIL } from '../world/visor/encuadre';
import { Visor } from '../world/visor/escena';
import { replayNow } from './expedition';
import { Icon } from './icons';
import { t, tx } from '../textos';

interface Props {
  game: GameState;
  fight: BossFight;
  onClose: () => void;
}

/** Lo que dura la pelea en la repetición antes de contar cómo acabó (s). */
const REPLAY_S = 7;
const DESK = '(min-width: 1000px)';

/**
 * «Ver la pelea» de una expedición (usuario, 26 de noviembre): la misma escena que el visor en
 * directo (el paraje, la hora, el tiempo y los enemigos con su dibujo), y al acabar, cómo fue.
 * Sustituye, para las expediciones, a la pantalla de las peleas de los encargos.
 */
export function ExpFightReplay({ game, fight: f, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const desk = typeof matchMedia !== 'undefined' && matchMedia(DESK).matches;
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    const m = replayNow(game, f);
    if (!c || !ctx || !m) return;
    const enc = desk ? ESCRITORIO : MOVIL;
    c.width = enc.w;
    c.height = enc.h;
    // Al empezar, todos en pie (quién cayó se cuenta al final).
    const now = { ...m, crew: m.crew.map((h) => ({ ...h, fate: 'ok' as const })) };
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
      if (time >= REPLAY_S) {
        cancelAnimationFrame(raf);
        setDone(true);
        audio.play(f.won ? 'cheer' : 'thud', 0.6);
        return;
      }
      visor.draw(ctx, now, time);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const fell = f.heroes.filter((h) => h.fate !== 'ok').map((h) => h.name);
  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet expview exp-replay"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('expediciones.repeticion.titulo')}
      >
        <button
          class="btn-icon herocard-x"
          aria-label={t('expediciones.repeticion.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class={`exp-visor ${desk ? 'is-desk' : 'is-frame'}`}>
            <canvas ref={canvas} class="exp-visor-canvas pixel" role="img" aria-label={tx(f.foe)} />
            {done && (
              <div class={`exp-replay-end ${f.won ? 'is-won' : 'is-lost'}`} role="status">
                <b>
                  {f.won
                    ? t('expediciones.repeticion.ganan')
                    : t('expediciones.repeticion.pierden')}
                </b>
                {fell.length > 0 && (
                  <span>{t('expediciones.repeticion.caen', { quien: fell, n: fell.length })}</span>
                )}
              </div>
            )}
          </div>
          <header class="qs-head">
            <span class="eyebrow">{tx(f.where)}</span>
            <h3>{tx(f.foe)}</h3>
          </header>
          <div class="exp-replay-acts">
            <button class="btn btn-wood" onClick={() => setRun((r) => r + 1)}>
              <Icon name="espadas" size={14} /> {t('expediciones.repeticion.otra_vez')}
            </button>
            <button class="btn btn-gold" onClick={onClose}>
              {t('expediciones.repeticion.cerrar')}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
