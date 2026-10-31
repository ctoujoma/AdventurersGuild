# Encargo (arte): fachada por partes y preparar la sastrería

Para el agente de arte. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md),
[`../plan.md`](../plan.md) (fases 1 y 4), [`../salas/README.md`](../salas/README.md),
[`../salas/encargo-arte.md`](../salas/encargo-arte.md) y la idea entera en
[`../futuro.md`](../futuro.md) (punto 9). Viene después de tu encargo anterior
([`arte-colores-animaciones.md`](arte-colores-animaciones.md)): los temas de color por sala
(`TINTS` en `src/data/custom.ts`) se reutilizan aquí.

Para qué: las hazañas y los objetivos darán cosas que se ven (fase 1, punto 3), y luego se
venderán como cosmético. Nada de esto da ventajas de juego. Tú pintas las piezas y dejas
cómo elegirlas; a qué premio va cada una lo decide el agente principal.

## 1. Fachada por partes (prioridad alta)

Hoy la fachada es fija: tejado de teja roja (`roofTiles` en `src/world/rooms/textures.ts`),
hastiales y muros del corte (`facade`), y cuatro adornos que se compran y atraen gente
(`FACADE` en `src/data/custom.ts`: flores, faroles, banderines y letrero, pintados al final de
`RoomScene.ts`). Que se elija por partes:

- **Tejado:** teja roja (la de ahora), pizarra, paja; quizá tejas verdes o madera.
- **Paredes por fuera:** hastiales y lo que se vea del muro (tablas, entramado con yeso,
  piedra).
- **Rótulo y pendones** con el escudo (`model.crest`): ya hay tablero del escudo y letrero;
  formas distintas de rótulo (colgado, de hierro, pintado en la pared).
- **Jardineras, faroles y humo en la chimenea** (humo de partículas cuando la cocina o el
  salón tienen fuego, más de noche).

Las cuatro piezas que se compran siguen igual, con su Atractivo. Lo nuevo es solo aspecto.

- **Dónde se guarda:** en `Custom` (`src/core/model.ts`), por ejemplo
  `look?: { roof?: RoofId; walls?: WallId; sign?: SignId }`, opcional (sin tocar
  `SAVE_VERSION`), con su acción en el reducer y un test.
- **Dónde se elige:** junto a la fachada de ahora, en el panel de la taberna
  (`src/ui/panels/TabernaPanel.tsx`). De momento, todo elegible; el agente principal las atará
  a premios.
- **Comprobar:** capturas de la taberna entera con cada combinación de tejado y paredes, de día
  y de noche, a ancho de móvil y de PC (ver `tools/shots/`). Que las juntas de las salas y los
  tejados de varias alturas (`roofRuns`) casen con cada material.

## 2. Preparar la sastrería: tintes y prendas en los héroes

La sastrería será una sala (más adelante) donde se tiñe la ropa y se hacen prendas. Antes, el
dibujo: que la ropa de un héroe cambie de color y lleve una prenda, y que se vea también con la
armadura puesta.

- **Hoy:** cada clase tiene su traje con colores fijos (`OUTFITS` en
  `src/art/heroes/layers.ts` y `layersSide.ts`); el equipo se pinta encima (`GearMark` en
  `src/art/heroes/gear.ts`) en el sprite de la escena (`heroSprites`), el de pelea
  (`fightSprites`) y el retrato.
- **Tinte:** un color de ropa por héroe, que cambie los tonos del traje (las letras de la
  rejilla que son tela, no la piel ni el cuero). Mejor con los mismos temas de `TINTS`.
- **Que se vea bajo la armadura:** con armadura puesta, el tinte sigue en mangas, faldón, capa
  o tabardo; y la armadura se tiñe un poco (los tonos de `METAL` y `CAPE` en `gear.ts`
  toman el tema).
- **Prendas:** tres o cuatro para empezar (capa, tabardo con el escudo, faja, bufanda), como
  capa propia que se pinta entre el traje y el equipo.
- **Dónde se guarda:** en el aspecto del héroe (`HeroLook` en `src/art/heroes/look.ts`, que se
  guarda con la partida), por ejemplo `dye?: TintId` y `garment?: GarmentId`, opcionales.
- **Para probar:** en el modo prueba, un selector en la ficha del héroe (o una página de
  muestra en `tools/`) con todas las clases × tintes × prendas, con y sin armadura. La sala, los
  precios y cómo se consiguen, después: el agente principal.
- **Comprobar:** una hoja de capturas con todas las combinaciones (escena, pelea y retrato), y
  que nada pierda el contorno ni se confunda con el fondo.

## Forma de trabajar

- Un PR por punto (o por pieza, si es grande), contra `main`, con capturas antes y después.
- Si puedes, publica la versión de pruebas («Jarro: pruebas»).
- Espera el visto bueno del usuario: se fija mucho en alineaciones y en que nada tape nada.
- No cambies reglas del juego. Si algo lo pide, pregunta. Si tocas `TabernaPanel.tsx`, la ficha
  del héroe o `RoomScene.ts`, dilo en el PR.
