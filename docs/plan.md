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

- **Agente principal** (esta conversación): tiempo, núcleo del bucle, combate, encargos en
  directo, talleres (la forja crea), amigos y la app.
- **Agente del tutorial:** [`encargos/tutorial.md`](encargos/tutorial.md). Ahora, el de las
  obras (2b).
- **Agente de arte:** ahora, el fondo y la escena; después, los talleres
  ([`encargos/arte-talleres.md`](encargos/arte-talleres.md)). Hechos: colores, fachada, incidentes, los
  tres jefes, la tira con los enemigos por familias, la vuelta que deshace el camino y el mapa.
  Encargado también: que lo que pasa se vea pasar ([`encargos/arte-movimiento.md`](encargos/arte-movimiento.md):
  auditoría, contratar andando, el ladrón que huye de verdad, el rótulo que se balancea). Hecho
  ya: la auditoría, la sastrería que empieza al llegar el héroe, contratar y despedir andando y el
  ladrón que huye por la casa, arrastrar andando, las tareas e incidentes que empiezan al llegar
  y la persecución (ver las tablas del encargo); quedan el rótulo, la marca de destino definitiva
  y el arte del sastre.
- **Agente de interfaz:** terminado lo encargado (trabajadores, menos toques, avisos que se
  descartan, el cobro de Merlo, las cartas del amanecer una a una, el mapa grande). Le queda
  suelto: un globito en la escena sobre la sala sin nadie (con arte).
- **Patio trasero** (anexo y jardín, núcleo hecho): encargos de arte
  ([`encargos/arte-anexo-jardin.md`](encargos/arte-anexo-jardin.md)) y de interfaz
  ([`encargos/interfaz-anexo-jardin.md`](encargos/interfaz-anexo-jardin.md)).

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
   `data/goals.ts`, reglas en `core/goals.ts`. Más variedad (hecho, 8 de noviembre): asaltos sin
   heridos, ladrones tumbados, rumores apuntados, historias completadas, objetos creados, héroes
   vestidos, salas pintadas, puntos entrenados (estos cuatro, solo con su sala en uso: `needs`),
   los seis tipos de encargo, un héroe a nivel 5 y 8, 15 y 30 días sin bajas, y más salas a nivel 2
   (forja, sastrería, alquimia, pintor, mapas, armería). Contadores nuevos en `Stats` (`bump`).
3. **Premios que se ven** (hecho): hazañas y objetivos dan piezas de fachada (tejado, paredes,
   rótulo, jardineras) y temas de color de las salas (`data/unlocks.ts`). Las que no se tienen
   salen apagadas y dicen de dónde se ganan; en el modo prueba, todas. Los mismos tintes visten
   a los héroes en la sastrería (hecho).
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
   - salas nuevas: la sastrería (Hierro) y el taller de alquimia (Plata) (hecho).
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
6. **El cobro de la deuda con Merlo** (hecho; revisado por el usuario: funciona).
7. **Rumores de la barra** (hecho): con el juego abierto, desde el día 2, un bocadillo dorado
   sobre una mesa del salón unos 15 s. Si se toca a tiempo, sale un encargo marcado «Rumor»
   (mejor paga, botín bueno o legendario, caduca en 2 días); si no, se pierde sin más. Uno a la
   vez. `data/rumors.ts`, `core/rumors.ts`, `ui/RumorMark.tsx`; cifras `RUMOR_*`.

8. **Entrenamiento con tope por nivel** (hecho): el tope de cada atributo es el menor entre el
   de la sala (5, 7, 9 y 11; `TRAIN_CAP`) y el del héroe (3 + 2 por nivel: el de nivel N llega a lo de la sala de nivel N;
   `TRAIN_HERO_BASE`, `TRAIN_PER_LEVEL`), y 2 más en el atributo principal de su clase
   (`TRAIN_MAIN_BONUS`: el guerrero novato entrena Fuerza hasta 7). Al
   llegar al tope se dice cuál manda («mejora la sala» o «hasta subir de nivel»). Subir de nivel
   da +1 al atributo principal y nunca se pierde (hasta `ATTR_MAX`, 15). Quien llega al tope deja
   la sala al amanecer, con aviso (`cappedTrainees` para avisar en directo: interfaz).
9. **Más oro en modo libre** (hecho, 7 de noviembre): los encargos pagaban menos cuanto más alto el
   rango (×0,5 en cobre, ×0,25 en oro y leyenda) y la nómina de los veteranos se comía la caja.
   Ahora ×0,5 en todos (`FREE_PAY`), y por encima del nivel 5 la subida de sueldo es 4 × nivel
   (`levelRaise`). `npm run oro` da paga, nómina y neto por rango.
