# Encargo de interfaz: tres ranuras y materiales

Del usuario (8 de noviembre): equipo con sentido para los talleres, con una forma **cómoda y
simpática** de verlo. Lo decidido, en
[`../propuesta-noche-expedicion-equipo.md`](../propuesta-noche-expedicion-equipo.md) («Equipo: lo
decidido»). El núcleo ya está; esto es lo que falta. Rama propia, PR contra `main`, con capturas.

## Lo que ya hace el núcleo

- **Tres ranuras** (`core/gear.ts`): `Hero.worn` con `arma`, `cuerpo` y `complemento`. `slotOf(item)`
  dice la ranura de cada objeto; `SLOT_NAMES`, el nombre. `equip` pone el objeto en su ranura (y
  devuelve al arcón lo que hubiera); `unequip` acepta `slot` (sin él, lo quita todo). Las partidas
  de antes pasan su objeto a su ranura al cargar. La ficha y el Arcón ya funcionan con tres
  ranuras, pero en lista: falta hacerlo bonito.
- **Materiales** (`core/materials.ts`): hierro, cuero y tela (los raros, más adelante).
  `s.mats`, `matCap`, `MATERIALS` (nombre, de dónde sale, para qué sirve). Los encargos traen el
  suyo al volver (`QUEST_MATERIAL`, 1–3 según cómo salga: chip «+2 cuero» en el informe). Sin
  almacén caben 10 de cada; lo que no cabe se vende solo y el informe lo dice, con el aviso de
  construir el almacén (o de que se podrá al pagar la deuda).
- **Almacén** (sala `almacen`, en la pestaña Gremio): guarda más por nivel y por hueco.
- **Recetas con materiales** (`RECIPES[x].mats`): espada larga, cota de malla, escudo tachonado,
  ganzúas templadas, botas de cuero y capa forrada. `canCraft` dice lo que falta («Faltan 2 de
  hierro: sale limpiando guaridas e investigando»).
- **Mejorar** (`temper`): un objeto del arcón, en su taller, +1 a su habilidad principal hasta +3
  (`temperCost`, `canTemper`, acción `temper`). Desmontar devuelve 1 de su material.

## Lo que falta

1. **El estante de materiales**, arriba del Arcón: un tarro o caja por material con su dibujo y la
   cifra (y el tope: «7/10»). Al tocarlo, `MATERIALS[m].from` y `.uses`. Si no hay almacén, una
   línea: «Sin almacén caben 10 de cada».
2. **Al volver un grupo**, los materiales saltan del informe al estante (como las monedas), con
   el «+2 cuero».
3. **El muñeco de la ficha**: las tres ranuras con su silueta si están vacías (arma, cuerpo,
   complemento). Tocar una abre lo que cabe en ella del arcón, con lo que cambia cada habilidad.
4. **Recetas en la ficha del taller** (`WorkshopInfo.tsx`): debajo del nombre, los materiales que
   piden con su dibujo, en verde si los hay y en gris con lo que falta si no. Y un botón
   **«Mejorar»** para los objetos del arcón de ese taller, con lo que cuesta (oro y material) y
   el «+1» que gana. Los objetos mejorados enseñan su «+N» en todas partes.
5. **En el tablón**, junto a la paga, el dibujito del material que trae cada encargo.
6. **El aviso del rincón lleno**: el chip del informe ya lo dice; además, la primera vez, una nota
   que lleve a construir el almacén (o que diga que se podrá al pagar la deuda).

Si tocas `App.tsx`, dilo en el PR.

## Hecho en la interfaz (8 de noviembre)

Capturas en `capturas/equipo/`. Piezas comunes en `ui/mats.tsx` (`MatIcon`, `MatCost`,
`MatShelf`, `chipMat`) y dibujos nuevos en `ui/icons.tsx` (`lingote`, `cuero`, `tela`, `hierbas`,
`madera`, `cristal`; arte puede retocarlos).

1. **Estante** arriba del Arcón: un tarro por material con «7/10» (dorado si está lleno); al
   tocarlo, de dónde sale y para qué sirve. Sin almacén: «Sin almacén caben 10 de cada».
2. **Salto**: los «+2 cuero» del informe llevan su dibujo y, al abrir la carta (una vez por
   informe), saltan a la pestaña Gremio, donde está el Arcón (`flyTo` en `coinFlight.ts`).
3. **Muñeco**: las tres ranuras con lo que lleva o su silueta; tocar una enseña lo que cabe del
   arcón con lo que cambia cada habilidad («Combate 7 → 10») y deja quitar lo puesto.
4. **Taller**: los materiales de cada receta (verde si los hay; gris con lo que falta) y la
   sección «Mejorar» con oro, material, horas y el «+1» que gana; el trabajo se lee «Mejorando
   … a +N». El «+N» sale en el nombre (`itemName`) y suma en `itemEffect`.
5. **Tablón**: el dibujo del material junto a la paga (y en la hoja del encargo, con su nombre).
6. **Rincón lleno**: aviso en la campanita (`almacen-lleno`) que abre las obras con el almacén
   elegido o, con la deuda, lleva al Gremio; descartado, no vuelve.
