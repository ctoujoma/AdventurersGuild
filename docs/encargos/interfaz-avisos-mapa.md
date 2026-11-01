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
