# Encargo (arte): los talleres que trabajan (forja, sastrería y alquimia)

Para el agente de arte. Antes de nada, lee [`../../CLAUDE.md`](../../CLAUDE.md),
[`../plan.md`](../plan.md) (fase 4) y [`../salas/README.md`](../salas/README.md).

## Qué hay ya (lo hizo el agente principal)

La forja crea objetos (fase 4, primer taller):

- **Recetas** en `src/data/recipes.ts`: espada, coraza y ganzúas de serie; hacha y escudo se
  aprenden desmontando (o como premio de encargos e historias). Cada una da un objeto normal o, a veces,
  uno «de las buenas» (rareza 1). Nunca legendarios.
- **Reglas** en `src/core/crafting.ts`: cada trabajo avanza con la gente de la sala (el oficio
  nuevo **herrero/herrera**, `trade: 'forja'`, o un héroe que echa una mano, más despacio).
  Sin nadie, se para. Con la forja a nivel 3, dos trabajos a la vez.
- **Desmontar:** un objeto del arcón que enseña una receta que no se sabe; tarda 4 h, el objeto
  se pierde y a veces sale la receta.
- **Ficha:** `src/ui/panels/ForgeInfo.tsx` (botón «Crear», «Desmontar», «Cancelar»).
- **Para la escena:** `SceneModel.crafts` (`SceneCraft` en `src/world/scene.ts`): por cada
  trabajo, la sala (`room`), el dibujo de lo que sale (`icon`, `rarity`), lo que lleva
  (`frac`, 0–1), si está parado (`stalled`) y si es desmontar (`undo`). Cambia en cada tick:
  **no lo metas en la clave de `setModel`** (rehace la escena); léelo cada vez, como
  `incidents`.
- El arte de la sala ya existe: `src/world/rooms/salas/forja.ts` (fragua con brasas, fuelle
  desde el nivel 2, yunque con herramientas, artesa de templar, banco y hojas acabadas).

## Lo que te pido

1. **El herrero y la herrera:** su figura (mandil de cuero, brazos al aire, guantes) para los
   trabajadores con `trade: 'forja'`, como los demás oficios.
2. **Animaciones de trabajo en la forja**, mientras hay un trabajo y alguien en la sala:
   martillar en el yunque (con chispas en cada golpe), avivar el fuelle (las brasas suben), y
   de vez en cuando templar en la artesa (nube de vapor). Un héroe que echa una mano, igual
   pero con su propio sprite (basta con martillar).
3. **La forja encendida o parada:** con trabajo, brasas vivas, más luz y una pieza al rojo en
   el yunque (la del `icon`); parada (`stalled`) o sin trabajo, brasas bajas y el yunque vacío.
4. **Al acabar** (el trabajo desaparece de `crafts`): la pieza un momento en el yunque con un
   brillo; si sale de las buenas, algo más vistoso (si te hace falta saberlo en la escena,
   pide el dato en el PR y lo añado).
5. **Desmontar** (`undo`): en el banco, la pieza que se deshace en trozos y chispas; al acabar,
   si sale la receta, un pergamino que sube y se desvanece.
6. **Bocadillo sobre la sala** (como el de los incidentes): el icono de lo que se hace y una
   barrita con `frac`; gris si está parado. Que no tape a nadie y que se lea en el móvil.
7. **Sonidos** si te encaja: martillazo y siseo del temple (`SoundName` en `scene.ts`).

## Las dos salas nuevas (sin arte todavía: salen con el de por defecto)

Tipos `sastreria` y `alquimia` en `src/data/rooms.ts`; registra su arte en
`src/world/rooms/salas/index.ts` como las demás (un fichero por sala, con `wall`, `things` y
`ruin`), niveles 1 a 3:

8. **Sastrería:** mesa de cortar con tijeras y patrones, maniquí con una prenda a medio hacer,
   rollos de tela de colores en un estante (los tintes: `TINTS` en `data/custom.ts`), tinas de
   tinte con vapor y telas tendidas a secar. Más nivel, más telas y un espejo.
9. **Taller de alquimia:** alambiques y retortas burbujeando (con luz de color), estantes de
   frascos, un caldero, hierbas colgadas y un libro abierto en un atril. Más nivel, más luz.
10. **La sastra o el sastre y la o el alquimista** (`trade: 'sastreria'` y `'alquimia'`): sus
   figuras y su trabajo (coser, cortar, teñir; remover el caldero, destilar).
11. **Vestir a un héroe** (lo pide el usuario expresamente): mientras dura (`SceneCraft.hero`),
    el héroe **camina hasta la sastrería** (eso ya pasa: su sitio de trabajo pasa a ser la sala,
    de día) y se queda **de pie en un sitio propio, junto al maniquí o un espejo**, no en un
    puesto de trabajo cualquiera. **La sastra o el sastre trabaja sobre él o ella:** le toma
    medidas con la cinta, le prueba la tela por encima, cose de rodillas el bajo. Si no hay
    nadie del oficio y lo hace un héroe que echa una mano, lo mismo. Al acabar, un brillo y ya
    lleva su tinte y su prenda (el aspecto cambia solo, `lookOf`). Si hace falta que la escena
    sepa dónde poner a cada uno, pide el dato en el PR.
12. **Bocadillos y animaciones** como en la forja (punto 6), con el dibujo de lo que se crea
    (botas, capa, amuleto, varita) o, al vestir, una tijera o una prenda.

## Forma de trabajar

- Rama propia, un PR por pieza grande, contra `main`, con capturas antes y después (día y
  noche, nivel 1 y 3, con y sin trabajo). Para preparar la forja trabajando en el navegador
  (modo `#debug`): poner la forja a nivel 1, un trabajador con `trade: 'forja'` y `room` la
  forja, y `__game.dispatch({ type: 'craft', room: <id>, recipe: 'espada' })`.
- No toques `core/` ni la ficha; si te falta un dato en `SceneCraft`, pídelo en el PR.
- Espera el visto bueno del usuario: se fija en alineaciones y en que nada tape nada.
