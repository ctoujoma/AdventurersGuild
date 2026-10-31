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

### Vida en las salas (ronda de pruebas en PC)

- **Cosas tocables:** un mueble (`Thing.act`) o algo pintado en la pared (`markWall` en
  `salas/kit.ts`, que `backWall` vacía y la escena recoge con `takeWallActs`) abre lo suyo: el
  tablón, el mapa de la comarca, la barra (candidatos) y el armero (equipo). Al pasar el ratón
  se marca con las esquinas doradas y su nombre (`ACT_LABEL` en `RoomScene.ts`).
- **Sitios a los que va la gente** (`Thing.poi` y los tocables de leer): leer el tablón y los
  mapas, calentarse en la chimenea y rezar en el altar (`goPoi` en `crowd.ts`).
- **Animaciones** (atlas de `crowd.ts`, `F`): incorporado en la cama al acostarse y al
  levantarse (`edge`), la herramienta de cada puesto (`WORK`: cucharón, pala, cuenco y jarra),
  beber en la barra y las charlas con bocadillos (`chatWith`, `bubbles`; los iconos, en
  `TALK_ICONS`).
- **Visitantes** con ropa propia (campesino, mercader, noble y forastero: `OutfitId` en
  `art/heroes/look.ts`); en el retrato usan la de un héroe parecido.
- **Luces:** cada foco lleva un halo (`haloOf`) que el shader suma antes de pasar a la paleta, así
  sale tramado; su centro (`glow`) va a la profundidad de la llama dibujada, no a la del foco
  (si no, se corre al mover la cámara). Las llamas son una tira de fotogramas (`flame.ts`).
- **Música** (`audio/music.ts` y `audio.ts`): los temas se barajan sin repetir, cada vez con otro
  arreglo (tono, tempo, instrumento al frente) y a veces con un silencio entre uno y otro; al
  atardecer, mejor los tranquilos (`calm`). Los de la taberna tienen dos partes (`parts`) y
  suenan AABB, entre uno y dos minutos cada uno.
- **Fondo:** cinco capas lejanas con su paralaje (`parallaxLayers`: montañas, colinas, bosque
  lejano, hilera y arboleda) y árboles de verdad en el terreno a varias profundidades (`yard` en
  `RoomScene.ts`, con `Prop.pine` y `Prop.oakTree`).
- **Colores por sala:** el jugador elige en la ficha de sala (`RoomTint` en
  `panels/RoomPanel.tsx`) un tema para las telas (`TINTS` en `data/custom.ts`: vino, mar,
  bosque, ocre, morado, ceniza y lino, cuatro tonos de la paleta) o deja los de la casa. Se
  guarda en `custom.colors` por id de sala (acción `tint`; sin tocar `SAVE_VERSION`). La escena
  recibe `SceneModel.tints`, viste cada sala con su tema (`dress` en `salas/tintes.ts`) y cada
  tela pide sus tonos con `cloth(room, tonos_de_la_casa)`: sin tema, todo sale como antes.
  Cambian mantas (también la de quien duerme: fotogramas `sleepT`/`upT` del atlas), alfombras,
  esteras, cojines, manteles, paños del altar y la pared entelada; la madera, la piedra, el
  metal, los pendones (son del escudo) y la ropa, no. Desde qué nivel lleva telas cada sala:
  `TINT_FROM`. Capturas: `tools/shots/tintes.mjs`.
- **Animaciones (segunda pasada):** el paso tiene 8 tiempos (apoyo, carga, paso e impulso con
  cada pierna; `SIDE_LEGS` y `WALK_STEPS` en `art/heroes/`) y avanza un tiempo cada `WALK_PX`
  píxeles recorridos, así el pie apoyado no patina. Al cambiar de sentido, un momento de frente
  (`turn`); al sentarse o levantarse, un amago de doblar las rodillas (`seatMove`). Gestos de
  quien está parado: estirarse y bostezar (más al atardecer), brindar en la barra (`toast`);
  los del salón limpian la barra con el trapo (`WORK.barra`) y en la sala de armas se alternan
  tres ejercicios (tajo, de arriba abajo y estocada). Al volver con éxito, `RoomScene.cheer(…,
  ids)` lleva a los del grupo a la barra a dar saltitos con los brazos en alto (`celebrate`).
  El atlas se ordena solo a partir de `SIZES` en `crowd.ts`.
- **Escaleras:** cada tramo es una pieza de peldaños abiertos (`stairs.ts`: `flightArt`, a
  `FLIGHT_Z`), con el pasamanos y la sombra en la pared y un aplique con su luz en cada
  rellano (`stairBack`). La gente va al pie del tramo y sube peldaño a peldaño (`stepAt`,
  `climb` en `crowd.ts`): un impulso rápido y un momento quieto, alternando la pierna, y
  justo delante del tramo (`CLIMB_Z`). Las escaleras por tramos («que solo ocupen sitio donde
  llegan») siguen descartadas.
- **Fachada por partes:** en Adornos › Fachada se elige tejado (teja roja, pizarra, paja,
  teja verde, tablillas), paredes (tablas, entramado, piedra), rótulo (tablero, de hierro que
  sale de la pared o pintado en el hastial más ancho) y jardineras bajo los ventanucos. Se
  guarda en `custom.look` (`FacadeLook`, acción `facadeLook`); solo se ve, los adornos que
  atraen gente siguen siendo `FACADE`. Los materiales están en `rooms/fachada.ts` (`roofAt`,
  `wallFill`) y se usan en las vertientes (`roofTiles`), los hastiales y el muro del corte
  (`facade`) y los lados (`outerSide`). Sin elegir, todo sale como antes. Encima del hogar del
  salón y de la cocina hay una chimenea con humo (`chimneys`, `puffs` en `RoomScene.ts`; más
  seguido de noche). Capturas: `tools/shots/fachada.mjs`.
- **Sastrería (preparada, sin sala todavía):** cada héroe puede llevar `dress` (`Dress` en
  `data/custom.ts`: un tinte de `TINTS` y una prenda de `GARMENTS`: capa, tabardo, faja o
  bufanda). Se guarda en el héroe (el aspecto no se guarda: sale de la semilla) y `lookOf` lo
  mezcla en su `HeroLook`. El tinte cambia la tela del traje (`c`, `C`, `q`, `Q`; no la piel, el
  cuero ni el metal), en el sprite, la pelea y el retrato, y el equipo lo toma un poco (la capa
  y las sombras del metal: `tones` en `gear.ts`). Las prendas están en `art/heroes/sastre.ts`:
  la capa va por detrás; el tabardo, la faja y la bufanda, por encima de la armadura. Si la
  prenda es del color del tinte, toma otro que contraste. Para probar: en el modo prueba, la
  ficha del héroe tiene un selector (acción `dress`). Hojas: `capturas/sastreria-*.png`.
- **Heridos:** van a los catres de la enfermería y, si está rota o no caben (en el nivel 1
  solo hay uno), a una cama del dormitorio (`homes` en `people.ts`). Estén donde estén, se les
  pinta acostados con la venda (los sanos, sin ella) y de vez en cuando sube una cruz roja sobre
  su cabeza (`injured` en `crowd.ts`, partícula `cross`).
- Trabajar, charlar o calentarse van con los pies quietos (`fightSprites(…, planted)`): las
  posturas de pelea abren las piernas y, al alternarlas, parecía que andaban.

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
