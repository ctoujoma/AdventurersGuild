# Encargo (interfaz): descartar avisos y un mapa más grande

Para el agente de interfaz. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md) y
[`../plan.md`](../plan.md).

## 1. Descartar avisos (`ui/AlertBell.tsx`, `ui/alerts.ts`)

El usuario: «poder descartar avisos». Hoy la campana junta los avisos de ahora (`gatherAlerts`) y
no se pueden quitar. Que se pueda descartar uno (deslizar o una «×») y que no vuelva mientras
dure lo mismo (cada aviso tiene un `id` fijo mientras dura: guardar los descartados en la
interfaz o en la partida, a tu criterio; si vuelve a pasar con otro `id`, vuelve a avisar). Un
«descartar todos» si hay varios. Los importantes de verdad (el pago de Merlo que no llega, un
grupo ante su jefe) pueden no dejarse descartar o volver al día siguiente: propónlo.

## 2. Mapa más grande (`ui/panels/MapPanel.tsx`)

El usuario: «mejorar la calidad del minimapa y pensar si ampliarlo». Lo tuyo: el tamaño y cómo
se usa — que ocupe más (en móvil, la pantalla entera con la lista de grupos plegable), zoom a
escala entera, y que los grupos fuera abran su ficha «Encargo en curso». El dibujo lo mejora el
agente de arte (`arte-tira-vuelta-mapa.md`): acordad la escala.

Capturas a 420 × 860 y en horizontal, y un PR contra `main`.

## Hecho (interfaz)

**Avisos.**
- Cada aviso se descarta deslizándolo a un lado o con su «×». Con varios, sale «Descartar todos».
- Los descartados se guardan aparte, por partida: `jarro:avisos`, con la semilla de la partida. Se olvidan en cuanto el aviso deja de estar, así que si vuelve a pasar, vuelve a avisar.
- «Ver los N descartados» los devuelve todos.
- Lo que hace cada tipo al descartarlo está en `hushRule` (`ui/alerts.ts`):
  - **normales:** no vuelven mientras dure lo mismo;
  - **el pago que no llega** (`bad`): vuelve al día siguiente, y el propio aviso lo dice;
  - **el grupo ante su jefe:** no se descarta (no tiene «×» y dice «Se queda hasta que lo veas»).

**Mapa.**
- Ocupa toda la escena (`Panel full`).
- En vertical, la lista de grupos va debajo, plegada en una línea con el grupo que vuelve antes.
- En horizontal, la lista va al lado; plegada, queda en una franja estrecha.
- La leyenda y la amenaza flotan encima del mapa.
- Tocar un grupo en el mapa abre directamente su «Encargo en curso».

**La escala, para el agente de arte.**
- El zoom va a escala entera: 1 píxel del dibujo son ×1…×8 píxeles de pantalla, redondeados a píxeles del aparato. Así no se emborrona.
- Al abrir sale un nivel más del que cabe entero (en el móvil, ×2), centrado en la taberna.
- La interfaz toma el tamaño de `mapBuffer()`, no `MAP_W`/`MAP_H`. Si el dibujo pasa a 800 × 560 (2 píxeles por unidad de lugar) para tener más detalle, la interfaz no cambia.
- Las coordenadas de los lugares siguen en unidades de `MAP_W`/`MAP_H`.
- Ojo: con el dibujo a 800 × 560, «×1» ya enseñaría 800 px. Entonces convendría bajar el nivel de partida, y lo ajusto yo.

Capturas: [mapa en vertical, antes y después](capturas/mapa-vertical.png), [en horizontal](capturas/mapa-horizontal.png), [avisos](capturas/avisos-descartar.png).
