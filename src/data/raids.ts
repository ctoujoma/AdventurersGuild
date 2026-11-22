import { has, idText, msg, t, tl, tx, type Msg, type Params, type Txt } from '../textos';
/**
 * Textos de los asaltos a la taberna (`asaltos.…`). Huecos: {banda}, {heroe}, {grupo}; {varios}
 * dice si la banda va en plural, para elegir el verbo (ver `bandParams`).
 */

/** Las bandas, como mensajes (lo que se guarda en `Raid.band`). */
export const BANDS: readonly Msg[] = tl<readonly unknown[]>('asaltos.bandas').map((_, i) =>
  msg(`asaltos.bandas.${i}.nombre`),
);

/** Cuántos hay de cada lista (el núcleo elige por posición). */
export const TIPOFFS = tl('asaltos.chivatazos');
export const RAID_OPEN = tl('asaltos.asalto_empieza');
export const RAID_FIGHT = tl('asaltos.asalto_pelea');
export const RAID_WON = tl('asaltos.asalto_ganado');
export const RAID_LOST = tl('asaltos.asalto_perdido');

/**
 * Si la banda es plural («los Hermanos Cuervo», «las Ratas del Vado»): lo dice su `varios` en el
 * idioma de ahora; las partidas viejas traen el nombre en español y se mira el artículo.
 */
export function bandPlural(band: Txt): boolean {
  if (typeof band === 'string') return /^(los|las) /i.test(band);
  const k = band.k.replace(/\.nombre$/, '.varios');
  return has(k) ? t(k) === 'si' : /^(los|las) /i.test(idText(band));
}

/** Los huecos de la banda para un texto: `{banda}` y `{varios}`. */
export const bandParams = (band: Txt, extra: Params = {}): Params => ({
  banda: band,
  varios: bandPlural(band),
  ...extra,
});

/** La banda con mayúscula, para empezar una frase o una etiqueta. */
export const capBand = (band: Txt) => {
  const b = tx(band);
  return b.charAt(0).toUpperCase() + b.slice(1);
};
