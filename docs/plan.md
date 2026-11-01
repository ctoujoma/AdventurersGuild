# Plan del juego completo

Lo decidido con el usuario en la página «Rumbo del Jarro» (sus respuestas se leen con la
herramienta de datos del artefacto). Aquí está el orden y quién hace qué. Lo que no está aquí,
o está en «Más adelante», no se toca sin preguntar. El detalle de cada idea está en
[`futuro.md`](futuro.md).

## Dirección

- **Como Fallout Shelter, pero nuestro:** una sola partida infinita, sin final ni legado entre
  partidas. Un bucle que engancha (objetivos, incidentes, rumores, rangos que abren cosas) y lo
  que lo hace distinto: héroes con nombre e historia que pueden morir, la taberna como negocio
  y de donde salen las aventuras, y las cartas del amanecer.
- **Gratis:** cosméticos, anuncios opcionales (acelerar entrenamiento o curación, con tope al
  día; solo en la app) y donaciones. Nada de pagar por ganar.
- **Tecnología:** seguir en web (TypeScript, Preact, three.js) y empaquetar: Capacitor para
  Android e iOS, Electron o Tauri para Steam. Medir pronto el 3D en un Android modesto.
- **Textos preparados para traducir** (inglés primero) antes de que crezcan más.

## Quién hace qué

- **Agente principal** (esta conversación): tiempo, núcleo del bucle, tutoriales, combate,
  talleres y amigos.
- **Agente de interfaz:** auditoría de trabajadores y tareas (hecha:
  [`encargos/interfaz-trabajadores.md`](encargos/interfaz-trabajadores.md)), y ahora menos
  toques y cartas del amanecer una a una:
  [`encargos/interfaz-menos-toques.md`](encargos/interfaz-menos-toques.md) (las cartas, junto
  con revisar cuándo sale la carta). Ahora, la primera vez que se abre el juego:
  [`encargos/interfaz-primera-vez.md`](encargos/interfaz-primera-vez.md).
- **Agente de arte:** colores por sala, animaciones y escaleras (hecho:
  [`encargos/arte-colores-animaciones.md`](encargos/arte-colores-animaciones.md)), y ahora
  fachada por partes y preparar la sastrería (hecho:
  [`encargos/arte-fachada-sastreria.md`](encargos/arte-fachada-sastreria.md)). Siguiente:
  dibujar los tres jefes nuevos (fase 5), y luego la tira del encargo en directo (fase 3).
  Encargo: [`encargos/arte-incidentes-jefes.md`](encargos/arte-incidentes-jefes.md)
  (incidentes que se ven y responden al tocar, y los jefes).

Para arrancar a cada uno: «Lee `CLAUDE.md`, `docs/plan.md` y `docs/encargos/<encargo>.md`, y
empieza por el punto 1».

Cada uno en su rama, PR contra `main`, sin pisarse: quien toque fuera de su zona lo dice en
el PR.

## Fase 0 · El tiempo (decidido: días que corren solos)

Decidido con el usuario: el tiempo corre solo, también con el juego cerrado (12 veces más
despacio, a afinar). Es el modo normal; los «días a la antigua» quedan en Ajustes › Modo prueba
(`classicTime`).

- **Acelerar:** el botón de velocidad sigue mientras dura «La deuda» y en el modo prueba (para
  probar). Más adelante, quizá de pago.
- **Pagos estando fuera:** nunca se pierde estando fuera. La víspera de un pago que no llega,
  la simulación se para a la tarde (`dueTonight` en `core/away.ts`) y la carta lo avisa.
  Pendiente: en la app de Android, una notificación local el día antes de cada pago.
- **Escala:** con el juego abierto, un día son 5 minutos (una hora del juego, unos 12 s); cerrado,
  un día por hora real. Fallout Shelter usa horas reales: si se quiere ese ritmo, se alarga el
  día (`DAY_SECONDS`).

- El día corre solo: al llegar la noche, cae sola (con su asalto o sin él) y amanece; el
  «Anochecer» queda para dormir antes de tiempo.
- Más rápido con el juego abierto que cerrado: abierto, como ahora (un día cada 5 minutos);
  cerrado o en segundo plano, un día por hora real, con un tope de días.
