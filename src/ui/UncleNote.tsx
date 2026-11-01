import { Icon } from './icons';
import type { Tip } from './tips';

interface Props {
  tip: Tip;
  onOk: () => void;
  onOff: () => void;
}

/** Una nota del cuaderno de Fausto: un consejo que dejó escrito, sin tapar la partida. */
export function UncleNote({ tip, onOk, onOff }: Props) {
  return (
    <aside key={tip.id} class="notebook" role="status" aria-label="Cuaderno de Fausto">
      <span class="notebook-head">
        <Icon name="libro" size={12} /> Del cuaderno de Fausto
      </span>
      <p>{tip.text}</p>
      <div class="notebook-actions">
        <button class="btn btn-gold" onClick={onOk}>
          Seguir
        </button>
        <button class="notebook-skip" onClick={onOff}>
          No leer más notas
        </button>
      </div>
    </aside>
  );
}