10. **El taller del pintor** (núcleo hecho; interfaz y arte, ver `encargos/pintor.md`): sala y oficio
    nuevos; los colores de las salas se cambian pintándolas, y el trabajo empieza al llegar el
    pintor.
11. **Ropa con candados** (núcleo hecho; interfaz, ver `encargos/interfaz-plazos-ficha.md`): la
    ficha encarga la ropa a la sastrería (`dressStatus`), en lugar de cambiarla gratis.
12. **La noche** (hecho, 8 de noviembre: ver [`propuesta-tiempo.md`](propuesta-tiempo.md)): al doble, con «Pasar la noche» a x16; los menús ya no paran el reloj y el día acelera hasta x8.

13. **Sucesos nocturnos, expediciones sin fin y equipo con sentido** (para decidir:
    [`propuesta-noche-expedicion-equipo.md`](propuesta-noche-expedicion-equipo.md)). Las
    expediciones, apuntadas para después.
14. **Experiencia: se sube de nivel peleando de verdad** (decidido con el usuario, 8 de
    noviembre, tras la [revisión crítica](revision-critica.md)). Entrenar (el patio de
    entrenamiento, `TRAINING_XP`) da poca o ninguna experiencia y con tope de 99: no sube de
    nivel. Los asaltos sí suben de nivel (son una pelea en toda regla): quitar el tope de 99 de
    `core/raids.ts` y pasar por `levelUp`, con su aviso al amanecer. Los encargos, como siempre.
15. **(Hecho, fase 1.) La fama se gana con encargos** (decidido con el usuario, 8 de noviembre). Hoy sube sola con
    el salón: los nobles (+1 cada uno, cada día: de +1 a +5 diarios en la partida del usuario),
    el cuervo, los tapices y el espía calado (`endDay`, en `core/game.ts`); por eso se llega a
    Leyenda sin mandar a nadie. Ahora: lo pasivo, casi nada (los nobles traen oro y alguna vez
    fama, no a diario); fama al resolver algunos incidentes y decisiones (ya la dan algunos), y
    el grueso, de los encargos y las historias. Los asaltos ganados la siguen dando. Comprobar
    con `npm run sim` a qué día se llega a cada rango (el simulador no tiene salón: medir también
    con una partida larga) y retocar `REP`, `RANKS` o los premios para que el ritmo de los rangos
    no cambie para quien sí aventura.

## Plan de ataque: pulido general antes de las expediciones

Sale de la [revisión crítica](revision-critica.md) (8 de noviembre, con la partida del usuario:
día 219, Leyenda, 12 encargos) y de las respuestas del usuario en la página **«Decisiones del
Jarro»** (https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk), copiadas en
[`decisiones.md`](decisiones.md) (cada punto con su código, lo que eligió y sus notas). Las
expediciones se hacen **al acabar este plan** (A7). Orden: de lo troncal a lo menudo; el núcleo,
en este orden; la interfaz, en paralelo con su agente; el arte, cuando toque cada pieza. Al cerrar
una fase, `npm run sim` y una partida larga para ver que el ritmo sigue bien.

1. **Fase 1 · Arreglos y números** (agente principal, sin dependencias) — **hecha** (12 de noviembre;
   detalle en [`agente-principal.md`](agente-principal.md)):
   - B1 «Sugerir» prueba todas las combinaciones (sin coste notable en el móvil).
   - B2 la sastrería: pausa mientras el héroe está de misión (encargo o expedición), se puede
     cancelar desde la sastrería para liberar el hueco, sigue por la mañana si vuelve de noche;
     si ya no está en el gremio, se cancela y se devuelve el oro.
   - B3 textos de los asaltos (bandas en plural) y faltas de los informes.
   - B6 informes: los últimos 50 y «Leído todo».
   - A2 experiencia: el patio da poca o ninguna, tope 99; los asaltos suben de nivel.
   - A1 fama: lo pasivo del salón, casi nada; sale de encargos, historias, algunos incidentes y
     decisiones; los asaltos ganados la siguen dando.
   - E3 textos de los materiales: quitar lo que no existe (pociones, hachas con madera, cristal).
