# Encargo (agente del tutorial): el tutorial guiado, con el usuario

Para un agente propio del tutorial. El usuario le irá pasando feedback en paralelo mientras el
agente principal sigue con el resto del plan. Antes de nada, lee
[`../../CLAUDE.md`](../../CLAUDE.md), [`../plan.md`](../plan.md) (fase 2) y
[`../agente-principal.md`](../agente-principal.md) (forma de trabajar y cómo probar en el
navegador).

## Forma de trabajar

- En español y breve; un PR por entrega contra `main`. El usuario fusiona y avisa.
- Rama propia (`claude/…`). Tras cada fusión: `git fetch origin && git checkout -B <rama>
origin/main`.
- Antes de subir: `npm run lint && npm run format:check && npm run typecheck && npm test &&
npm run build`. Y pruébalo **en el navegador** (Playwright y el modo `#debug`, en
  `agente-principal.md`): el tutorial se juzga jugándolo, con capturas a 420 × 860 (móvil).
- Al final de cada entrega, un punto de situación corto.

## Qué es tuyo

- `core/tutorial.ts`: los pasos (`STEPS`), sus textos, cuándo se cumplen, lo que preparan al
  entrar, el reloj parado y los saltos de tiempo (`skipTime`). Test: `core/tutorial.test.ts`.
- `ui/tutorialFocus.ts` (a qué apunta cada paso), `ui/TutorialFocus.tsx` (oscurecido, bloqueo y
  marco), `ui/TutorialNote.tsx` (la página del cuaderno), `ui/IntroLetter.tsx` (la carta del
  tío), y sus estilos (`.tut-*`, `.notebook*`, `.intro-letter*` en `styles.css`).
- Los `data-tut="…"` de los componentes: añade los que hagan falta, sin cambiar nada más.
- La fase 2b del plan (el segundo tutorial, el de las obras), cuando el usuario diga.

## Límites (lo de los demás)

- `App.tsx` es compartido: toca lo justo (cuándo sale la lección, la entrada) y dilo en el PR.
- El núcleo del juego (`game.ts`, encargos, viaje, jefes) es del agente principal; si el
  tutorial necesita algo de ahí, pídelo en el PR o en `docs/encargos/`.
- Arte (sprites, escena) es del agente de arte; interfaz general, del de interfaz.

## Dónde está (1 de noviembre)

Hecho y fusionado: pasos del día 1 al pago del día 7 (`casa`, `dinero`, `tablon`, `barra`,
`nombre`, `enfermeria`, `mover`, `esperar`, `informe`, `equipo`, `herido`, `ratas`, `rumor`,
`mandar`, `objetivos`, `pago`, `fin`), foco que bloquea y no deja seguir sin hacer el paso,
notas en el cuaderno de Fausto con «Ya sé jugar», carta del tío al empezar.

Último feedback del usuario, ya atendido por el agente principal (revísalo jugándolo):

- Unos segundos para ver la taberna antes del cuaderno: la cámara entra desde fuera, a la
  izquierda, hasta el salón (`RoomScene.travelIn`), y la primera nota sale a los 3,5 s.
  **Se puede mejorar:** que se note más el travelling (empezar más lejos, en la calle, de día).
- Contexto antes del primer encargo: pasos `casa` (las salas) y `dinero` (la caja del salón y
  los encargos).
- El oscurecido y el marco entran a los 2 s del cambio de paso (`DIM_DELAY`), con fundido.
- Letra del cuaderno más grande y, arriba en móvil, más abajo (no pegada al borde).
- Cambiar el nombre: el foco abarca el campo y su botón (`data-tut="nombre-form"`).
- El primer encargo y el del rumor casi siempre salen (≈ 86 %): un solo desafío en lo que mejor
  se les da a los de casa (`sureChallenge` en `core/tutorial.ts`).

Hecho por el agente del tutorial (PR del respiro y el pago):

- **Respiro** antes de algunos pasos (`pause` en `STEPS`, `tutorialWait`, acción `tutorial`
  `listo`): unos segundos sin nota ni foco para mirar y trastear; las ratas y el rumor llegan
  después. Ahora en `barra` (ver salir al grupo), `mover`, `ratas`, `rumor` y `objetivos`.
- **Pago:** «Saltar al día 7» solo con la caja lista (deuda y sueldos, `payReady`); si falta,
  la nota dice cuánto y el botón es «Pasar la noche». En ese paso no hay foco: se juega libre
  (tablón, casa…). La noche del pago, si no llega, el tío sigue poniendo lo que falte.

Segunda ronda (feedback del usuario):

- Respiros más largos (6–15 s) y también antes de `enfermeria`, `esperar` y `pago`; el
  oscurecido entra a los 2,5 s.
- `mover` pide un **héroe** (echan una mano en sus ratos libres, sin ser cocineros). Soltar en la
  cocina a uno del pueblo no vale: `tutorialVeto` lo explica al arrastrar y al soltar.
- `tablon`/`mandar` y `barra` resaltan también la cosa tocable de la sala (`Focus.also`,
  `cosa:<act>` con `RoomScene.actOnScreen`). El foco es un velo con agujeros (`clip-path`).
- Pasos libres (`free`: `esperar` y `pago`): sin foco; «Entendido» pliega la nota arriba a la
  derecha con su resumen (`short`) y el botón; al pasar el ratón o al tocarla se lee entera.
  En `esperar` el reloj corre (`clock`, `tutorialFrozen`): el grupo puede volver solo.
- Ratas: la cámara se acerca a la cocina (`zoom`, `RoomScene.closeUp`).

Pendiente que ya estaba apuntado:

- Candados en el mapa y en los adornos durante el tutorial (que no se pueda ir a otra cosa).
- Que la barra del día diga que el reloj está parado mientras dura el tutorial.
- El salto de días cuando no queda nada que hacer (ya hay «Saltar hasta que vuelvan» y «Saltar
  al día 7»: revisar con el usuario si basta).
- Fase 2b: el tutorial de las obras (crear, mover y mejorar salas).
