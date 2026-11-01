/**
 * Frases del viaje de un grupo fuera (la ficha «Encargo en curso» y su tira). Son ambiente: lo
 * que de verdad pasa (heridos, botín, si sale bien) llega con el informe al volver.
 * `{h}` es un héroe del grupo; `{sitio}`, el lugar del encargo.
 */
import type { QuestType } from '../core/model';
import type { Terrain } from './places';

/** Partes del viaje, por orden, y qué trozo del total ocupa cada una (de 0 a 1). */
export const LEGS = [
  { id: 'ida', name: 'De camino', from: 0, to: 0.4 },
  { id: 'llegada', name: 'Llegan', from: 0.4, to: 0.5 },
  { id: 'faena', name: 'Manos a la obra', from: 0.5, to: 0.75 },
  { id: 'vuelta', name: 'De vuelta', from: 0.75, to: 1 },
] as const;

export type LegId = (typeof LEGS)[number]['id'];

/** Lo que se ve por el camino, según el terreno del sitio. */
export const ROAD: Record<Terrain, readonly string[]> = {
  rio: [
    'Cruzan el vado con el agua por las rodillas.',
    '{h} se para a llenar las cantimploras en la orilla.',
    'Siguen la ribera entre juncos y mosquitos.',
  ],
  pueblo: [
    'Pasan por un mercado; {h} regatea un pan de higos.',
    'Unos críos los siguen un trecho por el camino real.',
    'Un carretero les cuenta las últimas habladurías.',
  ],
  monte: [
    'Suben por una trocha de cabras.',
    '{h} resbala en una pedrera, pero no pasa nada.',
    'Desde el collado se ve la taberna, pequeña, allá abajo.',
  ],
  bosque: [
    'El camino se pierde entre robles viejos.',
    '{h} jura que algo los sigue entre los helechos.',
    'Encuentran setas; nadie se atreve a probarlas.',
  ],
  costa: [
    'El viento del mar les tira de las capas.',
    'Bajan a la playa por un sendero de sal.',
    '{h} recoge una concha para la barra.',
  ],
  pantano: [
    'Avanzan de mata en mata para no hundirse.',
    'Las ranas se callan de golpe cuando pasan.',
    '{h} pierde una bota en el lodo y la recupera.',
  ],
  campo: [
    'Atajan por un trigal; un labriego les grita.',
    'Comen a la sombra de una encina.',
    '{h} canta para llevar el paso.',
  ],
  ruina: [
    'Pasan junto a una muralla caída cubierta de hiedra.',
    'Ven marcas viejas en las piedras del camino.',
    '{h} se guarda una moneda antigua que asomaba en el barro.',
  ],
};

/** Lo suyo, según el tipo de encargo (sin decir cómo acaba). */
export const WORK: Record<QuestType, readonly string[]> = {
  Cazar: ['Encuentran huellas frescas y las siguen.', 'Preparan la emboscada a favor del viento.'],
  Escoltar: ['Se ponen en marcha con el carro.', '{h} va delante, mirando cada recodo.'],
  Explorar: ['Dibujan el sitio en un pliego.', '{h} se mete por un paso estrecho con la antorcha.'],
  Recuperar: ['Buscan entre los escombros.', '{h} cree que lo tiene cerca.'],
  Investigar: ['Preguntan a los vecinos de {sitio}.', '{h} encuentra algo que no encaja.'],
  Limpiar: ['Sacan a los primeros de su madriguera.', 'Se cierran en formación y avanzan.'],
};

/**
 * Familias de enemigos de la tira (y, más adelante, de asaltos y esbirros). Cada una, un dibujo
 * con sus poses. Se saca del texto del encargo; si no dice nada, del tipo.
 */
export type FoeKind = 'bandido' | 'trasgo' | 'bestia' | 'alimana' | 'muerto' | 'grande';

export const FOE_NAMES: Record<FoeKind, string> = {
  bandido: 'bandidos',
  trasgo: 'trasgos',
  bestia: 'bestias',
  alimana: 'alimañas',
  muerto: 'muertos que no descansan',
  grande: 'bestias enormes',
};

/** Palabras del encargo que dicen contra qué se pelea (la primera que case manda). */
export const FOE_WORDS: readonly (readonly [RegExp, FoeKind])[] = [
  [/trasgo|orco|kobold|duende/i, 'trasgo'],
  [/esquelet|espectro|esp[ií]ritu|cripta|maldici|espejo|imita voces|guardi[aá]n/i, 'muerto'],
  [/trol|grifo/i, 'grande'],
  [/huargo|warg|lobo|oso|jabal[ií]|perro|gato/i, 'bestia'],
  [/rata|babosa|limo|avispa|murci[eé]lago|serpiente|ara[ñn]a|se arrastra/i, 'alimana'],
  [
    /bandid|salteador|Cardo|desertor|cobrador|Mano Negra|contrabandist|ladr[oó]n|guardias|culto|brujo|bruja|ermita/i,
    'bandido',
  ],
];

export const FOE_BY_TYPE: Record<QuestType, FoeKind> = {
  Cazar: 'bestia',
  Escoltar: 'bandido',
  Explorar: 'alimana',
  Recuperar: 'bandido',
  Investigar: 'muerto',
  Limpiar: 'alimana',
};

/** La pelea de lo suyo (sin decir cómo acaba). `{foe}`, los enemigos. */
export const FIGHT = [
  'Les salen al paso {foe}. ¡A las armas!',
  'Se lían a golpes con {foe}.',
  '{h} da la voz: {foe}, y vienen derechos.',
];

export const ARRIVE = ['Llegan a {sitio}.', 'Por fin, {sitio}.'];
export const LEAVE = ['Emprenden la vuelta.', 'Recogen y vuelven hacia la taberna.'];
export const CAMP = [
  'Acampan para pasar la noche.',
  'Duermen al raso; {h} hace la primera guardia.',
];
