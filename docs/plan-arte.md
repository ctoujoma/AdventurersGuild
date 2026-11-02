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
   [`encargos/arte-anexo-jardin.md`](encargos/arte-anexo-jardin.md). Si el usuario no dice
   otra cosa, va detrás de lo de arriba.

## Lo que ha dicho el usuario (para no repetir errores)

- **Montañas:** sí a la bruma que las aclara (dan lejanía); la silueta, de sierra de verdad
  (cumbres agudas, collados, cresta mellada), como en su foto de referencia; las cañadas en
  diagonal y que confluyan, nunca rectas en vertical.
- **Fondo:** «se verá durante muchas horas: que sea entretenido y lindo»; el fondo no puede
  moverse al hacer zoom.
- **Salas:** demasiado plano y demasiado pintado en la pared; quiere cosas que resalten, con
  cuerpo (el oro del tesoro, los hornos de la bodega).
- **Animaciones:** que no repitan un gesto todo el día (la cocina parecía que fregaba).
- **Mapa:** le gustaron las dos versiones; se usan las dos según la sala de mapas.
- **Bandidos de la tira:** los mismos de los asaltos, a escala de héroe (no gigantes).
- **3D:** lo suelto, separado de la pared (si no, «se nota al desplazar la cámara»); en los
  costados, textura pintada según el material, nunca los píxeles del frente estirados; lo
  cilíndrico (cubas, barriles), cilindros de verdad.
- **Forma de trabajar:** pide capturas siempre; avisa si algo queda pendiente o si hay que
  coordinarse con otro agente.
