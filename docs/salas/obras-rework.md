# Rehacer las obras: propuesta

Las obras (construir, ampliar, mover, excavar, escaleras) son una parte central de cómo se siente
el juego, y ahora mismo confunden. Este documento recoge lo que falla, cómo lo resuelve Fallout
Shelter y una propuesta para rehacerlo. **Antes de programar hay que cerrar con el usuario las
preguntas del final.**

## Qué falla ahora (pruebas del usuario)

1. **Dos modos que se mezclan.** Hay un modo obras (martillo, cinta de salas abajo) y un «modo
   plano» (borrador que se paga al final). No se sabe en cuál se está ni qué se ha pagado.
2. **Mover una sala dos veces no se puede.** En el plano, mover deja la sala con
   `works: {kind: 'move'}`, y `planMove` responde «Espera a que acabe la obra» si la sala ya
   tiene obra (`src/core/rooms.ts`). Lo mismo pasa al ampliar después de mover.
3. **El salón no se amplía hacia arriba.** Solo se puede si los huecos de encima están libres, y
   en la taberna del tío encima del salón está el dormitorio. Además no hay ninguna pista de
   dónde tocar: falta una indicación visual en la propia escena.
4. **La ficha de la sala** pone los botones de obra (ampliar, mover, tirar) al final, como texto y
   en varias filas. Debería haber botones-icono cerca de la sala.
5. **Escaleras rígidas:** como mucho 2, y cada una va de la planta más honda a la más alta en una
   columna entre huecos (`Building.stairs: number[]`, `MAX_STAIRS`). No se pueden poner libremente.
