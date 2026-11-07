# Auditoría del tiempo y propuesta de noche

Del agente principal (7 de noviembre). Para decidir con el usuario antes de tocar el reloj.

## Cómo va el tiempo ahora

| Qué | Dónde | Cómo |
| --- | --- | --- |
| Un día con el juego abierto | `DAY_SECONDS` (300 s) | El reloj va de 0 a 300 s; la parte del día es `clock / 300`. x2 y x4 solo durante «La deuda» y en modo prueba |
| La jornada | `WORK_START` 0,05 – `WORK_END` 0,82 | Fuera de ella nadie trabaja; lo que rinde un día está normalizado a la jornada (cambiarla no cambia el balance) |
| Cerrar la taberna | `DUSK` 0,8 | Desde ahí se puede acabar el día; la caja llega en 8 entregas hasta esa hora |
| La noche | de 0,82 a 1 | **Unos 54 s**: todos a la cama y oscurece. Al llegar a 300 s cae la noche sola (si no hay nada abierto): fundido a negro, unos segundos de noche en la escena y la carta del amanecer |
| Noche con asalto | `App.tsx`, `raidNight` | El reloj está ya a 300 s; la pelea va en tiempo real y luego `RAID_AFTER` (3 s) de noche |
| Juego cerrado | `AWAY_DAY_SECONDS` (3600 s) | Un día por hora real; al volver se simula de golpe (hasta 8 días) |
| Horas de juego | `DRESS_WALK`, `JOB_WALK`, `PAINT_WALK` (2 h), `DRESS_HOURS`… | En horas de 24: una hora son 12,5 s reales |

## Lo que no cuadra

1. **La noche se nota poco.** Son 54 s de penumbra en los que no pasa nada y, al llegar al final, la
   carta tapa la escena. No se ve a la taberna dormida.
2. **`INCIDENT_WALK` va en segundos de reloj (25 s)**, mientras que los demás caminos van en horas.
   Son 2 horas, así que cuadra, pero conviene pasarlo a horas como los demás.
3. **Los plazos se dicen en minutos reales** (`ui/when.ts`). Lo coge el encargo
   [`encargos/interfaz-plazos-ficha.md`](encargos/interfaz-plazos-ficha.md), punto 1.
4. **Con un panel abierto, el día se queda parado a las 300 s** hasta que se cierra. Es a propósito
   (que la noche no caiga a media decisión), pero no se explica: estaría bien un «La noche espera
   a que cierres» en la barra del día.
5. Los incidentes (`INCIDENT_EVERY`) y los rumores (`RUMOR_EVERY`) cuentan segundos de reloj. Si la
   noche se alarga, hay que contarlos solo de día o salen más al día.

## Propuesta

- **Una noche más larga, que se vea.** Mantener la jornada en los ~250 s que dura ahora y alargar la
  noche al doble: `DAY_SECONDS` 300 → 360, `WORK_END` 0,82 → 0,7 y `DUSK` 0,8 → 0,68. La noche
  pasaría de 54 a unos 108 s, con la taberna a oscuras, todos en la cama, el sereno o el gato
  rondando y algún suceso nocturno (más adelante). El balance no cambia: lo que rinde un día va por
  jornada, y los incidentes y rumores se contarían solo de día.
- **«Pasar la noche».** De noche (desde `WORK_END`), un botón en la barra del día hace correr el
  reloj **x8** (`NIGHT_RUSH`) hasta el amanecer: 108 s pasan en unos 13. Si hay asalto, el asalto
  empieza a su ritmo de siempre al acabar la noche. Con el juego cerrado no cambia nada.

**Ya está en el núcleo:** `NIGHT_RUSH` (balance) y `nightLeft(s)` (segundos de noche que quedan, 0 de
día). Lo demás espera a que decidas:

1. ¿Alargamos la noche al doble (360 s el día entero) o la dejamos en los 54 s de ahora y solo
   ponemos el botón?
2. ¿El botón acelera a x8 o salta directamente al amanecer?

## Decidido y hecho (8 de noviembre)

- **Noche al doble:** `DAY_SECONDS` 360, `WORK_END` 0,7, `DUSK` 0,68: unos 250 s de jornada (como
  antes) y unos 108 s de noche. La luz de la escena se estira con la jornada y la noche se hace
  cerrada en su primera parte (`lightTod` en `RoomScene.ts`).
- **«Pasar la noche» a x16** (`NIGHT_RUSH`): de noche, en la barra del día, siempre (también en
  modo libre); se apaga con el día nuevo. Si hay asalto, empieza a su ritmo.
- **Los menús no paran la noche:** con un panel o una ficha abiertos el reloj sigue y la noche cae
  igual (se cierran). Solo el modo obras la hace esperar.
- **El acelerador del día llega a x8** (x1, x2, x4, x8; como antes, en «La deuda» y en modo prueba).
- `INCIDENT_WALK` pasa a 30 s (2 horas con el día nuevo).
