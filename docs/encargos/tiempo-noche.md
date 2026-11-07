# Encargo: auditoría del día y del tiempo, noche más larga con «pasar la noche»

Del usuario (7 de noviembre). Para el agente que lo coja, rama propia, PR contra `main`.
Primero la auditoría y una propuesta en `docs/`; el código, cuando el usuario la apruebe.

## Auditoría

Recorrer cómo pasa el tiempo y apuntar en `docs/propuesta-tiempo.md` lo que no cuadre:

- El reloj del día: `DAY_SECONDS` (300 s), `DUSK`, la jornada (`core/balance.ts` ~140–180), el
  tick en `core/game.ts`, las velocidades x2/x4 y `RoomScene.pace`.
- El tiempo que corre solo (`core/away.ts`, `AWAY_*`) y lo que pasa al volver.
- La noche: cuándo empieza, cuánto dura, el fundido a negro, `endDay`, el amanecer, y la noche
  con asalto (`RAID_AFTER`, `raidNight` en `App.tsx`).
- Lo que cuenta horas (talleres, vestir `DRESS_HOURS`, `JOB_WALK`, `INCIDENT_WALK`): si está
  en horas de juego o en segundos, y si es coherente.
- Cómo se dicen los plazos (`ui/when.ts`). Lo coge el encargo `interfaz-plazos-ficha.md`, punto 1:
  solo avisar si choca.

## Propuesta a valorar

- **Una noche más larga**, que se vea (la gente en la cama, la taberna a oscuras, algún suceso
  nocturno), en lugar de que el día acabe en el fundido.
- **Un botón «Pasar la noche»** que acelere x8 hasta el amanecer (sin saltarse lo que pase: el
  asalto sigue a su ritmo y para el acelerado).
- Qué cambia en el balance (la jornada, lo que rinde un día, `npm run sim`) y qué no debe
  cambiar (el día con el juego cerrado).

Si toca el núcleo (`game.ts`, `balance.ts`) o `App.tsx`, decirlo en el PR.

## Hecho (agente principal, 7 de noviembre)

La auditoría y la propuesta están en [`../propuesta-tiempo.md`](../propuesta-tiempo.md), pendientes de
que el usuario decida. Ya en el núcleo: `NIGHT_RUSH` (x8) y `nightLeft(s)`. Lo que falta, cuando se
decida: el reloj de la noche en el núcleo (si se alarga) y, en la interfaz, el botón «Pasar la noche»
en la barra del día (de noche, el reloj de `App.tsx` corre a `NIGHT_RUSH`).