6. **Salas únicas** (salón, cámara, recibidor): ya salen en la cinta como «Ampliar» (#23), pero
   ampliar, mover o recolocar sigue sin ser intuitivo.

## Cómo lo hace Fallout Shelter

- **Un solo modo de construir.** Martillo → abajo, una tira de tarjetas de salas (icono, nombre,
  precio; las bloqueadas, en gris con el motivo). Al elegir una, **brillan en la escena los sitios
  válidos**; al tocar uno, se paga y la sala aparece. No hay borrador ni «pagar al final».
- **Solo junto a lo que hay:** cada sala nueva va pegada a otra sala o a un ascensor, así que nunca
  hay salas sin paso.
- **Fusión automática:** construir al lado de una igual (mismo nivel) la junta, hasta 3 de ancho.
- **Ascensores por tramos:** se construyen igual que las salas, un hueco cada vez, en cualquier
  columna, y conectan plantas. No hay límite fijo.
- **Tocar una sala:** sale una tarjeta con su nivel, la mejora (con precio) y, en el modo
  construir, la papelera (solo si está vacía y no deja nada colgando).
- **No hay mover:** para cambiar algo de sitio se derriba (se recupera una parte) y se vuelve a
  construir.
- **Mucho «feel»:** sonido al colocar, polvo, el precio que se descuenta, la sala que se levanta
  en un momento y animaciones cortas.

## Propuesta

### A. Un solo modo obras, con pago al momento y «deshacer»

- El martillo entra en el modo obras. Todo lo que se hace se paga en ese momento.
- Mientras se está en el modo obras, el botón **Deshacer** devuelve la última obra y su dinero
  (toda la pila desde que se entró). Al salir, queda hecho.
- Si una obra deja salas sin paso o falta una obligatoria, esas salas se marcan en rojo y **no se
  puede salir** del modo obras hasta arreglarlo (o deshacer). Es lo que hoy hace el plano, sin
  que haya un segundo modo.
- Se quita el «modo plano» como modo aparte.

### B. Menú de sala con botones-icono junto a la sala

En el modo obras, al tocar una sala aparecen, pegados a ella, botones grandes con icono:
**Mejorar** (con precio), **Mover**, **Tirar** e **Info**. Fuera del modo obras, la ficha de la
sala solo informa y deja mejorar.

### C. Ampliar con casillas fantasma

Con una sala elegida, en la escena aparecen casillas fantasma con un «+» y el precio a los lados
y, si la sala puede crecer en alto (el salón), encima. Al tocar una, se amplía. Si no hay sitio,
la casilla sale tachada con el motivo («Encima está el dormitorio»).

### D. Mover arrastrando

Se coge la sala con el dedo (como a los personajes): mientras se arrastra, los sitios válidos
brillan en verde y los demás en rojo; al soltarla, se muda y se paga. Se puede mover otra vez al
momento. La obra de mudanza deja de bloquear otras obras de esa sala.

### E. Escaleras por tramos

Cada tramo une dos plantas en una columna entre huecos, y se construye desde la cinta como una
sala, tocando sitios válidos en la escena. Sin el límite de 2; el precio sube con cada tramo.
Cambia el modelo (`Building.stairs` pasa de columnas enteras a tramos), los caminos
(`people.ts`, `assault.ts`) y la geometría (`layout.ts`). Se sube `SAVE_VERSION`.

### F. La cinta de obras

Tarjetas con el icono de la sala y el precio, agrupadas en pestañas (Comida y bebida, Gente,
Entrenamiento, Defensa y tesoro, Otras). Las únicas que ya están salen como «Ampliar». Excavar y
comprar solar: casillas fantasma siempre visibles en el modo obras (como ya hace el pico).

### G. Sensación

Sonido distinto para colocar, ampliar, mover y tirar; polvo y monedas; el precio que sube
flotando («−120»); el andamio que dura un instante; vibración en el móvil.

## Decisiones (respuestas del usuario, 19-10)

1. **Borrador que se paga al final**, por poder reordenar la taberna del tío. Para que no haya
   dos modos: **el modo obras es el borrador**. Todo lo que se hace en él se apila (con su coste
   sumado en la barra), «Deshacer» quita lo último, «Pagar» lo hace de verdad y «Salir» sin pagar
   pregunta si se descarta. Mientras falte algo (salas sin paso, una obligatoria quitada o no
   llegue el oro), «Pagar» está desactivado y dice por qué. Esto sustituye a la propuesta A.
2. **Mover arrastrando, sí** (propuesta D): es una ventaja porque las salas únicas ya vienen
   puestas desde el principio. Mover varias veces la misma sala en el borrador tiene que poder.
3. **En cualquier hueco que tenga paso** (no solo pegado a lo que ya hay).
4. **Escaleras por tramos sin límite**, solo con precio creciente, como Fallout Shelter.
5. **Tiempo de obra: propuesta pendiente de confirmar.** Recomendación: al pagar, las obras se
   levantan en unos segundos a la vista (andamio, polvo y martillazos, 2–3 s por sala) y quedan
   listas ese mismo día; el freno es el precio, no la espera. Si el usuario prefiere algo más
   lento, una hora del día vivo por hueco.

Con esto, la propuesta queda: borrador = modo obras (1), menú-icono junto a la sala (B),
casillas fantasma para ampliar (C), mover arrastrando (D), escaleras por tramos (E), cinta con
pestañas (F) y sensación (G).

## Orden sugerido para programar

1. Núcleo: el borrador como única forma de hacer obras (pila con deshacer, coste total, motivos
   que impiden pagar), obras que no bloquean otras obras de la misma sala dentro del borrador,
   construir en cualquier hueco con paso, obras al momento al pagar; tests.
2. Escena: casillas fantasma de ampliar, menú-icono junto a la sala, mover arrastrando.
3. Escaleras por tramos (modelo, caminos, geometría, asaltos) con sus tests.
4. Cinta con pestañas e iconos de sala; sonidos y efectos.
5. Probar con el usuario en la versión de pruebas y después volver al arte (PR 11).

## Progreso (se marca al terminar cada punto; si te cortas, sigue por el primero sin marcar)

Rama: `claude/sharp-mendel-apsm2a` (PR #23 abierto contra `salas`). Cada punto, un commit.

### 1. Núcleo

- [x] 1.1 Obras al momento: construir, ampliar y mover ya no dejan `works` (ni noches); quedan
      hechas al pagar. `stepWorks` se queda solo para partidas viejas.
- [x] 1.2 Borrador (`tryWorks`): las salas nuevas del borrador se tiran devolviendo todo lo
      gastado y se mueven gratis; una sala ya movida en el borrador no vuelve a pagar mudanza;
      en el borrador no se mira el oro paso a paso, y `planIssue` dice «Te faltan N monedas».
- [x] 1.3 Tests del núcleo al día (rooms, works, game) y tests nuevos de lo anterior.

### 2. Interfaz y escena

- [x] 2.1 Un solo modo obras = borrador: el martillo abre el borrador; «Deshacer», «Pagar»
      (desactivado con el motivo) y «Salir» (pregunta si descarta). Fuera de obras, la ficha de
      sala solo informa y deja mejorar. Se quita el camino de obras sueltas (`confirm`, `chosen`).
- [x] 2.2 Menú-icono junto a la sala elegida en el modo obras: mejorar (precio), mover, tirar,
      info.
- [x] 2.3 Casillas fantasma «+» para ampliar (lados y encima si cabe en alto), tachadas con
      motivo si no hay sitio.
- [x] 2.4 Mover arrastrando la sala (verde/rojo bajo el dedo) dentro del borrador: con la sala
      elegida, se coge con el dedo y salen sus sitios; soltar fuera la deja donde estaba.
- [x] 2.5 Al pagar: andamio, polvo y martillazos 2–3 s en cada sala tocada (`RoomScene.raise`,
      `touchedRooms` en `ui/works.ts`; sonido `hammer`).

### 3. Escaleras por tramos

- [x] 3.1 Modelo: `Building.stairs` → tramos `{ at, floor }` (une `floor` y `floor + 1` en la
      columna `at`). La columna de escalera existe si tiene algún tramo. `SAVE_VERSION` 4.
- [x] 3.2 Reglas: rellano donde llega un tramo; sin tramo y con sala a los dos lados, la columna
      es un **pasillo** (se pasa; así poner escalera nunca corta caminos). Cada tramo sale de
      una sala, un hueco excavado u otro tramo. Excavar junto al rellano de más abajo baja la
      escalera un tramo (y lo cobra). Sin límite; precio `STAIR_COST + STAIR_STEP × tramos`.
      Caminos (`people.ts`), asaltos (`assault.ts`), geometría (`layout.ts`: `Shaft` con
      `flights`, `floors`, `halls`) y texturas (`stairCells` con `steps`). Tests.
- [x] 3.3 Tramos desde la cinta («Escalera», con su precio): cada tramo es una casilla en la
      escena (de medio rellano a medio rellano) y se encadenan sin salir de la elección.

### 4. Cinta y sensación

- [ ] 4.1 Cinta con pestañas e iconos de sala; las únicas como «Ampliar».
- [ ] 4.2 Sonidos por tipo de obra, precio flotando, vibración.
- [ ] 4.3 Probar en el navegador, publicar la versión de pruebas y actualizar `README.md`.
