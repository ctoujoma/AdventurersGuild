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
