# Encargo: expediciones (fase 8)

Del agente de expediciones. Lo decidido con el usuario (22 de noviembre, cuatro vueltas en la
página «Expediciones del Jarro», https://claude.ai/artifact/A4zHkyzm3eBMRn67PT6y6y) está en
[`../decisiones.md`](../decisiones.md), bloques 7 (X1–X5) y 8 (EX1–EX24). Propuesta de partida:
[`../propuesta-expediciones.md`](../propuesta-expediciones.md). Arte:
[`arte-expediciones.md`](arte-expediciones.md) (agente de arte).

Forma de trabajar: vistas previas (capturas en una página) antes de meter cada bloque, `npm run sim`
al cerrar, un PR por bloque contra `main`. Si se toca `src/world`, `src/art` o `App.tsx`, decirlo
en el PR. **Textos:** todos los nuevos en `src/textos/es/expediciones.yaml`, con la convención de
[`../textos.md`](../textos.md) (frases enteras con huecos, mensajes `msg` para lo que se guarda en
la partida: diario, informe, avisos).

## La idea, en corto

Se manda de 1 a 4 héroes hacia uno de cuatro rumbos (bosque, sierra, marismas, ruinas) con las
raciones que elija el jugador. Sin destino: cada día más lejos, con más peligro y mejor botín, poco
a poco (sin tramos). Sucesos a horas al azar; algunos con decisión (carta con plazo hasta la noche,
opciones de clase, pista de riesgo en palabras). Vuelven solos cuando solo quedan las raciones de
la vuelta, o cuando el jugador quiera; la vuelta tarda la mitad. Todo se sigue en el visor, una
pantalla propia con la expedición en directo (peleas incluidas, resueltas solas y que se pueden
volver a ver).

## Reglas (con las cifras a afinar en `balance.ts`, prefijo `EXP_`)

- **Se abre** con el primer veterano (nivel 8, tras el cambio de veteranía del agente principal;
  hasta entonces, `EXPEDITION_LEVEL`), sin otro tutorial en marcha.
- **Grupo y a la vez:** nivel de la sala de mapas → tope del grupo (1, 2, 3, 4); huecos de la sala →
  expediciones a la vez (1, 2, 3).
- **Raciones:** una por héroe y día, de la despensa; se encuentran más fuera.
- **Lejanía:** días de ida. Peligro y botín, curva suave por día; avisos al cruzar escalones.
- **Sucesos:** tirada al azar por hora del juego (media ~2 al día, más con la lejanía), sin
  horario; de noche, a veces, en el campamento. Tipos: hallazgo, pelea, decisión, encuentro
  (mercader, viajero que se une, santuario, campamento abandonado, cofre) y paraje (cueva, mina,
  torre, ruinas: se puede entrar).
- **Decisiones:** plazo hasta la noche; si no, eligen ellos con prudencia. Opciones de clase; las
  de las clases que faltan, tachadas. Con el juego cerrado, los parajes esperan hasta un día;
  silenciada, nunca esperan.
- **Peleas:** con el motor común (`core/fight.ts`), registro guardado para «Ver la pelea». Los
  guardianes (raros, lejos) avisan y esperan unos 3 minutos con el juego abierto.
- **Tiempo:** cerca, el de la taberna; lejos, el del rumbo, con un poco de efecto (nieve: más
  raciones; niebla: más emboscadas y peor pista; lluvia: más despacio).
- **Heridas** que se acumulan (curan clérigo, santuario, poción); **bajas** con la regla de A8. Si
  caen todos, vuelve un tercio de la mochila y el resto queda como fardo perdido en el mapa.
- **Botín por rumbo:** bosque, madera y hierbas; sierra, hierro y cristal; marismas, hierbas y
  cuero; ruinas, cristal y objetos. Cristal desde unos días fuera; raro y legendario, lejos.
  Experiencia por día fuera. Usos nuevos: pociones (hierbas), recetas con madera buena, cristal
  para «obra maestra»; poner al día `MATERIALS` en `core/materials.ts`.
- **Juego cerrado:** sigue en `away.ts` como abierto (con la regla de los parajes).
- **Mapa** tres veces mayor con niebla que se despeja; parajes y fardos que quedan; récord por
  rumbo; objetivos nuevos.

## Bloques (estado)

| # | Bloque | Estado |
| --- | --- | --- |
| 1 | Núcleo (`core/expedition.ts`: la expedición, días, raciones, curva, sucesos sencillos, vuelta sola, juego cerrado, simulador) + hoja de preparar + visor básico + bosque | Hecho (#208) |
| 2 | Sucesos con decisión, cartas, opciones de clase, avisos, silenciar, guardianes y «Ver la pelea» | Hecho (PR del bloque 2) |
| 3 | Mapa grande con niebla, parajes, fardos perdidos, récords y objetivos | Pendiente (depende del arte del mapa) |
| 4 | Salida, vuelta, informe «La mochila», brillos por rareza y sonido | Pendiente |
| 5 | Sierra, marismas y ruinas (antes, «En obras»); tiempo por rumbo; pociones y cristal en los talleres; carta del veterano y tutorial | Pendiente |

## Bloque 1, cómo quedó

- **Núcleo:** `core/expedition.ts`. Corre por horas de juego (24 al día) y cada hora tira con su
  semilla: igual abierto que cerrado (test). Se pone al día en el reloj (`tick`) y al acabar el día
  (`endDay`, también con el juego cerrado). Guardado en `GameState.expeditions` y `expBest`
  (récord por rumbo); campos nuevos opcionales, sin cambiar `SAVE_VERSION`.
- **Reglas de ahora** (cifras `EXP_` en `balance.ts`): acampan a las 17 h y cenan una ración cada
  uno; siguen otro día si les queda para él y para la vuelta; si alguien cae (3 heridas) dan la
  vuelta; si caen todos, vuelve un tercio de la mochila. Sucesos: hallazgo (monedas o materiales
  del rumbo, más cuanto más lejos), pelea (fuerza media del grupo contra la lejanía; perder hiere),
  raciones de caza y camino. El clérigo cura de noche. En casa: experiencia por día fuera, heridas
  en días de enfermería, y quien cayó puede morir (`EXP_DOWN_DEATH`; con clérigo, a veces se salva).
- **Simplificado hasta el bloque 2:** las peleas aún no usan `core/fight.ts` (no hay «Ver la
  pelea»); no hay sucesos con decisión ni guardianes.
- **Visor básico:** `world/expeditionStrip.ts` reutiliza los dibujos de la tira de los encargos
  (andar, cojear, pelear, acampar, volver con el saco) con el paisaje que pasa y se oscurece con la
  lejanía. El bueno, del agente de arte.
- **Dónde se ve:** en el mapa, lista «Grupos fuera»: las expediciones y el botón «Nueva
  expedición» (`ui/ExpeditionSheet.tsx`); tocar una abre el visor (`ui/ExpeditionView.tsx`). En la
  escena, quien está fuera sale como «de expedición».
- **Simulador:** las estrategias que mandan grupos mandan también a los libres al bosque. Con la
  despensa justa del simulador salen pocas (una por partida); sin contratar, 7 días fuera, 5 de
  lejanía y unos 5 muertos cada 100 héroes.
- **Ojo:** con el juego cerrado corre un día por día real; una expedición de 6–9 días tarda casi
  una semana si no se abre el juego.

## Bloque 2, cómo quedó

- **Sucesos con decisión** (`data/expEvents.ts`): cofre, santuario, mercader, viajero,
  campamento abandonado, oso; parajes (cueva, atalaya, ruinas con runas) y el guardián. Cada
  opción puede pedir una clase (si no va nadie de esa clase en pie, sale tachada: «Haría falta un
  pícaro») y depender de un atributo. Lo que pasa al elegir, en `decide` (`core/expedition.ts`).
- **Esperan parados** (`Expedition.pending`; las horas paradas, `idle`, no cuentan para la
  lejanía): los encuentros hasta la noche, los parajes hasta un día, el guardián 12 horas (unos 3
  minutos abierto). Al acabar el plazo, eligen la prudente. Igual abierto que cerrado.
- **Carta en el visor** (`ui/ExpeditionCard.tsx`): cabecera (marcador hasta que llegue la
  ilustración del agente de arte), texto, opciones con la pista de riesgo en palabras («seguro»,
  «poco arriesgado», «arriesgado», «muy arriesgado», «depende de su Destreza»; sin explorador ni
  sala de mapas a nivel 2, menos fina) y barra del plazo. **Silenciar**: sin avisos y eligen ellos
  ya. **Avisos**: cada suceso y el guardián salen en los avisos de la barra.
- **Peleas con el motor común** (`core/combat.ts`, como jefes: los del bosque pelean como la bestia
  o el jabalí). Cada pelea, su enemigo más o menos fuerte (`EXP_FOE_SPREAD`) para que no esté
  decidida; ajustado (`EXP_FOE`) para ganar más o menos lo mismo que la tirada del bloque 1. Las
  heridas quitan vida al empezar. Todas se guardan en el diario y se ven con **«Ver la pelea»**
  (`BossFight` acepta enemigo, sitio y paisaje propios). El diario va también en el informe
  (`Report.exp`) para verlas al volver (la carta, en el bloque 4).
- **Viajero que se une**: pelea con ellos y, al volver, espera en la barra como candidato.
- **Objetos** (cueva, atalaya, ruinas, guardián): a la mochila y al arcón al volver.
- **Simulador**: no elige nunca (esperan al plazo y van con prudencia): sin contratar, 3,9 días de
  lejanía (antes 5) y ningún muerto en 60 partidas.

## Depende de otros

- **Agente principal:** veteranía a nivel 8 (y maestro, nivel máximo), caché sin pagar, un día
  cada 24 h con el juego cerrado, repetir tutoriales desde Ajustes (ver `decisiones.md`, bloque 8,
  «Para el agente principal»).
- **Agente de arte:** el visor por rumbo, el mapa grande y lo demás de
  [`arte-expediciones.md`](arte-expediciones.md).
