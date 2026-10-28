import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

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

export default defineConfig({
  // Rutas relativas: el mismo build sirve en GitHub Pages, en local y dentro de Capacitor.
  base: './',
  plugins: [preact(), precache()],
  // three.js va dentro del mismo fichero (el juego se empaqueta en un solo HTML).
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
