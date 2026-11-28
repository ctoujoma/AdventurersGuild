# Enemigos de las expediciones: cómo se hacen

Lo aprendido con sierra (#237), para retomarlo en otro rumbo. El estado y el plan están en
[`plan-arte.md`](plan-arte.md).

Glosario de todos los enemigos y jefes, con sus animaciones y dónde salen: [`glosario-enemigos.html`](glosario-enemigos.html)
(se regenera con `node tools/textos/esbuild.mjs tools/glosario-enemigos.ts glosario docs/glosario-enemigos.html`
al cambiar un enemigo).

## Flujo

1. El usuario trae una hoja por enemigo, hecha con otra IA. Funciona mejor así: fondo liso, de perfil
   mirando a la derecha y las poses en fila. Si una pose está mal (por ejemplo, el garrote cogido
   del revés), se descarta; no se arregla.
2. Se calca con `tools/bocetos/enemigos/calco3.py` y un guion por rumbo (`sierra_calco.py`
   sirve de modelo). Luego `a_ts.py` regenera `src/art/expCalcos.ts`, que no se edita a mano.
   Los JSON intermedios no van a git; `de_ts.py` saca los del bosque del `.ts`.
3. Se le asignan las poses en `src/art/expFoes.ts` con `calcoArt(kind, what, poses, big, seq, fade)`.
4. Se revisa con GIFs (`tools/enemigos-gif.ts`: quieto, ataque, herido y muerte) y con capturas del
   visor (`tools/visor-pelea.ts <carpeta> <rumbo>`, que también saca el guardián y el final al ganar).
   El usuario ve los GIF antes de fusionar.

## Calco (`calco3.py`)

- **`k`:** cuántos píxeles de la referencia caben en un píxel del juego. Se elige por el tamaño final;
  la búsqueda de rejilla no es fiable con estas hojas.
- **Tamaños de referencia:** un héroe mide unos 22 px. Una alimaña, unos 16 px de alto; el gigante,
  unos 42; el dragón, unos 55.
- **`n` colores:** salen por k-medias para toda la criatura. Como mucho caben 36 colores por calco,
  contando los bordes oscurecidos.
- **`split`:** separa las familias de color (la sanguijuela verde y roja) para que no salgan medias
  marrones.
- **`lift`:** aclara los tonos medios. `edge` oscurece el borde: con figuras finas, súbelo
  (0,6–0,7) o quedan negras.
- **`acc`:** guarda los detalles pequeños, como los ojos rojos, con un predicado sobre los píxeles.
  Los ojos de estas hojas son de un rojo apagado: R > G+25 y R > B+8.
- **`drop`:** quita píxeles, como las sombras grises. Ojo: puede comerse los brillos de figuras
  oscuras.
- **Cajas de varias hojas:** una caja puede ser `(imagen, x0, y0, x1, y1, k)`, para usar otra hoja
  con la misma paleta (la muerte del dragón).
- **`feet=True`:** alinea todos los fotogramas por los pies (el centro de las 3 filas de abajo), no
  por la izquierda. Sin esto, la figura baila al cambiar de pose. Una variante sintética de un
  fotograma debe usar la alineación de su original.

## Animación

- **`FoeArt.seq`:** varios fotogramas por pose (`idle`, `windup`, `strike`, `hurt`, `down`). Quieto
  se reproduce en bucle a 5 fps. La carga, el golpe, el daño y la caída avanzan con la fase del
  turno (`foeFrame` en `visor/gente.ts`).
- **Mezclar dibujos de poses distintas** dentro de una misma acción hace parpadear la figura (el chorro del dragón
  en dos ángulos, el «recoger el garrote»). Es mejor repetir un fotograma, o hacer una variante sintética
  que no mueva el cuerpo (la llama que titila), que meter uno que no casa.
- **Rellenar huecos de la hoja:**
  - respirar: el fotograma quieto con una fila menos a la altura del pecho;
  - titilar: el mismo dibujo con el borde comido en tramado;
  - desaparecer: `fade` pasos de tramado Bayer al final de la muerte.
  - Nada de opacidad: no encaja con el pixel art.
- **Embestida:** los que traen el golpe dibujado no se mueven 3 px hacia delante, porque ya se echan
  adelante en el dibujo.

## En el visor (estándar para todos los rumbos)

- **La pelea, tal cual fue** (usuario, 28 de noviembre): el visor y «Ver la pelea» repiten la pelea de
  verdad (`visor/replay.ts`: `Combat` con el `sim.setup` que guarda el diario). Cada uno pega
  cuando pegó, a quien pegó y lo que quitó (las cifras son las de verdad; críticos en amarillo,
  curas en verde); el golpe fuerte del jefe tiembla; cae quien cayó, con el golpe que le tumba, y
  los héroes caídos quedan tendidos.
  - En directo, la pelea cabe en su hora del camino (va más deprisa si duró más de 12 s); al
    repetirla, a su paso, con botón de velocidad (×1, ×2, ×4) y «Al final».
  - Si el motor y el dibujo no cuentan los mismos enemigos (la manada de tres lobos es una unidad;
    los esbirros del ahogado no se dibujan), la vida de todos se reparte entre los muñecos: cada
    uno cae con el golpe que se lleva su parte. Pedido al agente de expediciones que el motor
    arme tantas unidades como muñecos.
  - Capturas: `node tools/textos/esbuild.mjs tools/visor-replay.ts replay <carpeta> <rumbo> <n> [lejanía]`.
- **Al ganar:** los enemigos que quedan en pie caen y el grupo lo celebra (`cheer` y saltitos) durante
  unos 3,6 s, con el paisaje parado, y luego sigue andando.
  - Vale para cualquier enemigo y rumbo.
  - Solo hay animación de caída si el enemigo trae `seq.down`. Si no, pasa de golpe a `down`; hoy
    ocurre con el bosque, que tiene la caída panza arriba.
  - Al perder no hay ni caída ni celebración.
- **Guardián:** la pelea sale con su dibujo (`expGuardianArt`, `rival.guardian`). El modo pelea busca
  la línea de pelea de esa hora del diario, no la última, porque detrás puede venir el botín.
- **Grandes:** los de más de 50 px de ancho no se separan los 10 px extra, para que no se corten en
  el móvil.

## En los encargos (la pelea contra un jefe y la tira)

- **Jefes calcados** (`src/art/bossCalco.ts`): `BOSS_CALCO` dice qué jefe sale de qué calco (la
  bestia de Hondogrís, del huargo; el jabalí de ceniza, de su hoja con `cenizaArt()`; el Rey Ahogado, con `reyArt()`, que cae tendido
  con su propia muerte en vez de hundirse como el antiguo: `calcoBoss` no pone `fall`). `calcoBoss` hace el `BossArt` con sus poses y, en `seq`, los
  fotogramas; `world/battle.ts` (`bossFrame`) los pasa: en guardia respira a 5 fps, y la carga, el
  golpe, el daño y la caída avanzan desde que empieza la pose (`SEQ_POSE`, `SEQ_DOWN`). Los golpes
  y lo que hace en la pelea siguen siendo los de su jefe. Para pasar otro: una línea en `BOSS_CALCO`.
- **La tira de los encargos** (`world/tripStrip.ts`): `STRIP_CALCO` dice qué familias salen
  calcadas (hoy, las bestias, como los lobos del bosque), con `foeFrame` como en el visor. El jefe
  que espera al final del camino también respira si es calcado.

