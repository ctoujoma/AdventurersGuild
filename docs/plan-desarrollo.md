# Plan de desarrollo

**Objetivo:** un prototipo jugable en el navegador (móvil y escritorio) que después se convierta en app Android **sin reescribirlo**.

Diseño del juego: [`diseno.md`](diseno.md).

## 1. Tecnología

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Lenguaje | **TypeScript** | Tipos para un modelo de datos grande; refactors seguros |
| Build | **Vite** | Rápido, estándar, buen soporte de PWA |
| Interfaz | **Preact** + CSS propio | El juego es casi todo interfaz (listas, cartas, botones). El DOM gana a canvas en texto, accesibilidad y escalado. Preact es ligero y usa la API de React |
| Núcleo del juego | **TS puro, sin DOM** | Testeable, reutilizable y ejecutable en Node para el simulador de balance |
| Aleatoriedad | Generador con semilla (sfc32/mulberry32) | Partidas reproducibles, bugs reproducibles, tests deterministas |
| Tests | **Vitest** | Integrado con Vite |
| Guardado | `localStorage` tras una interfaz `SaveStorage` | En Android se cambia por Capacitor Preferences/Filesystem sin tocar el juego |
| Web instalable | **vite-plugin-pwa** | Instalable y offline: paso intermedio gratis hacia Android |
| Android | **Capacitor** | Empaqueta la misma web en una app nativa (WebView), con plugins de vibración, botón atrás, barra de estado y almacenamiento |
| CI/CD | GitHub Actions + **GitHub Pages** | Lint, tipos, tests y build en cada push; un enlace para probar en el móvil |

**Alternativas descartadas:**
- **TWA:** depende de hosting y ofrece menos control.
- **Reescribir en Godot o Unity:** se perdería el trabajo hecho en web.
- **React Native:** exige otra capa de interfaz.
- **Motor de canvas (Phaser):** sobra para un juego de menús. Si más adelante queremos una escena animada de la taberna, irá en un `<canvas>` dentro de la vista.

## 2. Arquitectura

```
src/
  core/          # Lógica del juego. TS puro, sin DOM ni efectos.
    rng.ts         generador con semilla
    model.ts       tipos: GameState, Hero, Quest, Item…
    generate/      generación de héroes, encargos, nombres, textos
    resolve.ts     resolución de misiones
    economy.ts     salarios, deuda, ventas
    day.ts         avance de día (orquesta todo lo anterior)
    actions.ts     reducer: (state, action) => state
  data/          # Contenido como datos: clases, rasgos, plantillas, nombres
  ui/            # Componentes y pantallas Preact
  platform/      # Guardado, vibración… (implementación web y Capacitor)
  main.tsx
tools/
  sim.ts         # Simulador sin interfaz para balance
```

**Principios:**
- **El estado es un objeto JSON serializable.** Guardar es `JSON.stringify` y el formato lleva número de versión para migrar partidas.
- **Todas las acciones del jugador pasan por un reducer puro.** Eso facilita los tests, el guardado y las repeticiones; un posible «deshacer» saldría casi gratis.
- **El contenido vive en `data/`.** Añadir un rasgo, una clase o una plantilla de encargo no requiere tocar la lógica.
- **La UI no calcula reglas.** Solo lee el estado y despacha acciones. Por ejemplo, la estimación de riesgo la calcula `core`.

## 3. Fases

Los tamaños son relativos (S < M < L). Cada fase termina en algo que se puede probar.

### Fase 0: Cimientos · S ✅
- [x] Proyecto Vite + TypeScript + Preact
- [x] ESLint + Prettier, `tsconfig` estricto
- [x] Vitest con tests de ejemplo (RNG, capas de héroes, distribución de la taberna)
- [x] GitHub Actions: lint, formato, typecheck, test y build (`.github/workflows/ci.yml`)
- [x] Despliegue automático en GitHub Pages al hacer push a `main` (`.github/workflows/deploy.yml`)
- [x] Esqueleto de interfaz: 4 pestañas, diseño vertical
- [x] Adelantado: pixel art generado por código (ver [`arte.md`](arte.md))
  - [x] Retratos 40×48 dibujados a mano por piezas, sprites de frente y de perfil con animación
  - [x] Taberna de tres plantas, desván y bodega con cámara, paralaje, luz tramada, partículas y vida
  - [x] Objetos interactivos enlazados con la interfaz (tablón → encargos, camas → mejoras…)
  - [x] Sonido sintetizado: ambiente, laúd y efectos

