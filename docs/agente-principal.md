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
- Pelea interactiva contra jefes: `core/combat.ts` (simulación, `missionCombat`), `ui/BossFight.tsx`
  (en directo con `fight.sim`), `world/battle.ts` (modo `live`), calibrado con `npm run calib`.
  Siguiente: críticos con gesto (el evento `crit` ya existe).
- Amanecer, decidido: con la app abierta no hay carta (avisos y, solo lo gordo, carta suelta);
  la pila de cartas, al volver tras tenerla cerrada (plan, «Pendiente de revisar» y fase 5).
- Interfaz: el título se queda (el usuario no se quejaba de él); corregido en
  `encargos/interfaz-primera-vez.md`. Sigue sin fusionar **el cobro de Merlo** (`ui/PayDay.tsx`):
  revisarlo con el tutorial (salto al día 7) y `dueTonight` cuando llegue.
- Después: 2b (tutorial de obras). Pendientes del tutorial: candados en mapa y adornos, y que la
  barra diga que el reloj está parado.

## Dónde lo dejamos (6 de noviembre)

- Mientras tanto, otros agentes: el patio trasero (anexo y jardín), la interfaz y mucho arte
  (luz con ambiente, `docs/plan-luz.md`).
- Hecho: `RoomScene.pace` (la escena va al ritmo del reloj) y la sastrería que espera al héroe:
  empieza cuando la escena le ve llegar (`Crowd.onArrive` → acción `arrived`, `Craft.wait`;
  `DRESS_WALK` es solo el tope si nadie avisa). Auditoría de movimiento en
  [`encargos/arte-movimiento.md`](encargos/arte-movimiento.md).
- Coherencia de la gente: toda tarea cuenta desde que se llega (`Hero/Worker.walk` y `since`,
  `workAt`, `shiftShare`, `newShift` cada noche) y los incidentes se arreglan al llegar quien va
  (`Incident.coming`). Arrastrar = ir andando a paso ligero.
- Encargado al de arte: [`encargos/arte-movimiento.md`](encargos/arte-movimiento.md).
- Esperando al usuario: [`propuesta-asaltos.md`](propuesta-asaltos.md) (la pelea de los asaltos
  y arrastrar andando). Después de eso, a lo nuestro: núcleo con órdenes en `core/assault.ts`.
- La APK, cuando el usuario diga que el arte ha acabado.

## Dónde lo dejamos (7 de noviembre)

- Hechos los asaltos en directo y el duelo con el ladrón (ver `propuesta-asaltos.md`, «Hecho»).
  Núcleo: `core/assault.ts` (`Assault`, `raidSeed`), acción `raidFought`, `GameState.raidLive`;
  escena: `RaidShow.live`, `RoomScene.liveRaid`, `drawDuels`; interfaz: `ui/RaidCrew.tsx`, y
  `App.tsx` (`endDay` juega el asalto antes de amanecer; `dawnAfter`).
- Probado con `node_modules/.cache/jarro-shots/asalto.mjs` y `ladron.mjs` (pueden no existir).
- Encargado al de arte: `encargos/arte-asaltos.md`.
- Tras los asaltos, el núcleo de los encargos del 7 de noviembre: bug del hueco (`freeCells`),
  oro en modo libre (`FREE_PAY`, `levelRaise`, `npm run oro`), tope de entrenamiento
  (`cappedTrainees`), ropa con candados (`dressStatus`), el taller del pintor (`core/paint.ts`) y la
  auditoría del tiempo (`propuesta-tiempo.md`, pendiente de decidir). Lo que queda de interfaz y
  arte, al final de cada encargo en `encargos/`.

## Cambios en el núcleo hechos por el agente de arte (8 de noviembre)

Pedido del usuario («lo que pasa, pasa de verdad»: sin el trabajador en la sala, no se avanza).
Hecho desde la rama del pintor; léelo antes de tocar trabajos, talleres o entrenamiento.