2. **Fase 2 · El bucle** (agente principal; se equilibra todo junto con el simulador) — **hecha**
   (12 de noviembre; detalle en [`agente-principal.md`](agente-principal.md)):
   - A3 tablón a la medida de los héroes de casa (de todo: fácil, a su medida y difícil); el rango
     sube el techo, no el suelo.
   - A4 (c) que haya que aventurar: los héroes se aburren (moral que baja tras días sin salir) y la
     amenaza de la comarca hace cosas que se ven; además, la fama baja si no se mandan encargos
     (nunca con el juego cerrado) y puede caer como mucho al rango de abajo (A9, b). Lo ya
     construido se queda; solo se bloquea construir lo nuevo de ese rango hasta recuperarlo.
     La guardia no cuenta como «días sin salir», pero sigue costando moral: hay que ir rotándola.
   - A5 (b) la guardia cuenta como trabajo: quien guarda no duerme ni recupera moral y la va
     perdiendo; marca de moral baja en el retrato y en la ficha, y aviso.
   - A8 bajas de verdad en lo difícil: más bajas en peligro alto y letal, el clérigo salva solo a
     veces y 7 de cada 10 bajas son desaparecidos que pueden volver (la capilla sirve). Objetivo:
     en lo difícil, una baja cada 15 o 20 encargos; en lo fácil, casi nunca.
3. **Fase 3 · Talleres** (agente principal; interfaz después) — **hecha** (12 de noviembre, con C7):
   - B8 el nivel del taller da calidad (sale común, bueno o raro) y el tamaño da puestos (más
     trabajadores, más deprisa). La forja deja de sumar a las armas (B4); textos «sale raro» y de
     la forja (B7, B4).
   - B5 precio de venta por tramos de rareza y tipo (aprobado; los números, con el simulador).
4. **Fase 4 · Un solo motor de pelea** (A6) — **hecha** (13 de noviembre; falta que las escenas lean el registro común y la barra de habilidades): jefes, asaltos y ladrón con el mismo motor; los
   encargos sueltos siguen con tiradas calibradas contra él; los informes viejos se siguen viendo.
5. **Bocetos antes de decidir** (para el usuario): C7 talleres con recetas en pestañas, D1 tarjeta
   del tablón que dice si se puede, E1 el altillo del salón (usando el fondo de la sala).
6. **Fase 5 · Interfaz** — **hecha** (14 de noviembre, con D1) (agente de interfaz, en paralelo desde ya; encargo por escribir): C1
   pestañas Tablón · Mapa · Héroes · Gremio; C2 el arcón en Héroes; C3 todo en la campana y C9
   el historial de encargos (un panel al que se llega desde el Libro y desde el Tablón); C4 el Gremio para la casa y lo del sistema en el
   engranaje; C5 ficha de sala con «Mejorar» arriba y qué da cada nivel (con test); C6 botón
   «Personalizar»; D2 hoja del encargo ordenada y «Quitar de guardia y llevar»; D3 aviso de equipo
   mejor en el arcón (solo el aviso); D4 mapa legible y amenaza explicada; D5 quien está fuera se
   nota en la taberna (con arte).
7. **Fase 6 · Salas**: E1 el altillo del salón (que la altura no cuente en el recargo y que la
   planta de arriba dé plazas; tras el boceto); E2 que cada nivel del salón se note (arte) y E4 un
   nivel 5 con su arte. C8 (patio, establo y empalizada) queda para más adelante (`futuro.md`).
8. **Fase 7 · La noche**: N0 (nota del usuario, 14 de noviembre) que la noche se vea toda la noche
   del reloj: hoy al acostarse solo se agrisa y la noche cerrada sale un instante al pasar al día
   siguiente (resto de la transición vieja); se adelanta con la fase 6, tras enseñarle capturas. N1 empezar por el ladrón nocturno, el mensajero, la pesadilla y el gato;
   N2 uno de cada dos noches de media, algo más con niebla o tormenta; con la noche acelerada se
   resuelve solo según quién esté de guardia. Minijuegos, más adelante (`futuro.md`).
9. **Fase 8 · Expediciones** (agente de expediciones, al acabar lo anterior): respuestas ya
   adelantadas en [`propuesta-expediciones.md`](propuesta-expediciones.md), «Respuestas del
   usuario».

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
**Decidido con el usuario:** el jugador amplía el salón y luego la cámara del tesoro, abriendo
sitio (comprar solar o excavar, mover, construir, ampliar, mejorar). De un agente propio:
[`encargos/tutorial-obras.md`](encargos/tutorial-obras.md).

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
  **Hecho, los asaltos en directo** ([`propuesta-asaltos.md`](propuesta-asaltos.md)): vida y
  daño por golpe, mover a la gente por la taberna, blanco, habilidades y críticos; y el ladrón
  de la cámara pelea. Arte: [`encargos/arte-asaltos.md`](encargos/arte-asaltos.md).
  **Formaciones y táctica antes de entrar: para más adelante** (usuario: no complicar; tienen
  sentido con arena, torneos o peleas entre amigos, no en el asalto de noche).