**Terminado cuando** un enlace público abre la app en el móvil. Falta activar GitHub Pages en el repositorio (Settings → Pages → Source: GitHub Actions) y fusionar en `main`.

### Fase 1: Núcleo de simulación · M ✅
- [x] RNG con semilla y utilidades (elegir, tirada ponderada); su estado se guarda con la partida
- [x] Modelo de datos: héroe, encargo, misión, informe, estado de partida (`core/model.ts`), serializable y versionado
- [x] Datos: 5 clases, 10 rasgos, 6 tipos de encargo con plantillas, nombres, frases de informe (`data/`)
- [x] Generadores de candidatos y encargos (escalados por rango y nivel de taberna)
- [x] Cálculo de habilidades del grupo y estimación de riesgo (`core/party.ts`); un mago descubre giros ocultos
- [x] Resolución de misiones: desafíos, 5 resultados y consecuencias (oro, XP y niveles, heridas, secuelas y apodos, muertes, desaparecidos, botín, rasgos que se descubren)
- [x] Avance de día: regresos, curación, desaparecidos que vuelven o no, caducidades, rotación de candidatos, ingresos de la taberna, salarios y pagos semanales, victoria y derrota
- [x] Acciones con un reducer puro: contratar, despedir, enviar grupo, mejorar, vender, leer informe, terminar día
- [x] Tests unitarios de cada pieza
- [x] `npm run sim`: juega N partidas con cinco estrategias y saca estadísticas

**Balance inicial** (300 partidas por estrategia): sin mandar a nadie se pierde siempre; con una estrategia normal (enviar si la estimación pasa del 55 %) se gana el 66 %; con una cauta (75 %), el 30 %; la temeraria (30 %) gana el 82 % pero pierde un héroe cada dos partidas. Las constantes están en `core/balance.ts`.

### Fase 2: Primer prototipo jugable · M ✅
- [x] Taberna: la escena es la pantalla principal; barra del día con correo, grupos fuera y «Terminar día»
- [x] Candidatos en la barra (escena y pestaña Héroes) y botón de contratar, con prima, camas y rasgo oculto
- [x] Tablón: encargos del estado real con caducidad, «Nuevo», peligro (o «¿?») y objeto
- [x] Envío: elegir héroes, ver estimación (el mago avisa del giro), enviar; salen por la puerta
- [x] Héroes: plantilla y ficha completa (atributos, habilidades, XP, moral, rasgos, historial, despedir)
- [x] Informes de misión al amanecer, como cartas con los retratos del grupo
- [x] Amanecer entre días con el resumen de la noche; los que vuelven entran por la puerta
- [x] Barra superior con día, rango, oro, reputación y próximo pago (avisa si no llegas)
- [x] Gremio: deuda y calendario de pagos, mejoras con su coste, arcón del botín, Muro de los caídos
- [x] Guardado automático (`platform/storage.ts`), nueva partida, carta del tío el día 1 y pantalla de victoria o derrota

**🎯 Hito:** se juegan los 30 días de «La deuda» en el móvil desde un enlace. Primera ronda de pruebas.

### Fase 3: Héroes, botín y un edificio que crece · L ✅

**3a · Héroes que importan**
- [x] Clases con habilidad real: guerrero «Escudo» (compañeros con la mitad de heridas), pícaro «Manos largas» (+10 % de oro y objeto con éxito parcial), mago «Sexto sentido» (giros y peligro real), clérigo «Plegaria» (evita muertes, amortigua la moral), explorador «Atajos» (−1 día en viajes de 3+ y esquiva emboscadas)
- [x] Moral con efectos: animado +1 / desanimado −1 a todo; cada día fuera cansa; se recupera descansando (más con taberna y capilla); el harto puede irse de noche y el desanimado pide aumento (aceptar o negarse)
- [x] Secuelas variadas con apodo: tuerto, cojo («Pata Chula») y cara cortada (cicatriz en el retrato)
- [x] Rasgos ocultos que se revelan tras la primera misión

