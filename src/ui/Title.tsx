import { useEffect, useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { GameState } from '../core/model';
import { customOf } from '../core/game';
import { CREST_COLORS, DEFAULT_NAME } from '../data/custom';
import { crestBoard } from '../world/props';
import { BufferImage } from './BufferImage';

interface Props {
  /** Partida guardada, si la hay. */
  saved: GameState | null;
  onContinue: () => void;
  onNew: () => void;
  onSaves: () => void;
  onSettings: () => void;
}

/** Pantalla de título sobre la taberna de noche: el rótulo cae con un golpe seco. */
export function Title({ saved, onContinue, onNew, onSaves, onSettings }: Props) {
  const [confirm, setConfirm] = useState(false);
  const custom = saved ? customOf(saved) : null;
  const sign = useMemo(() => {
    const col = CREST_COLORS[custom?.color ?? 'vino'];
    return crestBoard(col.field, col.dark, custom?.symbol ?? 'jarra');
  }, [custom?.color, custom?.symbol]);

  useEffect(() => {
    const t = setTimeout(() => audio.play('impact'), 160);
    return () => clearTimeout(t);
  }, []);

  return (
    <div class="title-screen">
      <div class="title-flash" aria-hidden="true" />
      <div class="title-shake">
        <div class="title-logo">
          <span class="title-dust" aria-hidden="true" />
          <BufferImage buf={sign} scale={4} class="title-sign" />
          <span class="title-small">El Gremio de</span>
          <h1 class="title-big">Aventureros</h1>
          <span class="title-plaque">{custom?.name ?? DEFAULT_NAME}</span>
        </div>
        <nav class="title-menu" aria-label="Menú principal">
          {saved && !confirm && (
            <button class="btn btn-gold" onClick={onContinue}>
              Continuar · día {saved.day}
            </button>
          )}
          {confirm ? (
            <div class="title-confirm">
              <span>
                Ya tienes una partida en el día {saved?.day}. Si empiezas otra, se perderá (puedes
                guardarla antes).
              </span>
              <div class="herocard-actions">
                <button class="btn btn-red" onClick={onNew}>
                  Empezar otra
                </button>
                <button class="btn btn-wood" onClick={() => setConfirm(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              class={`btn ${saved ? 'btn-wood' : 'btn-gold'}`}
              onClick={() => (saved ? setConfirm(true) : onNew())}
            >
              Nueva partida
            </button>
          )}
          {!confirm && (
            <button class="btn btn-wood" onClick={onSaves}>
              Guardar y cargar
            </button>
          )}
          {!confirm && (
            <button class="btn btn-wood" onClick={onSettings}>
              Ajustes
            </button>
          )}
        </nav>
      </div>
      <span class="title-foot">Toca un botón para entrar en la taberna</span>
    </div>
  );
}