- **Críticos con gesto (hecho):** tras un golpe, a veces sale un rombo amarillo sobre el héroe;
  si se toca (el héroe o su ficha) antes de su siguiente golpe, entra crítico. Sin jugador, la
  IA acierta la mitad (como el 10 % de antes). Números de daño en la escena (cifras de píxel:
  blanco, amarillo el crítico, rojo el que reciben los héroes, verde las curas).
- **Vida y ataque de los enemigos:** los de los jefes salen de lo que pide el encargo (hecho,
  `FOE_TUNE` en `core/combat.ts`); faltan los bandidos de los asaltos.
- Después, el torneo de la comarca (armas romas, premio de trofeo).

## Fase 4 · Talleres: crear objetos (hecho el núcleo y las fichas; falta el arte)

Decidido con el usuario: un oficio por taller, los legendarios solo del botín y, de momento, sin
materiales (oro y tiempo). La acción se llama «Crear».

- **Tres talleres** con el mismo sistema (`core/crafting.ts`, recetas en `data/recipes.ts`,
  ficha en `ui/panels/WorkshopInfo.tsx`):
  - **Forja** (la de siempre, que además sigue afilando el objeto de cada héroe): espada,
    coraza y ganzúas de serie; hacha y escudo se aprenden. Oficio: herrero/herrera.
  - **Sastrería** (sala nueva, se abre con el rango de Hierro): botas de serie, capa se aprende.
    Además **viste**: tinte y prenda para un héroe en casa (15 monedas, unas 4 h); el héroe va a
    la sastrería mientras le cosen y al estrenar sube la moral. Los tintes son los premios de
    siempre (`tint:*`, hazañas y objetivos): uno ganado vale para las salas y para todos los
    héroes. Prendas: capa, tabardo, faja y bufanda, todas desde el principio. Oficio: sastre/sastra.
  - **Taller de alquimia** (sala nueva, rango de Plata): amuleto de serie, varita se aprende.
    Oficio: alquimista.
- **Cómo va un trabajo:** oro al empezar (se devuelve al cancelar), horas de juego según quién
  trabaje (el del oficio; un héroe echa una mano más despacio; sin nadie se para), también con
  el juego cerrado. Uno a la vez; dos con el taller a nivel 3. Sale «de las buenas» (rareza 1)
  del 15 al 45 % según el nivel y la maña. Cifras en `balance.ts` (`CRAFT_*`, `UNDO_*`,
  `DRESS_*`, `RECIPE_FIND`).
- **Recetas que se ganan:** desmontando un objeto del arcón (se pierde; del 50 al 80 % sale la
  receta), un 20 % de los éxitos brillantes traen planos y cada historia acabada, siempre.
- **Quién viene a pedir trabajo:** desde que se paga la deuda (antes bastan los tres del
  pueblo). Una sala con oficio y sin nadie de él: a la mañana siguiente viene alguien de ese
  oficio («se corre la voz»), si hay cama en el servicio. Además, cada noche, un 20 % (más con
  más visitantes, hasta un 60 %) viene alguien, casi siempre de una sala que lo necesita;
  esperan tres como mucho.
- **Arte (encargado):** [`encargos/arte-talleres.md`](encargos/arte-talleres.md): las dos salas
  nuevas, los oficios, las animaciones de trabajo y vestir.
- **Más adelante:** más recetas, y un material («hierro», «tela»…) si se queda corto.

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

## Patio trasero: el anexo y el jardín (núcleo hecho)

Pedido del usuario: un segundo edificio a la derecha de la taberna, con un hueco sin construir
en medio, para que los edificios salgan más interesantes (y, más adelante, pasarelas).

- **Decidido:** con el edificio a todo lo ancho (7 huecos) y el rango de plata se compra el
  **patio trasero** (1.200): un **anexo** de 3 huecos que empieza en el hueco 10, con un
  **jardín de 3 huecos** en medio donde no se construye. En el anexo se construye igual que en
  el edificio (no hace falta diferenciarlo; `NOT_IN_WING` en `balance.ts` por si un día se
  quieren prohibir salas), pero **no se excava**. Crece con solares hasta 5 huecos. Al anexo
  se llega por la planta baja, cruzando el jardín. El jardín se adorna (`GardenLook`: suelo,
  una pieza por trozo, borde, faroles y claustro); solo se ve.
