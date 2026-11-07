# Encargo: el hueco que se queda inservible tras mover una sala, y más oro en los encargos

Del usuario (7 de noviembre). Dos cosas sueltas: pueden ir en un PR cada una.

## 1. Bug: tras mover la enfermería, su hueco no deja construir

Un tester movió la enfermería de sitio y luego no pudo construir nada donde estaba al principio.

- Reproducirlo en un test (`core/rooms.ts`: `planMove`, `planBuild`, `problem`, `freeSpot`,
  `roomAt`, `mergeRooms`), y también en el navegador con el modo obras: mover, confirmar la obra,
  intentar construir en el hueco viejo. Probar en el borrador y tras confirmar.
- Candidatos a mirar: algo que siga apuntando al sitio viejo (la escalera o el rellano que había
  dentro, los muebles o los sitios de la escena, `b.dug` si estaba bajo tierra, el borrador
  `draft.moved`), o que la escena marque mal los huecos válidos tras mover.
- Comprobar si pasa con cualquier sala o solo con la enfermería (¿tiene algo fijo o especial?).
- Arreglarlo con su test.

## 2. Los encargos pagan poco al final

Los testers dicen que, ya avanzados, apenas llegan a pagar sueldos y no pueden mejorar salas.

- Medir con `npm run sim` (y lo que haga falta añadirle): ingresos por día (encargos, salón)
  frente a gastos (sueldos, comida, mantenimiento) y lo que cuesta mejorar las salas, por rango.
  Mirar dónde se calcula la paga (`core/generate.ts`, `core/resolve.ts`, `REWARD_PER_POINT`
  y vecinos en `core/balance.ts`).
- Subir la paga del oro sobre todo en los rangos altos, para que a partir de plata se ahorre
  para una mejora cada pocos días. Dejar escrito el antes y el después (una tabla en el PR y en
  `docs/plan.md`).
- No tocar los asaltos: su fuerza depende del oro (`notoriety`, `gold/40`), así que comprobar
  que no se disparan, y si lo hacen, decirlo.
