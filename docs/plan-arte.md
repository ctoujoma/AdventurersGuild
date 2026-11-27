# Plan de arte: dónde estamos y qué viene

Para el agente de arte (y para quien retome tras una compactación). **Léelo antes de empezar
y ponlo al día al acabar cada pieza**: lo hecho (con su PR), lo que toca y lo que ha dicho el
usuario. El detalle de cada idea está en [`auditoria-calidad.md`](auditoria-calidad.md); los
encargos sueltos, en [`encargos/`](encargos/).

## Cómo se trabaja

- Rama `claude/ecstatic-mendel-zmb930`, PR contra `main`. Si el PR anterior ya está fusionado,
  la rama se rehace desde `main`.
- Antes de subir: `npm run lint && npm run format:check && npm run typecheck && npm test &&
npm run build`.
- **Capturas en cada PR** (con `npx vite preview --port 4173`):
  - salas: `node tools/shots/galeria.mjs <carpeta> 4173 <tipos>` (`NIVELES=3` para ir rápido);
  - fondo y patio: `node tools/shots/fondo.mjs <carpeta>` (`FOTOGRAMAS=40` para un GIF);
  - tira: `tools/shots/tira.mjs`; mapa: `tools/shots/mapa.mjs`; escena: `tools/shots/scene.mjs`.
- Para ver un dibujo sin el juego: empaquetar un script con `esbuild` que importe la función de
  arte y vuelque el `PixelBuffer` a PNG (como en `scratchpad`). Mucho más rápido para iterar.
- En el PR, decir si se toca `RoomScene.ts`, `TabernaPanel.tsx`, la ficha del héroe o algo fuera
  del arte. No tocar `core/`, las reglas ni `SAVE_VERSION`.
