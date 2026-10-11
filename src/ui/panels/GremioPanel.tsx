import { FACILITY_INFO } from '../../data/demo';
import { FACILITY_MAX, type Facilities } from '../../world/geometry';
import { Icon } from '../icons';

interface Props {
  fac: Facilities;
  focus: keyof Facilities | null;
  loot: number;
  setLoot: (n: number) => void;
  onUpgrade: (k: keyof Facilities, delta: number) => void;
}

const SCHEDULE = [
  { day: 7, amt: 150, paid: false },
  { day: 14, amt: 200, paid: false },
  { day: 21, amt: 250, paid: false },
  { day: 28, amt: 400, paid: false },
];

export function GremioPanel({ fac, focus, loot, setLoot, onUpgrade }: Props) {
  const keys = Object.keys(FACILITY_INFO) as (keyof Facilities)[];
  return (
    <>
      <div class="card-paper debt">
        <div class="debt-top">
          <h3>La deuda</h3>
          <span class="muted">con Merlo, el prestamista</span>
        </div>
        <div class="debt-num">
          <b>0</b> / 1000 pagado
        </div>
        <div class="bar">
          <i style={{ width: '0%' }} />
        </div>
        <div class="sched">
          {SCHEDULE.map((p, i) => (
            <span key={p.day} class={i === 0 ? 'next' : ''}>
              Día {p.day} · {p.amt}
            </span>
          ))}
        </div>
      </div>
      <h3 class="sec-title">Instalaciones</h3>
      <p class="panel-note">Mejora o baja niveles y mira cómo cambia la taberna (vista previa).</p>
      <div class="list">
        {keys.map((k) => {
          const level = fac[k];
          const info = FACILITY_INFO[k];
          return (
            <article key={k} class={`card-paper facility ${focus === k ? 'is-focus' : ''}`}>
              <div class="facility-info">
                <b>{info.name}</b>
                <span class="pips" aria-label={`Nivel ${level} de ${FACILITY_MAX}`}>
                  {Array.from({ length: FACILITY_MAX }, (_, i) => (
                    <i key={i} class={i < level ? 'on' : ''} />
                  ))}
                </span>
                <span class="muted">{info.levels[level]}</span>
                {level < FACILITY_MAX && (
                  <span class="next-level">Siguiente: {info.levels[level + 1]}</span>
                )}
              </div>
              <div class="stepper">
                <button
                  class="btn btn-wood"
                  aria-label={`Bajar ${info.name}`}
                  disabled={level === 0}
                  onClick={() => onUpgrade(k, -1)}
                >
                  <Icon name="minus" size={12} />
                </button>
                <button
                  class="btn btn-gold"
                  aria-label={`Mejorar ${info.name}`}
                  disabled={level === FACILITY_MAX}
                  onClick={() => onUpgrade(k, 1)}
                >
                  Mejorar
                </button>
              </div>
            </article>
          );
        })}
        <article class="card-paper facility">
          <div class="facility-info">
            <b>Arcón del botín</b>
            <span class="muted">{loot} objetos · un cofre por objeto en la bodega</span>
          </div>
          <div class="stepper">
            <button
              class="btn btn-wood"
              aria-label="Quitar objeto"
              disabled={loot === 0}
              onClick={() => setLoot(loot - 1)}
            >
              <Icon name="minus" size={12} />
            </button>
            <button
              class="btn btn-wood"
              aria-label="Añadir objeto"
              disabled={loot === 6}
              onClick={() => setLoot(loot + 1)}
            >
              <Icon name="plus" size={12} />
            </button>
          </div>
        </article>
      </div>
    </>
  );
}
