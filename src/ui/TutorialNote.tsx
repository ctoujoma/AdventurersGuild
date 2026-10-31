import { UNCLE } from '../art/heroes/uncle';
import type { GameState } from '../core/model';
import { STEPS, type TutorialStep } from '../core/tutorial';
import { Portrait } from './Portrait';

interface Props {
  game: GameState;
  step: TutorialStep;
  onOk: () => void;
  /** Saltar el tiempo: hasta que vuelva el grupo o hasta el pago. */
  onSkipTime: (to: 'vuelta' | 'pago') => void;
  onSkipAll: () => void;
}

const LABEL = {
  ok: 'Vale',
  luego: 'Luego',
  esperar: 'Saltar hasta que vuelvan',
  pago: 'Saltar al día 7',
};

/** Nota del tutorial: lo que pide el tío en este paso, con su botón si lo tiene. */
export function TutorialNote({ game, step, onOk, onSkipTime, onSkipAll }: Props) {
  const n = game.tutorial!.step + 1;
  const b = step.button;
  return (
    <aside
      key={step.id}
      class="uncle-note tutorial-note"
      role="status"
      aria-label={`Lección ${n} de ${STEPS.length}`}
    >
      <Portrait look={UNCLE} scale={1} alive />
      <div class="uncle-body">
        <small class="tutorial-count">
          Lección {n} de {STEPS.length}
        </small>
        <p>{step.text(game)}</p>
        <div class="uncle-actions">
          {b && (
            <button
              class="btn btn-gold"
              onClick={() =>
                b === 'esperar' ? onSkipTime('vuelta') : b === 'pago' ? onSkipTime('pago') : onOk()
              }
            >
              {LABEL[b]}
            </button>
          )}
          {step.id !== 'fin' && (
            <button class="uncle-off" onClick={onSkipAll}>
              Saltar lecciones
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
