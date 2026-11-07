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
  - [ ] 8. Resto de materiales.
        Capturas en `capturas/fachada-envejecida/`.

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

1. **Más cilindros y cuerpos de verdad**: los barriles apilados, las mesas (tablero y patas), el
   horno de pan (cúpula) y la caldera (cúpula de cobre) con la misma idea que `round`.
2. [x] **Atlas de la gente en dos filas** (#100): se dibuja en una tira y se pliega (`fold` en
   `crowd.ts`); hay sitio para gestos nuevos.
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
