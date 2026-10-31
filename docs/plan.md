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

- **Agente principal** (esta conversación): tiempo, núcleo del bucle, combate y amigos.
- **Agente de interfaz:** auditoría de trabajadores y tareas (hecha:
  [`encargos/interfaz-trabajadores.md`](encargos/interfaz-trabajadores.md)), y ahora menos
  toques y cartas del amanecer una a una:
  [`encargos/interfaz-menos-toques.md`](encargos/interfaz-menos-toques.md). Después, la parte
  visual del tutorial.
- **Agente de arte:** colores por sala, animaciones y escaleras (hecho:
  [`encargos/arte-colores-animaciones.md`](encargos/arte-colores-animaciones.md)), y ahora
  fachada por partes y preparar la sastrería:
  [`encargos/arte-fachada-sastreria.md`](encargos/arte-fachada-sastreria.md).

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
     jefes nuevos usan el dibujo de otro teñido (`base` y `ramp` en `data/bosses.ts`): pendiente
     de arte, dibujarlos propios. Al acabar todas, ya no llegan más: valorar historias que se
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
6. **Revisar el cobro de la deuda** (lo hablado con los agentes de arte e interfaz: Merlo que
   viene a cobrar, con su animación): cuando esté en `main`, comprobar que encaja con el tiempo
   que corre solo, los pagos estando fuera (`dueTonight`), los avisos y los objetivos.
7. **Rumores de la barra** (hecho): con el juego abierto, desde el día 2, un bocadillo dorado
   sobre una mesa del salón unos 15 s. Si se toca a tiempo, sale un encargo marcado «Rumor»
   (mejor paga, botín bueno o legendario, caduca en 2 días); si no, se pierde sin más. Uno a la
   vez. `data/rumors.ts`, `core/rumors.ts`, `ui/RumorMark.tsx`; cifras `RUMOR_*`.

## Fase 2 · Tutorial guiado

Cuando el tiempo y el bucle estén decididos (enseña lo que haya). Pasos que hay que cumplir y
lo demás cerrado con candado y la explicación de cuándo se abre:

- dos héroes ya hechos y encargos a su medida;
- poner nombre a un héroe;
- al llegar a la reputación de «La sombra de Hondogrís» (8), el aviso de preparar un buen
  grupo;
- la cámara se acerca a lo que toca en cada paso;
- se puede saltar;
- cuando no quede nada que hacer (todos fuera, esperando), un botón para pasar al siguiente
  momento con algo (la vuelta del grupo, el amanecer): un tutorial no debe tener al jugador
  mirando la taberna mientras se cumplen las primeras misiones.

Parte de las notas del tío (`src/ui/tips.ts`, `UncleNote.tsx`).

## Fase 3 · Combate con decisiones

- Formación, táctica por héroe y objeto antes de la pelea; habilidades por clase con recarga
  y sinergias; una o dos órdenes en directo como mucho.
- Jefes en los encargos: aviso de «Dirigir» o «Resolver solo»; si no se contesta, se
  resuelve solo con las tácticas puestas.
- Después, el torneo de la comarca (armas romas, premio de trofeo).

## Fase 4 · Aspecto y pulido (arte, en paralelo desde ya)

- Colores por sala: temas para telas, alfombras y detalles (de lo primero).
- Otra pasada crítica a las animaciones, y escaleras con mejor arte y personajes que suben
  de verdad.
- Sastrería: tintes y prendas; el color se ve bajo la armadura y la armadura se tiñe.
- Fachada por partes.
- Cartas del amanecer una a una y menos toques.

## Fase 5 · Amigos

- Visitar tabernas por enlace (solo mirar).
- Combate por código contra el grupo de un amigo, que pelea con sus tácticas guardadas.

## Fase 6 · Lanzamiento

- Traducciones.
- App de Android: guardado nativo, avisos, anuncios opcionales, cosméticos y donaciones.
- Sistema de eventos y novedades periódicas (jefes, encargos, fiestas), y cartas selladas.
- Lista grande de jefes y encargos para ir ampliando.

## Más adelante (valorar)

Arena propia, combate en directo entre amigos (código de 5 letras), prestar héroes,
servidor (me gusta, clasificaciones), estaciones, adornos colocables, gremios rivales,
aprendices, tienda de cosméticos y Google Play.

## Descartado

Campaña con final, legado entre partidas, partida del día, escaleras por tramos (no por
ahora; mejorar su aspecto sí entra en la fase 4).
