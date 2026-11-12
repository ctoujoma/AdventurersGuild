# Decisiones

Registro de lo decidido con el usuario, por bloques y de lo troncal a lo menudo. El usuario
contesta en la página **«Decisiones del Jarro»** (https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk;
sus respuestas se leen con la herramienta de datos del artefacto, colección `decisiones`; copia de
la página en `tools/decisiones.html`). Este fichero copia lo que contesta; lo aprobado está en el
[plan](plan.md), «Plan de ataque». De dónde sale cada punto: [`revision-critica.md`](revision-critica.md).
Última lectura: 12 de noviembre (todo contestado).

Estados: Aprobada; Aprobada con cambios (los cambios, en su nota, ya incorporados); Rechazada;
Pendiente.

## Por aclarar antes de empezar cada fase

- **A9 y los rangos (decidido, 12 de noviembre):** si se cae de rango, lo ya construido se
  queda; solo se bloquea construir lo nuevo de ese rango hasta recuperarlo.
- **A4 + A5 (decidido, 12 de noviembre):** la guardia no cuenta como «días sin salir» para el
  aburrimiento, pero la guardia sigue costando moral para que el jugador tenga que ir rotando
  (que no deje a alguien de guardia para siempre).
- **A2 y el patio (C8, más adelante):** si el patio acaba con un veterano que enseña, esa
  experiencia también respeta el tope de 99 (solo se sube de nivel peleando).
- **X4:** el tope de 1 a 4, ¿lo abre la sala de mapas o una sala nueva? Se valora al llegar a
  las expediciones.
- **C7, D1 y E1:** aprobados, pero el usuario pidió verlos antes: bocetos primero.

## 1 · El bucle del juego

Lo troncal: de esto depende casi todo lo demás.

### A1 · La fama se gana con encargos — Aprobada

Lo pasivo del salón (los nobles a diario, el cuervo, los tapices) pasa a ser casi nada. La fama sale de los encargos y las historias, y de algunos incidentes y decisiones. Los asaltos ganados la siguen dando. Después, comprobar a qué día se llega a cada rango.

Por qué: Tu partida: día 219 en Leyenda (638 de fama) con solo 12 encargos; los nobles daban de +1 a +5 al día. Dónde: plan.md, fase 1, punto 15.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

### A2 · Se sube de nivel peleando de verdad — Aprobada

Entrenar en el patio da poca o ninguna experiencia y nunca pasa de 99. Defender un asalto sí sube de nivel (se quita el tope de 99).

Por qué: Hoy es al revés: el patio sube de nivel y los asaltos se quedan en 99. Cinco de tus héroes llevan meses a un punto de subir. Dónde: plan.md, fase 1, punto 14.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

### A3 · Un tablón a la medida de los héroes — Aprobada

Cada tablón trae de todo, medido con los héroes que hay en casa: alguno fácil, alguno a su medida y alguno difícil. El rango sube el techo (lo más difícil que puede salir y lo que paga), no el suelo.

Por qué: La dificultad sale solo del rango. Con la fama pasiva, el tablón se puso en Leyenda con héroes de nivel 1 a 4. Depende de: A1. Dónde: core/generate.ts (generateQuest).

Plan: Fase 2 · El bucle. **Hecho** (12 de noviembre).

### A4 · Algo que empuje a mandar héroes — Aprobada

Que no se pueda llevar el gremio sin aventuras.

Elegida: (c) Las dos.

Por qué: La taberna saca unas 600 a la semana y paga los 399 de sueldos; todos tus héroes están a 100 de moral sin salir. Depende de: A1.

Nota del usuario: valorar perder fama.pensar que pasa si un jugador deja de jugar unos dias y vuelve, dejamos un cap por debajo?queno pueda caer de rango, se quede justo al inicio del rango en el que estaba? que caiga al de abajo como minimo?

Respuesta: Lo de perder fama va en A9 (nueva): con el juego cerrado no se pierde (como los pagos); jugando, baja poco a poco si no se mandan encargos. Elige allí hasta dónde puede bajar.