**3b · Lo que traen**
- [x] Equipo: una ranura por héroe; 13 objetos en 3 rarezas con bonificaciones y efectos (protección, suerte, contra el gafe, contra emboscadas); se equipa desde la ficha, se pierde si el héroe cae o deserta; el equipo libre cuelga en un tablero de la bodega
- [x] Trofeos: tras un éxito brillante en encargos peligrosos; +3 reputación, se exhiben en la sala (4 huecos, +3 monedas al día cada uno), se pueden vender y cuentan quién los trajo

**3c · Historias**
- [x] Informes mucho más variados: frases por clase, apartes por rasgo (pista de los ocultos), sucesos en ruta con hallazgos, piques entre compañeros, moral, cierres del cliente y sin repetir frase

**3d · La escena cuenta la partida**
- [x] La noche pasa en la escena (anochece, clarea por el horizonte con el sol) y luego llega el resumen del amanecer
- [x] Celebración en la barra al volver con éxito; una vela por cada caído en la capilla
- [x] El botín se ve: arcones para los tesoros, tablero para el equipo, pared de trofeos

**3e · Crecimiento del edificio**
- [x] Sala de mapas (desván), Armería (bodega) y Capilla (anexo nuevo a la derecha), con efectos y arte por nivel

### Fase 4: «El gremio es tuyo» · M ✅

Lo que pasa al pagar la deuda: el final de «La deuda» deja de ser un final y se convierte en la apertura al mundo.

- [x] **Pantalla de apertura** al acabar los 30 días con la deuda pagada: «El gremio es tuyo. Ahora empieza la aventura», con el resumen de cómo llegas (héroes, oro, trofeos, instalaciones, caídos)
  - Opción principal: **«Abrir el gremio al mundo»** (se sigue con la misma partida, sin límite de días)
  - Opción secundaria, planteada como otro intento: «¿No te convence cómo has llegado? Empieza de nuevo y llega en mejores condiciones a la apertura». Se guarda el mejor resumen para comparar intentos
- [x] **Economía sin deuda (sin «mantenimiento del edificio»)**: el día de pago semanal se queda, pero solo para salarios
  - Los héroes cobran más con cada nivel (más fuerte que ahora) y, al llegar a ciertos niveles, piden **caché de veterano**: mantener a un héroe mucho tiempo sale caro, así que hay que hacerle rendir en encargos de su rango
  - Los encargos de rango alto pagan bastante más: un veterano ocioso es un lujo; uno bien usado, una mina
  - Idea a valorar: los veteranos pueden **retirarse** con una despedida (y quizá quedarse como instructores)
- [x] **Libro de hazañas** (el libro de cuentas del desván): logros con niveles y recompensas
  - Hitos permanentes por tiers: completa 5 / 10 / 25 / 50 encargos; consigue 1 / 3 / 5 trofeos; sube un héroe a nivel 5 / 8 / 10; repele 1 / 3 / 5 asaltos; 15 días sin bajas; termina una cadena…
  - Desafíos del mes (cada 30 días, rotan): «5 encargos de Cazar», «2 éxitos brillantes sin heridos», «gana 500 monedas»…
  - Recompensas: oro y reputación en los fáciles; equipo bueno o legendario en los difíciles
- [x] **Récords** de la partida y entre partidas: días al frente, oro máximo, trofeos, asaltos repelidos, caídos
- [x] **Derrota en modo libre**: quiebra (no poder pagar salarios dos semanas seguidas) o quedarse sin héroes ni oro

### Fase 5: El mundo · L ✅

- [x] **Mapa de la comarca**: pergamino en pixel art que se abre desde el mapa del desván o un botón
  - Chinchetas en los lugares de los encargos disponibles
  - Los grupos de viaje como figuritas que avanzan por el camino, con los días que faltan (sustituye al panel «Fuera»)
  - Las cadenas unidas con hilo rojo, como en la sala de mapas, con los pasos hechos tachados
  - La amenaza regional como una mancha que se extiende
  - La sala de mapas lo mejora: nivel 0 con niebla, nivel 1 rutas y días, nivel 2 el peligro real; los encargos de «Explorar» quitan niebla
