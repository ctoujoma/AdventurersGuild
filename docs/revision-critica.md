# Revisión crítica antes de las expediciones (8 de noviembre)

Barrido general del juego: fallos, comodidad de lo que más hace el jugador, fichas que no
explican lo que hacen, sistemas a medias y textos. Hecho leyendo el código, jugando en el
navegador y con **una partida de verdad del usuario** (día 219, modo libre, rango Leyenda), que
enseña cosas que una partida preparada no enseña. Cada punto dice dónde mirar.

## Lo más importante (por orden)

1. **«Sugerir» falla en los encargos difíciles** y los hace parecer imposibles (punto 1.1).
2. **El gremio funciona sin mandar a nadie de aventuras**: la taberna lo paga todo, la fama sube
   igual y la dificultad de los encargos sube con la fama, no con los héroes (punto 2).
3. **Equipo olvidado en el arcón**: en la partida del usuario hay un legendario sin usar y nadie
   lleva arma (punto 3.1).
4. **Media casa no dice qué da mejorarla** (pintor, sastrería, alquimia, cocina, bodega,
   despensa, servicio, recibidor…) y la forja dice algo falso (punto 4).
5. **Cuatro maneras distintas de resolver una pelea** (encargos, jefes, asaltos, ladrón): mejor
   un solo motor antes de que las expediciones traigan la quinta (punto 6).
6. Fallos sueltos: la sastrería se queda bloqueada para siempre, la experiencia de los asaltos
   se queda en 99, textos de los asaltos con la concordancia mal… (punto 1).

## Lo que dice la partida del usuario (día 219)

| Dato | Valor | Lectura |
| --- | --- | --- |
| Encargos mandados | 12 en 219 días | El bucle central casi no se usa. |
| Fama / rango | 638 / Leyenda | Ha subido con el salón, los nobles y los asaltos, no con encargos. |
| Nivel de los héroes | 13 héroes: uno de nivel 6, ocho de nivel 4 o menos, cinco de nivel 1–2 | Los encargos de Leyenda les vienen grandes. |
| Héroes con 99 de experiencia | 5 | Topados por los asaltos (punto 1.3). |
| De guardia | 4 de 13, siempre | Nunca salen; guardar no cuesta nada. |
| Héroes trabajando de camareros, bodega y forja | 3 | Les sobra el tiempo. |
| Moral | 100 todos | No hay presión. |
| Salarios / taberna | 399 por semana / unas 600 | La taberna lo paga todo sin aventuras. |
| Armas puestas | 0 de 13 | Y en el arcón, la Hoja de Vadoverde (legendaria, +3 Combate). |
| Materiales | hierro 0, cuero 2, tela 2 (almacén a nivel 3) | Sin encargos no hay materiales. |
| Establo, patio y empalizada | a 0 | Están al final de Gremio › Salas › Fuera: no se ven. |
| Salón | nivel 1 (3 × 2) | Mejorarlo cuesta el triple por el recargo de tamaño (750, 1.350, 2.250). |
| Informes | 30 guardados, 20 sin leer | Ni se leen ni se borran. |

## 1. Fallos

### 1.1 «Sugerir» propone a uno solo con un 0 %

`core/suggest.ts` va sumando al héroe que más sube la probabilidad y para cuando nadie la sube
al menos 2 puntos (`GAIN`). En un encargo con tres pruebas, uno solo falla dos y se queda en el
5 % de cada una; el segundo tampoco las cubre todas y sube menos de 2 puntos. Así que se para con
uno y dice «Suicida». Con la partida del usuario (el mejor grupo, probando todas las
combinaciones):

| Encargo | Sugerir | El mejor grupo |
| --- | --- | --- |
| El sótano del alquimista (C43 A24 T19) | 0 % (1 héroe) | 86 % (Sancha, Adela, Dulce, Greta) |
| Más allá de los riscos (S47 T25 A20) | 0 % (1) | 63 % (4) |
| Las joyas de la viuda (T36 C21 S17) | 37 % (3) | 86 % (3) |
| Velas negras en el granero (A24 T14, paso de historia) | 4 % (1) | 30 % (Sancha y Aldonza) |

**Arreglo:** probar todas las combinaciones. Con 13 héroes y 4 plazas son 1.092 grupos como
mucho: es inmediato. Añadir un test con un encargo de tres pruebas.

### 1.2 Vestir a alguien que se va deja la sastrería bloqueada

Si se despide al héroe (o deserta, o muere) mientras le cosen, el trabajo se queda en
`s.crafts` para siempre: `craftRate` da 0 porque el héroe ya no está, y si aún iba de camino
(`wait`) nadie dirá nunca que ha llegado. Con la sastrería a nivel 1 o 2 solo hay un hueco: deja
de crear y de vestir hasta cancelarlo a mano. **Arreglo:** en `stepCrafts`, si el héroe ya no
está, cancelar y devolver el oro; y avisar al mandar de encargo a alguien al que le están cosiendo.

