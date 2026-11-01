# Notas: menos toques (agente de interfaz)

Estado del encargo [`interfaz-menos-toques.md`](interfaz-menos-toques.md), para retomarlo sin el
historial.

## Hecho (en `main`)

- **Punto 1, grupo sugerido:** `suggestParty` en `src/core/suggest.ts` (con tests) y el botón
  «Sugerir» de `QuestSheet.tsx`.
- **Punto 2, repetir el grupo:** `repeatParty` en `suggest.ts`. Al enviar se apuntan
  `lastParty` (partida) y `party` (en la historia, `ChainState`), los dos opcionales. En la hoja:
  «Como en el paso anterior» en una historia y «Como la última vez» en los demás; dice a quién se
  salta.
- **Retoques pedidos por el usuario:**
  - el selector de tarea dice el estado («Trabaja en Salón») o la orden («Poner a trabajar
    en…»);
  - la pestaña de abajo se llama «Héroes y personal»;
  - grupos fuera listados bajo el mapa;
  - el panel del mapa es más ancho (`Panel wide`);
  - el grupo que vuelve ya no sale estirado: la clase `back` chocaba con la del botón volver y
    ahora es `is-back`.

## Hecho: punto 3, avisos (PR aparte)

- `gatherAlerts` en `src/ui/alerts.ts` (con tests) junta todo; `AlertBell.tsx` es la campanita
  del HUD (número, balanceo y sonido `bell` con lo nuevo, el aviso asoma, lista animada, tocar
  lleva a la sala, Tareas, el encargo o el panel). `App.tsx` recuerda las obras recién acabadas
  (`finishedWorks`) durante ese día. El pago del HUD lleva ahora un pergamino.

## Hecho: el cobro de Merlo (PR aparte, tras el de avisos)

- `src/ui/PayDay.tsx`: escena propia antes de la carta del amanecer (decidido con el usuario).
  Merlo con su retrato, las monedas saltan de la caja a su bolsa, sello «Pagado», la barra de la
  deuda avanza y una frase suya; con el último pago, «¡Deuda saldada!». En el modo libre, más
  corto: los salarios van a la gente de la casa. Tocar adelanta; «Seguir» abre la carta.
- El núcleo apunta `payday` (opcional) al pagar. En `App.tsx`, `paying` va antes del jefe y de
  la carta.
- **Para el agente de arte:** Merlo entrando en la taberna a cobrar, y un aspecto suyo propio
  (hoy sale de `generateLook` con mercader, barba y sombrero).

## Hecho: punto 4, cartas del amanecer una a una

- El núcleo marca `big` en `DawnEvent` (rango, deuda saldada, historia cumplida, quien vuelve
  tras desaparecer, misión brillante, jefe vencido o botín raro). PR aparte, pequeño.
- `src/ui/dawnSteps.ts` (con tests) reparte la carta en pasos: con más de ocho noticias, las
  pequeñas van juntas al final, plegadas («Y además…»); «Mientras no estabas», un día por página.
- `Dawn.tsx`: se abren solas con un ritmo corto (más rato tras lo grande) o tocando; sonido por
  tipo; lo grande con salto, brillo y estrella. «Saltar» lo enseña todo y ofrece «Siempre de
  golpe», que se guarda en Ajustes (`dawnAll`; con «Menos movimiento», también de golpe).

## Antes: punto 3, avisos (decidido con el usuario)

- **Que sea visual y con «juice»:** el usuario quiere que el proyecto, la interfaz incluida,
  tenga gracia y movimiento. Una campanita arriba con su número que salta cuando llega un aviso,
  avisos que entran animados, tocar uno lleva a donde se arregla (la sala con la cámara o el
  panel), con sonido.
- **Fuentes de avisos:**
  - los de la casa (`crewAlerts` en `src/ui/crew.ts`);
  - un encargo que caduca hoy sin coger;
  - un grupo que vuelve, y heridos sin cama en la enfermería;
  - un pago que llega y no alcanza la caja;
  - obras terminadas;
  - entrenamiento al tope del nivel de la sala.

  No repetir los incidentes, que ya flotan sobre su sala (`ui/IncidentMark.tsx`).
- **Pregunta del usuario: ¿el cobro de la deuda tiene representación o simplemente sucede?**
  Hoy:
  - la campana del HUD (`Hud.tsx`, `pago`) cuenta los días y dice el total al mantenerla;
  - Gremio enseña el calendario de pagos (`GremioPanel.tsx`);
  - el día del pago solo sale una línea en la carta del amanecer («Día de pago: …»,
    `endDay` en `core/game.ts`, hacia la línea 990);
  - ni Merlo ni monedas que se van: simplemente sucede.

  Propuesta para enseñarle: un momento de cobro con Merlo, las monedas saltando de la caja, el
  sello «Pagado» en el calendario y la barra de la deuda bajando; además, el aviso si no llega.
- **Pendiente del encargo anterior:** el globito sobre la sala sin nadie, en la escena. Toca
  `src/world/rooms/`: decirlo en el PR.
- **Para el agente de arte (le pasa el usuario):** el perro tocable y el gato Bigotes de vuelta
  (se quitó con la vista 2D en el PR 12).

## Trucos de trabajo

- **Rama `claude/magical-brahmagupta-e4b8at`:**
  - empujar a la fuerza está bloqueado;
  - tras fusionar un PR, poner la rama al día con `git merge --ff-only origin/main` (o
    `git merge origin/main`) y empujar normal;
  - un PR cada vez, porque los commits nuevos entran en el PR abierto.
- **Capturas:**
  - `npx vite preview --port 4173 --strictPort` con `run_in_background` (se para a las 2 h);
  - no comprobar con `pgrep -f "vite preview"`: se encuentra a sí mismo;
  - los guiones de Playwright cargan con
    `createRequire('/home/user/AdventurersGuild/')('playwright')`;
  - preparar la partida con `window.__game.get()/set()/dispatch()`;
  - tocar a alguien de la escena con `window.__scene.cb.onHero(id, {x, y, wx: 0, wy: 0})`;
  - la carta del día 1 se cierra con el botón «Abrir»;
  - con swiftshader cada captura tarda: usar pocas pantallas por guion.
- **Página para el usuario:** «Jarro: quién hace qué»
  (https://claude.ai/artifact/Jnvs9AQGPp9K7khVR2WPFS), con capturas por PR.
