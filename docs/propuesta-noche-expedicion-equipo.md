# Propuesta: sucesos nocturnos, expediciones sin fin y equipo con sentido

Del agente principal (8 de noviembre). Para decidir con el usuario antes de tocar código. Al final
de cada parte, lo que hay que decidir.

## 1. Sucesos nocturnos

La noche ya dura unos 108 s y se puede pasar a x16. Ahora, aparte del asalto, no pasa nada: hay que
darle algo que mirar y alguna decisión pequeña, sin obligar a quedarse despierto. **Regla:** lo que
pasa de noche se resuelve solo si no se toca (bien o mal, según quién haya de guardia), y con
«Pasar la noche» se resuelve igual que sin tocar.

### Ideas

| Suceso | Qué se ve | Qué se puede hacer | Si no se toca |
| --- | --- | --- | --- |
| **Ladrón nocturno** | Una sombra que entra por el patio con un farol tapado | Tocar al de guardia o arrastrar a alguien (el duelo del ladrón) | Con guardia, le pilla; sin ella, se lleva algo de la caja |
| **Mensajero tardío** | Alguien llama a la puerta con un farol | Tocar: un encargo urgente (paga más, sale ya al amanecer) | Se va y lo deja para otro |
| **Pesadilla** | Un héroe herido o con la moral baja da vueltas en la cama | Tocar: un trago de la bodega (gasta jarras, sube su moral) | Amanece con algo menos de moral |
| **El gato cazador** | El gato persigue algo por la bodega o la despensa | Mirar, nada más: al amanecer, «el gato ha cazado tres ratas» (menos pérdidas de comida) | Lo mismo |
| **Juerga que no acaba** | Clientes que se quedan en el salón | Tocar: echarlos (sin más) o servir otra ronda (algo de oro y riesgo de pelea) | Se van solos, con alguna jarra menos |
| **Fuego que se aviva** | La chimenea del salón o la forja chisporrotean | Arrastrar a un trabajador (el incidente del fuego, de noche) | Con guardia, lo apaga; sin ella, una sala con daño leve |
| **Visita misteriosa** (rara) | Una figura encapuchada en la barra | Tocar: un rumor «bueno» (encargo con botín legendario) por un precio | Se va |
| **Luciérnagas o estrellas** (adorno) | Con el jardín o la torre, algo bonito que mirar | Nada | Nada |

### Cómo

- **Núcleo:** son incidentes con `night: true` (los de ahora, solo de día). Uno por noche como mucho
  y no la noche del asalto. Probabilidad más alta con más fama o oro. **La guardia cuenta:** quien
  esté de guardia los resuelve solo si no se toca, y eso da sentido a poner guardia aunque no haya
  asalto.
- **Interfaz y arte:** el aviso sobre la sala (como los de día, más tenue) y lo que se ve.

### Para decidir

1. ¿Con cuáles empezamos? Propuesta: el ladrón nocturno, el mensajero, la pesadilla y el gato
   (los dos primeros, con decisión; los otros dos, ambiente).
2. ¿Uno por noche como mucho, o a veces ninguno? Propuesta: uno de cada dos noches, de media.

## 2. Expediciones sin fin (apuntado)

Como la exploración de Fallout Shelter: se manda a uno o varios héroes **sin destino** y siguen
hasta que se les hace volver.

- **Salen con provisiones** (raciones de la cocina; más raciones, más días). Cuando se acaban, vuelven
  solos.
- **Cada día fuera**, un suceso del diario: un combate, un hallazgo (oro, objetos, **materiales**:
  ver el punto 3), un encuentro (un posible héroe que se une, un mercader), un peligro. Ganan
  experiencia. **Cuanto más lejos, mejor botín y más riesgo.**
- **El diario se ve en vivo** en su ficha («Día 4: Bruna encuentra una espada vieja en unas ruinas»),
  y en el mapa, un punto que se aleja.
- **Volver tarda lo mismo que han tardado en llegar** (como en Fallout Shelter). Si caen todos, se
  pierde lo que llevaban.
- **Encaja con lo que hay:** el grupo usa la misma regla de riesgo que los encargos (`resolve.ts`);
  la vuelta trae un informe como el de las misiones; con el juego cerrado sigue (`away.ts`).

Para cuando cerremos lo de ahora. Antes de hacerlo, una propuesta propia con números.

## 3. Equipo con sentido (forja, sastrería, alquimia, cocina)

### Lo que hay

- Cada héroe lleva **un solo objeto**. Hay 9 recetas: 5 en la forja, 2 en la sastrería y 2 en la
  alquimia. Todas dan +1 o +2 a una habilidad. Crear cuesta oro y horas.
- Los talleres acaban siendo «más de lo mismo»: no hay razón para tener mucho equipo ni para volver
  a la forja.

### Propuesta

1. **Tres ranuras por héroe: arma, ropa (armadura o capa) y abalorio (amuleto o herramienta).** Cada
   taller tiene su ranura. Así la forja, la sastrería y la alquimia sirven las tres.
2. **Materiales.** Hierro, cuero, telas, hierbas y piedras raras, que llegan con los encargos, las
   expediciones (punto 2) y algún suceso. Las recetas buenas los piden. Así los talleres dependen
   de salir fuera, y salir fuera tiene un premio más que el oro.
3. **Mejorar lo que ya se tiene.** La forja templa un arma (+1, hasta +3), la sastrería refuerza una
   capa y la alquimia encanta un amuleto (le pone una ventaja: `guard`, `luck`, `ward`…). Da sentido
   a volver al taller con equipo viejo.