- **Nada cuenta hasta que se llega** (`core/workers.ts`): `onWay` ya no mira la hora: quien tiene
  `walk` va de camino hasta que la escena despacha `arrived` (`arrivedAt`, que ahora cuenta desde
  ese momento, `since = ahora`). `shiftStart` da 1 (nada de hoy) mientras va de camino. Afecta a
  todo lo que usa `workAt`/`shiftShare`: caja y visitantes del salón, comida, cerveza, curación,
  talleres (forja, alquimia, sastrería) y entrenamiento.
- **Cada mañana también** (`newShift`): quien tiene sala amanece con `walk = WORK_START` y cuenta
  desde que la escena le ve llegar (los del pueblo tardan lo que tardan andando).
- **Sin escena, a su hora** (`settleWalks`): con el juego cerrado (`catchUp` en `away.ts` y
  `endDay(s, true)`) y en `npm run sim` (en `tools/sim.ts`, al empezar cada día y antes de la
  noche), cada uno llega a su `walk` (el principio de la jornada, o `JOB_WALK` horas tras
  mandarle). Así `npm run sim` da **lo mismo que antes** (comprobado: salida idéntica).
- **Pintar y vestir** (`core/paint.ts`, `core/crafting.ts`): no empiezan hasta `arrived`;
  `PAINT_WALK`/`DRESS_WALK` solo con el juego cerrado (`unseen` en `stepPaints`/`stepCrafts` y en
  sus `night…`).
- **Escena**: `SceneHero.due` (el núcleo aún le espera) hace que `crowd.tell` repita el aviso de
  llegada cada 2 s mientras siga en su sala y sin contar (por si no salió de ella de un día a otro).
- Ojo con los tests nuevos: quien se asigna en un test no cuenta hasta despachar `arrived`, y tras
  `endDay(s)` (sin `true`) todos vuelven a ir de camino.

## Equipo: niveles nuevos y lo que cambió el arte (8 de noviembre)

El usuario quiere **más niveles de rareza** en el futuro (es cosa tuya: tipo, botín, equilibrio,
talleres, nombres y marcos). El arte ya está listo para cinco:

| Nivel | Color | En el dibujo (`art/tiers.ts`) |
|---|---|---|
| Común | gris | hierro mate y cuero |
| Bueno | verde | acero, remates de bronce, gema verde |
| Raro | azul | acero pulido, plata, gemas azules, remaches |
| Épico | morado | metal ennegrecido, runas y pedrería moradas (brilla de vez en cuando) |
| Legendario | oro | oro; los que tienen nombre, su dibujo propio (`art/legendaries.ts`) |

- **Hecho: cinco rarezas** (`Rarity` 0–4, `tierOf` uno a uno). Lo que cambió:
  - Catálogo (`data/items.ts`): los «buenos» de antes son **raros** (2), los legendarios son 4;
    nuevos 6 buenos (+1 y +1 en otra habilidad, ~30 monedas) y 6 épicos (+3, o +2/+1 con efecto,
    ~85). Los épicos no tienen dibujo propio (`unique` solo cuenta en los legendarios, 4).
  - Botín (`generate.ts`): pesos de 0 a 4 según peligro y rango; rumores dan raro o, con
    `RUMOR_LEGEND`, épico o legendario a medias; eventos (buhonero: raro; noble: raro/épico/legendario).
  - Premios (`data/feats.ts`, `data/goals.ts`): `item: 1` → 2 y `2` → 4. Talleres: lo «bueno» de
    las recetas sale raro (2); no se fabrican buenos, épicos ni legendarios. Mejora (`plus`) igual.
  - Venta: el `value` de cada objeto. Estante de la escena (`rackIcon`): tres acabados (común,
    bueno–épico, legendario).
  - Guardado: `SAVE_VERSION` 5; una partida v4 se convierte al cargar (`fiveRarities` en
    `platform/storage.ts`: cada `rarity` 1→2, 2→4, y `reward.item` igual; incluye peleas guardadas).
  - `npm run sim`: victorias y oro dentro de ±1 punto en todas las estrategias.
