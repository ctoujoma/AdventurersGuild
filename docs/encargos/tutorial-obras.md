# Encargo (agente del tutorial de obras): fase 2b, el segundo tutorial

Para un agente nuevo que sigue el trabajo del agente del tutorial. Lee antes
[`../../CLAUDE.md`](../../CLAUDE.md), [`../plan.md`](../plan.md) (fase 2b),
[`tutorial.md`](tutorial.md) (forma de trabajar, qué es tuyo y lo hecho en el primer tutorial)
y, de las obras, [`../salas/obras-rework.md`](../salas/obras-rework.md) (cómo funcionan hoy).
No hace falta leer más: lo que necesitas del código está resumido abajo.

## Qué quiere el usuario

Al pagar la deuda (día 28, `s.mode` pasa a `'libre'` y se abren las obras), un tutorial guiado
en el que el jugador **amplía el salón y luego la cámara del tesoro**. No es fácil: hay que
abrir sitio. El camino sale de las acciones de obra: comprar solar o excavar para tener huecos
libres, mover salas, construir lo que haga falta, ampliar y mejorar. Probándolo bien se
encuentra la secuencia. Sustituye a las notas sueltas de obras (`obras`, `plano`, `excavar`,
`servicio` en `ui/tips.ts`; `plano` habla del modo plano, que ya no existe).

## Primera entrega: el camino, en un test

Antes de tocar la interfaz, busca en `core/` (test con `newGame` + `reduce`) una secuencia de
acciones que, desde la taberna del tío al pagar la deuda, deje el salón de 3 de ancho (o de 2
de alto) y la cámara de 2 o 3, con lo que cuesta. Enséñasela al usuario con capturas antes de
seguir. Si el dinero no llega, haz como el primer tutorial: el cuaderno pone lo que falta
(`enter` de un paso).

Punto de partida (`uncleBuilding` en `core/rooms.ts`; ancho `START_COLS` = 4, columnas 0–3):

| Planta | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| 3 | torre | | | |
| 2 | mapas | | | |
| 1 | enfermería | dormitorio | dormitorio | capilla |
| 0 | recibidor | salón | salón | cocina |
| −1 | bodega | armería | forja | tesoro |

- Salón: `maxW` 3, `maxH` 2, único, `keep`, en la planta baja. A su derecha está la cocina y
  encima el dormitorio: para crecer hay que mover una de las dos.
- Tesoro: `maxW` 3, único, `keep`. A su izquierda, forja y armería (rotas, nivel 0).
- La escalera va entre las columnas 0 y 1 (`stairs` con `at: 1`), de la planta −1 a la 1.
  Solares: `PLOT_COST` (150, 250, 400) en `core/balance.ts`, acción `buyPlot`. Excavar: `dig`.
  Cada planta solo sobresale un hueco de la de abajo.
- Acciones (`Action` en `core/game.ts`): `build`, `extend` (dir), `move`, `demolish`, `dig`,
  `buyPlot`, `addStair`, `upgradeRoom`; y `works` (varias juntas). Reglas y precios:
  `plan…` en `core/rooms.ts` (`planBuild`, `planExtend`, `planMove`, `planDig`), validación con
  `problem()`; `tryWorks` en `game.ts`. Sin `worksOpen` (modo libre) devuelven `LOCKED`.

## Cómo engancharlo (lo que hay del primer tutorial)

Todo está en `core/tutorial.ts` y es reutilizable:

- `TutorialStep`: `text`, `focus` (sala a la que va la cámara), `done`, `button`
  (`seguir`/`esperar`/`pago`), `skip`, `enter` (prepara algo al empezar), `pause` (segundos
  de respiro sin nota ni foco), `free` (sin foco; «Entendido» pliega la nota en la esquina con
  `short`), `clock` (el reloj corre en ese paso), `zoom` (la cámara se acerca a la sala).
- `advanceTutorial` pasa de paso cuando `done` se cumple; lo llama `reduce` en `game.ts`
  después de **cada acción** (no hace falta engancharse a cada una). `startStep` acaba el
  respiro (acción `tutorial`/`listo`, que lanza la interfaz tras `pause`).
- `tutorialVeto(s, who, room)`: lo que el tutorial no deja hacer y por qué; lo usa
  `planTask` en `ui/drop.ts`, así se avisa al arrastrar y al soltar y se puede reintentar.
  Para las obras, haz lo mismo en lo que valida el modo obras.
