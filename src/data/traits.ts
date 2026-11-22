import type { Sex } from '../art/heroes/look';
import type { Trait, TraitId } from '../core/party';
import { t, tr } from '../textos';

/** Nombre, tono y descripción de cada rasgo, para mostrarlo en la interfaz. */
export const TRAIT_INFO: Record<
  TraitId,
  { m: string; f: string; tone: 'pos' | 'neg' | 'mix'; desc: string }
> = {
  valiente: {
    m: t('rasgos.rasgos.valiente.m'),
    f: t('rasgos.rasgos.valiente.f'),
    tone: 'pos',
    desc: t('rasgos.rasgos.valiente.desc'),
  },
  cobarde: {
    m: t('rasgos.rasgos.cobarde.m'),
    f: t('rasgos.rasgos.cobarde.f'),
    tone: 'mix',
    desc: t('rasgos.rasgos.cobarde.desc'),
  },
  codicioso: {
    m: t('rasgos.rasgos.codicioso.m'),
    f: t('rasgos.rasgos.codicioso.f'),
    tone: 'mix',
    desc: t('rasgos.rasgos.codicioso.desc'),
  },
  afortunado: {
    m: t('rasgos.rasgos.afortunado.m'),
    f: t('rasgos.rasgos.afortunado.f'),
    tone: 'pos',
    desc: t('rasgos.rasgos.afortunado.desc'),
  },
  gafe: {
    m: t('rasgos.rasgos.gafe.m'),
    f: t('rasgos.rasgos.gafe.f'),
    tone: 'neg',
    desc: t('rasgos.rasgos.gafe.desc'),
  },
  bebedor: {
    m: t('rasgos.rasgos.bebedor.m'),
    f: t('rasgos.rasgos.bebedor.f'),
    tone: 'neg',
    desc: t('rasgos.rasgos.bebedor.desc'),
  },
  leal: {
    m: t('rasgos.rasgos.leal.m'),
    f: t('rasgos.rasgos.leal.f'),
    tone: 'pos',
    desc: t('rasgos.rasgos.leal.desc'),
  },
  arrogante: {
    m: t('rasgos.rasgos.arrogante.m'),
    f: t('rasgos.rasgos.arrogante.f'),
    tone: 'mix',
    desc: t('rasgos.rasgos.arrogante.desc'),
  },
  supersticioso: {
    m: t('rasgos.rasgos.supersticioso.m'),
    f: t('rasgos.rasgos.supersticioso.f'),
    tone: 'neg',
    desc: t('rasgos.rasgos.supersticioso.desc'),
  },
  tuerto: {
    m: t('rasgos.rasgos.tuerto.m'),
    f: t('rasgos.rasgos.tuerto.f'),
    tone: 'mix',
    desc: t('rasgos.rasgos.tuerto.desc'),
  },
  cojo: {
    m: t('rasgos.rasgos.cojo.m'),
    f: t('rasgos.rasgos.cojo.f'),
    tone: 'neg',
    desc: t('rasgos.rasgos.cojo.desc'),
  },
  curtido: {
    m: t('rasgos.rasgos.curtido.m'),
    f: t('rasgos.rasgos.curtido.f'),
    tone: 'pos',
    desc: t('rasgos.rasgos.curtido.desc'),
  },
  cortado: {
    m: t('rasgos.rasgos.cortado.m'),
    f: t('rasgos.rasgos.cortado.f'),
    tone: 'mix',
    desc: t('rasgos.rasgos.cortado.desc'),
  },
  velo: {
    m: t('rasgos.rasgos.velo.m'),
    f: t('rasgos.rasgos.velo.f'),
    tone: 'mix',
    desc: t('rasgos.rasgos.velo.desc'),
  },
};

export const HIDDEN_TRAIT_HINT = t('rasgos.pista_oculto');

export function traitLabel(t: Trait, sex: Sex): string {
  return t.hidden ? tr('rasgos.oculto') : TRAIT_INFO[t.id][sex];
}