Plan: Fase 2 · El bucle. **Hecho** (12 de noviembre).

### A5 · La guardia tiene un coste — Aprobada

Que estar de guardia no sea gratis ni para siempre.

Elegida: (b) Cuenta como un trabajo: quien guarda no descansa (sin moral extra).

Por qué: En tu partida, 4 de 13 héroes llevan meses de guardia y nunca salen.

Nota del usuario: poner un indicador cuando un heroe tiene moral baja, y avisar que estar sin dormir no recupera moraly estar de guardia la va reduciendo.

Respuesta: Apuntado también: una marca de moral baja en el retrato y en la ficha, y el aviso de que quien está de guardia no duerme, no recupera moral y la va perdiendo.

Plan: Fase 2 · El bucle. **Hecho** (12 de noviembre).

### A6 · Un solo motor para las peleas — Aprobada

Jefes, asaltos y el ladrón pelean con el mismo motor: mismas unidades, golpes, habilidades, críticos, órdenes y registro para la escena. Los encargos sueltos siguen con tiradas, calibradas contra él. Los informes viejos se tienen que poder seguir viendo.

Por qué: Hoy hay tres bucles de pelea distintos más las tiradas. Las expediciones traerían el quinto. Depende de: A2. Dónde: revision-critica.md, punto 6.

Plan: Fase 4 · Un solo motor de pelea.

### A7 · Las expediciones, después del tablón y del motor — Aprobada

Orden de trabajo: primero A3 y A6, luego las expediciones (bloque 7).

Por qué: Las expediciones son la versión larga de los encargos y traen peleas: mejor sobre lo nuevo que rehacerlas. Depende de: A3, A6.

Nota del usuario: como consideres,las expediciones se haran cuando terminemos este plan de pulido general.

Respuesta: De acuerdo: las expediciones, al acabar este plan de pulido.

Plan: Fase 8 · Expediciones (agente de expediciones).

### A8 · Bajas de verdad en lo difícil — Aprobada con cambios

En los encargos de peligro alto y letal se vuelve a perder gente de vez en cuando: más bajas al fracasar, alguna en un éxito parcial letal, y el clérigo salva solo a veces. Más desaparecidos que muertos: vuelven a los pocos días, y la capilla sube la probabilidad (así sirve de algo). Objetivo: en lo difícil, una baja cada 15 o 20 encargos; en lo fácil, casi nunca.

Elegida: (a) Más desaparecidos que muertos (7 de cada 10).

Por qué: En el simulador (estrategia normal) muere 0,38 héroes cada 100 encargos y solo sale mal el 3 %. Al salir mal, un clérigo en el grupo o un cobarde evitan casi siempre la baja. En tu partida, ninguna en 219 días. Depende de: A3. Dónde: core/resolve.ts (bajas), balance.ts (FAIL_CASUALTY).

Nota del usuario: apuntar para plan futuro que haya alguna forma de revivir a los caidos(Muertos), viendo un anuncio quizas, o con algun objeto/item legendario que pueda usarse para revivir a 1 caído.

Aclaración: Elegido (a). Lo de revivir caídos (anuncio u objeto legendario de un solo uso) queda en futuro.md.

Plan: Fase 2 · El bucle. **Hecho** (12 de noviembre).

### A9 · Perder fama: hasta dónde — Aprobada

Si pasan días sin mandar encargos, la fama baja poco a poco. Con el juego cerrado no se pierde, igual que los pagos.

Elegida: (b) Puede caer al rango de abajo, pero no más.

Por qué: Tu nota en A4. Depende de: A4.

Aclaración: Por aclarar: al bajar de rango, lo ya construido se queda (plantas, niveles, salas); solo no se puede construir lo de ese rango hasta recuperarlo.

Plan: Fase 2 · El bucle. **Hecho** (12 de noviembre).

## 2 · Arreglos rápidos

