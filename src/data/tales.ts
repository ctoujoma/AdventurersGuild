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
      '{who} salió hacia {place} antes de que cantara el gallo, con un cordero atado de cebo.',
      '{who} salieron hacia {place} antes de que cantara el gallo, con un cordero atado de cebo.',
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
      'En el camino a {place} asaltan a uno de cada tres carros. {who} no soltó la empuñadura en todo el viaje.',
      'En el camino a {place} asaltan a uno de cada tres carros. {who} no soltaron la empuñadura en todo el viaje.',
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
      'En {place} había un palmo de polvo y, en el polvo, huellas de algo que no llevaba botas.',
      'En {place} había un palmo de polvo y, en el polvo, huellas de algo que no llevaba botas.',
    ],
  ],
  Recuperar: [
    [
      '{client} describió el objeto con tanto detalle que {who} sospechó que no era suyo.',
      '{client} describió el objeto con tanto detalle que {who} sospecharon que no era suyo.',
    ],
    [
      'El objeto seguía en {place}. El problema era el bicho que dormía encima.',
      'El objeto seguía en {place}. El problema era el bicho que dormía encima.',
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
      'Todas las pistas acababan en {place}, y allí nadie sabía nada de nada.',
      'Todas las pistas acababan en {place}, y allí nadie sabía nada de nada.',
    ],
  ],
  Limpiar: [
    [
      'Desde la puerta de {place} ya se oía algo rascando y royendo.',
      'Desde la puerta de {place} ya se oía algo rascando y royendo.',
    ],
    [
      '{who} se tapó la nariz con un pañuelo antes de bajar a {place}. No sirvió de nada.',
      '{who} se taparon la nariz con un pañuelo antes de bajar a {place}. No sirvió de nada.',
    ],
    [
      '{client} juraba que eran «cuatro o cinco». {who} contó más de treinta.',
      '{client} juraba que eran «cuatro o cinco». {who} contaron más de treinta.',
    ],
  ],
};

export const MORE_LINES: Record<SkillId, { ok: readonly string[]; ko: readonly string[] }> = {
  Combate: {
    ok: [
      '{h} esquivó el primer golpe y no hubo un segundo.',
      '{h} pegó un grito tan bestia que la mitad salió corriendo antes de empezar.',
      '{h} usó una silla, una cacerola y, al final, la espada.',
    ],
    ko: [
      '{h} resbaló en el barro justo cuando más falta hacía estar de pie.',
      'El escudo de {h} paró el golpe, pero el brazo se llevó un buen crujido.',
      'Les cayeron por la espalda y {h} no se dio cuenta hasta que fue tarde.',
    ],
  },
  Trampas: {
    ok: [
      '{h} desmontó el mecanismo y se guardó un muelle «por si acaso».',
      'Un dardo pasó silbando junto a la oreja de {h}, que ya se había agachado.',
      '{h} fue tanteando cada baldosa con la punta del cuchillo. Tardaron, pero pasaron.',
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
      'A {h} se le erizó el vello de los brazos y dio la voz de alarma antes que nadie.',
    ],
    ko: [
      'El amuleto de {h} se puso al rojo vivo y hubo que tirarlo a un charco.',
      '{h} leyó el pergamino del revés. Durante una hora, todos hablaron al revés.',
      'Lo que dormía en la cripta despertó, y {h} no supo volver a dormirlo.',
    ],
  },
  Supervivencia: {
    ok: [
      '{h} vio venir la tormenta por el color del cielo y encontró una cueva a tiempo.',
      '{h} cazó, desplumó y asó un faisán mientras los demás montaban el campamento.',
      'Siguiendo el musgo de los árboles, {h} los sacó del bosque sin un rasguño.',
    ],
    ko: [
      '{h} encendió la hoguera con leña verde. Echó humo toda la noche y no calentó nada.',
      'El río estaba más crecido de lo que {h} calculó. Perdieron media carga.',
      '{h} dejó la comida sin colgar y los lobos cenaron mejor que el grupo.',
    ],
  },
};

/** Cuando el protagonista de un desafío es de una clase, a veces lo cuenta a su manera. */
export const CLASS_LINES: Record<ClassId, { ok: readonly string[]; ko: readonly string[] }> = {
  guerrero: {
    ok: [
      '{h} se puso delante, como hace siempre, y aguantó todo lo que le echaron.',
      '{h} no se anduvo con rodeos. Dos tajos y a otra cosa.',
    ],
    ko: [
      '{h} quiso arreglarlo a espadazos, y aquello no se arreglaba así.',
      'La armadura de {h} pesaba demasiado para aquel terreno, y se notó.',
    ],
  },
  picaro: {
    ok: [
      '{h} se escurrió por la parte de atrás y abrió la puerta desde dentro.',
      '{h} entró y salió sin que nadie se diera cuenta, que para eso se le paga.',
    ],
    ko: [
      '{h} intentó colarse y tropezó con el único cubo de todo el pasillo.',
      'Hasta a {h} se le resbalan los dedos de vez en cuando.',
    ],
  },
  mago: {
    ok: [
      '{h} murmuró algo en una lengua muerta y la cosa se calmó.',
      'Una chispa azul en la mano de {h} y el camino quedó despejado.',
    ],
    ko: [
      'A {h} se le enredó la lengua a mitad del conjuro. Salieron sapos.',
      '{h} lo tenía todo calculado, menos el viento.',
    ],
  },
  clerigo: {
    ok: [
      '{h} rezó en voz alta y, quizá por casualidad, todo salió bien.',
      'Con una bendición y un buen bastonazo, {h} lo dejó todo en paz.',
    ],
    ko: [
      'Los dioses estaban ocupados en otra cosa cuando {h} los llamó.',
      'Cuando {h} acabó la oración, ya era tarde.',
    ],
  },
  explorador: {
    ok: [
      '{h} conocía un sendero de cabras que no sale en ningún mapa.',
      '{h} pegó la oreja al suelo y supo por dónde venían.',
    ],
    ko: [
      'Por primera vez en años, {h} se perdió, y no quiere que se sepa.',
      'El rastro que siguió {h} era de un jabalí. Un jabalí con muy mal genio.',
    ],
  },
};

