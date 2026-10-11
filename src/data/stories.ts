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
      '{who} bajó a {place} con una cuerda, una antorcha y mucha fe.',
      '{who} bajaron a {place} con una cuerda, dos antorchas y mucha fe.',
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
      'El encargo parecía sencillo. {who} debió sospechar.',
      'El encargo parecía sencillo. {who} debieron sospechar.',
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
      '{h} vio la losa suelta y la rodeó con una sonrisa.',
    ],
    ko: [
      'La trampa saltó; {h} todavía tiene el susto en el cuerpo.',
      '{h} juró que esa losa no estaba ahí antes.',
      'La cerradura ganó. {h} lo cuenta de otra manera.',
    ],
  },
  Arcano: {
    ok: [
      '{h} leyó las runas en voz alta y lo que esperaba allí se calló.',
      '{h} reconoció el símbolo a tiempo y nadie tocó lo que no debía.',
      'Un gesto de {h}, un olor a azufre, y asunto resuelto.',
    ],
    ko: [
      '{h} pronunció mal una palabra. Las velas se apagaron todas a la vez.',
      'Nadie entendió lo que estaba escrito en la pared. {h} dijo que sí, y mintió.',
      'El conjuro de {h} funcionó, pero sobre la persona equivocada.',
    ],
  },
  Supervivencia: {
    ok: [
      '{h} encontró un atajo por el barranco y ganaron medio día.',
      '{h} olió la emboscada antes de verla.',
      'Gracias a {h} durmieron secos, comieron caliente y nadie se perdió.',
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
    'Volvieron cantando, y no solo por el vino.',
    'El cliente pagó con propina y lágrimas en los ojos.',
  ],
  Éxito: [
    'Trabajo hecho. El cliente pagó sin rechistar.',
    'Encargo cumplido. Nada que contar en la taberna, salvo todo.',
  ],
  'Éxito parcial': [
    'El cliente pagó la mitad, «por las molestias».',
    'Medio trabajo, media paga y una discusión larguísima.',
  ],
  Fracaso: [
    'Volvieron con las manos vacías y la mirada en el suelo.',
    'El cliente no pagó. Ni dio las gracias.',
  ],
  Desastre: ['No volvieron como se fueron.', 'Nadie quiere hablar de lo que pasó allí.'],
};

/** Una frase de ambiente para cada mañana en la taberna. */
export const FLAVOR = [
  'En la barra, un bardo desafina y nadie se queja: es primo del herrero.',
  'Alguien ha grabado «Brom nunca falla» en una mesa. Debajo, otra mano: «Ya».',
  'Bigotes ha cazado algo que no es un ratón. Nadie quiere mirar.',
  'Hoy la sopa tiene tropezones. Mejor no preguntar de qué.',
  'Un viajero pregunta si es aquí donde contratan héroes «baratos, pero no tanto».',
  'Ha llovido toda la noche. La gotera de la bodega ya tiene nombre: Gertrudis.',
  'El prestamista ha pasado por la puerta. No ha entrado. Solo ha mirado.',
  'Dos parroquianos discuten si un grifo es un pájaro o un gato. Hay apuestas.',
  'El tabernero jura que el retrato del tío Fausto le guiña un ojo por las noches.',
  'Ha venido un niño a pedir un autógrafo. A Bigotes.',
];

/** Apodos que se ganan con una herida grave. */
export const SCARS = [
  { trait: 'tuerto' as const, nick: { m: 'el Tuerto', f: 'la Tuerta' }, text: 'ha perdido un ojo' },
];
