import { DUSK } from '../core/balance';
import { help } from './HoldHelp';
import { Icon } from './icons';

interface Props {
  unread: number;
  away: number;
  /** Parte del día que ha pasado (0 por la mañana, 1 de noche). */
  part: number;
  /** Ya es de noche: se puede cerrar la taberna. */
  canClose: boolean;
  /** Pasando la noche (con o sin asalto): el reloj de mañana aún no corre. */
  night?: boolean;
  pace: 1 | 2 | 4;
  onMail: () => void;
  onAway: () => void;
  onPace: () => void;
  onDusk: () => void;
  onEndDay: () => void;
}

/** Nombre de la hora del día, para el reloj de la barra. */
export function partName(part: number, dusk: number): string {
  if (part >= 1) return 'Noche';
  if (part >= dusk) return 'Anochecer';
  return part < dusk / 2 ? 'Mañana' : 'Tarde';
}

/** Barra del día sobre la escena: correo, grupos fuera, el reloj y cerrar la taberna. */
export function DayBar(p: Props) {
  const dusk = DUSK;
  const part = p.night ? 1 : p.part;
  return (
    <div class="daybar">
      <button
        class="btn-icon daybar-btn"
        aria-label={`Correo, ${p.unread} sin leer`}
        {...help('Correo: los informes de los grupos que vuelven y las cartas que llegan.')}
        onClick={p.onMail}
      >
        <Icon name="letter" size={20} />
        {p.unread > 0 && <span class="badge">{p.unread}</span>}
      </button>
      <button
        class="btn-icon daybar-btn"
        aria-label={`Fuera del gremio: ${p.away}`}
        {...help('La comarca: el mapa con los grupos de viaje, los encargos y las historias.')}
        onClick={p.onAway}
      >
        <Icon name="flag" size={20} />
        {p.away > 0 && <span class="badge badge-info">{p.away}</span>}
      </button>
      <button
        class="clock"
        aria-label={`${partName(part, dusk)}. Velocidad ×${p.pace}: toca para cambiarla`}
        data-help="El reloj del día: la caja va entregando lo de la taberna hasta el anochecer. Toca para que corra más rápido."
        onClick={p.onPace}
      >
        <span class="clock-name">{partName(part, dusk)}</span>
        <span class="clock-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(part * 100)}%` }} />
          <b style={{ left: `${dusk * 100}%` }} />
        </span>
        <span class="clock-pace">×{p.pace}</span>
      </button>
      {p.night ? null : p.canClose ? (
        <button
          class="btn btn-gold endday"
          data-help="Cierra la taberna y pasa la noche: los grupos avanzan y por la mañana llega el correo."
          onClick={p.onEndDay}
        >
          <Icon name="moon" size={18} /> Terminar día
        </button>
      ) : (
        <button
          class="btn btn-wood endday"
          data-help="Salta al anochecer: la caja entrega lo que queda del día y ya se puede cerrar."
          onClick={p.onDusk}
        >
          <Icon name="moon" size={18} /> Al anochecer
        </button>
      )}
    </div>
  );
}
