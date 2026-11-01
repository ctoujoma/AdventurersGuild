# Encargo (arte): incidentes que se ven y responden, y los tres jefes nuevos

Para el agente de arte. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md), [`../plan.md`](../plan.md)
(fase 1, punto 5; fase 5), [`../salas/README.md`](../salas/README.md) y
[`../salas/encargo-arte.md`](../salas/encargo-arte.md).

## 1. Incidentes en la escena, con «juice» (prioridad alta)

> **Estado:** hecho lo que se ve en la sala (`world/rooms/incidents.ts`, dibujos en
> `art/incidents.ts`, capturas con `tools/shots/incidentes.mjs`). Las ratas responden a cada
> toque: una huye con polvo y chillido, y si quedan toques entra otra; al acabar, las que quedan
> se van corriendo. Al acabar, el ladrón, el recaudador y el noble se van por la pared más
> cercana; lo demás se deshace en polvo (el fuego, en vapor). Falta: el temblor de cámara, que
> la gente se aparte del fuego y un final distinto si sale mal (la escena no sabe cómo acabó:
> haría falta que el núcleo lo dijera). Lo dibujado no se toca; si se quiere tocar las ratas en
> la sala en vez del aviso, lo decide el agente principal.

Los incidentes (`data/incidents.ts`, `core/incidents.ts`) hoy son solo un aviso de texto sobre la
sala (`ui/IncidentMark.tsx`). El usuario: «el tutorial habla de ratas en la cocina, pero no se
ven… el botón para espantarlas no da ningún feedback ni juice». Es lo primero que ve un jugador
nuevo (el tutorial prepara unas ratas el día 2), así que cuenta mucho.

- **Que se vea en la sala** lo que pasa, mientras dura (`game.incidents`):
  - ratas: tres o cuatro que corretean por el suelo y suben a los sacos;
  - fuego: llamas y humo en el fogón, la gente se aparta;
  - pelea: dos parroquianos a puñetazos, una silla volcada;
  - ladrón: una figura encapuchada junto a los cofres;
  - gotera: gotas que caen del techo a un charco;
  - recaudador: un hombre con libro y sombrero esperando en el recibidor;
  - noble borracho: uno bien vestido tambaleándose en el salón.
  Mira cómo pinta `crowd.ts` a la gente y las mascotas (`pets.ts`) para moverlos.
- **Al tocar (ratas)**, cada toque tiene respuesta: una rata sale corriendo y desaparece,
  polvo, un pequeño temblor de cámara, un chillido (`audio.play('squeak')` ya existe), y el
  contador «×N» del aviso salta. Al acabar, un remate (las que quedan huyen, una chispa de
  premio).
- **Al resolver los demás** (arrastrar a alguien, pagar, elegir): una pequeña animación de
  cierre (el héroe aparta a los de la pelea, el recaudador se va saludando, el fuego se apaga
  con vapor). **Al salir mal**, otra (humo negro, las ratas con un pan, una silla rota).
- El aviso flotante puede quedar más pequeño (icono, cuenta atrás y barra) si la escena ya
  cuenta lo que pasa; habla con el agente principal si cambias `IncidentMark.tsx`.
- **Comprobar:** capturas o vídeo de cada incidente en curso, al resolverse y al salir mal, a
  ancho de móvil. En `#debug` se puede poner uno con `__game.set` (ver
  `node_modules/.cache/jarro-shots/incidente.mjs` si existe, o pide el truco).

## 2. Los tres jefes nuevos (fase 5)

El jabalí de ceniza, la Reina de la Cripta y la dragona de la Corona Blanca son ahora otros
jefes teñidos (`base`, `ramp` en `data/bosses.ts`; `recolor` en `art/bosses.ts`). Dibújalos
propios, como los de `art/bosses.ts` (poses, boca, alcance), y quita su `base` y `ramp`. Se
ven desde Ajustes › Modo prueba (jefes).

## Forma de trabajar

Un PR por punto, contra `main`, con capturas. No cambies reglas del juego. El agente principal
está rehaciendo el tutorial (`core/tutorial.ts`, `App.tsx`): si tocas `App.tsx`, dilo en el PR.
