# El Gremio de Aventureros: documento de diseño

> Origen: idea «Taberna / gremio de aventureros» de *Ideas de proyecto para la nube* (10 oct 2026):
> «Contratas héroes, los mandas a misiones y gestionas lo que traen (o que no vuelvan)».
> Comparte mundo con la *Tienda de pociones*.

## 1. Concepto

Heredas de tu tío una taberna medio en ruinas que en su día fue la sede de un gremio de aventureros. También heredas su deuda. Para pagarla vuelves a abrir el gremio: contratas héroes de reputación dudosa, aceptas encargos de quien pague y repartes lo que traen de vuelta: oro, botín, cicatrices, historias… o una silla vacía en la mesa.

**Género:** gestión ligera con historias que surgen solas. Partidas por días, sesiones cortas, pensado para móvil.

### Pilares

1. **Héroes con nombre que importan.** Cada héroe tiene rasgos, historial y apodos ganados. Si les coges cariño, perderlos duele.
2. **Riesgo legible.** El jugador ve una estimación del peligro antes de enviar a un grupo. Las decisiones son apuestas informadas, no loterías ocultas.
3. **Historias emergentes.** Los informes de misión, generados con plantillas, convierten tiradas de dados en anécdotas («Desde entonces le llaman Brom el Tuerto»).
4. **Sesiones cortas.** Un día de juego dura de 1 a 3 minutos. Se juega en vertical y con una mano.

### Referencias

| Juego | Qué tomamos |
| --- | --- |
| Darkest Dungeon | Pérdida permanente, secuelas, gestión entre expediciones |
| Kairosoft (Dungeon Village) | Tono amable, crecimiento visible del local |
| Fallout Shelter | Gestión vertical y táctil, eventos |
| RimWorld | Rasgos que generan historias |
| Football Manager | Simulación abstracta contada mediante informes |
| Recettear | Deuda como reloj de partida |

**Tono:** fantasía cálida con humor ligero y algún momento amargo. Es el mismo pueblo y la misma estética que la Tienda de pociones.

## 2. Bucles de juego

### Bucle diario (núcleo)

```
 ┌─► AMANECER ─────────────────────────────────────────────┐
 │   · Vuelven los grupos → informes de misión             │
 │   · Nuevos encargos en el tablón, caducan los viejos    │
 │   · Rotan los candidatos de la taberna                  │
 │                                                         ▼
 │   GESTIÓN                                         PLANIFICACIÓN
 │   · Repartir/vender botín                         · Elegir encargo
 │   · Curar, descansar, pagar                       · Formar grupo (1–4)
 │   · Contratar / despedir                          · Ver estimación de riesgo
 │   · Mejorar instalaciones                         · Enviar
 │                                                         │
 └──────────────────── TERMINAR DÍA ◄──────────────────────┘
                (simulación; cada 7 días: salarios y pago de deuda)
```

### Medio plazo
Subir de rango el gremio, mejorar instalaciones, subir de nivel y equipar a los héroes veteranos.

### Largo plazo
Objetivo de campaña. En el prototipo es pagar la deuda en 30 días; en la versión completa, una crisis regional dividida en actos.

## 3. Sistemas

### 3.1 Héroes

| Campo | Descripción |
| --- | --- |
| Nombre y retrato | Generados; el retrato se compone por capas (cara, pelo, accesorio) |
| Clase | Determina habilidades fuertes (ver 3.2) |
| Nivel y XP | Suben con misiones; mejoran atributos |
| Atributos | **Fuerza**, **Destreza**, **Mente** (1–10) |
| Salud | Sana / herido leve / herido grave |
| Moral | 0–100. Sube con éxitos, paga y descanso; baja con heridas, muertes de compañeros e impagos |
| Rasgos | 1–2 al contratar y otros que se ganan en misiones (secuelas, apodos) |
| Historial | Misiones, compañeros caídos, hazañas: alimenta los textos |
| Estado | Disponible · En misión · Herido · Desaparecido · Muerto · Desertor · Retirado |

**Contratación:** cuesta una prima de fichaje y un salario semanal. Los candidatos rotan cada pocos días. **Uno de los rasgos de cada candidato está oculto** y se revela tras su primera misión. Así contratar también es una apuesta.

