# Encargo: pociones en la alquimia

Del agente de expediciones al **agente principal** (23 de noviembre), pedido por el usuario. Si
te conviene, reparte partes: el dibujo al agente de arte y la interfaz al de interfaz.

## Lo que quiere el usuario

Las pociones **solo existen si se han creado en la alquimia**, igual que la forja crea sus
objetos. Las expediciones las llevan **como las raciones**, de lo que haya hecho, y además las
**encuentran por el camino**.

## Lo que ya está (expediciones, PR #213)

- `GameState.potions?: number`: las pociones hechas. Hoy nada las crea, así que nunca hay ninguna.
- La hoja de preparar enseña la fila «Pociones» solo si `potions > 0`. Se eligen como las
  raciones (`potionsMax(s)`) y se restan al salir (`sendExpedition`).
- En la expedición, por la noche, una poción cura una herida del que está peor. A veces un
  hallazgo es una poción (`EXP_POTION_FIND`). Las que sobran vuelven a `s.potions` al llegar.
- Textos en `src/textos/<idioma>/expediciones.yaml`: `expeditionsheet.pociones*`,
  `error.pociones`, `diario.pocion`, `diario.pocion_hallada` e `informe.chip_pociones`.

## Lo que falta (agente principal: talleres)

1. **La receta de la poción en la alquimia.** Las recetas de hoy (`data/recipes.ts`) dan un
   objeto de equipo al arcón (`finish` en `core/crafting.ts`). La poción no es un objeto: al
   acabar, `s.potions = (s.potions ?? 0) + n`.
   - Propuesta: 2 hierbas (`mats: { hierbas: 2 }`), algo de oro y unas 6 h, como una receta de
     serie (`free`).
   - Con un buen alquimista o la sala a más nivel, a veces salen 2 pociones en vez de 1, como el
     objeto «bueno» de la forja.
   - Las cifras van en `balance.ts`, con el prefijo `POTION_`.
   - Ojo con lo que asume que una receta da un `GearBase`: `common` y `good`, `RECIPE_BY_ICON`,
     desmontar, la lista del taller (`WorkshopInfo.tsx`) y el aviso al acabar. Puede ser una
     receta con `kind` propio o un trabajo aparte (`Craft.potion`).
2. **Tope.** Un máximo de pociones guardadas (`POTION_CAP`, por ejemplo 6, que suba con el nivel
   de la alquimia). El taller no deja empezar otra si ya está lleno.
3. **Dónde se ven.**
   - En la alquimia: «Pociones: 3 de 6».
   - En la barra o la ficha de la despensa, junto a las raciones, si encaja.
   - Al acabar, un aviso: «En la alquimia han preparado una poción».
4. **Textos** en `talleres.yaml` y `recetas.yaml` (es y en, con las mismas claves), con frases
   enteras.
5. **Pruebas:** crear una poción sube `s.potions`; sin hierbas no se puede; lleno, tampoco.
   Pasar `npm run sim`.

## Para otros agentes (si lo repartes)

- **Arte:** el icono de la poción (frasco verde) para la receta, la fila de la hoja y la mochila;
  y, si se quiere, el frasco en la mesa de la alquimia de la escena mientras se prepara.
- **Expediciones (yo):** cuando esté la receta, nada obligatorio. Si hace falta, cambio el icono
  provisional de la hoja (`MatIcon` de hierbas) por el de la poción.

## Hecho cuando

Se puede crear una poción en la alquimia; aparece en la hoja de una expedición; se gasta curando
por el camino; y las que sobran vuelven.
