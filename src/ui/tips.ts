import { gearInStock, roster } from '../core/game';
import type { GameState } from '../core/model';
import { MORALE_LOW } from '../core/party';

/**
 * Tutorial: notas que deja el tío Fausto en los primeros días. Cada una sale una sola vez
 * por partida, cuando se cumple su condición; se pueden apagar todas.
 */
export interface Tip {
  id: string;
  text: string;
  /** Sitio de la escena al que mirar mientras se lee. */
  focus?: string;
  when: (s: GameState) => boolean;
}

export const TIPS: readonly Tip[] = [
  {
    id: 'tablon',
    focus: 'tablon',
    text: 'Ese corcho de la sala es el tablón: ahí cuelgan los encargos. Toca uno, elige quién va y mira el riesgo antes de mandarlos. Más vale «Probable» que «Suicida».',
    when: (s) => s.day === 1 && !s.missions.length && !s.reports.length,
  },
  {
    id: 'noche',
    focus: 'puerta',
    text: 'Ya han salido. Tardan unos días en volver. Cuando no te quede nada que hacer, pulsa «Terminar día»: pasa la noche y, al amanecer, llega el correo.',
    when: (s) => s.missions.length > 0 && s.day <= 2,
  },
  {
    id: 'carta',
    text: 'Ha llegado una carta (el sobre de abajo). Cada grupo que vuelve trae su informe: léelo, que ahí se descubre de qué pasta está hecho cada uno.',
    when: (s) => s.reports.some((r) => !r.read),
  },
  {
    id: 'barra',
    focus: 'barra',
    text: 'En la barra hay gente buscando trabajo. Con dos héroes no llegarás lejos: contrata a alguien, pero mira la prima y el salario, que se paga cada semana.',
    when: (s) => s.day >= 2 && s.candidates.length > 0 && roster(s).length <= 2,
  },
  {
    id: 'pago',
    text: 'El día 7 viene Merlo a cobrar: 150 monedas más los salarios. Arriba, junto a la campana, ves cuánto falta. Si no llegas, se queda con la taberna. Y con el gato.',
    when: (s) => s.day >= 4 && s.day < 7 && s.paid === 0,
  },
  {
    id: 'gremio',
    focus: 'sala',
    text: 'Con algo ahorrado, arregla la casa desde «Gremio»: más camas, una enfermería, una taberna que dé dinero… Cada mejora se nota (y se ve).',
    when: (s) => s.day >= 3 && s.gold >= 120 && s.fac.dorm + s.fac.enf + s.fac.tab <= 2,
  },
  {
    id: 'moral',
    text: 'Alguien anda desanimado y rinde menos. Déjalo descansar en la taberna unos días, o súbele el sueldo si te lo pide. Uno harto acaba yéndose de noche.',
    when: (s) => s.heroes.some((h) => h.status === 'ok' && h.morale < MORALE_LOW),
  },
  {
    id: 'equipo',
    focus: 'bodega',
    text: 'Ha llegado equipo. Lo he colgado en el tablero de la bodega: pónselo a alguien desde su ficha. Eso sí, si cae en una misión, el objeto se pierde con él.',
    when: (s) => gearInStock(s).length > 0,
  },
  {
    id: 'trofeo',
    focus: 'sala',
    text: '¡Un trofeo! Ya cuelga en la sala. La gente viene a verlo y de paso se toma algo: más monedas cada día.',
    when: (s) => s.trophies.length > 0,
  },
];

/** La siguiente nota que toca enseñar, si alguna. */
export function nextTip(s: GameState): Tip | null {
  const seen = s.tips ?? [];
  if (seen.includes('*')) return null;
  return TIPS.find((t) => !seen.includes(t.id) && t.when(s)) ?? null;
}
