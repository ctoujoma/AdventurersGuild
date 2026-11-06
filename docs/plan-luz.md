# Plan de luz: el mejor efecto posible (estilo «Cast n Chill»)

Lo pidió el usuario tras las pruebas de [`estilo-cnc.md`](estilo-cnc.md): conseguir esa luz en
el juego, «sea con shaders o como sea». La fachada es lo que menos encaja hoy.

## Dónde estamos

- Hecho (PR #118): ajuste «Luz con ambiente» (salas a ×0,45 de luz de fondo y focos a ×1,6) y
  el halo de los focos ya no atraviesa los forjados. En el #119, las rotas también oscuras.
- Probado y apagado: sombras en espacio de pantalla y luz de borde (`lit` en `gl.ts`). Funcionan
  a medias: las piezas son planos finos pegados a la pared y la sombra apenas se ve; el fuego,
  metido en el hogar, oscurece de más.
- Probado y descartado: un sol con dirección (por la mañana a la derecha, por la tarde a la
  izquierda, como el del cielo) aplicado a la fachada tal cual. **No cambia casi nada**: en la
  vista en corte casi toda la fachada (hastiales, entramado, muros) es un plano mirando a la
  cámara, con la misma normal, así que el sol la ilumina por igual. Le falta el relieve.

## La idea que lo resuelve: relieve en las texturas

En la prueba de la fachada (`tools/estilo/`, `fachada.py`) cada píxel sabía cuánto sale de la
pared: vigas, aleros, alféizares, jardineras, rótulo, sillares. Con eso salen el sombreado (la
normal del relieve), la sombra arrojada del sol y los bordes de luz. Se puede hacer igual en el
juego, sin depender de la profundidad de pantalla (y sin sus fallos):

- Cada pintor de arte escribe, junto al color, un **relieve** (0-255) en un segundo búfer. Es
  natural en nuestro arte por código: quien pinta una viga sabe que es una viga.
- Va al shader como segunda textura (mismas medidas). De ahí: normal por píxel; sombra
  arrojada marchando **dentro de la textura** hacia el sol (o el foco) y comparando relieves;
  borde de luz donde el relieve cae del lado del sol.
- Sin relieve (lo que aún no lo tenga), la superficie se ve como hoy.

## Hecho (PR #119, todo dentro de «Luz con ambiente»; sin el ajuste, el juego como antes)

Capturas en `capturas/luz-ambiente/` (`<hora>-taberna.png`, `<hora>-salon.png`: arriba la luz de
siempre, abajo con el ajuste; `fachada.png`: mañana y tarde), con `tools/shots/luz.mjs`.

- **Fase 1 (fachada).** `PixelBuffer` con relieve (`relief`, pintado con `level`: lo de encima
  tapa lo de debajo). Lo pintan las tablas, el entramado y la sillería (`muros.ts`), las cinco
  paredes de `materiales.ts`, las vigas, postes, tablas y sillares de `paint.ts` (también dentro),
  las tejas (`roofRelief` en `fachada.ts`) y el hastial (alero, óculo, jardinera). En el shader
  (`sunlight` y `reliefShadow` en `gl.ts`): sol con dirección por hora (`uSunDir`: sale por la
  derecha, se pone por la izquierda), normal del relieve, sombra arrojada marchando por la
  textura, borde de luz en los cantos que dan al sol; cara al sol cálida (naranja intenso a la
  hora dorada) y sombra violácea. De noche, la luz de cada sala alcanza el grueso del muro en
  corte que la rodea (`uZonePad`).
- **Fase 2 (color).** Sin paleta Endesga ni trama en cuadrícula (`uBands`): la intensidad de la
  luz en siete escalones con el borde mellado en grumos de 2 téxeles fijos a la superficie, el
  halo en cinco anillos y el color pintado algo menos saturado.
- **Fase 3 (dentro, primeros pasos).** El relieve también con los 8 focos más cercanos al centro
  de la vista (sillares de la chimenea, vigas). Luz que entra por cada ventana (`takeWindows` en
  `textures.ts`): un foco del color del día delante de ella, lleno de día, dorado al atardecer y
  apagado de noche; el día que llegaba igual a toda la sala baja al ×0,45. Luz de borde de los
  focos en la gente. Y el rayo de sol en el aire (`shaft` en `gl.ts`): una lámina aditiva en
  bandas de la ventana al suelo, inclinada al contrario del sol.

## Hecho después (PR siguiente al #119)

Capturas al día en `capturas/luz-ambiente/`; `fondo.png`: de arriba abajo, sin el ajuste por la
mañana, con él por la mañana, al ocaso y el patio.

- El halo de las luces, solo en el aire de su sala: ya no se ve en los muros ni a través de ellos
  (la zona de un foco incluye media pared de cada lado; el halo se queda dentro).
- **Fase 3.** Relieve de bisel en todas las figuras que no lo pintan (muebles, chimeneas,
  rótulo, faroles): `bevelRelief` en `pixel.ts`, sale de lo lejos que está cada píxel del borde y
  hunde las líneas oscuras de dentro.
- **Fase 4 (fondo).** `paisaje.ts` (de la prueba A): dos sierras grandes con nieve, espinazo,
  surcos y bruma hacia el pie; la cara al sol pasa de la derecha (mañana) a la izquierda (tarde);
  al ocaso y al alba, nieve rosa y naranja (alpenglow); de noche, siluetas con la nieve a la
  luna. Un bosque lejano de abetos con bruma entre los montes y las colinas. El cielo en bandas de
  borde mellado (sin trama) y las capas de delante algo apagadas por la bruma. Las capas nuevas se
  repiten sin espejo (periódicas a lo ancho). Se pintan la primera vez que se pone el ajuste
  (unos 150 ms).

Lo que falta: el polvo en los rayos de sol; de noche, la luz de las ventanas hacia fuera (patio y
fachada); los árboles del patio y las colinas en el estilo nuevo (siguen los de Endesga); medir
el rendimiento en un móvil de verdad; la fase 5.

## Hecho después (PR siguiente al #120)

- Montes: vuelven a la silueta de siempre (`ridgeAt`: sierra continua, cumbres de tres tamaños,
  collados y cresta mellada; los nuevos eran casi triángulos) con la textura nueva encima (cara de
  luz y de sombra según hacia dónde baja la cresta, surcos, nieve por altura y bruma), y detrás
  otra sierra más alta y brumosa.
- Árboles del patio en el estilo nuevo (`arboles.ts`): abetos rama a rama (cada una con su largo,
  caída y lado; con huecos y la punta algo torcida), robles en racimos (algunos de otoño) y
  matas; sin contorno y con relieve, así el sol del shader les da la cara de cada hora. Los de
  siempre siguen ahí, ocultos, y vuelven sin el ajuste.
- Fondo: las arboledas cercanas con esos mismos árboles (de noche, su silueta en azules) y las
  colinas sin tramado (`untrammed`).
- Pendiente de los árboles: el usuario los ve aún algo previsibles; los abetos ya van rama a
  rama, pero se pueden variar más (abetos jóvenes, secos, inclinados, de dos puntas) y mezclar
  especies (alerces, abedules).

## Hecho después (PR siguiente al #121)

- Suelo y hierba de toda la escena (`suelo.ts`): las texturas de siempre pasadas al estilo nuevo
  (grumos de verdes apagados que siguen lo que había: camino, calvas, franjas de siega y bordes;
  tierra en tonos de tierra; flores y piedras apagadas; sin relieve, que en un suelo plano dejaba
  una raya de sombra en el borde del camino), y las matas con
  los verdes apagados.
- El camino de tierra del patio va delante, a la altura de la puerta (estaba al fondo: la fila 0
  de la textura es la del fondo). Arreglo para todos, también sin el ajuste.
- Bosque lejano en filas de atrás adelante: la de arriba, más lejos (pequeña y con bruma); las de
  abajo, más cerca, tapan a las de detrás.
- Colinas sin el tramado en ajedrez (cada cuadro, la media de su entorno).

## Hecho después (PR siguiente al #122)

- La sombra de la taberna fuera, según la hora (`buildingShadow` en `gl.ts`): el edificio como
  cajas (el perfil de lo alto de las salas, con el tejado; `shadowBoxes` en `RoomScene.ts`) y,
  para cada punto de fuera, un rayo hacia el sol. Cae de lado (el sol de la sombra no tiene
  componente hacia delante: si no, se iba detrás, donde no se ve), corta a mediodía y larga al
  atardecer; lo que queda dentro (suelo, árboles, gente) pierde el sol y toma la luz fría del
  cielo. Borde mellado. Captura: `capturas/luz-ambiente/sombra.png` (mañana y tarde).
- El rayo de sol de las ventanas, un píxel más ancho por cada lado.
- Polvo en los rayos de sol: motas de un píxel que bajan despacio, se mecen y titilan.

Lo que falta: de noche, la luz de las ventanas hacia fuera (patio y fachada); pozo, letrero y
muñecos del patio en el estilo nuevo; medir el rendimiento en un móvil de verdad; la vista desde
fuera al alejar (abajo); la fase 5.

## Idea: la taberna vista desde fuera al alejar del todo

Con el zoom más alejado (o uno más, añadido para esto), dibujar la taberna con el corte tapado:
reaparece la «tapa» (los muros de delante, que hoy son transparentes al jugador) y se ve la
taberna desde el exterior, como una casa de verdad en el paisaje. Para eso, a las salas se les
añaden ventanas también por ese lado (encendidas de noche, con la luz de cada sala), y la tapa
se funde al acercar. Encaja con la luz con ambiente: de noche, la casa como islas de luz cálida
en las ventanas.

## Fases (cada una, un PR con capturas antes y después, dentro de «Luz con ambiente»)

1. **Fachada y exterior con relieve** (lo primero: es lo que no encaja).
   1. Relieve en `muros.ts` (`wallFace`, `wallSection`), `fachada.ts` (tejados y paredes),
      hastiales, aleros, chimeneas, rótulo, faroles y jardineras.
   2. Sol con dirección por hora y su color; cara al sol cálida, sombra fría (luz del cielo);
      sombra del alero sobre el hastial, de las vigas, alféizares y rótulo; borde de luz en los
      cantos que dan al sol (tejados y chimeneas al atardecer).
   3. De noche: las ventanas encendidas iluminan la fachada y el patio (focos hacia fuera con
      su halo), el farol del rótulo y la luna con su dirección.
2. **Paleta y trama.** Hoy todo cae en Endesga 32 con trama en cuadrícula: las luces suaves
   salen a escalones tramados. Paleta ampliada con rampas apagadas (cálidas a la luz, frías a la
   sombra) y bandas de borde mellado fijas al téxel en vez de la trama. Es el cambio que más
   acerca el aspecto de las pruebas; hay que revisar todas las salas con la galería.
3. **Interior con relieve.** El mismo relieve en paredes del fondo y muebles: sombras de los
   focos sobre la pared (estantes, tablón, chimenea), rincones más oscuros (oclusión), rayo de
   sol por las ventanas con polvo de día y de tarde, y la luz de borde de los fuegos en la gente.
4. **Fondo y patio.** El paisaje de la prueba A (cielo en bandas, montes con nieve, bosques con
   bruma por distancia) en las capas del paralaje, y los árboles del patio a juego.
5. **Arte de la gente y retratos** (sin contorno, proporciones más realistas): solo si, con lo
   anterior, el usuario lo quiere; es lo más caro.

Orden recomendado: 1 → 2 → 3 → 4 → 5. Tras cada fase, el usuario decide si sigue.

## Riesgos

- Rendimiento en móvil: la sombra en textura es un bucle corto por píxel y por foco cercano;
  con «Pocas luces» se limita igual que hoy. Medirlo en cada fase.
- Legibilidad: con más contraste, que la gente y lo tocable sigan leyéndose (luz de borde,
  mínimo de luz en lo tocable si hace falta).
- La paleta (fase 2) cambia todo el juego a la vez: hacerla detrás del mismo ajuste hasta el
  visto bueno.
