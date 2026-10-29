# Pendientes y futuro

Una sola lista de lo pendiente y de las ideas para más adelante. Las secciones 1 a 3 juntan lo
que ya estaba apuntado en otros documentos (allí sigue el detalle). Las secciones 4 a 9 son una
revisión crítica y propuestas, **sin decidir**: el usuario elige qué entra y en qué orden.

## 1. Pendiente de probar o decidir

- **Balance con partidas de verdad** (ver «Balance» en [`salas/README.md`](salas/README.md)):
  - nadie se queda sin cenar en el simulador;
  - el oro que se pierde con la cámara del tesoro llena;
  - en el modo libre sobra dinero si no se construye.
- **Niveles nuevos de salas** (arte hecho, sin activar): precios y efectos propuestos en
  [`salas/niveles-nuevos.md`](salas/niveles-nuevos.md).
- **Paralaje de los muebles:** las camas ya van separadas de la pared y los hogares y fraguas
  con volumen (`solid` en `salas/kit.ts`). Falta ver si se hace con más piezas (armarios,
  alacenas) tras probarlo.
- **Decisiones abiertas** del plan: nombre del juego, idiomas, modo en tiempo real/idle.

## 2. Mejoras apuntadas

- Escaleras que solo ocupan sitio donde llegan (ver «Mejoras de futuro» en
  [`salas/README.md`](salas/README.md)).
- Al arrastrar una sala en obras, alejar la cámara para que se vean sus sitios.
- Armería sin reparar: se ve oscura y sus arcones se distinguen poco.
- Ideas aprobadas sin hacer:
  - botones «?» de ayuda;
  - noches especiales y huéspedes;
  - calabozo;
  - perro que avisa;
  - persecución del bandido que huye;
  - revisar qué aporta la empalizada.
- Del plan original:
  - relaciones entre héroes (amistades, rivalidades, parejas);
  - más clases y rasgos;
  - cruce con la Tienda de pociones;
  - idiomas.

## 3. Android (fase 9 del plan)

Capacitor, guardado nativo, botón atrás, icono adaptativo, APK/AAB firmados en CI y Google
Play (pruebas internas → cerradas). Detalle en [`plan-desarrollo.md`](plan-desarrollo.md).

## 4. Revisión crítica del bucle

**Lo que funciona:**

- Héroes con nombre que pueden morir, informes al amanecer y la deuda como reloj.
- La taberna en corte que crece a la vista, y los asaltos y jefes como picos de tensión.
- Mucho contenido para un prototipo.

**Lo que flojea:**

1. **Después del día 28 no hay meta.** El modo libre sigue, pero sin un objetivo nuevo, y el
   simulador ya avisa de que sobra dinero. Es el punto donde más gente lo dejará.
2. **Muchos sistemas en paralelo** (salón, comida, cerveza, entrenamiento, trabajadores,
   tesoro, asaltos, obras) y pocas decisiones que los crucen. Hay que mirar en las partidas qué
   sistemas piden decidir algo y cuáles solo piden mantenimiento («tareas»). Los segundos, a
   simplificar o a automatizar con una mejora.
3. **El siguiente objetivo no siempre está a la vista.** La deuda es la meta larga. Faltan
   metas medianas y cortas, siempre visibles: la próxima sala, el próximo rango, el próximo
   jefe.
4. **Las hazañas y los desafíos del mes no dan nada que se vea.** Son el sitio natural para
   regalar cosas de aspecto (fachadas, escudos, mascotas…).
5. **Una partida no deja nada para la siguiente.** Fuera de los récords no hay progreso entre
   partidas, y el «una más» depende de él.

## 5. Para que enganche (sin trampas)

Por orden de impacto previsto:

1. **Una meta después de la deuda:** campaña por actos con la amenaza de la comarca que ya
   existe (un nigromante, los jefes de las cadenas), rangos del gremio con algo que desbloquear
   en cada uno, y gremios rivales con nombre que compiten por los encargos.
2. **Legado entre partidas:** al acabar, el renombre ganado abre cosas para las siguientes:
   - otros comienzos (otra herencia, otra deuda, otra comarca);
   - héroes legendarios que se pueden reclutar;
   - cosas de aspecto.
3. **Partida del día:** la misma semilla para todos cada día y un resultado para compartir en
   texto, como el Wordle («El Jarro Partido · día 28 · 1.240 monedas · 2 caídos»). Sin
   servidor.
