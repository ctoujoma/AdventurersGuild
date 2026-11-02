# Encargo (interfaz): comprar el patio trasero y adornar el jardín

Para el agente de interfaz. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md),
[`../plan.md`](../plan.md) («Patio trasero») y [`../salas/README.md`](../salas/README.md). El
núcleo ya está hecho; el arte va aparte ([`arte-anexo-jardin.md`](arte-anexo-jardin.md)).

## Qué es

Con el edificio a todo lo ancho (7 huecos) y el rango de plata se compra **el patio trasero**
(acción `buyWing`, `planWing` en `core/rooms.ts`, 1.200 monedas): un **anexo** a la derecha
con 3 huecos y **un jardín de 3 huecos en medio** donde no se construye. En el anexo se
construye como en el edificio (no se excava) y crece con solares (`buyPlot`, hasta 5 huecos).
Al anexo se llega por la planta baja, cruzando el jardín. El jardín se adorna (solo aspecto).

## Lo que ya funciona

- En el modo obras, al tocar «ganar sitio» (`expand`), sale el sitio «Comprar el patio trasero»
  a la derecha del edificio cuando se puede (`targetsFor` en `world/rooms/works.ts`), y luego
  «Comprar solar» a la derecha del anexo. Va en el borrador y se paga con lo demás.
- La acción `gardenLook` con un `GardenLook` parcial (`src/data/custom.ts`: `ground`, `slots`,
  `edge`, `lamps`, `cloister`; nombres en `GARDEN_GROUNDS`, `GARDEN_PIECES`, `GARDEN_EDGES`).
  Se guarda en `custom.garden`. Sin anexo no hace nada.

## Qué falta

1. **Que se sepa que existe.** Si aún no se puede comprar (falta ancho o rango), hoy no sale
   nada. Que en `expand` salga el sitio con candado y el porqué
   (`canWork(s, { type: 'buyWing' })`: «Primero, los solares de al lado.», «Se abre con el
   rango de plata.»), como las casillas tachadas de ampliar (`blocked`). Quizá también en la
   lista de lo que abre cada rango.
2. **Ir al anexo.** El edificio ahora es mucho más ancho: comprobar en el móvil que la cámara
   llega y que el botón de casa no deja el anexo perdido; si hace falta, un modo de saltar de un
   edificio al otro.
3. **Adornos › Jardín** (solo con `building.wing`): el suelo, una pieza para cada uno de los 3
   trozos del jardín (o nada), el borde, faroles sí/no y claustro sí/no, como Adornos ›
   Fachada. Con vista previa en la escena si se puede (`SceneModel.garden`).
4. Si las piezas se desbloquean o se pagan (como los tejados en `data/unlocks.ts`) lo decide el
   agente principal; de momento, libres.

No toques `core/` salvo lo justo (dilo en el PR) ni `SAVE_VERSION`.
