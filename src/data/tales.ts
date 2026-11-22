import type { Outcome, QuestType } from '../core/model';
import type { ClassId, SkillId, TraitId } from '../core/party';
import { tl } from '../textos';

/**
 * Más frases para los informes: variantes extra de las de `stories.ts` y capas nuevas
 * (clase, rasgo, sucesos en ruta, piques entre compañeros, moral y cliente).
 * Huecos: {h} protagonista, {a} y {b} dos del grupo, {who} el grupo, {place} lugar,
 * {client} quien hizo el encargo, {gold} monedas. Frases neutras de género siempre que se pueda.
 */

export const MORE_OPENERS: Record<QuestType, readonly [one: string, many: string][]> = {
  Cazar: tl<readonly [string, string][]>('relatos.mas_comienzos.Cazar'),
  Escoltar: tl<readonly [string, string][]>('relatos.mas_comienzos.Escoltar'),
  Explorar: tl<readonly [string, string][]>('relatos.mas_comienzos.Explorar'),
  Recuperar: tl<readonly [string, string][]>('relatos.mas_comienzos.Recuperar'),
  Investigar: tl<readonly [string, string][]>('relatos.mas_comienzos.Investigar'),
  Limpiar: tl<readonly [string, string][]>('relatos.mas_comienzos.Limpiar'),
};

export const MORE_LINES: Record<SkillId, { ok: readonly string[]; ko: readonly string[] }> = {
  Combate: {
    ok: tl('relatos.mas_lineas.Combate.ok'),
    ko: tl('relatos.mas_lineas.Combate.ko'),
  },
  Trampas: {
    ok: tl('relatos.mas_lineas.Trampas.ok'),
    ko: tl('relatos.mas_lineas.Trampas.ko'),
  },
  Arcano: {
    ok: tl('relatos.mas_lineas.Arcano.ok'),
    ko: tl('relatos.mas_lineas.Arcano.ko'),
  },
  Supervivencia: {
    ok: tl('relatos.mas_lineas.Supervivencia.ok'),
    ko: tl('relatos.mas_lineas.Supervivencia.ko'),
  },
};

/** Cuando el protagonista de un desafío es de una clase, a veces lo cuenta a su manera. */
export const CLASS_LINES: Record<ClassId, { ok: readonly string[]; ko: readonly string[] }> = {
  guerrero: {
    ok: tl('relatos.por_clase.guerrero.ok'),
    ko: tl('relatos.por_clase.guerrero.ko'),
  },
  picaro: {
    ok: tl('relatos.por_clase.picaro.ok'),
    ko: tl('relatos.por_clase.picaro.ko'),
  },
  mago: {
    ok: tl('relatos.por_clase.mago.ok'),
    ko: tl('relatos.por_clase.mago.ko'),
  },
  clerigo: {
    ok: tl('relatos.por_clase.clerigo.ok'),
    ko: tl('relatos.por_clase.clerigo.ko'),
  },
  explorador: {
    ok: tl('relatos.por_clase.explorador.ok'),
    ko: tl('relatos.por_clase.explorador.ko'),
  },
};

/** Apartes por rasgo: dan color y, si el rasgo está oculto, son una pista. */
export const TRAIT_LINES: Partial<Record<TraitId, readonly string[]>> = {
  velo: tl('relatos.por_rasgo.velo'),
  valiente: tl('relatos.por_rasgo.valiente'),
  cobarde: tl('relatos.por_rasgo.cobarde'),
  codicioso: tl('relatos.por_rasgo.codicioso'),
  afortunado: tl('relatos.por_rasgo.afortunado'),
  gafe: tl('relatos.por_rasgo.gafe'),
  bebedor: tl('relatos.por_rasgo.bebedor'),
  leal: tl('relatos.por_rasgo.leal'),
  arrogante: tl('relatos.por_rasgo.arrogante'),
  supersticioso: tl('relatos.por_rasgo.supersticioso'),
  tuerto: tl('relatos.por_rasgo.tuerto'),
  cojo: tl('relatos.por_rasgo.cojo'),
  cortado: tl('relatos.por_rasgo.cortado'),
};

/** Sucesos del camino, sin consecuencias. */
export const ROAD: readonly string[] = tl('relatos.camino');

/** Hallazgos del camino: unas monedas extra para la caja. */
export const FINDS: readonly string[] = tl('relatos.hallazgos');

/** Piques y complicidades entre dos del grupo. */
export const BANTER: readonly string[] = tl('relatos.piques');

/** Cuando alguien del grupo va desanimado. */
export const LOW_MORALE: readonly string[] = tl('relatos.desanimados');

/** Cuando alguien va animado. */
export const HIGH_MORALE: readonly string[] = tl('relatos.animados');

/** Cierres que hablan del cliente. */
export const CLIENT_CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': tl('relatos.cierres_cliente.brillante'),
  Éxito: tl('relatos.cierres_cliente.exito'),
  'Éxito parcial': tl('relatos.cierres_cliente.parcial'),
  Fracaso: tl('relatos.cierres_cliente.fracaso'),
  Desastre: tl('relatos.cierres_cliente.desastre'),
};

export const MORE_CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': tl('relatos.mas_cierres.brillante'),
  Éxito: tl('relatos.mas_cierres.exito'),
  'Éxito parcial': tl('relatos.mas_cierres.parcial'),
  Fracaso: tl('relatos.mas_cierres.fracaso'),
  Desastre: tl('relatos.mas_cierres.desastre'),
};

/** Cómo se cuenta que ha salido a la luz un rasgo oculto ({t}). */
export const REVEALS: readonly string[] = tl('relatos.revelar');

/** Cuando el protagonista lleva un objeto bueno o legendario ({item}). */
export const ITEM_LINES: readonly string[] = tl('relatos.por_objeto');