- **Hecho (núcleo):** `Building.wing`, `planWing` (acción `buyWing`), `planPlot` sigue por el
  anexo, reglas en `problem` y paso por el jardín en `cutOff` (`core/rooms.ts`), la escena ya
  lo coloca (`gardenRect`, `gardenSlots` en `layout.ts`; suelo para andar en `people.ts`;
  sitios de obra en `works.ts`) y la acción `gardenLook`. Sin tocar `SAVE_VERSION`. Tests en
  `core/wing.test.ts` y `world/rooms/anexo.test.ts`; capturas con `tools/shots/anexo.mjs`.
- **Encargos:** arte, [`encargos/arte-anexo-jardin.md`](encargos/arte-anexo-jardin.md) (bajo
  tierra, puertas al jardín, piezas, claustro); interfaz,
  [`encargos/interfaz-anexo-jardin.md`](encargos/interfaz-anexo-jardin.md) (aviso con candado
  para comprarlo, cámara en el móvil, Adornos › Jardín).
- **Después (sin decidir):** pasarelas entre los dos edificios sobre el jardín; si las piezas
  del jardín se desbloquean o se pagan; el tutorial de obras no lo menciona.

## Fase 6 · Amigos

- Visitar tabernas por enlace (solo mirar).
- Combate por código contra el grupo de un amigo, que pelea con sus tácticas guardadas.

## Fase 7 · Lanzamiento

- **Salvarse de perder viendo anuncios:** si no llega para pagar a Merlo, ofrecer ver anuncios para
  cubrir ese pago y seguir jugando (con la app de Android y sus anuncios opcionales).

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

- **Asaltos en directo** (hechos, con cámara lenta al arrastrar y el objetivo «sin heridos»):
  falta su arte ([`encargos/arte-asaltos.md`](encargos/arte-asaltos.md)).
- **Hecho (6 de noviembre):** la velocidad x2/x4 también acelera la escena, y la sastrería no
  cose hasta que llega el héroe.

- **Pelea contra jefes, perfilarla antes de llevarla a los asaltos** (ver la propuesta en el
  último punto de situación).

- **El cobro de la deuda con Merlo** (lo hecho con los agentes de arte e interfaz): que encaje
  con el tiempo que corre solo, los pagos estando fuera (`dueTonight`), los avisos y los
  objetivos.
- **Feedback de jugar más** (hecho todo): la vuelta de la tira, el resultado que no engaña y el
  mapa (arte); descartar avisos y el mapa grande (interfaz); la clase en el selector, volver al
  trabajo y resolver al acabar la pelea de la tira (agente principal).
- **Pelea contra jefes, perfilarla antes de llevarla a los asaltos** (sin formaciones).
- **Obras:** borrador guardado para luego (hecho). Escaleras planeadas que no dejan seguir
  planeando sin pagar: falta el caso concreto para reproducirlo (en el núcleo el borrador sí
  cuenta con ellas).

- **La carta del amanecer** («Amanece sobre…»): **hecho lo primero:** con la app abierta ya no
  tapa la pantalla; al amanecer queda un botón «Día N · ver el parte» (borde rojo si hay algo
  malo) y la carta solo se abre al tocarlo. Sigue entera al volver tras una ausencia, en los
  saltos del tutorial y al acabar la partida. Las cartas una a una (pila) las hizo la interfaz:
  **el usuario sigue valorando si le gustan como están.**
- **El ritmo del tiempo:** un día son 5 minutos abierto y una hora cerrado; si se quiere más
  calma, alargar `DAY_SECONDS`.
- **Objetivos:** más variedad («gana un asalto sin heridos», «sirve 40 jarras»).
- **Al acabar todas las historias** no llegan más: historias que se repitan o una por
  temporada.

## Más adelante (valorar)

- **Atributos hasta 20** para veteranos y el juego muy avanzado (hoy `ATTR_MAX` es 15 y las salas
  llegan a 11): haría falta un tope de sala más alto (un nivel 5 o una sala de maestros) y que la
  dificultad de lo más alto lo pida.

- **Modo exploración** (como en Fallout Shelter): un encargo sin fin; cuanto más tiempo fuera,
  mejores premios cada cierto tiempo y más peligro, hasta que se les llama de vuelta.

Arena propia, combate en directo entre amigos (código de 5 letras), prestar héroes,
servidor (me gusta, clasificaciones), estaciones, adornos colocables, gremios rivales,
aprendices, tienda de cosméticos y Google Play.

## Descartado

Campaña con final, legado entre partidas, partida del día, escaleras por tramos (no por
ahora; mejorar su aspecto sí entra en la fase 4).
