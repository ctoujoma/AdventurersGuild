# Encargo (arte): el clima

Para el agente de arte. Antes, lee:

- [`../../CLAUDE.md`](../../CLAUDE.md);
- [`../plan-luz.md`](../plan-luz.md) (el estilo nuevo, detrás de «Luz con ambiente», ya puesto
  por defecto);
- y el plan [`../plan-clima.md`](../plan-clima.md): este encargo es llevarlo a cabo, fase a
  fase.

## Qué es (lo pidió el usuario)

Un sistema de clima que lo cambie con todo su efecto visual: nublado, niebla, lluvia, nieve,
viento y tormenta. **De momento, solo se ve; no afecta a la partida.**

## Reglas

- **Nada del núcleo:** ni `core/` ni `SAVE_VERSION`.
  - El tiempo de cada momento se calcula en la escena: `weatherAt(semilla, día, hora)`, con la
    semilla de la partida. Es determinista, no se guarda y sale igual al volver a abrir.
  - Las transiciones duran un rato; nunca hay un cambio de golpe.
  - Si más adelante se quiere que afecte al juego, va aparte, con el agente principal.
- **Todo detrás de «Luz con ambiente».** Con «Pocas luces», sin lo caro (charcos con reflejo y
  salpicaduras).
- **Ajuste nuevo:** «Clima: normal / siempre despejado».
- **En `#debug`:** una forma de forzar cada tiempo (para las capturas).
- **Píxel de verdad:** téxeles grandes como el resto, por escalones de la paleta; sin líneas
  finas de un píxel de pantalla ni degradados.

## Dónde está lo que vas a tocar

- **El cielo y el fondo:**
  - `src/world/rooms/sky.ts`: `Daylight`, las nubes y las capas lejanas;
  - `paisaje.ts`: montes, bosques y el lago con su reflejo;
  - `arboles.ts`.
- **La luz:** el bucle de focos de `RoomScene.ts`:
  - `sunLampK`: el sol que entra por las ventanas y sus rayos;
  - `nightK`: las luces de fuera;
  - `uDaylight` y `uSunDir`.

  Con nublado, se apagan los rayos y el foco de sol de las ventanas.
- **Shaders:** `src/world/rooms/gl.ts` (`look.surface`, los halos y el rayo de sol). La lluvia
  y la nieve, mejor en una capa de pantalla nueva, barata y con paralaje por capas.
- **El relieve de la luz con ambiente:** sirve para que la nieve se pose en lo que mira hacia
  arriba y para que lo mojado se oscurezca.
- **El sonido:** la capa de ambiente (`src/audio/audio.ts`): lluvia, viento y trueno.
- **El patio y la hierba:** `plantGrass` y `yard` en `RoomScene.ts`, y `art/grass.ts`.

## Fases (un PR por fase, con capturas antes y después y GIF de lo que se mueve)

1. **El estado y el cielo:** `Weather` determinista, más el nublado y la niebla (cielo, luz y
   bruma). Incluye el ajuste y el selector de `#debug`.
2. **Lluvia:**
   - las gotas en diagonal por capas y las salpicaduras en el patio y los tejados;
   - la fachada mojada y el goteo de los aleros;
   - las gotas en los cristales vistos desde dentro (las ventanas del fondo y las de los
     lados);
   - el sonido;
   - después, los charcos con reflejo.
3. **Nieve:** los copos, la nieve que se posa (tejados, alféizares y patio) y crece, el
   deshielo al despejar y el humo de las chimeneas más espeso.
4. **Viento:** árboles, hierba, humo y rótulo; inclina la lluvia y la nieve.
5. **Tormenta:** relámpagos (un destello breve) y el trueno con retraso.

## Cuidado con

- **El móvil:** mide los fotogramas con lluvia a pantalla completa antes de dar por buena la
  fase 2.
- **Dentro de las salas no llueve.** La niebla, solo fuera. La gente y lo que se puede tocar se
  tiene que seguir viendo.
- **Que no canse:** casi siempre despejado o algo nublado; pocos días de lluvia fuerte y nunca
  varios seguidos.
- **`RoomScene.ts` lo comparten varios agentes:** cambia lo justo y dilo en el PR.

## Capturas

- Hazte un guion en `tools/shots/clima.mjs` que fuerce cada tiempo y saque el patio, una sala
  con ventana y la vista desde fuera (zoom al mínimo y `scene.zoomBy(-1)`), de día y de
  noche.
- Pon las capturas en `capturas/clima/`.

Antes de subir: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
