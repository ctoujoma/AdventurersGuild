# Auditoría de calidad y «juice» (noviembre de 2026)

Una vuelta por el juego para ver qué se puede mejorar en el arte, las animaciones y la sensación
al jugar. Va de lo que más se nota a lo que menos, con dónde está cada cosa en el código. Lo
marcado con ⭐ es lo que más luce para lo que cuesta.

Ya arreglado en este PR: **al hacer zoom, las montañas se movían de sitio.** El paralaje iba
por el borde de la vista (que se mueve al hacer zoom) y ahora va por el centro (`pan` en
`world/rooms/sky.ts`).

## 1. Las salas: menos pared pintada, más cosas con cuerpo

**Lo que pasa.** Cada sala es una pared del fondo pintada (`wall()` en `world/rooms/salas/*.ts`)
y, delante, figuras planas (`at`). Solo tres salas tienen algo con volumen (`solid`): la cocina
(el hogar), la forja y las camas. En el tesoro, la bodega, la despensa, la capilla, la sala de
mapas, la armería y la enfermería todo es lámina. Al mover la cámara, el ojo nota que son
pegatinas.

**Por qué.** El volumen de hoy (`volume.ts`) solo sabe estirar la figura **hasta la pared**:
sirve para un hogar empotrado, no para un arcón o un montón de oro en medio de la sala.

**Propuesta.**

1. ⭐ **Volumen con grosor**: una opción `depth` en `Thing` (además de `box`) para estirar la
   silueta solo unos píxeles hacia atrás, con la cara de arriba y los lados en sombra. Es un
   cambio pequeño en `volume.ts` y en `RoomScene.figure`, y de ahí sale casi todo lo demás.
2. **Sala por sala** (lo plano que pide cuerpo):
   - **Tesoro.** Los montones de oro son medias lunas planas con un punteado igual. Habría que
     darles grosor, monedas sueltas en el borde y por el suelo, y destellos que salten al azar
     (unos píxeles blancos que se encienden y apagan). Los arcones, con grosor y alguno con la
     tapa abierta y el oro asomando. Las pilas de monedas, de pie. Y que el reflejo del oro se
     vea en el suelo.
   - **Bodega.** La caldera de cobre y su horno, la cuba grande, los barriles y el botellero
     son láminas. Darles grosor; vapor de la caldera, burbujas en la cuba (las partículas ya
     existen: `steam`, `drip`) y una gota que cae del grifo del barril.
   - **Cocina.** Solo el hogar tiene volumen. El horno de pan, las mesas y el aparador, con
     grosor. Vapor de la olla, humo del horno y la masa o el pan en la mesa.
   - **Despensa.** Las estanterías están en la pared: sacarlas como mueble con grosor, contra
     la pared; los jamones, colgados y balanceándose un pelo.
   - **Capilla, mapas, armería, enfermería.** Altar, mesa del mapa, armero, muela y catres,
     con grosor. Cosas pequeñas y vivas: la llama de las velas (ya está), la bola del mundo
     girando y la muela que gira cuando alguien afila.
3. **Pared más rica pero no recargada.** Lo que en la realidad cuelga (cuadros, lúpulo,
   cacerolas) puede seguir en la pared, pero con su sombra proyectada abajo a la derecha (un
   píxel de sombra), y lo que sobresale (baldas, estantes), como figura con grosor.

## 2. La gente: rutinas en vez de un gesto en bucle

**Lo que pasa.** Quien tiene puesto repite **un solo ciclo de cuatro tiempos todo el día**
(`WORK` en `world/rooms/crowd.ts`: la cocina, remover la olla; la bodega, remover el mosto). De
lejos parece que está barriendo o fregando sin parar, y cansa a la vista.

**Propuesta.**

