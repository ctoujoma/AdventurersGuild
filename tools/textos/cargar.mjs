// Lee los textos del juego (src/textos/<idioma>/*.yaml) y los da como un módulo con todos los
// idiomas: `{ es: { encargos: {...}, ... }, en: {...} }`. Lo usan el plugin de Vite (juego y
// tests) y el de esbuild (npm run sim y compañía). Ver docs/textos.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const ID = 'virtual:textos';
const RESOLVED = '\0' + ID;
export const DIR = fileURLToPath(new URL('../../src/textos', import.meta.url));

/** Los ficheros de textos, por idioma. */
export function textFiles(dir = DIR) {
  const out = [];
  for (const lang of readdirSync(dir)) {
    const ld = join(dir, lang);
    if (!statSync(ld).isDirectory()) continue;
    for (const f of readdirSync(ld).sort())
      if (f.endsWith('.yaml')) out.push({ lang, zone: f.slice(0, -5), path: join(ld, f) });
  }
  return out;
}

/** Todos los textos: idioma › zona › lo que haya en el fichero. */
export function loadTexts(dir = DIR) {
  const all = {};
  for (const { lang, zone, path } of textFiles(dir)) {
    let data;
    try {
      data = parse(readFileSync(path, 'utf8'));
    } catch (e) {
      throw new Error(`Textos: no se puede leer ${lang}/${zone}.yaml: ${e.message}`);
    }
    (all[lang] ??= {})[zone] = data ?? {};
  }
  return all;
}

/** Plugin de Vite: `import TEXTOS from 'virtual:textos'`. */
export function textosVite() {
  return {
    name: 'jarro-textos',
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      for (const f of textFiles()) this.addWatchFile(f.path);
      return `export default ${JSON.stringify(loadTexts())};`;
    },
  };
}

/** Plugin de esbuild, lo mismo. */
export const textosEsbuild = {
  name: 'jarro-textos',
  setup(build) {
    build.onResolve({ filter: /^virtual:textos$/ }, () => ({ path: ID, namespace: 'textos' }));
    build.onLoad({ filter: /.*/, namespace: 'textos' }, () => ({
      contents: `export default ${JSON.stringify(loadTexts())};`,
      loader: 'js',
      watchFiles: textFiles().map((f) => f.path),
    }));
  },
};
