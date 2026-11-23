import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { Material } from '../core/materials';
import type { BossFight, Custom, Hero, Report } from '../core/model';
import { EXP_HOURS } from '../core/balance';
import { CREST_COLORS, sealInitial } from '../data/custom';
import { OUTCOME_CLASS, outcomeLabel } from '../data/labels';
import { flyTo } from './coinFlight';
import { ExpBag } from './ExpBag';
import { glowClass } from './glow';
import { Icon } from './icons';
import { MatIcon, chipMat } from './mats';
import { Portrait } from './Portrait';
import { lookOf, marksOf, heroFrame } from './view';
import { t, tx } from '../textos';

interface Props {
  report: Report;
  heroes: Hero[];
  /** La taberna que firma: inicial y color del lacre. */
  seal: Custom;
  onClose: () => void;
  /** Ver (otra vez) la pelea contra el jefe, si la hubo. */
  onWatch?: () => void;
  /** Ver una pelea del diario de una expedición. */
  onWatchFight?: (f: BossFight) => void;
}

/** Informes de expedición cuya mochila ya se ha abierto (la primera vez sale antes que la carta). */
const bagSeen = new Set<string>();

/** Informes cuyos materiales ya han saltado al estante (no se repite al releerlos). */
const flown = new Set<string>();

/**
 * Los materiales del informe («+2 cuero») saltan de su chip a la pestaña Héroes, donde está el
 * estante del arcón (Héroes › Equipo), como las monedas a la caja: un dibujito por cada uno (hasta cuatro).
 */
function flyMats(root: HTMLElement): void {
  const target = document.querySelector('[data-tut="tab-heroes"]');
  if (!target) return;
  const r = target.getBoundingClientRect();
  const to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  for (const chip of root.querySelectorAll<HTMLElement>('[data-mat]')) {
    const [mat, n] = (chip.dataset.mat ?? '').split(':');
    const m = mat ? { m: mat as Material, n: Number(n) } : null;
    if (!m) continue;
    const c = chip.getBoundingClientRect();
    flyTo(
      { x: c.left + 10, y: c.top + c.height / 2 },
      target,
      to,
      Math.min(4, m.n),
      () => {
        const el = document.createElement('span');
        el.className = 'mat-fly';
        render(<MatIcon m={m.m} size={18} />, el);
        return el;
      },
      () => audio.play('select', 0.06),
    );
  }
}

/** Informe de misión como carta: quién fue, qué pasó y qué trajeron. */
export function Letter({ report: r, heroes, seal, onClose, onWatch, onWatchFight }: Props) {
  const party = r.heroIds
    .map((id) => heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h);
  // Llega deslizándose, el lacre cae con un golpe seco y al cerrar se retira.
  const [leaving, setLeaving] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  // La mochila de una expedición, antes que la carta (la primera vez; luego, con su botón).
  const [bag, setBag] = useState(() => !!r.exp?.bag && !bagSeen.has(r.id));
  if (bag) bagSeen.add(r.id);
  useEffect(() => {
    if (bag) return;
    const t = setTimeout(() => audio.play('thud', 0.35), 300);
    // Cuando ya se ha posado la carta, los materiales saltan al estante (una vez por informe).
    const f = setTimeout(() => {
      if (flown.has(r.id) || !chipsRef.current) return;
      flown.add(r.id);
      flyMats(chipsRef.current);
    }, 700);
    return () => {
      clearTimeout(t);
      clearTimeout(f);
    };
  }, [bag]);
  if (bag) return <ExpBag report={r} onDone={() => setBag(false)} />;
  const fights = (r.exp?.log ?? []).filter((l) => l.fight || l.g);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, 160);
  };
  return (
    <div class={`card-backdrop ${leaving ? 'is-leaving' : ''}`} onClick={close}>
      <article
        class="herocard letter"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Informe: ${tx(r.title)}`}
      >
        <button
          class="btn-icon herocard-x"
          data-tut="cerrar"
          aria-label={t('pantallas.letter.cerrar')}
          onClick={close}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span
            class="seal"
            aria-hidden="true"
            style={{ background: CREST_COLORS[seal.color].field }}
          >
            {sealInitial(seal.name)}
          </span>
          <span class="eyebrow">{t('pantallas.letter.informe_dia', { dia: r.day })}</span>
          <h3 class={`outcome outcome-${OUTCOME_CLASS[r.outcome]}`}>
            {r.heading
              ? tx(r.heading)
              : r.raid
                ? r.raid.won
                  ? t('pantallas.letter.asalto_repelido')
                  : t('pantallas.letter.saqueo')
                : outcomeLabel(r.outcome)}
          </h3>
          <b class="letter-title">{tx(r.title)}</b>
          <div class="letter-party">
            {party.map((h) => (
              <span
                key={h.id}
                class={`letter-hero ${h.status === 'muerto' || h.status === 'desaparecido' ? 'gone' : ''}`}
              >
                <Portrait
                  look={lookOf(h)}
                  marks={marksOf(h)}
                  frame={heroFrame(h)}
                  scale={1}
                  alive={false}
                />
                <small>{h.name}</small>
              </span>
            ))}
          </div>
          <div class="story">
            {r.body.map((p, i) => (
              <p key={i}>{tx(p)}</p>
            ))}
          </div>
          <div class="chips" ref={chipsRef}>
            {r.chips.map((c, i) => {
              const m = chipMat(c.t);
              return (
                <span
                  key={i}
                  class={`chip chip-${c.k} ${m ? 'chip-mat' : ''}`}
                  data-mat={m ? `${m.m}:${m.n}` : undefined}
                >
                  {m && <MatIcon m={m.m} size={12} />}
                  {tx(c.t)}
                </span>
              );
            })}
          </div>
          {r.exp?.bag && (
            <button class="btn btn-wood letter-watch" onClick={() => setBag(true)}>
              <Icon name="cofre" size={14} /> {t('expediciones.mochila.ver')}
            </button>
          )}
          {r.exp && fights.length > 0 && (
            <details class="letter-log">
              <summary>{t('expediciones.mochila.diario')}</summary>
              <ol class="trip-log exp-log">
                {fights.map((l, i) => (
                  <li key={`${l.h}-${i}`} class={`exp-line is-${l.k} ${glowClass(l.g)}`}>
                    <span class="exp-when">
                      {t('expediciones.expeditionview.cuando', {
                        dia: Math.floor(l.h / EXP_HOURS) + 1,
                      })}
                    </span>
                    <span>
                      {tx(l.t)}
                      {l.fight && onWatchFight && (
                        <button
                          class="btn btn-wood exp-watch"
                          onClick={() => onWatchFight(l.fight!)}
                        >
                          <Icon name="espadas" size={10} />
                          {t('expediciones.carta.ver_pelea')}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {onWatch && (
            <button class="btn btn-wood letter-watch" onClick={onWatch}>
              <Icon name="espadas" size={14} /> {t('pantallas.letter.ver_la_batalla')}
            </button>
          )}
          <p class="sign">{t('pantallas.letter.anotado_en_el_libro')}</p>
        </div>
      </article>
    </div>
  );
}
