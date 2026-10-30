# Encargo (arte): colores por sala, animaciones y escaleras

Para el agente de arte. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md),
[`../plan.md`](../plan.md) (fase 4), [`../salas/README.md`](../salas/README.md) y
[`../salas/encargo-arte.md`](../salas/encargo-arte.md) (cómo está hecho el arte de cada sala,
qué aprendimos y cómo comprobarlo). En ese orden de prioridad:

## 1. Colores por sala (prioridad alta)

El jugador elige un tema de color para los detalles de cada sala: telas, alfombras, cojines,
mantas, pendones. Así cada taberna se ve suya, y más adelante los temas se ganan con hazañas o
se venden como cosmético (nada de ventajas de juego).

- **Temas:** seis u ocho juegos de tres tonos de la paleta `P` (por ejemplo vino, bosque, mar,
  ocre, morado, ceniza). El de ahora de cada sala es el «de la casa».
- **Qué cambia:**
  - la tela de la pared de cada sala (`CLOTH` en `src/world/rooms/salas/acabados.ts`);
  - las mantas de las camas (`Prop.bunkQuilt`, `camas.ts`);
  - la alfombra roja del salón;
  - lo que en cada sala sea tela o adorno.

  La madera, la piedra y el metal no se tocan.
- **Dónde se guarda:** en la partida, junto a la personalización (`Custom` en
  `src/core/model.ts`), por ejemplo `colors?: Record<string, ThemeId>` por id de sala, con una
  acción del reducer y un test. Es opcional, así que no hace falta tocar `SAVE_VERSION`.
- **Dónde se elige:** un selector pequeño en la ficha de sala (`src/ui/panels/RoomPanel.tsx`).
  Dilo en el PR: esa ficha también la tocan el agente de interfaz y el principal.
- **Comprobar:** capturas de cada sala con dos o tres temas, de día y de noche (ver
  `tools/shots/`), y que nada quede sin contraste.

## 2. Animaciones más pulidas (prioridad alta)

Otro agente ya hizo una pasada. Haz otra, crítica, para que se sienta premium. Mira primero
qué hay en `src/world/rooms/crowd.ts` (fotogramas en atlas, `FRAMES`) y en `people.ts`
(caminos), y propón antes de rehacer.

- **Andar:** más fotogramas, balanceo y pies que no patinen.
- **Gestos:** brindar, bostezar, estirarse, limpiar la barra, entrenar con más variedad.
- **Transiciones** suaves entre acciones (sentarse, levantarse, acostarse).
- **Celebraciones** al volver de un éxito.

## 3. Escaleras (con lo anterior)

- Mejor arte en los tramos (peldaños, barandilla, luz).
- Que la gente suba y baje peldaño a peldaño, no deslizándose.
- Las escaleras por tramos («que solo ocupen sitio donde llegan») **no** entran: está
  descartado por ahora.

## Forma de trabajar

- Un PR por punto (o por sala, si el cambio es grande), contra `main`, con capturas antes y
  después.
- Si puedes, publica la versión de pruebas («Jarro: pruebas»).
- Espera el visto bueno del usuario: se fija mucho en alineaciones y en que nada tape nada.
- Lo grande y macizo (hogares, fraguas) ya lleva volumen con `solid(...)` en `salas/kit.ts`, y
  las camas van separadas de la pared (`BED_Z`). Si una pieza nueva es maciza, úsalo; si tiene
  huecos (literas, estanterías), no.
- No cambies reglas del juego ni la interfaz más allá del selector de colores. Si algo lo pide,
  pregunta.
