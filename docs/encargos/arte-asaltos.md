# Encargo de arte: la pelea de los asaltos (y el ladrón), en directo

El agente principal ha hecho la pelea de verdad (ver [`../propuesta-asaltos.md`](../propuesta-asaltos.md)):
cada uno con su vida y cada golpe con su daño. Lo que se ve es un primer apaño que funciona;
este encargo es para que se vea bien. Ir punto por punto, con capturas, y poner al día
`docs/plan-arte.md`.

## Qué hay (datos que usar)

- `core/assault.ts`, clase `Assault`: el asalto paso a paso. Los pasos (`RaidStep`, en
  `core/model.ts`) ahora traen `hit` (quién, a quién, cuánto y si es crítico), `heal`, `skill`
  (la habilidad de la clase) y `chance` (ocasión de crítico). `RaidPlan.hp`: la vida de cada uno
  al empezar.
- `world/rooms/raid.ts` (`RaidShow`): barras de vida sobre la cabeza, números de daño (cifras de
  `art/digits.ts`), el rombo de crítico y un golpe (`crowd.strike`) por cada `hit`. En directo
  (`live`), acepta órdenes: `send` (arrastrar a una sala), `aim` (tocar a un bandido), `tap`
  (crítico o habilidad).
- `ui/RaidCrew.tsx`: la tira de abajo con los retratos (nombre, vida, habilidad).
- El ladrón: `Incident.duel` (`core/model.ts`), golpe a golpe con su segundo del reloj;
  `RoomScene.drawDuels` lo pinta (barras y números) y `IncidentArt.thiefAt` da dónde está.

## Puntos

1. **Golpes por clase en la taberna:** el guerrero tajo, el pícaro estocada rápida, el mago y el
   explorador a distancia (proyectil hasta el blanco), el clérigo maza y la cura con luz. Hoy
   todos hacen el mismo `strike`. Lo mismo para las habilidades (`skill`): Provocar, Puñalada,
   Bola de fuego, Curar y Andanada, que ya tienen su dibujo en la pelea de jefes
   (`world/battle.ts`).
2. **Caer:** quien cae, cae al recibir el golpe (ya es así), con un gesto y sin desaparecer;
   los bandidos que caen sueltan el saco con monedas.
3. **La marca de destino** del arrastre (la misma de día, `headingMarks`) también en el asalto.
4. **Que se vea en lo oscuro:** en la bodega y el sótano, de noche, casi no se ve nada; un poco
   de luz de antorcha alrededor de cada pelea.
5. **El ladrón:** que pelee de verdad con el héroe (un forcejeo, golpes de vuelta), que la
   cámara vaya a la cámara del tesoro al empezar y, si gana el ladrón (`duel.won` falso), que
   huya sin que le persigan. Hoy solo se ven las barras y los números.
6. **La tira de retratos** (`RaidCrew`): con el retrato pequeño (`Portrait`) y que quepa bien en
   el móvil con seis héroes (con la de interfaz si hace falta).

Rama propia, PR contra `main`. Si se toca `crowd.ts`, `RoomScene.ts` o `App.tsx`, decirlo en el PR.