- Estado: `s.tutorial` (`step`, `wait`…). Para el segundo, lo más simple es otra lista de pasos
  y otro estado (`s.tutorialObras`, o un campo `track` en `Tutorial`). Empieza cuando
  `s.mode` pasa a `'libre'` (en `endDay`, donde se pone `s.opening`): pídeselo al agente
  principal o toca solo esa línea y dilo en el PR. Antes sale la carta de la apertura
  (`opening`), y el tutorial va después.
- Interfaz: `ui/tutorialFocus.ts` dice a qué apunta cada paso: lista de sitios por
  preferencia (`[data-tut=…]`, `sala:<id>`, `escena:<selector>`, `cosa:<act>`), `also` para
  resaltar dos cosas a la vez, `scene: true` para dejar libre la escena, `note` si se sigue
  con el botón de la nota. `ui/TutorialFocus.tsx` pinta el velo con agujeros (`clip-path`),
  comprueba que lo señalado se pueda tocar (`onTop`) y, si algo lo tapa, señala su ✕
  (`data-tut="cerrar"`) y la nota pide cerrarlo. `ui/TutorialNote.tsx` es la nota.
- En `App.tsx`: `lesson` (el paso a la vista), el temporizador del respiro, la cámara al
  empezar cada paso (`focus` o `closeUp`), `ticking` con `tutorialFrozen`.

**Ojo, lo primero que vas a encontrar:** en `App.tsx`, `calm` es falso con el modo obras
abierto (`works.pick`, `works.planning`), y sin `calm` no hay lección. Para este tutorial la
nota y el foco tienen que verse dentro del modo obras.

Del modo obras (no es tuyo: es del principal y de interfaz; añade `data-tut` y lo justo):
`ui/works.ts` (el hook del modo, con deshacer), `ui/WorksBar.tsx` (la cinta con pestañas),
`ui/RoomMenu.tsx` (botones junto a la sala: mejorar, mover, tirar), mover arrastrando la sala
(`onRoomDrag` → `works.startPick`), y en la escena los sitios válidos (`world/rooms/works.ts`,
`RoomScene.setTargets`). Para señalar una casilla de la escena hará falta un método como
`RoomScene.actOnScreen` (dónde cae en pantalla) para esos sitios.

## Probar en el navegador (lo que se aprende a golpes)

- `npm run build` y `npx vite preview --port 4173` en segundo plano. Chromium está en
  `/opt/pw-browsers/chromium` (no en `chromium-1194` como dice `agente-principal.md`).
  Playwright: `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`,
  args `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist`, `headless: false`, ventana 420×860 (y `hasTouch, isMobile` para
  probar toques).
- `http://localhost:4173/#debug`: `window.__game.get() / set(s) / dispatch(a)` y
  `window.__scene`. Para saltar al principio de las obras, monta el estado con `__game.set`
  (`mode: 'libre'`, `paid`, `opening`…) en lugar de jugar 28 días.
- No uses `pkill -f "vite preview"` en el mismo comando que lo vuelve a lanzar: mata tu propio
  shell.
- `__scene.heroPosition(id)` y similares dan coordenadas del mundo: a pantalla, con
  `__scene.screenOf(x, y)` más el `getBoundingClientRect()` del `canvas`. Arrastrar es pulsar
  unos 700 ms y mover a pasos; al soltar donde no vale, la escena llama a `onDrop(id, null)`.
- Los respiros alargan las pruebas: para saltarlos, `dispatch({ type: 'tutorial', op: 'listo' })`.
- Scripts y capturas en `node_modules/.cache/jarro-shots/` (no se suben). Lo que tarda más de
  2 minutos, en segundo plano.

## Lo que ya sabemos que le gusta al usuario

- Con calma: respiros largos entre pasos para mirar y trastear; no bloquear donde no hace falta.
- Marcar la cosa de la sala además del botón (las dos se pueden tocar).
- Si hace algo que no toca, avisar por qué y dejar reintentar (no prohibirlo sin más).
- Acercar la cámara a la sala de la que se habla.
- Notas largas plegables en los pasos libres; botones secundarios normales (`btn btn-wood`).
- Todo se juzga jugándolo en el móvil (420×860), con capturas en el PR.