- Al volver se simula de golpe lo que ha pasado (como Fallout Shelter): viajes, caja,
  entrenamiento, curación, sueldos. Los asaltos, menos probables y resueltos solos. Una carta
  de «Mientras no estabas» lo resume por días.
- Las cifras (ritmo cerrado, tope, probabilidad de asalto) en `balance.ts` para afinarlas.
- Cómo está hecho: `core/away.ts` (`catchUp`: simula lo de fuera y junta la carta),
  `endDay(state, away)` (asaltos a `AWAY_RAID`), el interruptor `realTime` en los ajustes y,
  en `App.tsx`, la hora que se guarda con cada guardado (`lastSeen`), la vuelta tras ocultar la
  pestaña o al continuar, y la noche que cae sola cuando no hay paneles delante.
- La barra no tiene «Cerrar» y dice cuánto falta para que anochezca o caiga la noche; los
  plazos (viajes, caducidad, vuelta de los grupos, obras, entrenamiento, pagos, chivatazos) se
  cuentan en minutos de taberna abierta (`ui/when.ts`).

## Fase 1 · Bucle infinito

1. **Auditar trabajadores y tareas** (interfaz): quién hace qué, dónde se ve y cómo se
   ordena; ahora es confuso. Antes de sumar sistemas.
2. **Objetivos siempre activos** (hecho): siempre tres; al cumplir uno se cobra en el momento y
   sale otro. Los de contar se repiten pidiendo más; los de salas y los de llegar a algo, una
   vez y en serie (la cocina a 2, luego a 3; hierro, luego plata). Sustituyen a los desafíos del
   mes. Se ven en el Gremio, y el Libro guarda lo cumplido (día y premio). Datos en
   `data/goals.ts`, reglas en `core/goals.ts`. Falta: más variedad («gana un asalto sin
   heridos», «sirve 40 jarras»).
3. **Premios que se ven** (hecho): hazañas y objetivos dan piezas de fachada (tejado, paredes,
   rótulo, jardineras) y temas de color de las salas (`data/unlocks.ts`). Las que no se tienen
   salen apagadas y dicen de dónde se ganan; en el modo prueba, todas. Falta: tintes y prendas
   de la sastrería, cuando llegue la sala.
4. **Rangos que abren cosas:** Cobre, Hierro, Plata, Oro y Leyenda (ya existen, por
   reputación). Cada rango abre algo:
   - plantas, hasta 6 por encima de la baja (hecho);
   - los niveles nuevos de las salas (hecho, ver `salas/niveles-nuevos.md`), con aviso al
     amanecer al subir de rango;
   - encargos y jefes de más dificultad para cada tramo (hecho): los encargos sueltos suben con
     el rango, y hay historias con jefe para cada tramo alto: Plata (la torre, el Rey Ahogado),
     Oro (la sierpe, el jabalí de ceniza, 250 de fama) y Leyenda (la Reina de la Cripta, 320, y
     la dragona de la Corona Blanca, 420), con sitios nuevos en los bordes del mapa. Los tres
     jefes nuevos pelean como su `base` (`data/bosses.ts`) y tienen su dibujo propio (hecho,
     `art/bosses.ts`). Al acabar todas, ya no llegan más: valorar historias que se
     repitan o una por temporada;
   - salas nuevas (la sastrería, cuando llegue).
5. **Incidentes en la taberna.** Formas de resolverlos:
   - arrastrar héroes (pelea, ladrón, algo en la bodega) o trabajadores (fuego en la cocina,
     barril roto);
   - tocar un icono flotante y pagar (el recaudador, una gotera);
   - tocar varias veces (ratas);
   - elegir (un noble borracho).

   Sin resolver, salen mal. Hecho: `data/incidents.ts` (los siete), `core/incidents.ts` (reglas
   y tests), `ui/IncidentMark.tsx` (el aviso sobre la sala) y `ui/drop.ts` (arrastrar a quien
   lo arregla). Solo con el juego abierto, desde el día 2 y de uno en uno; lo que quede al caer
   la noche sale mal y va a la carta. Cifras en `balance.ts` (`INCIDENT_*`).
