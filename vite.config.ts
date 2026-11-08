import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { parseNews } from './src/platform/news';

/** Todos los ficheros de una carpeta, con su ruta relativa a ella. */
function walk(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p).replace(/\\/g, '/')];
  });
}

/**
 * Al acabar el build, el service worker (public/sw.js) apunta todos los ficheros del juego para
 * guardarlos de una vez al instalarse, y una huella de su contenido como nombre de la caché: así
 * basta con abrir el juego una vez con conexión para poder jugar sin ella.
 */
function precache(): Plugin {
  let out = 'dist';
  return {
    name: 'jarro-precache',
    apply: 'build',
    configResolved(c) {
      out = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const sw = join(out, 'sw.js');
      if (!existsSync(sw)) return;
      const files = walk(out)
        .filter((f) => f !== 'sw.js')
        .sort();
      const hash = createHash('sha1');
      for (const f of files) hash.update(f).update(readFileSync(join(out, f)));
      const src = readFileSync(sw, 'utf8')
        .replace(
          "const CACHE = 'jarro-v1';",
          `const CACHE = 'jarro-${hash.digest('hex').slice(0, 10)}';`,
        )
        .replace(
          'const FILES = [];',
          `const FILES = ${JSON.stringify(files.map((f) => `./${f}`))};`,
        );
      writeFileSync(sw, src);
    },
  };
}

/** Versión que se enseña en el juego: fecha y commit del build (o «dev» sin git). */
function version(): string {
  try {
    const [date, hash] = execSync('git log -1 --format=%cs/%h', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('/');
    return `${date} · ${hash}`;
  } catch {
    return 'dev';
  }
}

/** Novedades para el aviso del juego: los últimos PR fusionados (vacío sin git). */
function news() {
  try {
    const log = execSync('git log --merges --first-parent -n 40 --format=%cs%x1f%s%x1f%b%x1e', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return parseNews(log);
  } catch {
    return [];
  }
}

export default defineConfig({
  // Rutas relativas: el mismo build sirve en GitHub Pages, en local y dentro de Capacitor.
  base: './',
  plugins: [preact(), precache()],
  define: { __VERSION__: JSON.stringify(version()), __NEWS__: JSON.stringify(news()) },
  // three.js va dentro del mismo fichero (el juego se empaqueta en un solo HTML).
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