- **La interfaz ya va por nivel** (no por rareza): las casillas, el muñeco, la ficha y el recuadro
  del Arcón usan la clase `tier-N` con `tierOf(rarity)`, y `pixelui.ts` tiene los cinco marcos
  (`--frame-slot-0`, `-t1`, `-1`, `-t3`, `-2`: gris, verde, azul, morado y oro). Al cambiar
  `tierOf`, los marcos y el color del nombre siguen solos. Las clases `rarity-N` que quedan en
  `styles.css` son de las mejoras del gremio (`.facility`), no de los objetos.
- Un legendario nuevo sin dibujo sale con su icono en oro; con dibujo, es añadir su rejilla en
  `legendaries.ts` con el nombre exacto del objeto.
- **Cambios de tipos**: `HeroMarks.gear` es ahora `GearMark | GearMark[]` (una pieza por ranura,
  con `unique` = nombre del legendario). `marksOf` usa `wornMarks(h)` (`ui/view.ts`) en vez de
  `shownGear`; las peleas guardadas (`BossFight.heroes[].gear`, una pieza) siguen valiendo.
  `shownGear` del núcleo no se ha tocado.
- **Iconos**: `itemIcon` es de 16 × 16 (antes 12) y anima los épicos y legendarios con
  `ItemImage` (`ui/ItemImage.tsx`); en la escena va `rackIcon` (12 × 12).
- **Decidido con el usuario (filete del tinte)**: el equipo va **delante** de la prenda (coraza y
  escudo tapan el tabardo, también en el retrato; no cambiar el orden). Lo único que falta: un
  **filete del color del tinte** en el peto y en el escudo, en el retrato y en la figura, para
  que el tinte se vea aunque lleve coraza. La capa común ya toma el tinte. **Hecho**
  (`dyeLine` en `art/heroes/gear.ts`): filete de `TINTS[dye].ramp[2]` dentro del borde del peto y
  del canto del escudo, en retrato y figura; sin tinte no cambia nada y los legendarios propios
  (`unique`) no lo llevan. Coraza y escudo comparten ranura (cuerpo): nunca van juntos.

## Dónde lo dejamos (9 de noviembre): revisión crítica y decisiones

- Barrido general con una partida del usuario (día 219):
  [`revision-critica.md`](revision-critica.md).
- Todo lo que sale de ahí, y lo pendiente de propuestas anteriores (noche, expediciones), está en
  [`decisiones.md`](decisiones.md) con un código (A1…X5) y en la página «Decisiones del Jarro»
  (https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk), donde el usuario aprueba, pide cambios o
  rechaza. Antes de seguir, leer sus respuestas (colección `decisiones`) y poner al día el
  registro y el plan (sección «Antes de las expediciones»).
- (11 de noviembre) El usuario contestó todo: el plan de ataque está en `plan.md` y lo pendiente
  (bocetos C7, D1 y E1; A8, A9, B5, C8, C9, E4 y X4) en el registro. Antes: aprobado A1, A2 y C6 (botón
  «Personalizar» en las salas). Lo siguiente, de lo troncal a lo menudo: el bloque 1 (A3–A7) y
  los arreglos rápidos (B1–B7), que no dependen de nada.

## Para retomar (12 de noviembre): todo decidido, empieza el plan de ataque

1. Leer [`plan.md`](plan.md), «Plan de ataque» (fases 1 a 8), y [`decisiones.md`](decisiones.md):
   cada punto con su código, lo elegido, las notas del usuario y «Por aclarar antes de empezar
   cada fase» (preguntarlo al llegar a esa fase).
2. Por si el usuario cambia algo en la página, leer antes su colección `decisiones` (herramienta de
   datos del artefacto, https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk) y comparar con el
   registro. La página está copiada en `tools/decisiones.html` por si hay que republicarla.
