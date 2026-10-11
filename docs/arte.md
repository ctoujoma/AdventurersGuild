# Dirección de arte, escena y sonido

## Estilo

Pixel art nocturno y cálido: la taberna iluminada por la chimenea en mitad de la noche.

- **Paleta única:** Endesga 32 más seis tonos de piel y madera (`src/art/palette.ts`). Las rampas cambian de tono: las sombras tiran a púrpura y las luces a amarillo. La Tienda de pociones usará la misma.
- **Todo está dibujado píxel a píxel.** Nada de degradados con filtro: contornos oscuros, sombras en bloques, 3–4 tonos por material y tramado ordenado solo donde aporta (luz, cielo).
- **El arte vive en el código.** Las piezas son rejillas de caracteres o pinceles que colocan píxeles concretos (`src/art`, `src/world/props.ts`). Así se revisan en los diffs, se recolorean y los tests comprueban que ninguna pieza se sale de su rejilla. Si un artista hace PNG en Aseprite, se cargan como `PixelBuffer` y el resto no cambia.

## Retratos (`src/art/portraits/`)

Son de 40×40, en vista de tres cuartos, y se montan con piezas dibujadas a mano:

- **Cabeza** (masculina o femenina) con el sombreado ya pintado.
- **Rasgos:** 4 juegos de ojos (incluido el parpadeo), 4 cejas, 5 bocas, nariz grande, pecas, cicatriz y rubor.
- **Pelo:** 6 peinados, con pieza delantera y trasera (melena, coleta).
- **Barba** o perilla, y **sombrero** de su clase: casco, capucha, sombrero de mago o gorra con pluma.
- **Busto de su clase:** hombreras, capa, túnica, estola o delantal.
- **Marcas de estado:** parche y venda.

Cada pieza usa huecos de color (piel, pelo, ropa, ojos…) que se rellenan con la paleta de cada héroe. La combinación sale de la semilla del héroe, así que cada partida trae caras nuevas y el mismo héroe se ve siempre igual. En la interfaz los retratos parpadean de vez en cuando.

## Sprites (`src/art/heroes/`)

Miden 16×22 (18×28 con contorno y margen para sombreros):

- **De frente:** respiración en dos tiempos y parpadeo.
- **De perfil:** ciclo de paso de 4 fotogramas, con piernas alternas, brazo que se balancea y faldón para magos y clérigos.
- **Sentado:** de cintura para arriba, para colocarlo detrás de las mesas.
- **En la cama:** solo la cabeza con venda, sobre la almohada.

El contorno es selectivo: un tono bastante más oscuro que el borde de cada zona.

## La taberna (`src/world/`)

El mundo mide 512×384 píxeles y se ve en corte lateral, como una casa de muñecas. No cabe en la pantalla: se recorre arrastrando, con inercia, rueda o pellizco para el zoom (siempre a escala entera) y un botón para volver a la sala.

| Zona | Qué hay | Qué cambia con las mejoras |
| --- | --- | --- |
| Tejado | Tejas festoneadas, musgo, chimenea con humo, banderín y búho | — |
| Desván | Despacho del gremio: libro de cuentas, mapa, librería, armadura y murciélagos | — |
| Dormitorios | Literas, ventana y faroles | De paja en el suelo a 4 literas con colchas, cortinas y banderines |
| Enfermería | Camillas junto al tiro caliente de la chimenea | De cerrada con tablones a botica con pociones que brillan |
| Rellano | Retrato del tío Fausto, escalera de mano y barandilla | — |
| Sala común | Barra con tabernero, estanterías, barriles, tablón, mesas, chimenea con caldero y escalera | De cuarto en ruinas y frío a manteles, trofeo de caza, laúd, candelabro y fuego grande |
| Bodega | Bóvedas de piedra, botellero, toneles, gotera y rata | Un cofre por cada objeto del arcón |
| Exterior | Pozo, farol con polillas, letrero que se balancea, roble y luciérnagas | — |

**Fondo con paralaje:** cielo con luna y halo tramado, estrellas que titilan, estrella fugaz, nubes, montañas nevadas, colinas con aldea y castillo con ventanas encendidas, y una hilera de árboles. Cada capa se mueve a su velocidad.

**Luz:** cada habitación tiene su penumbra tintada y cada foco suma un círculo de luz por escalones tramados (`lighting.ts`). Los focos son la chimenea, las velas, los apliques, los faroles y la botica. Después todo se multiplica sobre la escena. Por las ventanas entran rayos de luna en diagonal con motas de polvo flotando. Las llamas y los faroles brillan encima.

**Vida:**
- Los héroes pasean, se sientan a las mesas o se calientan junto al fuego.
- Los candidatos esperan en la barra y el tabernero va y viene detrás.
- Los heridos guardan cama y sueltan «zZ».
- El gato Bigotes duerme junto a la chimenea y a ratos da una vuelta.
- La rata cruza la bodega, los murciélagos cuelgan del desván y el búho parpadea en el tejado.
- Partículas: ascuas, chispas, humo, vapor del caldero, hojas que caen y la gota de la bodega.

**Se puede tocar casi todo:**
- El tablón abre los encargos.
- La barra abre los candidatos.
- Dormitorios, enfermería, despacho y cofres abren el gremio.
- Un héroe abre su ficha con retrato.
- La chimenea suelta chispas, el gato ronronea con corazones, el laúd toca música con notas flotando, el búho ulula, los murciélagos salen volando, el pozo hace «plof» y el letrero se balancea.

## Sonido (`src/audio/audio.ts`)

Todo está sintetizado con WebAudio, sin archivos:

- **Ambiente:** el chisporroteo del fuego suena más fuerte cuanto más cerca está la cámara de la chimenea; grillos (más fuertes fuera), viento.
- **Música:** un laúd de cuerda pulsada (Karplus-Strong) toca una melodía en re dórico con bajo y acordes.
- **Efectos:** clics, papel, monedas, martillazos al mejorar, ronroneo, ululato, chispas, chapoteo, crujido, chillido y aleteo.

Hay un botón para silenciarlo. El sonido arranca con el primer toque, porque los navegadores lo exigen.
