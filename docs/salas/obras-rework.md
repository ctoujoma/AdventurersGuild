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

## Preguntas para el usuario

1. **¿Pago al momento con deshacer (A)** o mantener el borrador que se paga al final?
2. **¿Mover salas arrastrando (D)** o quitar mover, como Fallout Shelter (tirar y reconstruir)?
3. **¿Construir solo junto a lo que ya hay**, como Fallout Shelter, o en cualquier hueco con paso?
4. **Escaleras por tramos (E):** ¿con límite o solo con precio creciente?
5. ¿Las obras siguen tardando una noche, o se ven levantar en el momento (unos segundos, como en
   el día vivo)?

## Orden sugerido para programar

1. Núcleo: obras inmediatas con pila de deshacer; validación de salir del modo obras; mudanza que
   no bloquea; tests.
2. Escena: casillas fantasma de ampliar, menú-icono junto a la sala, mover arrastrando.
3. Escaleras por tramos (modelo, caminos, geometría, asaltos) con sus tests.
4. Cinta con pestañas e iconos de sala; sonidos y efectos.
5. Probar con el usuario en la versión de pruebas y después volver al arte (PR 11).
