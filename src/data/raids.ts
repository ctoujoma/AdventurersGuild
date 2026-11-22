import { t, tl, tr } from '../textos';
/**
 * Textos de los asaltos a la taberna. Huecos: {band} (o {Band}, con mayúscula), {h} héroe,
 * {who} defensores. Lo que cambia con el número de la banda, entre llaves: «{viene|vienen}».
 */

export const BANDS: readonly string[] = tl('asaltos.bandas');

/** De dónde llega el chivatazo de que se acerca un asalto. */
export const TIPOFFS: readonly string[] = tl('asaltos.chivatazos');
/** Chivatazo traído por un explorador del gremio. */
export const SCOUT_TIPOFF = tr('asaltos.chivatazo_explorador');

export const RAID_OPEN: readonly string[] = tl('asaltos.asalto_empieza');

export const RAID_FIGHT: readonly string[] = tl('asaltos.asalto_pelea');

export const RAID_WON: readonly string[] = tl('asaltos.asalto_ganado');

export const RAID_LOST: readonly string[] = tl('asaltos.asalto_perdido');

export const RAID_EMPTY = t('asaltos.asalto_vacio');

/** Si la banda es plural («los Hermanos Cuervo», «las Ratas del Vado»). */
export const bandPlural = (band: string) => /^(los|las) /i.test(band);

/** Elige en un texto lo que va con la banda: «{viene|vienen}» según sea una o varios. */
export const bandNumber = (text: string, band: string) =>
  text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, one: string, many: string) =>
    bandPlural(band) ? many : one,
  );

/** La banda con mayúscula, para empezar una frase o una etiqueta. */
export const capBand = (band: string) => band.charAt(0).toUpperCase() + band.slice(1);
