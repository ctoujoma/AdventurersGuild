# Encargo (interfaz): la primera vez que se abre el juego

Para el agente de interfaz. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md) y
[`../plan.md`](../plan.md) (fase 2a).

El usuario: «la pantalla del inicio de abrir la primera vez merece una pasada crítica… queremos
evitar que parezca *AI slop*. Es la base del arranque de nuestros jugadores, cuando decidirán si
quieren el juego o lo desinstalan».

## Qué hay hoy (capturas: arranca el juego sin partida guardada)

1. Pantalla del desarrollador (`ui/Splash.tsx`, `assets/splash.webp`): es la del usuario, no la
   cambies sin preguntarle.
2. Título (`ui/Title.tsx`, `.title-*` en `styles.css`): rótulo con un cofre, «El gremio de
   Aventureros», una placa roja con el nombre, tres botones grandes iguales y «Toca un botón
   para entrar en la taberna». Detrás, la taberna oscurecida **con la barra de arriba y las
   pestañas de abajo asomando**.
3. Al empezar, la carta del día 1 (`ui/Dawn.tsx`) con cinco líneas de instrucciones (hablan de
   «Cerrar», que ya no existe). El agente principal la sustituye por una carta del tío (ver
   abajo): no la toques.

## Qué hacer

- **Título con identidad:** la taberna de verdad de fondo (de noche, con su luz), sin la barra
  ni las pestañas; un logotipo con oficio (pixel art, no texto con sombra genérico); un solo
  botón principal («Empezar» o «Continuar · día N») y lo demás discreto (partidas, ajustes,
  versión). Fuera la frase «Toca un botón…».
- **Movimiento con intención:** que el rótulo, la luz o el humo de la chimenea den vida, sin
  efectos de plantilla (destellos y temblores de más).
- **Sonido y ritmo:** que el paso del título a la partida sea una transición (la cámara entra
  en la taberna), no un corte.
- Propón antes de hacer: dos o tres bocetos (capturas) al usuario.

## Límites

- `App.tsx`: el agente principal trabaja ahí en el tutorial. Toca lo justo y dilo en el PR.
- La carta del principio y las lecciones del tutorial son del agente principal.
