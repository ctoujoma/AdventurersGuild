# La economía del oro: auditoría y estado

Auditoría del 27 de noviembre: de dónde sale el oro, cuánto, frente a qué gastos, qué pasa con el
juego cerrado y qué exploits hay. Resultados, gráficos y propuestas en la página
**«El oro del Jarro»** (https://claude.ai/artifact/1r5CqmyQUkeSXsXZghJgPx). Se mide con
`npm run auditoria -- <salida.json> [partidas] [días libres] [viajes]` (`tools/auditoria-oro.ts`).

## Lo que se vio (resumen)

- El 85 % del oro sale de los encargos; el salón da un 4,6 % y las expediciones un 0,1 %.
- La caja del salón cubre 1,6 veces la nómina el día 7 y 0,06 al final; tiene techo (24
  visitantes, ~170/día) y los visitantes solo cenan lo que sobra de la casa.
- Los sueldos de veterano se disparaban (64 a nivel 7, 354 a nivel 12).
- En el modo libre el oro se amontona (15–19 mil) y se pierde por la cámara llena (~14.500 por
  partida); la fama pasa de 3.000.
- Con el juego cerrado se pagan los sueldos y nadie sale de encargo: 8 días fuera cuestan 4–9 mil
  en el modo libre avanzado (no se quiebra: el tiempo espera antes del pago).

## Hecho (27 de noviembre)

- **Expediciones que pagan:** `EXP_GOLD` de 4–12 a 35–95 y `EXP_GOLD_FAR` de 0,35 a 0,7. Antes
  ~2 monedas por héroe y día de viaje; ahora ~10 a lejanía 2, ~15 a 4 y 20–24 a 6–8. Los jefes y
  guardianes ya daban botín con oro (`loot` ×2 y ×3, al azar entre 35 y 95 por la lejanía), que
  sube igual. Para que no fuera calderilla, la ofrenda del santuario pasa a 30 + 10·lejanía y la
  ración del mercader a 12.
- **Nómina de veteranos más suave:** `levelRaise` 3 por nivel desde el 8 (antes 4) y cachés de 20
  y 40 (antes 30 y 60). Un héroe contratado a nivel 1 cobra 108 a nivel 8, 274 a nivel 12 y 400
  a nivel 15 (antes 126, 354 y 522). Solo cambia lo que se sube a partir de ahora: los sueldos
  ya guardados en las partidas se quedan como están.
- **La caravana asaltada, con otro sentido** (`stepThreat` en `core/events.ts`): ya no se lleva
  la caja del día (que se cobra en casa; además dejaba el oro en negativo). Con la amenaza alta
  (≥ 40) asaltan una caravana de la comarca y sale un encargo de Recuperar lo robado
  (`caravanQuest`): paga ×1,5 (`CARAVAN_PAY`), da 3 de fama de más si sale bien (`CARAVAN_REP`),
  dura 4 días y no cuenta para el tablón. Uno a la vez. En el tablón lleva la etiqueta «Robado».
- **Los caminos dan miedo** (amenaza ≥ 60): 2 o 3 días (`FEAR_DAYS`) viene a la taberna el 60 %
  de la gente (`FEAR_VISITS`, `GameState.roadFear`); lo dice la carta del amanecer.
- **Cámara del tesoro más amplia:** `VAULT_STORE` de 300 / 1.500 / 4.000 / 10.000 / 20.000 por
  hueco a 400 / 2.500 / 7.000 / 18.000 / 40.000.
- **Más visitantes y propinas:** `VISIT_BASE` 3 → 4, `VISIT_PER_APPEAL` 0,7 → 0,9, `SEAT_TURNS`
  1,5 → 2, `SERVE_BASE` 2 → 3 y `SERVE_PER_WORK` 0,8 → 1. Los bien atendidos (con cena y jarra)
  dejan a veces propina según quién sea (`VISITORS[k].tip`): campesino 25 % de 1–2, mercader 40 %
  de 1–4 y noble 60 % de 4–16; un salón mejor anima (×0,8 a nivel 1, ×1,2 a nivel 5) y atender a
  todos, ×1,2 más. La carta del amanecer dice cuánto fue de propinas. Un salón de banquetes de 3×2
  con 4 camareros da ~290 al día (antes ~170); uno de nivel 2 con un camarero, ~48 (antes ~39).

**Medido con todo junto** (30 partidas de 148 días, `npm run auditoria`; antes → después):

| | Antes | Después |
| --- | --- | --- |
| Ganan la deuda | 20 de 30 | 22 de 30 |
| Caja del salón al día (día 60, mismo salón) | 44 | 74 |
| Parte del oro que da el salón | 4,6 % | 7,3 % |
| Parte que dan las expediciones (viajes cortos del simulador) | 0,1 % | 0,8 % |
| Nómina semanal el día 148 | 5.191 | 3.993 |
| Sueldos de toda la partida | 44.701 | 37.980 |
| Oro perdido por la cámara llena | 14.563 | 16.034 |
| Oro en caja el día 148 | 15.626 | 37.295 |
| 8 días con el juego cerrado (desde el día 90) | −8.671 | −6.298 |

El jugador simulado no amplía el salón, así que en una partida de verdad el salón dará más. Al
final sobra aún más oro que antes: los **sumideros del modo libre** son ahora lo más urgente.

## Pendiente (apuntado, sin hacer)

- **Vender lo fabricado da dinero sin fin** (talleres a nivel 3–4 con buen artesano: +7 a +19 por
  pieza de serie). El usuario lo deja para más adelante: no le parece preocupante.
- **Peaje de los bandidos** (idea de futuro del usuario): con la amenaza alta, unos bandidos
  piden dinero en la puerta; pagar o arriesgarse a un asalto.
- **El salón:** avisar de que los visitantes no cenan si la cocina no da para toda la casa (con el
  juego cerrado, la caja cae a ~19 al día por eso); quizá huéspedes más adelante.
- **Sumideros para el modo libre:** mantenimiento de salas, obras de prestigio, compras de élite;
  tope o caída de la fama.
- **Ausencias sin sangría:** encargos largos que se dejan asignados, media paga fuera, o comida
  aparte para los visitantes.
- **Topes coherentes:** el ladrón de la cámara (incidente de día) se lleva el 8 % sin tope; los
  encargos, la mochila, las historias y las hazañas suman sin el tope de la cámara hasta la noche
  (usar `earn()`).
- **La deuda castiga contratar:** en el simulador gana más quien no contrata (77 % frente a 68 %).
