# Niveles nuevos de las salas (solo vista)

Hay arte para niveles a los que el juego todavía no llega. Se ven en la galería «Salas del
Jarro» (y en las pruebas: `ART_MAX` en `src/world/rooms/salas/index.ts`), pero **no se usan**:
`roomMax` (`ROOM_COST` en `src/core/balance.ts`) sigue igual. Para activar uno hace falta su
precio y su efecto; las cifras de abajo son una **propuesta** para valorar, no algo decidido.

Al activarlo, en general: añadir el precio a `ROOM_COST`/`UPGRADE_COST`, la cifra del efecto a
su tabla, revisar los textos de la interfaz que describen cada nivel y los tests del núcleo. No
hace falta tocar `SAVE_VERSION` (el nivel ya es un número en la partida).

## Nivel 3 en las salas que hoy acaban en el 2

| Sala | Qué se ve en el 3 | Qué haría falta (propuesta) |
| --- | --- | --- |
| Capilla | Más velas en el altar, otra fila en el candelabro de los caídos, damasco morado. | Precio ~600. `chapelRest` (2 × nivel) da 6 de moral por noche. Ojo: `returnChance` (0,5 + 0,2 × nivel) pasaría del 100 %: mejor una tabla (0,5 / 0,7 / 0,85 / 0,95). |
| Sala de mapas | Mapa con rosa de los vientos, catalejo, damasco verde. | Precio ~620. `BOARD_SIZE` suma el nivel: un contrato más en el tablón. |
| Armería | Tres filas de estante para el equipo, paredes de arenisca. | Precio ~650. Una entrada más en `ARMORY` (p. ej. Combate +2, Trampas +1, Supervivencia +1). |
| Forja | Una pieza al rojo en la fragua, paredes de arenisca. | Precio ~640. La forja suma su nivel a la primera habilidad del equipo: +3. |
| Cuartos de veteranos | Armadura bajo la ventana, damasco granate. | Precio ~700. `VET_REST` y `VET_CAP` con un valor más (p. ej. 12 y 20). `beds` da 2 camas por nivel y hueco (6); el arte enseña 4 por hueco: habría que ajustarlo. |
| Torre del vigía | Almenara encendida, pendón y bandera. | Precio ~600. Falta decidir el efecto (hoy: el 1 avisa de los asaltos y el 2 suma un contrato). Por ejemplo, avisar antes o sumar defensa. |

## Nivel 4

Lo común a todas en el 4: acabados de lujo (encalado con azulejo, pilastras doradas y friso
pintado, mármol o bóveda de ladrillo; suelo en espiga, ajedrezado, rombos de mármol o
ladrillo) y una araña de latón con seis velas que alumbra más.

| Sala | Qué se ve en el 4 | Qué haría falta (propuesta) |
| --- | --- | --- |
| Cámara del tesoro | Mármol con cornisa dorada, puerta de latón de cámara acorazada, corona en la repisa, vitrina con el cetro. | Precio ~900. `VAULT_STORE` y `LOCK_TIME` con un valor más (p. ej. 20000 y 20 s). |
| Dormitorio | Literas con dosel, mantas moradas con oro, candelabro, alfombras con flecos. | Precio ~750. `beds` da nivel + 1 camas por hueco: 5. El arte enseña 4 por hueco (dos literas): habría que poner una de tres pisos o dejar 4 camas y dar otro efecto (más moral al dormir). |
| Cocina | Encalada con azulejo, cordero en el asador, batería de cobre, loza con filo de oro. | Precio ~750. El almacén crece solo con el nivel (`KITCHEN_STORE` × nivel × huecos). |
| Bodega | Bóveda de ladrillo, cubas con el medallón de la casa, mesa de cata. | Precio ~750. El almacén crece solo con el nivel (`CELLAR_STORE` × nivel × huecos). |
| Sala de armas | Armadura de gala, espadas de acero, círculo de combate dorado. | Precio ~850. `TRAIN_CAP` con un valor más (p. ej. 11); `trainRate` ya sube con el nivel. |
| Galería de tiro | Dianas de concurso, tablón de honor con medallas, raya dorada. | Igual que la sala de armas. |
| Biblioteca | Estanterías con copete dorado, esfera armilar, alfombras con cenefa. | Igual que la sala de armas. |

El salón ya tiene nivel 4 en el juego. El resto (recibidor, despensa, servicio, enfermería) no
tiene nivel 4 pintado: hoy no tienen nada que crezca de forma natural con él.