6. **Revisar el cobro de la deuda** con Merlo (ver «Pendiente de revisar»).
7. **Rumores de la barra** (hecho): con el juego abierto, desde el día 2, un bocadillo dorado
   sobre una mesa del salón unos 15 s. Si se toca a tiempo, sale un encargo marcado «Rumor»
   (mejor paga, botín bueno o legendario, caduca en 2 días); si no, se pierde sin más. Uno a la
   vez. `data/rumors.ts`, `core/rumors.ts`, `ui/RumorMark.tsx`; cifras `RUMOR_*`.

8. **Entrenamiento con tope por nivel** (revisar): hoy el tope de cada atributo lo pone solo
   el nivel de la sala (5, 7, 9 y 11; `TRAIN_CAP`) y no el del héroe; al subir de nivel, el
   atributo principal sube 1 pero sin pasar de 10, así que quien ya está entrenado al máximo
   no gana nada. Propuesta: tope = el menor entre el de la sala y uno por nivel del héroe
   (por ejemplo 4 + nivel); subir de nivel sube ese tope y el punto de nivel nunca se pierde.

## Fase 2 · Tutoriales

De un **agente propio del tutorial** desde el 1 de noviembre: [`encargos/tutorial.md`](encargos/tutorial.md).

### 2a · El primero, hasta el primer pago (hecho, rehecho tras la revisión)

Revisión del usuario: tenía que bloquear lo demás, no dejar pasar sin hacer el paso, resaltar
lo que hay que tocar y no romper la inmersión. Ahora:

- **Empieza con la carta del tío** (`ui/IntroLetter.tsx`, `LETTER` en `core/tutorial.ts`), en
  lugar de la carta del día 1: murió, deja la taberna, la deuda y su cuaderno.
- **Las lecciones son páginas del cuaderno de Fausto** (`ui/TutorialNote.tsx`), escritas para
  quien viniera detrás; sin retrato. Las notas sueltas del tío (`ui/tips.ts`) también.
- **Foco que bloquea:** todo queda oscurecido y sin respuesta salvo lo que hay que tocar, con
  un marco que late (`ui/TutorialFocus.tsx`; a qué apunta cada paso, en `ui/tutorialFocus.ts`
  con marcas `data-tut` en los botones). Si algo abierto tapa lo que toca, se señala «cerrar».
  Arrastrar a alguien deja libre la escena.
- **Sin «Seguir» en los pasos que piden algo:** solo se pasa haciéndolo (el reductor no deja
  avanzar con el botón).
- Pasos: el primer encargo (tablón → encargo → «Sugerir» → «Enviar»), contratar en la barra,
  poner nombre al nuevo, arreglar la enfermería, mover a alguien a la cocina, saltar hasta la
  vuelta, leer el informe, dar el equipo, el herido (si lo hay), las ratas, el rumor, mandar su
  encargo, los objetivos, saltar al día 7 y pagar. Si falta dinero (prima, enfermería, pago),
  aparece entre las hojas del cuaderno.
- Reloj parado mientras dura; «Ya sé jugar» lo salta entero.
- Los incidentes ya se ven en su sala y las ratas responden al tocar (arte). Pendiente: la pantalla de
  inicio (encargo de interfaz), candados en el mapa y los adornos y que la barra diga que el
  reloj está parado.

### 2b · El segundo, las obras (cuando la taberna es tuya)

Al pagar la deuda: construir una sala nueva, moverla, ampliarla, mejorar otra y excavar un
hueco, con la cámara en cada paso. Sustituye a las notas de obras de ahora (`obras`, `plano`,
`excavar`, `servicio`).

## Fase 3 · Combate con decisiones (y encargos en directo)