1. ⭐ **Rutinas por puesto**: una lista de tareas con su sitio en la sala y su duración, que se
   va turnando, con pausas en medio. Por ejemplo:
   - **Cocina:** remover la olla, picar en la mesa, echar leña al hogar, probar con el cucharón
     y llevar un plato al salón (sale de la sala y vuelve), con un rato quieto o secándose la
     frente entre medias.
   - **Bodega:** remover la cuba, llenar jarras en el barril, rodar un barril y catar.
   - **Enfermería:** dar de beber, moler en el mortero y cambiar el paño al herido.
   - **Salón:** servir, limpiar la barra y recoger jarras de las mesas.

   Casi todo se pinta con los gestos que ya hay (`tool`, `drill`, `warm`, `drink`, `talk`):
   lo nuevo es sobre todo la lógica de turnar y moverse entre sitios.
2. **Gestos al quedarse quietos**: mirar alrededor, rascarse la cabeza, estirarse. Ya hay
   `stretch` y `yawn`; falta usarlos más y añadir uno o dos.
3. **Entrar y salir de la tarea**: al llegar al puesto, coger la herramienta (un fotograma);
   al irse, dejarla. Hoy aparece y desaparece de golpe.
4. **Que se note el resultado**: cuando la cocina saca una ración, que salga un plato con
   vapor hacia la barra; cuando la bodega llena un barril, un «toc» y el barril rueda a su
   pila.

## 3. «Juice»: dónde ponerlo

### En la escena

- ⭐ **Monedas que vuelan al contador.** Al cobrar (`pay`, `cheer`), las monedas que saltan en
  el salón vuelan hasta el oro de la barra de arriba y el contador da un pequeño salto al
  llegar cada una. Hoy saltan y se quedan en la escena. Es lo que más «engancha» de los juegos
  de gestión.
- ⭐ **Temblor de cámara suave** (2–4 píxeles, unas décimas de segundo) en el golpe fuerte de un
  jefe, en el asalto cuando revientan la puerta y al acabar una obra grande. No hay ninguno en
  la escena; solo en la pantalla de título.
- **Pausa en el golpe** (de 60 a 80 ms) y destello blanco en los golpes fuertes de las peleas
  y de la tira: el golpe «pesa».
- **Estirar y aplastar** (squash and stretch) al saltar de alegría, al sentarse de golpe y al
  caer un saco o un barril.
- **Partículas que faltan:**
  - chispas en la forja sincronizadas con el martillazo;
  - vapor de la olla y de la caldera;
  - polvo al pisar fuerte o al caer algo;
  - pétalos u hojas que se lleva el viento por el patio (ya hay viento: se puede usar el mismo
    `windAt`).
- **Brillo al pasar el ratón por algo tocable** (el tablón, el mapa, el oro): un contorno claro
  que late. Ya se marca; se puede hacer más vivo.
- **Obras:** cuando se termina una sala, un «ta-chán». Ahora sale polvo, monedas y el sonido
  `build`; se pueden añadir un destello que barra la sala de izquierda a derecha y la cámara
  que se acerca un momento.

### En la interfaz

- **Botones con peso**: al pulsar, se hunden un poco (escala 0,95) con su clic. Algunos ya lo
  tienen y otros no.
- **Recompensas grandes con ceremonia**: subir de rango, acabar una historia o pagar la deuda,
  con confeti de píxeles, una fanfarria y el sello que cae (ya hay `seal-stamp`).
- **El contador de oro** ya rueda y destella (`ui/Counter.tsx`); sumarle el salto al recibir las
  monedas que vuelan.

### En el sonido

- ⭐ **Variar el tono** de los sonidos que se repiten (monedas, clics, pasos, martillo): hoy suenan
  siempre igual (`audio.play`). Con un ±5 % al azar ya no cansan.
- **Sonido de cada sala al acercar la cámara**: el fuego crepitando, la olla, el martillo, el
  goteo de la bodega. Sube al acercarse y baja al alejarse.

## 4. Por dónde empezar (propuesta)

1. Monedas que vuelan al contador + tono variado en los sonidos (poco trabajo, se nota mucho).
2. Rutinas de trabajo en la cocina y la bodega (lo que más cansa ahora mismo a la vista).
3. Volumen con grosor y el tesoro y la bodega rehechos con él (luego, el resto de salas).
4. Temblor de cámara y pausa en el golpe en peleas y asaltos.
5. Lo demás, poco a poco.