### 1.3 La experiencia de los asaltos se queda en 99

`core/raids.ts` da 15 de experiencia a quien defiende, pero con tope de 99 (`Math.min(99, …)`)
para que nadie suba de nivel sin encargos. El patio de entrenamiento, en cambio, sí sube de nivel
(`levelUp`). Resultado: héroes que llevan meses a un punto de subir. **Decidir:** o se sube de
nivel también defendiendo, o no se da experiencia y se dice.

### 1.4 Textos de los asaltos con la concordancia mal

Tres de las seis bandas son plurales (`data/raids.ts`): «había llegado los Hermanos Cuervo»,
«Era las Ratas del Vado», «los Lobos de Hondogrís huía camino abajo». **Arreglo:** cada banda
con su número (`{ name, plural }`) y huecos `{llegó}`/`{huía}`, o frases que no conjuguen.
Lo mismo en otros informes: «la mina vieja era…» (minúscula al empezar), «Alcaldía de Hondogrís
dijo…» (sin artículo), «Berta, posadera juraba» (falta una coma).

### 1.5 La forja dice algo que no hace

`FACILITY_INFO.forja` (`data/labels.ts`): «+2 al objeto que lleva puesto cada héroe». En el
núcleo (`gearOf`, `core/resolve.ts`) solo suma al **arma**, y solo si lleva una. Tampoco dice nada
de lo que da como taller (trabajos a la vez, probabilidad de sacarlo raro, de sacar la receta al
desmontar). Ver punto 4.

### 1.6 Más pequeños

- **Valor de venta:** la Hoja de Vadoverde (legendaria) vale 120 y un escudo raro 150: el botín
  se escala con el rango al salir (`generate.ts`) y el noble lo sube a 150 como mínimo
  (`events.ts`), pero los legendarios de las historias no. El mismo objeto vale 50 o 150 según
  cuándo salió.
- **Los informes no tienen tope** (`s.reports.unshift`): la partida del usuario guarda 30, con
  peleas enteras dentro; el guardado crece sin fin. Guardar los últimos 30 o 50.
- **Código muerto:** la rama de `GremioPanel` sin `obras` (con la forja y la torre en «Fuera»)
  no se usa nunca. Comentarios huérfanos encima de `gearOf` (`core/resolve.ts`).
- **El tutorial de obras acabado** se queda en el guardado (`tutorial.step` 8 de 8). Inofensivo.
- **Variedad:** frases de héroes y trabajadores muy repetidas («¿A quién hay que pegar?» tres
  veces; «Me han dicho que aquí se come bien» cuatro); dos encargos con el mismo título a la vez
  en el tablón («El sótano del alquimista»).

## 2. El bucle de los encargos

Es lo que más pesa antes de las expediciones, que son la versión larga de lo mismo.

- **La dificultad sube con la fama, no con los héroes** (`generateQuest`: `perHero(rank)`). La
  fama sube también con el salón, los nobles y los asaltos ganados, así que el tablón se pone en
  Leyenda con héroes de nivel 1–4. Propuesta: que cada tablón traiga de todo (uno fácil, uno a su
  medida, uno difícil), midiendo a los héroes que hay en casa, y que el rango suba el techo, no
  el suelo.
- **Ni rastro de lo factible en el tablón:** la tarjeta dice peligro, plazas y paga, pero no si
  hay grupo para hacerlo. Con «Sugerir» arreglado, la tarjeta podría decir «Pan comido» o
  «Arriesgado» con el mejor grupo de casa.
- **No hace falta aventurar:** la taberna (unas 600 a la semana) paga los salarios (399) y todos
  están a 100 de moral. Ideas para que los héroes quieran salir: moral que baja si se pasan
  muchos días sin salir (los aventureros se aburren), sueldo o fama que solo dan los encargos,
  o la amenaza regional (`threat`, 59 en la partida) con consecuencias que se vean.
- **La guardia es gratis y para siempre:** 4 de 13 nunca salen. Turnos, cansancio o que la
  guardia cuente como trabajo (sin entrenar ni moral extra).
- **El patio de entrenamiento, el establo y la empalizada** no se ven: están en la lista de
  Gremio › Salas, debajo del todo. Sacarlos a la escena (el patio delante de la taberna) o al
  menos a un objetivo.
- **Materiales:** con 12 encargos no hay hierro ni cuero, y las recetas buenas y las mejoras los
  piden. Las expediciones lo arreglan solo si se mandan; los encargos normales deberían seguir
  trayendo algo.

## 3. Comodidad de lo que más se hace

### 3.1 Equipar

Bien resuelto en la ficha (muñeco con tres ranuras, comparación antes de ponérselo) y en el arcón
(«Dar a…»). Falta:

