# Propuesta: expediciones (cómo se ven y se juegan)

Del agente principal (8 de noviembre). Primero la interfaz y el arte, que es lo que más importa;
el núcleo, después y a la medida de esto. Al final, lo que hay que decidir.

## La idea en una frase

Mandas a unos héroes **sin destino**, con provisiones, y se alejan día a día; tú les sigues en un
**diario vivo** con su dibujo, ves lo que llevan en la mochila y decides cuándo volver. Volver tarda
lo mismo que han tardado en llegar. Cuanto más lejos, mejor botín y más riesgo.

## Los momentos (de principio a fin)

### 1. Se abre: la carta del veterano

- **Cuándo:** el primer héroe que llega a nivel 5 (`EXPEDITION_LEVEL`).
- **Qué se ve:** al amanecer, una carta con sello propio (un mapa enrollado): «Ya tienes gente
  curtida. Hay sitios a los que no llega ningún encargo…». Al cerrarla, el mapa de la comarca se
  abre con su **borde desplegándose**: más allá de lo conocido, niebla y un camino que se pierde.
- **Tutorial corto** (tres notas, como el de obras): preparar, seguirles y volver. La última
  pide construir o ampliar el almacén (lo raro necesita el nivel 2).

### 2. Preparar la expedición

Una hoja propia, «Expedición», desde el mapa (un botón en el borde de la niebla) o desde el
tablón:

- **Quién va:** de 1 a 4 héroes. Sus retratos en fila y, debajo, lo que saben hacer (como al
  formar grupo).
- **Hacia dónde:** cuatro rumbos con su dibujo, y lo que suele haber en cada uno:
  - **Bosque:** madera buena y hierbas; lobos.
  - **Sierra:** hierro y cristal; frío y desprendimientos.
  - **Marismas:** hierbas y cuero; fiebres.
  - **Ruinas:** cristal y objetos; trampas y muertos que no descansan.
- **Provisiones:** una mochila que se llena tocando: cada ración de la despensa da un día más.
  Debajo, en grande: «Para 6 días: 3 de ida y 3 de vuelta».
- **Lo que cuesta:** las raciones y los días sin esos héroes en casa. Sin oro.

### 3. Mientras están fuera: el diario vivo

Es la pantalla estrella. Se abre tocando su ficha en el mapa o su retrato en la barra.

- **La tira grande** (como la del encargo en curso, más alta): el grupo andando hacia la derecha
  por un paisaje que **cambia con la distancia**: primero lo conocido, luego el rumbo elegido cada
  vez más salvaje. De noche, la hoguera del campamento.
- **La distancia**, como un camino con mojones: «A 4 días de casa». Volver tarda lo mismo.
- **Las provisiones**, como raciones dibujadas que se van tachando. Cuando quedan las justas para
  volver, se ponen rojas y el grupo vuelve solo.
- **La mochila:** los materiales y objetos que llevan, con su dibujo y la cifra. Crece día a día.
- **El estado de cada uno:** su retrato con la vida y la moral. Herido, se le ve vendado.
- **El diario**, en papel: una línea por suceso, con su icono y el día. «Día 3: en unas ruinas,
  Bruna encuentra una espada vieja».
- **El botón grande: «Volver a casa».** Al tocarlo, el grupo da media vuelta en la tira y el
  diario lo apunta.

### 4. Los sucesos (algunos te preguntan)

- La mayoría pasan solos: un hallazgo, una pelea ganada, un día tranquilo, un camino cortado.
- **De vez en cuando, una decisión** (como la radio de Fallout Shelter): llega un aviso al gremio
  («Bruna ha visto una cueva con brillo dentro: ¿entran?»), con dos botones. Si no se contesta en
  el día, eligen ellos (con prudencia).
- **Encuentros:** un mercader (cambia materiales por oro), un viajero que quiere unirse (un héroe
  nuevo que vuelve con ellos), un santuario (cura o da moral).

### 5. Fuera del diario

- **En el mapa:** su ficha se aleja por el borde, dentro de la niebla, con una estela de pasos.
  Cuanto más lejos, más pequeña y más tenue.
- **En la taberna:** sus camas, hechas y vacías. En el tablón, una nota clavada: «De expedición:
  Bruna, Tomás. Volverán».
- **Avisos:** un chip en la barra cuando pasa algo gordo («Expedición: ¡cristal!»).

