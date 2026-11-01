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

## Hecho (agente de arte)

**La tira** (`world/tripStrip.ts`, `art/trip.ts`):

- Una sola taberna, a la izquierda; el sitio, a la derecha. En la vuelta, el grupo mira a la
  izquierda y desanda el camino. En la línea, el oro va de la taberna al grupo, y lo que dejan
  atrás queda punteado y con sus sucesos apagados.
- El resultado se cuenta en la vuelta: con `Éxito` y `Éxito brillante`, tranquilos y con un saco
  al hombro (con oro asomando, el de delante); con `Éxito parcial`, sin saco; con `Fracaso` y
  `Desastre`, en retirada.
- En la retirada empiezan más deprisa, miran atrás a ratos y los heridos cojean arrimados al de
  delante. El que no vuelve deja su hueco en la fila.
- Si sale mal, la retirada empieza en cuanto se sabe (`homeFrom(now)`): al acabar la pelea o
  ante el jefe. Los enemigos y el jefe se quedan en pie.
- Si sale bien, los enemigos quedan caídos y el grupo lo celebra un momento.
- Mientras no se sabe, el grupo se queda en guardia ante los enemigos y el jefe sale en
  silueta.
- Capturas: `node tools/shots/tira.mjs <carpeta>` (incluye `pelea-ganada`, `pelea-perdida` y
  `vuelta-*`).

**El mapa** (`art/map.ts`). Sigue a 400 × 280 y con las mismas coordenadas, y no cambia nada de
`MapPanel.tsx`.

- Sierras con faldas sombreadas.
- Bosques en masa, con su suelo y su borde, y los pinares quemados con árboles muertos.
- Ríos con orilla perfilada; el afluente ya llega al río.
- Lagos: el Helado, con hielo; la laguna Negra; el islote del Fraile, en su laguna.
- Caminos reales más marcados. Los senderos salen del camino más cercano, no de la taberna en
  estrella.
- Un icono por lugar, justo encima de su punto: torre, ermita, cementerio, cueva o mina, molino,
  puente, granero, campamento, salinas, casas y charcas.
- Menos manchas en el pergamino.
- Capturas: `node tools/shots/mapa.mjs <carpeta>`, en vertical y en horizontal, más el dibujo
  entero a 1× y 3×.

**Escala, para el agente de interfaz:** un píxel del dibujo es una unidad de `MAP_W × MAP_H`. Se
ve nítido a zoom entero (1×, 2×, 3×…). Los iconos tienen 7 px y se leen bien desde 2×. Si el
mapa pasa a pantalla completa, conviene que el zoom vaya a pasos enteros sobre el tamaño del
dibujo, no sobre el ancho del panel.

### El mapa en dos versiones, según la sala de mapas

El usuario eligió usar las dos. Con la sala de mapas rota o a nivel 1, el mapa es el pergamino;
desde el nivel 2, es a color. Así se elige: `mapStyleFor(fac.mapas)` en `art/map.ts`.

Las dos comparten la comarca, en `art/mapTerrain.ts`:

- la altura, con sierras y valles;
- el agua: mar con calas, ríos, lagos y marisma;
- los bosques, las parcelas y las casas;
- los caminos, que no van por encima del río y lo cruzan con puentes cortos. Los senderos salen
  del punto del camino que menos agua cruza, y en el agua son vados.

Los iconos de los lugares están en `art/mapIcons.ts`.

- **Pergamino** (`art/mapInk.ts`): tinta y acuarela.
  - Mar con oleaje y rumbos.
  - Montes a plumilla, bosques árbol a árbol y parcelas rayadas.
  - Marco de leguas.
  - Lo no explorado, con rayado de «tierra ignota».
- **A color** (`art/mapColor.ts`): relieve con luz y sombra.
  - Mar con espuma, bajíos y alta mar.
  - Copas, surcos y setos.
  - Nubes sobre los Montes de la Niebla.
  - Lo no explorado, bajo un mar de nubes.
- Capturas: `node tools/shots/mapa.mjs <carpeta>`.
