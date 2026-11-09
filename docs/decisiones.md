# Decisiones

Registro de lo que hay que decidir con el usuario y lo ya decidido, por bloques y de lo troncal a
lo menudo. El usuario aprueba, rechaza o pide cambios en la página **«Decisiones del Jarro»**
(https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk; sus respuestas se leen con la herramienta de datos del artefacto,
colección `decisiones`); este fichero se pone al día con lo que conteste. Lo aprobado pasa al
[plan](plan.md). De dónde sale cada punto: [`revision-critica.md`](revision-critica.md).

Estados: Aprobada, Rechazada, Con cambios (ver la nota), Pendiente.

## 1 · El bucle del juego

Lo troncal: de esto depende casi todo lo demás.

### A1 · La fama se gana con encargos — Aprobada

Lo pasivo del salón (los nobles a diario, el cuervo, los tapices) pasa a ser casi nada. La fama sale de los encargos y las historias, y de algunos incidentes y decisiones. Los asaltos ganados la siguen dando. Después, comprobar a qué día se llega a cada rango.

Por qué: Tu partida: día 219 en Leyenda (638 de fama) con solo 12 encargos; los nobles daban de +1 a +5 al día. Dónde: plan.md, fase 1, punto 15. Nota: Decidido por ti el 8 de noviembre.

### A2 · Se sube de nivel peleando de verdad — Aprobada

Entrenar en el patio da poca o ninguna experiencia y nunca pasa de 99. Defender un asalto sí sube de nivel (se quita el tope de 99).

Por qué: Hoy es al revés: el patio sube de nivel y los asaltos se quedan en 99. Cinco de tus héroes llevan meses a un punto de subir. Dónde: plan.md, fase 1, punto 14. Nota: Decidido por ti el 8 de noviembre.

### A3 · Un tablón a la medida de los héroes — Pendiente

Cada tablón trae de todo, medido con los héroes que hay en casa: alguno fácil, alguno a su medida y alguno difícil. El rango sube el techo (lo más difícil que puede salir y lo que paga), no el suelo.

Por qué: La dificultad sale solo del rango. Con la fama pasiva, el tablón se puso en Leyenda con héroes de nivel 1 a 4. Depende de: A1. Dónde: core/generate.ts (generateQuest).

### A4 · Algo que empuje a mandar héroes — Pendiente

Que no se pueda llevar el gremio sin aventuras.

- (a) Se aburren: la moral baja si pasan muchos días sin salir.
- (b) La amenaza de la comarca hace cosas que se ven: más asaltos, menos visitantes, encargos que se pierden.
- (c) Las dos.

Por qué: La taberna saca unas 600 a la semana y paga los 399 de sueldos; todos tus héroes están a 100 de moral sin salir. Depende de: A1.

### A5 · La guardia tiene un coste — Pendiente

Que estar de guardia no sea gratis ni para siempre.

- (a) Turnos: la guardia cansa y hay que relevarla cada pocos días.
- (b) Cuenta como un trabajo: quien guarda no descansa (sin moral extra).
- (c) Dejarla como está.

Por qué: En tu partida, 4 de 13 héroes llevan meses de guardia y nunca salen.

### A6 · Un solo motor para las peleas — Pendiente

Jefes, asaltos y el ladrón pelean con el mismo motor: mismas unidades, golpes, habilidades, críticos, órdenes y registro para la escena. Los encargos sueltos siguen con tiradas, calibradas contra él. Los informes viejos se tienen que poder seguir viendo.

Por qué: Hoy hay tres bucles de pelea distintos más las tiradas. Las expediciones traerían el quinto. Depende de: A2. Dónde: revision-critica.md, punto 6.

### A7 · Las expediciones, después del tablón y del motor — Pendiente

Orden de trabajo: primero A3 y A6, luego las expediciones (bloque 7).

Por qué: Las expediciones son la versión larga de los encargos y traen peleas: mejor sobre lo nuevo que rehacerlas. Depende de: A3, A6.

## 2 · Arreglos rápidos

Fallos y textos. No dependen de nada: se pueden hacer ya.

### B1 · «Sugerir» prueba todas las combinaciones — Pendiente

Con 13 héroes y 4 plazas son 1.092 grupos: se prueban todos y se queda el mejor. Con un test de un encargo de tres pruebas.

Por qué: En tu partida propone a un solo héroe con un 0 % donde hay un grupo con un 86 %. Dónde: core/suggest.ts.

### B2 · La sastrería no se queda bloqueada — Pendiente

Si el héroe al que cosen ya no está (despedido, desertor o caído), se cancela y se devuelve el oro. Aviso al mandar de encargo a alguien al que le están cosiendo.

Por qué: Hoy el trabajo se queda para siempre y ocupa el único hueco de la sastrería. Dónde: core/crafting.ts (stepCrafts).

