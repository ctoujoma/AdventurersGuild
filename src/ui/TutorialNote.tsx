import type { GameState } from '../core/model';
import type { TutorialStep } from '../core/tutorial';
import { Icon } from './icons';

interface Props {
  game: GameState;
  step: TutorialStep;
  /** Mostrar el botón (en «Objetivos», solo con el Gremio abierto). */
  ready: boolean;
  /** La nota va arriba si lo que hay que tocar está abajo. */
  up: boolean;
  onOk: () => void;
  /** Saltar el tiempo: hasta que vuelva el grupo o hasta el pago. */
  onSkipTime: (to: 'vuelta' | 'pago') => void;
  onSkipAll: () => void;
}

const LABEL = { seguir: 'Seguir', esperar: 'Saltar hasta que vuelvan', pago: 'Saltar al día 7' };

/** Una página del cuaderno del tío: lo que toca hacer ahora, y su botón si no pide nada. */
export function TutorialNote({ game, step, ready, up, onOk, onSkipTime, onSkipAll }: Props) {
  const b = step.button;
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
      <div class="notebook-actions">
        {b && ready && (
          <button
            class="btn btn-gold"
            data-tut="nota-boton"
            onClick={() =>
              b === 'esperar' ? onSkipTime('vuelta') : b === 'pago' ? onSkipTime('pago') : onOk()
            }
          >
            {LABEL[b]}
          </button>
        )}
        {step.id !== 'fin' && (
          <button class="notebook-skip" onClick={onSkipAll}>
            Ya sé jugar
          </button>
        )}
      </div>
    </aside>
  );
}
