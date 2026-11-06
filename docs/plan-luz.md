# Plan de luz: el mejor efecto posible (estilo «Cast n Chill»)

Lo pidió el usuario tras las pruebas de [`estilo-cnc.md`](estilo-cnc.md): conseguir esa luz en
el juego, «sea con shaders o como sea». La fachada es lo que menos encaja hoy.

## Dónde estamos

- Hecho (PR #118): ajuste «Luz con ambiente» (salas a ×0,45 de luz de fondo y focos a ×1,6;
  las rotas, oscuras) y el halo de los focos ya no atraviesa los forjados.
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
