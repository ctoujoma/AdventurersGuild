import { useEffect, useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { itemGlow, matGlow } from '../core/expedition';
import { matsMsg, type Material } from '../core/materials';
import type { Report } from '../core/model';
import { GLOW_SFX, glowClass, type GlowLevel } from './glow';
import { Icon } from './icons';
import { ItemImage, itemProps } from './ItemImage';
import { MatIcon } from './mats';
import { t, tx } from '../textos';

interface Props {
  report: Report;
  /** Seguir a la carta del informe. */
  onDone: () => void;
}

interface BagCard {
  key: string;
  g: GlowLevel;
  /** Para ordenar dentro de un mismo brillo (más cantidad, después). */
  n: number;
  pic: preact.ComponentChildren;
  label: string;
}

/** Entre carta y carta (s); antes de lo legendario, una pausa. */
const STEP = 0.45;
const HUSH = 1.1;

/**
 * «La mochila» (bloque 4; EX20): lo que trae una expedición, como cartas boca abajo que se dan la
 * vuelta de una en una, de menos a más; lo legendario, el último, tras una pausa y con fanfarria.
 * Tocar el montón las vuelve todas.
 */
export function ExpBag({ report: r, onDone }: Props) {
  const x = r.exp!;
  const cards = useMemo(() => {
    const out: BagCard[] = [];
    const bag = x.bag ?? { gold: 0, mats: {} };
    if (bag.gold > 0)
      out.push({
        key: 'oro',
        g: 0,
        n: bag.gold,
        pic: <Icon name="coin" size={26} />,
        label: t('expediciones.monedas', { n: bag.gold }),
      });
    for (const m of Object.keys(bag.mats) as Material[]) {
      const n = bag.mats[m] ?? 0;
      if (n > 0)
        out.push({
          key: m,
          g: matGlow(m),
          n,
          pic: <MatIcon m={m} size={26} />,
          label: tx(matsMsg({ [m]: n })),
        });
    }
    for (const it of bag.items ?? [])
      out.push({
        key: it.id,
        g: itemGlow(it.rarity),
        n: it.rarity ?? 0,
        pic: <ItemImage {...itemProps(it)} scale={2} />,
        label: tx(it.name),
      });
    return out.sort((a, b) => a.g - b.g || a.n - b.n);
  }, [r.id]);

  // Cuántas se han dado la vuelta ya.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= cards.length) return;
    const next = cards[shown]!;
    const wait = shown === 0 ? 0.6 : next.g === 3 ? HUSH : STEP;
    const id = setTimeout(() => {
      setShown((n) => n + 1);
      audio.play(GLOW_SFX[next.g], next.g ? 1 : 0.7);
    }, wait * 1000);
    return () => clearTimeout(id);
  }, [shown, cards.length]);

  const all = () => {
    if (shown >= cards.length) return;
    const g = Math.max(0, ...cards.slice(shown).map((c) => c.g)) as GlowLevel;
    setShown(cards.length);
    audio.play(GLOW_SFX[g]);
  };

  return (
    <div class="card-backdrop" onClick={onDone}>
      <article
        class="herocard letter exp-bagpage"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('expediciones.mochila.titulo')}
      >
        <div class="qs-scroll">
          <span class="eyebrow">{tx(r.title)}</span>
          <h3 class="exp-bag-title">{t('expediciones.mochila.titulo')}</h3>
          <p class="tiny exp-bag-sub">
            {t('expediciones.mochila.resumen', {
              dias: x.days ?? 1,
              lejos: Math.round(x.far ?? 0),
              record: x.record ? 'si' : 'no',
            })}
          </p>
          {cards.length ? (
            <ul class="exp-flips" onClick={all} aria-live="polite">
              {cards.map((c, i) => (
                <li
                  key={c.key}
                  class={`exp-flip ${i < shown ? 'is-up' : ''} ${glowClass(c.g)}`}
                  aria-hidden={i >= shown}
                >
                  <span class="exp-flip-back" aria-hidden="true">
                    ?
                  </span>
                  <span class="exp-flip-face">
                    {c.pic}
                    <small>{c.label}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="exp-bag-empty">{t('expediciones.mochila.vacia')}</p>
          )}
          <button class="btn btn-wood exp-bag-go" onClick={shown < cards.length ? all : onDone}>
            {shown < cards.length
              ? t('expediciones.mochila.saltar')
              : t('expediciones.mochila.carta')}
          </button>
        </div>
      </article>
    </div>
  );
}
