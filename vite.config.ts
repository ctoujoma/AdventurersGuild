import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Rutas relativas: el mismo build sirve en GitHub Pages, en local y dentro de Capacitor.
  base: './',
  plugins: [preact()],
  // three.js va dentro del mismo fichero (el juego se empaqueta en un solo HTML).
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
