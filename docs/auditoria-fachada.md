# Auditoría: las paredes de fuera (fachada)

Con la vista desde fuera (zoom al mínimo, tapa puesta) se ve la fachada entera, y se nota que
la textura se repite: la misma tabla de arriba abajo y de punta a punta. Esto es lo que se ha
visto y lo que se propone, por orden de lo que más se nota a lo que menos.

Código: `wallFace` y compañía en `src/world/rooms/muros.ts` (tablas, entramado, sillería) y
`materiales.ts` (troncos, ladrillo, tapial, lajas, encalado); la tapa, `outsideFace` en
`textures.ts`; los costados, `outerSide`. Captura de referencia: la vista desde fuera de día
(`tools/shots/_fuera.mjs`).

## Lo que se ve

1. **Sin variación a gran escala.** Las tablas tienen ruido de tabla a tabla, pero ningún
   cambio a lo grande: la planta baja, la de arriba y el hastial tienen el mismo tono. Una
   pared de verdad está más oscura y húmeda abajo, más pálida arriba (sol), manchada bajo los
   alféizares y bajo el alero, y con algún paño reparado de otro color.
2. **Un ritmo demasiado parejo.** Las tablas miden 5–7 y el tapajuntas va cada tres: a
   distancia se lee como una trama regular, como un código de barras.
3. **Los clavos, en filas de puntos claros a la misma altura.** De lejos parecen una
   perforación, no clavos. Mejor menos, más oscuros y algo descolocados.
4. **Las ventanas de la tapa, todas iguales** (mismo tamaño, mismo marco y a la misma altura)
   y sin nada alrededor: sin dintel, sin contraventanas y sin jardinera. Al lado del resto de
   la escena se ven pobres.
5. **Sin zócalo.** La pared llega a la tierra sin un zócalo de piedra: le falta peso abajo, y
   así cualquier casa de madera de verdad se pudre.
6. **Las vigas de cada planta son una banda plana** del mismo color de punta a punta, sin
   testas de viga ni sombra debajo.
7. **Nada vivo en la pared:** hiedra, una escalera apoyada, leña apilada, un tonel de lluvia,
   el banco de la puerta. Son detalles que rompen la repetición y que el jugador recuerda.
8. **Los demás materiales** (entramado, piedra, ladrillo…) tienen el mismo problema: varían de
   pieza a pieza, pero no a lo grande.

## Propuesta (en este orden, cada paso con capturas antes y después)

1. **Capa de envejecimiento a lo grande** (para todos los materiales): un ruido de baja
   frecuencia fijo por pared que oscurece, aclara o calienta por paños; la humedad del pie,
   que sube mellada; los churretes bajo cada alféizar y bajo el alero; y el sol, que aclara lo
   alto. Se aplica después de pintar el material, sobre la paleta, por escalones (sin
   degradados).
2. **Romper el ritmo de las tablas:** anchos de 4 a 9, tapajuntas a saltos irregulares, algún
   tramo de tablas horizontales o en diagonal (un remiendo) y alguna tabla más clara, nueva.
3. **Clavos:** más oscuros, solo en algunos cruces y con algún hueco.
4. **Zócalo de piedra** en la planta baja (2–3 hiladas, con musgo en las juntas de abajo).
5. **Ventanas de la tapa variadas:** dos o tres modelos (de cuarterones, de arco, con
   contraventanas abiertas o una cerrada), dintel de madera, alguna jardinera, y más grandes
   en las salas importantes (el salón).
6. **Las vigas:** testas de viga que sobresalen cada tanto, con su sombra debajo.
7. **Detalles sueltos al azar** (fijos por partida), pocos: hiedra en una esquina, leña bajo
   un alero, el tonel de lluvia junto a una bajante y una escalera apoyada.
8. **Repaso del resto de materiales** con la misma capa del punto 1 y lo que cada uno pida.

Medir que la textura no se vuelva ruido: de lejos se tiene que leer «pared de tablas vieja»,
no un granulado. Y comprobar el relieve (luz con ambiente), que ya lee la altura de cada
pincelada (`b.level`).