Fallos y textos. No dependen de nada: se pueden hacer ya.

### B1 · «Sugerir» prueba todas las combinaciones — Aprobada

Con 13 héroes y 4 plazas son 1.092 grupos: se prueban todos y se queda el mejor. Con un test de un encargo de tres pruebas.

Por qué: En tu partida propone a un solo héroe con un 0 % donde hay un grupo con un 86 %. Dónde: core/suggest.ts.

Nota del usuario: siempre que no sea destructor para la performance..

Respuesta: Son 1.092 grupos como mucho y cada cuenta es rápida: en el móvil no se nota. Si hiciera falta, se dejan fuera los héroes que no aportan nada al encargo.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

### B2 · La sastrería no se queda bloqueada — Aprobada

Si el héroe al que cosen ya no está (despedido, desertor o caído), se cancela y se devuelve el oro. Aviso al mandar de encargo a alguien al que le están cosiendo.

Por qué: Hoy el trabajo se queda para siempre y ocupa el único hueco de la sastrería. Dónde: core/crafting.ts (stepCrafts).

Nota del usuario: que quede en pausa el trabajo del sastre si el heroe esta de mision (encargo o exploracion), desde la sastreria podemos cancelar para liberar spot o sino lo recupera cuando vuelva (y no este durmiendo, por si llega de noche y va a dormir, la sastreria espera a mañana)

Respuesta: Incorporado: el trabajo se pausa mientras está de misión (encargo o expedición); desde la sastrería se puede cancelar para liberar el hueco; si vuelve de noche, se sigue por la mañana. Si ya no está en el gremio, se cancela y se devuelve el oro.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

### B3 · Textos de los asaltos bien escritos — Aprobada

Cada banda con su número («llegaron los Hermanos Cuervo») y las faltas de los informes corregidas.

Por qué: Hoy sale «había llegado los Hermanos Cuervo» o «Era las Ratas del Vado». Dónde: data/raids.ts.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

### B4 · La forja dice lo que hace — Aprobada

«+N al arma de cada héroe» (no a cualquier objeto) y, además, lo que da como taller.

Por qué: Hoy dice «+2 al objeto que lleva puesto cada héroe» y solo suma al arma. Dónde: data/labels.ts.

Nota del usuario: esa pasiva esta desactualizada, la forja deberia tener otro efecto, aumentar el % de que salga de mejor calidad el cafteo por ejemplo, y el tamaño de la sala deberia poder meter mas herreros a trabajar, que tambien reduciria el tiempo de crafteo

Respuesta: De acuerdo: la forja deja de afilar armas y entra en el modelo nuevo de talleres (B8).

Plan: Fase 3 · Talleres.

### B5 · El precio de venta sigue a la rareza — Aprobada

Legendario por encima de épico, raro, bueno y común, sin depender del rango ni de dónde salió.

Por qué: La Hoja de Vadoverde (legendaria) vale 120 y un escudo raro 150; el mismo objeto vale 50 o 150 según cuándo salió.

Respuesta: Propuesta: un tramo de precio por rareza (por ejemplo común 10–20, bueno 25–40, raro 50–90, épico 100–160, legendario 200–350) y, dentro del tramo, según lo que da el objeto y su tipo. Te lo traigo con números en la fase 3.

Plan: Fase 3 · Talleres.

### B6 · Informes con tope y «Leído todo» — Aprobada

Se guardan los últimos 50 informes y el correo tiene un botón «Leído todo».

Por qué: Tu partida guarda 30 informes, 20 sin leer, y el guardado crece sin fin.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

### B7 · Talleres: «sale raro» en vez de «de las buenas» — Aprobada

Desde las cinco rarezas, «bueno» es otra rareza (la verde). Los talleres sacan raros y lo dirán así.

Por qué: La ficha dice «Sale de las buenas 8 %» y debajo «Raro». Dónde: ui/panels/WorkshopInfo.tsx.

