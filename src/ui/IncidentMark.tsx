import { useEffect, useRef, useState } from 'preact/hooks';
import { incidentCost, type IncidentAct } from '../core/incidents';
import type { GameState, Incident } from '../core/model';
import { INCIDENTS, type IncidentKind } from '../data/incidents';
import { Icon, type IconName } from './icons';
import type { GameScene } from './SceneView';

const ICON: Record<IncidentKind, IconName> = {
  pelea: 'espadas',
  ladron: 'cofre',
  fuego: 'olla',
  ratas: 'pan',
  recaudador: 'coin',
  gotera: 'barril',
  noble: 'jarra',
};

interface Props {
  game: GameState;
  inc: Incident;
  /** Reloj del día (s) y a qué velocidad corre, para la cuenta atrás. */
  clock: number;
  speed: number;
  scene: { current: GameScene | null };
  onAct: (act: IncidentAct) => void;
  /** Los que se resuelven arrastrando a alguien: qué hacer, y la sala a la que mirar. */
  onAsk: (text: string, room: string) => void;
}

/**
 * Aviso de un incidente colgado sobre su sala: lo que pasa, qué hacer y cuánto queda. Se mueve
 * con la cámara, como los bocadillos. Tocarlo paga, espanta, abre la elección o recuerda que
 * hay que arrastrar a alguien.
 */
export function IncidentMark({ game, inc, clock, speed, scene, onAct, onAsk }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [choose, setChoose] = useState(false);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const s = scene.current;
      const at = s?.roomTop(inc.room);
      if (el && s && at) {
        const p = s.screenOf(at.x, at.y);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [inc.id]);
  const d = INCIDENTS[inc.kind];
  const left = Math.max(0, inc.until - clock);
  const frac = Math.max(0, Math.min(1, left / Math.max(1, inc.until - inc.from)));
  const secs = Math.ceil(left / Math.max(1, speed));
  const cost = d.how === 'pagar' ? incidentCost(game, inc) : 0;
  const action =
    d.how === 'pagar'
      ? `Pagar ${cost}`
      : d.how === 'tocar'
        ? `¡Fuera! ×${inc.taps ?? 1}`
        : d.how === 'elegir'
          ? 'Decidir'
          : d.how === 'heroe'
            ? 'Arrastra a un héroe'
            : 'Arrastra a alguien';
  const tap = () => {
    if (d.how === 'pagar') onAct({ by: 'pagar' });
    else if (d.how === 'tocar') onAct({ by: 'tocar' });
    else if (d.how === 'elegir') setChoose((c) => !c);
    else onAsk(d.ask, inc.room);
  };
  return (
    <div ref={ref} class={`incident incident-${d.how}`} role="alert">
      <button
        class="incident-btn"
        data-tut="incidente"
        aria-label={`${d.title}. ${d.ask} Quedan ${secs} s.`}
        onClick={tap}
      >
        <Icon name={ICON[inc.kind]} size={18} />
        <span class="incident-text">
          <b>{d.title}</b>
          <small>
            {action} · {secs} s
          </small>
        </span>
        <span class="incident-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(frac * 100)}%` }} />
        </span>
      </button>
      {choose && d.choices && (
        <div class="incident-choices">
          {d.choices.map((c, i) => (
            <button
              key={c.label}
              class="btn btn-wood"
              disabled={!!c.gold && game.gold < -c.gold}
              onClick={() => {
                setChoose(false);
                onAct({ by: 'elegir', option: i });
              }}
            >
              {c.label}
              {c.gold ? (
                <>
                  {' '}
                  · <Icon name="coin" size={10} /> {-c.gold}
                </>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