- [x] **Cadenas de misiones**: 3–5 encargos enlazados con historia, de clientes que repiten (el alcalde, la bibliotecaria, Merlo…)
  - Cada paso aparece al completar el anterior, con sello especial; fracasar tuerce la historia (paso extra, amenaza mayor); abandonarla tiene consecuencias
  - Final con legendario único, trofeo especial y, a veces, una instalación desbloqueada
  - Datos en `data/chains.ts` con lugares y villanos variables (rejugables); empezar con 3–4 cadenas
- [x] **Amenaza regional**: crece si se ignoran las cadenas; trae eventos al amanecer (caravanas asaltadas, clientes que no vienen)
- [x] **Sucesos en la taberna con elección** (buhonero, pelea en la barra, bardo, noble arruinado, lobos del pueblo, apuesta) · [ ] eventos en ruta con elección
- [x] Desaparecidos: encargo de rescate donde se perdieron; los que vuelven solos regresan curtidos (+2 Supervivencia)

### Fase 6: Asaltos a la taberna · L ✅

Inspirado en los ataques al refugio de *Fallout Shelter*: cuanto más famoso y rico es el gremio, más apetecible es para los bandidos.

- [x] **Escena más ancha**: más patio delante de la puerta (izquierda) para los combates y más espacio a la derecha para seguir ampliando el edificio
- [x] **Notoriedad**: sube con la reputación y con el valor del arcón y los trofeos; marca la probabilidad y la fuerza de los asaltos
- [x] **Chivatazos**: avisos con días de margen («Dicen que la banda del Tuerto anda preguntando por ti»). Vienen de:
  - El tabernero y los rumores de la barra
  - Exploradores que vuelven de misión y ven a la banda
  - Un chivato al que se le paga
  - La torre del vigía (instalación)
- [x] **Defensa**: luchan los héroes que estén en la taberna. Se puede dejar a alguien **de guardia** (no sale de misión y defiende mejor). Así hay que decidir entre mandar a los fuertes a ganar oro o dejarlos en casa
  - [x] La armería ya ayuda · [ ] empalizada y torre del vigía (fase 7)
- [x] **Combate en tiempo real en el patio**: de noche, los bandidos llegan por el camino y los héroes salen por la puerta a pelear (choques, golpes, caídas); se puede acelerar o saltar
- [x] **Consecuencias**:
  - Perder: saqueo (oro, tesoros o equipo del arcón; quizá un trofeo) y heridos
  - Ganar: días de tregua (se corre la voz y otras bandas se lo piensan), reputación y algo de botín de los bandidos

- [x] **Combate con estilo**: cada clase con su arma en la mano y 4 ataques que se alternan sin repetir:
  - Guerrero: tajo, estocada, golpe de escudo (aturde) y torbellino
  - Pícaro: doble puñalada, daga lanzada, voltereta con entrada a fondo y puñalada baja
  - Mago: bola de fuego, esquirla de hielo (congela), rayo del cielo y onda arcana
  - Clérigo: mazazo, columna de luz, bendición y escudo de fe (burbuja que amortigua)
  - Explorador: flecha, andanada de tres, flecha alta y carrera con patada
  - Bandidos variados con 3 ataques cada uno: bruto (garrote), navajero, arquero (también flechas de fuego), incendiario (antorcha, botella ardiendo, fuego) y el jefe (hacha, grito de guerra que enrabieta a los suyos, giro)
  - Destellos y retroceso al recibir, estelas de los golpes, luces de la magia en la noche, sonidos propios y la cámara se acerca al patio. El sistema sirve también para los jefes del futuro

### Fase 7: Tu taberna · M ✅

