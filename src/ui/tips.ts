import { SCHEDULE } from '../core/balance';
import { vaultFull } from '../core/vault';
import { gearInStock, roster } from '../core/game';
import { hungryTonight } from '../core/larder';
import { slotsOf, isTrainRoom } from '../core/workers';
import type { GameState } from '../core/model';
import { MORALE_LOW } from '../core/party';
import { t } from '../textos';

/**
 * Notas del cuaderno del tío Fausto: lo que dejó escrito para quien heredara la taberna. Cada
 * una sale una sola vez por partida, cuando se cumple su condición; se pueden apagar todas.
 * Las primeras (tablón, barra, pago…) las cuenta el tutorial guiado (`core/tutorial.ts`).
 */
export interface Tip {
  id: string;
  text: string;
  /** Sitio de la escena al que mirar mientras se lee. */
  focus?: string;
  when: (s: GameState) => boolean;
}

const seen = (s: GameState, id: string) => (s.tips ?? []).includes(id);
/** Días desde que se pagó la deuda (o -1 si aún no). */
const sinceOpening = (s: GameState) =>
  s.mode === 'libre' && s.opening?.seen ? s.day - s.opening.day : -1;

export const TIPS: readonly Tip[] = [
  {
    id: 'tablon',
    focus: 'tablon',
    text: t('barra.tips.el_tablon_de_encargos'),
    when: (s) => s.day === 1 && !s.missions.length && !s.reports.length,
  },
  {
    id: 'noche',
    focus: 'puerta',
    text: t('barra.tips.cuando_un_grupo_se'),
    when: (s) => s.missions.length > 0 && s.day <= 2,
  },
  {
    id: 'carta',
    text: t('barra.tips.cada_grupo_que_vuelve'),
    when: (s) => s.reports.some((r) => !r.read),
  },
  {
    id: 'barra',
    focus: 'barra',
    text: t('barra.tips.en_la_barra_hay'),
    when: (s) => s.day >= 2 && s.candidates.length > 0 && roster(s).length <= 2,
  },
  {
    id: 'pago',
    text: t('barra.tips.el_dia_viene_merlo', {
      dia: SCHEDULE[0]!.day,
      cantidad: SCHEDULE[0]!.amount,
    }),
    when: (s) => s.day >= 4 && s.day < 7 && s.paid === 0,
  },
  {
    id: 'gremio',
    focus: 'sala',
    text: t('barra.tips.cuando_tengas_algo_ahorrado'),
    when: (s) => s.day >= 3 && s.gold >= 120 && s.fac.dorm + s.fac.enf + s.fac.tab <= 2,
  },
  {
    id: 'trabajo',
    focus: 'cocina',
    text: t('barra.tips.remedios_cocina_tobias_atiende'),
    when: (s) => s.day >= 3 && s.workers.length > 0,
  },
  {
    id: 'moral',
    text: t('barra.tips.alguien_anda_desanimado_y'),
    when: (s) => s.heroes.some((h) => h.status === 'ok' && h.morale < MORALE_LOW),
  },
  {
    id: 'equipo',
    focus: 'armeria',
    text: t('barra.tips.el_equipo_que_traen'),
    when: (s) => gearInStock(s).length > 0,
  },
  {
    id: 'trofeo',
    focus: 'sala',
    text: t('barra.tips.los_trofeos_se_cuelgan'),
    when: (s) => s.trophies.length > 0,
  },
  // Al pagar la deuda: las obras se abren y el tío explica cómo encajar las salas.
  {
    id: 'obras',
    focus: 'sala',
    text: t('barra.tips.si_has_pagado_a'),
    when: (s) => sinceOpening(s) >= 0,
  },
  {
    id: 'plano',
    text: t('barra.tips.en_el_modo_obras'),
    when: (s) => seen(s, 'obras') && sinceOpening(s) >= 1,
  },
  {
    id: 'excavar',
    focus: 'bodega',
    text: t('barra.tips.debajo_del_sotano_hay'),
    when: (s) => seen(s, 'plano') && sinceOpening(s) >= 2,
  },
  {
    id: 'servicio',
    text: t('barra.tips.ahora_viene_gente_del'),
    when: (s) => seen(s, 'excavar') && sinceOpening(s) >= 3,
  },
  {
    id: 'visitas',
    focus: 'salon',
    text: t('barra.tips.la_caja_la_llenan'),
    when: (s) => s.day >= 5 && s.mode !== 'libre',
  },
  {
    id: 'comida',
    focus: 'cocina',
    text: t('barra.tips.lo_que_hace_remedios'),
    when: (s) => (s.day >= 6 && s.mode !== 'libre') || hungryTonight(s) > 0,
  },
  {
    id: 'entreno',
    text: t('barra.tips.ya_tienes_donde_entrenar'),
    when: (s) => s.building.rooms.some((r) => isTrainRoom(r.type) && slotsOf(r) > 0),
  },
  {
    id: 'tesoro',
    focus: 'cofres',
    text: t('barra.tips.todo_el_oro_se'),
    when: (s) => vaultFull(s),
  },
];

/** La siguiente nota que toca enseñar, si alguna. */
export function nextTip(s: GameState): Tip | null {
  const done = s.tips ?? [];
  if (done.includes('*')) return null;
  return TIPS.find((x) => !done.includes(x.id) && x.when(s)) ?? null;
}