- **El encargo en directo** (propuesta del de arte:
  [`encargos/propuesta-panel-encargo.md`](encargos/propuesta-panel-encargo.md)): una ficha
  nueva, «Encargo en curso», que se abre al tocar un grupo fuera (en la lista bajo el mapa, en
  su marca del mapa o en un aviso). Arriba, **la tira animada** como en Fallout Shelter (el
  grupo de ida, haciendo lo suyo según el tipo: pelea, exploración, escolta… y de vuelta);
  luego el encargo, los retratos con su estado, el viaje por partes (ida, llegada, lo suyo,
  vuelta) con la de ahora marcada, y el diario de lo que va pasando. El núcleo da las partes,
  los sucesos con su momento y una semilla, para que se vea igual al cerrar y abrir.
  **Reparto:** el agente principal hace los datos y la ficha con el hueco (hecho:
  `core/journey.ts`, `ui/TripSheet.tsx`); el de arte dibuja la tira (`QuestStrip`).
  **La tira es la línea de tiempo** (usuario, con la exploración de Fallout Shelter de
  referencia): los héroes animados encima de la línea de las partes, andando, peleando contra
  enemigos según el encargo (familias de enemigos reutilizables: bandidos, trasgos, bestias,
  alimañas, muertos y grandes) y cojeando si van heridos.
  **Hecho, la tira** (agente de arte): `ui/QuestStrip.tsx` y los enemigos por familias en
  `art/foes.ts` (también para asaltos y esbirros).
  **Hecho:** el encargo se resuelve al acabar lo suyo, no al volver: llega el informe (con el
  oro y el botín) «por aviso» y el grupo emprende la vuelta con cómo ha quedado cada uno.
  **Hecho, el jefe que espera:** la pelea contra un jefe no va en la tira. Al llegar al jefe el
  viaje se para y sale un aviso («Ver la pelea», «Que se las apañen» o «Luego»), también en la
  campana y en la ficha del viaje. Si no se dice nada, se resuelve al caer la noche (y siempre
  con el juego cerrado). La tira enseña al grupo parado ante la silueta del jefe (`waiting`).
- **Pelea interactiva (primera versión hecha, contra jefes):** la pelea es de verdad
  (`core/combat.ts`): vida, ataque y defensa, cada uno a su ritmo, y una habilidad por clase con
  recarga (Provocar, Puñalada, Bola de fuego, Curar, Andanada). El jefe avisa antes de su golpe
  fuerte y «¡Cubríos!» a tiempo lo deja en un tercio. El jugador arrastra (o toca) a un héroe
  hasta un enemigo para elegir su blanco, lanza habilidades y se cubre; sin tocar nada, va igual
  que «Que se las apañen». Determinista: el núcleo la vuelve a jugar con las órdenes y el informe
  la repite igual. Calibrado con `npm run calib`: sola sale como la tirada de antes (≈ 80 %);
  jugando bien, unos 6–8 puntos más.
  **Falta:** formación, táctica y objeto antes de entrar; llevarla a los asaltos a la taberna.
- **Críticos con gesto (hecho):** tras un golpe, a veces sale un rombo amarillo sobre el héroe;
  si se toca (el héroe o su ficha) antes de su siguiente golpe, entra crítico. Sin jugador, la
  IA acierta la mitad (como el 10 % de antes). Números de daño en la escena (cifras de píxel:
  blanco, amarillo el crítico, rojo el que reciben los héroes, verde las curas).
- **Vida y ataque de los enemigos:** los de los jefes salen de lo que pide el encargo (hecho,
  `FOE_TUNE` en `core/combat.ts`); faltan los bandidos de los asaltos.
- Después, el torneo de la comarca (armas romas, premio de trofeo).

## Fase 4 · Talleres: fabricar objetos

- **La forja fabrica armas** y, con salas nuevas, el resto: armaduras (armería o un taller de
  armero), botas y capas (curtidor o la sastrería), amuletos (la capilla o un taller de
  alquimia).
- **Recetas:** unas básicas desde el principio; cada una tarda horas de juego y cuesta oro
  (y quizá materiales del botín).
- **Recetas que se ganan:** como premio de encargos e historias, o **desmontando** un objeto
  para intentar sacar su receta (puede salir o perderse el objeto).
- Encaja con la sastrería (tintes y prendas) y con los premios que se ven.

## Fase 5 · Aspecto y pulido (arte, en paralelo desde ya)

