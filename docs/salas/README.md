# El gremio por salas: estado y cómo seguir

Esto es todo lo necesario para que otra persona (o un agente) retome el trabajo del sistema de
salas sin el historial de la conversación. Léelo entero antes de tocar nada.

## Qué es

_El Gremio de Aventureros · El Jarro Partido_: juego de gestión de un gremio en una taberna
(TypeScript + Vite + Preact, escena en three.js con pixel art). El diseño original está en
[`../diseno.md`](../diseno.md) y la técnica en [`../plan-desarrollo.md`](../plan-desarrollo.md).

El juego es un **edificio de salas en corte, como Fallout Shelter** (se hizo en la rama `salas`,
PR #11 a #25, y pasó a `main` en #26): se construyen, amplían, mueven y mejoran salas; la gente anda por ellas; el día pasa
en tiempo real; hay trabajadores, visitantes, comida, entrenamiento y asaltos sala a sala.

## Forma de trabajar (acordada con el usuario)

- **Idioma:** todo en español (código, comentarios, textos, PR y respuestas). Respuestas breves.
- **Ramas:** cada agente trabaja en su rama y cada PR va contra **`main`** (la rama `salas` ya
  no se usa). Al fusionarse un PR, la rama se rehace desde `main`:
  `git fetch origin main && git checkout -B <tu-rama> origin/main && git push --force-with-lease -u origin <tu-rama>`.
- **No vigilar los PR** ni programar recordatorios: el usuario avisa cuando fusiona.
- **Antes de subir:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- **Commits:** mensaje en español que explique el qué y el porqué. Sin nombres de modelos.
- **Versión publicada:** al fusionar en `main`, GitHub Pages publica el juego solo
  (`.github/workflows/deploy.yml`); el usuario lo comparte con sus amigos para que prueben.
- **Versión de pruebas antes de fusionar:** un HTML de un solo fichero con
  `python3 tools/build-artifact.py dist <salida>.html` tras `npm run build`, publicado como
  artefacto de claude.ai (título «Jarro: pruebas») si tienes la herramienta; si no, las capturas
  del PR.
- **Capturas:** `tools/shots/` (ver su README). Chromium ya está en el contenedor.
- **Partidas viejas:** si cambia el formato, se sube `SAVE_VERSION` y las antiguas se ignoran
  (ahora hay gente probando: evítalo si no hace falta y avísalo en el PR). En el menú de pruebas (`#debug`, «Modo pruebas» en Ajustes) hay trucos.
- **Una sola vista:** la taberna dibujada de antes se quitó (PR 12); si el navegador no puede
  pintar 3D (WebGL), la escena enseña un aviso y el resto del juego sigue.
- **Estilo del código:** núcleo en TS puro con tests (`src/core`), la escena solo enseña lo que
  decide el núcleo. Comentarios en español, breves, explicando el porqué. Prettier manda.

## Plan de 12 PR y estado

| # | PR | Estado |
| --- | --- | --- |
| 1 | Núcleo de salas | Hecho (#11) |
| 2 | Escena de salas (luego rehecha en 3D, #13) | Hecho (#12, #13) |
| 3 | Obras | Hecho (#14, retoques #16 y #18) |
| 4 | Gente en la casa | Hecho (#15) |
| 5 | El día vivo | Hecho (#16) |
| 6 | Trabajadores | Hecho (#17) |
| 7 | Salón y visitantes | Hecho (#19) |
| 8 | Comida y cerveza | Hecho (#20) |
| 9 | Entrenamiento + arrastrar personajes a salas | Hecho (#21) |
| 10 | Tesoro y asaltos sala a sala | Hecho (#22) |
| 11 | Arte de cada sala | Salón de muestra, obras rehechas y rondas de pruebas en #23; el resto de salas, hecho en #28 y esperando la revisión del usuario (ver [`encargo-arte.md`](encargo-arte.md)) |
| 12 | Balance y limpieza | Hecho (#24, #25); todo a `main` en #26 |

**Obras rehechas** (pedido del usuario antes de seguir con el arte): ver
[`obras-rework.md`](obras-rework.md), con decisiones y progreso punto a punto, incluidas las
rondas de pruebas del usuario (apartado 5).

**Cómo seguir:** (1) arte del resto de salas: hecho, falta el visto bueno del usuario (ver
[`encargo-arte.md`](encargo-arte.md)); (2) probar con partidas de verdad (los amigos del
usuario, en GitHub Pages) lo apuntado en «Balance».

## Decisiones de diseño ya tomadas (resumen)

- Ancho de 4 a 7 huecos comprando solares; hasta 4 plantas arriba y 6 abajo (excavando).
- Al empezar: la taberna del tío con todas las salas en su sitio y muchas rotas. Hasta pagar la
  deuda solo se arregla y se mejora; con el último pago (día 28) el gremio es tuyo y se abren
  las obras de verdad.
- Recibidor = entrada y guardia (2 como mucho; su nivel es la puerta). Salón = visitantes y caja.
  Cámara del tesoro = tope del oro (lo que no cabe se pierde) y cerradura.
- Trabajadores con Maña y oficio; los 3 del pueblo al principio, luego una cama del servicio cada uno.
- Comida (cocina/despensa) y cerveza (bodega) como recursos; sin cenar baja la moral.
- Entrenamiento en 3 salas (Fuerza, Destreza, Mente) con tope por nivel.
- Asaltos simulados en el núcleo (`src/core/assault.ts`) y reproducidos en la escena.
- Estilo visual: 3D pixelado (cámara lateral, render a baja resolución con la paleta). Arte
  definitivo «entre el actual y la dirección A» (aventura gráfica VGA), sala a sala.
- Ideas aprobadas para más adelante: botones «?» de ayuda (la pulsación larga sobre personajes
  ahora es arrastrar), noches especiales, huéspedes, calabozo, perro que avisa, persecución del
  bandido que huye, revisar qué aporta la empalizada.

## Mejoras de futuro (apuntadas, sin hacer)

La lista completa de pendientes e ideas (bucle, monetización, amigos, torneos, fachada) está en
[`../futuro.md`](../futuro.md).

- **Escaleras que solo ocupan sitio donde llegan:** la columna de escalera tendría ancho solo en
  las plantas con rellano y en las demás las salas se juntarían (sin pasillos). Consecuencias
  vistas: el edificio queda escalonado (el hueco mide un tercio de sala: paredes que no casan
  entre plantas, borde derecho en escalera, voladizos parciales que dibujar); una sala de dos
  alturas no puede tener escalera en una planta y no en la otra (habría que prohibirlo); poner o
  quitar un tramo corre media planta. Toca `colX`/`stairX`/`innerWidth` por planta en
  `layout.ts`, `roomRect`, tejados, voladizos, `works.ts` y `textures.ts`.
- Equipo: la armería sin reparar se ve oscura y sus arcones se distinguen poco (darles algo de luz).

## Mapa del código (lo de las salas)

- `src/data/rooms.ts`: catálogo de salas (tamaños, únicas, `keep`, `fixed`).
- `src/core/rooms.ts`: reglas de obra (`plan…` devuelve el edificio como quedaría y el coste;
  `problem()` valida; `laxly()` deja salas sin paso; `drafting()` es el borrador del modo obras;
  `MUST` = obligatorias; escaleras por tramos: `shafts`, `landing`, `stairLinks`, `stairCost`).
- `src/core/game.ts`: estado, `reduce`, `endDay`, `tryWorks` (el borrador) y `planIssue`.
- `src/core/balance.ts`: todas las constantes. `npm run sim` para comparar el balance.
- `src/core/{workers,salon,larder,training,vault,assault,raids}.ts`: sistemas de cada PR.
- `src/world/rooms/`: la escena 3D. `layout.ts` (geometría: `CELL_W`, `PARTITION`, `SLAB`…),
  `RoomScene.ts` (montaje, cámara, toques, arrastre, asalto), `textures.ts` (caras de las salas
  y el corte), `furniture.ts` (muebles), `salon.ts` (arte del salón), `salas/` (arte de cada
  una de las demás salas, ver [`encargo-arte.md`](encargo-arte.md)), `crowd.ts` y
  `people.ts` (gente y caminos), `works.ts` (sitios válidos para cada obra), `raid.ts` (asalto).
- `src/ui/`: `App.tsx`, `works.ts` (hook del modo obras = borrador), `WorksBar.tsx` (cinta con
  pestañas), `RoomMenu.tsx` (menú-icono junto a la sala), `panels/RoomPanel.tsx` (ficha de
  sala), `drop.ts` (soltar personajes en salas).

## Balance (PR 12)

`npm run sim` juega 300 partidas por estrategia y ahora mide también las salas: caja del salón
al día, nómina semanal, noches sin cenar, asaltos (ganados y saqueo), oro perdido por tener la
cámara llena y en qué pago se pierde. Referencia del plan original: estrategia normal ~66 %,
cauta ~30 %, temeraria ~82 % (con más muertes).

- **Cambio hecho:** el primer pago (día 7) era el que más partidas tumbaba (14 % de la normal,
  22 % de la cauta), antes de aprender a jugar. Pagos 110 / 200 / 260 / 430 (la deuda sigue
  siendo 1.000): normal 74 %, cauta 44 %, temeraria 80 %; derrotas del día 7 al 6 %.
- **Vigilar con partidas de verdad:**
  - nadie se queda sin cenar en el simulador (los de misión no cenan);
  - con la cámara llena se pierden ~300 monedas antes del día 30 y ~900 en el modo libre;
  - en el modo libre sobra dinero si no se construye (el simulador no construye salas).

## Problemas conocidos

- Las obras rehechas esperan la prueba del usuario (ver «Siguiente» en
  [`obras-rework.md`](obras-rework.md)).
