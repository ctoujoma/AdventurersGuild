import type { Outcome, QuestType } from '../core/model';
import type { SkillId } from '../core/party';
import { t, tl } from '../textos';

/**
 * Frases para los informes de misión. Huecos: {h} héroe protagonista, {who} el grupo,
 * {place} lugar. Las aperturas tienen versión para uno y para varios.
 */

export const OPENERS: Record<QuestType, readonly [one: string, many: string][]> = {
  Cazar: tl<readonly [string, string][]>('relatos.comienzos.Cazar'),
  Escoltar: tl<readonly [string, string][]>('relatos.comienzos.Escoltar'),
  Explorar: tl<readonly [string, string][]>('relatos.comienzos.Explorar'),
  Recuperar: tl<readonly [string, string][]>('relatos.comienzos.Recuperar'),
  Investigar: tl<readonly [string, string][]>('relatos.comienzos.Investigar'),
  Limpiar: tl<readonly [string, string][]>('relatos.comienzos.Limpiar'),
};

export const LINES: Record<SkillId, { ok: readonly string[]; ko: readonly string[] }> = {
  Combate: {
    ok: tl('relatos.lineas.Combate.ok'),
    ko: tl('relatos.lineas.Combate.ko'),
  },
  Trampas: {
    ok: tl('relatos.lineas.Trampas.ok'),
    ko: tl('relatos.lineas.Trampas.ko'),
  },
  Arcano: {
    ok: tl('relatos.lineas.Arcano.ok'),
    ko: tl('relatos.lineas.Arcano.ko'),
  },
  Supervivencia: {
    ok: tl('relatos.lineas.Supervivencia.ok'),
    ko: tl('relatos.lineas.Supervivencia.ko'),
  },
};

export const CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': tl('relatos.cierres.brillante'),
  Éxito: tl('relatos.cierres.exito'),
  'Éxito parcial': tl('relatos.cierres.parcial'),
  Fracaso: tl('relatos.cierres.fracaso'),
  Desastre: tl('relatos.cierres.desastre'),
};

/** Una frase de ambiente para cada mañana en la taberna. */
export const FLAVOR = tl('relatos.ambiente');

/** Apodos que se ganan con una herida grave. */
export const SCARS = [
  {
    trait: 'tuerto' as const,
    nick: { m: t('relatos.cicatrices.0.nick.m'), f: t('relatos.cicatrices.0.nick.f') },
    text: t('relatos.cicatrices.0.texto'),
  },
  {
    trait: 'cojo' as const,
    nick: { m: t('relatos.cicatrices.1.nick.m'), f: t('relatos.cicatrices.1.nick.f') },
    text: t('relatos.cicatrices.1.texto'),
  },
  {
    trait: 'cortado' as const,
    nick: { m: t('relatos.cicatrices.2.nick.m'), f: t('relatos.cicatrices.2.nick.f') },
    text: t('relatos.cicatrices.2.texto'),
  },
];
