# Encargo de interfaz: plazos en días, ficha con candados, aviso de tope

Feedback del usuario (7 de noviembre). Rama propia, PR contra `main`. Ir punto por punto, con
capturas.

## 1. Los plazos, en días de juego

Con el tiempo que corre solo (por defecto), `ui/when.ts` (`left`, `span`, `shortLeft`) dice los
plazos en minutos reales: «llega en 12 min». Para el asalto no tiene sentido: tiene que decir
**«esta noche»**, **«mañana por la noche»** o **«en 3 noches»** (mapa, `MapPanel.tsx` ~694, y
donde más salga el asalto). Revisar el resto de usos (vuelta de misión, caducidad del tablón,
ficha del héroe en `App.tsx`) y pasarlos también a días u «hoy / mañana», salvo que algo pida de
verdad minutos (decidirlo y decirlo en el PR). Los tests de `when.test.ts`, al día.

## 2. Personalizar al héroe: con candados y por la sastrería

Ahora en la ficha (`HeroCard.tsx`, el bloque «Sastrería (prueba): tinte») se toca un color o una
prenda y cambia gratis, al momento.

- Llevarlo a un **submenú de la ficha** («Ropa y colores»). Mientras está abierto, **la cámara
  sigue al personaje** (hará falta un `follow(id)` en `RoomScene`; si ya hay algo para centrar,
  usarlo).
- Cada opción enseña su estado: **libre** (ya es suya), **bloqueada por no tenerla** (candado y de
  dónde sale, como hacen los temas de color de las salas con `unlockSource` en `RoomPanel.tsx`)
  o **bloqueada por dinero** (cuesta `DRESS_GOLD` y no llega).
- Si se tiene y se puede pagar: el botón **crea el encargo en la sastrería** (la acción que ya
  usa el trabajo de vestir, `core/crafting.ts`); el héroe va andando y el sastre le viste. Si la
  sastrería está ocupada o no hay sastre, decirlo («La sastrería está con Bruna: acaba en 2 h»).
  Sin sastrería, decir que hace falta.
- Lo de probar gratis, solo en el modo prueba.

## 3. Entrenar al máximo: que se note

En una sala de entrenamiento, al llegar al tope (`capFor` en `core/training.ts`: por sala o por
nivel), la barra desaparece y el héroe se queda sin aviso. Que haya feedback: un aviso al
llegar («Bruna ya no aprende más Fuerza aquí: sube de nivel o mejora la sala», con `capHint`),
la barra llena con «Al máximo» en la ficha de la sala y un marcador sobre él en la escena. Y que
se pueda mandarle a otra cosa desde el aviso. Si quedarse ahí aún le sirve de algo, decirlo; si
no, proponer en el PR que se vaya a descansar solo.

Si tocas `App.tsx` o `RoomScene.ts`, dilo en el PR (otros agentes también los tocan).

## Hecho en el núcleo (agente principal, 7 de noviembre)

- **Ropa (punto 2):** `dressStatus(s, heroId, dress)` en `core/crafting.ts` dice cómo está cada
  opción: `ok` (con la `room` de la sastrería libre: se despacha `dressAt` con ella), `same`, `lock`
  (con de dónde sale en `why`), `gold`, `none` (no hay sastrería), `away`, `sewing` (ya le están
  cosiendo) y `busy` («La sastrería está con Bruna: acaba en 2 h», con `hoursLeft`). Las prendas no
  tienen candado; los tintes sí. La acción `dress` (gratis, al momento) se queda solo para el modo
  prueba: la ficha normal no debe usarla.
- **Tope de entrenamiento (punto 3):** quien llega al tope **deja la sala al amanecer** y la carta lo
  dice («Bruna deja la sala de armas: ya no aprende más Fuerza ahí. Para seguir, …»). Para el aviso
  en directo, `cappedTrainees(s)` en `core/training.ts` da quién sigue en una sala sin poder subir
  (con `by`: `sala` o `nivel`), y `capLeaveText` el texto. Falta en la interfaz: el aviso al llegar,
  «Al máximo» en la ficha de la sala y el marcador en la escena; y no dejar soltar ahí a alguien que
  ya está al tope (o avisarlo al soltar).

## Hecho en la interfaz (7 de noviembre)

- **Plazos (1):** `ui/when.ts` ya no cuenta en minutos: `dawnIn` («hoy», «mañana», «pasado
  mañana», «en 4 días») para vueltas, obras, notas y pagos, y `nightIn` («esta noche», «mañana por
  la noche»…) para el asalto. Solo la barra del día sigue en minutos (`countdown`). Arreglado de
  paso: el asalto en directo miraba un día tarde (`App.tsx` y `raidFought`) y nunca se jugaba.
- **Ropa (2):** pestañas en la ficha del héroe («Ficha» y «Ropa y colores»); la cámara le sigue
  (`RoomScene.follow`) mientras está abierta. Encarga con `dressAt`; «Probar gratis», solo en el
  modo prueba.
- **Tope (3):** aviso en la campanita (lleva a Tareas con él), «Al máximo» con la barra llena en
  la ficha de la sala y en el selector de tareas, y una estrella junto a su barra en la escena.
- **Extra:** aviso con lo que salió de desmontar un objeto (`CraftEnd.undo`).
