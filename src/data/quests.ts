import type { QuestType } from '../core/model';
import type { SkillId } from '../core/party';

/**
 * Plantillas de encargos. Huecos: {place} lugar, {threat} amenaza, {client} cliente.
 * Los lugares ya tienen nombre propio («el molino», «la mina vieja»), así que los textos
 * dicen «en {place}» o «cerca de {place}», nunca «el molino de {place}».
 * El generador elige tipo, cliente, lugar y amenaza, y calcula dificultad y paga por rango.
 */

export interface QuestTemplate {
  /** Habilidad principal y posibles secundarias. */
  main: SkillId;
  extra: readonly SkillId[];
  /** Títulos genéricos: casan con cualquiera de los textos. */
  titles: readonly string[];
  texts: readonly string[];
  /** Historias concretas: título y texto que solo van juntos. */
  stories?: readonly (readonly [title: string, text: string])[];
  threats: readonly string[];
}

export const TEMPLATES: Record<QuestType, QuestTemplate> = {
  Cazar: {
    main: 'Combate',
    extra: ['Supervivencia', 'Trampas'],
    titles: [
      '{Threat} en {place}',
      'La bestia de {place}',
      'Cazar {threat}',
      'Recompensa por {threat}',
      'Algo baja del monte',
    ],
    texts: [
      'Desde la luna nueva, {threat} baja hasta {place} y ya no queda una gallina viva.',
      'Los vecinos hablan de algo «grande, apestoso y con muy malas pulgas». Es {threat}, y anda por {place}.',
      'Cerca de {place} los pastores no pegan ojo. {Threat}, en cambio, duerme de día, y es cuando hay que ir.',
      'Se paga por la cabeza de {threat}, que ronda {place}. De momento nadie ha cobrado.',
      'Junto a {place} hay huellas del tamaño de un escudo. Desde entonces nadie sale de casa después de cenar.',
      '{Threat} se ha llevado dos ovejas y el perro que las cuidaba. Cerca de {place} quieren su piel colgada en la plaza.',
      'Un cazador fue tras {threat} camino de {place}. Han vuelto sus botas; él no.',
      'Cerca de {place} cierran las puertas al anochecer por culpa de {threat}. La feria se hace igual, pero de día.',
    ],
    stories: [
      [
        'El ternero que faltaba',
        'Hace tres noches que algo ronda cerca de {place}. Esta mañana faltaba un ternero. Es {threat}.',
      ],
      [
        'Pieles para el curtidor',
        'El curtidor paga bien por la piel de {threat}, entera y sin agujeros de más. Ronda por {place}.',
      ],
      [
        'Sangre en el abrevadero',
        'El abrevadero junto a {place} amaneció rojo. Las huellas van hacia el monte, y son de {threat}.',
      ],
    ],
    threats: [
      'un huargo tuerto',
      'un oso con mal genio',
      'un jabalí del tamaño de un carro',
      'una manada de lobos',
      'un grifo joven',
      'un trol de puente',
      'un oso pardo con una flecha clavada',
      'una pareja de wargos',
      'una serpiente de ciénaga',
    ],
  },
  Escoltar: {
    main: 'Combate',
    extra: ['Supervivencia', 'Trampas'],
    titles: [
      'Escoltar la carreta hasta {place}',
      'El camino de {place}',
      'Un carro, tres baúles y {place}',
      'Hasta {place} sin un rasguño',
    ],
    texts: [
      'Hay que llevar una carga hasta {place}. Los dos últimos carros no llegaron.',
      'Un mercader con prisa y poca fe en los caminos quiere llegar entero a {place}.',
      'En el camino de {place} asaltan carros, y dicen que son {threat}. La carga tiene que llegar.',
      'Tres carros de sal salen hacia {place} al alba. El año pasado se perdieron por culpa de {threat}.',
      'Un peregrino rico quiere ir a rezar a {place}. Reza mucho, pero se fía más de las espadas.',
    ],
    stories: [
      [
        'El recaudador',
        'Un recaudador tiene que llegar a {place} con la bolsa llena. En el camino nadie lo quiere vivo.',
      ],
      [
        'Una boda en {place}',
        'Una novia viaja a {place} con su ajuar y una tía que no se calla. Lo segundo no tiene arreglo.',
      ],
      [
        'Un ataúd camino de {place}',
        'Hay que llevar un ataúd hasta {place} sin abrirlo. El que paga insiste mucho en lo de no abrirlo.',
      ],
      [
        'El vino del obispo',
        'Doce barricas para el obispo, que espera en {place}. Si llega una menos, se notará en el sermón.',
      ],
    ],
    threats: [
      'unos bandidos',
      'unos salteadores',
      'los hermanos Cardo',
      'una banda de trasgos',
      'unos desertores',
      'una partida de orcos',
      'unos cobradores de peaje que nadie ha puesto',
      'los de la Mano Negra',
    ],
  },
  Explorar: {
    main: 'Supervivencia',
    extra: ['Trampas', 'Arcano'],
    titles: [
      'Las ruinas de {place}',
      'Lo que hay bajo {place}',
      'Cartografiar {place}',
      'Más allá de {place}',
    ],
    texts: [
      'Nadie ha vuelto de {place} con un mapa. Algunos han vuelto sin botas.',
      'Un erudito paga por saber qué queda en {place}. Él, por supuesto, se queda en casa.',
      'Bajo {place} hay túneles, y en los túneles, según dicen, {threat}.',
      'El conde quiere saber si se puede abrir un camino por {place}. Si no se puede, también quiere saberlo, pero paga menos.',
      'Los niños juran que cerca de {place} hay una puerta en la roca. Los mayores dicen que no, pero no se acercan.',
    ],
    stories: [
      [
        'La grieta',
        'Tras el último temblor se abrió una grieta cerca de {place}. Del fondo sale aire caliente; dicen que abajo hay {threat}.',
      ],
      [
        'Un mapa a medias',
        'Un mapa viejo marca una cruz en {place}. El que lo vendió juró que era auténtico y se fue muy deprisa.',
      ],
      [
        'El pozo seco',
        'Un pozo junto a {place} se secó en una noche. El pocero bajó con una vela y vio una escalera que nadie recordaba.',
      ],
      [
        'La torre hundida',
        'Con la sequía ha asomado una torre en la laguna, cerca de {place}. Hace cien años no estaba en ningún mapa.',
      ],
    ],
    threats: [
      'arañas',
      'algo que se arrastra',
      'algo que imita voces',
      'un antiguo guardián',
      'murciélagos del tamaño de un perro',
      'un ermitaño que no quiere visitas',
      'gases que marean',
      'una cripta sellada',
    ],
  },
  Recuperar: {
    main: 'Trampas',
    extra: ['Supervivencia', 'Combate'],
    titles: [
      'Lo que se dejaron en {place}',
      'Un encargo discreto en {place}',
      'Sacarlo de {place}',
    ],
    texts: [
      'El objeto está en {place}, custodiado por {threat}. El cliente jura que le pertenece.',
      'Cerca de {place}, en una casa cerrada, hay un libro de cuentas que alguien prefiere quemado. El cliente lo prefiere en sus manos.',
      'Algo que no es tuyo espera en {place}, vigilado por {threat}. El cliente no da más detalles.',
    ],
    stories: [
      [
        'Una caja en {place}',
        'Hay que sacar una caja de una casa vacía en {place} sin preguntar qué lleva. Mitad por adelantado.',
      ],
      [
        'El anillo de la abuela',
        'Hay que recuperar un recuerdo de familia de {place}. La familia no es muy de fiar.',
      ],
      [
        'El sello del notario',
        'Al notario le robaron el sello, y el ladrón se esconde en {place}. Sin sello no hay herencias, y sin herencias hay muchos primos enfadados.',
      ],
      [
        'Las joyas de la viuda',
        'Una viuda quiere sus joyas antes de que las vendan en la feria. Están en {place}; sabe quién las tiene, pero no lo dice en voz alta.',
      ],
      [
        'La campana robada',
        'Se llevaron la campana de la ermita una noche sin luna. Pesa como un buey, así que no ha podido pasar de {place}.',
      ],
      [
        'Lo que el río dejó en {place}',
        'La riada arrastró un cofre hasta {place}. El dueño lo quiere de vuelta y no pregunta cómo.',
      ],
    ],
    threats: [
      'unos guardias aburridos',
      'unas trampas antiguas',
      'un perro enorme',
      'un cerrojo enano',
      'un ladrón muy celoso de lo suyo',
      'una familia de osos',
      'unos contrabandistas',
      'un gato que no es solo un gato',
    ],
  },
  Investigar: {
    main: 'Arcano',
    extra: ['Combate', 'Trampas'],
    titles: [
      'Lo que suena en {place}',
      'El fantasma de {place}',
      'Algo raro en {place}',
      'Lo que pasa en {place}',
    ],
    texts: [
      'Desde hace una semana suenan campanas en {place}. En {place} no hay campanas.',
      '«No es que dé miedo, es que no paga». Una posadera cerca de {place} tiene un huésped muerto.',
      'Cerca de {place} enterraron a un herrero el martes. El jueves estaba otra vez en su fragua. Dicen que es {threat}.',
      'Un pozo junto a {place} canta de noche, siempre la misma canción. Nadie la conoce, pero todos se la saben.',
    ],
    stories: [
      [
        'Luces raras en {place}',
        'Por las noches se ven luces verdes sobre {place}. El cura dice que es {threat}.',
      ],
      [
        'Las vacas de {place}',
        'Cerca de {place} las vacas dan leche agria y miran raro. El albéitar dice que eso no es cosa suya.',
      ],
      [
        'La niña que sabe cosas',
        'Cerca de {place} hay una niña que dice lo que va a pasar mañana. Ayer acertó. El alcalde está muy nervioso.',
      ],
      [
        'Desaparecidos en {place}',
        'Tres vecinos han desaparecido en un mes. Todos habían ido a por agua a {place}.',
      ],
    ],
    threats: [
      'un espectro',
      'un brujo de feria',
      'una maldición vieja',
      'un espíritu con cuentas pendientes',
      'una bruja del pantano',
      'un duende rencoroso',
      'un culto de aficionados',
      'algo que vive en los espejos',
    ],
  },
  Limpiar: {
    main: 'Combate',
    extra: ['Arcano', 'Trampas'],
    titles: ['Limpiar {place}', 'Plaga en {place}', 'Bichos en {place}'],
    texts: [
      'Hay {threat} en {place}, y la feria es dentro de una semana.',
      'Una familia volvió de la feria y se encontró {threat} en casa, cerca de {place}. No piensan mudarse.',
      'En {place} hay {threat}. Huele peor que de costumbre, que ya es decir.',
    ],
    stories: [
      ['Ratas en {place}', '«Son ratas, pero grandes. Muy grandes. Bueno, una.» Está en {place}.'],
      [
        'El sótano del alquimista',
        'El difunto guardaba «cosas de alquimia» en {place}. Desde el entierro, algo se mueve ahí abajo.',
      ],
      [
        'La bodega cerrada',
        'Una bodega junto a {place} lleva un mes cerrada. El vino sigue dentro, y {threat} también.',
      ],
      [
        'El molino abandonado',
        'Algo ha hecho nido en un molino viejo junto a {place}. El molinero ya no muele; ahora solo maldice.',
      ],
      [
        'El cementerio no descansa',
        'Los muertos del cementerio, junto a {place}, no se están quietos. El enterrador pide ayuda y una pala nueva.',
      ],
    ],
    threats: [
      'una rata gigante',
      'babosas ácidas',
      'un nido de kobolds',
      'un limo con hambre',
      'avispas gigantes',
      'esqueletos que no se están quietos',
      'un enjambre de murciélagos',
      'trasgos que se han instalado a vivir',
    ],
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
  'Lo que buscaban tenía compañía.',
  'El cliente se olvidó de mencionar a los otros.',
  'Por el camino les salió al paso algo que nadie había mencionado.',
  'Alguien más quería lo mismo, y llegó antes.',
  'La amenaza era el doble de grande de lo prometido.',
];

export const ITEMS = [
  { name: 'Espada oxidada', desc: 'Con una buena limpieza, quizá corte algo.', value: 18 },
  { name: 'Colmillos de huargo', desc: 'La tienda de pociones los compraría.', value: 24 },
  {
    name: 'Llave de hierro negro',
    desc: 'No abre ninguna puerta de la comarca. Ya se ha probado.',
    value: 8,
  },
  { name: 'Amuleto de hueso', desc: 'Huele a humo y a otra cosa.', value: 30 },
  { name: 'Mapa a medio quemar', desc: 'Falta justo la parte importante.', value: 15 },
  { name: 'Reliquia sin nombre', desc: 'Sigue tibia aunque pase la noche al raso.', value: 60 },
  { name: 'Bolsa de gemas turbias', desc: 'Brillan menos de lo que prometen.', value: 45 },
  { name: 'Escudo con blasón', desc: 'De una casa noble que ya no existe.', value: 35 },
];
