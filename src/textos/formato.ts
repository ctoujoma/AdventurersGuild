/**
 * Intérprete de los mensajes de `src/textos/<idioma>/*.yaml` (un subconjunto de ICU, la
 * sintaxis que conocen los traductores). Ver `docs/textos.md`.
 *
 * - `{nombre}`: hueco. Un número sale tal cual; una lista, con «, » y « y » (según el idioma);
 *   un mensaje anidado (`Msg`), escrito en el idioma de ahora.
 * - `{n, plural, one {# jarra} other {# jarras}}`: plural según el idioma; `=0 {…}` para un
 *   número exacto; `#` es el número.
 * - `{sexo, select, f {pálida} other {pálido}}`: elige por el valor (`si`/`no` para sí y no).
 * - `{nombre, mayus}`: el hueco con la primera letra en mayúscula.
 */

export type Param = string | number | boolean | Msg | readonly Param[] | null | undefined;
export type Params = Readonly<Record<string, Param>>;

/** Un texto por escribir: la clave y sus huecos. Es lo que se guarda en las partidas. */
export interface Msg {
  k: string;
  p?: Params;
}

type Part =
  | string
  | { arg: string; kind?: undefined }
  | { arg: string; kind: 'mayus' }
  | { arg: string; kind: 'plural' | 'select'; cases: Record<string, Part[]> }
  | { hash: true };

/** Contexto del idioma: plurales, listas y cómo escribir un mensaje anidado. */
export interface Lang {
  code: string;
  plural: (n: number) => string;
  list: (items: readonly string[]) => string;
  render: (m: Msg) => string;
}

const cache = new Map<string, Part[]>();

/** Trocea un mensaje (con caché: cada texto se interpreta una vez). */
export function parse(src: string): Part[] {
  let parts = cache.get(src);
  if (!parts) {
    const r = { s: src, i: 0 };
    parts = parseParts(r, false);
    if (r.i < src.length) throw new Error(`Texto mal cerrado: «${src}»`);
    cache.set(src, parts);
  }
  return parts;
}

function parseParts(r: { s: string; i: number }, inPlural: boolean): Part[] {
  const out: Part[] = [];
  let buf = '';
  while (r.i < r.s.length) {
    const c = r.s[r.i]!;
    if (c === '}') break;
    if (c === '{') {
      if (buf) out.push(buf);
      buf = '';
      out.push(parseArg(r));
    } else if (c === '#' && inPlural) {
      if (buf) out.push(buf);
      buf = '';
      out.push({ hash: true });
      r.i++;
    } else {
      buf += c;
      r.i++;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function parseArg(r: { s: string; i: number }): Part {
  const s = r.s;
  const end = (re: RegExp) => {
    const m = re.exec(s.slice(r.i));
    if (!m) throw new Error(`Hueco mal escrito en «${s}»`);
    r.i += m[0].length;
    return m;
  };
  end(/^\{\s*/);
  const arg = end(/^([\p{L}\p{N}_]+)\s*/u)[1]!;
  if (s[r.i] === '}') {
    r.i++;
    return { arg };
  }
  end(/^,\s*/);
  const kind = end(/^(plural|select|mayus)\s*/)[1] as 'plural' | 'select' | 'mayus';
  if (kind === 'mayus') {
    end(/^\}/);
    return { arg, kind };
  }
  end(/^,\s*/);
  const cases: Record<string, Part[]> = {};
  while (s[r.i] !== '}') {
    if (r.i >= s.length) throw new Error(`Hueco sin cerrar en «${s}»`);
    const key = end(/^(=?[\p{L}\p{N}_-]+)\s*/u)[1]!;
    end(/^\{/);
    cases[key] = parseParts(r, kind === 'plural');
    end(/^\}\s*/);
  }
  r.i++;
  if (!cases.other) throw new Error(`Falta «other» en «${s}»`);
  return { arg, kind, cases };
}

/** El valor de un hueco como texto. */
function show(v: Param, lang: Lang): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'si' : 'no';
  if (Array.isArray(v)) return lang.list(v.map((x) => show(x, lang)));
  return lang.render(v as Msg);
}

/** Escribe un mensaje con sus huecos. */
export function format(src: string, p: Params | undefined, lang: Lang): string {
  return run(parse(src), p ?? {}, lang, 0);
}

function run(parts: Part[], p: Params, lang: Lang, n: number): string {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'string') out += part;
    else if ('hash' in part) out += String(n);
    else if (!part.kind) out += show(p[part.arg], lang);
    else if (part.kind === 'mayus') {
      const v = show(p[part.arg], lang);
      out += v.charAt(0).toUpperCase() + v.slice(1);
    } else if (part.kind === 'plural') {
      const num = Number(p[part.arg] ?? 0);
      const c = part.cases[`=${num}`] ?? part.cases[lang.plural(num)] ?? part.cases.other!;
      out += run(c, p, lang, num);
    } else {
      const v = show(p[part.arg], lang);
      out += run(part.cases[v] ?? part.cases.other!, p, lang, n);
    }
  }
  return out;
}

/** Los huecos que usa un mensaje (para comprobar que casan entre idiomas). */
export function argsOf(src: string): string[] {
  const set = new Set<string>();
  const walk = (parts: Part[]) => {
    for (const part of parts) {
      if (typeof part === 'string' || 'hash' in part) continue;
      set.add(part.arg);
      if (part.kind === 'plural' || part.kind === 'select') Object.values(part.cases).forEach(walk);
    }
  };
  walk(parse(src));
  return [...set].sort();
}
