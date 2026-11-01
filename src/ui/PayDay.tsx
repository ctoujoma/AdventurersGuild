import { useEffect, useMemo, useState } from 'preact/hooks';
import { generateLook } from '../art/heroes/look';
import { audio } from '../audio/audio';
import { DEBT, SCHEDULE } from '../core/balance';
import { roster } from '../core/game';
import type { GameState } from '../core/model';
import { Counter } from './Counter';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { lookOf, workerLook } from './view';

type Phase = 'in' | 'coins' | 'stamp' | 'bar' | 'done';

/** Lo que dura cada parte (ms). Los salarios del modo libre van más deprisa. */
const STEPS: Record<'merlo' | 'sueldos', [Phase, number][]> = {
  merlo: [
    ['in', 650],
    ['coins', 1500],
    ['stamp', 700],
    ['bar', 1000],
  ],
  sueldos: [
    ['in', 400],
    ['coins', 1000],
    ['stamp', 600],
  ],
};

/** Merlo: el prestamista, de mercader, con barba y sombrero. */
const MERLO = {
  ...generateLook('merlo-prestamista', 'mercader', 'm'),
  beard: true,
  headgear: 'sombrero' as const,
  brow: 'arqueada' as const,
  mouth: 'sonrisa' as const,
  hairStyle: 'calvo' as const,
};

const SAYS = [
  '«Puntual. Así me gusta.»',
  '«Ni una moneda de menos. Hasta la próxima, sobrino.»',
  '«Tu tío nunca pagaba a la primera. Vas mejorando.»',
  '«Cuento rápido, no te preocupes. Bueno, cuento dos veces.»',
];

const COINS = 10;

/**
 * El cobro del día de pago, antes de la carta del amanecer. Con deuda viene Merlo: las monedas
 * saltan de la caja a su bolsa, cae el sello de «Pagado» y la barra de la deuda avanza. En el
 * modo libre es más corto: los salarios van a la gente de la casa. Tocar adelanta hasta el final.
 */
export function PayDay({ game, onClose }: { game: GameState; onClose: () => void }) {
  const pay = game.payday!;
  const kind = pay.debt ? 'merlo' : 'sueldos';
  const total = pay.debt + pay.wages;
  const [phase, setPhase] = useState<Phase>('in');
  const after = game.paid;
  const before = after - pay.debt;
  const cleared = !!pay.debt && after >= DEBT;
  const next = SCHEDULE.find((p) => p.day > pay.day);
  const says = useMemo(
    () =>
      cleared
        ? '«Pues ya está. Nunca pensé que lo vería. La taberna es tuya… hasta que me pidas otro préstamo.»'
        : SAYS[pay.day % SAYS.length]!,
    [],
  );
  const crew = useMemo(
    () => [
      ...roster(game)
        .filter((h) => h.status !== 'muerto')
        .map((h) => ({ id: h.id, look: lookOf(h) })),
      ...game.workers.map((w) => ({ id: w.id, look: workerLook(w) })),
    ],
    [],
  );

  // Las partes, una tras otra, cada una con su sonido.
  useEffect(() => {
    if (phase === 'done') return;
    const steps = STEPS[kind];
    const i = steps.findIndex(([p]) => p === phase);
    const [, ms] = steps[i]!;
    const timers: number[] = [];
    if (phase === 'coins')
      for (let c = 0; c < COINS; c++)
        timers.push(window.setTimeout(() => audio.play('coin', 0.35), 350 + c * 90));
    if (phase === 'stamp') audio.play('thud');
    if (phase === 'bar') audio.play(cleared ? 'cheer' : 'build', 0.6);
    timers.push(window.setTimeout(() => setPhase(steps[i + 1]?.[0] ?? 'done'), ms));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const reached = (p: Phase) => {
    const order: Phase[] = ['in', 'coins', 'stamp', 'bar', 'done'];
    return order.indexOf(phase) >= order.indexOf(p);
  };
  const skip = () => {
    if (phase !== 'done') setPhase('done');
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      if (phase === 'done') onClose();
      else skip();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase]);

  const gold = reached('coins') ? game.gold : game.gold + total;
  const paid = reached('bar') ? after : before;
  return (
    <div class={`payday payday-${kind} is-${phase}`} role="dialog" aria-label="Día de pago">
      <div class="payday-dim" />
      <section class="payday-card" onClick={skip}>
        <header class="payday-head">
          <span class="payday-day">Día {pay.day}</span>
          <h2>{kind === 'merlo' ? 'Viene Merlo a cobrar' : 'Día de salarios'}</h2>
        </header>

        <div class="payday-stage">
          <div class="payday-from">
            <span class="payday-chest">
              <Icon name="cofre" size={40} />
            </span>
            <span class="payday-gold">
              <Icon name="coin" size={14} />
              <Counter value={gold} />
            </span>
            <small>La caja</small>
          </div>

          <div class="payday-track" aria-hidden="true">
            {phase === 'coins' &&
              Array.from({ length: COINS }, (_, c) => (
                <span key={c} class="payday-coin" style={{ '--c': c }}>
                  <i>
                    <Icon name="coin" size={16} />
                  </i>
                </span>
              ))}
          </div>

          <div class="payday-to">
            {kind === 'merlo' ? (
              <>
                <span class="payday-merlo">
                  <Portrait look={MERLO} scale={2} label="Merlo, el prestamista" />
                  <span class="payday-bag">
                    <Icon name="cofre" size={18} />
                  </span>
                </span>
                <small>Merlo</small>
              </>
            ) : (
              <>
                <span class="payday-crew">
                  {crew.slice(0, 4).map((p) => (
                    <Portrait key={p.id} look={p.look} scale={1} alive={false} />
                  ))}
                </span>
                <small>La gente de la casa</small>
              </>
            )}
          </div>

          {reached('stamp') && (
            <span class="payday-stamp" aria-hidden="true">
              Pagado
            </span>
          )}
        </div>

        <ul class="payday-bill">
          {pay.debt > 0 && (
            <li>
              <span>Cuota de la deuda</span>
              <b>{pay.debt}</b>
            </li>
          )}
          <li>
            <span>Salarios</span>
            <b>{pay.wages}</b>
          </li>
          <li class="payday-total">
            <span>Total</span>
            <b>
              <Icon name="coin" size={12} /> {total}
            </b>
          </li>
        </ul>

        {kind === 'merlo' && (
          <div class={`payday-debt ${reached('bar') ? 'is-moving' : ''}`}>
            <div class="debt-top">
              <b>{cleared && reached('bar') ? '¡Deuda saldada!' : 'Deuda con Merlo'}</b>
              <span class="debt-num">
                <Counter value={paid} /> / {DEBT}
              </span>
            </div>
            <div class="bar">
              <i style={{ width: `${(paid / DEBT) * 100}%` }} />
            </div>
          </div>
        )}

        {reached('stamp') && (
          <p class="payday-says">
            {kind === 'merlo' ? says : '«Cada uno con lo suyo. La casa sigue en pie.»'}
          </p>
        )}
        {phase === 'done' && kind === 'merlo' && next && !cleared && (
          <p class="payday-next">
            Próximo pago: día {next.day}, {next.amount} más los salarios.
          </p>
        )}

        <button
          class={`btn btn-wood payday-go ${phase === 'done' ? '' : 'is-waiting'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (phase === 'done') onClose();
            else skip();
          }}
        >
          {phase === 'done' ? 'Seguir' : 'Saltar'}
        </button>
      </section>
    </div>
  );
}