3. Siguiente paso: la **fase 1** (B1, B2, B3, B6, A2, A1 y los textos de E3) en la rama
   `claude/sweet-bell-mky0ou`, o los bocetos C7, D1 y E1 si el usuario los prefiere antes.
4. Datos de la partida del usuario (día 219) usados en la revisión: resumidos en
   [`revision-critica.md`](revision-critica.md). La partida entera no está en el repositorio; si
   hace falta, pedírsela («Gremio › Partidas › Copiar código»).

## Fase 1 hecha (12 de noviembre)

- **B1** «Sugerir» prueba todos los grupos (`core/suggest.ts`); a igualdad, menos gente (cada uno
  de más tiene que ganar `GAIN`). 13 héroes: 5 ms; 20: 20 ms. En `QuestSheet` se cuenta con
  `useMemo` (no al tocar cada héroe). Test con tres especialistas que el método viejo no sacaba.
- **B2** sastrería (`stepCrafts`): si el héroe sale o cae en cama, el trabajo se pausa y vuelve a
  esperarle (`wait`): al volver tiene que ir otra vez a la sala. Si ya no está en el gremio
  (despedido, muerto o desaparecido), se cancela y devuelve el oro con aviso. El panel dice «En
  pausa…» y la hoja del encargo avisa si a alguien del grupo le están cosiendo.
- **B3** bandas: «{viene|vienen}» en `data/raids.ts` (`bandNumber`, `capBand`), también en el
  aviso del amanecer, el mapa, el Gremio y la barra. Clientes en las frases con artículo
  (`clientProse` en `data/quests.ts`: «Berta, la posadera, pagó…») y `{Client}`/`{Place}` al
  empezar frase.
- **B6** el correo guarda 50 (`REPORTS_KEEP`, al final de `endDay`) y tiene «Leído todo»
  (acción `readAll`). Ojo: los informes ya no son el historial; para contar encargos, `stats`
  (cambiados `tools/sim.ts` y `GameOver`).
- **A2** patio: 1 o 2 de experiencia por noche y se queda en 99. Asalto ganado: +25 (`RAID_XP`) y
  `levelUp` (chips en el informe).
- **A1** fama pasiva: nobles +1 solo cada 10 días (`NOBLE_REP_EVERY`), tapices cada 14, cuervo
  cada 15. `npm run sim`: victorias y oro iguales; fama final −11 % (normal 845 → 752).
- **E3** textos de los materiales (sin pociones, hachas ni cristal en uso).
- Siguiente: fase 2 (el bucle) o los bocetos C7, D1 y E1, lo que prefiera el usuario.

## Fase 2 hecha (12 de noviembre)

- **A3** tablón a la medida (`generateQuest(..., power)` con `homePower(heroes)`, en
  `core/generate.ts`): la medida es la media de las cuatro habilidades de los cuatro mejores (sin
  equipo), con el techo del rango (`perHero(rank)`); cada encargo sale fácil, justo o difícil
  (`BOARD_TIERS`: ×0,75 / ×1 / ×1,3 con pesos 35/40/25 %) y el peligro se mide contra la medida.
  Lo usan el tablón, las historias, los rumores y los rescates. Sin `power`, como antes.
- **A5** quien está de guardia no duerme: −3 de moral por noche (`GUARD_DROP`), sin bajar de 15
  (`GUARD_FLOOR`: no llega a desertar), aviso al bajar de 35. Marca de moral baja (chapa roja con
  flecha) en el retrato (`marks.low`, `Portrait.tsx`); textos de la ficha al día.
- **A4** aburrimiento: `hero.idle` cuenta noches en casa sin salir (la guardia no cuenta; vuelve a 0
  al salir de encargo); pasadas 7 (`BORED_AFTER`), −2 por noche hasta 30 y aviso. La comarca:
  `state.quiet` cuenta noches sin nadie fuera; pasadas 4 (`QUIET_AFTER`) la amenaza sube +1 por
  noche (caravanas, menos encargos, asaltos, que ya existían).
