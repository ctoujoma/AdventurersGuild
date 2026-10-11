import { FACILITY_MAX, type Facilities } from '../../art/tavern/layout';
import type { TavernModel } from '../../art/tavern/scene';
import { FACILITY_INFO } from '../../data/demo';
import { TavernView } from '../TavernView';

interface Props {
  model: TavernModel;
  fac: Facilities;
  setFac: (f: Facilities) => void;
  loot: number;
  setLoot: (n: number) => void;
}

export function Gremio({ model, fac, setFac, loot, setLoot }: Props) {
  const keys = Object.keys(FACILITY_INFO) as (keyof Facilities)[];
  return (
    <>
      <TavernView model={model} />
      <section class="sec">
        <h2>Instalaciones</h2>
        <p class="hint">Vista previa: sube y baja niveles para ver cómo cambia la taberna.</p>
        {keys.map((k) => {
          const level = fac[k];
          return (
            <article class="card facility" key={k}>
              <div>
                <b>{FACILITY_INFO[k].name}</b>
                <span class="pips" aria-label={`Nivel ${level} de ${FACILITY_MAX}`}>
                  {Array.from({ length: FACILITY_MAX }, (_, i) => (
                    <i key={i} class={i < level ? 'on' : ''} />
                  ))}
                </span>
                <div class="muted">{FACILITY_INFO[k].levels[level]}</div>
              </div>
              <div class="stepper">
                <button
                  class="btn"
                  aria-label={`Bajar ${FACILITY_INFO[k].name}`}
                  disabled={level === 0}
                  onClick={() => setFac({ ...fac, [k]: level - 1 })}
                >
                  −
                </button>
                <button
                  class="btn primary"
                  aria-label={`Mejorar ${FACILITY_INFO[k].name}`}
                  disabled={level === FACILITY_MAX}
                  onClick={() => setFac({ ...fac, [k]: level + 1 })}
                >
                  +
                </button>
              </div>
            </article>
          );
        })}
        <article class="card facility">
          <div>
            <b>Arcón del botín</b>
            <div class="muted">{loot} objetos · un cofre por objeto en la bodega</div>
          </div>
          <div class="stepper">
            <button class="btn" disabled={loot === 0} onClick={() => setLoot(loot - 1)}>
              −
            </button>
            <button class="btn primary" disabled={loot === 6} onClick={() => setLoot(loot + 1)}>
              +
            </button>
          </div>
        </article>
      </section>
    </>
  );
}
