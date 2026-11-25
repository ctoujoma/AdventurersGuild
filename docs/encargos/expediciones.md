# Encargo: expediciones (fase 8)

Del agente de expediciones. Lo decidido con el usuario (22 de noviembre, cuatro vueltas en la
página «Expediciones del Jarro», https://claude.ai/artifact/A4zHkyzm3eBMRn67PT6y6y) está en
[`../decisiones.md`](../decisiones.md), bloques 7 (X1–X5) y 8 (EX1–EX24). Propuesta de partida:
[`../propuesta-expediciones.md`](../propuesta-expediciones.md). Arte:
[`arte-expediciones.md`](arte-expediciones.md) (agente de arte).

Forma de trabajar: vistas previas (capturas en una página) antes de meter cada bloque, `npm run sim`
al cerrar, un PR por bloque contra `main`. Si se toca `src/world`, `src/art` o `App.tsx`, decirlo
en el PR. **Textos:** todos los nuevos en `src/textos/es/expediciones.yaml`, con la convención de
[`../textos.md`](../textos.md) (frases enteras con huecos, mensajes `msg` para lo que se guarda en
la partida: diario, informe, avisos).

## La idea, en corto

Se manda de 1 a 4 héroes hacia uno de cuatro rumbos (bosque, sierra, marismas, ruinas) con las
raciones que elija el jugador. Sin destino: cada día más lejos, con más peligro y mejor botín, poco
a poco (sin tramos). Sucesos a horas al azar; algunos con decisión (carta con plazo hasta la noche,
opciones de clase, pista de riesgo en palabras). Vuelven solos cuando solo quedan las raciones de
la vuelta, o cuando el jugador quiera; la vuelta tarda la mitad. Todo se sigue en el visor, una
pantalla propia con la expedición en directo (peleas incluidas, resueltas solas y que se pueden
volver a ver).

## Reglas (con las cifras a afinar en `balance.ts`, prefijo `EXP_`)

- **Se abre** con el primer veterano (nivel 8, tras el cambio de veteranía del agente principal;
  hasta entonces, `EXPEDITION_LEVEL`), sin otro tutorial en marcha.
- **Grupo y a la vez:** nivel de la sala de mapas → tope del grupo (1, 2, 3, 4); huecos de la sala →
  expediciones a la vez (1, 2, 3).
- **Raciones:** una por héroe y día, de la despensa; se encuentran más fuera.
- **Lejanía:** días de ida. Peligro y botín, curva suave por día; avisos al cruzar escalones.
- **Sucesos:** tirada al azar por hora del juego (media ~2 al día, más con la lejanía), sin
  horario; de noche, a veces, en el campamento. Tipos: hallazgo, pelea, decisión, encuentro
  (mercader, viajero que se une, santuario, campamento abandonado, cofre) y paraje (cueva, mina,
  torre, ruinas: se puede entrar).
- **Decisiones:** plazo hasta la noche; si no, eligen ellos con prudencia. Opciones de clase; las
  de las clases que faltan, tachadas. Con el juego cerrado, los parajes esperan hasta un día;
  silenciada, nunca esperan.
- **Peleas:** con el motor común (`core/fight.ts`), registro guardado para «Ver la pelea». Los
  guardianes (raros, lejos) avisan y esperan unos 3 minutos con el juego abierto.
- **Tiempo:** cerca, el de la taberna; lejos, el del rumbo, con un poco de efecto (nieve: más
  raciones; niebla: más emboscadas y peor pista; lluvia: más despacio).
- **Heridas** que se acumulan (curan clérigo, santuario, poción); **bajas** con la regla de A8. Si
  caen todos, vuelve un tercio de la mochila y el resto queda como fardo perdido en el mapa.
- **Botín por rumbo:** bosque, madera y hierbas; sierra, hierro y cristal; marismas, hierbas y
  cuero; ruinas, cristal y objetos. Cristal desde unos días fuera; raro y legendario, lejos.
  Experiencia por día fuera. Usos nuevos: pociones (hierbas), recetas con madera buena, cristal
  para «obra maestra»; poner al día `MATERIALS` en `core/materials.ts`.
- **Juego cerrado:** sigue en `away.ts` como abierto (con la regla de los parajes).
- **Mapa** tres veces mayor con niebla que se despeja; parajes y fardos que quedan; récord por
  rumbo; objetivos nuevos.

## Bloques (estado)

| # | Bloque | Estado |
| --- | --- | --- |
| 1 | Núcleo (`core/expedition.ts`: la expedición, días, raciones, curva, sucesos sencillos, vuelta sola, juego cerrado, simulador) + hoja de preparar + visor básico + bosque | Hecho (#208) |
| 2 | Sucesos con decisión, cartas, opciones de clase, avisos, silenciar, guardianes y «Ver la pelea» | Hecho (#209) |
| 3 | Mapa grande con niebla, parajes, fardos perdidos, récords y objetivos | Hecho (#211; el dibujo del mapa, marcador hasta el del agente de arte) |
| 4 | Salida, vuelta, informe «La mochila», brillos por rareza y sonido | Hecho (#212) |
| 5 | Sierra, marismas y ruinas (antes, «En obras»); tiempo por rumbo; pociones y cristal en los talleres; carta del veterano y tutorial | Hecho (PR del bloque 5) |

## Bloque 1, cómo quedó

- **Núcleo:** `core/expedition.ts`. Corre por horas de juego (24 al día) y cada hora tira con su
  semilla: igual abierto que cerrado (test). Se pone al día en el reloj (`tick`) y al acabar el día
  (`endDay`, también con el juego cerrado). Guardado en `GameState.expeditions` y `expBest`
  (récord por rumbo); campos nuevos opcionales, sin cambiar `SAVE_VERSION`.
- **Reglas de ahora** (cifras `EXP_` en `balance.ts`): acampan a las 17 h y cenan una ración cada
  uno; siguen otro día si les queda para él y para la vuelta; si alguien cae (3 heridas) dan la
  vuelta; si caen todos, vuelve un tercio de la mochila. Sucesos: hallazgo (monedas o materiales
  del rumbo, más cuanto más lejos), pelea (fuerza media del grupo contra la lejanía; perder hiere),
  raciones de caza y camino. El clérigo cura de noche. En casa: experiencia por día fuera, heridas
  en días de enfermería, y quien cayó puede morir (`EXP_DOWN_DEATH`; con clérigo, a veces se salva).
- **Simplificado hasta el bloque 2:** las peleas aún no usan `core/fight.ts` (no hay «Ver la
  pelea»); no hay sucesos con decisión ni guardianes.
- **Visor básico:** `world/expeditionStrip.ts` reutiliza los dibujos de la tira de los encargos
  (andar, cojear, pelear, acampar, volver con el saco) con el paisaje que pasa y se oscurece con la
  lejanía. El bueno, del agente de arte.
- **Dónde se ve:** en el mapa, lista «Grupos fuera»: las expediciones y el botón «Nueva
  expedición» (`ui/ExpeditionSheet.tsx`); tocar una abre el visor (`ui/ExpeditionView.tsx`). En la
  escena, quien está fuera sale como «de expedición».
- **Simulador:** las estrategias que mandan grupos mandan también a los libres al bosque. Con la
  despensa justa del simulador salen pocas (una por partida); sin contratar, 7 días fuera, 5 de
  lejanía y unos 5 muertos cada 100 héroes.
- **Ojo:** con el juego cerrado corre un día por día real; una expedición de 6–9 días tarda casi
  una semana si no se abre el juego.

## Bloque 2, cómo quedó

- **Sucesos con decisión** (`data/expEvents.ts`): cofre, santuario, mercader, viajero,
  campamento abandonado, oso; parajes (cueva, atalaya, ruinas con runas) y el guardián. Cada
  opción puede pedir una clase (si no va nadie de esa clase en pie, sale tachada: «Haría falta un
  pícaro») y depender de un atributo. Lo que pasa al elegir, en `decide` (`core/expedition.ts`).
- **Esperan parados** (`Expedition.pending`; las horas paradas, `idle`, no cuentan para la
  lejanía): los encuentros hasta la noche, los parajes hasta un día, el guardián 12 horas (unos 3
  minutos abierto). Al acabar el plazo, eligen la prudente. Igual abierto que cerrado.
- **Carta en el visor** (`ui/ExpeditionCard.tsx`): cabecera (marcador hasta que llegue la
  ilustración del agente de arte), texto, opciones con la pista de riesgo en palabras («seguro»,
  «poco arriesgado», «arriesgado», «muy arriesgado», «depende de su Destreza»; sin explorador ni
  sala de mapas a nivel 2, menos fina) y barra del plazo. **Silenciar**: sin avisos y eligen ellos
  ya. **Avisos**: cada suceso y el guardián salen en los avisos de la barra.
- **Peleas con el motor común** (`core/combat.ts`, como jefes: los del bosque pelean como la bestia
  o el jabalí). Cada pelea, su enemigo más o menos fuerte (`EXP_FOE_SPREAD`) para que no esté
  decidida; ajustado (`EXP_FOE`) para ganar más o menos lo mismo que la tirada del bloque 1. Las
  heridas quitan vida al empezar. Todas se guardan en el diario y se ven con **«Ver la pelea»**
  (`BossFight` acepta enemigo, sitio y paisaje propios). El diario va también en el informe
  (`Report.exp`) para verlas al volver (la carta, en el bloque 4).
- **Viajero que se une**: pelea con ellos y, al volver, espera en la barra como candidato.
- **Objetos** (cueva, atalaya, ruinas, guardián): a la mochila y al arcón al volver.
- **Simulador**: no elige nunca (esperan al plazo y van con prudencia): sin contratar, 3,9 días de
  lejanía (antes 5) y ningún muerto en 60 partidas.

## Bloque 3, cómo quedó

- **Parajes que quedan** (`GameState.expSites`): cada cueva, atalaya o ruinas que sale se apunta
  en el mapa con su lejanía y un desvío a un lado del camino. Si siguieron de largo, la próxima
  expedición a ese rumbo vuelve a dar con él al pasar («Dan con una cueva que el gremio vio el día
  12 y dejó sin explorar») y puede entrar; si ya se entró, solo una línea al pasar.
- **Fardos perdidos** (`GameState.expBundles`, `dropBundle`): si caen todos, vuelve un tercio de la
  mochila y el resto (monedas, materiales y objetos) queda como fardo a esa lejanía; otra
  expedición al rumbo lo recoge al pasar (aviso en la barra). Como mucho `EXP_BUNDLES_MAX` (6).
- **Récord**: ya estaba por rumbo (`expBest`); ahora, al pasarlo, una línea en el diario («Llegan
  más lejos que nadie del gremio»).
- **Objetivos** (con las expediciones abiertas): completar expediciones (se repite), descubrir
  parajes (se repite) y llegar a 3, 5 y 8 días de lejanía (en serie). Contadores nuevos en
  `Stats` (`expeditions`, `expSites`, `expBundles`).
- **Mapa de rumbos** (`ui/ExpeditionMap.tsx`; en el mapa, botones «Comarca / Rumbos»): tres
  veces el de la comarca, con ella en medio; niebla que se despeja hasta el récord de cada rumbo y
  por donde van los de ahora; estela de cada expedición y la del récord; parajes (vistos o sin
  explorar), fardos (brillan) y el rótulo de cada rumbo con su récord. Se arrastra y se acerca;
  tocar algo abre su ficha; tocar un grupo, su visor.
- **Dibujo**: `art/expMap.ts` es un marcador (manchas de color por rumbo; niebla de nubes a color o
  rayada en pergamino). `expPoint(rumbo, días, lado)` es la geometría que usa la interfaz; el
  dibujo bueno del agente de arte puede sustituir `worldBuffer` y `worldFog` sin tocarla.
- **Arreglo**: con la expedición silenciada, los sucesos no se resolvían (se quedaban sin pasar
  nada); ahora deciden al momento con prudencia.
- **Simulador**: cuenta parajes y fardos. Sin contratar: 3,9 días de lejanía, 0,3 parajes y 0,1
  fardos por partida (igual que `main` en lo demás).

## Bloque 4, cómo quedó

- **Brillo por rareza** (EX18; `ExpLine.g`, `itemGlow`, `matGlow`, `ui/glow.ts`): común (oro y
  materiales), nada y un «tac»; bueno (objetos comunes), destello; raro (cristal y objetos de
  rareza 2), brillo azul; legendario (rareza 3 o más), dorado, pausa y fanfarria. La misma escala en
  el diario y la mochila del visor (también los objetos, con su dibujo), en el destello sobre la
  tira, en los avisos de la barra (lo raro y lo legendario se avisan: «Expedición al bosque: ¡algo
  legendario! …») y en «La mochila». Se calcula en el núcleo, igual abierto o cerrado.
- **Sonidos nuevos** (`audio.ts`): `tac`, `glint`, `shimmer` y `fanfare` (con vibración los dos
  últimos); la salida suena con el laúd de partida y el cuerno; la vuelta, con la ronda.
- **«La mochila»** (EX20; `ui/ExpBag.tsx`): la primera vez que se abre el informe de una
  expedición sale antes que la carta: lo que trajeron, como cartas boca abajo que se dan la vuelta
  de menos a más (lo legendario, el último, tras una pausa). Tocar el montón (o «Verlo todo») las
  vuelve todas. Luego, la carta con su botón «La mochila» y «Lo más destacado del diario» (peleas
  con «Ver la pelea» y hallazgos con brillo). El informe guarda rumbo, días, lejanía, récord y la
  mochila (`Report.exp`).
- **Salida en la escena** (EX13): unos 4 s antes de abrir el visor: la cámara se acerca y sigue
  al primero del grupo, los de casa que están de pie dan saltos, notas en la puerta y el cuerno.
  Se salta tocando la pantalla; con «Menos movimiento», nada (como antes). Falta lo que es dibujo:
  juntarse en la puerta con petates y salir por el patio (punto 8 del encargo de arte); en 4 s se
  les ve camino de la puerta, aún sin llegar al patio.
- **Vuelta** (EX20): si vuelven con el juego abierto y sin otra cosa en pantalla, la cámara les
  sigue al entrar por el patio y luego hay ronda en la barra. Los fardos que crecen con lo que
  traen son del agente de arte (punto 8).
- **Toca** `src/world` (`crowd.waveOff`, `RoomScene.farewell` y `farewellEnd`) y `App.tsx`.
- **Arte (nota del usuario, 23 nov):** el visor y el mapa tienen que verse bien de verdad, sin
  reaprovechar la tira de los encargos; quizá un visor propio más grande. El agente de arte
  plantea opciones antes de dibujar (apuntado en `arte-expediciones.md` y `plan-arte.md`).

## Bloque 5, cómo quedó

- **Los cuatro rumbos abiertos** (`OPEN_HEADINGS`): sierra, marismas y ruinas con sus líneas de
  camino y de noche, cuatro enemigos cada uno (con su familia para el visor y su jefe para el
  motor de peleas) y su guardián (Sierpe Blanca, Reina del Juncal, Dragona de Ceniza). El oso solo
  sale en el bosque y la sierra; el santuario y el guardián ya no dicen «bosque».
- **Tiempo por rumbo** (`expWeather`): cerca de casa (menos de `EXP_WEATHER_FROM` días), sin
  efecto; lejos, uno por día con su semilla. Bosque, lluvia o niebla; sierra, nieve o viento;
  marismas, niebla o lluvia; ruinas, polvo o tormenta seca. Lluvia, viento y tormenta les paran a
  ratos (`EXP_RAIN_SLOW`); niebla, polvo y tormenta tapan la pista, y la niebla trae más
  emboscadas (`EXP_FOG_AMBUSH`); la nieve gasta más raciones por la noche (`EXP_SNOW_EAT`). Línea
  en el diario al cambiar y un chip en el visor. El dibujo del tiempo es del agente de arte.
- **Pociones**: las hechas en la alquimia (`GameState.potions`) se llevan como las raciones; por
  la noche, una cura una herida del que está peor; las que sobran vuelven. Ver el pendiente.
- **Obra maestra**: un cuarto paso de mejora (+4) que pide además 1 de cristal.
- **Recetas nuevas** (de serie): hacha de roble (forja; madera y hierro), saquito de hierbas
  (alquimia; hierbas; el bueno da una segunda oportunidad) y varita de cristal (alquimia; cristal y
  madera). Los textos de los materiales dicen ya de dónde salen y qué los pide.
- **Carta del veterano** (EX24): con el primer veterano, al amanecer (si hay otro tutorial en
  marcha, espera), firmada por el de más nivel, con aviso grande. Al cerrarla, o la primera vez
  que se abre el mapa, un **tutorial corto de tres páginas** (`ui/ExpIntro.tsx`) que acaba en el
  mapa. Falta lo que es dibujo: el sello de mapa enrollado y el borde del mapa que se despliega.
- **Simulador**: reparte las expediciones entre los cuatro rumbos.

## Pendiente: las pociones las hace la alquimia (el usuario, 23 de noviembre)

Las pociones **solo existen si se han creado en la alquimia**, como la forja crea sus objetos.

- **Hecho (expediciones):** las expediciones solo llevan las que hay hechas
  (`GameState.potions`), y se dan en la hoja igual que las raciones. También se encuentran por el
  camino (`EXP_POTION_FIND` en los hallazgos), y las que sobran vuelven a la alquimia. Ya no se
  gastan hierbas al salir.
- **Falta (agente principal, talleres; encargo en [`pociones.md`](pociones.md)):** la receta de la poción en la alquimia: hierbas y su
  tiempo; al acabar, `s.potions++`, que se vea en la alquimia y en la despensa. Hasta entonces, sin
  pociones hechas, la hoja no enseña la fila de pociones.

## La vida que se guarda en las expediciones (parte 3, 25 de noviembre)

Con la vida que se guarda (`core/health.ts`, #219), las expediciones ya no cuentan heridas:

- **Peleas:** cada uno entra con su vida (`hpOf`) y sale con la que le quede, aunque la mitad de lo
  perdido son golpes que se pasan (`EXP_FIGHT_WEAR`). Quien cae queda grave; si ya iba grave, al
  suelo (a 0, le llevan). Si pierden, uno más se lleva un golpe (`EXP_LOSS_HP`), sin tumbarle.
  Un suceso que sale mal quita `EXP_EVENT_HP`.
- **Avisos y vuelta:** en cuanto alguien baja del 50 % hay línea en el diario y aviso en la barra
  («quizá convenga volver»). Grave (de ida), dan la vuelta.
- **Más despacio con heridos:** cada hora, por cada leve `EXP_SLOW_LIGHT` y por cada grave
  `EXP_SLOW_GRAVE` de no avanzar (`hurtSlow`).
- **Curarse fuera:** de noche, al acampar, los que cenan recuperan `EXP_CAMP_HEAL`; el clérigo,
  a veces, `EXP_CLERIC_HP` al que está peor. Una poción, si alguien baja del 50 %, da
  `EXP_POTION_HP`. El santuario también cura vida.
- **Al volver:** cada uno con la vida que trae (en pie o a la cama, `setHp`). Quien llega en el
  suelo puede morir, como antes (`EXP_DOWN_DEATH`, con el clérigo que salva); si no, grave. Se
  quita el apaño de `EXP_HURT_HP_LOSS`, que solo queda para pasar las partidas de antes
  (`legacyHurt`).
- **Barra de vida bajo el retrato** (`ui/LifeBar.tsx`), en el visor y en la hoja: marcas del 20 y
  del 50 %, y «Sano / Herido leve / Herido grave · n %» o «En el suelo».
- **Simulador** (sin contratar): 1,8 muertos por cada 100 héroes (antes 2,6) y 2,7 días de
  lejanía (antes 3,6): con heridos vuelven antes.

## Rumbos que se abren por turnos (decidido con el usuario, 25 de noviembre)

- El bosque, de entrada. La sierra se abre al volver de una expedición que llegó a **5 días** de
  lejanía en el bosque; las marismas, a **6** en la sierra; las ruinas, a **7** en las marismas
  (`EXP_UNLOCK`, `headingOpen`). Cuenta el récord del rumbo anterior (`expBest`). En partidas de
  antes, un rumbo al que ya se fue sigue abierto.
- **Cerrado:** en la hoja, la carta del rumbo con candado y «Llega a 5 días en el bosque (récord:
  3,4)»; en el mapa de rumbos, su rótulo con candado y la ficha lo mismo.
- **Al abrirse:** chapa en el informe («¡Nuevo rumbo: la sierra!») y aviso grande en la barra.
- **Enemigos propios por rumbo:** los dibuja el agente «Arte de expediciones». Cuando tenga los
  jefes nuevos, se cambian `FOE_BOSS`, `GUARDIAN_BOSS` y `HEADING_FOES` en `core/expedition.ts`
  (los puede tocar él mismo y avisar, o pedírmelo).

## Jefes a la vista y pociones a mano (usuario, 25 de noviembre; B11 de «Rumbos del visor»)

- **Un jefe a la vista** (suceso `jefe`): cuando la pelea es contra el enemigo grande del rumbo (el
  último de `expediciones.enemigos.<rumbo>`), con `EXP_BOSS_SEEN` lo ven de lejos (de ida) y se
  paran hasta el día siguiente. Opciones: **pelear en directo** (se abre la pelea), **que peleen
  solos** (queda en el diario con «Ver la pelea»; es lo que hacen si nadie dice nada) e
  **intentar rodearlo** (Destreza; si sale mal, uno pierde `EXP_ESCAPE_HP`, y si ya iba grave
  puede caer). Pelea por `EXP_BOSS_MULT`.
- **El guardián**, igual: pelear en directo, que peleen solos (sin respuesta) o escabullirse y
  volver (con el mismo riesgo). Espera hasta el día siguiente (`EXP_GUARDIAN_WAIT`).
- **Pociones a mano** (acción `drink`): en el visor, un botón «Poción» bajo cada uno al que le
  falte vida (de las que llevan); en la hoja, «Poción para X» de las de la alquimia, antes de
  salir. Siguen usándose solas de noche al que está peor.
- Falta el dibujo del grupo parado mirando al jefe (agente «Arte de expediciones»).

## Pulido tras jugar (usuario, 25 de noviembre)

- **El frasco** (`potionIcon`, `ui/PotionIcon.tsx`) en la hoja, el visor, «La mochila» y la
  chapa del informe, en lugar de la hierba.
- **El visor enseña las pociones** que llevan; tocarlas da una al que está peor.
- **Poción tras una pelea:** quien acaba por debajo de `EXP_POTION_AFTER` (grave o en el suelo)
  bebe una al momento, si llevan (el peor primero), con su línea en el diario.
- **«La mochila» sale sola** al volver con el juego abierto: tras verles entrar, en cuanto no haya
  nada abierto (panel, pelea, ficha…).
- **Parados con un suceso esperando** (`MarchMode` `wait`): en el visor, quietos, de pie, sin
  andar.

## Depende de otros

- **Agente principal:** las pociones como trabajo de la alquimia (ver «Pendiente: las
  pociones» arriba); veteranía a nivel 8 (y maestro, nivel máximo), caché sin pagar, un día
  cada 24 h con el juego cerrado, repetir tutoriales desde Ajustes (ver `decisiones.md`, bloque 8,
  «Para el agente principal»).
- **Agente de arte:** el visor por rumbo, el mapa grande y lo demás de
  [`arte-expediciones.md`](arte-expediciones.md).
