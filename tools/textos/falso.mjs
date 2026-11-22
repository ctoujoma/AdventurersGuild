// El idioma falso «xx»: cada texto de `es` entre ‹ ›, para ver en el juego lo que no sale de los
// ficheros (todo lo que se lea sin ‹ › está escrito en el código). Uso:
//   npm run textos:falso          crea src/textos/xx/ (no se sube: está en .gitignore)
//   npm run textos:falso -- --quitar   lo borra
// Luego `npm run build`, `npx vite preview` y el volcado con XLANG=xx (tools/shots/textos.mjs),
// o a mano: en la consola, localStorage['jarro:ajustes'] con "lang": "xx", y recargar.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { DIR } from './cargar.mjs';

const out = join(DIR, 'xx');
rmSync(out, { recursive: true, force: true });
if (!process.argv.includes('--quitar')) {
  mkdirSync(out);
  const wrap = (n) =>
    typeof n === 'string'
      ? `‹${n}›`
      : Array.isArray(n)
        ? n.map(wrap)
        : n && typeof n === 'object'
          ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, wrap(v)]))
          : n;
  for (const f of readdirSync(join(DIR, 'es')).filter((x) => x.endsWith('.yaml')))
    writeFileSync(
      join(out, f),
      stringify(wrap(parse(readFileSync(join(DIR, 'es', f), 'utf8'))), { lineWidth: 0 }),
    );
  console.log(`Idioma falso en ${out}`);
}
