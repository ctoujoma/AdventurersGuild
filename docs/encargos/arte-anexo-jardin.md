# Encargo (arte): el anexo y el jardín de en medio

Para el agente de arte. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md), [`../plan.md`](../plan.md)
(«Patio trasero») y [`../salas/README.md`](../salas/README.md). El núcleo ya está hecho; esto es
lo que se ve.

## Qué es (decidido con el usuario)

Con el edificio ya a todo lo ancho (7 huecos) y el rango de plata, se compra **el patio
trasero**: un segundo edificio (el **anexo**) a la derecha, con **un jardín de 3 huecos en
medio en el que no se construye**. En el anexo se construye igual que en el edificio (salas,
escaleras, plantas), pero **no se excava**: así los edificios salen más interesantes y, más
adelante, con pasarelas entre los dos. El jardín se adorna (hasta un claustro). Al anexo se
llega por la planta baja, cruzando el jardín.

## Datos que tienes

- `Building.wing`: huecos del anexo (sin comprar, `undefined`). Empieza en el hueco
  `WING_COL` (10) con `WING_START` (3) huecos y crece con solares hasta `WING_MAX` (5).
  Constantes en `src/core/balance.ts` (`GARDEN_W`, `WING_COL`…).
- `src/core/rooms.ts`: `spanOf(b)` (huecos de la cuadrícula con jardín y anexo), `inWing(b, c)`,
  `inGarden(b, c)`, `onLot(b, c)`.
- `src/world/rooms/layout.ts`: `L.garden` (o `gardenRect(b)`): el jardín de la cara de fuera de
  un muro a la del otro, a la altura de la planta baja. `gardenSlots(b)`: los 3 trozos del
  jardín para las piezas. `colX`, `roofRuns`, etc. ya cuentan con el anexo (cada edificio sale
  con su tejado; el jardín, sin).
- `SceneModel.garden` (`GardenLook` en `src/data/custom.ts`), solo aspecto:
  - `ground`: `hierba` (sin elegir), `grava` o `losas`;
  - `slots`: una pieza por trozo, de izquierda a derecha (`null`: nada): `fuente`, `pozo`,
    `arbol`, `estatua`, `banco`, `huerto`, `flores`;
  - `edge`: borde de delante (`seto`, `flores`, `verja`);
  - `lamps`: faroles (con su halo, como los demás focos);
  - `cloister`: el claustro, soportales con arcos pegados a las dos fachadas que dan al jardín.
  Si hace falta otra pieza o cambiar nombres, se cambia ahí (y la validación, en `gardenLook`
  de `core/game.ts`); dilo en el PR.
- La gente ya anda por el jardín: es suelo de la planta 0 (`segments` en `people.ts`).
- Cómo se ve hoy, sin arte: [`capturas/anexo-sin-arte.png`](capturas/anexo-sin-arte.png).
- Capturas: `node tools/shots/anexo.mjs <carpeta>` (edificio con anexo, el jardín liso y
  adornado, de día y de noche).

## Qué falta (en este orden)

1. **Bajo el jardín y el anexo.** Hoy la roca de debajo del edificio (`facade` en
   `textures.ts`, de `L.left` a `L.right`) sigue por debajo del jardín y del anexo. Bajo el
   jardín, tierra como la de fuera; bajo el anexo, sus cimientos (no se excava).
2. **Salir al jardín.** La sala de la planta baja que da al jardín (la del hueco 6 y la del
   hueco 10) tiene en esa pared un lado `aire` (`sidesOf`); que tenga puerta (como la
   del recibidor) para que se vea por dónde se sale. Mira `inGarden` para distinguirlo del
   resto de paredes de fuera. Ojo con la escalera al borde: con rellano en la planta baja, la
   puerta va en ella; sin rellano, tapa el paso (el núcleo ya lo trata así).
3. **El jardín liso:** la hierba del patio (no la de solar sin construir), sin los arbustos y
   árboles del terreno de alrededor encima.
4. **Las piezas** de `GardenLook` (suelo, las 7 de los trozos, el borde, los faroles). Que no
   tapen a la gente que cruza (la gente anda en `LANES`).
5. **El claustro:** soportales con arcos a lo largo de las dos fachadas que dan al jardín, quizá
   con un tejadillo; que se vea en las alturas que tenga cada edificio.
6. **Nada que se cuele:** los árboles y arbustos de `yard` y del terreno de la derecha
   (`RoomScene.ts`) no deben caer dentro del jardín ni del anexo.

## Después (idea, sin núcleo todavía)

- **Pasarelas** entre los dos edificios por encima del jardín (de una planta de un lado a la
  misma del otro). Cuando se decida: el núcleo las tendría como tramos sobre el jardín, y tú, el
  puente.

Toca `RoomScene.ts` y `textures.ts` (dilo en el PR). No toques `core/` ni `SAVE_VERSION`.