- **A9** fama que se olvida (`fadeFame` en `core/ranks.ts`): con `quiet` > 4, −1 % por noche, sin
  bajar del principio del rango de debajo del más alto alcanzado (`rankSeen`); avisos al empezar,
  al perder el rango (`rankLost`) y al recuperarlo. Lo construido se queda: las obras ya piden el
  rango actual. Nada de esto pasa con el juego cerrado ni en el tutorial.
- `npm run sim` con A3+A4+A5+A9: victorias 86/73/47/82 % (temeraria/normal/cauta/sin contratar;
  antes 85/71/49/77), oro y fama parecidos.
- **A8** bajas (otro agente, ya junto): `CASUALTY[resultado][peligro]` en `balance.ts` (fracaso
  difícil 0,7 y letal 0,9; éxito parcial difícil 0,45 y letal 0,6; desastre 0,5–1),
  `CLERIC_SAVE` 0,4, `COWARD_FLEE` 0,4, `LOST_SHARE` 0,7 (desaparecidos). La capilla ya subía la
  vuelta (`RETURN_CHANCE`); su texto lo dice. Tests en `core/casualties.test.ts`; el simulador
  cuenta bajas por peligro y vueltas.
- `npm run sim` con toda la fase: victorias 87/71/52/80 %; normal, en lo difícil una baja cada 19
  encargos (1,6 muertos + 3,6 desaparecidos por 100), en lo fácil casi nunca; con capilla vuelve
  el 85 % de los desaparecidos. Si la temeraria (1 cada 9) parece mucho: bajar
  `CASUALTY['Éxito parcial'][2]` a 0,35.
