import { useState } from 'preact/hooks';
import type { GameState } from '../core/model';
import { payReady, type TutorialSkip, type TutorialStep } from '../core/tutorial';
import { Icon } from './icons';

interface Props {
  game: GameState;
  step: TutorialStep;
  /** Mostrar el botón (en «Objetivos», solo con el Gremio abierto). */
  ready: boolean;
  /** La nota va arriba si lo que hay que tocar está abajo. */
  up: boolean;
  /** Lo que hay que tocar está tapado: antes, cerrar lo que hay abierto. */
  closing?: boolean;
  onOk: () => void;
  /** Saltar el tiempo: hasta que vuelva el grupo, una noche o hasta el pago. */
  onSkipTime: (to: TutorialSkip) => void;
  onSkipAll: () => void;
}

const LABEL: Record<'seguir' | TutorialSkip, string> = {
  seguir: 'Seguir',
  vuelta: 'Saltar hasta que vuelvan',
  noche: 'Pasar la noche',
  pago: 'Saltar al día 7',
};

/**
 * Una página del cuaderno del tío: lo que toca hacer ahora, y su botón si no pide nada. En los
 * pasos libres, «Entendido» la pliega en la esquina (su resumen y el botón); al pasar el ratón
 * o al tocarla se lee entera.
 */
export function TutorialNote({
  game,
  step,
  ready,
  up,
  closing,
  onOk,
  onSkipTime,
  onSkipAll,
}: Props) {
  /** Paso cuya nota está plegada; si se lee entera: con el ratón encima o fijada al tocarla. */
  const [folded, setFolded] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const peek = hover || pinned;
  // Al pago solo se salta con la caja lista; si no, noche a noche (y se juega entre medias).
  const b =
    step.button === 'esperar'
      ? 'vuelta'
      : step.button === 'pago' && !payReady(game)
        ? 'noche'
        : step.button;
  const action = b && ready && (
    <button
      class="btn btn-gold"
      data-tut="nota-boton"
      onClick={() => (b === 'seguir' ? onOk() : onSkipTime(b))}
    >
      {LABEL[b]}
    </button>
  );
  if (step.free && folded === step.id)
    return (
      <aside
        key={step.id}
        class={`notebook-mini ${peek ? 'is-open' : ''}`}
        role="status"
        aria-label="Cuaderno de Fausto"
        // Solo el ratón: en una pantalla táctil, tocar ya abre y cierra.
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      >
        <button
          class="notebook-mini-head"
          aria-expanded={peek}
          onClick={() => setPinned((p) => !(p || hover))}
        >
          <Icon name="libro" size={12} />
          <span>{step.short?.(game) ?? 'Del cuaderno'}</span>
        </button>
        {peek && <p>{step.text(game)}</p>}
        {action}
      </aside>
    );
  return (
    <aside
      key={step.id}
      class={`notebook ${up ? 'up' : ''}`}
      role="status"
      aria-label="Cuaderno de Fausto"
    >
      <span class="notebook-head">
        <Icon name="libro" size={12} /> Del cuaderno de Fausto
      </span>
      <p>{step.text(game)}</p>
      {closing && (
        <p class="notebook-close">
          <Icon name="close" size={12} /> Antes, cierra lo que tienes abierto.
        </p>
      )}
      <div class="notebook-actions">
        {step.free && (
          <button
            class="btn btn-wood"
            onClick={() => {
              setFolded(step.id);
              setHover(false);
              setPinned(false);
            }}
          >
            Entendido
          </button>
        )}
        {action}
        {step.id !== 'fin' && (
          <button class="notebook-skip" onClick={onSkipAll}>
            Ya sé jugar
          </button>
        )}
      </div>
    </aside>
  );
}