**Moral baja:** el héroe rinde menos, exige aumento y puede desertar (a veces con parte del botín).

### 3.2 Clases (prototipo: 5)

| Clase | Habilidad fuerte | Papel |
| --- | --- | --- |
| Guerrero | Combate | Aguanta golpes; reduce heridas del grupo en combate |
| Pícaro | Sigilo y trampas | Desactiva trampas; más botín |
| Mago | Arcano | Desafíos mágicos; detecta giros ocultos |
| Clérigo | Sanación | Reduce la gravedad de las heridas y evita muertes |
| Explorador | Supervivencia | Acorta la duración y evita emboscadas |

Cada habilidad se calcula a partir de los atributos con pesos por clase. Por ejemplo, Combate = 2×Fuerza + Destreza para un guerrero y 1×Fuerza para un mago.

### 3.3 Rasgos (ejemplos)

| Rasgo | Efecto |
| --- | --- |
| Valiente | +Combate; nunca huye; algo más de riesgo de herida |
| Cobarde | −Combate; puede huir en un desastre, pero sobrevive más |
| Codicioso | Se queda un 10 % del botín; +moral con recompensas altas |
| Afortunado | Repite una tirada fallida por misión |
| Gafe | Aumenta la probabilidad de eventos negativos en ruta… para todo el grupo |
| Borracho | −Destreza; +moral si la taberna está mejorada |
| Leal | Nunca deserta; −moral doble si muere un compañero |
| Arrogante | Se niega a ir en grupos con héroes de menor nivel |
| Tuerto *(secuela)* | −Destreza; +Intimidación en encargos de combate |

Los rasgos son la principal fuente de anécdotas y de decisiones al formar grupos.

### 3.4 Encargos

| Campo | Descripción |
| --- | --- |
| Cliente | Aldeano, noble, mercader, templo, desconocido… (con nombre) |
| Tipo | Cazar monstruo · Escoltar · Explorar ruinas · Recuperar objeto · Investigar · Limpiar mazmorra |
| Desafíos | 1–3 pruebas: habilidad y dificultad (p. ej. *Combate 12, Trampas 8*) |
| Plazas | Tamaño máximo del grupo (1–4) |
| Duración | Días fuera |
| Caducidad | Días que permanece en el tablón |
| Recompensa | Oro, reputación, a veces un objeto |
| Peligro | Bajo / Medio / Alto / **Letal** (solo los letales pueden matar sin un desastre) |
| Giro oculto | Opcional: el cliente miente o la amenaza es mayor. Un mago o la Sala de mapas pueden detectarlo antes de aceptar |

Los textos se generan con plantillas: *«{cliente} de {lugar} pide que alguien se ocupe de {amenaza}. Paga {oro} monedas, "y ni una más"»*.

### 3.5 Resolución de misiones

Abstracta, rápida y explicable:

1. Para cada desafío se suma la habilidad del grupo y se aplican rasgos, equipo y moral. Con eso y la dificultad se obtiene una probabilidad.
2. Se tira el dado con el generador aleatorio con semilla de la partida.
3. Se insertan **eventos en ruta** sacados de tablas por tipo de encargo (emboscada, mercader ambulante, tesoro, pelea interna…).
4. El resultado global se clasifica como **Éxito brillante · Éxito · Éxito parcial · Fracaso · Desastre**.
5. Se aplican las consecuencias: oro, XP, botín, reputación, heridas, muertes y desapariciones.

**Antes de enviar,** el jugador ve una estimación cualitativa (*Pan comido · Probable · Arriesgado · Suicida*). Su precisión mejora con un explorador en el grupo o con la Sala de mapas.

### 3.6 Informe de misión

Es la recompensa emocional del juego. Se presenta como una carta que se desliza al amanecer:

> *Brom aguantó la carga del ogro mientras Lysa desactivaba la trampa del puente. Volvieron con 120 monedas y una espada oxidada. Brom ha perdido un ojo; desde ahora le llaman **Brom el Tuerto**.*

Cada informe incluye un resumen con números: oro, XP, cambios de estado y objetos.

### 3.7 Lo que traen… y lo que no