- **Aviso** cuando hay en el arcón algo mejor que lo que lleva alguien (o algo para una ranura
  vacía). Hoy no existe (`ui/alerts.ts`).
- **Equipar desde la hoja del encargo:** al formar el grupo es cuando importa; un botón «Lo
  mejor del arcón» para el grupo elegido.

### 3.2 Mandar a alguien

- «Sugerir» (punto 1.1) y la dificultad del tablón (punto 2).
- «Como la última vez» está bien; con historias guarda el grupo de cada una.

### 3.3 Tareas, salas y talleres

- Poner a alguien en una sala desde su ficha o arrastrando funciona. En la ficha de la sala, cada
  hueco libre repite la lista entera de gente: con varios huecos libres la ficha se alarga.
- **Informes sin leer:** se acumulan (20 en la partida). Un «Leído todo» en el correo, o que los
  de asaltos ganados sin heridos se den por leídos.
- **Talleres:** «Sale de las buenas 8 % de las veces» y, debajo, «Raro: …». Desde las cinco
  rarezas, **«bueno» es otra rareza (la verde)**: decir «Sale raro el 8 %» (`WorkshopInfo.tsx`,
  aviso de `crafting.ts`).

## 4. Fichas de sala: qué da cada nivel

Solo las salas que eran instalaciones (`fac`) tienen la línea «Mejora: …» (`FACILITY_INFO`); la
cámara y el almacén tienen la suya. El resto no dice qué gana el jugador al pagar.

| Sala | Qué da subir de nivel (núcleo) | ¿Lo dice la ficha? |
| --- | --- | --- |
| Recibidor | Puerta 2 / 5 / 8 / 12 s | Solo la cifra de ahora |
| Salón | +2 de Atractivo, +1 encargo (hasta nivel 2), mejores candidatos (2 y 4), más moral y tope, más adornos | Sí; «más encargos» también en 3 y 4, y ya no da |
| Cocina, bodega | Producción ×(0,75 + 0,25 · nivel) y guardan más | **No** |
| Despensa | 30 raciones por hueco y nivel | **No** |
| Cámara del tesoro | Oro y cerradura | Sí |
| Dormitorio, enfermería, capilla, veteranos, torre, armería | — | Sí |
| Sala de mapas | Encargos, peligro real; también +15 % de chivatazo | Casi (falta el chivatazo) |
| Forja | +nivel al **arma**; trabajos a la vez, raro y receta | **Mal** (punto 1.5) |
| Servicio | 2 camas por hueco y nivel | **No** |
| Armas, tiro, biblioteca | Tope 5 / 7 / 9 / 11 y ritmo | Solo manteniendo pulsado |
| Sastrería, alquimia | Trabajos a la vez 1 / 1 / 2, raro 15–35 %, receta 50–70 % | **No** |
| Taller del pintor | Pintores a la vez 1 / 1 / 2 y ritmo +25 % por nivel | **No** (el nivel 2 solo da ritmo) |
| Almacén | Materiales por hueco y nivel | Sí |

**Arreglo:** una tabla de datos con `effect(nivel)` para **todas** las salas (como
`FACILITY_INFO`), que la ficha enseñe «Ahora: …» y «Mejora: …» siempre igual, y un test que
falle si una sala con más de un nivel no tiene texto. Así no vuelve a pasar con las salas nuevas.

### El salón (nota del usuario)

- **El botón «Mejorar» queda al final de la ficha**, debajo de los puestos, los colores y las
  obras: en el salón hay que bajar mucho y el usuario no lo vio en 200 días. Ponerlo arriba,
  junto a los puntos del nivel (en todas las salas).
- **Doble altura (3 × 2) frente a 3 × 1:** la segunda planta da +2 de Atractivo (lo mismo que un
  nivel) y el doble de puestos (12 en vez de 6), pero las plazas (mesas) salen solo del ancho
  (`seatsOf`: 10 en los dos). Y cada mejora cuesta el doble, porque el recargo cuenta los 6 huecos
  (×3) en vez de 3 (×1,5): el nivel 2 cuesta 750 en lugar de 375 y el 4, 2.250 en lugar de 1.125.
  Con 4 camareros, los puestos de más no sirven. Nada de esto se explica. Propuesta: que la altura
  no cuente en el recargo del salón, o que la planta de arriba dé plazas (un altillo con mesas), y
  que la ficha lo diga.
- **De nivel en nivel, el salón casi no cambia de aspecto** (para el agente de arte,
  `plan-arte.md`): la descripción de cada nivel promete manteles, laúd, candelabros y barra dorada.

## 5. Sistemas a medias

