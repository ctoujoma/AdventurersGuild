import TEXTOS from 'virtual:textos';
import { format, type Lang, type Msg, type Params } from './formato';

/**
 * Los textos del juego, sacados a `src/textos/<idioma>/<zona>.yaml` (ver `docs/textos.md`).
 *
 * - `t('zona.clave', { huecos })`: el texto escrito en el idioma de la partida.
 * - `tl('zona.lista')`: una lista de variantes (las mismas entradas en todos los idiomas).
 * - `msg('zona.clave', { huecos })`: el texto por escribir, para guardarlo en la partida;
 *   `tx(…)` lo escribe al enseñarlo (las frases de partidas viejas pasan tal cual).
 *
 * El idioma se elige al arrancar (Ajustes; cambiarlo recarga la página), así que los datos
 * pueden escribir sus textos al cargar el módulo.
 */

export type { Msg, Param, Params } from './formato';

/** Texto guardado: un mensaje, o una frase ya escrita (de las partidas de antes de los textos). */
export type Txt = Msg | string;

type Tree = { [k: string]: Node };
type Node = string | readonly Node[] | Tree;

export const SOURCE = 'es';
const ALL = TEXTOS as Record<string, Tree>;
/** Idiomas con textos (el selector de Ajustes sale cuando haya más de uno). */
export const LANGS = Object.keys(ALL);

let code = SOURCE;
let tree: Tree = ALL[SOURCE]!;
let fallback: Tree = tree;

/** Idioma guardado en Ajustes (se lee directamente para no depender de la plataforma). */
function savedLang(): string | undefined {
  try {
    const raw = globalThis.localStorage?.getItem('jarro:ajustes');
    const l = raw ? (JSON.parse(raw) as { lang?: unknown }).lang : undefined;
    return typeof l === 'string' ? l : undefined;
  } catch {
    return undefined;
  }
}

const lang: Lang = {
  code,
  plural: () => 'other',
  list: (xs) => xs.join(', '),
  render: (m) => t(m.k, m.p),
};

/** Cambia el idioma (al arrancar, o en los tests). Uno sin textos se queda en el de origen. */
export function setLang(l: string | undefined): void {
  code = l && ALL[l] ? l : SOURCE;
  tree = ALL[code]!;
  fallback = ALL[SOURCE]!;
  lang.code = code;
  const rules = new Intl.PluralRules(code);
  lang.plural = (n) => rules.select(n);
  const lists = new Intl.ListFormat(code, { type: 'conjunction' });
  lang.list = (xs) => lists.format(xs);
  lang.post = POST[code];
}

/** Retoques de cada idioma a la frase ya escrita (ver `Lang.post`). */
const POST: Record<string, (s: string) => string> = {
  // Sin \b: en JavaScript la «í» de «Amplía» no cuenta como letra.
  es: (s) =>
    s
      .replace(/(?<![\p{L}\p{N}])([Aa]) el(?![\p{L}\p{N}])/gu, '$1l')
      .replace(/(?<![\p{L}\p{N}])([Dd])e el(?![\p{L}\p{N}])/gu, '$1el'),
};
setLang(savedLang());

export const currentLang = () => code;

/** «a, b y c» (o «a, b o c» con `o`), según el idioma. */
export function list(items: readonly string[], kind: 'y' | 'o' = 'y'): string {
  return kind === 'y'
    ? lang.list(items)
    : new Intl.ListFormat(code, { type: 'disjunction' }).format(items);
}

/** Claves que faltan (se avisa una vez de cada una). */
const warned = new Set<string>();

function find(root: Tree, key: string): Node | undefined {
  let n: Node | undefined = root;
  for (const part of key.split('.')) {
    if (n === undefined || typeof n === 'string') return undefined;
    n = (n as Record<string, Node>)[part];
  }
  return n;
}

function lookup(key: string): Node | undefined {
  const n = find(tree, key) ?? find(fallback, key);
  if (n === undefined && !warned.has(key)) {
    warned.add(key);
    console.warn(`Texto sin escribir: ${key}`);
  }
  return n;
}

/** El texto de una clave, escrito con sus huecos. Sin la clave, devuelve la clave. */
export function t(key: string, p?: Params): string {
  const n = lookup(key);
  if (typeof n !== 'string') return key;
  return format(n, p, lang);
}

/**
 * El texto de una clave tal cual, sin rellenar los huecos: para las plantillas que el núcleo
 * rellena después (`{n}`, `{place}`…). Pendiente: que el núcleo pase a `t(clave, huecos)`.
 */
export function tr(key: string): string {
  const n = lookup(key);
  return typeof n === 'string' ? n : key;
}

/**
 * Una lista de textos (variantes, niveles…). Las listas de listas (`[título, texto]`) también:
 * el tipo se da al llamar (`tl<readonly [string, string][]>(…)`).
 */
export function tl<T = readonly string[]>(key: string): T {
  const n = lookup(key);
  return (Array.isArray(n) ? n : []) as T;
}

/** ¿Existe la clave? (para textos opcionales). */
export const has = (key: string) =>
  find(tree, key) !== undefined || find(fallback, key) !== undefined;

/** Un texto por escribir (lo que se guarda en la partida). */
export const msg = (k: string, p?: Params): Msg => (p ? { k, p } : { k });

/** Escribe un texto guardado. */
export function tx(x: Txt | null | undefined): string {
  if (x === undefined || x === null) return '';
  return typeof x === 'string' ? x : t(x.k, x.p);
}

const source: Lang = {
  code: SOURCE,
  plural: (n) => new Intl.PluralRules(SOURCE).select(n),
  list: (xs) => new Intl.ListFormat(SOURCE, { type: 'conjunction' }).format(xs),
  render: (m) => idText(m),
  post: POST[SOURCE],
};

/**
 * Un texto guardado escrito siempre en el idioma de origen: para lo que hace de id (el dibujo de
 * un legendario va por su nombre) y para reconocer frases viejas. No es para enseñar.
 */
export function idText(x: Txt | undefined): string {
  if (x === undefined || x === null) return '';
  if (typeof x === 'string') return x;
  const n = find(ALL[SOURCE]!, x.k);
  return typeof n === 'string' ? format(n, x.p, source) : x.k;
}

/** Los textos de un idioma, tal cual (para las herramientas y los tests). */
export const textsOf = (l: string): Tree | undefined => ALL[l];
