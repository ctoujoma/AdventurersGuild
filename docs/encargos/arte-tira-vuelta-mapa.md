# Encargo (arte): la vuelta de la tira y el mapa de la comarca

Para el agente de arte. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md), [`../plan.md`](../plan.md)
(fase 3, «El encargo en directo») y [`propuesta-panel-encargo.md`](propuesta-panel-encargo.md).

## 1. La tira: que no engañe y que la vuelta deshaga el camino (prioridad alta)

El usuario: «en el informe sale fracaso, pero en la tira parecía que todo iba bien; me confundió
(entiendo que no se quiere desvelar antes de tiempo). Valorar que la vuelta sea el camino que se
deshace hacia atrás: así se ve que se retiran por donde vinieron, y simplifica y unifica cómo se
enseñan los resultados».

Lo que ya ha cambiado en el núcleo (agente principal):

- El encargo **se resuelve al acabar la pelea de la tira** (`resolveAt(m)` en `core/journey.ts`:
  con jefe, al llegar a él; con pelea, en `journey.fight.to`; si no, `RESOLVE_T`). Así el final
  de la pelea ya puede contar la verdad: desde ese momento `now.outcome` está puesto y cada
  héroe de `now.crew` trae su `fate`.

Lo que pide a la tira (`world/tripStrip.ts`):

- **La línea es ida y vuelta por el mismo camino:** de la taberna (izquierda) al sitio
  (derecha) en la ida; **en la vuelta, el grupo desanda el camino hacia la izquierda** (mira a la
  izquierda y el punto del grupo va del sitio a la taberna), en vez de seguir hacia otra taberna
  a la derecha. La parte de vuelta de la línea se va «borrando» detrás de ellos.
- **Un solo lenguaje para el resultado, en la vuelta:**
  - bien (`Éxito brillante`, `Éxito`): andando tranquilos, con el botín a cuestas;
  - a medias (`Éxito parcial`): andando, sin botín;
  - mal (`Fracaso`, `Desastre`): **en retirada** — más deprisa al principio, mirando atrás, los
    heridos cojeando y apoyados; si alguien no vuelve (`fate` `muerto`/`desaparecido`), su hueco
    en la fila.
- **El final de la pelea, según el resultado:** si sale bien, los enemigos caen o huyen; si sale
  mal, los enemigos se quedan y el grupo da media vuelta (empieza la retirada).
- Mientras no se sabe (antes de `resolveAt`), nada que dé el resultado por hecho.

## 2. El mapa de la comarca (`MapPanel.tsx`, `art/map.ts`)

El usuario: «hay que mejorar la calidad del minimapa y pensar si ampliarlo». Lo tuyo es el
dibujo: más detalle y más legible a escala entera (costa, ríos, caminos, bosques, relieve, los
lugares con su icono), sin perder lo que ya marca (encargos, grupos de viaje, niebla, lo
explorado). El tamaño y cómo se abre (pantalla completa, zoom) lo hace el agente de interfaz
(`interfaz-avisos-mapa.md`): poneos de acuerdo en la escala del dibujo.

Capturas a 420 × 860 y en horizontal, y un PR contra `main`.
