# Propuesta: la pelea de los asaltos, en directo

Del agente principal, para decidir con el usuario antes de tocar código. Sin formaciones.

## Cómo va ahora (y por qué se ve mal)

- El asalto se decide entero en el núcleo al caer la noche (`core/assault.ts`, `simulate`):
  segundo a segundo, quién corre a dónde, quién pega y quién cae. La escena solo reproduce la
  lista de pasos (`world/rooms/raid.ts`, `RaidShow`).
- La vida no se ve: en la escena todos dan golpes «de adorno» y, cuando el núcleo dice que
  alguien cae, cae. Por eso parece que un bando muere de golpe.
- Los nuestros corren solos a cortar el paso (la IA del núcleo) y el jugador no puede hacer
  nada: ni moverlos ni ayudarles. Solo «Saltar».

## La idea

El asalto se juega en la propia taberna, como en Fallout Shelter, con lo que ya funciona contra
los jefes (`core/combat.ts`: vida, golpes a su ritmo, una habilidad por clase con recarga y los
críticos con rombo).

1. **Aviso y preparación.** Al caer la noche con la app abierta, «¡Bandidos en el camino!» y
   unos segundos de preparación (los que tardan en llegar al patio; más si hay de guardia o
   torre). El reloj se para. Se puede despertar a todos de un toque («¡A las armas!») o ir uno
   a uno.
2. **Mover a la gente (lo principal).** Se arrastra a un héroe a una sala y va corriendo por el
   camino de verdad (escaleras y puertas), con una marca en la sala de destino. Así se decide
   dónde se planta cara: en el patio con la empalizada, en la puerta o delante de la cámara.
   A los trabajadores se les puede llevar a una sala para que se escondan (o dejarles pelear).
3. **La pelea en cada sala, a la vista.** Barras de vida sobre cada uno, números de daño, caen
   de uno en uno. En una sala con pelea se toca a un bandido para elegir a quién atacan los
   nuestros de esa sala, y la habilidad se lanza tocando al héroe (o su retrato abajo). El rombo
   de crítico, igual que contra jefes.
4. **Puerta y cámara.** Las barras de la puerta y la cerradura, como ya hay. Si abren la cámara
   y salen con sacos, se les puede perseguir: quien caiga antes del camino suelta el oro.
5. **Abajo, una tira de retratos** con la vida y la habilidad de cada héroe en casa (como la de
   los jefes), para no tener que buscarlos por la escena.
6. **Sin tocar nada** pasa lo mismo que ahora (los nuestros van solos), así que «Que se las
   apañen» y el juego cerrado siguen igual.

## Por dentro

- El núcleo juega el asalto **con órdenes**, igual que la pelea contra jefes: «mueve a X a la
  sala Y», «en la sala Y, a por el bandido Z», «habilidad de X», «crítico». Determinista con la
  semilla: el informe del amanecer lo repite igual.
- La pelea de cada sala usa las reglas de `combat.ts` (en lugar del «todos pegan a la vez» de
  ahora), así que la vida y los daños de la escena son los de verdad.
- Calibrado con `npm run calib`: sin jugar, como ahora; jugando bien, unos puntos mejor (no
  tiene que ser obligatorio jugarlo).

## Reparto

- **Principal:** el núcleo con órdenes, el flujo (aviso, reloj parado, fin) y la tira de
  retratos.
- **Arte:** barras de vida y números en la escena, caídas, la marca de destino, la persecución
  con los sacos y los golpes por clase. Se le encarga cuando el usuario dé el visto bueno.

## Para decidir

1. ¿Cámara lenta mientras se arrastra a alguien, o el tiempo sigue a su ritmo?
2. ¿Una recompensa por jugarlo bien (fama, un objetivo «gana un asalto sin heridos»), o basta con
   salvar el oro?
3. Al arrastrar de día, ¿que el héroe vaya andando (como en Fallout Shelter) en lugar de
   aparecer allí? Va de la mano: en el asalto tiene que correr, y es mejor que de día haga lo
   mismo. Propuesta: sí, de día **andando a paso ligero** con la marca en el destino, y la tarea
   empieza al llegar (en los incidentes, la pelea o el ladrón empiezan cuando llega).
