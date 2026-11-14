import { AWAY_DAY_SECONDS, DAY_SECONDS, DUSK, NIGHT_RUSH, WORK_END } from '../core/balance';
import { help } from './HoldHelp';
import { Icon } from './icons';
import { countdown } from './when';

interface Props {
  /** Parte del día que ha pasado (0 por la mañana, 1 de noche). */
  part: number;
  /** Ya es de noche: se puede cerrar la taberna. */
  canClose: boolean;
  /** Pasando la noche (con o sin asalto): el reloj de mañana aún no corre. */
  night?: boolean;
  pace: 1 | 2 | 4 | 8;
  /** «Pasar la noche» puesto: de noche el reloj corre a `NIGHT_RUSH`. */
  rushing?: boolean;
  onRushNight?: () => void;
  /** Tiempo que corre solo: sin cerrar; la barra dice cuánto falta para la noche. */
  real?: boolean;
  /** Con el tiempo que corre solo, se puede acelerar (mientras dura «La deuda» y en pruebas). */
  rush?: boolean;
  onPace: () => void;
  onDusk: () => void;
  onEndDay: () => void;
}

/** Nombre de la hora del día, para el reloj de la barra. */
export function partName(part: number, dusk: number): string {
  if (part >= WORK_END) return 'Noche';
  if (part >= dusk) return 'Anochecer';
  return part < dusk / 2 ? 'Mañana' : 'Tarde';
}

/**
 * Barra del día sobre la escena (el correo está en la campana de arriba y los grupos fuera, en
 * la pestaña Mapa): el reloj y una acción: de día, saltar al
 * anochecer; al anochecer, cerrar la taberna y pasar la noche. Con el tiempo que corre solo, en
 * vez de la acción, cuánto falta para que anochezca o caiga la noche.
 */
export function DayBar(p: Props) {
  const dusk = DUSK;
  const part = p.night ? 1 : p.part;
  // Con el tiempo que corre solo, cuánto falta para el anochecer o para la noche.
  const night = part >= WORK_END;
  const speed = night && p.rushing ? NIGHT_RUSH : p.real && !p.rush ? 1 : p.pace;
  const toDusk = ((dusk - part) * DAY_SECONDS) / speed;
  const toNight = ((WORK_END - part) * DAY_SECONDS) / speed;
  const toDawn = ((1 - part) * DAY_SECONDS) / speed;
  const slow = Math.round(AWAY_DAY_SECONDS / DAY_SECONDS);
  return (
    <div class="daybar">
      {p.real && !p.rush ? (
        <span
          class="clock clock-real"
          aria-label={partName(part, dusk)}
          {...help(
            `El reloj del día corre solo y la noche cae sola. Con el juego cerrado la taberna sigue, ${slow} veces más despacio, y al volver te cuenta lo que ha pasado.`,
          )}
        >
          <Icon name="reloj" size={14} />
          <span class="clock-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(part * 100)}%` }} />
            <b style={{ left: `${dusk * 100}%` }} />
          </span>
        </span>
      ) : (
        <button
          class="clock"
          aria-label={`${partName(part, dusk)}. Velocidad ×${p.pace}: toca para cambiarla`}
          data-help={
            p.real
              ? 'El reloj del día corre solo. Mientras pagas la deuda puedes acelerarlo: toca para cambiar la velocidad.'
              : 'El reloj del día: la caja va entregando lo de la taberna hasta el anochecer. Toca para que corra más rápido.'
          }
          onClick={p.onPace}
        >
          <Icon name="reloj" size={14} />
          <span class="clock-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(part * 100)}%` }} />
            <b style={{ left: `${dusk * 100}%` }} />
          </span>
          <span class="clock-pace">×{p.pace}</span>
        </button>
      )}
      {p.night ? null : night && p.onRushNight && (p.real || !p.canClose) ? (
        <button
          class={`btn ${p.rushing ? 'btn-gold' : 'btn-wood'} endday`}
          aria-pressed={!!p.rushing}
          data-help={`Pasar la noche: el reloj corre ×${NIGHT_RUSH} hasta el amanecer. Si hay asalto, empieza a su ritmo.`}
          onClick={p.onRushNight}
        >
          <Icon name="moon" size={18} />
          {p.rushing ? (
            <>
              ×{NIGHT_RUSH} · {countdown(toDawn)}
            </>
          ) : (
            <>Pasar la noche</>
          )}
        </button>
      ) : p.real ? (
        <span class="daybar-left" aria-live="off">
          <Icon name={part < dusk ? 'reloj' : 'moon'} size={16} />
          <span class="daybar-word">{part < dusk ? 'Anochece en' : 'Noche en'}</span>
          {countdown(part < dusk ? toDusk : toNight)}
        </span>
      ) : p.canClose ? (
        <button
          class="btn btn-gold endday"
          data-help="Cerrar: cierra la taberna y pasa la noche. Los grupos avanzan y por la mañana llegan los informes."
          onClick={p.onEndDay}
        >
          <Icon name="moon" size={18} /> Cerrar
        </button>
      ) : (
        <button
          class="btn btn-wood endday"
          data-help="Anochecer: salta al final del día. La caja entrega lo que queda y ya se puede cerrar."
          onClick={p.onDusk}
        >
          <Icon name="reloj" size={18} /> Anochecer
        </button>
      )}
    </div>
  );
}
