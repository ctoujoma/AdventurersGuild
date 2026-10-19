# Capturas de la escena

Sirven para revisar a ojo los cambios de la escena de salas (no son tests).

1. Instala Playwright sin guardarlo en `package.json` (el contenedor ya trae Chromium en
   `/opt/pw-browsers`; si está en otro sitio, pásalo en la variable `CHROME`):
   `npm i --no-save playwright@1.47.2`
2. `npm run build && npx vite preview --port 4173` (en otra terminal o en segundo plano).
3. `node tools/shots/scene.mjs shots 1280 760` (o `420 860` para móvil).
4. Para el arte de una sala: `node tools/shots/sala.mjs shots <tipo> [anchos]` (por ejemplo
   `recibidor` o `cocina 1,3`) la saca a nivel 0, 1, 2 y 3, de día y de noche, y en obras.
5. Galería de todas las salas (antes y después): con dos `vite preview` (uno con el build de
   `main` en otro puerto, por ejemplo desde un `git worktree`), `node tools/shots/galeria.mjs
<carpeta> <puerto> [tipos]` para cada uno y luego `python3 tools/shots/galeria.py <antes>
<después> <salida>`, que deja una lámina por sala y `salas.json` para el visor. La cámara del
   tesoro sale tres veces (`tesoro_o10`, `_o50`, `_o100`: al 10 %, a la mitad y llena), porque su
   oro crece con lo que guarda; sin «antes» propio, usan el de `tesoro`.

El juego deja a mano `window.__game` (`get()`/`set(estado)`) y `window.__scene` (la escena)
para preparar cualquier situación antes de la captura: subir salas de nivel, provocar un asalto
(`s.raid = {…}` y terminar el día), abrir el modo obras, etc.
