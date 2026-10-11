import type { Outcome, QuestType } from '../core/model';
import type { ClassId, SkillId, TraitId } from '../core/party';

/**
 * Más frases para los informes: variantes extra de las de `stories.ts` y capas nuevas
 * (clase, rasgo, sucesos en ruta, piques entre compañeros, moral y cliente).
 * Huecos: {h} protagonista, {a} y {b} dos del grupo, {who} el grupo, {place} lugar,
 * {client} quien hizo el encargo, {gold} monedas. Frases neutras de género siempre que se pueda.
 */

export const MORE_OPENERS: Record<QuestType, readonly [one: string, many: string][]> = {
  Cazar: [
    [
      'Las huellas eran tan grandes que {who} tuvo que mirarlas dos veces.',
      'Las huellas eran tan grandes que {who} tuvieron que mirarlas dos veces.',
    ],
    [
      '{who} salió hacia {place} antes del alba, con cebo, cuerda y pocas ganas.',
      '{who} salieron hacia {place} antes del alba, con cebo, cuerda y pocas ganas.',
    ],
    [
      'En {place} nadie salía de casa al anochecer. Mala señal para quien va de caza.',
      'En {place} nadie salía de casa al anochecer. Mala señal para quien va de caza.',
    ],
  ],
  Escoltar: [
    [
      'La carga iba tapada con una lona, y {who} decidió no preguntar.',
      'La carga iba tapada con una lona, y {who} decidieron no preguntar.',
    ],
    [
      'El camino a {place} tiene fama de cobrarse peaje. {who} iba con la mano en la empuñadura.',
      'El camino a {place} tiene fama de cobrarse peaje. {who} iban con la mano en la empuñadura.',
    ],
    [
      '{client} insistió en llevar también a su tía. {who} no supo decir que no.',
      '{client} insistió en llevar también a su tía. {who} no supieron decir que no.',
    ],
  ],
  Explorar: [
    [
      'El mapa de {place} tenía más manchas de vino que caminos.',
      'El mapa de {place} tenía más manchas de vino que caminos.',
    ],
    [
      '{who} contó los pasos al entrar en {place}. A la vuelta le salían otros.',
      '{who} contaron los pasos al entrar en {place}. A la vuelta les salían otros.',
    ],
    [
      'Hacía siglos que nadie pisaba {place}, y se notaba en el polvo y en el silencio.',
      'Hacía siglos que nadie pisaba {place}, y se notaba en el polvo y en el silencio.',
    ],
  ],
  Recuperar: [
    [
      '{client} describió el objeto con tanto detalle que {who} sospechó que no era suyo.',
      '{client} describió el objeto con tanto detalle que {who} sospecharon que no era suyo.',
    ],
    [
      'Lo que había que traer estaba en {place}. Lo que lo vigilaba, también.',
      'Lo que había que traer estaba en {place}. Lo que lo vigilaba, también.',
    ],
    [
      '{who} entró en {place} por la ventana, porque la puerta tenía demasiados cerrojos.',
      '{who} entraron en {place} por la ventana, porque la puerta tenía demasiados cerrojos.',
    ],
  ],
  Investigar: [
    [
      'En {place} todos tenían coartada, y todas eran la misma taberna.',
      'En {place} todos tenían coartada, y todas eran la misma taberna.',
    ],
    [
      '{who} empezó por lo de siempre: preguntar a la vieja que lo ve todo desde su ventana.',
      '{who} empezaron por lo de siempre: preguntar a la vieja que lo ve todo desde su ventana.',
    ],
    [
      'Las pistas llevaban a {place}, y de {place} a ninguna parte.',
      'Las pistas llevaban a {place}, y de {place} a ninguna parte.',
    ],
  ],
  Limpiar: [
    [
      'Lo que vivía en {place} no pagaba alquiler, pero hacía mucho ruido.',
      'Lo que vivía en {place} no pagaba alquiler, pero hacía mucho ruido.',
    ],
    [
      '{who} se tapó la nariz con un pañuelo antes de bajar a {place}. No sirvió de nada.',
      '{who} se taparon la nariz con un pañuelo antes de bajar a {place}. No sirvió de nada.',
    ],
    [
      '{client} juraba que eran «solo unas pocas». No eran unas pocas.',
      '{client} juraba que eran «solo unas pocas». No eran unas pocas.',
    ],
  ],
};

