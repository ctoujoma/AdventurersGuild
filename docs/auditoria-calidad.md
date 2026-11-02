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

## 2b. Sala por sala: qué hace la gente y cómo se ve

Hoy solo tienen un trabajo animado el **salón, la cocina, la bodega y la enfermería** (los
oficios del servicio, `WORK` en `crowd.ts`) y las salas de **entrenamiento** (`DRILLS`: armas,
tiro y biblioteca). En las demás, los héroes solo pasean: no hay nada que hacer allí. Los
sitios donde se va a hacer algo (`poi`) son solo dos: rezar en la capilla y calentarse en el
hogar del salón. Cada sala debería tener **al menos dos o tres cosas que hacer** (para el
oficio o para los héroes libres) y **algo que se mueva aunque no haya nadie**.

- **Recibidor**
  - Hoy: los de guardia, quietos; el perchero, los carteles y el armero, en la pared.
  - Gente: el de guardia hace la ronda de la puerta a la ventana, se apoya en la lanza y, de
    vez en cuando, toca la campana o lee los carteles. Al llegar alguien, se gira.
  - Vista: la puerta de la calle, con volumen y entreabierta de día (luz que entra al suelo);
    el banco y el atril, con grosor.
- **Salón**
  - Hoy: camareros que van de mesa en mesa con la jarra; clientes sentados y en la barra.
  - Gente: recoger jarras vacías y llevarlas a la barra, barrer un rato cuando no hay nadie,
    echar un tronco al hogar y, por la noche, apagar las velas.
  - Vista: jarras y platos que aparecen y desaparecen en las mesas según los clientes; el
    hogar ya tiene volumen; las mesas, con grosor.
- **Cocina**
  - Hoy: remover la olla, sin parar.
  - Gente: la rutina de arriba (remover, picar, echar leña, probar y llevar el plato al salón).
  - Vista: horno de pan, mesas y aparador con grosor; vapor de la olla, humo del horno, masa y
    verduras en la mesa que cambian a lo largo del día.
- **Bodega**
  - Hoy: remover el mosto, sin parar.
  - Gente: remover la cuba, llenar jarras en el barril, rodar barriles y catar.
  - Vista: caldera, cuba, barriles y botellero con grosor; vapor, burbujas y la gota del grifo.
- **Despensa**
  - Hoy: nadie hace nada; todo pequeño y en fila contra la pared, con el centro vacío.
  - Gente: los de la cocina vienen a por cosas (cogen un saco o un jamón y se lo llevan).
  - Vista: cajas y sacos apilados a varias profundidades (no todo contra la pared), jamones
    que se balancean un pelo y algún ratón de vez en cuando.
- **Tesoro**
  - Hoy: nadie entra.
  - Gente: de vez en cuando, un héroe que cuenta monedas en la mesa, o el tabernero que deja
    la bolsa del día.
  - Vista: lo de la sección 1 (montones con grosor, destellos, arcones abiertos, reflejo).
    Al cobrar, que suene la moneda al caer en el montón.
- **Dormitorios (héroes, veteranos y servicio)**
  - Hoy: duermen de noche y se incorporan al acostarse y al levantarse.
  - Gente: de día, alguno se sienta en la cama a remendar o a leer; los heridos, en reposo.
    De noche, alguna vuelta en la cama y el «zzz» (ya existe la partícula).
  - Vista: mantas con pliegues y camas con grosor; un candil que se apaga al dormirse todos.
- **Enfermería**
  - Hoy: dar de beber al herido con el cuenco.
  - Gente: moler en el mortero, cambiar el paño de la frente y vendar; el herido, que se
    incorpora a ratos.
  - Vista: catres y mesa con grosor; vapor de la jofaina y el botiquín que brilla al usarse.
- **Capilla**
  - Hoy: se va a rezar (de pie) al altar.
  - Gente: rezar arrodillado en el reclinatorio, encender una vela y, alguna vez, el clérigo
    que lee en el atril.
  - Vista: ⭐ la luz de las vidrieras cayendo en color sobre el suelo (dos o tres manchas que se
    mueven despacio con la hora), humo de incienso y velas que se encienden una a una.
- **Sala de mapas**
  - Hoy: nadie hace nada (el mapa se toca).
  - Gente: un héroe que mira el mapa con el compás, otro que mueve los alfileres y otro que
    mira por el catalejo por la ventana.
  - Vista: la mesa con el mapa abierto, con grosor; la bola del mundo que gira y las velas.
- **Armería**
  - Hoy: nadie hace nada.
  - Gente: afilar en la muela (gira, con chispas), probar una espada con un tajo al aire y
    colgar el equipo.
  - Vista: el estante y la armadura en su soporte, con grosor; el barril de armas con las
    empuñaduras saliendo.
- **Forja**
  - Hoy: nadie trabaja; fraguas con volumen y el yunque y la muela planos.
  - Gente: ⭐ el herrero martilleando en el yunque con chispas a cada golpe, avivando con el
    fuelle, metiendo la pieza en el agua (con su vapor) y llevándola a la armería.
  - Vista: yunque y muela con grosor; el fuelle que sube y baja; la pieza al rojo que se enfría.
- **Sala de armas, de tiro y biblioteca**
  - Hoy: tajos, arco y leer, en bucle.
  - Gente: en la de armas, por parejas, uno contra otro (ya hay los gestos de pelea); en la
    de tiro, ir a recoger las flechas a la diana; en la biblioteca, coger un libro del estante
    y sentarse a leerlo.
  - Vista: los muñecos que se mueven al recibir el golpe; las flechas que se quedan clavadas en
    la diana hasta que se recogen; las páginas que pasan.
- **Torre del vigía**
  - Gente: el vigía mira con la mano en la frente y, al ver un asalto, toca el cuerno.
  - Vista: la bandera ondeando con el viento del patio (`windAt`).
- **Patio y establo**
  - Gente: alguien que saca agua del pozo, da de comer al caballo o practica con el muñeco.
  - Vista: el caballo que mueve la cola y la cabeza; hojas que se lleva el viento.

**Cómo hacerlo sin rehacer la gente:** casi todo sale de dos piezas nuevas en `crowd.ts`:

1. **Rutinas**: para cada sala, una lista de tareas (sitio, gesto, duración y lo que se lleva
   en la mano), que se turnan con pausas. Sirve para el servicio y para los héroes libres que
   entran en la sala.
2. **Más sitios (`poi`)** en las salas: el yunque, la muela, la mesa del mapa, el
   reclinatorio, el estante de la biblioteca, el pozo… cada uno con su gesto.

Los gestos que faltan (martillear, afilar, arrodillarse, picar) son unos pocos fotogramas más
en el atlas de la gente (`SIZES` en `crowd.ts`), con las herramientas nuevas en `TOOLS`.

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
3. Volumen con grosor, y el tesoro y la bodega rehechos con él.
4. La forja con el herrero (yunque, chispas, fuelle) y la luz de las vidrieras en la capilla.
5. Rutinas y sitios para las salas sin nada que hacer: armería, mapas, despensa y tesoro.
6. Temblor de cámara y pausa en el golpe en peleas y asaltos.
7. Lo demás (dormitorios, patio, torre…), poco a poco.