- PR apiladas: cuando se fusione la de abajo, cambiar la base de la de arriba a `main` (o rehacer la rama
  desde `main`) antes de que el usuario la fusione (la #228 se quedó en su rama base; la subió la #229).
- Esperar el visto bueno del usuario: se fija en alineaciones, en que nada tape nada y en que se
  vea bien en el móvil.

## Hecho

- [x] Tira del encargo: la vuelta deshace el camino y el resultado no engaña (#86).
- [x] Mapa en dos versiones: pergamino (sala de mapas rota o a nivel 1) y a color (nivel 2+),
      caminos que no van por el río (#86).
- [x] Enemigos pintados a mano: trasgos, orcos, esqueletos, trols, lobos, jabalíes, osos, ratas,
      arañas, limos y espectros (`art/foeSprites.ts`, #91).
- [x] Fondo a color y vivo: capas de día, pájaros, humo, molino, bandera, luciérnagas y
      estrellas fugaces; montañas con silueta de sierra, bruma, nieve a manchas y cañadas que
      confluyen (#91).
- [x] Hierba que mueve el viento y pradera con flores en el patio (`art/grass.ts`, #91).
- [x] El fondo ya no se corre al hacer zoom (#94).
- [x] Auditoría de calidad y «juice» (`auditoria-calidad.md`, #94).
- [x] Monedas que vuelan de la caja al contador de oro y sonidos con tono variado (#94).
- [x] Rutinas de trabajo en la cocina y la bodega, de mueble en mueble (#94).

## En curso

- [ ] **El clima** ([`encargos/arte-clima.md`](encargos/arte-clima.md)). Pruebas de dirección en
      `capturas/clima/pruebas/` (el usuario: «se ve genial»).
  - [x] 1. El estado y el cielo: `weatherAt` en `world/weather.ts` (semilla, día y hora; casi
        siempre despejado o algo nublado, nunca dos días de lluvia seguidos) y, en la escena,
        el tiempo que se ve se acerca al que toca en unos 10 s (`approach`). Manto de nubes
        (`rooms/manto.ts`): cúmulos y bancos de `art/clouds.ts` con rampas grises, en filas, que
        salen por turnos según las nubes y se pintan unas pocas por fotograma; cielo gris por
        franjas; bruma tras cada capa del paisaje y bancos de niebla; sin sol, estrellas ni luna
        con el cielo cubierto. Luz: `uSunHide` en `gl.ts` (sin sol directo ni sombra del
        edificio), sin rayos ni foco de sol en las ventanas y los faroles encendidos con niebla.
        Ajuste «Clima: normal / siempre despejado» y «Forzar el tiempo» en el modo prueba.
        Capturas en `capturas/clima/fase1/` (`tools/shots/clima.mjs`).
  - [x] 2. Lluvia (`rooms/lluvia.ts`): las gotas en un shader de pantalla, por téxeles y en
        escalera diagonal; la capa de lejos va con el cielo (se ve entre los árboles y por las
        ventanas) y las dos de cerca por delante de lo 3D con una máscara de las salas (dentro
        no llueve; desde fuera, sí). Salpicaduras en el suelo y las vertientes y goteo de los
        aleros (en el mismo shader). Lo de fuera se moja (`uWet`, se seca despacio): más oscuro,
        brillos en los cantos con relieve y charcos en el camino de delante que reflejan el
        cielo y la luz de los faroles. Gotas en los cristales de las ventanas del fondo, vistas
        desde dentro. De noche, las gotas azuladas y cálidas junto a los faroles. Con «pocas
        luces», sin salpicaduras ni charcos. Sonido de lluvia (apagado mirando dentro) y los
        grillos callan. Capturas en `capturas/clima/fase2/`. Falta: las ventanas de los lados y
        medir en un móvil.
  - [x] 3. Nieve: los copos en el mismo shader que la lluvia (`flakes` en `rooms/lluvia.ts`),
        en tres capas que se mecen (los de cerca, de 2 × 2). La nieve posada (`uSnowCover` en
        `gl.ts`) crece mientras nieva y se funde despacio al despejar, dejándolo mojado: en lo
        plano (patio, tejados), a manchas que se juntan; de pie, un copete en el canto de arriba
        de cada cosa (vigas, alféizares, copas, hierba); la gente y los animales, no
        (`noWeather`). El paisaje del fondo, nevado (`snowyCanvas` en `rooms/manto.ts`, se pinta
        la primera vez), también de noche. El cielo, blanquecino; la luz, algo más clara y fría;
        el humo de las chimeneas, más espeso; sin luciérnagas. Capturas en
        `capturas/clima/fase3/`.
  - [x] 4. Viento: tipo de día nuevo «viento» (rachas que suben y bajan). Con el viento que
        haga: la hierba se agita más y se tumba (`gust`); los árboles del patio se mecen
        (`uSway` en el vértice, en píxeles enteros: lo de arriba se corre, lo de abajo no); el
        humo de las chimeneas se tumba (`Particles.wind`) y ya se ve desde fuera; el rótulo se
        balancea solo con las rachas; cruzan hojas por el patio (no por dentro de las salas); el
        sonido del viento sube. La lluvia y la nieve ya se inclinaban con él. GIF en
        `capturas/clima/fase4/`.
  - [x] 5. Tormenta: con tormenta, cada rato un relámpago (`stepStorm`, `lightning`): el
        destello en escalones (fogonazo, respiro, otro y se apaga; con «menos movimiento», más
        flojo) que baña lo de fuera, entra por las ventanas y aclara las gotas; el rayo en el
        cielo, a tirones de dos píxeles con ramas, tapado abajo por los montes (`drawBolt`); y el
        trueno con retraso (chasquido si cae cerca y retumbo que va y viene, `audio.thunder`).
        «Relámpago» en el modo prueba. Capturas y GIF en `capturas/clima/fase5/`.
  - [ ] Más adelante: valorar un ciclo de estaciones (apuntado en
        [`plan-clima.md`](plan-clima.md)).

- [ ] **La fachada, menos repetida** ([`encargos/arte-fachada-envejecida.md`](encargos/arte-fachada-envejecida.md)):
  - [x] 1. Capa de envejecimiento (`rooms/envejecer.ts`, `ageWall`), para todos los materiales:
        paños alargados más oscuros, claros o cálidos, la humedad del pie mellada, churretes
        bajo alféizares y aleros y lo alto más pálido. Cada cambio, un escalón de la paleta del
        mismo tono y saturación (`step`); el relieve no se toca. En la tapa de la vista desde
        fuera, los hastiales y los costados.
  - [x] 2. Tablas de 4 a 9 sin ritmo, tapajuntas a saltos, menos tablas nuevas y algún remiendo
        en horizontal o diagonal (`patch` en `muros.ts`).
  - [x] 3. Clavos oscuros y sueltos (no en filas).
  - [x] 4. Zócalo de piedra en la planta baja de la tapa (`PLINTH` en `textures.ts`): tres
        hiladas con musgo abajo y una albardilla que sale. (Los costados, aún sin él.)
  - [x] 5. Ventanas de la tapa: tres modelos (cuarterones, arco con clave y contraventanas
        pintadas de verde, azul o granate; alguna cerrada), uno por sala; con dintel, alféizar y
        a veces jardinera con flores; las del salón, más grandes (22 × 28, de seis paños). El
        cristal encendido de noche sigue la forma de cada una.
  - [x] 6. Testas de viga en cada forjado de la tapa (`beamEnds` en `rooms/detalles.ts`): a
        saltos (alguna pareja, huecos largos), con anillos y su sombra debajo y al lado.
  - [x] 7. Detalles sueltos, fijos por partida (la semilla, `pickDetails`), en los huecos de la
        planta baja libres de ventanas y puerta: hiedra en una esquina, leña bajo un tejadillo,
        la bajante con su tonel de lluvia y una escalera apoyada (no siempre salen todos).
  - [x] Pared continua (el usuario: «sigue viéndose las paredes seccionadas, con hueco… y los
        suelos»): la tapa cubre toda la silueta del edificio con la pared de fuera, también el
        grueso de los muros y los forjados; en cada forjado, una viga corrida maciza (o una
        cornisa de piedra en piedra, pizarra y ladrillo) con su sombra, y cantoneros (o sillares
        de esquina) en las esquinas.
  - [x] 8. Resto de materiales: cada uno envejece a su manera (`PROFILE` en `envejecer.ts`,
        con un escalón nuevo, `grime`, que oscurece sin avivar el color): ladrillo, tapial y cal
        se ensucian (antes salían manchas rojas, naranjas o lilas); piedra, pizarra y troncos,
        menos paños oscuros (parecían siluetas). Entramado con postes de tramo en tramo (no una
        rejilla), paños algo más anchos y yeso crema con pocas motas; ladrillo casi de un tono;
        tapial con menos motas; la cal se cae en unos pocos rodales. Y la escalera entra en las
        cajas de la sombra del edificio (`shadowBoxes`): su columna salía tramada.
        Capturas en `capturas/fachada-envejecida/` (el repaso, en `repaso/`).

- [x] **Volumen con grosor** (`thick` en `salas/kit.ts`, `volume` en `RoomScene.ts`): lo suelto
      por la sala tiene cuerpo de unos píxeles hacia el fondo (antes, solo lo empotrado, hasta
      la pared).
- [x] **Emisores** (`emits` en `salas/kit.ts`): un mueble suelta partículas en una zona de su
      dibujo (destellos `glint`, vapor, burbujas `bubble`, ascuas). Sirve para la forja y la
      capilla.
- [x] **Tesoro**: montones de oro de perfil irregular con monedas, gemas y destellos que
      saltan; arcones, caja fuerte, ídolo, sacos y mesa de contar con cuerpo.
- [x] **Bodega**: caldera con vapor y ascuas, tina con burbujas; cubas, barriles, botellero,
      sacos y mesas con cuerpo.
- [x] **Separado de la pared** (`FREE` en `salas/kit.ts`): lo suelto, con suelo detrás (el
      usuario: «sigue pegado a la pared y se nota al desplazar la cámara»).
- [x] **Cilindros de verdad** (`round` en `salas/kit.ts`, `cylinder` en `RoomScene.ts`): la cuba
      tumbada y el barril de pie, con 16 caras, duelas y aros.
- [x] **La gente se mueve en profundidad**: la profundidad (`lane`) cambia al andar hacia la del
      destino (`stand` en `Goal`): delante de su mueble, a la altura de quien charla o, paseando,
      a cualquier profundidad; si solo le falta profundidad, da unos pasos hacia dentro o fuera.
- [x] **Costados pintados, no estirados** (`sideTexel` y `Mat` en `volume.ts`): el costado de
      cada mueble se pinta según su material (madera con juntas, oro con monedas, piedra con
      sillares, metal con remaches) y se oscurece hacia el fondo. Lo empotrado es de piedra.
- [ ] Visto bueno del usuario (capturas de frente y de lado en el PR #94).

- [x] **Feedback del usuario tras los talleres** (#104):
  - la gente anda por delante de lo suelto (`WALK_Z` en `crowd.ts`): solo entra más al fondo al
    llegar a su sitio, y al irse primero sale (nadie atraviesa un barril ni un arcón);
  - la cocina remueve en una olla de verdad (`stewPot`, suelta junto al hogar) con el cucharón en
    el borde; al probar, el cucharón en escorzo (`sorbo`), sin tapar la cara;
  - la bodega ya no remueve toneles cerrados: llena del grifo, da con el mazo (`golpear`) y atiza
    el hornillo de la caldera (`atizar`); la pala del pan, a la altura de la boca del horno;
  - teñir y remover el caldero, con el palo en la tina desde arriba (caldero más bajo);
  - la llama del horno de fundir, en su boca;
  - los montones de oro, cuerpos de revolución (`mound` en `salas/kit.ts`, `mound` en
    `RoomScene.ts`): de frente, igual que el dibujo; de lado, un montón.

- [x] **Puertas entre salas de verdad** (el usuario: «se ve un cuadrado negro… puertas que se
      abran sería maravilloso»): el hueco de `sideTex` es transparente (`DOOR_U0`…`DOOR_U1`,
      `DOOR_H`) y, por el grueso del tabique, `doorway` pone el umbral, el dintel, la jamba del
      fondo (con el acabado de la pared, `doorJamb`) y la hoja (`doorPanel`), que gira sobre su
      gozne al fondo del hueco cuando alguien pasa (`swingDoors`, con `Crowd.near`): se abre
      hacia el lado contrario del que viene y se cierra sola.

- [x] **Cielo, paredes e iconos** (el usuario: «una seria pasada de calidad al cielo», «las
      paredes se ven cutres y repetitivas», «iconos para la personalización del jardín»):
  - el cielo (`art/clouds.ts`, `rooms/sky.ts`): franjas tramadas en vez de degradado liso, con su
    tira para el día, el atardecer y el alba (`skyStrip`); nubes en tres capas con su paralaje (cirros altos, cúmulos y
    bancos bajos que asoman entre los montes), cada una pintada con la luz de cada hora (de día
    desde arriba, al atardecer y al alba desde el sol bajo, de noche con la luna). La luz sale
    del volumen entero de la nube, no de cada bulto (el usuario: «parecen un gusano»); los
    bultos solo marcan la coliflor de la cima. Por encima de la franja de siempre (al alejar
    del todo se veía cielo vacío), `upperLayers` pone nubes cada vez más escasas, pequeñas y
    transparentes (`fadeAt`), sobre todo cirros, hasta que el cielo queda limpio. El sol, el de
    antes (halo suave y disco): el nuevo no gustó;
  - las paredes (`rooms/muros.ts`): de frente (hastiales y costados), `wallFace` sin repetirse
    (tablas de ancho y tono desiguales con tapajuntas, empalmes y clavos; entramado con postes a
    distancias distintas y riostras variadas; sillería en hiladas de alto distinto); en corte
    (el grueso alrededor de cada sala), `wallSection` enseña lo de dentro del muro (forros y
    travesaños por la testa; revoco, barro con zarzo y carreras; dos hojas de sillar con
    mampuesto; los sótanos, igual en piedra oscura; el entramado, un tono por debajo de su cara,
    que deslumbraba). El corte ocupa todo el grueso, de fuera de
    la sala hasta su hueco (`WALL + PARTITION / 2`): antes, por dentro asomaba el dibujo de
    frente (el usuario);
  - iconos (`ui/icons.tsx`): las piezas del jardín y el claustro en Obras, los suelos y bordes
    (antes, colores planos), el farol, las pestañas de Adornos (con cinco, el icono va encima de
    la palabra para que quepa) y del Arcón, y los rótulos; tejados y paredes con una muestra de
    su dibujo de verdad (`ui/lookTiles.ts`).
  - [ ] Visto bueno del usuario. Capturas en `capturas/cielo/`, `capturas/muros/` y
        `capturas/iconos/`.

- [x] **Cinco paredes más** (`rooms/materiales.ts`, el usuario las eligió de una prueba):
      troncos (rodajas con anillos en corte), ladrillo (con hilada de tizones; en corte, dos
      ladrillos trabados), tapial (tongadas, cajones y mechinales; en corte, las agujas), lajas
      de pizarra y encalado (cal vieja crema, no blanca: «parecía nevado»). La lluvia, el musgo y
      la humedad de abajo, solo en las paredes que llegan al suelo (no en los hastiales). Van de
      serie (`FREE` en `data/unlocks.ts`) hasta que se decida de qué hazaña u objetivo salen.
      El encalado, con calvas de borde roto sacadas de un ruido suave (no círculos); el tapial,
      un tono más oscuro, con cajones de alto y largo desiguales, remiendos y churretes.
- [x] **Paredes de los lados a resolución completa** (el usuario: «quedan muy estiradas en
      ángulo»): no era la cámara, era la textura. `sideTex` y `outerSide` iban a media
      resolución en el fondo (DEEP, 30 píxeles para 60 de fondo: cada píxel, el doble de ancho
      que de alto); ahora van a `SIDE_W` = DEPTH. Lo de tamaño fijo (puertas) se dibuja a media
      resolución y se ensancha (`overHalf`), así mide lo mismo. Suelos, techos y tejados siguen
      a media resolución en el fondo.
  - [ ] Visto bueno del usuario. Capturas en `capturas/muros/` (`materiales.png` y cada una).

- [ ] **Que lo que pasa se vea pasar** ([`encargos/arte-movimiento.md`](encargos/arte-movimiento.md)):
  - [ ] 1. Auditoría.
  - [x] 2. Sastrería: con el héroe de camino (`walking`, o aún sin llegar al probador), quien
        cose le espera a un lado del probador, el que da a por donde llega, mirándolo y
        estirando la cinta a ratos (`awaitFitting` en `crowd.ts`); no cose hasta que llega.
        Entonces, por orden, le mide, le prueba la tela y le cose el bajo (`FIRST_FIT`); luego
        como antes.
  - [ ] 3. Contratar andando. — [ ] 4. El ladrón que huye sala a sala.
  - [x] 5. El rótulo: se toca (zona nueva, `signAt`; no quita ninguna) y se balancea **hacia
        atrás y hacia delante** sobre su gancho (el usuario: «no en los costados»), como un
        péndulo con roce que se apaga en unos 3 s (`hangSign`, `swingSign` en `RoomScene.ts`);
        más claro al ir hacia atrás (mira al cielo). Cadenas (`chain`) al tocarlo y crujido en
        cada vuelta fuerte; el cuervo grazna. El de hierro, en dos partes: el brazo fijo y la
        tabla con las cadenas colgando (`ironSignParts` en `props.ts`). El farol, siempre por delante (el
        usuario: «atraviesa el farol»): se pinta el último y sin prueba de profundidad.
  - [x] 6. La marca de destino (`goalMark.ts`): un banderín con el color de su ropa y el icono
        de lo que va a hacer (arreglar lo que pasa, descansar, guardia o el de la sala), clavado
        en el suelo a un lado de donde va. Al arrastrar, uno tenue de muestra donde caerá; al
        soltar, cae, rebota y deja una onda en el suelo; se queda hasta que llega
        (`Crowd.arrived` en la sala, o parado en su sitio; al menos 1,1 s) y se funde con unos
        destellos. Ya va corriendo (lo del principal en `crowd.drop`), así que dura todo el
        camino. Sustituye a las cuatro esquinas provisionales (`headingMarks`, quitado); en el
        asalto en directo, el mismo banderín con la espada.
  - [x] 6d. El camino, desde el héroe (el usuario): lo que le queda por andar (`Crowd.pathOf`,
        desde sus pies, también a media escalera), así que arranca donde está y se acorta según
        avanza. Tocar el banderín (`goalHit`, `goalBox`) lo vuelve a enseñar unos segundos
        (también en el asalto en directo). Capturas: `camino-corriendo.png`, `camino-toque.png`.
  - [x] 6c. El color del banderín (el usuario): el de la ropa de quien va (`clothOf` en
        `art/heroes/hero.ts`): el de su clase u oficio (guerrero rojo, pícaro morado, mago azul,
        clérigo blanco, explorador verde…) o el de su tinte de la sastrería. Sobre tela clara, el
        icono va oscuro. Hoja con todos: `capturas/movimiento/banderines-colores.png`.
  - [x] 6b. El camino (el usuario: «un trazado con el camino que harán y que desaparezca a los
        pocos segundos»): al soltar, un punteado amarillo que avanza por el suelo, por puertas y
        escaleras (`route`), de donde estaba hasta el banderín (`wayTo`, `trace`); entero un
        rato y luego se borra desde donde salió hacia el banderín y se apaga (`TRAIL_LIFE` =
        3,5 s). Al arrastrar, el de muestra, más tenue.
  - [x] 7. La guardia (decidido con el usuario: en la puerta día y noche, sin acostarse): dos
        taburetes y un barril de jugar en el recibidor; de día, a las cartas y los dados (el
        respingo al plantar la carta, los dados que ruedan, una moneda alguna mano, bocadillos);
        de madrugada, cabeceando con los ojos cerrados y unas «zzz». Detalle en el encargo;
        capturas en `capturas/guardia/` (`tools/shots/guardia.mjs`).
  Capturas en `capturas/movimiento/`.

- [x] **El taller del pintor** ([`encargos/pintor.md`](encargos/pintor.md), rama
      `claude/eager-ptolemy-57jazp`):
  - el taller (`salas/pintor.ts`): el caballete con un cuadro a medio pintar (entero y con marco
    en el 3), los botes de pintura con el palo y las brochas, los rollos de tela en su cesta bajo
    cada ventana, la escalera apoyada en el rincón, el estante de pigmentos, las muestras de
    color en la pared, cuadros colgados (desde el 2), la mesa de mezclar en las anchas y la lona
    con manchas en el suelo. Sitios de trabajo nuevos: `caballete` (pintar) y `botes` (mezclar);
  - el pintor (traje `pintor`): bata clara manchada de colores, boina de vino y la brocha
    (herramienta nueva `brocha` en `weapons.ts`). En su taller pinta el cuadro y remueve los botes;
  - el trabajo se ve: la escena lleva al pintor a la sala que pinta (`painterAt` en `view.ts`) y
    avisa al llegar (`arrived`); mientras va de camino, nada cambia. Luego la pared del fondo pasa
    al color nuevo por franjas de izquierda a derecha y, en la de cada momento, de arriba abajo
    (`pintura.ts`: se dibujan las dos paredes al montar la sala y se copian las franjas a la
    textura, también la de luz con ambiente). El pintor se pone en la franja: subido a la escalera
    de tijera para lo de arriba (`stepladder`, `STEP_UP`), de pie y de rodillas para el zócalo.
    Al acabar cambian las telas, caen gotas del color por la pared (partícula `paint`) y destellos;
  - para que el color se vea en la pared: con tema, la cenefa pintada bajo la viga de cada
    planta y una raya sobre el zócalo (`tintBand` en `acabados.ts`); las salas enteladas del 3
    no la llevan (ya cambia la tela). Ojo: cambia el aspecto de las salas que ya tenían tema;
  - ronda 2 (el usuario: «no veo al pintor pintando la sala… desaparece y al acabar reaparece en
    su taller»; «la tarea no debería empezar hasta que el pintor llegue»): la tarea nueva le
    llegaba a la escena antes que el encargo y se iba a pasear (al salón, a sentarse); ahora, en
    cuanto llega el encargo, sale hacia la sala y deprisa (`setPaints`). En el núcleo
    (`core/paint.ts`, pedido del usuario): con el juego abierto no empieza hasta `arrived`, sin
    plazo (antes, a las `PAINT_WALK` horas aunque no llegara); solo con el juego cerrado (`away`,
    sin escena) se le da por llegado. La escena, además, no avanza la pared hasta verle en la sala.
    En la sala, casi siempre subido a la escalera y corriéndola cada par de franjas; una de cada
    cuatro, de rodillas por el zócalo. La cenefa también en los muros de los lados (el de la
    izquierda se pinta al empezar; el de la derecha, con la última franja). Prueba A/B de dónde
    va (`capturas/pintor/cenefa-AB.png`): el usuario eligió **bajo las ventanas**, con una raya
    en el límite de la pared con el techo (`capturas/pintor/cenefa.png`). Y la sastrería, igual:
    no se cose hasta que el héroe llega (`DRESS_WALK` solo con el juego cerrado);
  - ronda 3 (el usuario): nada avanza sin el trabajador en la sala, también la forja, la
    alquimia, las demás salas y el entrenamiento, y cada mañana se cuenta al llegar (detalle para
    el principal en [`agente-principal.md`](agente-principal.md), «Cambios en el núcleo hechos
    por el agente de arte»). Y vista previa del color: al tocar un color en la ficha de la sala
    (se tenga o no), la sala se ve así 3,5 s y vuelve sola, con un fundido al entrar y al salir
    (`previewTint` y `snapFade` en `RoomScene.ts`);
  - iconos: en Obras, la sala del pintor con una brocha (`brocha` en `ui/icons.tsx`; `pintado`
    es el del rótulo «Pintado» de la fachada y no se toca) y el banderín con la brocha mojada.
  - [ ] Visto bueno del usuario. Capturas en `capturas/pintor/` (`tools/shots/pintor.mjs`).

- [x] **Materiales, ranuras y almacén** ([`encargos/arte-materiales.md`](encargos/arte-materiales.md)):
  - los seis materiales (`art/materials.ts`, `materialIcon(m, 16 | 32)`), distintos por la forma:
    lingote, rollo de cuero atado, fardo de tela, manojo de hierbas, listones y cristal que brilla
    (a 32 con más detalle, no ampliado);
  - las siluetas apagadas de las ranuras (`slotIcon('arma' | 'cuerpo' | 'complemento')`), para el
    muñeco de la ficha (lo monta el de interfaz);
  - el almacén (`salas/almacen.ts`): una tarima por material con su letrero colgado del techo (su
    dibujo) y la pila encima según lo lleno (`SceneModel.mats`, en décimos en `look.mats`):
    lingotes en pirámide, rollos, fardos, sacos de hierbas, tablones y la caja de cristales que
    destella. En las anchas, dos tarimas por material (se llena una y luego la otra). En la pared,
    estanterías con cajas que se llenan con el total. Si no caben en fila (un hueco a nivel 2–3,
    con los raros), en dos filas: la de atrás subida a un estante de carga y un letrero doble por
    columna (los dos dibujos), para no invadir la sala de al lado;
  - sin almacén, el rincón de la bodega (`cornerPile`): tres columnas pegadas a la pared del fondo,
    a la derecha (lingotes, rollos y fardos), que crecen hasta 10 de cada;
  - el «+N»: una raya dorada por mejora en la esquina del icono y un destello (`itemIcon(…, plus)`;
    ya en el Arcón, la ficha del héroe, la del taller y el tablero de la bodega);
  - en la interfaz que hizo el de interfaz (#171): `MatIcon` (`ui/mats.tsx`) pinta estos dibujos a
    su tamaño (16 en líneas y chips, 32 en el estante) y el muñeco (`GearDoll`), las siluetas.
  - [ ] Visto bueno del usuario. Capturas en `capturas/materiales/` (`tools/shots/almacen.mjs`;
        `interfaz.png`, el Arcón y la ficha).

- [x] **Iconos y equipo puesto, por niveles** (el usuario, 8 de noviembre; validado en hojas
      antes de meterlo):
  - los nueve iconos del equipo, a mano en rejillas de 14 × 14 (`art/itemGrids.ts`; 16 × 16 con
    contorno, o al doble), sin ruido y simétricos (escudo, coraza, amuleto, capa);
  - la escala de niveles (`art/tiers.ts`): común gris, bueno verde, raro azul, épico morado y
    legendario oro. **El metal nunca se tiñe** (hierro mate, acero, acero pulido, ennegrecido,
    oro): el color va en gemas, runas, telas, el campo del escudo y el marco; cada nivel añade
    adornos (`ORN`). Hoy hay tres rarezas: `tierOf` pone el «bueno» en azul (como la interfaz);
  - los legendarios propios (`art/legendaries.ts`, por el nombre del objeto): los nueve del botín.
    Un legendario sin dibujo usa su icono en oro (los genéricos se quedan);
  - animados (`itemFrames`, `ItemImage`, `useShine`): los épicos, un brillo morado que cruza; los
    legendarios, una estrella; los propios, la suya (rayo, brasas, gota de las algas, aleteo,
    cristal que late, brillo en la hoja). Cada pocos segundos y al azar; sin movimiento si el
    sistema lo pide;
  - en el retrato y la figura, **las tres piezas** (antes, una): peto con hombreras, capa, escudo
    grande del que asoma la esquina (retrato), amuleto grande, bandolera de ganzúas, botas (figura).
    La **Corona del Rey Ahogado va en la cabeza**, en lugar del sombrero. El retrato brilla con lo
    épico o legendario (`portraitShine`) y en la escena les saltan destellos (`shineLegends`);
  - la escena (tablero de la bodega, lo que sale de los talleres) sigue con los de 12 × 12
    (`rackIcon`), con los colores nuevos;
  - el filete del tinte en peto y escudo lo hizo el agente principal (#185; revisado: bien, sin
    tocar el metal ni los legendarios propios);
  - la interfaz pinta los marcos por nivel (`tier-N`, `tierOf`): con los cinco niveles en el
    núcleo, verde y morado salen solos. El nombre del legendario pasa a rojo oscuro (el morado,
    para el épico);
  - capturas en `capturas/equipo-arte/` (`tools/shots/equipo.mjs`).

- [ ] **Pendiente (el usuario, 8 de noviembre): vista previa cosmética de los héroes**, como la de
      los colores de las salas: al elegir tinte o prenda en la sastrería, verlo unos segundos en el
      retrato de la ficha y en la figura de la escena (redibujarla con lo elegido y volver con un
      fundido, como `previewTint`/`snapFade`). Toca hacerlo después de los materiales.

- [ ] **La pelea de los asaltos, en directo** ([`encargos/arte-asaltos.md`](encargos/arte-asaltos.md)).
      Un PR por punto, desde la rama `claude/raid-combat-system-nkzv5y`.
  - [x] 1. Golpes por clase (`raidFx.ts`, `blowOf` y `blowFrame` en `crowd.ts`): el guerrero
        tajo (arma en alto y abajo, con el rastro blanco), el pícaro estocada (a fondo, con la
        raya), el clérigo mazazo (estrella y polvo en el suelo), el explorador flecha y el mago
        rayo azul que vuelan hasta el blanco (el número y la caída salen al llegar; a distancia,
        se quedan a `RANGED_REACH`). Habilidades: Provocar (arma en alto y ondas), Puñalada (aspa
        roja), Bola de fuego (chispas en el bastón, una bola a cada bandido y explosión), Curar
        (columna de luz y halo sobre el curado) y Andanada (dos flechas seguidas). Los bandidos,
        por su traje (el bruto tajo, el navajero estocada, el arquero flecha). El crítico, una
        estrella blanca. Los números de varios golpes al mismo, a los lados; y al acabar ya no se
        quedan congelados (el asalto sigue corriendo hasta que se quita). El duelo del ladrón ya
        usa el gesto de la clase (`strike` sin golpe).
  - [x] 2. Caer (`knock(id, push)` y `lying` en `crowd.ts`; `fallen`, `drop` en `raid.ts`): quien
        recibe el golpe de gracia se tambalea hacia atrás con los ojos cerrados, cae de espaldas
        hacia el lado contrario de quien le pegó (unos píxeles, con un rebote) y al tocar el suelo
        levanta polvo y suena. Se queda tendido con estrellas girando sobre la cabeza (los
        nuestros, mientras estén en el suelo; los bandidos, 3 s). El bandido que llevaba oro
        suelta el saco: sale despedido de la espalda, cae tumbado y abierto, las monedas saltan y
        se desparraman, y sube lo recuperado con su moneda. Los sacos se quedan hasta que acaba la
        noche. (`SACO=1` en `asalto.mjs` hace caer a uno con 40 de oro, para verlo.)
  - [x] 3. La marca de destino: ya estaba (#127, ver «Que lo que pasa se vea pasar», 6): al
        soltar a un héroe en el asalto en directo, el banderín con la espada y el camino.
  - [x] 4. Luz en lo oscuro (`lights`, `drawTorches` en `raid.ts`; `raidLamps` en `RoomScene.ts`):
        uno de cada tres bandidos (el primero siempre) lleva una antorcha en la mano de atrás, con
        la llama que baila y alguna chispa. Es un foco de verdad (`RAID_TORCH_R`, cálido, con
        parpadeo y halo) que le sigue y alumbra la sala en la que está y a quien pelea alrededor:
        en la cámara del tesoro y el sótano ya se ve la pelea. Si cae, la antorcha queda en el
        suelo, tumbada y alumbrando menos. Va en la mano, donde se ve la figura (`screenRect`, por
        la perspectiva) y según cómo se la ve (`Crowd.pose`): de frente, por fuera del costado
        contrario al enemigo; de perfil, tras la espalda (el usuario: «parece que la tiene en
        mitad de la cara»).
  - [x] 5. El duelo del ladrón (`duel` en `incidents.ts`, `thiefFightStrip` en
        `art/incidents.ts`, `guardUp` y `flinch` en `crowd.ts`, `drawDuels` en `RoomScene.ts`): al
        empezar, la cámara va a la pelea. El ladrón deja de pasear y se pone cara a cara con el
        héroe (a `DUEL_GAP`), meciéndose; tres dibujos nuevos: en guardia con la daga, la
        cuchillada a fondo (se echa encima) y encajando un golpe (la cabeza atrás, recula). El
        héroe, en guardia de perfil con el arma lista mientras el ladrón siga ahí; da su golpe de
        clase y, con cada cuchillada, recula (`flinch`). Si gana el ladrón, el héroe se queda
        doblado un momento y él sale corriendo con el saco, soltando monedas, sin que nadie le
        persiga (ya era así). Capturas: `node tools/shots/ladron.mjs <carpeta>` (`GANA=0`,
        `CLASE`); en `capturas/ladron/`.
  - [x] 6. La cámara lenta (`onSlow` en `RoomScene.ts`, `.scene.slow` en `styles.css`,
        `audio.setSlow`): mientras se arrastra a alguien en el asalto, los bordes se oscurecen
        hacia el azul de la noche y la imagen pierde color (CSS, con transición); todo suena
        apagado, como bajo el agua (un filtro de graves en el bus general), con un soplo al entrar.
        Al soltar, vuelve.
  - [x] 7. La tira (`RaidCrew.tsx`, `.rc-*` en `styles.css`): una tarjeta por defensor, con el
        retrato pequeño (`Portrait` a escala 1, con el marco de su clase), la vida (dorada si le
        queda poca) y la carga de la habilidad (una cinta dorada con su nombre cuando está lista).
        Un solo botón por tarjeta (antes, dos que hacían lo mismo): coge el crítico o lanza la
        habilidad. Crítico abierto: el marco late en amarillo con un rombo; corriendo, «»»; en el
        suelo, en gris. Hasta seis en una fila (en el móvil de 390, antes eran tres filas que
        tapaban la pelea). Capturas en `capturas/asaltos/` (`tira-antes-despues.png`,
        `tira-estados.png`).
  - [ ] **Pedido al núcleo (el usuario):** si el ladrón gana el duelo, huye por la puerta principal
        (recibidor y patio, `escape` en `incidents.ts`). Que los de guardia despiertos en las salas
        por las que pasa le puedan cortar el paso y darle un golpe: una última ocasión de recuperar
        lo robado. Es una regla (lo que se recupera), así que la decide el principal en
        `core/incidents.ts`; al arte le basta con saber, en `Incident.duel` o al lado, quién le
        sale al paso, en qué sala, cuándo y si le para (y cuánto se recupera). Con eso: el guardia
        le corta el paso, forcejeo corto, y o suelta el saco (con las monedas, como en el asalto) o
        se zafa y sigue corriendo.
  Capturas: `node tools/shots/asalto.mjs <carpeta>` (`LENTO=0.2` a cámara lenta, `RECORTE=480x300`
  solo el centro, `NIVEL` y `FUERZA` para que dure más). En `capturas/asaltos/`.

- [ ] **Tarea aparte (a valorar más adelante, el usuario):** unificar los efectos de la pelea de
      jefes (`world/battle.ts`: proyectiles y efectos dentro de la clase) y los del asalto
      (`world/rooms/raidFx.ts`, una versión a escala de sala escrita aparte) en un módulo común,
      para no tener el código repetido y que una mejora sirva para los dos.

## Estudio: estilo «Cast n Chill»

Pedido del usuario: ver si el pixel art puede ir hacia ese estilo. Pruebas, viabilidad y plan
por fases en [`estilo-cnc.md`](estilo-cnc.md) (visor: `capturas/estilo-cnc/index.html`).
Hecho de momento: el ajuste «Luz con ambiente» (Ajustes › Imagen) y una prueba de sombras en el
shader, apagada. Siguiente: [`plan-luz.md`](plan-luz.md) (fase 1: la fachada con relieve).

## Siguiente (en este orden, salvo que el usuario diga otra cosa)

0. **Expediciones** ([`encargos/arte-expediciones.md`](encargos/arte-expediciones.md)): el usuario
   pide (23 nov) que el visor y el mapa de rumbos se vean bien de verdad, sin reaprovechar la tira de
   los encargos, y valora un visor propio a más tamaño. Opciones con maquetas en
   https://claude.ai/artifact/Uc7GCVw5D5sEQ9oHp7MEog. **Elegido (23 nov):**
   - **Visor en el móvil: el cuadro enmarcado (B).** 156 × 140 píxeles a ×2, marco de madera de 10 px,
     cámara cerca; los héroes con su vida en el borde de abajo del marco y el día, la hora y el rumbo
     en la chapa de arriba. Debajo, título, mochila y diario.
   - **Visor en escritorio: pantalla entera (C).** 320 × 200 a ×3, la interfaz flota encima: arriba,
     el día y la distancia; abajo a la izquierda, los héroes; el diario en un panel a la derecha. Tocar
     el paisaje la esconde.
   - El dibujo es el mismo (capas, gente, tiempo); solo cambian el encuadre (horizonte y cámara) y el
     tamaño, así que la escena tiene que poder pintarse a cualquier ancho y alto.
   - **Mapa de rumbos: coherente con la sala de mapas**, como el de la comarca: pergamino a tinta
     (sala rota o a nivel 1) y terreno a color (nivel 2 o más). Un solo terreno debajo para los dos,
     así nada se mueve al subir la sala. Niebla en cada estilo: pergamino sin pintar con nubes a tinta;
     nubes blancas con volumen a color.
   - Orden: el bosque bien acabado primero (el usuario: «a full detalle, luego vamos desbloqueando zonas»); luego sierra,
     marismas y ruinas.
   - [x] **Visor del bosque** (`src/world/visor/`, encuadres `MOVIL` y `ESCRITORIO` en
     `encuadre.ts`): capas con paralaje en tiras precalculadas, lejanía gradual (sembrados y
     vallas → bosque viejo con musgo y sendero), luz por la hora (alba, día, atardecer, noche con
     luna y fugaces), cuervos, ciervos que huyen, lobos en la linde, lluvia y niebla al alba
     (`VisorForce` para forzarlas), héroes que andan y cojean, peleas por turnos con cifras y
     campamento (velada, noche con guardia y ojos, alba). `marchNow` añade `hour` (la del juego
     corrida 2 h: andan de 7 a 19), `weather` y `day`; se borra `expeditionStrip.ts`. Capturas en
     `capturas/expediciones/visor-bosque/`; herramienta `tools/visor.ts`.
   - [x] **Mapa de rumbos** (`expTerrain.ts`, `expFog.ts`, `ExpeditionFog.tsx`): un terreno para
     los dos estilos, pintado con los pinceles de la comarca (que sale idéntica, con test); niebla
     animada a 5 fps (papel con nubes a tinta / nubes blancas); estela de huellas y marcas de
     parajes. Marismas a 107° (a 135° el camino pisaba el mar). Capturas en
     `capturas/expediciones/mapa-rumbos/`.
   - [ ] Pendiente: gestos nuevos de héroe (recoger, cofre, beber, señalar, dormir tumbado),
     fardos a la vuelta y hallazgos en el visor; la pantalla entera de escritorio (hoy el visor va
     en la hoja lateral: interfaz del agente de expediciones); en la niebla a color, que las bolas
     no parezcan guijarros (cortes rectos donde se tocan) y algún hueco que deja ver terreno no
     explorado; luego sierra, marismas y ruinas en el visor.
   - [ ] **Revisión del bosque y rumbos nuevos (25 nov, en revisión):** página
     https://claude.ai/artifact/WaQtdS7PyuAzdXRLPLxDR5 con la crítica del bosque (B1–B11), la dirección de
     sierra, marismas y ruinas con capturas del motor (S1, M1, R1), el tiempo por rumbo (T1), la fauna
     (F1) y el reparto de enemigos y guardianes con dibujo propio (E1). Respuestas (25 nov): B1–B7, B10, B11 (dibujo), T1, F1 y E1 sí; B8 no por ahora; B9 sin tumbarlos
     (sentados con la manta del color de cada héroe); S1 nieve desde media lejanía; M1 barracas, pero
     enseñarlas antes y sin abusar; R1 clásicas que al adentrarse se vuelven una ciudad colosal, con
     algo de fortaleza. Segunda vuelta en la misma página (M2 barracas variadas, `tools/visor-barracas.ts`;
     R2 muralla y siluetas colosales). M2 sí; R2 sí, sin edificios con aire moderno (ahora templos,
     arquerías y escombros) y con la muralla baja, rota e irregular para que no tape; la torre colosal del
     fondo le gusta. **Hecho: rumbos nuevos en el visor (paisaje, tiempo y fauna), PR de
     `claude/arte-expediciones-areas`**; capturas en `capturas/expediciones/visor-rumbos/` (PR #226).
     **Hecho: el bosque nuevo (B1–B7, B10)**, rama `claude/arte-visor-bosque`: camino que serpentea con
     huellas, piedras y charcos, arroyo con puente, dos filas de árboles con sombra, especies por lejanía
     (`arbol` en `capas.ts`), señales del camino, copas que cierran (capa `copas`, solo donde los árboles
     llegan arriba: el móvil), rayos de sol, pájaros, conejos, mariposas y luciérnagas (`vida.ts`),
     nubes por semilla y día, halo del sol liso y anillos de lluvia. Capturas en
     `capturas/expediciones/visor-bosque/`. **Hecho: campamento (B9)**, rama `claude/arte-visor-campamento`:
     sentados con la manta del color de la ropa de cada héroe (con lo de la sastrería: `MarchNow.dress`, lo
     rellena `marchNow`), lona entre dos palos, humo con viento y lobos que de noche son solo ojos;
     capturas en `capturas/expediciones/visor-campamento/`. Enemigos (E1): el reparto por rumbo vale (`art/expFoes.ts`,
     rama `claude/arte-enemigos`), pero el usuario pide más calidad en los grandes y los guardianes:
     **dibujados a mano, píxel a píxel**, sin formas geométricas ni partir de los jefes de los encargos
     (que se rehacen más adelante). Muestra: el lobo enorme (`tools/bocetos/enemigos/huargo5.py`),
     esperando visto bueno (MA en la página). **Hecho (26 nov):** los del bosque calcados de las referencias
     del usuario y limpiados (`art/expCalcos.ts`, generado por `tools/bocetos/enemigos/bosque_calco.py` +
     `a_ts.py`; `calco2.py` calca por celdas y `boca_limpia.py` rehace las bocas): lobos, jabalí, oso y
     huargo con varios fotogramas, en la pelea del visor (`MarchNow.rival`, solo bosque; capturas con
     `tools/visor-pelea.ts`). El usuario: «no te compliques», vale un estilo propio si es más fluido.
     Falta: ratas y el resto de rumbos (sin referencia: estilo propio), guardianes, «Ver la pelea».
     **Sierra y marismas, primera pasada (26 nov):** el usuario trae los diseños (otra IA) y se calcan a color con
     `tools/bocetos/enemigos/calco3.py` (mediana por celda, k-medias por criatura, borde oscurecido;
     `sierra_calco.py`; `de_ts.py` saca los del bosque del `.ts` para regenerar con `a_ts.py`). Entran la
     sanguijuela (marismas: quieta, enroscada, salto, se alza, se lanza, revienta y charco), el gigante de
     hielo con garrote (sierra, en lugar del gigante de las nieves) y el dragón de hielo como guardián de
     sierra a la vista (`expGuardianArt`, `MarchNow.heading`). Todos los rumbos usan ya su reparto en la
     pelea del visor (`rival` siempre). Segunda vuelta (hojas por enemigo): sanguijuela verde
     que se pone roja al atacar (10), gigante (9) y dragón (19). Las poses pueden tener varios
     fotogramas (`FoeArt.seq`, `foeFrame` en `visor/gente.ts`): quieto respira, la carga, el golpe y el
     daño avanzan con la fase del turno. `calco3.py` separa familias de color (`split`), aclara tonos
     medios (`lift`) y conserva los ojos rojos (`acc`). Gigante v3 (hoja con muerte; la fila de andar se descarta
     porque trae el brazo y el garrote mal): fotogramas alineados por los pies, respira (quieto con
     una fila menos, sintético), carga, golpe, herido y muere cayendo (`seq.down`; sin los dos de tambalearse, que cogen el garrote del revés). En el visor el
     último enemigo nunca caía: ahora, si la pelea se ganó (`MarchNow.won`), al acabar los que quedan
     caen con su animación y el grupo lo celebra (`cheer`, saltitos) unos 3 s, con el paisaje parado
     (`Gente.holds`), antes de seguir. Dragón: muerte de una hoja aparte (se encabrita, se dobla, se desploma, queda
     helado y se deshace en tramado, `fade`; calcada con la misma paleta, `calco3` admite cajas de otra imagen) y el de escarcha para el
     golpe; también alineado por los pies. GIFs de todas las animaciones: `tools/enemigos-gif.ts`. La pelea contra el guardián
     ya sale en el visor (el núcleo la resolvía, también sola con «que peleen solos», pero el visor
     pintaba el enemigo 0 y, al ganar, la línea de botín tapaba la pelea): `rival.guardian` sale de
     `fight.exp.guardian` y el modo pelea mira la línea de pelea de esa hora, no la última.
     Falta: el resto de enemigos de sierra y marismas; la sanguijuela
     queda oscura en la marisma (es su color).
     Luego: pasada visual a sierra/marismas/ruinas y transiciones suaves (lluvia y fondo cambian de golpe).
     **Sucesos a la vista (26 nov):** con `e.pending` el visor pinta delante lo que hay (`visor/sucesos.ts`, `MarchNow.event`):
     cofre, santuario, mercader con carro, viajero, campamento abandonado, oso, cueva, torre y ruinas, pintados en
     tonos con la tabla de su capa (como el paisaje: sin contorno, luz por la izquierda); con jefe o
     guardián, el grupo agazapado tras matas y una roca a un lado y el jefe al otro (guardián: el huargo, de momento).
     Capturas con `tools/visor-sucesos.ts`. El bosque es el listón para los otros rumbos.
     Siguiente: enemigos y guardianes con dibujo
     propio (E1, B11) y una pasada de profundidad a sierra, marismas y ruinas. Orden: rumbos nuevos, bosque,
     campamento, enemigos. Para los enemigos: jefes a la vista en #225 (grupo parado mirando al jefe a
     lo lejos cuando `e.pending.kind === 'jefe'`, con `e.pending.foe`; `'guardian'` para el guardián). Prototipo en la rama `claude/arte-expediciones-areas` (sin PR): `visor/bioma.ts` (cada
     rumbo, su `Paisaje` y sus rampas), `capas-sierra.ts`, `capas-marismas.ts`, `capas-ruinas.ts`;
     `Clima` con `snow`, `wind`, `dust` y `storm` y la clase `Aire` en `tiempo.ts` (copos, rachas,
     polvo, relámpago; la «tormenta» de `expWeather` pasa a ser seca); fauna por rumbo en
     `animales.ts`. El bosque sale idéntico. Maquetas: `tools/visor-biomas.ts`.
   - [x] Pulido del mapa: niebla a color como mar de cúmulos (bolas con luz propia en dos capas,
     borde redondo, se encogen al despejar en 1,6 s), pergamino con borde a festones grabado y
     retirada, sierra alta con nieve a manchas, mar sin halos, marismas a tinta. Probadas 4 variantes de
     nubes y una mezcla (https://claude.ai/artifact/Hao1eL5R5RPZf8HrruaE8p): el usuario se queda con
     esta. Animación más fluida: deriva más rápida, se repinta cada vez que la niebla se mueve un
     píxel (hasta 20 fps) y solo lo que se ve (`rect`, de ~30 ms a 1,5–4,5 ms por fotograma).
1. **Más cilindros y cuerpos de verdad**: los barriles apilados, las mesas (tablero y patas), el
   horno de pan (cúpula) y la caldera (cúpula de cobre) con la misma idea que `round`.
2. [x] **Atlas de la gente en dos filas** (#100): se dibuja en una tira y se pliega (`fold` en
   `crowd.ts`); hay sitio para gestos nuevos. Ya va en **tres filas** (3024 × 84; se leía todo por
   `cellOf`/`uvOf`, así que lo de antes no cambia): los fotogramas nuevos van **al final** de
   `SIZES` para no mover los viejos.
   - [x] El gesto de beber en la cama (la pesadilla): `drink` en `heroSprites` (`composeDrink`,
         de frente: la jarra al pecho, a la boca con la cabeza atrás y los ojos cerrados, y
         empinada con el codo alto; jarra y brazo con su contorno sobre el cuerpo), en el atlas
         como `F.sip` (3 tiempos × las 13 mantas de incorporado). En la escena, la jarra baja
         flotando justo a su mano (`MUG_LANDS`), bebe (`sipAt`), se deshace en una nubecilla
         (`MUG_GONE`) y se acuesta. La jarra de la partícula es la misma (`MUG` de `hero.ts`).
         Los clientes de la barra ya beben de perfil (`F.drink`); los sentados, aún no.
3. **Rutinas y sitios para las salas sin nada que hacer**: armería (afilar en la muela), mapas
   (el mapa, los alfileres y el catalejo), despensa (la cocinera viene a por cosas), tesoro
   (contar monedas), capilla (arrodillarse y encender velas), recibidor (la ronda del guardia).
4. **Los talleres que trabajan** (forja, sastrería y alquimia): el encargo
   [`encargos/arte-talleres.md`](encargos/arte-talleres.md) (antes `arte-forja.md`). El código
   ya está en `main` (PR #96): aquí se hace que se vea. Por puntos:
   - [x] 1. El herrero y la herrera: traje `herrero` (camisa oscura sin mangas, mandil de cuero,
         guantes y martillo) para los de `trade: 'forja'` (`workerLook` en `ui/view.ts`).
   - [x] 2. (#100) Animaciones en la forja: martillar en el yunque (de costado, con chispas), avivar el
         fuelle, templar en la artesa con vapor (`martillar`, `avivar`, `templar`, `limar` en
         `crowd.ts`; herramientas `martillo`, `tenaza` y `lima`). Sin trabajo, quietos. Falta
         ver al héroe que echa una mano (usa la misma rutina si su `work` es la forja).
   - [x] 3. Forja encendida (brasas, más luz, la barra al rojo en el yunque) o parada (menos
         luz, la barra apagada). Sin trabajo, la fragua a media luz.
   - [x] 4. Al acabar (#100, y con `craftEnds` en este PR): la pieza un momento en el yunque
         con brillo (dorado y monedas solo si sale de las buenas); al cancelar, nada. En los
         otros talleres, el dibujo de lo que se ha hecho sube sobre su mesa y se apaga.
   - [x] 5. Desmontar en el banco (o, donde no hay, en el yunque, la mesa de cortar o el
         alambique): polvo y chispas; si sale la receta, un pergamino que sube y se deshace
         (partícula `scroll`).
   - [x] 6. Bocadillo sobre la sala con el icono y la barrita de `frac` (gris si está parado,
         azul si se desmonta; se aparta si hay un incidente; dos trabajos, uno al lado del
         otro): `ui/CraftMark.tsx`.
   - [x] 7. Sonidos: martillazo (`hammer`) y siseo del temple (`hiss`), solo si se ve la sala.
   - [x] 8. Sastrería (`salas/sastreria.ts`): maniquí con la prenda a medio hacer (entera en el
         3), mesa de cortar con tela, tiza, tijeras y acerico, tina de tinte con vapor, rollos
         de los tintes y carretes en la pared, patrones, telas tendidas y, en el 3 (o en las
         anchas desde el 2), el espejo.
   - [x] 9. Alquimia (`salas/alquimia.ts`): la mesa del alambique (matraz, serpentín y
         retortas burbujeando, con luz verde o azul que se aviva con trabajo), el caldero en sus
         trébedes con fuego, el atril con el libro, estantes de frascos y hierbas colgadas.
   - [x] 10. Sastre y alquimista: trajes `sastre` (chaleco rojo, cinta al cuello, tijeras) y
         `alquimista` (túnica verde, cinto con frascos). Trabajos: cortar, medir, coser, coser
         el bajo de rodillas (`crouch`), probar la tela, teñir; remover, moler, destilar y
         apuntar en el libro.
   - [x] 11. Vestir a un héroe: se queda de pie en el `probador` (junto al maniquí o delante
         del espejo) y quien cose trabaja a su lado: le mide, le prueba la tela y le cose el bajo.
         Al acabar, destellos a su alrededor.
   - [x] 12. Bocadillos como en la forja (las tijeras al vestir) y golpes con efecto: tijeretazo,
         burbujas del tinte y del caldero, la gota del alambique.
   - [ ] Visto bueno del usuario (#102).

   Para preparar la forja en el navegador (`#debug`): forja a nivel 1, un trabajador con
   `trade: 'forja'` y `room` la forja, y `__game.dispatch({ type: 'craft', room: <id>, recipe:
'espada' })`. No tocar `core/` ni la ficha; si falta un dato en `SceneCraft`, pedirlo en el PR.

5. **La capilla**: la luz de las vidrieras cayendo en color sobre el suelo, incienso y velas.
6. **Grosor en el resto de salas**: cocina (horno, mesas, aparador), despensa (estanterías y
   cajas a varias profundidades), capilla, mapas, armería, enfermería y dormitorios.
7. **«Juice» de la escena**: temblor de cámara suave (golpe de jefe, asalto, obra grande), pausa
   en el golpe y destello, estirar y aplastar, partículas que faltan (chispas, vapor, polvo,
   hojas al viento) y el sonido de cada sala al acercar la cámara.
8. **«Juice» de la interfaz**: botones con peso y ceremonia en las recompensas grandes (subir de
   rango, acabar una historia, pagar la deuda).
9. **El anexo y el jardín** (patio trasero, núcleo ya hecho): bajo tierra del jardín, puertas al
   jardín, sus piezas y el claustro. Encargo:
   [`encargos/arte-anexo-jardin.md`](encargos/arte-anexo-jardin.md). El usuario lo ha pedido
   antes que lo de arriba. Por puntos:
   - [x] 1. Bajo tierra (`facade` en `textures.ts`): la roca solo bajo el edificio; bajo el
         jardín, tierra con su borde de hierba como la de fuera; bajo el anexo, cimientos de
         sillares con zarpa, solo donde hay sala o escalera en la planta baja (sus solares
         vacíos, tierra). Capturas en `capturas/anexo/` (#105).
   - [x] 1b. La roca asoma por los lados del edificio en escalones (`rockBase`), cada hilada
         algo más ancha, hasta 22 píxeles: que se vea que lo asienta (el usuario, tras #105).
   - [x] 2. Puertas al jardín: la sala de la planta baja que da a él la tiene por dentro (como
         la del recibidor) y por fuera; con escalera al borde, en su rellano; si la escalera no
         tiene rellano abajo, no hay puerta (como `opens` en `cutOff`). Opción `garden` de `box`
         en `RoomScene.ts`.
   - [x] 3. El jardín liso: césped segado en franjas (`lawnTex` en
         `art/grass.ts`) con un camino de tierra pisada de una puerta a la otra (hacia
         `WALK_Z`); sin las matas al viento ni las flores del terreno. No llega al fondo (el
         usuario): acaba en `LAWN_D` con un borde sin segar (al fondo, y a los lados donde ya no
         hay edificios) y de ahí a los árboles, el terreno con sus matas.
         Ojo: en las texturas del suelo, la fila 0 es la del fondo.
   - [x] 4. Las piezas de `GardenLook` (`rooms/jardin.ts`, puestas por `gardenArt` en
         `RoomScene.ts`): suelo de grava o losas (`paintGround`, sin llegar al borde sin segar)
         con un lecho bajo cada pieza; fuente, pozo, árbol, estatua, banco, huerto (bancales con
         hileras de coles, lechugas, zanahorias y judías) y macizo de flores, a `PIECE_Z`
         (detrás de la gente); borde de delante bajo (seto, flores, verja) para no taparla;
         faroles entre trozo y trozo con su halo. `model.garden` entra en la clave de
         reconstruir la escena (antes, cambiar el jardín no se veía hasta otro cambio).
   - [x] 4b. El borde de delante (el usuario: «parece una cinta que tapa el camino»): el camino
         va más delante (por donde pisa la gente), el canto del césped tiene un fleco de
         briznas (`verge`) y el seto va en tramos y con cuerpo (`box`, se le ve el lomo).
   - [x] 5. El claustro (`cloister` en `RoomScene.ts`; `cloisterEnd`, `cloisterSide` en
         `jardin.ts`): soportales de piedra de `CLOISTER_W` pegados a cada fachada del jardín, a
         todo el fondo, con tantas plantas como tenga ese edificio junto al jardín (las de
         arriba, galerías con suelo de tablas y antepecho de balaustres) y un tejadillo con las
         tejas del edificio. Debajo, losas; el borde de delante va entre arco y arco.
   - [x] 5b. Pasada de calidad del claustro (el usuario: «podría mejorar mucho»): columnas de
         verdad (`pillar`: cilindros de 10 caras con luz, capitel y basa con `block`), arcos con
         dovelas, clave e intradós en sombra y con grosor (dos caras), pilastra en la fachada,
         techo de vigas, balaustres torneados, y el tejadillo con su tabla de alero y testero.
   - [x] 5d. El tejado del claustro (el usuario: «que quede bien con el resto»): es el faldón del
         edificio que da al jardín, que sigue con su pendiente y sus tejas hasta pasar los arcos,
         con el mismo canto de tejas delante que el hastial (`eaveFront`); lo de la planta de
         arriba que quedaría por encima se recorta por la línea del tejado. La viga del forjado
         es la del corte (con el alma oscura solo entre plantas) y el techo, el de las salas
         (`ceilingTex`).
   - [x] 5c. Con borde de seto, setos también al fondo del césped y a los lados donde ya no hay
         edificios (`backHedges`, con cara, lomo y testeros; `hedgeFace` como el de delante).
   - [x] 5e. El borde del fondo, para todos (el usuario: «lo mismo con flores y verja»):
         `backEdge` pone al fondo y a los lados el mismo borde que delante (seto o macizo de
         flores con cuerpo; verja de barrotes, sin grueso). Y el jardín, menos hondo (el
         usuario): el césped llega a `LAWN_D` = 118 (antes 140); las piezas, a `PIECE_Z` = 62,
         siguen detrás de la gente, y el huerto, más apretado.
   - [x] 6. Que no se cuelen: los árboles y arbustos del patio y del terreno de la derecha
         (`yardTrees`, `yardBushes`) y dónde salen las matas (`tuftAllowed`) van en
         `rooms/patio.ts`, contados desde `L.left`/`L.right` (que ya cuentan el anexo y sus
         solares); `patio.test.ts` lo comprueba con el anexo de 3, 4 y 5 huecos.
   - [x] 7. El claustro por partes (lo pide el usuario, sin núcleo todavía): `cloisterParts` en
         `jardin.ts` lee `GardenLook.cloister` como `true` (entero) o
         `{ edificio?: n | true, anexo?: n | true }` (plantas de cada lado desde la baja; 0 o
         sin poner, ese lado no). Si un lado se queda más bajo que su edificio, lleva su
         tejadillo propio contra la fachada. Para venderlo por partes, al núcleo le basta con
         cambiar el tipo de `cloister` en `data/custom.ts` y validarlo en `gardenLook`.
   - [ ] Visto bueno del usuario.

   Capturas: `node tools/shots/anexo.mjs <carpeta>`.

## Paisaje de sierra

Agente de arte de sierra (rama `claude/arte-visor-sierra`). Listón: el bosque. Piezas, una PR cada una:
(a) nieve y suelo, (b) profundidad por capas (matorral, piornos, canchales, pinos y abetos por
distancia), (c) fauna (rebecos, marmotas, chovas, quebrantahuesos) y viento en hierba y nieve,
(d) sucesos con material de montaña (torre sobre peña, cueva en risco, santuario, refugio de pastor).
Herramientas: `tools/visor-hoja.ts` (hojas de lejanía, claro y nevando, móvil y escritorio) y
`tools/visor-sucesos.ts <carpeta> sierra`.

- [x] **(a) Nieve y suelo** (`capas-sierra.ts`): neveros a manchas con labio al sol, panza en sombra
  y hierba mojada al pie (`neveros`, campo guardado por franja para no recalcularlo al rehacer
  tiras); `snowFar` (colinas y medio, crece hasta cubrir) y `snowNear` (lo de cerca, tope de
  neveros sueltos: S1), más si nieva; la senda serpentea con losas, escalones y cascajo y con nieve
  queda pisada y gris con huellas; arroyo de deshielo con espuma y pasaderas; césped de altura con
  musgo, genciana, árnica y edelweiss; cantos de caras planas (`canto`) y peñascos de tres hechuras
  con estratos, diaclasas, liquen y nieve en las repisas (`crag`); canchales en cono; delante
  festuca, cardos y cantos claros. Rendimiento igual que antes. Capturas en
  `capturas/expediciones/visor-sierra/` (`antes-*` es `main`).
- [x] **(b) Profundidad por capas** (rama `claude/arte-visor-sierra-capas`): abetos (`abeto`, cono
  prieto y oscuro de las umbrías bajas) que dejan paso al pino negro con la altura; piornos en
  cojín, en flor en los pastos medios (`piorno`), y enebro rastrero arriba (`enebro`; los dos con
  `mata`); medio en dos filas y a rodales con claros de pasto, con matorral a los pies y
  pedregales; cerca, árboles sueltos detrás de los peñascos y una orilla de matorral delante;
  colinas con motas de piorno y enebro a rodales (solo en lo verde) y abetos pequeños abajo.
  Rendimiento igual. Capturas en `capturas/expediciones/visor-sierra/`.
- [x] **(c) Fauna y viento** (rama `claude/arte-visor-sierra-vida`): rebeco con dibujo propio (más
  recio que el ciervo, antifaz y cuernos en gancho; sigue en lo más hondo), marmotas en los pastos
  altos que asoman, se sientan, silban y se meten en la madriguera si el grupo se acerca, chovas en
  bandada, el águila y, desde media lejanía, el quebrantahuesos de tarde en tarde (`animales.ts`).
  El viento (`vida-sierra.ts`): una brisa que nunca para (más con «viento») mece briznas sobre la
  hierba del suelo y la festuca de delante en ráfagas que pasan como olas, arrastra nieve en polvo
  de los neveros y arranca penachos de las cumbres. Coste: unos 0,07 ms por fotograma. Capturas:
  `hoja-viento.png`, `hoja-fauna-movil.png`.
- [x] **(d) Sucesos de montaña** (rama `claude/arte-visor-sierra-sucesos`, `sucesos-sierra.ts`):
  en la sierra, la torre de vigía cuadrada de mampostería con talud, sillares de esquina, la puerta
  en alto con su escalera de mano y el remate roto, plantada en su peña (unas 3,5 alturas de
  héroe); la cueva abierta en un risco de caras a plomo de refilón, con canchal al pie; el
  humilladero (cruz de piedra sobre un montón de piedras con hornacina y velas); el refugio de
  pastor de piedra seca y losa (en lugar de la tienda); la ermita en ruinas con la espadaña y su
  campana; y el escondite de piornos y un canto. Las piezas se eligen por rumbo en `sucesos.ts`.
  También: las peñas ya no tienen rayas a plomo (grietas torcidas e inclinadas y aristas en
  diagonal; lo pidió el usuario). Capturas en `capturas/expediciones/visor-sierra/sucesos/`.

## Lo que ha dicho el usuario (para no repetir errores)

- **Montañas:** sí a la bruma que las aclara (dan lejanía); la silueta, de sierra de verdad
  (cumbres agudas, collados, cresta mellada), como en su foto de referencia; las cañadas en
  diagonal y que confluyan, nunca rectas en vertical.
- **Fondo:** «se verá durante muchas horas: que sea entretenido y lindo»; el fondo no puede
  moverse al hacer zoom.
- **Nubes:** nada de bolas sombreadas una a una (parecen «un gusano o un zurullo»): una sola
  masa con la luz por franjas y los bultos solo en el contorno de arriba. Que se acaben poco a
  poco hacia arriba, nunca de golpe. El sol, el de antes (halo suave y disco).
- **Salas:** demasiado plano y demasiado pintado en la pared; quiere cosas que resalten, con
  cuerpo (el oro del tesoro, los hornos de la bodega).
- **Animaciones:** que no repitan un gesto todo el día (la cocina parecía que fregaba).
- **Mapa:** le gustaron las dos versiones; se usan las dos según la sala de mapas.
- **Bandidos de la tira:** los mismos de los asaltos, a escala de héroe (no gigantes).
- **Gestos:** la herramienta, a la altura de lo que se trabaja (nada de remover a la altura de
  los pies); lo que se acerca a la cara, en escorzo y sin taparla; nada de remover lo que está
  cerrado.
- **Profundidad:** nadie puede pasar por dentro de un mueble (dibujo delante, cuerpo detrás).
- **3D:** lo suelto, separado de la pared (si no, «se nota al desplazar la cámara»); en los
  costados, textura pintada según el material, nunca los píxeles del frente estirados; lo
  cilíndrico (cubas, barriles), cilindros de verdad.
- **Forma de trabajar:** pide capturas siempre; avisa si algo queda pendiente o si hay que
  coordinarse con otro agente.
