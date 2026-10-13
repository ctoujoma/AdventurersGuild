/**
 * Glosario de Ajustes: qué es cada cosa del juego, en una o dos frases.
 */
export const GLOSSARY: readonly { term: string; text: string }[] = [
  {
    term: 'Oro y próximo pago',
    text: 'Lo que hay en la caja. Junto a la campana está lo que toca pagar y qué día: la cuota a Merlo más los salarios de la semana. Si no llega, se acaba la partida.',
  },
  {
    term: 'Reputación y rango',
    text: 'Sube con los encargos bien hechos y baja con los fracasos. Con cada rango llegan encargos mejor pagados, mejores candidatos y más clientes en la taberna.',
  },
  {
    term: 'Riesgo de un encargo',
    text: 'Pan comido, Probable, Arriesgado o Suicida. Sale de comparar el grupo con el peligro del encargo; cambia según a quién mandes.',
  },
  {
    term: 'Peligro',
    text: 'Las calaveras del mapa (de una a cuatro) y el color del encargo, de verde (bajo) a rojo (letal). Con «?» no se sabe hasta mejorar la sala de mapas.',
  },
  {
    term: 'Historias',
    text: 'Encargos encadenados que llegan por carta. Cada paso abre el siguiente; en el mapa el hilo rojo une los pasos hechos (✓) con el que falta (número). Si dejas uno esperando, la comarca se revuelve.',
  },
  {
    term: 'Amenaza de la comarca',
    text: 'Crece cada noche que un paso de historia espera en el tablón y baja si no hay ninguna en marcha. Alta, asaltan las caravanas, llegan menos encargos y vienen bandidos a la taberna.',
  },
  {
    term: 'Asaltos y chivatazos',
    text: 'Desde el día 12, una banda puede atacar la taberna de noche. Con suerte alguien avisa antes (la bandera roja de arriba cuenta las noches). La empalizada, el vigía y el perro ayudan.',
  },
  {
    term: 'Moral',
    text: 'Las ganas de trabajar. Baja con los viajes y los fracasos, sube descansando en la taberna. Muy baja, rinden menos y pueden irse una noche cualquiera.',
  },
  {
    term: 'Heridos y desaparecidos',
    text: 'Los heridos se curan en la enfermería. Un desaparecido se perdió en una misión: puede volver solo (la capilla ayuda) o con un encargo de rescate.',
  },
  {
    term: 'Nivel y veteranos',
    text: 'La experiencia sube el nivel y con él el salario. Desde el nivel 4 son veteranos: el ala de veteranos les da descanso extra y ya no desertan.',
  },
  {
    term: 'Equipo',
    text: 'Lo traen algunos encargos («+ objeto»). Se da desde el arcón o la ficha del héroe. Común, raro (azul) o legendario (dorado). Si el héroe muere, el objeto se pierde.',
  },
  {
    term: 'Trofeos',
    text: 'Un éxito brillante en un encargo peligroso deja un trofeo. Colgado en la sala, atrae clientes: monedas cada día.',
  },
  {
    term: 'Modo libre',
    text: 'Con la deuda saldada el gremio es tuyo y la partida sigue. Otros gremios pujan por los encargos y pagan menos; los salarios se pagan cada 7 días y dos semanas sin pagar acaban con todo.',
  },
  {
    term: 'Fiesta de la comarca',
    text: 'Cada 10 días. Si la montas en la taberna, esa noche la caja se dobla y los que descansan se animan.',
  },
];
