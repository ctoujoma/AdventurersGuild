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
    text: 'El corcho de la sala es el tablón, donde se cuelgan los encargos. Toca uno, elige a quién mandas y fíjate en el riesgo. Mejor «Probable» que «Suicida».',
    when: (s) => s.day === 1 && !s.missions.length && !s.reports.length,
  },
  {
    id: 'noche',
    focus: 'puerta',
    text: 'Ya se han ido y tardarán unos días en volver. Cuando no tengas nada más que hacer, pulsa «Terminar día». Por la mañana llega el correo.',
    when: (s) => s.missions.length > 0 && s.day <= 2,
  },
  {
    id: 'carta',
    text: 'Tienes carta (el sobre de abajo). Cada grupo que vuelve manda su informe. Léelo, que ahí se ve de qué pasta está hecho cada cual.',
    when: (s) => s.reports.some((r) => !r.read),
  },
  {
    id: 'barra',
    focus: 'barra',
    text: 'En la barra hay gente que busca trabajo. Con dos héroes no vas a ningún lado, así que contrata a alguien. Mira bien la prima y el salario, que se paga cada semana.',
    when: (s) => s.day >= 2 && s.candidates.length > 0 && roster(s).length <= 2,
  },
  {
    id: 'pago',
    text: 'El día 7 viene Merlo a cobrar 150 monedas, más los salarios. Lo que te falta lo tienes arriba, junto a la campana. Si no llegas, se queda la taberna, gato incluido.',
    when: (s) => s.day >= 4 && s.day < 7 && s.paid === 0,
  },
  {
    id: 'gremio',
    focus: 'sala',
    text: 'Cuando tengas algo ahorrado, arregla la casa desde «Gremio». Más camas, una enfermería, una taberna que deje dinero. Todo sirve para algo y luce en la casa.',
    when: (s) => s.day >= 3 && s.gold >= 120 && s.fac.dorm + s.fac.enf + s.fac.tab <= 2,
  },
  {
    id: 'moral',
    text: 'Alguien anda desanimado y rinde menos. Déjalo descansar en la taberna unos días, o súbele el sueldo si te lo pide. El que está harto se larga cualquier noche.',
    when: (s) => s.heroes.some((h) => h.status === 'ok' && h.morale < MORALE_LOW),
  },
  {
    id: 'equipo',
    focus: 'bodega',
    text: 'Ha llegado equipo y lo he colgado en el tablero de la bodega. Dáselo a alguien desde su ficha. Eso sí, si cae en una misión, el objeto se pierde con él.',
    when: (s) => gearInStock(s).length > 0,
  },
  {
    id: 'trofeo',
    focus: 'sala',
    text: '¡Un trofeo! Lo he colgado en la sala. La gente viene a verlo, se toma algo y eso son monedas cada día.',
    when: (s) => s.trophies.length > 0,
  },
];

/** La siguiente nota que toca enseñar, si alguna. */
export function nextTip(s: GameState): Tip | null {
  const seen = s.tips ?? [];
  if (seen.includes('*')) return null;
  return TIPS.find((t) => !seen.includes(t.id) && t.when(s)) ?? null;
}
