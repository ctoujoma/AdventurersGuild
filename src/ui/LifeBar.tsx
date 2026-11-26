import { HP_GRAVE, HP_LIGHT } from '../core/balance';
import { healthOf, hpOf } from '../core/health';
import type { Hero } from '../core/model';
import { t } from '../textos';

/**
 * La vida bajo el retrato (al elegir quién va a un encargo o una expedición, en el visor y, sin
 * texto, en la lista de héroes): la barra con las marcas del 20 % y del 50 %, y debajo
 * cómo va (sano, herido leve, grave o en el suelo) con su tanto por ciento.
 */
export function LifeBar({ hero: h, bare = false }: { hero: Hero; bare?: boolean }) {
  const hp = hpOf(h);
  const state = hp <= 0 ? 'suelo' : healthOf(h);
  const pct = Math.round(hp * 100);
  // Discreta (bajo el retrato de la lista): solo la barra; el texto, al pasar el ratón.
  if (bare)
    return (
      <span
        class={`life life-bare life-${state}`}
        title={t(`expediciones.vida.${state}`, { sexo: h.sex, pct })}
      >
        <span class="life-track" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
      </span>
    );
  return (
    <span class={`life life-${state}`}>
      <span class="life-track" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
        <b style={{ left: `${HP_GRAVE * 100}%` }} />
        <b style={{ left: `${HP_LIGHT * 100}%` }} />
      </span>
      <span class="row-sub">{t(`expediciones.vida.${state}`, { sexo: h.sex, pct })}</span>
    </span>
  );
}
