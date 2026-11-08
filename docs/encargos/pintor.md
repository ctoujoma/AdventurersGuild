# Encargo: el taller del pintor (sala y oficio nuevos)

Del usuario (7 de noviembre). Dos partes: núcleo e interfaz por un agente y la escena por arte.
Cada una con su rama y su PR contra `main`; arte empieza cuando esté el núcleo (o a la vez,
contra los nombres de aquí).

## Lo que pasa ahora

En la ficha de cada sala se elige el tema de color de sus telas (`RoomPanel.tsx`, `onTint`,
acción `tint` en `core/game.ts`) y cambia al momento. Los temas que faltan ya salen con candado
(`has('tint:…')`, `unlockSource`).

## Lo que se pide

- **Sala nueva, el taller del pintor**, con **un oficio nuevo, el pintor** (como los demás
  trabajadores: `core/workers.ts`, catálogo de salas, rango que la abre). Sin taller y sin
  pintor, los colores de las salas salen bloqueados y se dice por qué.
- **Pintar es un trabajo**: se elige el color, se paga, y el pintor **va andando a la sala**; el
  trabajo **no empieza hasta que llega** (igual que vestir en la sastrería: `Craft.wait`,
  acción `arrived`) y dura unas horas de juego. Al acabar, la sala cambia de color. Uno a la vez;
  si está ocupado, decirlo.
- **Los colores se desbloquean** con misiones y sucesos (lo que ya da `tint:…`) y, más adelante,
  pagando. Dejar el sitio preparado, sin tienda aún.
- Tests en el núcleo; `npm run sim` sin cambios de balance a la vista.

## Arte

- El taller (muebles: caballete, botes, rollos de tela, manchas) y el pintor (bata, gorro, brocha).
- **El trabajo se ve**: el pintor con escalera y brocha en la sala, la sala cambiando de color
  poco a poco (por franjas, de un lado al otro) hasta acabar, y unas gotas o un destello al
  terminar. Mientras va de camino, nada cambia.
- Poner al día `docs/plan-arte.md`.

## Hecho en el núcleo (agente principal, 7 de noviembre)

Lo que queda es la interfaz y la escena:

- **Sala `pintor`** («Taller del pintor», única, hasta 2 huecos, en la pestaña Talleres; se abre con
  hierro, `ROOM_COST.pintor`) y **oficio `pintor`** (Pintor/Pintora; al construir el taller viene
  uno a pedir trabajo, como con las demás salas).
- **Pintar** (`core/paint.ts`): acción `paint` `{ room, tint }` (null: los colores de la casa) y
  `cancelPaint` `{ id }`. Cuesta `PAINT_GOLD` por hueco de la sala y tarda `PAINT_HOURS` de jornada
  por hueco con un pintor de Maña 4. Un trabajo por pintor (hasta `PAINT_SLOTS` por nivel del
  taller). Al acabar, la sala cambia de color y la carta lo dice.
- **Para la ficha de la sala:** `paintStatus(s, roomId, tint)` da el estado de cada color: `ok`,
  `same`, `lock` (con de dónde sale), `none` (no hay taller), `nobody` (no hay pintor),
  `painting` (ya la están pintando), `busy` (pintores ocupados) o `gold`. La acción `tint` (gratis,
  al momento) se queda solo para el modo prueba.
- **Para la escena:** `painterAt(s, workerId)` dice a qué sala ha ido un pintor (llevarle allí en
  lugar de a su taller); al llegar, despachar `arrived` con su id (`heroId: workerId`) y la sala, y
  empieza. Si nadie avisa, empieza a las `PAINT_WALK` horas. `paintingOf(s, roomId)` y
  `paintState(s, p)` dan el trabajo de una sala y cómo va (`frac` 0–1 para pintar por franjas,
  `walking`, `hoursLeft`). Si se despide al pintor, se le cambia de sala o se derriba algo, el
  trabajo se cancela y se devuelve lo pagado.
- Falta también el icono de la cinta de obras (ahora `pintado`) y el banderín (`brocha`, en
  `goalMark.ts`), por si arte los quiere cambiar.

## Hecho en arte (agente de arte, 8 de noviembre)

El taller, el pintor y el trabajo que se ve: detalle en [`../plan-arte.md`](../plan-arte.md)
(«El taller del pintor»); capturas en `capturas/pintor/`. La escena lleva al pintor a la sala que
pinta, despacha `arrived` al llegar y pinta la pared por franjas con `paintState(s, p).frac`.
Las telas (mantas, alfombras, cortinas) cambian al acabar, no por franjas. Icono nuevo `brocha`
en Obras (el de antes, `pintado`, es el del rótulo de la fachada).
