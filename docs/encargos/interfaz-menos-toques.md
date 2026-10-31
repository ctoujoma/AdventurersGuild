# Encargo (interfaz): menos toques y cartas del amanecer una a una

Para el agente de interfaz. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md),
[`../plan.md`](../plan.md) (fases 1 y 4), [`../salas/README.md`](../salas/README.md) y tu
encargo anterior con sus hallazgos
([`interfaz-trabajadores-hallazgos.md`](interfaz-trabajadores-hallazgos.md)): los avisos de
aquí parten de `crewAlerts`.

Ahora el tiempo corre solo (fase 0) y hay incidentes que piden atención (`ui/IncidentMark.tsx`).
Cada toque que sobra pesa más. En este orden:

## 1. Grupo sugerido (prioridad alta)

En la hoja del encargo (`src/ui/QuestSheet.tsx`), un botón «Sugerir» que llena los huecos con
el mejor grupo que se pueda mandar ahora.

- **La regla, en el núcleo:** una función pura, por ejemplo `suggestParty(state, questId)` en
  `src/core/party.ts`, con tests. Elige entre los que pueden ir (`canSend`) el grupo que deja la
  mejor estimación (`questEstimate` en `core/resolve.ts`):
  - mejor sin heridos, sin la moral baja y sin quitar a nadie de guardia si hay otros;
  - que no busque entre todas las combinaciones: basta con ir sumando al que más mejora;
  - si nadie puede ir, nada (y el botón, apagado con el motivo).
- **En la hoja:** el botón pone la selección y el jugador puede cambiarla antes de enviar.
- **Comprobar:** tests del núcleo con grupos distintos y capturas de la hoja.

## 2. Repetir el último grupo (prioridad alta)

- Recordar quién fue la última vez (un campo opcional en la partida, por ejemplo
  `lastParty?: string[]`, que se apunta al enviar; sin tocar `SAVE_VERSION`).
- En la hoja, «Como la última vez» con los nombres; se salta a quien no pueda ir y lo dice
  («Brena sigue herida»).

## 3. Avisos de lo que pide atención

Ya hay avisos de la casa en Tareas (`crewAlerts`). Sumar lo demás que se olvida:

- un encargo que caduca hoy y nadie lo ha cogido;
- un grupo que vuelve (y los heridos sin cama en la enfermería);
- un pago que llega y no alcanza la caja;
- obras terminadas, o entrenamiento al tope del nivel de la sala.

**Dónde:** un solo sitio arriba (una campanita con su número, o la pestaña que tenga más
sentido). Tocar un aviso lleva a donde se arregla: la sala (con la cámara) o el panel. No
repitas los incidentes: ya flotan sobre su sala.

Pendiente de tu encargo anterior: un globito sobre la sala sin nadie, en la escena. Si lo
haces, toca `src/world/rooms/`: dilo en el PR (es zona del agente de arte).

## 4. Cartas del amanecer una a una

Hoy la carta del amanecer (`src/ui/Dawn.tsx`) enseña todo de golpe, con un retardo por línea.
Que sea un momento de revelar:

- las noticias se abren de una en una, tocando (o solas, con un ritmo corto);
- con sonido según el tipo (`k`: bien, mal, aviso, información; mira `src/audio`);
- lo bueno de verdad (botín raro o legendario, subir de rango, un héroe que vuelve de algo
  difícil) con su brillo. Para eso hace falta marcarlo: un campo opcional en `DawnEvent` (por
  ejemplo `rare?: boolean` o `big?: boolean`) que pongan el núcleo y el botín. Lo que toque
  de `src/core` para marcarlo, en un PR aparte y pequeño;
- «Saltar» para verlo todo de una vez, y que se recuerde en los ajustes;
- la carta de «Mientras no estabas» va por días (`head`): ahí, mejor un día cada vez.

Con muchas noticias (más de ocho o diez), que no se haga larga: agrupar las pequeñas («Tres
encargos caducan») o abrir solo las importantes y el resto en lista.

## Forma de trabajar

- Un PR por punto, contra `main`, con capturas a ancho de móvil y de PC.
- Si puedes, publica la versión de pruebas («Jarro: pruebas»).
- Espera el visto bueno del usuario antes de lo grande.

## Límites

- Reglas del juego nuevas, solo las de este encargo (sugerir el grupo, el último grupo, marcar
  lo raro). Si algo pide otra regla, pregunta.
- Sin tocar el arte de las salas (`src/world/rooms/salas/`).
- No cambies `SAVE_VERSION`: los campos nuevos de la partida, opcionales.
- Si tocas `App.tsx`, `RoomPanel.tsx` o `Dawn.tsx`, dilo en el PR: el agente principal también
  trabaja ahí (tiempo, incidentes, objetivos).
