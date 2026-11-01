# Agente principal: notas para retomar

Para el agente principal (núcleo, tiempo, tutoriales, combate, talleres, amigos). Léelo junto a
[`plan.md`](plan.md) (qué se hace y en qué orden) y [`../CLAUDE.md`](../CLAUDE.md).

## Forma de trabajar con el usuario

- En español y breve. Al final de cada entrega, un **punto de situación del plan** corto.
- Rama `claude/sharp-mendel-apsm2a`, un PR por entrega contra `main`. El usuario fusiona y avisa;
  no vigilar PRs. Tras una fusión: `git fetch origin && git checkout -B claude/sharp-mendel-apsm2a
  origin/main` (no hay force push; si hace falta, `git merge origin/main`).
- Commits y PR con el pie de sesión (lo da el sistema). Nada de nombres de modelo en el repo.
- Antes de subir: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- Comprobar en el navegador lo que se toca (abajo), y contarlo en el PR.
- Otros agentes (el usuario los lanza con «Lee `CLAUDE.md`, `docs/plan.md` y
  `docs/encargos/<encargo>.md`…»): interfaz (`claude/magical-brahmagupta-*`) y arte
  (`claude/ecstatic-mendel-*`). Si tocamos su zona o `App.tsx`, decirlo en el PR. Para repartir
  trabajo, escribir un encargo en `docs/encargos/` y enlazarlo en el plan.

## Probar en el navegador

- `npm run build`, y servir con `npx vite preview --port 4173` (en segundo plano).
- Playwright global: `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`,
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`,
  `args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist']`, `headless: false`, ventana 420×860.
- `http://localhost:4173/#debug`: salta el título (partida nueva directa) y expone
  `window.__game.get() / set(s) / dispatch(a)` y `window.__scene`. Ajustes en
  `localStorage['jarro:ajustes']` (por ejemplo `{ tester: true, music: 0, sfx: 0 }`).
- Scripts y capturas en `node_modules/.cache/jarro-shots/` (no se suben; pueden no existir en
  una sesión nueva). Útiles que había: `guiado.mjs` (recorre el tutorial tocando el foco
  `.tut-ring`), `incidente.mjs`, `rumor.mjs`, `jefes.mjs`.
- Versión de pruebas para el usuario: artefacto «Jarro: pruebas»
  (https://claude.ai/artifact/Q3UURTw7ZoMJm8cJU827U4), con `python3 tools/build-artifact.py dist
  <salida>.html` y el título cambiado a «Jarro: pruebas». Desde que `main` publica en GitHub
  Pages se usa poco.

## Mapa rápido de lo hecho (dónde mirar)

- Tiempo que corre solo: `core/away.ts` (`catchUp`, `dueTonight`), `ui/when.ts`, `App.tsx`.
- Rangos y niveles: `core/balance.ts` (`RANKS`, `LEVEL_RANK`), `core/ranks.ts`, `core/rooms.ts`.
- Incidentes: `data/incidents.ts`, `core/incidents.ts`, `ui/IncidentMark.tsx`, `ui/drop.ts`.
- Objetivos y premios que se ven: `data/goals.ts`, `core/goals.ts`, `data/unlocks.ts`.
- Rumores: `data/rumors.ts`, `core/rumors.ts`, `ui/RumorMark.tsx`.
- Historias con jefe: `data/chains.ts`, `data/bosses.ts` (los jefes teñidos: `base`, `ramp`),
  `art/bosses.ts` (`recolor`), `data/places.ts` (al oeste es mar: `coastAt` en `art/map.ts`).
- Tutorial: `core/tutorial.ts` (pasos, carta `LETTER`, saltos de tiempo `skipTime`, reloj parado
  en `reduce`/`tick`), `ui/TutorialNote.tsx` (página del cuaderno), `ui/TutorialFocus.tsx` y
  `ui/tutorialFocus.ts` (foco que bloquea; marcas `data-tut` en los botones; `sala:<id>` y
  `escena:<selector>` cierran antes lo que tape), `ui/IntroLetter.tsx`. Notas sueltas del
  cuaderno: `ui/tips.ts`, `ui/UncleNote.tsx`.

## Dónde lo dejamos (1 de noviembre, tras el feedback)

- En `main`: todo lo anterior, más los golpes de los jefes nuevos del de arte (#72) con su
  propuesta del panel del encargo (`encargos/propuesta-panel-encargo.md`).
- Hecha la ficha «Encargo en curso» (`ui/TripSheet.tsx`) con sus datos (`core/journey.ts`):
  toca al de arte la tira (`QuestStrip`, en el hueco `Strip`). El encargo se resuelve al acabar
  lo suyo (`settleMission` y `tickMissions` en `game.ts`, `Mission.done`); el jefe espera la acción
  del jugador (`Mission.waiting`, acción `boss`, `ui/BossFight.tsx` `BossWait`).
- El tutorial es de un agente propio: `encargos/tutorial.md`.
- Amanecer, decidido: con la app abierta no hay carta (avisos y, solo lo gordo, carta suelta);
  la pila de cartas, al volver tras tenerla cerrada (plan, «Pendiente de revisar» y fase 5).
- Interfaz: el título se queda (el usuario no se quejaba de él); corregido en
  `encargos/interfaz-primera-vez.md`. Sigue sin fusionar **el cobro de Merlo** (`ui/PayDay.tsx`):
  revisarlo con el tutorial (salto al día 7) y `dueTonight` cuando llegue.
- Después: 2b (tutorial de obras). Pendientes del tutorial: candados en mapa y adornos, y que la
  barra diga que el reloj está parado.
