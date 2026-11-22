/**
 * Frases del viaje de un grupo fuera (la ficha «Encargo en curso» y su tira). Son ambiente: lo
 * que de verdad pasa (heridos, botín, si sale bien) llega con el informe al volver.
 * `{h}` es un héroe del grupo; `{sitio}`, el lugar del encargo.
 */
import type { QuestType } from '../core/model';
import type { Terrain } from './places';
import { t, tl } from '../textos';

/** Partes del viaje, por orden, y qué trozo del total ocupa cada una (de 0 a 1). */
export const LEGS = [
  { id: 'ida', name: t('viaje.tramos.ida.nombre'), from: 0, to: 0.4 },
  { id: 'llegada', name: t('viaje.tramos.llegada.nombre'), from: 0.4, to: 0.5 },
  { id: 'faena', name: t('viaje.tramos.faena.nombre'), from: 0.5, to: 0.75 },
  { id: 'vuelta', name: t('viaje.tramos.vuelta.nombre'), from: 0.75, to: 1 },
] as const;

export type LegId = (typeof LEGS)[number]['id'];

/** Lo que se ve por el camino, según el terreno del sitio. */
export const ROAD: Record<Terrain, readonly string[]> = {
  rio: tl('viaje.camino.rio'),
  pueblo: tl('viaje.camino.pueblo'),
  monte: tl('viaje.camino.monte'),
  bosque: tl('viaje.camino.bosque'),
  costa: tl('viaje.camino.costa'),
  pantano: tl('viaje.camino.pantano'),
  campo: tl('viaje.camino.campo'),
  ruina: tl('viaje.camino.ruina'),
};

/** Lo suyo, según el tipo de encargo (sin decir cómo acaba). */
export const WORK: Record<QuestType, readonly string[]> = {
  Cazar: tl('viaje.trabajo.Cazar'),
  Escoltar: tl('viaje.trabajo.Escoltar'),
  Explorar: tl('viaje.trabajo.Explorar'),
  Recuperar: tl('viaje.trabajo.Recuperar'),
  Investigar: tl('viaje.trabajo.Investigar'),
  Limpiar: tl('viaje.trabajo.Limpiar'),
};

/**
 * Familias de enemigos de la tira (y, más adelante, de asaltos y esbirros). Cada una, un dibujo
 * con sus poses. Se saca del texto del encargo; si no dice nada, del tipo.
 */
export type FoeKind = 'bandido' | 'trasgo' | 'bestia' | 'alimana' | 'muerto' | 'grande';

export const FOE_NAMES: Record<FoeKind, string> = {
  bandido: t('viaje.enemigos.bandido'),
  trasgo: t('viaje.enemigos.trasgo'),
  bestia: t('viaje.enemigos.bestia'),
  alimana: t('viaje.enemigos.alimana'),
  muerto: t('viaje.enemigos.muerto'),
  grande: t('viaje.enemigos.grande'),
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
export const FIGHT = tl('viaje.pelea');

export const ARRIVE = tl('viaje.llegar');
export const LEAVE = tl('viaje.volver');
export const CAMP = tl('viaje.acampar');
