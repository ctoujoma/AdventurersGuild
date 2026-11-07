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
