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
        onClick={onMail}
      >
        <Icon name="letter" size={20} />
        {unread > 0 && <span class="badge">{unread}</span>}
      </button>
      <button class="btn-icon daybar-btn" aria-label={`Fuera del gremio: ${away}`} onClick={onAway}>
        <Icon name="flag" size={20} />
        {away > 0 && <span class="badge badge-info">{away}</span>}
      </button>
      <button class="btn btn-gold endday" onClick={onEndDay}>
        <Icon name="moon" size={18} /> Terminar día
      </button>
    </div>
  );
}
