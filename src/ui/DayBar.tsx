import { help } from './HoldHelp';
import { Icon } from './icons';

interface Props {
  unread: number;
  away: number;
  onMail: () => void;
  onAway: () => void;
  onEndDay: () => void;
}

/** Barra del día sobre la escena: correo, grupos fuera y «Terminar día». */
export function DayBar({ unread, away, onMail, onAway, onEndDay }: Props) {
  return (
    <div class="daybar">
      <button
        class="btn-icon daybar-btn"
        aria-label={`Correo, ${unread} sin leer`}
        {...help('Correo: los informes de los grupos que vuelven y las cartas que llegan.')}
        onClick={onMail}
      >
        <Icon name="letter" size={20} />
        {unread > 0 && <span class="badge">{unread}</span>}
      </button>
      <button
        class="btn-icon daybar-btn"
        aria-label={`Fuera del gremio: ${away}`}
        {...help('La comarca: el mapa con los grupos de viaje, los encargos y las historias.')}
        onClick={onAway}
      >
        <Icon name="flag" size={20} />
        {away > 0 && <span class="badge badge-info">{away}</span>}
      </button>
      <button
        class="btn btn-gold endday"
        data-help="Pasa la noche: los grupos avanzan, se cobra la taberna y por la mañana llega el correo."
        onClick={onEndDay}
      >
        <Icon name="moon" size={18} /> Terminar día
      </button>
    </div>
  );
}