Nota del usuario: ok! puede dar comun, buena y raro entonces? relacionar con el nivel de la sala (ver comentario en punto anterior sobre forja) y dejar tamaño de sala para poder meter a mas trabajadores = a mas velocidad de crafteo

Respuesta: Sí: según el nivel de la sala saldrá común, bueno o raro, y el tamaño da más puestos y más velocidad. Va en B8 (nueva).

Plan: Fase 3 · Talleres.

## 3 · Navegación y fichas

Dónde está cada cosa y cómo se ordenan las fichas.

### C1 · Pestañas: Tablón · Mapa · Héroes · Gremio — Aprobada

El mapa pasa a tener pestaña (con los grupos fuera). La taberna es lo que se ve al cerrar los paneles; la pestaña «Taberna» desaparece.

Por qué: El mapa se abre con un banderín pequeño; la pestaña «Taberna» solo cierra paneles.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C2 · El arcón dentro de Héroes — Aprobada

Héroes · Barra · Tareas · Equipo: el equipo es de los héroes.

Por qué: Hoy está en Gremio › Arcón. Depende de: C1.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C3 · Un solo buzón — Aprobada con cambios

Avisos e informes en el mismo sitio, no en dos esquinas.

Elegida: (a) Todo en la campana.

Por qué: El correo está abajo a la izquierda y la campana arriba a la derecha.

Nota del usuario: todo en la campana pero necesitamos un sitio con la lista de misiones cumplidas tipo historico (capaz con las actuales en cursoen esa lista tambien? donde la meteriamos?

Respuesta: Todo en la campana. El historial de encargos (cumplidos y en curso) lo planteo en C9 (nueva): elige dónde va.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C9 · Historial de encargos: dónde — Aprobada con cambios

Una lista con los encargos cumplidos (y los que están en curso), con su resultado y su informe.

Elegida: (a) En el Libro (junto a los objetivos y las hazañas).

Por qué: Tu nota en C3. Depende de: C3.

Nota del usuario: a) y c), dos sitios que llevan al mismo panel, te parece bien?

Aclaración: Sí: el Libro y el Tablón llevan al mismo panel del historial.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C4 · El Gremio, para la casa — Aprobada

Salas, Adornos y Libro en el Gremio. Partidas, Ajustes y Menú principal, en el engranaje de arriba.

Por qué: Hoy el Gremio mezcla lo de jugar con lo del sistema, y Ajustes está dos veces. Depende de: C1, C2.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C5 · Ficha de sala: «Mejorar» arriba y qué da cada nivel — Aprobada

El botón «Mejorar · coste» junto al nivel, y «Ahora: …» y «Mejora: …» en todas las salas, con un test que falle si una sala nueva no lo tiene.

Por qué: Tardaste 200 días en ver el botón del salón. Pintor, sastrería, alquimia, cocina, bodega, despensa, servicio y recibidor no dicen qué da mejorarlos. Dónde: revision-critica.md, punto 4.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C6 · Botón «Personalizar» en las salas — Aprobada

Los colores de la sala y, en el salón, los adornos que se compran, en una hoja que se abre encima. Solo sale en las salas con algo que personalizar.

Por qué: Los colores salen en medio de la ficha y solo en 9 salas; los adornos del salón se compran en el Gremio. Depende de: C5.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### C7 · Talleres: recetas en pestañas — Aprobada

Crear · Mejorar · Vestir dentro de la ficha del taller.

Por qué: La ficha de la forja ocupa casi tres pantallas y la de la sastrería más de dos. Depende de: C5.

Nota del usuario: necesito ver un mockup de la idea para entenderte

Respuesta: Te preparo un boceto antes de decidir.

Aclaración: Aprobado a la espera del boceto: se hace antes de tocar nada.

Boceto (12 de noviembre): https://claude.ai/artifact/P4KEM694obLjsUmQA1FySd (copia en `docs/bocetos/c7-talleres.html`), dos variantes, A y B: falta que el usuario elija.

