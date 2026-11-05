# Estilo «Cast n Chill»: viabilidad y pruebas

El usuario pidió estudiar si se puede rehacer o mejorar el pixel art con un estilo como el de
_Cast n Chill_ (paisajes de otoño, bruma, lagos con reflejo, luz cálida). Aquí está lo que se
probó, lo que sale y un plan por fases. Nada de esto toca el juego todavía: son pruebas.
Capturas en [`capturas/estilo-cnc/`](capturas/estilo-cnc/), con un visor (`index.html`) para
compararlas.

## Qué separa el estilo de hoy del de las referencias

| | Jarro hoy | Cast n Chill |
| --- | --- | --- |
| Paleta | Endesga 32: saturada, negros puros, verdes y rojos muy vivos | Muchos tonos, apagados y emparentados; nada llega al negro; cada hora tiene su gama |
| Profundidad | Las capas lejanas se distinguen por el dibujo | **Perspectiva atmosférica**: cuanto más lejos, más se funde con el color de la bruma y menos contraste |
| Sombreado | Tramado Bayer (cuadrícula) en cielo, montes y luces | Racimos de color sin trama; los degradados son bandas de borde mellado |
| Contorno | Contorno oscuro en casi todo | Casi sin contorno: la forma la da el cambio de luz |
| Luz | Ambiente y focos | Una luz que manda (el sol bajo), con cara iluminada, cara en sombra y borde de luz |
| Vegetación | Árboles redondos con contorno | Abetos por pisos, alerces amarillos, matorrales de racimos; cada uno con su luz |
| Agua | No hay | Espejo roto en franjas horizontales y rayas de brillo que tiemblan |

## Las pruebas

Todo sale de código (como el arte del juego), en `tools/estilo/` (Python con numpy; para el
juego se pasaría a TS sobre `PixelBuffer`).

**A. Paisaje nuevo, de cero** (`paisaje.py`): cielo en bandas, cúmulos o pinceladas, montes
con espinazo y nieve en surcos, bosques en tres distancias con bruma, la taberna en la orilla
con su humo, el lago con el reflejo y el primer plano que enmarca. Se pinta en capas, cada una
con su paralaje, a 480×270 (×4 en las capturas) y reducido a 64 colores sin trama. Cuatro
horas: `a-otono`, `a-alba` (violeta con bruma), `a-ocaso` y `a-noche`; y
`a-otono-paralaje.gif` con la cámara moviéndose, el agua temblando y el humo subiendo.

**B. Solo cambiar la paleta** (`regradeo.py`): las capturas de hoy con otro gradeo (menos
croma, negros levantados hacia un azul violáceo, sombras frías y luces cálidas). Es lo que
haría el shader de `gl.ts` cambiando la paleta. `hoy-tarde` → `b-tarde`, `hoy-patio` →
`b-patio`. Resultado: más suave y más «de atardecer», pero **no** es el estilo: el tramado, los
contornos y las formas siguen igual. Ayuda, no basta.

**C. El fondo nuevo detrás del juego de hoy** (`compose.py`): se pintó el cielo del juego en
magenta (un cambio temporal en `RoomScene.ts`, ya quitado), se sacó la captura y se puso el
paisaje A detrás, con el gradeo B en lo demás: `hoy-patio` → `c-patio`. Es lo más cercano a
cómo se vería la primera fase. Se nota el choque: los árboles redondos del patio y el pozo
siguen en el estilo viejo.

Fallos que quedan en las pruebas (arreglables, pero hay que decirlos): los abetos grandes
parecen platos apilados, los cúmulos algo «de algodón», la casa es muy simple y en C el píxel
del fondo es de 3 y el del juego de 2.

## ¿Es viable?

**Sí para el fondo y el exterior; caro para el resto.** A favor:

- El arte es código y la escena ya pasa todo por una paleta en el shader (`uPalette` en
  `gl.ts`): cambiar la paleta, o tener una por hora, es un cambio pequeño.
- El fondo ya es 2D por capas con paralaje (`sky.ts`, `parallax.ts`, `art/clouds.ts`): se
  puede cambiar capa a capa sin tocar las salas. El generador de A pinta las capas que hacen
  falta en una fracción de segundo; se pintan una vez por hora del día y se guardan.

En contra:

- Las salas, los muebles, la gente, los retratos y la fachada son cientos de piezas dibujadas
  a mano para Endesga, con contorno y trama. Pasarlas al estilo nuevo es rehacerlas una a una.
- Mientras convivan los dos estilos, se nota (se ve en C).
- Los retratos tipo referencia 4 piden más resolución (unos 64×80 en vez de 40×48).
- Inspirarse en el estilo, sí; copiar escenas, personajes o piezas de _Cast n Chill_, no.

## Plan propuesto (por fases, cada una un PR o varios)

1. **Paleta y luz por hora** (1 PR): paleta nueva de ~64 tonos con rampas apagadas y negros
   azulados; en el shader, un gradeo por hora (mañana, mediodía, atardecer, noche) en vez de
   una sola paleta. Revisar todas las salas con la galería.
2. **Fondo nuevo** (2–3 PR): pasar `paisaje.py` a TS y sustituir cielo, nubes, montes y
   bosques lejanos; añadir un lago o un río lejano con su reflejo. Es lo que más cambia el
   aspecto y lo que menos riesgo tiene.
3. **Patio y fachada** (1–2 PR): árboles, pozo, hierba y cercas del patio en el estilo nuevo
   (abetos por pisos, alerces, matorrales), y la fachada sin trama y con luz de borde.
4. **Salas** (un PR por cada 2–3 salas): quitar el tramado, aflojar los contornos, luz de las
   ventanas y de los fuegos en racimos. Es lo más largo.
5. **Gente y retratos**: los sprites ya tienen un tamaño parecido a los de las referencias;
   basta con colores y contorno. Los retratos, solo si se quiere el salto de resolución.

Recomendación: hacer 1, 2 y 3 (lo que más se ve y menos cuesta) y decidir con eso delante si
merece la pena seguir con 4 y 5.

## Cómo repetir las pruebas

```bash
python3 tools/estilo/paisaje.py salida/otono.png otono 11 --gif   # otono, alba, ocaso, noche
python3 tools/estilo/regradeo.py captura.png salida.png tarde      # tarde, dia, noche
```

`compose.py` necesita una captura con el cielo en magenta (`<dir de los .py> <captura> <hora
del paisaje> <salida> <escala> <y del horizonte> <gradeo|no>`).

## En el juego (después de las pruebas)

- Ajustes › Imagen › «Luz con ambiente»: menos luz de fondo en las salas y focos más fuertes.
  Es lo más barato y lo que más acerca el aspecto (charcos de luz con los sprites de hoy).
- Prueba de sombras en espacio de pantalla y luz de borde, en el shader, apagada por defecto:
  funciona, pero se ve poco con piezas planas pegadas a la pared, la paleta Endesga y su trama.
  Capturas con `node tools/shots/sombras.mjs <carpeta>`.
