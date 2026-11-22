import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { argsOf, format, parse, type Lang } from './formato';
import { LANGS, SOURCE, list, msg, t, textsOf, tl, tx } from '.';

const es: Lang = {
  code: 'es',
  plural: (n) => new Intl.PluralRules('es').select(n),
  list: (xs) => new Intl.ListFormat('es', { type: 'conjunction' }).format(xs),
  render: (m) => t(m.k, m.p),
};

describe('formato de los mensajes', () => {
  it('rellena huecos, plurales, select y mayúsculas', () => {
    expect(format('Hola, {nombre}', { nombre: 'Lysa' }, es)).toBe('Hola, Lysa');
    const jarras = '{n, plural, =0 {ni una jarra} one {# jarra} other {# jarras}}';
    expect(format(jarras, { n: 0 }, es)).toBe('ni una jarra');
    expect(format(jarras, { n: 1 }, es)).toBe('1 jarra');
    expect(format(jarras, { n: 7 }, es)).toBe('7 jarras');
    const p = '{sexo, select, f {pálida} other {pálido}}';
    expect(format(p, { sexo: 'f' }, es)).toBe('pálida');
    expect(format(p, { sexo: 'm' }, es)).toBe('pálido');
    expect(format('{x, select, si {sí} other {no}}', { x: true }, es)).toBe('sí');
    expect(format('{banda, mayus} llega', { banda: 'los Cuervo' }, es)).toBe('Los Cuervo llega');
    expect(format('{a}', { a: ['Lysa', 'Maren', 'Brom'] }, es)).toBe('Lysa, Maren y Brom');
    expect(format('{n, plural, one {# {cosa}} other {# {cosa}s}}', { n: 2, cosa: 'pan' }, es)).toBe(
      '2 pans',
    );
  });

  it('escribe los mensajes anidados en el idioma de ahora', () => {
    expect(tx(msg('etiquetas.estado.herido', { sexo: 'f', dias: 2 }))).toBe('Herida · 2 d');
    expect(tx('Frase de una partida vieja')).toBe('Frase de una partida vieja');
    expect(list(['a', 'b', 'c'], 'o')).toBe('a, b o c');
  });

  it('avisa de los textos mal escritos', () => {
    expect(() => parse('{n, plural, one {x}}')).toThrow();
    expect(() => parse('{sin cerrar')).toThrow();
    expect(argsOf('{a} y {n, plural, one {# {b}} other {#}}')).toEqual(['a', 'b', 'n']);
  });
});

/** Cada texto de un árbol, con su clave. Las listas cuentan como nodos (para su largo). */
type Leaf = { key: string; text: string };
function leaves(n: unknown, key: string, out: Leaf[], lists: Map<string, number>): void {
  if (typeof n === 'string') out.push({ key, text: n });
  else if (Array.isArray(n)) {
    lists.set(key, n.length);
    n.forEach((x, i) => leaves(x, `${key}.${i}`, out, lists));
  } else if (n && typeof n === 'object')
    for (const [k, v] of Object.entries(n)) leaves(v, key ? `${key}.${k}` : k, out, lists);
}

const SRC = readFileSync; // (alias corto)
const all: Leaf[] = [];
const lists = new Map<string, number>();
leaves(textsOf(SOURCE), '', all, lists);

