# Encargo: quién duerme en cada dormitorio (solo interfaz)

El núcleo ya sabe quién duerme dónde y deja cambiarlo; falta enseñarlo y poder moverlos.

**Lo que hay** (`src/core/beds.ts`):

- `sleepPlan(s)`: id de cada uno → id de la sala en la que duerme. Héroes en los dormitorios
  (los veteranos, en el ala de veteranos si cabe) y trabajadores con cama en los cuartos del
  servicio. Los de guardia no se acuestan; los trabajadores del pueblo duermen fuera (`housed(s)`
  dice quién tiene cama en casa).
- `dormIssue(s, who, room)`: por qué no puede dormir ahí (o null).
- Acción `{ type: 'dorm', who, room }`: lo cambia (se guarda en `Hero.dorm` / `Worker.dorm`, y
  manda mientras quepa). La escena ya lo sigue: de noche va andando a su cama nueva.
- `vetsWithoutWing(s)`: los veteranos que duermen fuera del ala (se quejan y pierden moral).

**Lo que falta**

- En el panel de cada dormitorio, ala de veteranos y cuarto del servicio: la lista de quien
  duerme ahí (`sleepPlan`) y las camas libres (`roomBeds` / `staffBedsOf`).
- Poder mover a alguien a otro dormitorio de su tipo (selector o arrastrar), con el porqué de
  `dormIssue` cuando no se puede.
- Marcar a los veteranos sin cama en el ala (aviso de que no les gusta).
