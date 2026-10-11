import type { QuestType } from '../core/model';
import type { SkillId } from '../core/party';

/**
 * Plantillas de encargos. Huecos: {place} lugar, {threat} amenaza, {client} cliente.
 * El generador elige tipo, cliente, lugar y amenaza, y calcula dificultad y paga por rango.
 */

export interface QuestTemplate {
  /** Habilidad principal y posibles secundarias. */
  main: SkillId;
  extra: readonly SkillId[];
  titles: readonly string[];
  texts: readonly string[];
  threats: readonly string[];
}

export const TEMPLATES: Record<QuestType, QuestTemplate> = {
  Cazar: {
    main: 'Combate',
    extra: ['Supervivencia', 'Trampas'],
    titles: ['{Threat} en {place}', 'La bestia de {place}', 'Cazar {threat}'],
    texts: [
      'Desde la luna nueva, {threat} baja hasta {place}. Ya no quedan gallinas que contar.',
      '«Es grande, huele mal y no paga impuestos». Se refiere a {threat}.',
      'Los pastores de {place} no duermen. {Threat} sí, de día. Ahí está la oportunidad.',
    ],
    threats: [
      'un huargo tuerto',
      'un oso con mal genio',
      'un jabalí del tamaño de un carro',
      'una manada de lobos',
      'un grifo joven',
      'un trol de puente',
    ],
  },
  Escoltar: {
    main: 'Combate',
    extra: ['Supervivencia', 'Trampas'],
    titles: [
      'Escoltar la carreta hasta {place}',
      'El camino de {place}',
      'Un carro, tres baúles y {place}',
    ],
    texts: [
      'Hay que llevar una carga hasta {place}. Los dos últimos carros no llegaron.',
      'Un mercader con prisa y poca fe en los caminos quiere llegar entero a {place}.',
      'Dicen que en el camino de {place} cobran peaje {threat}. Un peaje que no es nuestro.',
    ],
    threats: ['unos bandidos', 'unos salteadores', 'los hermanos Cardo', 'una banda de trasgos'],
  },
  Explorar: {
    main: 'Supervivencia',
    extra: ['Trampas', 'Arcano'],
    titles: ['Las ruinas de {place}', 'Lo que hay bajo {place}', 'Cartografiar {place}'],
    texts: [
      'Nadie ha vuelto de {place} con un mapa. Algunos han vuelto sin botas.',
      'Un erudito paga por saber qué queda en {place}. No quiere ir en persona, obviamente.',
      'Bajo {place} hay túneles, y en los túneles, según dicen, {threat}.',
    ],
    threats: ['arañas', 'algo que se arrastra', 'ecos que no son ecos', 'un antiguo guardián'],
  },
  Recuperar: {
    main: 'Trampas',
    extra: ['Supervivencia', 'Combate'],
    titles: ['Una caja en {place}', 'El anillo de la abuela', 'Lo que se dejaron en {place}'],
    texts: [
      'Una caja, una casa vacía en {place}, ninguna pregunta. Paga la mitad por adelantado.',
      'El objeto está en {place}, custodiado por {threat}. El cliente jura que le pertenece.',
      'Hay que recuperar un recuerdo de familia de {place}. La familia no es muy de fiar.',
    ],
    threats: [
      'unos guardias aburridos',
      'unas trampas antiguas',
      'un perro enorme',
      'un cerrojo enano',
    ],
  },
  Investigar: {
    main: 'Arcano',
    extra: ['Combate', 'Trampas'],
    titles: ['Lo que suena en {place}', 'El fantasma de {place}', 'Luces raras en {place}'],
    texts: [
      'Desde hace una semana suenan campanas en {place}. En {place} no hay campanas.',
      '«No es que dé miedo, es que no paga». La posadera de {place} tiene un huésped muerto.',
      'Por las noches se ven luces verdes sobre {place}. El cura dice que es {threat}.',
    ],
    threats: [
      'un espectro',
      'un brujo de feria',
      'una maldición vieja',
      'un espíritu con cuentas pendientes',
    ],
  },
  Limpiar: {
    main: 'Combate',
    extra: ['Arcano', 'Trampas'],
    titles: ['Ratas en {place}', 'El sótano que respira', 'Limpiar {place}'],
    texts: [
      '«Son ratas, pero grandes. Muy grandes. Bueno, una.» Está en {place}.',
      'El difunto guardaba «cosas de alquimia» en {place}. Ahora {place} respira.',
      'Algo ha anidado en {place}: {threat}. Hay que sacarlo de ahí antes de la feria.',
    ],
    threats: ['una rata gigante', 'babosas ácidas', 'un nido de kobolds', 'un limo con hambre'],
  },
};

export const PLACES = [
  'el molino',
  'el puente de los ahorcados',
  'Valdeloro',
  'la casa del canal',
  'el vado',
  'la posada del Cuervo',
  'los riscos',
  'las salinas',
  'Hondogrís',
  'el bosque de Sotomuro',
  'la mina vieja',
  'el cementerio de Ormaz',
  'la torre caída',
  'el pantano de las ranas',
  'la ermita',
  'el granero de los Cardo',
];

export const CLIENTS = [
  'Ilario, molinero',
  'Gremio de mercaderes',
  'Hermana Odile, templo',
  'Berta, posadera',
  'Alcaldía de Sotomuro',
  'Viuda de Arnau',
  'Mayordomo del conde',
  'Salinas de Ormaz',
  'Maese Quirico, erudito',
  'Los pastores del valle',
  'El herrero Bartolo',
  'Doña Urraca',
];

export const SHADY_CLIENTS = ['Desconocido', 'Un tal Corvo', 'Una voz tras la cortina'];

export const TWISTS = [
  'Lo que buscaban ya no estaba solo.',
  'El cliente se olvidó de mencionar a los otros.',
  'Las campanas no avisaban de nada: llamaban a alguien.',
  'Alguien más quería lo mismo, y llegó antes.',
  'La amenaza era el doble de grande de lo prometido.',
];

export const ITEMS = [
  { name: 'Espada oxidada', desc: 'Con una buena limpieza, quizá corte algo.', value: 18 },
  { name: 'Colmillos de huargo', desc: 'La tienda de pociones los compraría.', value: 24 },
  { name: 'Llave de hierro negro', desc: 'Nadie sabe qué abre. Todavía.', value: 8 },
  { name: 'Amuleto de hueso', desc: 'Huele a humo y a otra cosa.', value: 30 },
  { name: 'Mapa a medio quemar', desc: 'Falta justo la parte importante.', value: 15 },
  { name: 'Reliquia sin nombre', desc: 'Está tibia. Siempre.', value: 60 },
  { name: 'Bolsa de gemas turbias', desc: 'Brillan menos de lo que prometen.', value: 45 },
  { name: 'Escudo con blasón', desc: 'De una casa noble que ya no existe.', value: 35 },
];