/** Apartes por rasgo: dan color y, si el rasgo está oculto, son una pista. */
export const TRAIT_LINES: Partial<Record<TraitId, readonly string[]>> = {
  valiente: [
    '{h} se ofreció a ir delante sin que nadie se lo pidiera.',
    '{h} se rió del peligro, y el peligro le dejó un recuerdo en la pierna.',
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
  tuerto: ['Con el parche, a {h} le bastaba con mirar mal para que se apartaran.'],
  cojo: ['{h} renqueó todo el camino sin una queja. Bueno, con alguna.'],
  cortado: ['Bastó con que {h} sonriera para que nadie buscara pelea.'],
};

/** Sucesos del camino, sin consecuencias. */
export const ROAD: readonly string[] = [
  'A medio camino se cruzaron con un buhonero que vendía «agua de la fuente de la juventud». Olía a pozo.',
  'Durmieron en una posada donde la sopa era aún peor que la de El Jarro Partido. No lo creían posible.',
  'Un pastor les indicó el camino a cambio de que le escucharan cantar. Cantaba mal y largo.',
  'La tormenta los pilló en campo abierto y pasaron la noche en un granero, con una cabra muy curiosa.',
  'En un cruce, un cartel decía «A {place}, una legua». Eran tres.',
  'Se cruzaron con otra cuadrilla de aventureros. Se saludaron con la cabeza y nadie dijo adónde iba.',
  'Un niño les siguió dos leguas preguntando si eran héroes de verdad.',
  'Durmieron al raso. Alguien roncó toda la noche y nadie reconoce haber sido.',
];

/** Hallazgos del camino: unas monedas extra para la caja. */
export const FINDS: readonly string[] = [
  'Junto al camino encontraron una bolsa con {gold} monedas. Preguntaron en la venta más cercana, pero sin mucho empeño.',
  'Un mercader agradecido por ahuyentar a unos lobos les dio {gold} monedas de propina.',
  'Un bandido dormía la mona junto al camino con {gold} monedas en el bolsillo. Se despertó más ligero.',
];

/** Piques y complicidades entre dos del grupo. */
export const BANTER: readonly string[] = [
  '{a} y {b} discutieron todo el viaje sobre si un dragón vence a un gigante. No hubo acuerdo.',
  '{a} le enseñó a {b} una canción de taberna. Ya no hay quien la pare.',
  '{a} roncó toda la noche y {b} amaneció con ojeras y ganas de venganza.',
  '{a} y {b} se apostaron la cena a ver quién volvía con más rasguños.',
  '{a} le salvó el pellejo a {b}, y se lo va a recordar durante meses.',
  '{a} y {b} no se dirigieron la palabra en todo el viaje. Algo pasó la primera noche.',
];

/** Cuando alguien del grupo va desanimado. */
export const LOW_MORALE: readonly string[] = [
  '{h} iba con la cabeza en otra parte, y se notó.',
  '{h} apenas abrió la boca en todo el viaje, y casi no comió.',
  '{h} preguntó en voz alta para qué se juega uno el pellejo por tan poco.',
];

/** Cuando alguien va animado. */
export const HIGH_MORALE: readonly string[] = [
  '{h} fue silbando todo el camino y al final silbaban todos.',
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
    '{client} dice que la próxima vez buscará otro gremio.',
  ],
  Desastre: [
    '{client} ha pedido que no vuelvan a pasar por allí.',
    'Dicen que {client} va contando lo ocurrido por los mercados. No sale bien parado el gremio.',
  ],
};

export const MORE_CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': [
    'Esta la contarán en la taberna durante años, y cada vez con más enemigos.',
    'Volvieron con la paga y con un hambre de lobo.',
  ],
  Éxito: [
    'Nada de heroicidades. Un trabajo limpio y bien pagado.',
    'El cliente pagó lo acordado y todos a cenar.',
  ],
  'Éxito parcial': [
    'No salió mal del todo, pero tampoco como para presumir.',
    'Hicieron lo principal y dejaron a medias lo demás.',
  ],
  Fracaso: [
    'Hay días en que más vale no salir de la cama, y este fue uno.',
    'De la paga, ni rastro. Esta noche se cena pan duro.',
  ],
  Desastre: [
    'Esta historia no se va a contar en la taberna.',
    'El viaje de vuelta fue largo y muy silencioso.',
  ],
};

/** Cómo se cuenta que ha salido a la luz un rasgo oculto ({t}). */
export const REVEALS: readonly string[] = [
  'Por cierto, ahora sabes algo más: {h} es {t}.',
  'De este viaje sacas algo en claro: {h} es {t}.',
  'Según cuentan los demás, {h} es {t}.',
  'En {place} quedó bien claro que {h} es {t}.',
];

/** Cuando el protagonista lleva un objeto bueno o legendario ({item}). */
export const ITEM_LINES: readonly string[] = [
  '{h} sacó {item} y se acabó la discusión.',
  'Sin {item}, {h} no habría vuelto para contarlo.',
  '{Item} le salvó el pellejo a {h} en el peor momento.',
];
