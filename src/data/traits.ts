import type { Sex } from '../art/heroes/look';
import type { Trait, TraitId } from '../core/party';

/** Nombre, tono y descripción de cada rasgo, para mostrarlo en la interfaz. */
export const TRAIT_INFO: Record<
  TraitId,
  { m: string; f: string; tone: 'pos' | 'neg' | 'mix'; desc: string }
> = {
  valiente: {
    m: 'Valiente',
    f: 'Valiente',
    tone: 'pos',
    desc: '+2 Combate. Nunca huye, aunque debería.',
  },
  cobarde: {
    m: 'Cobarde',
    f: 'Cobarde',
    tone: 'mix',
    desc: '−2 Combate. En un desastre huye… y sobrevive.',
  },
  codicioso: {
    m: 'Codicioso',
    f: 'Codiciosa',
    tone: 'mix',
    desc: 'Se queda el 10 % del oro. Rinde más si la paga es alta.',
  },
  afortunado: {
    m: 'Afortunado',
    f: 'Afortunada',
    tone: 'pos',
    desc: 'Repite una tirada fallida por misión.',
  },
  gafe: { m: 'Gafe', f: 'Gafe', tone: 'neg', desc: 'Empeora un poco todas las tiradas del grupo.' },
  bebedor: {
    m: 'Bebedor',
    f: 'Bebedora',
    tone: 'neg',
    desc: '−1 Destreza. Más moral si la taberna está mejorada.',
  },
  leal: {
    m: 'Leal',
    f: 'Leal',
    tone: 'pos',
    desc: 'Nunca deserta. Sufre el doble si cae un compañero.',
  },
  arrogante: {
    m: 'Arrogante',
    f: 'Arrogante',
    tone: 'mix',
    desc: 'No acepta ir con héroes de menor nivel.',
  },
  supersticioso: {
    m: 'Supersticioso',
    f: 'Supersticiosa',
    tone: 'neg',
    desc: '−2 Arcano. Odia las criptas.',
  },
  tuerto: {
    m: 'Tuerto',
    f: 'Tuerta',
    tone: 'mix',
    desc: 'Secuela. −1 Destreza, +1 Combate: da más miedo.',
  },
};

export const HIDDEN_TRAIT_HINT = 'Rasgo oculto: se descubre tras su primera misión';

export function traitLabel(t: Trait, sex: Sex): string {
  return t.hidden ? '¿?' : TRAIT_INFO[t.id][sex];
}
