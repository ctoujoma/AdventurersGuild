# Encargo: arte de cada sala (PR 11, segunda parte)

Para un agente que retoma el arte sin el historial de la conversación. Lee antes
[`README.md`](README.md) (forma de trabajar, ramas, comprobaciones) y
[`../arte.md`](../arte.md) (paleta y reglas del pixel art).

## Qué hay que hacer

Llevar **cada sala** al nivel del **salón de muestra**, que el usuario ya ha visto y aprobado
como dirección. El estilo acordado es «entre el actual y la dirección A» (aventura gráfica VGA):
pixel art cálido, materiales con 3–4 tonos, contornos oscuros, mucho detalle de atrezo que cuente
qué se hace en la sala y que cambie con el nivel.

Una sala (o dos parecidas) por PR, contra **`main`** (al fusionar, GitHub Pages lo publica y lo
prueban los amigos del usuario). En cada PR: capturas antes/después de la sala a nivel 0 (por
reparar), 1, 2 y 3, de ancho 1 y de ancho máximo, de día y de noche. Si puedes, publica también
la versión de pruebas (ver «Comprobar»). Espera el visto bueno del usuario y su aviso de que ha
fusionado antes de seguir con la siguiente (se fija mucho en alineaciones y en que nada tape
nada). No vigiles los PR ni programes recordatorios: el usuario avisa.

Orden propuesto (de más a menos visible): recibidor, cocina, dormitorio, bodega, cámara del
tesoro, enfermería, capilla, armería, forja, sala de mapas, despensa, sala de armas, sala de
tiro, biblioteca, dormitorio del servicio, veteranos y torre del vigía.

## Progreso

| Sala | Estado |
| --- | --- |
| Recibidor | Hecho, espera visto bueno (`recibidor.ts`; capturas en [`capturas/`](capturas/)) |

Notas del recibidor (sirven para las demás):

- Solo mide un hueco: «ancho 1» y «ancho máximo» son la misma captura.
- Los sitios de los muebles y de los de guardia están en `SPOT` (`recibidor.ts`); los de guardia
  (`people.ts`) se ponen delante del armero, que va en la pared, para no tapar ningún mueble.
- La puerta de la calle cambia con el nivel (por dentro en `sideTex`, por fuera en
  `Prop.doorLeaf`).
- Las piezas finas (astas de lanza) se pintan sin contorno: `Prop.piece` las engorda.
- `node tools/shots/sala.mjs <carpeta> <tipo> [anchos]` saca todas las capturas de una sala.

## Cómo está hecho el salón (el modelo a copiar)

Todo el arte se pinta en código sobre `PixelBuffer` (`src/art/pixel.ts`) con la paleta `P`
(`src/art/palette.ts`). Cada sala tiene tres capas:

1. **Pared del fondo** (`backWall` en `src/world/rooms/textures.ts`): yeso, madera o piedra
   según la planta (`themeOf`), postes, zócalo, ventanas (`windowAt`) y lo que va colgado. Se
   pinta a escala `BACK` (4/5 de la de delante): las medidas del mundo se multiplican por `BACK`.
   El salón tiene su propia función `salonWall` en `src/world/rooms/salon.ts`; las demás salas
   usan `decorate()` en `textures.ts`, que es lo que hay que sustituir por funciones propias
   (por ejemplo `kitchenWall` en un `kitchen.ts`, igual que `salon.ts`).
2. **Muebles** (`furnish()` en `src/world/rooms/furniture.ts`): piezas (`Thing`) con su x
   (centro, en el interior de la sala), su profundidad `z` (`WALL`, `MID`, `FRONT`) y su altura;
   `hang` para lo que cuelga del techo. Se ven a la escala de su profundidad (`scaleAt(z)` en
   `view3d.ts`): una pieza de `n` píxeles mide `n / scaleAt(z)` en el mundo. Las piezas
   pequeñas están en `src/world/props.ts`.
3. **Luces**: cada `Thing` puede llevar `light` (`Glow`: alcance, color, fuerza, parpadeo y
   llamas). Faroles, velas, fuego del hogar o de la forja.

Lo que aprendimos con el salón (para no repetir errores):

- **Nada de la pared del fondo detrás de un mueble alto.** El salón calcula dónde cae la
  chimenea vista en el fondo (`hearthSpan`) y corre el tablón y los trofeos; quita la columna de
  ventanas que quedaría detrás. Haz lo mismo con cualquier mueble alto pegado a la pared.
- **Ventanas alineadas en columna en todas las plantas** (en salas de dos alturas) y en la misma
  posición en cada hueco (`windowX`, al 70 % del hueco, con lo colgado a su izquierda).
- **Salas de dos alturas** (hoy solo el salón): la planta de arriba es aire, sin suelo ni
  puertas; el atrezo de arriba (pendones, trofeos, tiro de la chimenea, lámpara colgando de una
  cadena) llena el hueco. Ver `room.h` en `salonWall` y en `furnish`.
- **Lo que enseña la partida** va en `SalonLook` (decoración, escudo, trofeos, perro, equipo
  sin dueño y en qué sala se guarda, ver `gearRoom`). Si una sala necesita datos del estado,
  añádelos ahí y al `SceneModel` (`src/ui/view.ts`).
- **Nivel 0** (por reparar): `ruined()`, telarañas, tablones clavados, muebles rotos. **En
  obras**: andamio y material. Ambas cosas ya existen; solo hay que respetarlas.
- La gente anda por delante de los muebles en `LANES` (profundidades 16, 21 y 26): deja libre el
  suelo de delante y no pongas muebles altos en `FRONT` que tapen a las figuras.

## Comprobar

- `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- `src/world/rooms/furniture.test.ts` comprueba que los muebles caben dentro de la sala y que
  hay farol; añade tests propios si una sala coloca cosas según su ancho o nivel.
- Capturas con Playwright (ver `tools/shots/README.md`). Con `#debug` en la URL,
  `window.__game.get()/set(estado)` deja preparar cualquier sala: cambiar `level`, `w`, `h`,
  `works`; y `window.__scene.camera` (`zoom`, `centerOn(x, y)`) encuadrarla. Las capturas de
  esta conversación usaban `deviceScaleFactor: 1`, ventana de 1280×760 y `zoom` 2–3.
- Versión de pruebas: `python3 tools/build-artifact.py dist <salida>.html` tras el build (un
  solo HTML), publicada como artefacto de claude.ai con título «Jarro: pruebas» si tienes la
  herramienta; vuelve a publicarla en la misma dirección en cada PR.
- No cambies `SAVE_VERSION` (hay gente jugando): el arte no toca el formato de la partida.

## Fuera del encargo

No tocar reglas del juego (`src/core`), balance ni la interfaz. Si algo del arte pide un cambio
de reglas (por ejemplo, que una sala tenga otro tamaño), apúntalo y pregúntale al usuario.
