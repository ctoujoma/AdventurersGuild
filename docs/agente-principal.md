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

## Dónde lo dejamos (1 de noviembre, antes de compactar)

- **Mapa del código de lo último:**
  - Encargo en curso: `core/journey.ts` (viaje, sucesos, `resolveAt`, `BOSS_T`), `ui/TripSheet.tsx`,
    la tira del de arte (`ui/QuestStrip.tsx`, `world/tripStrip.ts`, `art/foes.ts`).
  - Resolver en la faena: `settleMission`, `tickMissions`, `Mission.done` (informe y `fates`),
    `jobBefore` (vuelven a su trabajo) en `game.ts`.
  - Jefe que espera: `Mission.waiting`, `bossWait`, acción `boss` (con `orders`), `BossWait`.
  - Pelea interactiva: `core/combat.ts` (simulación determinista: `STEP`, órdenes `target`,
    `skill`, `cover`, `crit`; `FOE_TUNE`; `missionCombat`), `resolveMission(…, fight)`,
    `world/battle.ts` modo `live` (`setHp`, `aim`, `down`, `end`, `number`, `setChance`),
    `ui/BossFight.tsx`. Calibrado: `npm run calib` (`tools/calib.ts`).
  - Amanecer jugando: botón `dawn-chip` (`quietDawn` en `App.tsx`); la pila la hizo interfaz.
  - Incidentes: reaccionan solos si hay quien (`presentFor`, `INCIDENT_REACT`).
  - Obras: borrador guardado (`worksDraft`, `keep` en `ui/works.ts`).
- **Abierto:** PR #90 (borrador de obras y plan al día) sin fusionar al compactar.
- **Siguiente decidido (usuario conforme):** Android primero. Plan:
  1. Capacitor (`@capacitor/core`, `cli`, `android`) y una acción de GitHub que compile la APK de
     depuración y la deje como artefacto descargable (aquí no hay SDK de Android). Luego, la
     de publicación firmada con secretos del repo.
  2. Guardado nativo (Preferences/Filesystem), tiempo con la app cerrada (`lastSeen`, eventos
     `pause`/`resume` de la app) y aviso local la víspera del pago a Merlo.
  3. Medir el 3D en un Android modesto (el usuario lo prueba; «Pocas luces» en Ajustes) y ajustar.
  Después: la pelea interactiva en los asaltos (barra de héroes abajo, sin formaciones) y el
  multijugador sin servidor (código del grupo de un amigo con la pelea determinista; visitar
  taberna por enlace). Traducciones y talleres, para otros agentes.
- **Pendiente de revisar con el usuario:** las cartas una a una (lo valora); las escaleras
  planeadas en obras que «no dejan seguir planeando» (falta su caso concreto: no se reproduce en
  el núcleo).
