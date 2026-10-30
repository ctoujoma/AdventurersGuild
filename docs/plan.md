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
- **Agente de interfaz:** auditoría de trabajadores y tareas, menos toques y la parte visual
  del tutorial.
- **Agente de arte:** colores por sala, animaciones, escaleras, fachada y sastrería.

Cada uno en su rama, PR contra `main`, sin pisarse: quien toque fuera de su zona lo dice en
el PR.

## Fase 0 · Prueba del tiempo (hecha; falta jugarla y decidir)

Decidir el modelo de tiempo jugándolo. Va tras un interruptor en Ajustes › Modo prueba
(«Tiempo que corre solo»), sin cambiar la partida de quien no lo active.

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
  pestaña o al continuar, y la noche que cae sola cuando no hay paneles delante. Ojo: los pagos
  siguen contando estando fuera, así que una ausencia larga puede acabar la partida.
- Después: jugarlo unos días, comparar con el modo de ahora y decidir. Si se queda, faltarán
  las cuentas atrás en tiempo real en la interfaz y los avisos en la app de Android
  (notificaciones locales programadas al salir).

## Fase 1 · Bucle infinito

1. **Auditar trabajadores y tareas** (interfaz): quién hace qué, dónde se ve y cómo se
   ordena; ahora es confuso. Antes de sumar sistemas.
2. **Objetivos siempre activos:**
   - metas cortas de gestión («sirve 40 jarras», «mejora la cocina a 2», «gana un asalto sin
     heridos»);
   - siempre tres, y al cumplir uno sale otro; algunos en serie (la cocina a 2, luego a 3);
   - sustituyen a los desafíos del mes;
   - el Libro guarda el historial de lo cumplido (día y premio).
3. **Premios que se ven:** las hazañas (logros por niveles, encadenados, como ahora) y los
   objetivos dan tintes, adornos o piezas de fachada, además de oro y fama.
4. **Rangos que abren cosas:** Cobre, Hierro, Plata, Oro y Leyenda (ya existen, por
   reputación). Cada rango abre algo:
   - plantas (hasta 6 por encima de la baja);
   - los niveles nuevos de las salas (arte hecho, ver `salas/niveles-nuevos.md`);
   - encargos y jefes de más dificultad para cada tramo;
   - salas nuevas.
5. **Incidentes en la taberna.** Formas de resolverlos:
   - arrastrar héroes (pelea, ladrón, algo en la bodega) o trabajadores (fuego en la cocina,
     barril roto);
   - tocar un icono flotante y pagar (el recaudador, una gotera);
   - tocar varias veces (ratas);
   - elegir (un noble borracho).

   Sin resolver, empeoran.
6. **Rumores de la barra:** un bocadillo brillante sobre una mesa unos segundos; si se toca a
   tiempo, se abre un encargo especial con botín bueno o legendario.

## Fase 2 · Tutorial guiado

Cuando el tiempo y el bucle estén decididos (enseña lo que haya). Pasos que hay que cumplir y
lo demás cerrado con candado y la explicación de cuándo se abre:

- dos héroes ya hechos y encargos a su medida;
- poner nombre a un héroe;
- al llegar a la reputación de «La sombra de Hondogrís» (8), el aviso de preparar un buen
  grupo;
- la cámara se acerca a lo que toca en cada paso;
- se puede saltar.

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
