import type { QuestType } from '../core/model';
import type { SkillId } from '../core/party';
import { has, t, tl } from '../textos';

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

export const PLACES = tl('encargos.lugares');

/**
 * Clientes: id, la etiqueta del tablón y cómo se les nombra en una frase (`prosa`, en
 * `encargos.clientes.<id>`). El orden de las listas cuenta (el generador elige por posición).
 */
const NORMAL_CLIENTS = [
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
const SHADY = ['desconocido', 'corvo', 'voz_cortina'] as const;
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

const clientLabel = (id: string) => t(`encargos.clientes.${id}.etiqueta`);

export const CLIENTS: readonly string[] = NORMAL_CLIENTS.map(clientLabel);

export const SHADY_CLIENTS: readonly string[] = SHADY.map(clientLabel);

/**
 * Cómo se nombra a cada cliente en una frase («Berta, la posadera, pagó…»): la etiqueta del
 * tablón no lleva artículo y a veces es plural. Los que no tienen prosa, tal cual.
 */
const CLIENT_PROSE: Record<string, string> = Object.fromEntries(
  [...NORMAL_CLIENTS, ...SHADY, ...CHAIN_CLIENTS]
    .filter((id) => has(`encargos.clientes.${id}.prosa`))
    .map((id) => [clientLabel(id), t(`encargos.clientes.${id}.prosa`)]),
);
export const clientProse = (label: string) => CLIENT_PROSE[label] ?? label;

export const TWISTS = tl('encargos.giros');