export const MORE_LINES: Record<SkillId, { ok: readonly string[]; ko: readonly string[] }> = {
  Combate: {
    ok: [
      '{h} esquivó el primer golpe y no hubo un segundo.',
      'Con un grito que se oyó en tres valles, {h} hizo huir a la mitad antes de empezar.',
      '{h} usó una silla, una cacerola y, al final, la espada.',
    ],
    ko: [
      '{h} resbaló en el barro justo cuando más falta hacía estar de pie.',
      'El escudo de {h} aguantó. El brazo de detrás, no tanto.',
      'Llegaron por la espalda, y {h} miraba hacia delante.',
    ],
  },
  Trampas: {
    ok: [
      '{h} desmontó el mecanismo y se guardó un muelle «por si acaso».',
      'Un dardo pasó silbando junto a la oreja de {h}, que ya se había agachado.',
      '{h} tanteó cada baldosa con la punta del cuchillo, despacio y sin prisa.',
    ],
    ko: [
      'Un clic, un silbido y {h} con el pelo chamuscado.',
      'La red cayó del techo y {h} quedó colgando como un jamón.',
      '{h} abrió el cofre. El cofre mordió.',
    ],
  },
  Arcano: {
    ok: [
      '{h} trazó un círculo de sal y lo que acechaba no se atrevió a cruzarlo.',
      'El libro maldito se cerró solo cuando {h} le recitó su propio nombre.',
      '{h} notó el frío de la magia antes que nadie y dio la voz de alarma.',
    ],
    ko: [
      'El amuleto de {h} se puso al rojo vivo y hubo que tirarlo a un charco.',
      '{h} leyó el pergamino del revés. Durante una hora, todos hablaron al revés.',
      'Lo que dormía en la cripta despertó, y {h} no supo volver a dormirlo.',
    ],
  },
  Supervivencia: {
    ok: [
      '{h} leyó las nubes y supo cuándo esconderse de la tormenta.',
      '{h} cazó, desplumó y asó un faisán mientras los demás montaban el campamento.',
      'Siguiendo el musgo de los árboles, {h} los sacó del bosque sin un rasguño.',
    ],
    ko: [
      '{h} encendió la hoguera con leña verde. Humo para dar y regalar, y nada de calor.',
      'El río estaba más crecido de lo que {h} calculó. Perdieron media carga.',
      '{h} dejó la comida sin colgar y los lobos cenaron mejor que el grupo.',
    ],
  },
};

/** Cuando el protagonista de un desafío es de una clase, a veces lo cuenta a su manera. */
export const CLASS_LINES: Record<ClassId, { ok: readonly string[]; ko: readonly string[] }> = {
  guerrero: {
    ok: [
      '{h} se puso delante de todos, como siempre, y lo aguantó todo, como siempre.',
      'El acero de {h} habló por el grupo, y habló muy claro.',
    ],
    ko: [
      '{h} quiso resolverlo a espadazos. No era de los que se resuelven a espadazos.',
      'Ni la mejor armadura de {h} servía contra aquello.',
    ],
  },
  picaro: {
    ok: [
      '{h} desapareció entre las sombras y apareció justo donde hacía falta.',
      'Nadie vio a {h} hacerlo. Por eso salió bien.',
    ],
    ko: [
      '{h} intentó colarse y tropezó con el único cubo de todo el pasillo.',
      'Hasta a {h} se le resbalan los dedos de vez en cuando.',
    ],
  },
  mago: {
    ok: [
      '{h} murmuró algo en una lengua muerta y el problema dejó de ser un problema.',
      'Una chispa azul en la mano de {h} y el camino quedó despejado.',
    ],
    ko: [
      'A {h} se le enredó la lengua a mitad del conjuro. Salieron sapos.',
      '{h} juraba que lo tenía todo calculado. Los números no estaban de acuerdo.',
    ],
  },
  clerigo: {
    ok: [
      '{h} rezó en voz alta y, quizá por casualidad, todo salió bien.',
      'Con una bendición y un buen bastonazo, {h} lo dejó todo en paz.',
    ],
    ko: [
      'Los dioses estaban ocupados en otra cosa cuando {h} los llamó.',
      '{h} rezó con fe, pero rezó tarde.',
    ],
  },
  explorador: {
    ok: [
      '{h} conocía un sendero de cabras que no sale en ningún mapa.',
      '{h} pegó la oreja al suelo y supo por dónde venían.',
    ],
    ko: [
      'Por primera vez en años, {h} se perdió. No quiere hablar de ello.',
      'El rastro que siguió {h} era de un jabalí. Un jabalí con muy mal genio.',
    ],
  },
};

