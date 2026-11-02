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
- [ ] Visto bueno del usuario (capturas de frente y de lado en el PR #94).

## Siguiente (en este orden, salvo que el usuario diga otra cosa)

1. **Más cilindros y cuerpos de verdad**: los barriles apilados, las mesas (tablero y patas), el
   horno de pan (cúpula) y la caldera (cúpula de cobre) con la misma idea que `round`.
2. **Atlas de la gente en dos filas**: va en una sola fila y ya mide 3960 de 4096 px (un test lo
   vigila). Hace falta antes de añadir gestos nuevos (martillear, afilar, arrodillarse…).
3. **Rutinas y sitios para las salas sin nada que hacer**: armería (afilar en la muela), mapas
   (el mapa, los alfileres y el catalejo), despensa (la cocinera viene a por cosas), tesoro
   (contar monedas), capilla (arrodillarse y encender velas), recibidor (la ronda del guardia).
4. **La forja que trabaja**: el encargo [`encargos/arte-forja.md`](encargos/arte-forja.md)
   (herrero, martillar con chispas, fuelle, templar, bocadillo del trabajo). **Depende** del
   código de la forja del agente principal (rama `claude/sharp-mendel-apsm2a`): empezar cuando
   esté en `main`.
5. **La capilla**: la luz de las vidrieras cayendo en color sobre el suelo, incienso y velas.
6. **Grosor en el resto de salas**: cocina (horno, mesas, aparador), despensa (estanterías y
   cajas a varias profundidades), capilla, mapas, armería, enfermería y dormitorios.
7. **«Juice» de la escena**: temblor de cámara suave (golpe de jefe, asalto, obra grande), pausa
   en el golpe y destello, estirar y aplastar, partículas que faltan (chispas, vapor, polvo,
   hojas al viento) y el sonido de cada sala al acercar la cámara.
8. **«Juice» de la interfaz**: botones con peso y ceremonia en las recompensas grandes (subir de
   rango, acabar una historia, pagar la deuda).

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
- **Forma de trabajar:** pide capturas siempre; avisa si algo queda pendiente o si hay que
  coordinarse con otro agente.