- **Materiales raros sin fuente:** hierbas, madera buena y cristal solo «salen en las
  expediciones». Mejorar un amuleto pide hierbas y una varita madera (`ICON_MATERIAL`), así que
  **la alquimia no puede mejorar nada**. Los textos de usos (`MATERIALS`) prometen cosas que no
  existen: «pociones», «las hachas piden madera» (no la piden), «el cristal lo pide lo mejor de
  cada taller» (nada lo pide).
- **Alquimia:** la sala más cara (220 / 420 / 700, rango de plata) y la que menos da: dos
  recetas, ninguna buena con materiales, y no puede mejorar.
- **Sastrería y pintor:** solo aspecto (y moral al estrenar ropa). Está bien si es lo buscado,
  pero que la ficha lo diga.
- **Expediciones:** ya se anuncian al jugador («Salen en las expediciones») y existe
  `EXPEDITION_LEVEL`, pero no hay nada detrás.
- **Premios de serie:** en `data/unlocks.ts` hay piezas «de momento de serie (falta decidir de
  qué hazaña u objetivo salen)».
- **Historias:** al acabarlas no llegan más (ya en el plan).
- **Documentación desfasada:** `docs/salas/README.md` dice que la sastrería está «preparada, sin
  sala todavía» y aún trae el plan de 12 PR como estado.

## 6. Pelea: un solo motor

Hoy hay cuatro maneras de resolver una pelea, y las expediciones traerían la quinta:

| Pelea | Dónde | Cómo |
| --- | --- | --- |
| Encargos | `core/resolve.ts` | Tiradas por habilidad contra la dificultad |
| Jefes | `core/combat.ts` (`runCombat`) | Unidades con vida, golpes, habilidad, críticos, aviso y «¡Cubríos!» |
| Asaltos | `core/assault.ts` (unas 870 líneas) | Bucle propio: defensores y bandidos por las salas, puerta, cerradura y sacos |
| Ladrón | `core/incidents.ts` (`thiefDuel`) | Un tercer bucle, más simple |

Comparten `heroUnit`, `ABILITIES` y las constantes del crítico; nada más. Cada una tiene sus
tipos (`Unit` / `Defender` y `Bandit` / el ladrón), sus órdenes (blanco, habilidad, cubrirse,
crítico / mover por salas), su registro para la escena (`CombatEvent` / `RaidStep` / `DuelHit`),
su escena (`world/battle.ts`, 2.200 líneas / `world/rooms/raid.ts`, 900) y su interfaz
(`BossFight.tsx` / `RaidCrew.tsx`). Un cambio de equilibrio o una habilidad nueva hay que hacerlo
dos o tres veces, y no pelean igual.

**Propuesta: `core/fight.ts`, un motor con:**

- **Unidades** de un solo tipo: héroes (`heroUnit`), jefes y esbirros (`foeUnits`), bandidos,
  ladrón y trabajadores (que no corren a pelear).
- **Un mapa:** un solo sitio para el jefe y el ladrón; el grafo de salas para el asalto. El jefe
  es un asalto en una sala; el ladrón, un bandido que huye con reloj.
- **Un paso común:** golpes, habilidades con recarga, críticos con gesto, aviso del golpe fuerte
  y cubrirse (en el asalto también: el cabecilla de la banda avisa).
- **Unas órdenes:** blanco, habilidad, cubrirse, crítico y mover. Las de mover solo valen con mapa
  de salas.
- **Un registro** que leen las dos escenas (el dibujo sigue siendo distinto: arena y taberna).
- Los encargos normales siguen con tiradas (son rápidos y se resuelven solos), calibradas contra
  el motor con `npm run calib`, como ya se hace con los jefes.

**Pasos:** (1) sacar el paso común con tests que comprueben que jefes y asaltos dan lo mismo que
ahora con semillas guardadas; (2) pasar el ladrón; (3) una barra de habilidades para
`BossFight` y `RaidCrew`; (4) las escenas leen el mismo registro. Ojo: los informes viejos
guardan la pelea (`fight.sim`) para repetirla; hay que seguir pudiendo repetirlas (guardar la
versión del motor o el registro ya jugado). Las peleas de las expediciones, el torneo y los
amigos saldrían ya de aquí.

## 7. Orden recomendado antes de las expediciones

1. «Sugerir» con todas las combinaciones (pequeño, mucho efecto).
2. Fallos 1.2 a 1.5 (sastrería, experiencia, textos de asaltos, forja).
3. «Mejora: …» en todas las salas, con su test, y el botón de mejorar arriba (punto 4).
4. Aviso de equipo mejor en el arcón y «Lo mejor del arcón» en la hoja del encargo.
5. Tablón con dificultad a la medida de los héroes y la probabilidad en la tarjeta; decidir qué
   empuja a aventurar (punto 2).
6. Motor de pelea único (punto 6).
7. Expediciones, que además traen los materiales raros y arreglan la alquimia.
