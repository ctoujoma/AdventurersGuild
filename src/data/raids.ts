/** Textos de los asaltos a la taberna. Huecos: {band}, {h} héroe, {who} defensores. */

export const BANDS: readonly string[] = [
  'la banda del Tuerto Garra',
  'los Hermanos Cuervo',
  'las Ratas del Vado',
  'la Compañía Sin Bandera',
  'los Lobos de Hondogrís',
  'la cuadrilla de Mano Negra',
];

/** De dónde llega el chivatazo de que se acerca un asalto. */
export const TIPOFFS: readonly string[] = [
  'El tabernero ha oído en la barra que {band} anda preguntando por El Jarro Partido.',
  'Un buhonero asustado cuenta que {band} acampa a dos leguas, y que hablan de tu caja.',
  'Bigotes lleva dos noches bufando a la puerta, y alguien ha pintado en el poste del camino la señal de {band}.',
  'Una niña del pueblo trae un recado: {band} viene a por el gremio.',
];
/** Chivatazo traído por un explorador del gremio. */
export const SCOUT_TIPOFF =
  '{h} ha visto huellas y hogueras en el camino real: es {band}, y vienen hacia aquí.';

export const RAID_OPEN: readonly string[] = [
  'Pasada la medianoche, una fila de antorchas bajó por el camino real: era {band}.',
  'Los perros del pueblo ladraron a la vez. Luego se oyeron botas y voces en el patio: había llegado {band}.',
  'A deshoras, alguien aporreó la puerta con el pomo de una espada. Era {band}.',
];

export const RAID_FIGHT: readonly string[] = [
  '{h} salió por la puerta antes que nadie y tumbó a dos antes de que encendieran la segunda antorcha.',
  '{h} se plantó junto al pozo y por ahí no pasó nadie.',
  '{h} peleó espalda con espalda junto al poste del camino.',
  'Un bandido intentó colarse por la ventana de la sala; {h} lo despidió con un taburete.',
];

export const RAID_WON: readonly string[] = [
  'Al alba, {band} huía camino abajo. En el patio se dejaron las antorchas y un sombrero de ala ancha.',
  'Los que quedaban en pie salieron corriendo. En el pueblo ya cuentan que en El Jarro Partido no se roba.',
];

export const RAID_LOST: readonly string[] = [
  'Eran demasiados. Se llevaron lo que quisieron y antes del alba ya no estaban.',
  'Cuando por fin se fueron, la caja estaba medio vacía y la puerta, arrancada.',
];

export const RAID_EMPTY =
  'No había nadie en casa para defenderla. El tabernero se escondió en la bodega con Bigotes y oyó cómo vaciaban la caja.';
