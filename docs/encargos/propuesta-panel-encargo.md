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

## La tira (agente de arte), revisada con el usuario

Referencia del usuario: la exploración de Fallout Shelter (los personajes animados sobre el
paisaje y, debajo, lo que van encontrando). **La tira es la línea de tiempo:** los héroes van
dibujados encima de la línea de las partes del viaje y se desplazan por ella. Nuestros sprites
son pequeños, así que caben todos a lo ancho.

Un componente propio, `QuestStrip` (canvas), que recibe `now: JourneyNow` y nada más:

- **Banda** a todo el ancho de la ficha (unos 240 × 80 px a escala entera), con el paisaje del
  terreno detrás (`art/arenas.ts`, de día o de noche según `now.night`) y, abajo, **la línea de
  las partes** (`LEGS`): a la izquierda la taberna, en medio el sitio, a la derecha la taberna
  otra vez. Lo pasado, pintado; lo que falta, apagado.
- **Los héroes** (los sprites de la taberna, con su equipo; `now.crew`), en fila en el punto
  `now.t` de la línea, mirando a la derecha y avanzando:
  - **Ida y vuelta:** andando (de noche, sentados junto a una hoguera si toca un suceso
    `noche`).
  - **Llegada y lo suyo:** según el tipo (buscan, abren un cofre, empujan el carro…).
  - **Pelea** (`now.fighting`, entre `journey.fight.from` y `.to`): aparecen **enemigos** delante
    del grupo y pelean con poses de ataque y golpe; al acabar, los enemigos caen o huyen. Si es
    `journey.boss`, **la pelea no va en la tira** (tiene su pantalla, `ui/BossFight.tsx`): el
    grupo se para ante la silueta del jefe (`art/bosses.ts`) con un «!» mientras espera y, ya
    resuelto, el jefe caído o el grupo en retirada.
  - **Heridos:** cojeando o apoyados en otro. El encargo se resuelve al acabar lo suyo
    (`RESOLVE_T`); desde ahí cada héroe de `now.crew` trae su `fate` de verdad (`herido`; los
    `muerto` y `desaparecido` ya no van en la fila) y en `now.past` sale el suceso `aviso`.
- **Los sucesos** (`now.past`) salen como bocadillo o destello encima en su momento; debajo de
  la tira, la ficha ya lista el diario.

### Enemigos: una familia de sprites reutilizable

`journey.foe` dice qué familia toca (`data/journey.ts`, sacado del texto del encargo):

| Familia | Qué abarca |
| --- | --- |
| `bandido` | bandidos, salteadores, desertores, contrabandistas, cultistas, brujos |
| `trasgo` | trasgos, orcos, kobolds, duendes |
| `bestia` | lobos, huargos, osos, jabalíes, perros |
| `alimana` | ratas, arañas, babosas, limos, avispas, murciélagos, serpientes |
| `muerto` | esqueletos, espectros, espíritus, guardianes de cripta |
| `grande` | trols, grifos |

Cada familia, un sprite de tamaño de héroe (el `grande`, el doble) con variantes por semilla
(color, arma) y poses: quieto, andar, atacar, golpe recibido y caer. Que sirvan después para los
asaltos a la taberna, los esbirros de los jefes y la pelea interactiva (fase 3), así que mejor
en `art/foes.ts` y no dentro de la tira.

## Reparto y orden

1. Agente principal: los datos del viaje en el núcleo (partes, sucesos, semilla) y el panel
   con un hueco para la tira.
2. Agente de arte: `QuestStrip` y sus capturas, enchufado en ese hueco.
3. Después: los momentos de decisión sobre la tira (fase 3).

## Hecho (agente principal): los datos y la ficha

- **Núcleo:** `core/journey.ts` (frases en `data/journey.ts`). `journeyNow(game, mission)` da
  un `JourneyNow` con todo lo que pide la tira:
  - `journey.seed`, `journey.type`, `journey.terrain`, `journey.place`, `journey.days`,
    `journey.boss` (si es el paso de una historia con jefe);
  - `t` (del total, 0–1), `leg` (`ida` | `llegada` | `faena` | `vuelta`) y `legT` (0–1 de esa
    parte); las partes y sus trozos, en `LEGS`;
  - `night` (si es de noche en la partida);
  - `crew`: quién va, con el mismo aspecto que `BossFight.heroes`;
  - `journey.events`: los sucesos con `leg`, `at` (punto de su parte), `t` (del total) y
    `kind` (`camino` | `llegada` | `faena` | `pelea` | `jefe` | `noche` | `vuelta`); `past`,
    los ya pasados. El texto, con `eventText(game, e)`;
  - `journey.foe` (familia de enemigos), `journey.fight` (`from`–`to` del total, si hay pelea) y
    `fighting` (si están peleando ahora).
- Todo sale fijo de la semilla: abrir y cerrar da lo mismo. Son ambiente: el resultado
  (heridos, botín) llega con el informe, así que la tira no debe enseñar heridos ni el final
  de la pelea antes de tiempo.
- **Ficha:** `ui/TripSheet.tsx`. Se abre al tocar un grupo en la lista bajo el mapa, con «Ver
  el viaje» en su ficha del mapa y con el aviso «vuelve esta noche». **El hueco es `Strip`**
  (`.trip-strip`, a todo el ancho y 72 px de alto): de momento pinta el fondo del terreno con
  una marca donde va el grupo. Cámbialo por `<QuestStrip now={now} />`.
