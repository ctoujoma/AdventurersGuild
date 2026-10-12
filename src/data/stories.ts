import type { Outcome, QuestType } from '../core/model';
import type { SkillId } from '../core/party';

/**
 * Frases para los informes de misión. Huecos: {h} héroe protagonista, {who} el grupo,
 * {place} lugar. Las aperturas tienen versión para uno y para varios.
 */

export const OPENERS: Record<QuestType, readonly [one: string, many: string][]> = {
  Cazar: [
    [
      '{who} siguió el rastro hasta {place} durante dos noches.',
      '{who} siguieron el rastro hasta {place} durante dos noches.',
    ],
    [
      '{who} se apostó en {place} con el viento en contra.',
      '{who} se apostaron en {place} con el viento en contra.',
    ],
  ],
  Escoltar: [
    [
      '{who} caminó junto a la carreta todo el trayecto hasta {place}.',
      '{who} caminaron junto a la carreta todo el trayecto hasta {place}.',
    ],
    [
      'El mercader no paró de hablar en todo el camino a {place}. {who} aguantó.',
      'El mercader no paró de hablar en todo el camino a {place}. {who} aguantaron.',
    ],
  ],
  Explorar: [
    [
      '{who} bajó a {place} con una cuerda y una antorcha que no paraba de humear.',
      '{who} bajaron a {place} con una cuerda y dos antorchas que no paraban de humear.',
    ],
    [
      '{place} era más grande por dentro de lo que parecía por fuera.',
      '{place} era más grande por dentro de lo que parecía por fuera.',
    ],
  ],
  Recuperar: [
    [
      '{who} llegó a {place} cuando ya era noche cerrada.',
      '{who} llegaron a {place} cuando ya era noche cerrada.',
    ],
    [
      'El encargo parecía fácil, y eso a {who} tendría que haberle escamado.',
      'El encargo parecía fácil, y eso a {who} tendría que haberles escamado.',
    ],
  ],
  Investigar: [
    [
      '{who} pasó la noche en {place} con los ojos muy abiertos.',
      '{who} pasaron la noche en {place} con los ojos muy abiertos.',
    ],
    [
      'Nadie en {place} quería hablar. {who} invitó a una ronda y entonces hablaron todos.',
      'Nadie en {place} quería hablar. {who} invitaron a una ronda y entonces hablaron todos.',
    ],
  ],
  Limpiar: [
    [
      '{who} bajó a {place} con una escoba, una espada y poca paciencia.',
      '{who} bajaron a {place} con una escoba, una espada y poca paciencia.',
    ],
    [
      'El olor de {place} se notaba desde el camino.',
      'El olor de {place} se notaba desde el camino.',
    ],
  ],
};

export const LINES: Record<SkillId, { ok: readonly string[]; ko: readonly string[] }> = {
  Combate: {
    ok: [
      '{h} se plantó delante y no retrocedió ni un paso.',
      '{h} repartió golpes con más entusiasmo que técnica, pero funcionó.',
      'Cuando llegó la carga, {h} ya estaba esperando.',
    ],
    ko: [
      'Eran más de los que decía el encargo, y {h} se llevó la peor parte.',
      '{h} cargó primero y pensó después. Esta vez salió mal.',
      'La espada de {h} se quedó clavada en un tronco en el peor momento.',
    ],
  },
  Trampas: {
    ok: [
      '{h} encontró el cable antes de que nadie lo pisara.',
      'La cerradura cedió en cuanto {h} le habló bajito.',
      '{h} vio la losa suelta y avisó a los demás para que no la pisaran.',
    ],
    ko: [
      'La trampa saltó; {h} todavía tiene el susto en el cuerpo.',
      '{h} juró que esa losa no estaba ahí antes.',
      '{h} estuvo media hora con la cerradura y no hubo manera. Su versión es otra.',
    ],
  },
  Arcano: {
    ok: [
      '{h} leyó las runas en voz alta y lo que gruñía al fondo dejó de gruñir.',
      '{h} reconoció el símbolo a tiempo y nadie tocó lo que no debía.',
      '{h} hizo un gesto, la sala olió a azufre un momento y asunto resuelto.',
    ],
    ko: [
      '{h} pronunció mal una palabra. Las velas se apagaron todas a la vez.',
      '{h} dijo que entendía lo que ponía en la pared. No entendía ni una letra.',
      'El conjuro de {h} funcionó, pero sobre la persona equivocada.',
    ],
  },
  Supervivencia: {
    ok: [
      '{h} encontró un atajo por el barranco y ganaron medio día.',
      '{h} olió la emboscada antes de verla.',
      'Gracias a {h} durmieron a cubierto y comieron caliente todas las noches.',
    ],
    ko: [
      'Se perdieron dos veces. {h} jura que el mapa estaba mal.',
      'Llovió tres días seguidos y {h} eligió el peor sitio para acampar.',
      '{h} confundió setas con setas. Dos días de retortijones.',
    ],
  },
};

export const CLOSERS: Record<Outcome, readonly string[]> = {
  'Éxito brillante': [
    'Volvieron cantando y con la bolsa llena.',
    'El cliente pagó, dejó propina y abrazó a todo el mundo.',
  ],
  Éxito: [
    'Trabajo hecho. El cliente pagó sin rechistar.',
    'Encargo cumplido, sin sustos y sin mucha historia.',
  ],
  'Éxito parcial': [
    'El cliente pagó la mitad, «por las molestias».',
    'Medio trabajo, media paga y una discusión larguísima.',
  ],
  Fracaso: [
    'Volvieron con las manos vacías y los pies llenos de ampollas.',
    'El cliente no soltó ni una moneda, y encima se quejó.',
  ],
  Desastre: [
    'Volvieron peor de lo que se fueron, y sin nada.',
    'Nadie quiere hablar de lo que pasó allí.',
  ],
};

/** Una frase de ambiente para cada mañana en la taberna. */
export const FLAVOR = [
  'Un bardo lleva toda la mañana desafinando en la barra. Es primo del herrero, así que nadie dice nada.',
  'Alguien ha grabado «Brom nunca falla» en una mesa. Debajo, con otra letra, pone «ya, ya».',
  'Bigotes ha dejado en la puerta algo que no es un ratón. El tabernero lo ha tapado con un cubo.',
  'Hoy hay sopa con tropezones. El tabernero jura que es tocino.',
  'Un viajero pregunta si es aquí donde contratan héroes «baratos, pero no tanto».',
  'Ha llovido toda la noche. A la gotera de la bodega ya la llaman Gertrudis.',
  'El prestamista ha pasado por delante de la puerta, despacio, mirando hacia dentro.',
  'Dos parroquianos discuten si un grifo es más pájaro o más gato. Ya hay dinero en la mesa.',
  'El tabernero jura que el retrato del tío Fausto le guiña un ojo por las noches.',
  'Un crío ha entrado a acariciar a Bigotes. Ha salido con un arañazo y tan contento.',
];

/** Apodos que se ganan con una herida grave. */
export const SCARS = [
  { trait: 'tuerto' as const, nick: { m: 'el Tuerto', f: 'la Tuerta' }, text: 'ha perdido un ojo' },
  {
    trait: 'cojo' as const,
    nick: { m: 'Pata Chula', f: 'Pata Chula' },
    text: 'se ha dejado media rodilla entre las rocas',
  },
  {
    trait: 'cortado' as const,
    nick: { m: 'Cara Cortada', f: 'Cara Cortada' },
    text: 'lleva un tajo de oreja a barbilla',
  },
];
