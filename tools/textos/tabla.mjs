// Los textos del juego en una tabla (CSV) para revisarlos o traducirlos, y de vuelta.
//
//   npm run textos:sacar [textos.csv]   → una fila por texto: clave, nota, es, en…
//   npm run textos:meter textos.csv     → mete los cambios en src/textos/<idioma>/*.yaml
//
// La tabla se abre con cualquier hoja de cálculo (Google Sheets, LibreOffice, Excel). Para un
// idioma nuevo, se añade una columna con su código (`en`, `fr`…). Ver docs/textos.md.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { DIR, textFiles } from './cargar.mjs';

const SOURCE = 'es';
const YAML_OUT = { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' };

// --- CSV --------------------------------------------------------------------

function toCsv(rows) {
  const cell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '\uFEFF' + rows.map((r) => r.map((v) => cell(v ?? '')).join(',')).join('\r\n') + '\r\n';
}

function fromCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.slice(0, text.search(/\r?\n/));
  const sep =
    (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((v) => v !== ''));
}

// --- Recorrer los YAML ------------------------------------------------------

/** Cada texto de un documento: clave, valor y nota (el comentario de encima). */
function entries(doc, zone) {
  const out = [];
  const walk = (node, path, note) => {
    if (isScalar(node))
      out.push({ key: [zone, ...path].join('.'), path, text: String(node.value), note });
    else if (isMap(node))
      for (const pair of node.items) {
        const k = String(pair.key.value ?? pair.key);
        const n = [pair.key.commentBefore, pair.value?.commentBefore].filter(Boolean).join(' / ');
        walk(pair.value, [...path, k], n.trim());
      }
    else if (isSeq(node))
      node.items.forEach((item, i) => walk(item, [...path, i], i === 0 ? note : ''));
  };
  walk(doc.contents, [], (doc.commentBefore ?? '').trim());
  return out;
}

function loadDocs() {
  const docs = {}; // lang → zone → doc
  for (const f of textFiles())
    (docs[f.lang] ??= {})[f.zone] = parseDocument(readFileSync(f.path, 'utf8'));
  return docs;
}

// --- sacar ------------------------------------------------------------------

function sacar(out = 'textos.csv') {
  const docs = loadDocs();
  const langs = [
    SOURCE,
    ...Object.keys(docs)
      .filter((l) => l !== SOURCE)
      .sort(),
  ];
  const values = {}; // lang → key → text
  for (const l of langs)
    for (const [zone, doc] of Object.entries(docs[l] ?? {}))
      for (const e of entries(doc, zone)) (values[l] ??= {})[e.key] = e.text;
  const rows = [['clave', 'nota', ...langs]];
  for (const [zone, doc] of Object.entries(docs[SOURCE]))
    for (const e of entries(doc, zone))
      rows.push([e.key, e.note, ...langs.map((l) => values[l]?.[e.key] ?? '')]);
  writeFileSync(out, toCsv(rows));
  console.log(`${rows.length - 1} textos en ${out} (${langs.join(', ')})`);
}

// --- meter ------------------------------------------------------------------

function meter(file) {
  if (!file || !existsSync(file)) throw new Error('Uso: npm run textos:meter <tabla.csv>');
  const [head, ...rows] = fromCsv(readFileSync(file, 'utf8'));
  const ki = head.indexOf('clave');
  const ni = head.indexOf('nota');
  const langs = head.filter((h, i) => i !== ki && i !== ni && /^[a-z]{2}(-[A-Z]{2})?$/.test(h));
  if (ki < 0 || !langs.includes(SOURCE))
    throw new Error('La tabla necesita las columnas «clave» y «es».');
  const docs = loadDocs();
  const srcByKey = {};
  for (const [zone, doc] of Object.entries(docs[SOURCE]))
    for (const e of entries(doc, zone)) srcByKey[e.key] = e;
  const table = {}; // lang → key → text
  const notes = {};
  for (const r of rows) {
    const key = r[ki];
    if (!srcByKey[key]) {
      console.warn(`Clave que no existe en ${SOURCE} (se ignora): ${key}`);
      continue;
    }
    if (ni >= 0) notes[key] = r[ni] ?? '';
    for (const l of langs) {
      const v = r[head.indexOf(l)] ?? '';
      if (v !== '') (table[l] ??= {})[key] = v;
    }
  }
  const touched = [];
  let changed = 0;

  // El idioma de origen: se cambia en su sitio (se conservan las notas y el orden).
  for (const [zone, doc] of Object.entries(docs[SOURCE])) {
    let dirty = false;
    for (const e of entries(doc, zone)) {
      const v = table[SOURCE]?.[e.key];
      if (v !== undefined && v !== e.text) {
        doc.setIn(e.path, v);
        dirty = true;
        changed++;
      }
      const n = notes[e.key];
      if (n !== undefined && n !== e.note && typeof e.path.at(-1) === 'string') {
        const parent = e.path.length > 1 ? doc.getIn(e.path.slice(0, -1), true) : doc.contents;
        const pair = parent?.items?.find((p) => String(p.key.value ?? p.key) === e.path.at(-1));
        if (pair) {
          pair.key.commentBefore = n ? ' ' + n : undefined;
          dirty = true;
        }
      }
    }
    if (dirty) touched.push(save(SOURCE, zone, doc));
  }

  // Los demás: se rehacen con la forma del origen y solo lo traducido. Una lista a medias se
  // deja fuera entera (sale en el idioma de origen) para no descolocar las variantes.
  for (const l of langs.filter((x) => x !== SOURCE)) {
    const old = {};
    for (const [zone, doc] of Object.entries(docs[l] ?? {}))
      for (const e of entries(doc, zone)) old[e.key] = e.text;
    const val = (key) => table[l]?.[key] ?? old[key];
    for (const [zone, src] of Object.entries(docs[SOURCE])) {
      const doc = src.clone();
      let any = false;
      let half = [];
      const fill = (node, key) => {
        if (isScalar(node)) {
          const v = val(key);
          if (v === undefined) return false;
          if (v !== old[key]) changed++;
          node.value = v;
          return true;
        }
        if (isSeq(node)) {
          const ok = node.items.map((it, i) => fill(it, `${key}.${i}`));
          if (ok.every(Boolean)) return true;
          if (ok.some(Boolean)) half.push(key);
          return false;
        }
        if (isMap(node)) {
          node.items = node.items.filter((p) => fill(p.value, `${key}.${p.key.value ?? p.key}`));
          return node.items.length > 0;
        }
        return false;
      };
      any = fill(doc.contents, zone);
      for (const h of half) console.warn(`[${l}] lista a medias, se queda sin traducir: ${h}`);
      if (any) touched.push(save(l, zone, doc));
    }
  }
  if (touched.length)
    execFileSync('npx', ['prettier', '--write', '--log-level=warn', ...touched], {
      stdio: 'inherit',
    });
  console.log(`${changed} textos cambiados en ${touched.length} ficheros.`);
}

function save(lang, zone, doc) {
  const dir = join(DIR, lang);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${zone}.yaml`);
  writeFileSync(p, doc.toString(YAML_OUT));
  return p;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'sacar') sacar(arg);
else if (cmd === 'meter') meter(arg);
else console.log('Uso: node tools/textos/tabla.mjs sacar [salida.csv] | meter <tabla.csv>');
