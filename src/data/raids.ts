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
  'Bigotes lleva dos noches bufando a la puerta. Y alguien ha marcado el poste del camino con el signo de {band}.',
  'Una niña del pueblo trae un recado: {band} viene a por el gremio.',
];
/** Chivatazo traído por un explorador del gremio. */
export const SCOUT_TIPOFF =
  '{h} ha visto huellas y hogueras en el camino real: es {band}, y vienen hacia aquí.';

export const RAID_OPEN: readonly string[] = [
  'Pasada la medianoche, una fila de antorchas bajó por el camino real: era {band}.',
  'Los perros del pueblo ladraron a la vez. Luego, el ruido de botas en el patio: {band}.',
  'Alguien aporreó la puerta a deshoras. No eran clientes: era {band}.',
];

export const RAID_FIGHT: readonly string[] = [
  '{h} salió el primero por la puerta y tumbó a dos antes de que encendieran la segunda antorcha.',
  '{h} defendió el pozo como si fuera suyo.',
  '{h} peleó espalda con espalda junto al poste del camino.',
  'Un bandido intentó colarse por la ventana de la sala; {h} lo despidió con un taburete.',
];

export const RAID_WON: readonly string[] = [
  'Al alba, {band} huía camino abajo dejando atrás antorchas, un sombrero y algo de orgullo. Se correrá la voz.',
  'Los que quedaban en pie salieron corriendo. En el pueblo ya cuentan que en El Jarro Partido no se roba.',
];

export const RAID_LOST: readonly string[] = [
  'No hubo manera. Se llevaron lo que quisieron y desaparecieron antes del alba.',
  'Cuando por fin se fueron, la caja estaba vacía a medias y la puerta, en el suelo.',
];

export const RAID_EMPTY =
  'No había nadie en casa para defenderla. El tabernero se escondió en la bodega con Bigotes y oyó cómo vaciaban la caja.';
