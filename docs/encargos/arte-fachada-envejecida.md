# Encargo (arte): la fachada, menos repetida

Para el agente de arte. Antes, lee:

- [`../../CLAUDE.md`](../../CLAUDE.md);
- [`../plan-luz.md`](../plan-luz.md) (el estilo nuevo, detrás de «Luz con ambiente», ya puesto
  por defecto);
- y, sobre todo, la auditoría [`../auditoria-fachada.md`](../auditoria-fachada.md): este
  encargo es llevarla a cabo.

## El problema (lo dijo el usuario)

Al alejar del todo, la taberna se ve desde fuera con la fachada entera, y la textura de las
paredes de fuera se ve muy repetida. Pide un punto más de calidad y más variedad dentro de la
propia textura.

## Dónde está

- **Las caras de los materiales:** `src/world/rooms/muros.ts` (`wallFace`: tablas, entramado,
  sillería) y `materiales.ts` (troncos, ladrillo, tapial, lajas y encalado). El material lo
  elige el jugador (`WallId`, en `src/data/custom.ts`).
- **Dónde se usan:**
  - la tapa de la vista desde fuera: `outsideFace` en `textures.ts` (rellena las salas con
    `wallFill` y pinta ventanas y puerta);
  - los hastiales: la fachada del corte, en `fachada.ts`;
  - los costados: `outerSide` en `textures.ts`, que ya llevan ventana.
- **El relieve:** cada pincelada pone su altura en `b.level`, y la luz con ambiente la usa.
  Respétalo en lo nuevo.

## Qué hacer (en este orden; un PR por paso o por dos, con capturas antes y después)

1. **Capa de envejecimiento a lo grande**, común a todos los materiales y aplicada después de
   pintar el material. Fija por pared (con semilla, sin `Math.random`). Por escalones de la
   paleta, sin degradados ni trama:
   - paños más oscuros, más claros o más cálidos;
   - la humedad del pie, que sube mellada;
   - churretes bajo los alféizares y el alero;
   - lo alto, más pálido por el sol.
2. **Tablas sin ritmo:** anchos de 4 a 9, tapajuntas a saltos irregulares, algún remiendo de
   tablas en horizontal o en diagonal y alguna tabla nueva más clara.
3. **Clavos:** más oscuros, menos y no en filas perfectas (hoy de lejos parecen una
   perforación).
4. **Zócalo de piedra** en la planta baja (2 o 3 hiladas, con musgo abajo).
5. **Ventanas de la tapa variadas:** dos o tres modelos (de cuarterones, de arco, con
   contraventanas), con dintel y alguna jardinera; las del salón, más grandes.
6. **Vigas:** testas que sobresalen cada tanto, con su sombra.
7. **Detalles sueltos, pocos y fijos por partida:** hiedra, leña bajo un alero, un tonel de
   lluvia y una escalera apoyada.
8. **El resto de materiales:** la capa del punto 1 y lo que pida cada uno.

## Cuidado con

- **Que no se vuelva ruido:** de lejos tiene que leerse «pared de tablas vieja», no un
  granulado. Compara siempre con el zoom al mínimo y con el de jugar.
- **Las ventanas:** la tapa tiene una capa de cristal encendido de noche (`glass` en
  `outsideFace`). Si cambias las ventanas, cambia también su cristal.
- **Archivos que no son tuyos:** no toques `core/` ni `SAVE_VERSION`. En `RoomScene.ts`, lo
  mínimo, y dilo en el PR.

## Capturas

- `node tools/shots/fachada.mjs <carpeta>`: la fachada con cada material.
- La vista desde fuera (de día, al atardecer y de noche) se saca con un guion como el de
  `tools/shots/_fuera.mjs` del agente de luz: con el zoom al mínimo, `scene.zoomBy(-1)`.
  Ese archivo es local (los `_*.mjs` no van en git), así que hazte el tuyo en `tools/shots/`.
- Pon las capturas en `capturas/fachada-envejecida/`.

Antes de subir: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