/** Apartes por rasgo: dan color y, si el rasgo está oculto, son una pista. */
export const TRAIT_LINES: Partial<Record<TraitId, readonly string[]>> = {
  valiente: [
    '{h} se ofreció a ir delante sin que nadie se lo pidiera.',
    '{h} se rió en la cara del peligro. El peligro no se rió.',
  ],
  cobarde: [
    '{h} sugirió tres veces dar media vuelta «por prudencia».',
    'Cada vez que crujía una rama, {h} acababa detrás de alguien.',
  ],
  codicioso: [
    '{h} tasó todo lo que veía, incluidas las botas del cliente.',
    '{h} preguntó dos veces si la paga era por cabeza o por grupo.',
  ],
  afortunado: [
    '{h} se encontró una moneda en el camino. Luego otra. Luego otra.',
    'Una flecha perdida rebotó en la hebilla de {h}. Ni un rasguño.',
  ],
  gafe: [
    'Desde que {h} se unió al viaje, se rompieron dos correas y se cruzaron tres gatos negros.',
    'Se puso a llover justo cuando {h} dijo «qué buen día hace».',
  ],
  bebedor: [
    '{h} llevaba una bota de vino «para desinfectar heridas». Llegó vacía.',
    'La primera pregunta de {h} al llegar a {place} fue dónde estaba la taberna.',
  ],
  leal: [
    '{h} no se separó del grupo ni para dormir.',
    '{h} cargó con la mochila de un compañero sin decir nada.',
  ],
  arrogante: [
    '{h} explicó a todo el grupo cómo hacer su trabajo. Varias veces.',
    '{h} dejó claro que, en su opinión, aquello era poca cosa para su talento.',
  ],
  supersticioso: [
    '{h} se negó a cruzar el puente hasta escupir tres veces al río.',
    '{h} colgó ajos en la tienda. Nadie durmió bien, pero tampoco vino ningún vampiro.',
  ],
  tuerto: ['El parche de {h} asustó más que su espada. Funcionó.'],
  cojo: ['{h} renqueó todo el camino sin una queja. Bueno, con alguna.'],
  cortado: ['Bastó con que {h} sonriera para que nadie buscara pelea.'],
};

/** Sucesos del camino, sin consecuencias. */
export const ROAD: readonly string[] = [
  'A medio camino se cruzaron con un buhonero que vendía «agua de la fuente de la juventud». Olía a pozo.',
  'Pasaron una noche en una posada donde la sopa era peor que la de El Jarro Partido. Lo apuntaron con orgullo.',
  'Un pastor les indicó el camino a cambio de que le escucharan cantar. Cantaba mal y largo.',
  'Una tormenta les obligó a refugiarse en un granero con una cabra que no paraba de mirarles.',
  'En un cruce, un cartel decía «A {place}: cerca». Mentía.',
  'Se cruzaron con otro grupo de aventureros. Hubo miradas, saludos tensos y nadie dijo a qué iba.',
  'Un niño les siguió dos leguas preguntando si eran héroes de verdad.',
  'Durmieron bajo las estrellas. Alguien roncó como un oso, y nadie admite haber sido.',
];

