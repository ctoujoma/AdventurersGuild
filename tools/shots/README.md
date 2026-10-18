# Capturas de la escena

Sirven para revisar a ojo los cambios de la escena de salas (no son tests).

1. Instala Playwright sin guardarlo en `package.json` (el contenedor ya trae Chromium en
   `/opt/pw-browsers`; si está en otro sitio, pásalo en la variable `CHROME`):
   `npm i --no-save playwright@1.47.2`
2. `npm run build && npx vite preview --port 4173` (en otra terminal o en segundo plano).
3. `node tools/shots/scene.mjs shots 1280 760` (o `420 860` para móvil).

El juego deja a mano `window.__game` (`get()`/`set(estado)`) y `window.__scene` (la escena)
para preparar cualquier situación antes de la captura: subir salas de nivel, provocar un asalto
(`s.raid = {…}` y terminar el día), abrir el modo obras, etc.
