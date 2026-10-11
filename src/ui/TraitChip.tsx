import type { Sex } from '../art/heroes/look';
import type { Trait } from '../core/party';
import { HIDDEN_TRAIT_HINT, TRAIT_INFO, traitLabel } from '../data/traits';

/** Rasgo como etiqueta: verde si ayuda, rojo si estorba, ocre si depende; «¿?» si está oculto. */
export function TraitChip({ trait, sex }: { trait: Trait; sex: Sex }) {
  const info = TRAIT_INFO[trait.id];
  return (
    <span
      class={`trait ${trait.hidden ? 'trait-hidden' : `trait-${info.tone}`}`}
      title={trait.hidden ? HIDDEN_TRAIT_HINT : info.desc}
    >
      {traitLabel(trait, sex)}
    </span>
  );
}