Plan: Bocetos (antes de decidir).

### C8 · Patio, establo y empalizada a la vista — Aprobada con cambios

Que se vean: en la escena, delante de la taberna, o arriba en la lista de salas.

- (a) Los tres a la escena, delante de la taberna, con arte nuevo; y el patio con otro uso (por ejemplo, entrenar a la vez a varios con poca experiencia).
- (b) Quitarlos y pasar sus efectos a salas (el establo a la sala de mapas, la empalizada al recibidor).
- (c) Dejarlos como están y solo subirlos en la lista de salas.

Por qué: En 219 días no construiste ninguno: están al final de Gremio › Salas.

Nota del usuario: dejamos para mas adelante, como puntos de mejora, habrá que rehacer los grficos y encontrar nuevas utilidades, como dibujar caballos de verdad que puedan usar los heroes en las expediciones en el establo. patio podria ser para que un veterano entrene a uno de nivel bajo y le de EXP?

Respuesta: Lo que hace cada uno hoy: el establo, un día menos en viajes de 3 o más días (y a nivel 2, las escoltas pagan un 25 % más); el patio, +6 o +12 de experiencia por noche a quien descansa (con A2 se queda casi sin uso); la empalizada, más fuerza a quien pelea en el patio durante un asalto (+15 % por nivel). Se dibujan con el arte viejo, muy simple. Elige qué hacemos.

Aclaración: Para más adelante (futuro.md): rehacer su arte y darles uso nuevo (caballos de verdad en el establo para las expediciones; en el patio, un veterano que enseña a uno de nivel bajo).

Plan: Fase 6 · Salas.

## 4 · Encargos y equipo

Lo que más hace el jugador: elegir encargo, formar grupo, equipar, seguir el viaje.

### D1 · La tarjeta del tablón dice si se puede — Aprobada

Iconos de lo que pide (Combate, Arcano…) y una chapa con cómo saldría con el mejor grupo de casa. La caducidad, que no se confunda con los días de viaje.

Por qué: Hoy la tarjeta no dice qué pide ni si tienes grupo. Depende de: B1, A3.

Nota del usuario: necesito ver un mockup antes de decidir

Respuesta: Te preparo un boceto antes de decidir.

Aclaración: Aprobado a la espera del boceto: se hace antes de tocar nada.

Boceto (12 de noviembre): https://claude.ai/artifact/GzzfZM9VD6mj3XJqcMNvqp (copia en `docs/bocetos/d1-tarjeta.html`), dos variantes, A y B: falta que el usuario elija.

Plan: Bocetos (antes de decidir).

### D2 · Hoja del encargo más cómoda — Aprobada

Los héroes ordenados por lo que aportan, y un toque «Quitar de guardia y llevar».

Por qué: Con 13 héroes hay que bajar, y los de guardia salen en gris sin forma de llevártelos. Depende de: B1.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### D3 · Que no se olvide el equipo — Aprobada con cambios

Aviso cuando hay en el arcón algo mejor que lo que lleva alguien, y «Lo mejor del arcón» en la hoja del encargo.

Por qué: En tu partida nadie lleva arma y la Hoja de Vadoverde (legendaria) está en el arcón.

Nota del usuario: solo el aviso de momento

Respuesta: Incorporado: de momento, solo el aviso.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### D4 · Mapa más legible — Aprobada

Nombres que se lean en el móvil, la leyenda a la vista, los grupos fuera con retratos (la fila entera abre el viaje) y la amenaza explicada.

Por qué: En el móvil los nombres se montan unos sobre otros y «Amenaza 59» no dice qué pasa si sube. Depende de: C1.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

### D5 · Quien está fuera se nota en la taberna — Aprobada

Camas hechas y vacías y una nota en el tablón con quién está fuera, para encargos y expediciones.

Por qué: Hoy en la escena no se nota quién falta.

Plan: Fase 5 · Interfaz (en paralelo, agente de interfaz).

## 5 · Salas y equilibrio