### 6. La vuelta

- Llegan por el patio **cargados con sacos y fardos** (el dibujo dice si vienen llenos).
- Los materiales **vuelan a su sitio**: al almacén o, si no hay, al rincón de la bodega. Lo que no
  quepa se vende, como siempre, y se dice.
- **El informe de la expedición:** como el de un encargo, con una página propia, «La mochila», en
  la que cada hallazgo se da la vuelta como una carta.

## Arte que hace falta

1. **Los cuatro rumbos** como fondos de la tira (bosque, sierra, marismas, ruinas), cada uno en tres
   grados de lejanía, y su icono para la hoja de preparar.
2. **El campamento de noche:** hoguera, petates y alguien de guardia.
3. **La mochila y los fardos:** de vacía a llena (en la tira, en la llegada y en el icono).
4. **Los sucesos:** cueva, ruinas, mercader, viajero, santuario y desprendimiento, con un dibujo
   pequeño para el diario y la tira.
5. **La niebla del mapa** y la ficha que se aleja.
6. **La carta del veterano**, con su sello de mapa enrollado.

## Lo que necesita el núcleo (después)

Una `Expedition` con su grupo, rumbo, provisiones, días de ida, estado (`ida`, `vuelta`), mochila
y diario; un paso por día (sucesos con la misma regla de riesgo que los encargos); decisiones
pendientes con plazo; la vuelta y el informe; y con el juego cerrado, que siga (`away.ts`).

## Para decidir

1. **Rumbos:** ¿los cuatro, o empezamos con dos (bosque y sierra)?
2. **Decisiones por el camino:** ¿sí, con aviso y plazo de un día, o todo automático al principio?
3. **Si caen todos:** ¿se pierde lo que llevaban (como en Fallout Shelter) o vuelve algo?
4. **Grupo:** ¿de 1 a 4, o como mucho 3?
5. **Volver:** ¿tarda lo mismo que la ida, o la mitad (ya conocen el camino)?

## Respuestas del usuario (11 de noviembre, adelantadas en otra conversación)

**Para el agente de las expediciones:** el usuario contestó a «Para decidir» en la página
«Decisiones del Jarro» (https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk; registro en
[`decisiones.md`](decisiones.md), códigos X1 a X5, A7 y E3), dentro de una revisión general del
juego ([`revision-critica.md`](revision-critica.md)). No hace falta volver a preguntarle esto.

1. **Rumbos (X1):** los cuatro. Los que no estén listos pueden salir marcados como «en obras»
   (WIP) mientras se van haciendo.
2. **Decisiones por el camino (X2):** sí, con aviso y un día de plazo. Además, un icono en cada
   expedición para silenciar sus avisos y que lo resuelva todo sola.
3. **Si caen todos (X3):** vuelve algo.
4. **Grupo (X4):** de 1 a 4, pero el tope lo daría una sala. Pendiente de decidir; propuesta: que
   lo dé la sala de mapas (nivel 1: 2 héroes, nivel 2: 3, nivel 3: 4) en vez de una sala nueva de
   exploradores. Hoy la sala de mapas da un encargo más por nivel, el peligro real a nivel 2, el
   mapa a color y algo más de aviso de asaltos.
5. **La vuelta (X5):** tarda la mitad que la ida (ya conocen el camino).

**Cuándo (A7):** las expediciones se hacen **al acabar el plan de pulido general** (plan.md, «Plan
de ataque»). Llegarán sobre cosas que cambian antes: un tablón a la medida de los héroes (A3), un
solo motor de pelea para jefes, asaltos y ladrón (A6, que deberían usar también las peleas de la
expedición), bajas que vuelven a pasar en lo difícil con más desaparecidos que regresan (A8) y la
fama que se gana con encargos (A1).

**Materiales raros (E3):** hasta las expediciones no hay hierbas, madera buena ni cristal, así que
la alquimia no puede mejorar amuletos ni varitas (`ICON_MATERIAL` en `core/crafting.ts`). Decidido:
esperar a las expediciones para darles fuente, y corregir ya los textos de `MATERIALS`
(`core/materials.ts`), que prometían pociones (no existen), hachas que piden madera (no la piden)
y cristal para «lo mejor de cada taller» (nada lo pide). Al hacer las expediciones: que sean la
fuente de esos tres, y revisar qué recetas y mejoras los piden.