- Colores por sala, fachada por partes y sastrería preparada (hecho).
- **Dibujar los tres jefes nuevos** (jabalí de ceniza, Reina de la Cripta, dragona de la
  Corona Blanca): hecho, cada uno con su dibujo y sus efectos (brasas, polvo y luz violeta con
  muertos pálidos, escarcha).
- **Cartas del amanecer como pila** (ver «Pendiente de revisar»): en pantalla, una pila de
  cartas que se pasan de una en una (tocando o deslizando), cada una con su sonido (bien, mal,
  aviso) y lo gordo con brillo; con «Saltar» para verlo todo. Para que no sea pesado, lo menudo
  se junta en una carta («La taberna»: jarras, raciones, incidentes, objetivos) y solo van
  aparte los encargos que vuelven y lo importante (un pago, una muerte, un rango, un
  legendario).
- Otra pasada crítica a las animaciones, y escaleras con mejor arte y personajes que suben
  de verdad.

## Fase 6 · Amigos

- Visitar tabernas por enlace (solo mirar).
- Combate por código contra el grupo de un amigo, que pelea con sus tácticas guardadas.

## Fase 7 · Lanzamiento

- Traducciones.
- App de Android: guardado nativo, avisos (también el del pago de Merlo el día antes),
  anuncios opcionales, cosméticos y donaciones.
- Sistema de eventos y novedades periódicas (jefes, encargos, fiestas), y cartas selladas.
- Lista grande de jefes y encargos para ir ampliando.

## Hecho hace poco (arte)

- **Encargos repartidos:** la tira deshace el camino y no engaña con el resultado; el mapa, en
  pergamino o a color según la sala de mapas (`encargos/arte-tira-vuelta-mapa.md`). Lo de
  interfaz (avisos que se descartan y el mapa grande) también está.
- **Enemigos pintados a mano** (`art/foeSprites.ts`): trasgos, orcos, esqueletos, trols, lobos,
  jabalíes, osos, ratas, arañas, limos y espectros.
- **El fondo, a color y vivo** (`world/parallax.ts`, `world/rooms/life.ts`): las capas lejanas
  tienen versión de día (montañas con nieve, colinas con campos, aldea, molino y castillo,
  bosques) que se funde con las siluetas de la noche; pájaros, humo de las chimeneas, aspas del
  molino, bandera, luciérnagas y estrellas fugaces. En el patio, pradera con flores y matas que
  mueve el viento a rachas (`art/grass.ts`). Capturas: `tools/shots/fondo.mjs`.

## Pendiente de revisar

- **Pelea contra jefes, perfilarla antes de llevarla a los asaltos** (ver la propuesta en el
  último punto de situación).

- **El cobro de la deuda con Merlo** (lo hecho con los agentes de arte e interfaz): que encaje
  con el tiempo que corre solo, los pagos estando fuera (`dueTonight`), los avisos y los
  objetivos.
- **La carta del amanecer** («Amanece sobre…»): **hecho lo primero:** con la app abierta ya no
  tapa la pantalla; al amanecer queda un botón «Día N · ver el parte» (borde rojo si hay algo
  malo) y la carta solo se abre al tocarlo. Sigue entera al volver tras una ausencia, en los
  saltos del tutorial y al acabar la partida. Falta la pila de cartas (fase 5).
- **El ritmo del tiempo:** un día son 5 minutos abierto y una hora cerrado; si se quiere más
  calma, alargar `DAY_SECONDS`.
- **Objetivos:** más variedad («gana un asalto sin heridos», «sirve 40 jarras»).
- **Al acabar todas las historias** no llegan más: historias que se repitan o una por
  temporada.
- **Entrenamiento** (fase 1, punto 8).

## Más adelante (valorar)

- **Modo exploración** (como en Fallout Shelter): un encargo sin fin; cuanto más tiempo fuera,
  mejores premios cada cierto tiempo y más peligro, hasta que se les llama de vuelta.

Arena propia, combate en directo entre amigos (código de 5 letras), prestar héroes,
servidor (me gusta, clasificaciones), estaciones, adornos colocables, gremios rivales,
aprendices, tienda de cosméticos y Google Play.

## Descartado

Campaña con final, legado entre partidas, partida del día, escaleras por tramos (no por
ahora; mejorar su aspecto sí entra en la fase 4).
