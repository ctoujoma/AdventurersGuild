import { Icon } from './icons';
import type { Tip } from './tips';
import { t } from '../textos';

interface Props {
  tip: Tip;
  onOk: () => void;
  onOff: () => void;
}

/** Una nota del cuaderno de Fausto: un consejo que dejó escrito, sin tapar la partida. */
export function UncleNote({ tip, onOk, onOff }: Props) {
  return (
    <aside
      key={tip.id}
      class="notebook"
      role="status"
      aria-label={t('pantallas.unclenote.cuaderno_de_fausto')}
    >
      <span class="notebook-head">
        <Icon name="libro" size={12} /> {t('pantallas.unclenote.del_cuaderno_de_fausto')}
      </span>
      <p>{tip.text}</p>
      <div class="notebook-actions">
        <button class="btn btn-gold" onClick={onOk}>
          {t('pantallas.unclenote.seguir')}
        </button>
        <button class="notebook-skip" onClick={onOff}>
          {t('pantallas.unclenote.no_leer_mas_notas')}
        </button>
      </div>
    </aside>
  );
}
