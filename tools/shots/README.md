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
   oro crece con lo que guarda; sin «antes» propio, usan el de `tesoro`. Las salas con nivel 4
   pintado (solo vista) salen también a nivel 4; `NIVELES=4` saca solo ese nivel y `SIN_N4=1` se
   queda en el 3 (para la versión de antes).

6. Colores por sala: `node tools/shots/tintes.mjs <carpeta> <tipos> [temas] [zoom]` saca cada
   sala (al nivel más alto y ancha) con los temas que se le digan (`casa` = sin tema), de día y
   de noche; con `ESPERA=<ms>`, espera más de noche.

7. Gente y escaleras: `node tools/shots/gente.mjs <carpeta> [puerto]` saca el tramo de la planta
   baja de cerca, a un héroe subiéndolo (un fotograma cada 120 ms) y a todos celebrando en la
   barra.

7b. Animales: `node tools/shots/animales.mjs <carpeta> [puerto]` saca la chimenea del salón de
cerca con el gato y el perro dormidos, el gato de paseo y los dos tocados.

7c. Salas rotas: `node tools/shots/rotas.mjs <carpeta> [puerto]` saca cada sala rota de la
partida del tío de cerca (con su rata a la vista), sus bichos tocados y la taberna entera.

7d. Jefes: `node tools/shots/jefes.mjs <carpeta> [jefes] [puerto]` lanza desde el modo prueba la
pelea de cada jefe (por defecto, los tres nuevos) y la saca a media pelea.

8. Fachada: `node tools/shots/fachada.mjs <carpeta> [tejado/paredes/rótulo,…]` saca la taberna
   entera con cada combinación, de día y de noche, baja y con una planta de más (`ANCHO` y
   `ALTO` para móvil).

9. Interfaz (paneles, fichas y barras): `node tools/shots/ui.mjs <carpeta> [ancho] [alto] [puerto]`
   recorre todas las pantallas (por ejemplo a `420 860` y `1280 760`) y deja un PNG de cada una
   y `medidas.json` (cuánto tapa la taberna, letras, tamaños de letra, scroll, tarjetas).

El juego deja a mano `window.__game` (`get()`/`set(estado)`) y `window.__scene` (la escena)
para preparar cualquier situación antes de la captura: subir salas de nivel, provocar un asalto
(`s.raid = {…}` y terminar el día), abrir el modo obras, etc.