- Bocetos hechos (`docs/bocetos/`, publicados: C7 https://claude.ai/artifact/P4KEM694obLjsUmQA1FySd,
  D1 https://claude.ai/artifact/GzzfZM9VD6mj3XJqcMNvqp, E1
  https://claude.ai/artifact/Jnjqegd7qromZxRTekpgUQ), cada uno con variantes A y B. Falta que el
  usuario elija. El de E1 se dibujó con el motor en una copia aparte (no está en el repositorio).
- Siguiente: fase 3 (talleres), con lo que elija el usuario de C7.

## Fase 3 hecha (12 de noviembre)

- **B8** calidad por nivel del taller: `qualityOdds(s, roomId)` en `core/crafting.ts` →
  `{ comun, bueno, raro }` con `CRAFT_QUALITY[nivel]` (nivel 1: 70/25/5 %; 2: 45/38/17; 3:
  25/45/30; 4: 15/45/40); el mejor artesano pasa 3 puntos por maña sobre 4 de común a raro; sin
  artesano, bueno y raro a la mitad. Lo bueno es lo común con `plus: 1` y rareza 1 (`crafted`).
  `goodChance` queda como alias de la probabilidad de raro. El tamaño ya daba puestos.
- **B4** la forja ya no suma a las armas (`gearOf`); su efecto en `FACILITY_INFO` es la calidad
  (`qualityText`). Descripción de la sala al día.
- **B5** `priceOf(item)` en `core/gear.ts`: el equipo vale por rareza y lo que da (`PRICE_TIERS`,
  `PRICE_KIND`), sin rango ni procedencia; los tesoros, su `value`. Lo usan vender, el arcón, la
  ficha del objeto, la notoriedad de los asaltos y los logros. Común 10–15, bueno 25–35, raro
  45–70, épico 110–130, legendario 180–275.
- `npm run sim`: victorias 86/71/53/79 %, como antes.
- **C7** (otro agente, ya junto): `RoomPanel` lleva «Mejorar · precio» arriba en todas las salas
  (`.room-top`); la ficha del taller (`WorkshopInfo`) tiene «Trabajan aquí» y «En marcha» fijos y
  pestañas Crear (lista) · Templar (una rejilla; Mejorar y Desmontar al tocar) · Vestir (rejilla de
  retratos). Dos cifras de calidad: la de la sala (`FACILITY_INFO`) y la de ahora con el artesano.
  La forja pasa de 2,4 a 1,3 pantallas con la misma partida.
- Siguiente: fase 4 (un solo motor de pelea, A6).

## Fase 4 hecha (13 de noviembre)

- PR de las fases 1 a 3 fusionada (ctoujoma/AdventurersGuild#193); la rama se rehízo desde `main`.
- `core/fight.ts`: `FightUnit`, `FightOrder`, `FightEvent` y la clase `Fight` (golpe, crítico con
  ocasión e IA, habilidades, golpe fuerte con aviso y cubrirse). `Combat` (jefes), `Assault`
  (asaltos) y `clockDuel` (ladrón) la usan; cada una traduce el registro a `CombatEvent`,
  `RaidStep` o `DuelHit`, así que las escenas no cambiaron. `heroUnit` y `ABILITIES` viven en
  `fight.ts` (`combat.ts` los reexporta).
- Tests de referencia: `core/peleas.test.ts` con `core/fixtures/peleas.json` (70 jefes, 31 asaltos,
  15 ladrones, en directo y repetidas con órdenes). Para regrabarlas:
  `GRABAR_PELEAS=1 npx vitest run src/core/peleas.test.ts` y prettier sobre el JSON.
- `npm run calib` y `npm run sim`, idénticos a antes.
- Pendiente (paso 4): que `world/battle.ts` y `world/rooms/raid.ts` lean `FightEvent` (los
  informes viejos de asalto guardan `RaidStep`: mantener el adaptador), la barra de habilidades
  común de `BossFight` y `RaidCrew`, y el aviso del cabecilla en el asalto (cambia el equilibrio:
  preguntar).
- Siguiente: fase 5 (interfaz).

## Fase 5 hecha (14 de noviembre)

Repartida en cuatro agentes y juntada en la rama (sin choques):
- **Navegación (C1–C4, C9)**: barra Tablón · Mapa · Héroes · Gremio (la taberna es lo de detrás);
  Héroes con pestañas Héroes · Barra · Tareas · Equipo (el arcón; su pestaña interior se llama
  «Piezas»); la campana con Avisos e Informes (adiós al correo de abajo); Gremio con Salas,
  Adornos y Libro, y el engranaje con Partidas, Ajustes y Menú principal; historial de encargos
  (`HistoryPanel`, `state.questLog`, 200 como mucho, `QUEST_LOG_KEEP`) desde el Libro, el Tablón y
  la campana.
- **Fichas de sala (C5, C6)**: `ROOM_INFO` en `data/roomInfo.ts` con «Ahora / Mejora» de todas las
  salas y su test; botón «Personalizar» (`RoomCustom.tsx`) con colores y, en el salón, fiesta y
  decoración (fuera de Gremio › Adornos; allí quedan letrero, fachada, jardín y animales).
- **Encargos y mapa (D1–D4)**: nota del tablón con iconos y chapa (`outlook` en `core/suggest.ts`,
  memorizado); hoja del encargo ordenada por `questFit` y «Quitar de guardia y llevar»
  (`send` con `unguard`; retoma la guardia al volver); aviso de equipo mejor (`gearPower`,
  `betterGear`, `ui/gearHint.ts`); mapa con rótulos que no se montan, leyenda a la vista y
  amenaza explicada (`threatTrend`, `THREAT_STEPS`).
- **La taberna (D5)**: `isAway`/`awayPlan` en `core/beds.ts`; camas hechas de los de fuera y nota
  en el tablón del salón (`world/rooms/fuera.ts`).
- `npm run sim`: victorias 86/72/53 %; normal, en lo difícil una baja cada ~21 encargos.
- Dudas abiertas para el usuario: el aviso de equipo marca casi a todos si nadie lleva nada;
  «Personalizar» va en la fila de botones del final; los animales siguen en Adornos.
- Siguiente: fase 6 (salas: E1 galería del salón con escalera, E2, E4).