**Personalización** (panel «Tu taberna», desde El gremio o tocando el letrero)
- [x] Nombre de la taberna y escudo del gremio (5 colores y 6 símbolos): se ven en el letrero, el estandarte del tejado, el marcador, el amanecer, el mapa, la pantalla de título y el lacre de las cartas (con la inicial)
- [x] Personal que se contrata y se ve por la taberna: cocinera tras la barra (el plato anima el doble), bardo ante la chimenea (+8 monedas al día), mozo en la enfermería (curan un día antes). Entrada de 30 y 6 de salario por semana cada uno
- [x] Plato de la casa: pan y queso (gratis), guiso (4/noche, +2 de moral) o asado (10/noche, +4)
- [x] Perro guardián (60 monedas): +3 de defensa y más probabilidad de chivatazo; duerme junto a la puerta
- [ ] Huecos de decoración con efecto pequeño: diana (moral) o mesa de naipes (ingresos, alguna pelea), escenario del bardo o más mesas…
- [ ] Más mascotas (un cuervo mensajero) y decoración de fiestas

**Expansión del edificio** (aprovecha la escena ancha de la fase 6)
- [x] Forja: el equipo rinde más (+1 a su primer atributo por nivel)
- [x] Patio de entrenamiento con muñecos: experiencia mientras descansan
- [x] Establo: viajes más cortos y escoltas mejor pagadas
- [x] Empalizada: más defensa contra asaltos
- [x] Torre del vigía: avisa siempre de los asaltos y, a nivel 2, trae un encargo más al tablón
- [ ] Habitaciones de veteranos: más moral y sus trofeos personales

### Fase 8: Pulido y pruebas · M
- [x] Splash del desarrollador, pantalla de título y tutorial en los primeros días (el tío deja notas)
- [ ] Balance con el simulador y con pruebas de jugadores reales (ahora la segunda mitad es fácil y el modo libre acumula demasiado oro: necesita los asaltos de la fase 6 y gastos de la fase 7)
- [ ] El equipo se ve en el sprite y el retrato del héroe
- [ ] Animaciones y transiciones; cartas que se deslizan; héroes que brindan en la celebración
- [ ] Móvil en horizontal
- [ ] Música ampliada: más temas y variaciones (día, noche, tensión antes de un asalto, celebración, modo libre) para que no se haga repetitiva; transiciones suaves entre ellos
- [ ] Ajustes: volumen y velocidad
- [x] Guardar y cargar partidas: archivo o código de texto
- [ ] PWA: instalable, offline, icono y pantalla de carga
- [ ] Accesibilidad básica: contraste, tamaños de toque y de texto

**🎯 Hito:** prototipo pulido para enseñar.

### Fase 9: Android · M
- [ ] Integrar Capacitor y crear el proyecto Android
- [ ] Guardado con Capacitor Preferences/Filesystem
- [ ] Botón atrás de Android, márgenes seguros (notch), barra de estado y vibración
- [ ] Icono adaptativo y pantalla de inicio
- [ ] Build de APK/AAB en CI y firma
- [ ] Publicación en Google Play (pruebas internas → cerradas)

**🎯 Hito:** la app instalada desde Google Play en pruebas internas.

### Ideas para el futuro
- **Jefes al final de las cadenas, con opción de observar el combate** (reutiliza el combate en tiempo real de los asaltos)
- Relaciones entre héroes (amistades, rivalidades, parejas) que afectan a la moral y a los informes
- Más clases y rasgos
- Arte compartido y cruce con la Tienda de pociones
- Idiomas

## 4. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Balance económico frágil | Simulador sin interfaz desde la Fase 1; constantes en un único fichero |
| Textos repetitivos | Plantillas con variantes y combinaciones; contenido en `data/` para crecer fácil |
| Que el proyecto crezca sin control | Fases cerradas; el diseño marca qué queda fuera |
| Pérdida de partidas (caché borrada, cambio de versión) | Versionado y migraciones del guardado; exportar e importar |
| Rendimiento en WebView de gama baja | Interfaz DOM ligera, sin librerías pesadas; probar pronto en un Android modesto |
| El juego no engancha | Llegar cuanto antes al hito de la Fase 2 y probarlo con gente |

## 5. Decisiones abiertas

1. **Nombre del juego.** «El Gremio de Aventureros» es provisional.
2. **Tiempo por días o en tiempo real.** El plan asume días, pero un modo idle podría añadirse más tarde.
3. **Idiomas.** Español primero; ¿preparar la traducción desde el principio o más tarde?
4. **Estilo de arte definitivo**, compartido con la Tienda de pociones.
