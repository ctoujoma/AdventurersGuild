# Dirección de arte, escena y sonido

## Estilo

Pixel art nocturno y cálido: la taberna iluminada por la chimenea en mitad de la noche.

- **Paleta única:** Endesga 32 más seis tonos de piel y madera (`src/art/palette.ts`). Las rampas cambian de tono: las sombras tiran a púrpura y las luces a amarillo. La Tienda de pociones usará la misma.
- **Todo está dibujado píxel a píxel.** Nada de degradados con filtro: contornos oscuros, sombras en bloques, 3–4 tonos por material y tramado ordenado solo donde aporta (luz, cielo).
- **El arte vive en el código.** Las piezas son rejillas de caracteres o pinceles que colocan píxeles concretos (`src/art`, `src/world/props.ts`). Así se revisan en los diffs, se recolorean y los tests comprueban que ninguna pieza se sale de su rejilla. Si un artista hace PNG en Aseprite, se cargan como `PixelBuffer` y el resto no cambia.

## Retratos (`src/art/portraits/`)

Son de 40×48, en vista de tres cuartos, y se montan con piezas dibujadas a mano. Las 8 filas de arriba son para lo que se lleva en la cabeza: cascos de cúpula alta, sombreros de mago puntiagudos y plumas caben enteros, sin aplastarse. Detrás hay un halo cálido tramado en damero.

- **Cabeza** (masculina o femenina) con el sombreado ya pintado.
- **Rasgos:** 4 juegos de ojos (incluido el parpadeo), 4 cejas, 5 bocas, nariz grande, pecas, cicatriz y rubor.
- **Pelo:** 6 peinados, con pieza delantera y trasera (melena, coleta).
- **Barba** o perilla, y **sombrero** de su clase: casco de bandas con nasal, capucha, sombrero de mago con cinta dorada o gorro de cazador con pluma.
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

La taberna se ve como un edificio de salas en corte (al estilo de Fallout Shelter), en 3D
pixelado con three.js: `src/world/rooms/` (ver [`salas/README.md`](salas/README.md) y, para
el arte de cada sala, [`salas/encargo-arte.md`](salas/encargo-arte.md)). La taberna dibujada
de antes, fija y en 2D, se quitó en el PR 12 de la rama `salas`; de ella quedan las piezas que
se reutilizan:

- `props.ts`: atrezo (barriles, cofres, chimeneas, mesas, camas, letrero con el escudo…).
- `paint.ts`: pinceles de materiales (yeso, madera, piedra, vigas, telarañas).
- `parallax.ts`: cielo, luna, estrellas, montañas, colinas y árboles del fondo.
- `lighting.ts`: focos tramados para los halos y la pelea contra el jefe.
- `particles.ts`: ascuas, chispas, humo y polvo.
- `camera.ts` y `geometry.ts`: cámara 2D y medidas del mundo (altura del suelo).
- `battle.ts` y `weapons.ts`: la pelea animada (contra el jefe y los bandidos del asalto).
- `scene.ts`: los tipos que la escena recibe del juego (`SceneModel`) y sus avisos.

## Sonido (`src/audio/audio.ts`)

Todo está sintetizado con WebAudio, sin archivos:

- **Ambiente:** el chisporroteo del fuego suena más fuerte cuanto más cerca está la cámara de la chimenea; grillos (más fuertes fuera), viento.
- **Música:** un laúd de cuerda pulsada (Karplus-Strong) toca una melodía en re dórico con bajo y acordes.
- **Efectos:** clics, papel, monedas, martillazos al mejorar, ronroneo, ululato, chispas, chapoteo, crujido, chillido, aleteo, una nota al elegir héroe y una fanfarria de laúd cuando el grupo sale.

Hay un botón para silenciarlo. El sonido arranca con el primer toque, porque los navegadores lo exigen.
