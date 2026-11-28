import { t, tl } from '../textos';
/**
 * Los que vienen a la taberna: cuánto gastan y lo que traen. Las cifras de cuántos vienen están
 * en core/balance.ts y las reglas en core/salon.ts.
 */
export type VisitorKind = 'campesino' | 'mercader' | 'noble' | 'espia';

export const VISITORS: Record<
  VisitorKind,
  {
    name: string;
    plural: string;
    spend: number;
    /** Propina del bien atendido: probabilidad base y tramo de monedas (ver `TIP_BASE`). */
    tip: { chance: number; min: number; max: number };
    desc: string;
  }
> = {
  campesino: {
    name: 'campesino',
    plural: 'campesinos',
    spend: 2,
    tip: { chance: 0.25, min: 1, max: 2 },
    desc: t('visitantes.visitantes.campesino.desc'),
  },
  mercader: {
    name: 'mercader',
    plural: 'mercaderes',
    spend: 5,
    tip: { chance: 0.4, min: 1, max: 4 },
    desc: t('visitantes.visitantes.mercader.desc'),
  },
  noble: {
    name: 'noble',
    plural: 'nobles',
    spend: 8,
    tip: { chance: 0.6, min: 4, max: 16 },
    desc: t('visitantes.visitantes.noble.desc'),
  },
  espia: {
    name: t('visitantes.visitantes.espia.nombre'),
    plural: t('visitantes.visitantes.espia.plural'),
    spend: 2,
    tip: { chance: 0, min: 0, max: 0 },
    desc: t('visitantes.visitantes.espia.desc'),
  },
};

/** Lo que se oye en el salón al pararse junto a una mesa. */
export const RUMORS: readonly string[] = tl('visitantes.rumores');