/** Hallazgos del camino: unas monedas extra para la caja. */
export const FINDS: readonly string[] = [
  'Junto al camino encontraron una bolsa olvidada con {gold} monedas. Nadie la reclamó, y nadie preguntó mucho.',
  'Un mercader agradecido por ahuyentar a unos lobos les dio {gold} monedas de propina.',
  'En el bolsillo de un bandido dormido había {gold} monedas. Ya no las hay.',
];

/** Piques y complicidades entre dos del grupo. */
export const BANTER: readonly string[] = [
  '{a} y {b} discutieron todo el viaje sobre si un dragón vence a un gigante. No hubo acuerdo.',
  '{a} le enseñó a {b} una canción de taberna. Ya no hay quien la pare.',
  '{a} roncó toda la noche y {b} amaneció con ojeras y ganas de venganza.',
  '{a} y {b} se apostaron la cena a ver quién volvía con más rasguños.',
  '{a} le salvó el pellejo a {b}, y se lo va a recordar durante meses.',
  '{a} y {b} no se hablaron en todo el camino. Nadie sabe por qué, ni se atreve a preguntar.',
];

/** Cuando alguien del grupo va desanimado. */
export const LOW_MORALE: readonly string[] = [
  '{h} iba con la cabeza en otra parte, y se notó.',
  '{h} apenas habló en todo el viaje. Echa de menos la cama del gremio, o algo más.',
  '{h} preguntó en voz alta para qué se juega uno el pellejo por tan poco.',
];

/** Cuando alguien va animado. */
export const HIGH_MORALE: readonly string[] = [
  '{h} silbó todo el camino. Contagia.',
  '{h} iba con tantas ganas que tiraba del grupo.',
];

/** Cierres que hablan del cliente. */
export const CLIENT_CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': [
    '{client} prometió hablar bien del gremio en todas las tabernas de la comarca.',
    '{client} quiso invitarles a cenar. Aceptaron, claro.',
  ],
  Éxito: [
    '{client} contó las monedas dos veces, pero pagó.',
    '{client} dio las gracias con un apretón de manos algo flojo.',
  ],
  'Éxito parcial': [
    '{client} pagó refunfuñando y pidió descuento para la próxima vez.',
    '{client} dijo que «algo es algo». Lo dijo con muy mala cara.',
  ],
  Fracaso: [
    '{client} cerró la puerta sin decir palabra.',
    '{client} ya está buscando otro gremio. Uno que cumpla.',
  ],
  Desastre: [
    '{client} ha pedido que no vuelvan a pasar por allí.',
    'Dicen que {client} va contando lo ocurrido por los mercados. No sale bien parado el gremio.',
  ],
};

export const MORE_CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': [
    'Será una de esas historias que se cuentan en la taberna durante años, cada vez más exagerada.',
    'Volvieron con la paga, con la gloria y con hambre.',
  ],
  Éxito: [
    'Sin heroicidades, sin desgracias: un buen día de trabajo.',
    'El gremio cobra, el cliente duerme tranquilo y todos contentos.',
  ],
  'Éxito parcial': [
    'Ni bien ni mal: regular tirando a «ya veremos».',
    'Lo importante se hizo. Lo demás, más o menos.',
  ],
  Fracaso: [
    'Hay días que es mejor no levantarse. Este era uno.',
    'Al volver, nadie quiso contar la historia dos veces.',
  ],
  Desastre: [
    'Algunas historias no se cuentan en la taberna. Esta, menos.',
    'El viaje de vuelta fue largo y muy silencioso.',
  ],
};

/** Cómo se cuenta que ha salido a la luz un rasgo oculto ({t}). */
export const REVEALS: readonly string[] = [
  'Por cierto: has descubierto que {h} es {t}.',
  'De este viaje sacas algo en claro: {h} es {t}.',
  'Los demás lo cuentan entre risas, o no tanto: {h} es {t}.',
  'Ahora ya lo sabes: {h} es {t}. En {place} quedó bien claro.',
];