Ajustes de salas concretas.

### B8 · Talleres: el nivel da calidad, el tamaño da manos — Aprobada

La forja deja de sumar a las armas. En todos los talleres, el nivel de la sala sube la probabilidad de que salga mejor (común, bueno o raro) y el tamaño da más puestos de trabajo: más trabajadores, más deprisa.

Por qué: Tus notas en B4 y B7. Dónde: core/crafting.ts, balance.ts (CRAFT_*).

Aclaración: Ojo: el tamaño ya da puestos (2 por hueco) y cada trabajador suma velocidad; lo nuevo es que el nivel dé la calidad (común, bueno o raro) y que la forja deje de sumar a las armas.

Plan: Fase 3 · Talleres.

### E1 · Salón de doble altura — Aprobada

Que la segunda planta del salón compense lo que cuesta.

Elegida: (c) Las dos.

Por qué: Hoy da +2 de Atractivo y 6 puestos más (las mesas solo salen del ancho), pero cada mejora cuesta el doble: el nivel 2, 750 en vez de 375.

Nota del usuario: necesitaria un mock up del altillo este para ver si es viable o me parece feo. tenemos la profundidad de la sala tambien para jugar visualmente

Respuesta: Te preparo un boceto del altillo, jugando también con el fondo de la sala.

Aclaración: Aprobada la (c) a la espera del boceto del altillo: se hace antes de tocar nada.

Boceto (12 de noviembre): https://claude.ai/artifact/Jnjqegd7qromZxRTekpgUQ (copia en `docs/bocetos/e1-altillo.html`), dos variantes, A y B: falta que el usuario elija.

Plan: Bocetos (antes de decidir).

### E2 · El salón cambia de verdad con cada nivel — Aprobada con cambios

Encargo al agente de arte: manteles, laúd, candelabros y barra dorada, como promete cada nivel.

Por qué: Me dijiste que casi no se nota la diferencia.

Nota del usuario: pensamos un posible nivel 4 y incluso 5

Respuesta: El salón ya llega al nivel 4 (el gran salón) en el juego: falta que cada nivel se note en el dibujo. El nivel 5 lo planteo en E4 (nueva).

Plan: Fase 6 · Salas.

### E4 · Nivel 5 del salón — Aprobada

Un nivel más para el salón, con su dibujo y algo que dé (más Atractivo, una plaza de adorno más…).

Elegida: (a) Sí, con su arte.

Por qué: Tu nota en E2. Depende de: E2.

Plan: Fase 6 · Salas.

### E3 · Alquimia y materiales raros hasta las expediciones — Aprobada con cambios

Hoy la alquimia no puede mejorar nada (pide hierbas y madera, que solo darán las expediciones) y los textos prometen pociones que no existen.

Elegida: (a) Esperar a las expediciones y corregir ya los textos.

Por qué: Es la sala más cara de construir y la que menos da. Depende de: A7.

Nota del usuario: anota las correcciones en comentarios para que el otro agnte de expediciones lo entienda, ahora esta pausado

Respuesta: Incorporado: corrijo los textos de los materiales ya (fase 1) y dejo la nota para el agente de las expediciones en su propuesta.

Plan: Fase 1 · Arreglos y números. **Hecho** (12 de noviembre).

## 6 · Sucesos nocturnos

De la propuesta de la noche, pendiente desde antes.

### N1 · Sucesos nocturnos: con cuáles empezar — Aprobada con cambios

Propuesta: el ladrón nocturno y el mensajero (con decisión), la pesadilla y el gato (ambiente). Quien está de guardia los resuelve si no se toca: le da sentido a la guardia.

Elegida: (a) Esos cuatro.

Por qué: La noche dura unos 108 s y, aparte del asalto, no pasa nada. Depende de: A5. Dónde: propuesta-noche-expedicion-equipo.md, punto 1.