### B3 · Textos de los asaltos bien escritos — Pendiente

Cada banda con su número («llegaron los Hermanos Cuervo») y las faltas de los informes corregidas.

Por qué: Hoy sale «había llegado los Hermanos Cuervo» o «Era las Ratas del Vado». Dónde: data/raids.ts.

### B4 · La forja dice lo que hace — Pendiente

«+N al arma de cada héroe» (no a cualquier objeto) y, además, lo que da como taller.

Por qué: Hoy dice «+2 al objeto que lleva puesto cada héroe» y solo suma al arma. Dónde: data/labels.ts.

### B5 · El precio de venta sigue a la rareza — Pendiente

Legendario por encima de épico, raro, bueno y común, sin depender del rango ni de dónde salió.

Por qué: La Hoja de Vadoverde (legendaria) vale 120 y un escudo raro 150; el mismo objeto vale 50 o 150 según cuándo salió.

### B6 · Informes con tope y «Leído todo» — Pendiente

Se guardan los últimos 50 informes y el correo tiene un botón «Leído todo».

Por qué: Tu partida guarda 30 informes, 20 sin leer, y el guardado crece sin fin.

### B7 · Talleres: «sale raro» en vez de «de las buenas» — Pendiente

Desde las cinco rarezas, «bueno» es otra rareza (la verde). Los talleres sacan raros y lo dirán así.

Por qué: La ficha dice «Sale de las buenas 8 %» y debajo «Raro». Dónde: ui/panels/WorkshopInfo.tsx.

## 3 · Navegación y fichas

Dónde está cada cosa y cómo se ordenan las fichas.

### C1 · Pestañas: Tablón · Mapa · Héroes · Gremio — Pendiente

El mapa pasa a tener pestaña (con los grupos fuera). La taberna es lo que se ve al cerrar los paneles; la pestaña «Taberna» desaparece.

Por qué: El mapa se abre con un banderín pequeño; la pestaña «Taberna» solo cierra paneles.

### C2 · El arcón dentro de Héroes — Pendiente

Héroes · Barra · Tareas · Equipo: el equipo es de los héroes.

Por qué: Hoy está en Gremio › Arcón. Depende de: C1.

### C3 · Un solo buzón — Pendiente

Avisos e informes en el mismo sitio, no en dos esquinas.

- (a) Todo en la campana.
- (b) Todo en el correo.

Por qué: El correo está abajo a la izquierda y la campana arriba a la derecha.

### C4 · El Gremio, para la casa — Pendiente

Salas, Adornos y Libro en el Gremio. Partidas, Ajustes y Menú principal, en el engranaje de arriba.

Por qué: Hoy el Gremio mezcla lo de jugar con lo del sistema, y Ajustes está dos veces. Depende de: C1, C2.

### C5 · Ficha de sala: «Mejorar» arriba y qué da cada nivel — Pendiente

El botón «Mejorar · coste» junto al nivel, y «Ahora: …» y «Mejora: …» en todas las salas, con un test que falle si una sala nueva no lo tiene.

Por qué: Tardaste 200 días en ver el botón del salón. Pintor, sastrería, alquimia, cocina, bodega, despensa, servicio y recibidor no dicen qué da mejorarlos. Dónde: revision-critica.md, punto 4.

### C6 · Botón «Personalizar» en las salas — Aprobada

Los colores de la sala y, en el salón, los adornos que se compran, en una hoja que se abre encima. Solo sale en las salas con algo que personalizar.

Por qué: Los colores salen en medio de la ficha y solo en 9 salas; los adornos del salón se compran en el Gremio. Depende de: C5. Nota: Propuesta tuya del 8 de noviembre.

### C7 · Talleres: recetas en pestañas — Pendiente

Crear · Mejorar · Vestir dentro de la ficha del taller.

Por qué: La ficha de la forja ocupa casi tres pantallas y la de la sastrería más de dos. Depende de: C5.

### C8 · Patio, establo y empalizada a la vista — Pendiente

Que se vean: en la escena, delante de la taberna, o arriba en la lista de salas.

Por qué: En 219 días no construiste ninguno: están al final de Gremio › Salas.

## 4 · Encargos y equipo

Lo que más hace el jugador: elegir encargo, formar grupo, equipar, seguir el viaje.

### D1 · La tarjeta del tablón dice si se puede — Pendiente

Iconos de lo que pide (Combate, Arcano…) y una chapa con cómo saldría con el mejor grupo de casa. La caducidad, que no se confunda con los días de viaje.

Por qué: Hoy la tarjeta no dice qué pide ni si tienes grupo. Depende de: B1, A3.

### D2 · Hoja del encargo más cómoda — Pendiente

Los héroes ordenados por lo que aportan, y un toque «Quitar de guardia y llevar».

