# Encargo de arte: que lo que pasa se vea pasar

Feedback del usuario (6 de noviembre): a veces el mundo no enseña lo que hace la gente; alguien
aparece donde tiene que estar sin ir, o algo empieza antes de que llegue. Ir punto por punto,
con capturas, y poner al día `docs/plan-arte.md` al acabar cada uno.

Lo que ya ha hecho el agente principal (no tocarlo, usarlo):

- **La velocidad x2/x4 mueve también la escena**: `RoomScene.pace` (lo pone `App.tsx`). La gente,
  las puertas, los incidentes y las partículas van al ritmo del reloj; la cámara y el asalto no.
  Si algo de la escena cuenta tiempo con `this.t` y debería ir con el reloj, que use el tiempo
  de mundo (`wt`).
- **La sastrería espera al héroe**: el trabajo de vestir no empieza hasta pasada una hora de
  juego (`DRESS_WALK`), lo que tarda en llegar. `SceneCraft.walking` dice que aún va de camino.

## Puntos

1. **Auditoría.** Recorrer las salas y los momentos (contratar, despedir, arrastrar, salir y
   volver de encargo, herido a la enfermería, entrenar, talleres, incidentes, asalto, noche y
   mañana) y apuntar en `docs/plan-arte.md` cada caso en que alguien aparece, desaparece o
   empieza algo sin que se vea. Arreglar lo que sea de escena; lo que necesite al núcleo,
   decirlo en el PR y el agente principal lo hace.
2. **Sastrería:** con `walking`, el sastre espera (mira hacia la puerta, prepara la cinta) y no
   cose hasta que llega el héroe; entonces le mide, le prueba y cose (punto 11 de
   `arte-talleres.md`).
3. **Contratar a un trabajador:** sale de la barra (donde esperaba) y va andando a su sala, en
   lugar de aparecer en ella. Al contratarle, un efecto sobre él (un destello o unas monedas
   que saltan y un «¡Contratado!» pequeño). Lo mismo con un héroe nuevo.
4. **El ladrón del tesoro:** al llegar el héroe huye, pero ahora sale muy deprisa y desaparece
   al cruzar la primera puerta. Que huya a una velocidad que se pueda seguir, sala a sala, por
   las escaleras y el recibidor, perdiendo monedas, hasta el patio y el camino; el héroe detrás
   un trecho. Nada de desaparecer dentro de la casa.
5. **El rótulo de la taberna:** al tocarlo se balancea como si le hubieran dado un golpe (unas
   oscilaciones que se apagan, con un crujido de cadenas si hay sonido). Si no tiene zona para
   tocar, añadirla sin quitar las que hay.
6. **Arrastrar a alguien (pendiente de que el usuario decida, ver
   [`../propuesta-asaltos.md`](../propuesta-asaltos.md), punto 3):** si se decide que va andando,
   hará falta una marca en la sala de destino (su silueta o un banderín con el icono de la
   tarea) que dure hasta que llegue, y que vaya a paso ligero. El agente principal hará la parte
   de la lógica (`crowd.drop`, la tarea al llegar); a arte le tocará la marca.

Rama propia, PR contra `main`. Si se toca `crowd.ts` o `App.tsx`, decirlo en el PR.

## Auditoría (7 de noviembre) y lo arreglado

Recorrido de los momentos en que alguien aparece, desaparece o algo empieza sin que se vea.

| Momento | Antes | Ahora |
| --- | --- | --- |
| Vestir en la sastrería | Empezaba a coser tras 1 h fija, llegase o no el héroe | Empieza **cuando la escena le ve llegar** a la sala (`Crowd.onArrive` → acción `arrived` → `arrive()` en `core/crafting.ts`). `Craft.wait` marca que aún va de camino; si nadie avisa (sin 3D, app cerrada), empieza a las `DRESS_WALK` (2 h) como mucho. Mientras, el sastre le espera junto al probador sin coser |
| Contratar a un trabajador | No estaba en la escena hasta contratarlo y aparecía en su sala | Los trabajadores que buscan casa esperan en la barra (como los héroes candidatos; si no caben, a su lado). Al contratarlo da un salto de alegría con destellos y monedas y va andando a su sala |
| Contratar a un héroe | Iba andando, sin más | Igual que el trabajador: salto, destellos y monedas |
| Despedir (héroe o trabajador), candidato que se va | Se esfumaba donde estuviera | Sale andando por la puerta y se pierde en el patio |
| Cambiar de tarea o de guardia | Acababa antes el paseo que llevaba (hasta 15 s); la guardia no se notaba hasta su siguiente decisión | Va ya a lo nuevo |
| El ladrón del tesoro | Corría a 45–60 y desaparecía al llegar a la pared de la cámara | Huye por el camino de la gente: sala a sala, las escaleras, el recibidor y el patio hasta el camino, a 44–50 (quien anda va a 36), perdiendo monedas si se sale con la suya; las puertas se le abren |

Queda (sin hacer):

- **Arrastrar a alguien:** sigue apareciendo donde se suelta (lo lleva el dedo, así que se ve).
  Si se decide que vaya andando (ver [`../propuesta-asaltos.md`](../propuesta-asaltos.md), punto 3),
  la tarea debería empezar con `onArrive` como la sastrería.
- **El héroe que persigue al ladrón** un trecho: no hecho (el ladrón ya huye de verdad).
- **Entrenar y talleres:** el entrenamiento y lo que se crea en la forja o la alquimia cuentan
  desde que se manda, no desde que llega quien trabaja. Se nota poco (los talleres ya tienen a
  su gente dentro); si molesta, se hace como la sastrería con `onArrive`.
- **Obras:** quien se queda sin camino tras una obra aparece en la puerta.
- Puntos 2 (el sastre que mide y prueba al llegar, más arte), 5 (el rótulo) y 6, como arriba.