describe('los ficheros de textos', () => {
  it('todos los textos de origen se pueden leer', () => {
    const bad = all.filter(({ text }) => {
      try {
        parse(text);
        return false;
      } catch {
        return true;
      }
    });
    expect(bad.map((b) => b.key)).toEqual([]);
  });

  it('los otros idiomas tienen las mismas claves, huecos y listas', () => {
    for (const l of LANGS.filter((x) => x !== SOURCE)) {
      const mine: Leaf[] = [];
      const myLists = new Map<string, number>();
      leaves(textsOf(l), '', mine, myLists);
      const theirs = new Map(mine.map((x) => [x.key, x.text]));
      const missing = all.filter((x) => !theirs.has(x.key)).map((x) => x.key);
      expect(missing, `claves sin traducir en «${l}»`).toEqual([]);
      const known = new Set(all.map((x) => x.key));
      const extra = mine.filter((x) => !known.has(x.key)).map((x) => x.key);
      expect(extra, `claves de más en «${l}»`).toEqual([]);
      const holes = all
        .filter((x) => theirs.has(x.key))
        .filter((x) => argsOf(x.text).join() !== argsOf(theirs.get(x.key)!).join())
        .map((x) => x.key);
      expect(holes, `huecos distintos en «${l}»`).toEqual([]);
      const lens = [...lists].filter(([k, n]) => myLists.get(k) !== n).map(([k]) => k);
      expect(lens, `listas de otro largo en «${l}»`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// El código: claves que existen y textos sueltos fuera de los ficheros.

const ROOT = join(__dirname, '..');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx?$/.test(f) && !/\.(test|d)\.ts$/.test(f) ? [p] : [];
  });
}
const FILES = walk(ROOT).filter((f) => !f.includes(`${join('src', 'textos')}`));
const rel = (f: string) => f.slice(ROOT.length + 1).replace(/\\/g, '/');

/**
 * Carpetas y ficheros que aún tienen textos sueltos (se van sacando por bloques; ver
 * docs/textos.md). Cuando una carpeta queda limpia, se quita de aquí y el test la vigila.
 */
const PENDING = ['ui/', 'world/', 'art/', 'platform/', 'audio/', 'main.tsx'];
/** Textos que se quedan en el código a propósito, con el porqué. */
const ALLOWED: Record<string, string> = {
  'data/names.ts': 'nombres propios: no se traducen',
  'data/places.ts': 'los lugares van por su id, que es su nombre en español',
  'core/convert.ts': 'reconoce las frases en español de las partidas viejas',
};

/** Ids del juego que están en español y se usan como tales (se enseñan con su etiqueta). */
const IDS = new Set(['Éxito brillante', 'Éxito', 'Éxito parcial', 'Fracaso', 'Desastre']);

const looksText = (s: string) =>
  !/^[\w.${}/-]*$/.test(s) &&
  (/[áéíóúñ¿¡]/i.test(s) || /[A-Za-zÁÉÍÓÚáéíóúñ]{2,},? [A-Za-zÁÉÍÓÚáéíóúñ]{2,}/.test(s));

const keyFns = new Set(['t', 'tr', 'tl', 'has', 'msg']);

function scan(file: string) {
  const sf = ts.createSourceFile(file, SRC(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const loose: string[] = [];
  const keys: { key: string; prefix: boolean; at: string }[] = [];
  const at = (n: ts.Node) =>
    `${rel(file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    // Los tipos (`'Éxito brillante' | …`) y los errores de programación no se traducen.
    if (ts.isLiteralTypeNode(n)) return;
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Error')
      return;
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      keyFns.has(n.expression.text) &&
      n.arguments[0]
    ) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
        keys.push({ key: a.text, prefix: false, at: at(a) });
      else if (ts.isTemplateExpression(a)) keys.push({ key: a.head.text, prefix: true, at: at(a) });
    }
    // Las claves de un objeto («'Éxito brillante': …») son ids, no textos; y los lugares
    // (`place: 'el molino'`) van por su id, que es su nombre en español.
    const isName =
      n.parent &&
      ts.isPropertyAssignment(n.parent) &&
      (n.parent.name === n || (ts.isIdentifier(n.parent.name) && n.parent.name.text === 'place'));
    let txt: string | null = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
      txt = isName ? null : n.text;
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) txt = n.text;
    if (txt !== null && looksText(txt) && !IDS.has(txt))
      loose.push(`${at(n)}: ${txt.slice(0, 60)}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { loose, keys };
}

describe('los textos en el código', () => {
  const scans = FILES.map((f) => ({ file: rel(f), ...scan(f) }));
  const known = new Set(all.map((x) => x.key));
  for (const k of [...known]) {
    const parts = k.split('.');
    for (let i = 1; i < parts.length; i++) known.add(parts.slice(0, i).join('.'));
  }

  it('las claves que usa el código existen', () => {
    const missing = scans.flatMap((s) =>
      s.keys
        .filter(({ key, prefix }) =>
          prefix ? ![...known].some((k) => k.startsWith(key)) : !known.has(key),
        )
        .map(({ key, at }) => `${at}: ${key}`),
    );
    expect(missing).toEqual([]);
  });

  it('no hay textos sueltos fuera de los ficheros (salvo lo pendiente)', () => {
    const loose = scans
      .filter((s) => !PENDING.some((p) => s.file.startsWith(p)) && !(s.file in ALLOWED))
      .flatMap((s) => s.loose);
    expect(loose).toEqual([]);
  });

  it('las listas de variantes son listas', () => {
    expect(tl('encargos.giros').length).toBeGreaterThan(0);
  });
});
