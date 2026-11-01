# Propuesta (arte → agente principal): panel del encargo en curso, con la tira

Del agente de arte, hablado con el usuario. Antes de dibujar la tira del encargo en directo
([`../plan.md`](../plan.md), fase 3) hace falta **un panel para ver un encargo en curso con
detalle**. Ahí va la tira animada, al estilo de Fallout Shelter. El panel y los datos son del
agente principal. La tira la dibuja el de arte.

## Lo que hay hoy

- Un grupo fuera es un `Mission` (`core/model.ts`): el encargo, quién va y `daysLeft`. No se
  sabe en qué parte del viaje va ni qué le ha pasado hasta el informe.
- En el mapa (`MapPanel.tsx`) se ve que hay gente en un sitio, pero no hay una ficha del viaje.

## El panel (agente principal)

Se abre al tocar un grupo fuera: en el mapa, en la lista de héroes o en un aviso. Lleva:

1. **La tira**, arriba y a todo el ancho (la pone el de arte, ver abajo).
2. **El encargo:** título, sitio, tipo (pelea, exploración, escolta…) y riesgo.
3. **Quién va:** retratos con su estado (bien, herido, cansado), como en las fichas.
4. **El viaje por partes:** ida, llegada, lo suyo y vuelta, con la parte de ahora marcada y lo
   que falta (barra o reloj).
5. **Lo que ha pasado:** unas líneas que se van sumando («Cruzan el vado», «Emboscada en el
   pinar: Brígida, herida»).
6. Más adelante (fase 3), **los momentos de decisión** sobre la tira: «Entrar a pelear» o
   «Resolver solo».

## Lo que la tira necesita del núcleo

Para que se vea igual al cerrar y abrir el panel, debe ser fija con una semilla:

- La **parte del viaje** y cuánto lleva de ella (0–1).
- El **tipo de encargo** y el **terreno** del sitio (`PLACE_INFO[...].terrain`, el mismo de las
  peleas contra jefes).
- **Quién va**, con su aspecto (como `BossFight.heroes`) y su estado.
- Los **sucesos con su momento** (en qué parte y en qué punto de ella): una pelea, un hallazgo,
  un herido, el jefe. La tira los pinta cuando llega ese punto.
- Si es de **día o de noche** (la hora del juego).

## La tira (agente de arte)

Un componente propio (por ejemplo `QuestStrip`, en un canvas) que recibe esos datos y nada más:

- Una banda ancha y baja (unos 224 × 64 px, a escala entera) con el paisaje del terreno en
  capas que se mueven a distinto paso. Se reutilizan los fondos de las peleas
  (`art/arenas.ts`), de día y de noche.
- **Ida:** el grupo anda de izquierda a derecha, en fila, con las animaciones de andar de la
  taberna.
- **Lo suyo:** según el tipo. Pelea contra enemigos genéricos o el jefe (con los sprites de la
  pelea), exploración (buscan, abren un cofre), escolta (con un carro), etc.
- **Vuelta:** de derecha a izquierda. Los heridos cojean o van apoyados en otro, y con el botín
  a cuestas si lo hay.
- Los sucesos salen como bocadillos o destellos encima, y el jefe con su dibujo de
  `art/bosses.ts`.

## Reparto y orden

1. Agente principal: los datos del viaje en el núcleo (partes, sucesos, semilla) y el panel
   con un hueco para la tira.
2. Agente de arte: `QuestStrip` y sus capturas, enchufado en ese hueco.
3. Después: los momentos de decisión sobre la tira (fase 3).
