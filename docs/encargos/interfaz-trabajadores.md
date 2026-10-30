# Encargo (interfaz): trabajadores y tareas, que se entienda quién hace qué

Para el agente de interfaz. Antes, lee [`../../CLAUDE.md`](../../CLAUDE.md),
[`../plan.md`](../plan.md) (fase 1, punto 1) y [`../salas/README.md`](../salas/README.md)
(forma de trabajar, comprobaciones, capturas).

## El problema

El usuario dice que los trabajadores, y cómo se ven en la interfaz junto con las tareas que
hay que hacer y cómo se organizan, «puede ser confuso». Antes de sumar sistemas nuevos (fase
1: objetivos, incidentes, rumores) hay que dejar esto claro.

## Qué hay hoy

- **Núcleo:**
  - `src/core/workers.ts`: puestos de cada sala (`slotsOf`, `crewOf`, `canAssign`), camas del
    servicio, lo que rinde cada sala con su gente.
  - `src/data/workers.ts`: oficios (`TRADES`).
- **Quién puede estar en una sala:**
  - **trabajadores** (cocina, bodega, despensa…), cada uno con su oficio y su Maña;
  - **héroes** que trabajan (`HERO_WORK`), entrenan (salas de armas, tiro y biblioteca), hacen
    guardia (recibidor, como mucho 2) o descansan;
  - **enfermería:** cura y tiene su puesto (`NURSE_WORK`).
- **Dónde se ve y se cambia:**
  - Ficha de sala (`src/ui/panels/RoomPanel.tsx`, `RoomCrew`): quién está y sus puestos.
  - Héroes › Trabajadores (`src/ui/panels/HeroesPanel.tsx`, filtro `trabajadores`): la lista
    del personal.
  - Elegir sala para alguien (`src/ui/JobPicker.tsx`).
  - Arrastrar a una persona en la escena hasta una sala (`src/ui/drop.ts`, con tests).
  - La gente que viene a pedir trabajo (`seekers`) y contratar.
- **Lo que cada sala produce** (comida, cerveza, caja) se ve en su ficha y flota sobre ella al
  amanecer.

## Qué hacer

1. **Auditoría primero.** Juega una partida (modo prueba en Ajustes para ir rápido) y haz
   capturas de cada sitio donde aparecen trabajadores y tareas. Apunta en este documento (abajo,
   en «Hallazgos») qué confunde:
   - un mismo dato en dos sitios que no coinciden;
   - no saber qué hace cada uno ni qué falta por cubrir;
   - acciones escondidas;
   - textos largos.

   Enséñaselo al usuario como página o capturas antes de cambiar nada grande.
2. **Propuesta.** Una forma clara de ver «quién hace qué» de un vistazo, por ejemplo:
   - una lista de la gente de la casa con su tarea (trabaja en…, entrena…, de guardia,
     descansa, fuera) y un botón para cambiarla;
   - en cada sala, los puestos como huecos (ocupados o vacíos) y qué da cada persona;
   - avisos de lo que pide atención (una sala sin nadie, alguien sin tarea, gente esperando
     trabajo).
3. **Hazlo** en PR pequeños contra `main`, con capturas a ancho de móvil y de PC.

## Límites

- Sin cambiar reglas del juego (`src/core`) salvo lo justo para enseñar algo que ya existe. Si
  hace falta otra regla, pregunta.
- Sin tocar el arte de las salas (`src/world/rooms/salas/`): es del agente de arte.
- No cambies `SAVE_VERSION`.
- Si tocas `RoomPanel.tsx` o `App.tsx`, dilo en el PR: el agente principal también trabaja
  ahí (rangos, tiempo, incidentes).

## Hallazgos

(Para rellenar en la auditoría.)