Nota del usuario: que es la pesadilla? podriamos pensar mas para mas adelante, que sean minijuegos incluso para solcionar el incidente/suceso. pero pensar como balancear con la opcion que tiene el player de acelerar la noche

Respuesta: La pesadilla: un héroe herido o con la moral baja da vueltas en la cama; si le llevas un trago de la bodega (gasta jarras), sube su moral; si no, amanece con algo menos. Lo de los minijuegos queda apuntado en futuro.md. Con la noche acelerada, todo se resuelve solo según quién esté de guardia: así no hace falta quedarse mirando.

Plan: Fase 7 · La noche.

### N2 · Sucesos nocturnos: cuántos — Aprobada con cambios

Cuántas noches pasa algo.

Elegida: (a) Uno de cada dos noches, de media (propuesta).

Depende de: N1.

Nota del usuario: mas/menos en funcion de algo? noches de niebla o tormenta que den un poco mas?

Respuesta: Incorporado: uno de cada dos noches de media, y algo más en noches de niebla o tormenta.

Plan: Fase 7 · La noche.

## 7 · Expediciones

Las cinco preguntas de la propuesta. Van al final: se hacen sobre el tablón y el motor nuevos.

### X1 · Expediciones: rumbos — Aprobada con cambios

Elegida: (a) Los cuatro (bosque, sierra, marismas y ruinas).

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

Nota del usuario: podemos dejar WIP en algunos mientras vayamos creando

Respuesta: Incorporado: los cuatro rumbos, y los que no estén listos salen marcados como «en obras». Nota pasada al agente de las expediciones.

Plan: Fase 8 · Expediciones (agente de expediciones).

### X2 · Expediciones: decisiones por el camino — Aprobada con cambios

Elegida: (a) Sí, con aviso y un día de plazo.

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

Nota del usuario: una opcion(icono) para silenciar notificaciones y resolver todo automatico para cada expedicion

Respuesta: Incorporado: un icono en cada expedición para silenciarla y que lo resuelva todo sola. Nota pasada al agente de las expediciones.

Plan: Fase 8 · Expediciones (agente de expediciones).

### X3 · Expediciones: si caen todos — Aprobada

Elegida: (b) Vuelve algo.

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

Plan: Fase 8 · Expediciones (agente de expediciones).

### X4 · Expediciones: tamaño del grupo — Aprobada

Elegida: (a) De 1 a 4.

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

Nota del usuario: en funcion de una sala nueva que sera la sala de los exploradores, por ejemplo, o que sea una mejora de la sala de mapas? (actualmente la sala de mapas hace/desbloquea algo?)

Respuesta: Hoy la sala de mapas da un encargo más por nivel en el tablón, el peligro real a nivel 2, el mapa a color y algo más de aviso de asaltos. Propuesta: que el tamaño del grupo de expedición lo dé la sala de mapas (nivel 1: 2 héroes, nivel 2: 3, nivel 3: 4) en vez de una sala nueva.

Aclaración: Por aclarar: aprobado «de 1 a 4»; falta decir si ese tope lo abre la sala de mapas (propuesta) o una sala nueva de exploradores.

Plan: Fase 8 · Expediciones (agente de expediciones).

### X5 · Expediciones: la vuelta — Aprobada

Elegida: (b) La mitad (ya conocen el camino).

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

Plan: Fase 8 · Expediciones (agente de expediciones).

## Cómo se lleva

- La página lee las decisiones de su base de datos (colecciones `bloques` y `decisiones`, un
  documento por código). El usuario escribe `estado` (`aprobada`, `cambiar`, `rechazada` o
  `pendiente`), `opcion`, `nota` y `cuando`; nosotros, el texto, `respuesta` y `fase`.
- Para retomar: leer la colección `decisiones`, poner al día este fichero y el plan, y seguir
  con lo aprobado, de lo troncal a lo menudo.
- Para añadir o cambiar un punto: aquí y en la base de datos (`set` de uno nuevo, o `update` de
  los campos del texto con `if_version`, sin tocar los que escribe el usuario).