- **Oro:** va al gremio, menos la parte de los codiciosos.
- **Objetos:** equipo para los héroes o para vender.
- **Materiales de monstruo:** se venden. En el futuro serán ingredientes de la Tienda de pociones.
- **Trofeos:** decoran la taberna y dan reputación.
- **Heridas:** las leves cuestan días de descanso. Las graves dejan una secuela permanente en forma de rasgo nuevo.
- **Muerte:** es permanente. El nombre va al **Muro de los caídos** y baja la moral de quienes lucharon a su lado.
- **Desaparecido:** el héroe no vuelve con el grupo. Días después puede regresar con una historia y un rasgo nuevo, aparecer en un encargo como prisionero que rescatar, o confirmarse su muerte.
- **Deserción:** con la moral baja, un héroe puede no volver nunca… y llevarse el botín.

### 3.8 Economía

| Ingresos | Gastos |
| --- | --- |
| Recompensas de encargos | Salarios semanales |
| Venta de botín | Primas de fichaje |
| Taberna (pasivo; según reputación y nivel) | Curación (enfermería, sanadores) |
| | Mejoras de instalaciones |
| | Pagos de la deuda |

La tensión central: más héroes dan más capacidad, pero los salarios se comen el margen. Dejar a alguien en el banquillo cuesta dinero.

### 3.9 Instalaciones

Hay 3 niveles por instalación. En el prototipo solo estarán las tres primeras.

| Instalación | Efecto |
| --- | --- |
| Dormitorios | Capacidad de héroes |
| Enfermería | Curación más rápida; evita secuelas |
| Taberna | Mejores candidatos; ingreso pasivo; moral |
| Tablón | Más encargos y de mejor calidad |
| Sala de mapas | Estimaciones más precisas; detecta giros |
| Armería | Equipo y mejoras de objetos |
| Capilla | Moral; ceremonias por los caídos |

### 3.10 Reputación y rango

**Cobre → Hierro → Plata → Oro → Leyenda.** El rango desbloquea encargos, clientes y candidatos de más nivel. Fallar encargos o abandonarlos baja la reputación.

## 4. Estructura de partida

### Prototipo: «La deuda»
- 30 días con una deuda de unas 1000 monedas. Cada 7 días hay un pago mínimo creciente.
- Victoria: deuda pagada el día 30 (puntuación según rango, héroes vivos y oro).
- Derrota: no cubrir un pago semanal.
- Rejugable gracias a la semilla: cada partida genera héroes y encargos distintos.

### Versión completa (ideas)
- Campaña por actos con una amenaza que crece en la región (por ejemplo, un nigromante). Habrá encargos de historia mezclados con los generados.
- Modo infinito.
- Héroes legendarios que se pueden reclutar con condiciones especiales.

## 5. Tiempo

**Turnos por días** con un botón «Terminar día». Es más fácil de equilibrar y de testear, funciona sin conexión y no castiga las sesiones cortas.

Más adelante se puede añadir un modo en tiempo real con progreso offline, al estilo idle. El modelo de días lo permite: el tiempo real se convertiría en días transcurridos.

## 6. Interfaz y presentación

- **Vertical y pensada para móvil**, con una barra inferior de 4 pestañas:
  - **Taberna:** resumen del día, informes, candidatos y eventos.
  - **Tablón:** encargos disponibles.
  - **Héroes:** plantilla, fichas e historial.
  - **Gremio:** instalaciones, inventario, finanzas y Muro de los caídos.
- **Envío de un grupo:** tocar un encargo → elegir héroes → ver la estimación → enviar.
- **Arte:** pixel art desde el prototipo, con una paleta única compartida con la Tienda de pociones. Los héroes se componen por capas y la taberna se ve en corte lateral, con las mejoras a la vista. Detalles en [`arte.md`](arte.md).
- **Sonido:** sintetizado con WebAudio, sin archivos.

## 7. Mundo compartido con la Tienda de pociones

- Mismo pueblo, mismos personajes secundarios y mismo arte.
- Los materiales de monstruo del gremio serían ingredientes de la tienda.
- Los héroes podrían comprar pociones antes de una misión.
- Más adelante, un posible cruce entre los dos juegos (partida enlazada o código de intercambio).

## 8. Fuera del alcance (por ahora)

Combate táctico jugado, multijugador, monetización, mapa del mundo explorable y relaciones complejas entre héroes. Las relaciones simples de amistad y rivalidad pueden entrar tras el prototipo.