4. **Objetivos de corto plazo:** tres encargos del tío por semana con su premio, y la próxima
   meta siempre en la barra de arriba.
5. **El amanecer como momento de revelar:** las cartas se abren una a una, con sonido, y lo
   raro o legendario con su brillo.
6. **Colecciones:**
   - bestiario de monstruos;
   - pared de trofeos por completar;
   - muro de los caídos con su historia;
   - apodos.
7. **Menos fricción:** grupo sugerido, «repetir el último grupo» y avisos de lo que pide
   atención.

## 6. Monetización

- **Recomendado: pago único.** Web gratis con la partida de la deuda (la demo) y versión
  completa de pago en Google Play e itch.io (campaña, modo libre, comienzos). Encaja con un
  juego de gestión acogedor y no necesita servidor.
- **Cosas de aspecto como extra:**
  - fachadas, tejados y escudos;
  - mascotas y decoraciones de temporada.

  Nunca ventajas de juego.
- **Apoyo voluntario:** «paga lo que quieras» en itch.io o una página de donaciones.
- **No recomendado:**
  - anuncios (rompen el tono; como mucho, recompensados y opcionales);
  - gacha de héroes (va contra el pilar de «héroes que importan» y necesita servidor).
- **La palanca más grande es el inglés:** traducirlo multiplica a quién se le puede vender.

## 7. Jugar con amigos

Sin servidor (GitHub Pages sirve archivos estáticos):

- **Visitar tabernas:** la taberna (salas, niveles, escudo, nombre, decoración y héroes en
  resumen) cabe en un enlace con los datos comprimidos detrás de `#`. Quien lo abre la ve en 3D,
  solo para mirar.
- **Prestar héroes:** de la visita sale un código con un héroe del amigo que va de mercenario
  en una misión. Vuelve con su informe, en otro código, para que lo vea su dueño. Es
  cooperación por turnos sin servidor.
- **Retos de grupo contra grupo:** el núcleo es determinista, así que dos jugadores con el mismo
  código ven el mismo combate (ver el apartado 8).
- **Me gusta, visitas y clasificaciones:** necesitan guardar datos en algún sitio, así que sin
  servidor no se puede.

Entre pares (WebRTC): hace falta un servidor para presentarse. Hay opciones que usan
infraestructura pública (Trystero sobre relés de Nostr o BitTorrent), pero son menos fiables y
no hacen falta para un juego por turnos.

Con un servidor pequeño, más adelante y si hay gente jugando: Cloudflare Workers + KV o
Supabase (capa gratuita).

- **Da:** directorio de tabernas, me gusta, regalos y clasificaciones semanales.
- **Trae:** moderar los nombres que escribe la gente, privacidad (RGPD) y mantenerlo.

**Orden propuesto:** primero el enlace de visita y la partida del día; el servidor, solo si
hay tracción.

## 8. Torneos y arena

Encaja bien: el combate en tiempo real de asaltos y jefes ya existe, y las salas de
entrenamiento ganarían sentido.

- **Torneo de la comarca:** un acontecimiento cada pocas semanas. Eliges de 1 a 3 héroes y
  luchan por eliminatorias contra gremios rivales.
  - Armas romas: heridas sí, muertes no.
  - Premios: reputación, oro, un trofeo único y un rival con nombre que recuerda.
- **Contra amigos sin servidor:** el grupo se exporta en un código. El combate es determinista
  (misma semilla), así que los dos ven lo mismo. Es un «fantasma», no un combate en directo.
- **Clasificación:** solo con servidor.

## 9. Fachada y personalización

- **Fachada por partes:**
  - tejado (teja roja, pizarra, paja);
  - paredes (tablas, entramado con yeso, piedra);
  - rótulo y pendones con el escudo;
  - jardineras, faroles, humo en la chimenea.
- **El exterior cuenta la partida:** establo con caballo, huerto detrás, pozo, empalizada que
  crece, el patio de entreno con dianas, y las ventanas encendidas de noche como postal.
- **Estaciones y tiempo:** lluvia, nieve en el tejado, árboles de otoño, adornos de fiesta.
  Ambiente y marca del paso del tiempo.
- **Dentro:**
  - el color de la tela de cada sala (ya existe `CLOTH`) a elección;
  - variantes de muebles;
  - huecos para colocar adornos.
- Todo esto se gana con hazañas, rangos y el legado (apartado 5), y es lo que se vendería como
  extra (apartado 6).
