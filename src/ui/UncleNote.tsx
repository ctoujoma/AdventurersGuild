import { UNCLE } from '../art/heroes/uncle';
import { Portrait } from './Portrait';
import type { Tip } from './tips';

interface Props {
  tip: Tip;
  onOk: () => void;
  onOff: () => void;
}

/** Nota del tío Fausto: un consejo del tutorial, sin tapar la partida. */
export function UncleNote({ tip, onOk, onOff }: Props) {
  return (
    <aside key={tip.id} class="uncle-note" role="status" aria-label="Nota del tío Fausto">
      <Portrait look={UNCLE} scale={1} alive />
      <div class="uncle-body">
        <p>{tip.text}</p>
        <div class="uncle-actions">
          <button class="btn btn-gold" onClick={onOk}>
            Vale
          </button>
          <button class="uncle-off" onClick={onOff}>
            No más consejos
          </button>
        </div>
      </div>
    </aside>
  );
}
