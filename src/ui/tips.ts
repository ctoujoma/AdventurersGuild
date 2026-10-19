import { SCHEDULE } from '../core/balance';
import { vaultFull } from '../core/vault';
import { gearInStock, roster } from '../core/game';
import { hungryTonight } from '../core/larder';
import { slotsOf, isTrainRoom } from '../core/workers';
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

const seen = (s: GameState, id: string) => (s.tips ?? []).includes(id);
/** Días desde que se pagó la deuda (o -1 si aún no). */
const sinceOpening = (s: GameState) =>
  s.mode === 'libre' && s.opening?.seen ? s.day - s.opening.day : -1;

export const TIPS: readonly Tip[] = [
  {
    id: 'tablon',
    focus: 'tablon',
    text: 'El tablón de encargos está en el salón: toca la sala y ábrelo. Toca un encargo, elige a quién mandas y fíjate en el riesgo. Mejor «Probable» que «Suicida».',
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
    text: `El día ${SCHEDULE[0]!.day} viene Merlo a cobrar ${SCHEDULE[0]!.amount} monedas, más los salarios. Lo que te falta lo tienes arriba, junto a la campana. Si no llegas, se queda la taberna, gato incluido.`,
    when: (s) => s.day >= 4 && s.day < 7 && s.paid === 0,
  },
  {
    id: 'gremio',
    focus: 'sala',
    text: 'Cuando tengas algo ahorrado, arregla la casa desde «Gremio». Más camas, una enfermería, una taberna que deje dinero. Todo sirve para algo y luce en la casa.',
    when: (s) => s.day >= 3 && s.gold >= 120 && s.fac.dorm + s.fac.enf + s.fac.tab <= 2,
  },
  {
    id: 'trabajo',
    focus: 'cocina',
    text: 'Remedios cocina, Tobías atiende el salón y Nico sube los barriles de la bodega. Vienen cada mañana del pueblo y cobran con los héroes. Toca una sala para ver quién trabaja en ella. Para cambiar a alguien de sitio, cógelo con el dedo y suéltalo en otra sala; los héroes que se quedan en casa también pueden echar una mano.',
    when: (s) => s.day >= 3 && s.workers.length > 0,
  },
  {
    id: 'moral',
    text: 'Alguien anda desanimado y rinde menos. Déjalo descansar en la taberna unos días, o súbele el sueldo si te lo pide. El que está harto se larga cualquier noche.',
    when: (s) => s.heroes.some((h) => h.status === 'ok' && h.morale < MORALE_LOW),
  },
  {
    id: 'equipo',
    focus: 'armeria',
    text: 'Ha llegado equipo y lo he dejado en la armería (en arcones, mientras no la arregles). Dáselo a alguien desde su ficha. Eso sí, si cae en una misión, el objeto se pierde con él.',
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
    focus: 'sala',
    text: 'La casa ya es tuya del todo, así que se acabaron los apaños: ahora se hace obra de verdad. Toca el martillo, a la derecha, para el modo obras: abajo eliges una sala nueva y luego dónde va. Si tocas una sala, la amplías, la mueves o la tiras.',
    when: (s) => sinceOpening(s) >= 0,
  },
  {
    id: 'plano',
    text: 'En el modo obras todo se hace de mentira hasta que pagas: ves cómo queda y lo que cuesta. Puedes dejar una sala sin paso un momento mientras mueves otras; solo hay que arreglarlo antes de pagar. Si no te convence, sales y no pierdes ni una moneda.',
    when: (s) => seen(s, 'obras') && sinceOpening(s) >= 1,
  },
  {
    id: 'excavar',
    focus: 'bodega',
    text: 'Debajo del sótano hay roca. En el modo obras se marcan los huecos que se pueden excavar, con su precio: tócalos y listo. Cuanto más hondo, más caro. Hacia arriba también se sube, pero cada planta solo sobresale un hueco de la de abajo.',
    when: (s) => seen(s, 'plano') && sinceOpening(s) >= 2,
  },
  {
    id: 'servicio',
    text: 'Ahora viene gente del pueblo a pedir trabajo: lo verás en «Héroes», pestaña «Trabajo». Pero cada uno nuevo necesita su cama, así que antes construye el dormitorio del servicio.',
    when: (s) => seen(s, 'excavar') && sinceOpening(s) >= 3,
  },
  {
    id: 'visitas',
    focus: 'salon',
    text: 'La caja la llenan los que vienen al salón: campesinos, mercaderes y, si el salón luce, algún noble que trae fama. Cuanto más Atractivo (decoración, fachada, trofeos), más gente; pero si nadie atiende la barra, se van sin pagar. Ojo con los forasteros que miran demasiado.',
    when: (s) => s.day >= 5 && s.mode !== 'libre',
  },
  {
    id: 'comida',
    focus: 'cocina',
    text: 'Lo que hace Remedios en la cocina y Nico en la bodega se suma por la noche, y lo tienes arriba: el pan son las raciones y la jarra, la cerveza. Los visitantes comen y beben de ahí, y los de casa cenan antes de dormir. Si no llega, pon a alguien más en la cocina o arréglala; quien se acuesta sin cenar se levanta de mal humor.',
    when: (s) => (s.day >= 6 && s.mode !== 'libre') || hungryTonight(s) > 0,
  },
  {
    id: 'entreno',
    text: 'Ya tienes donde entrenar. Coge con el dedo a un héroe que esté en casa y suéltalo en la sala: la barra sobre su cabeza dice cuánto le falta para el siguiente punto. Cada sala tiene un tope; mejorándola, se llega más lejos.',
    when: (s) => s.building.rooms.some((r) => isTrainRoom(r.type) && slotsOf(r) > 0),
  },
  {
    id: 'tesoro',
    focus: 'cofres',
    text: 'Todo el oro se guarda en la cámara del tesoro, y ya casi no cabe más: lo que sobre se perderá. Mejórala (o, cuando puedas hacer obras, hazla más grande). Su nivel es también la cerradura que tendrían que forzar los bandidos.',
    when: (s) => vaultFull(s),
  },
];

/** La siguiente nota que toca enseñar, si alguna. */
export function nextTip(s: GameState): Tip | null {
  const done = s.tips ?? [];
  if (done.includes('*')) return null;
  return TIPS.find((x) => !done.includes(x.id) && x.when(s)) ?? null;
}