4. **Gastables.** Pociones de la alquimia (curan en la pelea contra jefes o en un asalto),
   raciones de viaje de la cocina (provisiones para las expediciones) y un barril de la bodega para
   la vuelta de un grupo (más moral). La cocina y la bodega pasan a producir algo más que el
   consumo del día.
5. **Equipo por clase.** Unas pocas piezas que solo saca partido una clase (el arco largo del
   explorador, el libro del mago), con una ventaja propia. Recetas que se aprenden desmontando.

### Por fases

- **Fase A (núcleo, sin arte nuevo):** tres ranuras, mejorar lo que ya se tiene y unas pocas
  recetas más por taller.
- **Fase B:** materiales (con los encargos) y gastables (pociones, raciones de viaje).
- **Fase C:** con las expediciones, materiales raros y piezas por clase.

### Para decidir

1. ¿Tres ranuras (arma, ropa, abalorio) o dos (arma y ropa)?
2. ¿Materiales sí o no? Dan mucha riqueza, pero son un sistema más que explicar.
3. ¿Empezamos por la fase A?

## Equipo: lo decidido (8 de noviembre) y la propuesta concreta

El usuario empieza por aquí: **tres ranuras** y **materiales**, con una forma cómoda y simpática de
verlos en la interfaz.

### Las tres ranuras

Las botas no van con la armadura: la ropa que protege va en el cuerpo, y lo que se lleva además, en
el complemento.

| Ranura | Qué va | De qué taller sale |
| --- | --- | --- |
| **Arma** | espada, hacha, varita (y arco, más adelante) | forja; la varita, alquimia |
| **Cuerpo** | coraza, escudo, capa | forja (coraza, escudo); sastrería (capa) |
| **Complemento** | botas, amuleto, ganzúas | sastrería (botas); alquimia (amuleto); forja (ganzúas) |

Así cada taller llena dos ranuras y ninguna depende de uno solo. Los objetos que ya hay se reparten
por su dibujo (`icon`), sin tocar las partidas guardadas: el objeto que lleve un héroe va a su ranura.

### Materiales

Seis, con dibujo propio y nombre de andar por casa:

| Material | Sale sobre todo de | Lo piden |
| --- | --- | --- |
| **Hierro** (un lingote) | limpiar guaridas, desmontar armas | armas, corazas, escudos, ganzúas |
| **Cuero** (un rollo atado) | cazar | botas, escudos, capas buenas |
| **Tela** (un fardo) | escoltar, recuperar | capas, ropa de la sastrería |
| **Hierbas** (un manojo) | explorar, el jardín | amuletos, pociones (más adelante) |
| **Madera buena** (unos listones) | explorar, el bosque | hachas, varitas, arcos |
| **Cristal** (una piedra que brilla, raro) | jefes, rumores, encargos de peligro | lo bueno de cada taller |

- Los encargos traen 1–3 del suyo al volver (más con éxito brillante); los jefes y los rumores,
  cristal. Desmontar un objeto devuelve parte de lo que llevaba.
- Las recetas de la casa siguen sin pedir nada (siempre se puede hacer algo); las buenas piden 1–3
  materiales. Mejorar un objeto (+1, hasta +3) pide su material y algo de oro.
- Se guardan en el gremio, sin límite al principio (más adelante, con la despensa o un almacén).

### Cómo se ve (interfaz y arte)

- **El estante de materiales**, arriba del Arcón: seis tarros o cajas con su dibujo y la cifra. Al
  tocar uno: qué es, de dónde sale y para qué sirve («Cuero: sale cazando. Lo piden las botas y los
  escudos»).
- **Al volver un grupo**, sus materiales saltan del informe al estante (como las monedas a la
  bolsa), con un «+2 cuero» pequeño.
- **En las recetas**, debajo del nombre, los materiales que piden con su dibujo: en verde si los
  hay, en gris con la cifra que falta si no («falta 1 cuero: sale cazando»).
- **En la ficha del héroe**, un muñeco con las tres ranuras: arma, cuerpo y complemento, con su
  silueta si están vacías. Tocar una abre el Arcón filtrado por esa ranura. Lo que lleva se ve
  también en el dibujo del héroe, como ahora.
- **En el tablón**, cada encargo enseña el material que suele traer (un dibujito junto a la paga).

### Por fases

1. **Núcleo, A:** las tres ranuras (con lo que ya hay), mejorar objetos y los materiales con sus
   fuentes y recetas. Tests y `npm run sim`.
2. **Interfaz:** el estante, el muñeco de la ficha, las recetas con materiales y lo del tablón y el
   informe.
3. **Arte:** los seis dibujos de los materiales, las siluetas de las ranuras y el muñeco.

### Hecho en el núcleo (8 de noviembre)

Tres ranuras (`core/gear.ts`), materiales básicos con el rincón de la bodega y el almacén
(`core/materials.ts`, sala `almacen`), seis recetas que piden materiales, mejorar objetos hasta +3
(acción `temper`) y desmontar devuelve material. Decidido con el usuario: las expediciones se abren
con el primer héroe de nivel 5; lo que no cabe se vende; el almacén, tras la deuda (antes, el aviso
lo dice). Encargos: [`encargos/interfaz-equipo-materiales.md`](encargos/interfaz-equipo-materiales.md)
y [`encargos/arte-materiales.md`](encargos/arte-materiales.md).
