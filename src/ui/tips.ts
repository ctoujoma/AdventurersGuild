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
  /** Solo en la vista de salas (las obras de verdad). */
  rooms?: boolean;
  /** Lo que dice en la vista de salas, si allí las cosas están en otro sitio. */
  roomsText?: string;
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
    text: 'El corcho de la sala es el tablón, donde se cuelgan los encargos. Toca uno, elige a quién mandas y fíjate en el riesgo. Mejor «Probable» que «Suicida».',
    roomsText:
      'El tablón de encargos está en el salón: toca la sala y ábrelo. Toca un encargo, elige a quién mandas y fíjate en el riesgo. Mejor «Probable» que «Suicida».',
    when: (s) => s.day === 1 && !s.missions.length && !s.reports.length,
  },
  {
    id: 'noche',
    focus: 'puerta',
    text: 'Ya se han ido y tardarán unos días en volver. Cuando no tengas nada más que hacer, salta al anochecer y pulsa «Terminar día». Por la mañana llega el correo.',
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
    roomsText:
      'Ha llegado equipo y lo tengo guardado en el arcón. Dáselo a alguien desde su ficha. Eso sí, si cae en una misión, el objeto se pierde con él.',
    when: (s) => gearInStock(s).length > 0,
  },
  {
    id: 'trofeo',
    focus: 'sala',
    text: '¡Un trofeo! Lo he colgado en la sala. La gente viene a verlo, se toma algo y eso son monedas cada día.',
    when: (s) => s.trophies.length > 0,
  },
  // El día 30: las obras se abren y el tío explica cómo encajar las salas.
  {
    id: 'obras',
    rooms: true,
    focus: 'sala',
    text: 'La casa ya es tuya del todo, así que se acabaron los apaños: ahora se hace obra de verdad. En «Gremio», pestaña «Obras», eliges una sala nueva y dónde va. Si tocas una sala, la amplías, la mueves o la tiras.',
    when: (s) => sinceOpening(s) >= 0,
  },
  {
    id: 'plano',
    rooms: true,
    text: 'Antes de levantar media casa, prueba «Planear una reforma». Haces las obras de mentira, ves cómo queda y lo que cuesta, y pagas al final. Si no te convence, lo dejas y no pierdes ni una moneda.',
    when: (s) => seen(s, 'obras') && sinceOpening(s) >= 1,
  },
  {
    id: 'excavar',
    rooms: true,
    focus: 'bodega',
    text: 'Debajo del sótano hay roca. Para meter más salas abajo, excava junto a la escalera, planta a planta; cuanto más hondo, más caro. Hacia arriba también se sube, pero cada planta solo sobresale un hueco de la de abajo.',
    when: (s) => seen(s, 'plano') && sinceOpening(s) >= 2,
  },
];

/** La siguiente nota que toca enseñar, si alguna. */
export function nextTip(s: GameState, rooms = false): Tip | null {
  const done = s.tips ?? [];
  if (done.includes('*')) return null;
  const t = TIPS.find((x) => !done.includes(x.id) && (!x.rooms || rooms) && x.when(s));
  if (!t) return null;
  return rooms && t.roomsText ? { ...t, text: t.roomsText } : t;
}
