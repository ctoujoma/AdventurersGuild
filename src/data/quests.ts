import type { QuestType } from '../core/model';
import type { SkillId } from '../core/party';
import { has, idText, msg, t, tl, type Txt } from '../textos';

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
    titles: tl('encargos.plantillas.Cazar.titulos'),
    texts: tl('encargos.plantillas.Cazar.textos'),
    stories: tl<readonly [string, string][]>('encargos.plantillas.Cazar.historias'),
    threats: tl('encargos.plantillas.Cazar.amenazas'),
  },
  Escoltar: {
    main: 'Combate',
    extra: ['Supervivencia', 'Trampas'],
    titles: tl('encargos.plantillas.Escoltar.titulos'),
    texts: tl('encargos.plantillas.Escoltar.textos'),
    stories: tl<readonly [string, string][]>('encargos.plantillas.Escoltar.historias'),
    threats: tl('encargos.plantillas.Escoltar.amenazas'),
  },
  Explorar: {
    main: 'Supervivencia',
    extra: ['Trampas', 'Arcano'],
    titles: tl('encargos.plantillas.Explorar.titulos'),
    texts: tl('encargos.plantillas.Explorar.textos'),
    stories: tl<readonly [string, string][]>('encargos.plantillas.Explorar.historias'),
    threats: tl('encargos.plantillas.Explorar.amenazas'),
  },
  Recuperar: {
    main: 'Trampas',
    extra: ['Supervivencia', 'Combate'],
    titles: tl('encargos.plantillas.Recuperar.titulos'),
    texts: tl('encargos.plantillas.Recuperar.textos'),
    stories: tl<readonly [string, string][]>('encargos.plantillas.Recuperar.historias'),
    threats: tl('encargos.plantillas.Recuperar.amenazas'),
  },
  Investigar: {
    main: 'Arcano',
    extra: ['Combate', 'Trampas'],
    titles: tl('encargos.plantillas.Investigar.titulos'),
    texts: tl('encargos.plantillas.Investigar.textos'),
    stories: tl<readonly [string, string][]>('encargos.plantillas.Investigar.historias'),
    threats: tl('encargos.plantillas.Investigar.amenazas'),
  },
  Limpiar: {
    main: 'Combate',
    extra: ['Arcano', 'Trampas'],
    titles: tl('encargos.plantillas.Limpiar.titulos'),
    texts: tl('encargos.plantillas.Limpiar.textos'),
    stories: tl<readonly [string, string][]>('encargos.plantillas.Limpiar.historias'),
    threats: tl('encargos.plantillas.Limpiar.amenazas'),
  },
};

/**
 * Clientes: id, la etiqueta del tablón y cómo se les nombra en una frase (`prosa`, en
 * `encargos.clientes.<id>`). El orden de las listas cuenta (el generador elige por posición).
 */
/** La etiqueta del tablón de un cliente como mensaje («Alcaldía de Hondogrís»). */
export const clientLabelMsg = (id: string): Txt =>
  has(`encargos.clientes.${id}.etiqueta`) ? msg(`encargos.clientes.${id}.etiqueta`) : id;

export const CLIENT_IDS = [
  'ilario',
  'mercaderes',
  'odile',
  'berta',
  'alcaldia_sotomuro',
  'viuda_arnau',
  'mayordomo',
  'salinas_ormaz',
  'quirico',
  'pastores',
  'bartolo',
  'urraca',
] as const;
export const SHADY_IDS = ['desconocido', 'corvo', 'voz_cortina'] as const;
/** Los de las historias (data/chains.ts): solo hace falta su prosa. */
const CHAIN_CLIENTS = [
  'alcaldia_hondogris',
  'casa_ferran',
  'cofradia_juncal',
  'abad_lope',
  'concejo_carbonera',
  'prior_anselmo',
  'tres_pueblos',
  'gremio',
] as const;

const ALL_CLIENTS: readonly string[] = [...CLIENT_IDS, ...SHADY_IDS, ...CHAIN_CLIENTS];

/** Id de un cliente por su etiqueta en español (las partidas viejas guardan la etiqueta). */
export const clientIdOf = (label: string): string | undefined =>
  ALL_CLIENTS.find((id) => idText(msg(`encargos.clientes.${id}.etiqueta`)) === label);

const known = (id: string) => has(`encargos.clientes.${id}.etiqueta`);

/** La etiqueta del tablón de un cliente (un id, o la etiqueta de una partida vieja). */
export const clientLabel = (id: string) => (known(id) ? t(`encargos.clientes.${id}.etiqueta`) : id);

/**
 * Cómo se nombra a un cliente en una frase («Berta, la posadera, pagó…»), como mensaje: la
 * etiqueta del tablón no lleva artículo y a veces es plural. Sin prosa, la etiqueta.
 */
export const clientMsg = (id: string): Txt => {
  const c = known(id) ? id : clientIdOf(id);
  if (!c) return id;
  return has(`encargos.clientes.${c}.prosa`)
    ? msg(`encargos.clientes.${c}.prosa`)
    : msg(`encargos.clientes.${c}.etiqueta`);
};

export const TWISTS = tl('encargos.giros');