Por qué: Con 13 héroes hay que bajar, y los de guardia salen en gris sin forma de llevártelos. Depende de: B1.

### D3 · Que no se olvide el equipo — Pendiente

Aviso cuando hay en el arcón algo mejor que lo que lleva alguien, y «Lo mejor del arcón» en la hoja del encargo.

Por qué: En tu partida nadie lleva arma y la Hoja de Vadoverde (legendaria) está en el arcón.

### D4 · Mapa más legible — Pendiente

Nombres que se lean en el móvil, la leyenda a la vista, los grupos fuera con retratos (la fila entera abre el viaje) y la amenaza explicada.

Por qué: En el móvil los nombres se montan unos sobre otros y «Amenaza 59» no dice qué pasa si sube. Depende de: C1.

### D5 · Quien está fuera se nota en la taberna — Pendiente

Camas hechas y vacías y una nota en el tablón con quién está fuera, para encargos y expediciones.

Por qué: Hoy en la escena no se nota quién falta.

## 5 · Salas y equilibrio

Ajustes de salas concretas.

### E1 · Salón de doble altura — Pendiente

Que la segunda planta del salón compense lo que cuesta.

- (a) La altura no cuenta en el recargo del salón.
- (b) La planta de arriba da plazas (un altillo con mesas).
- (c) Las dos.
- (d) Dejarlo como está.

Por qué: Hoy da +2 de Atractivo y 6 puestos más (las mesas solo salen del ancho), pero cada mejora cuesta el doble: el nivel 2, 750 en vez de 375.

### E2 · El salón cambia de verdad con cada nivel — Pendiente

Encargo al agente de arte: manteles, laúd, candelabros y barra dorada, como promete cada nivel.

Por qué: Me dijiste que casi no se nota la diferencia.

### E3 · Alquimia y materiales raros hasta las expediciones — Pendiente

Hoy la alquimia no puede mejorar nada (pide hierbas y madera, que solo darán las expediciones) y los textos prometen pociones que no existen.

- (a) Esperar a las expediciones y corregir ya los textos.
- (b) Los encargos difíciles traen ya algo de hierbas y madera.

Por qué: Es la sala más cara de construir y la que menos da. Depende de: A7.

## 6 · Sucesos nocturnos

De la propuesta de la noche, pendiente desde antes.

### N1 · Sucesos nocturnos: con cuáles empezar — Pendiente

Propuesta: el ladrón nocturno y el mensajero (con decisión), la pesadilla y el gato (ambiente). Quien está de guardia los resuelve si no se toca: le da sentido a la guardia.

- (a) Esos cuatro.
- (b) Otros (dime cuáles en la nota).

Por qué: La noche dura unos 108 s y, aparte del asalto, no pasa nada. Depende de: A5. Dónde: propuesta-noche-expedicion-equipo.md, punto 1.

### N2 · Sucesos nocturnos: cuántos — Pendiente

Cuántas noches pasa algo.

- (a) Uno de cada dos noches, de media (propuesta).
- (b) Uno cada noche, como mucho.

Depende de: N1.

## 7 · Expediciones

Las cinco preguntas de la propuesta. Van al final: se hacen sobre el tablón y el motor nuevos.

### X1 · Expediciones: rumbos — Pendiente

- (a) Los cuatro (bosque, sierra, marismas y ruinas).
- (b) Empezar con dos (bosque y sierra).

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

### X2 · Expediciones: decisiones por el camino — Pendiente

- (a) Sí, con aviso y un día de plazo.
- (b) Todo automático al principio.

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

### X3 · Expediciones: si caen todos — Pendiente

- (a) Se pierde lo que llevaban.
- (b) Vuelve algo.

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

### X4 · Expediciones: tamaño del grupo — Pendiente

- (a) De 1 a 4.
- (b) Como mucho 3.

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

### X5 · Expediciones: la vuelta — Pendiente

- (a) Tarda lo mismo que la ida.
- (b) La mitad (ya conocen el camino).

Depende de: A7. Dónde: propuesta-expediciones.md, «Para decidir».

## Cómo se lleva

- La página lee las decisiones de su base de datos (colecciones `bloques` y `decisiones`, un
  documento por código). El usuario escribe `estado` (`aprobada`, `cambiar`, `rechazada` o
  `pendiente`), `opcion`, `nota` y `cuando`.
- Para retomar: leer la colección `decisiones` con la herramienta de datos del artefacto, poner al
  día este fichero y el [plan](plan.md) con lo que haya contestado y seguir con lo aprobado, de lo
  troncal a lo menudo.
- Para añadir o cambiar un punto: escribirlo aquí y en la base de datos de la página (`set` de un
  documento nuevo, o `update` de los campos del texto sin tocar los que escribe el usuario).
