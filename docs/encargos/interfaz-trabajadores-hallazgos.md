# Hallazgos: trabajadores y tareas

La auditoría del encargo [`interfaz-trabajadores.md`](interfaz-trabajadores.md) (va aparte para no
chocar con el encargo, que está en otra rama). Partida de prueba con todo a la vez: los tres del
pueblo, dos trabajadores nuevos, dos pidiendo trabajo, un héroe de guardia, uno entrenando, uno
ayudando en la bodega, uno herido y uno de misión. Capturas a 420 px en la página «Jarro: quién
hace qué» (artefacto de claude.ai).

## Lo que confunde

1. **La lista de héroes no dice qué hace cada uno.** Quien entrena o ayuda en una sala sale como
   «Disponible» (que significa «puede salir de misión»). Su tarea solo se ve en la ficha o al pasar
   el ratón en la escena.
2. **Los héroes ocupan puestos que no se ven en Héroes › Trabajo.** La bodega 2/2 es Nico y un
   héroe; en la pestaña solo sale Nico con «Bodega (2/2)».
3. **Nada avisa de lo que falta.** Una enfermera en la cocina y la enfermería a 0/2; un
   trabajador sin tarea; gente pidiendo trabajo que solo se ve entrando en la pestaña. Que en su
   oficio rinden la mitad más solo está en la ayuda de la pestaña.
4. **Las cifras significan cosas distintas.** «Trabajo 5/6» y «Héroes 4/4» son camas; «Cocina
   (2/2)» en el desplegable cuenta a la propia persona; el dormitorio del servicio enseña «6» y
   «5/6» sin decir qué es. El botón de contratar es solo «25».
5. **Cuatro sitios para cambiar lo mismo, y la guardia aparte.** Desplegable en la pestaña
   Trabajo, botón y desplegable en la ficha del héroe, «Poner a trabajar aquí…» en la sala y
   arrastrar. La guardia no está en ningún desplegable, y el botón «Guardia» del recibidor lleva a
   la lista de héroes, donde no se puede poner a nadie de guardia.
6. **Palabras distintas para lo mismo y datos repetidos.** «Descansa», «No trabaja», «echa una
   mano», «entrena», «fuera hoy», «Disponible». En las salas de entrenamiento cada héroe sale dos
   veces (barra y «Entrenan aquí»). La sala dice lo que rinde en total, no lo que pone cada uno.
   Tocar a un trabajador en la escena solo le hace decir una frase.

## Propuesta (pendiente del visto bueno del usuario)

1. **La casa:** la pestaña Trabajo pasa a ser la lista de la gente de la casa por tarea (trabajan
   por sala, entrenan, de guardia, sin tarea, fuera), con avisos arriba y un selector único que
   incluye la guardia. Los que piden trabajo, debajo, con «Contratar · 25».
2. **Salas con huecos:** los puestos como huecos ocupados o vacíos, lo que pone cada uno y el
   oficio marcado; sin la lista repetida de entrenamiento; el recibidor con sus dos huecos de
   guardia.
3. **Palabras y cifras:** la chapa de cada héroe dice su tarea; contadores con nombre («5 de 6
   camas»); el desplegable cuenta los huecos libres.

## Decidido con el usuario

- La lista va en lugar de la pestaña Trabajo de Héroes (ahora «Tareas»), con los avisos arriba
  y su número en la pestaña.
- Los tres PR, en el orden de arriba.
- Los avisos, de momento solo en la lista.

## Pendiente (tarea aparte)

- Avisos también en la escena: un globito sobre la sala sin nadie (y quizá sobre quien no
  tiene tarea). Toca `src/world/rooms/`: avisar al agente de arte.

## Hecho

- PR 1, la casa: `src/ui/crew.ts` (grupos, avisos y opciones del selector, con tests),
  `src/ui/panels/CrewList.tsx` (la lista) y `planTask` en `src/ui/drop.ts` (cambiar la tarea,
  que también usa arrastrar).
- PR 2, salas con huecos: la ficha de sala usa los mismos huecos que Tareas (`CrewGroup` en
  `CrewList.tsx`), con lo que pone cada uno (`givesAt` en `crew.ts`) y la barra de quien
  entrena dentro de su hueco (ya no se repite arriba). El recibidor enseña sus dos huecos de
  guardia y pierde el botón que llevaba a la lista de héroes.
