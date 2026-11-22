# Encargo de arte: expediciones

Del agente de expediciones (22 de noviembre). Lo decidido con el usuario, en
[`../decisiones.md`](../decisiones.md), bloque 8, y su página con maquetas
(https://claude.ai/artifact/A4zHkyzm3eBMRn67PT6y6y). El núcleo y la interfaz los hace el agente de
expediciones ([`expediciones.md`](expediciones.md)); hasta que llegue cada pieza usa marcadores.
Rama propia, PR contra `main`; pon al día `docs/plan-arte.md`. Vistas previas antes de meter cada
cosa. Lo más importante: **el visor tiene que apetecer abrirlo** (más detalle y protagonismo que la
tira de los encargos, `ui/QuestStrip.tsx`, que sirve de punto de partida).

1. **El visor por rumbo** (bosque primero; sierra, marismas y ruinas después): fondo con varias
   capas que se mueven a distinta velocidad, que se va volviendo salvaje **poco a poco** con los
   días de lejanía (sin cortes: un valor de 0 a 1), con la luz de la hora del juego, nubes,
   animales (ciervos, cuervos, lobos a lo lejos) y el amanecer.
2. **Los héroes en el visor:** andar, cojear heridos, recoger (hierbas, madera), abrir un cofre,
   beber de la cantimplora, señalar, acampar y dormir; las **peleas en directo** dentro del visor
   con los enemigos por familias (`art/foes.ts`, `foeSprites.ts`), golpes y cifras.
3. **El campamento de noche:** hoguera que chisporrotea, petates, uno de guardia, ojos en la
   oscuridad.
4. **El tiempo por rumbo:** nieve y viento (sierra), niebla y lluvia (marismas), lluvia y niebla al
   alba (bosque), polvo y tormenta seca (ruinas). Cerca de casa, el de la taberna (`world`).
5. **Lo que encuentran:** cofre, cueva, mina, torre, ruinas, santuario, mercader, viajero,
   campamento abandonado y fardo perdido, pequeños para el diario y el mapa y en el visor. Brillo
   por rareza (común nada; bueno destello; raro brillo azul; legendario rayo dorado).
6. **El mapa grande:** unas tres veces el de hoy (`art/map.ts`, `mapColor.ts`; hoy 400 × 280), con
   la comarca en el centro y alrededor sierra (norte), bosque (este), marismas (suroeste), ruinas
   (sureste) y el mar al oeste; **niebla** que se mueve y se despeja por donde pasan; la estela de
   pasos del grupo; marcas de parajes y fardos.
7. **Ilustraciones de las cartas de suceso** (cabecera de la carta, como en la maqueta): la cueva
   con brillo, la puerta con runas, el oso, el santuario, el mercader…
8. **La salida y la vuelta en la escena:** se juntan en la puerta con petates y salen por el patio;
   vuelven con fardos que crecen con lo que traen (vacío, a medias, lleno).
9. **La carta del veterano:** sello de mapa enrollado; y los iconos de los cuatro rumbos para la hoja
   de preparar (con su cartel «En obras» para los que falten).
