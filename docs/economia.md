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
- **Medido después** (30 partidas, `npm run auditoria`): la nómina del día 148 baja de 5.191 a
  4.571 a la semana y los sueldos de toda la partida un 16 %; las expediciones del simulador (que
  manda viajes cortos) traen ×9,5. Ojo: el oro que se pierde por la cámara llena pasa de ~14.500
  a ~28.800 por partida, así que los **sumideros del modo libre** son ahora lo más urgente.

## Por decidir con el usuario

- **La caravana asaltada** (`stepThreat` en `core/events.ts`): hoy se lleva la caja del día,
  aunque se cobra en casa, y si ya se había recogido y gastado deja el oro en negativo. Al
  usuario no le cuadra lo que se cuenta. Ideas para darle otro sentido (pendiente de elegir):
  1. **Asaltan la carreta de la despensa:** se pierden raciones y jarras (o no llega la entrega
     de mañana), no oro. Se nota en el salón de forma natural: sin cena, los visitantes solo beben.
  2. **Los caminos dan miedo:** unos días vienen menos mercaderes y nobles al salón.
  3. **Encargo de rescate del cargamento:** sale un encargo urgente (Recuperar o Escoltar) que
     devuelve lo perdido y paga; si nadie va, baja la fama y algún cliente se asusta. Encaja con
     A4 (algo que empuje a mandar héroes).
  4. **Peaje de los bandidos:** piden dinero en la puerta; pagar o arriesgarse a un asalto.

  Propuesta: 1 + 3. Mientras tanto, el fallo del oro negativo sigue ahí.

## Pendiente (apuntado, sin hacer)

- **Vender lo fabricado da dinero sin fin** (talleres a nivel 3–4 con buen artesano: +7 a +19 por
  pieza de serie). El usuario lo deja para más adelante: no le parece preocupante.
- **Un salón que crezca con el gremio:** más gasto por visitante con el rango, más plazas por
  nivel o huéspedes; avisar de que los visitantes no cenan si la cocina no da.
- **Sumideros para el modo libre:** mantenimiento de salas, obras de prestigio, compras de élite;
  tope o caída de la fama.
- **Ausencias sin sangría:** encargos largos que se dejan asignados, media paga fuera, o comida
  aparte para los visitantes.
- **Topes coherentes:** el ladrón de la cámara (incidente de día) se lleva el 8 % sin tope; los
  encargos, la mochila, las historias y las hazañas suman sin el tope de la cámara hasta la noche
  (usar `earn()`).
- **La deuda castiga contratar:** en el simulador gana más quien no contrata (77 % frente a 68 %).
