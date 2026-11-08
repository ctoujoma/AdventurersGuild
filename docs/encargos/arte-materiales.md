# Encargo de arte: materiales, ranuras y el almacén

Del usuario (8 de noviembre). El núcleo ya está (ver
[`interfaz-equipo-materiales.md`](interfaz-equipo-materiales.md)). Rama propia, PR contra `main`;
pon al día `docs/plan-arte.md`.

1. **Los seis materiales**, en pixel art, para la interfaz (16 × 16 y 32 × 32): hierro (un lingote),
   cuero (un rollo atado), tela (un fardo), hierbas (un manojo), madera buena (unos listones) y
   cristal (una piedra que brilla). Que se distingan por la forma, no solo por el color.
2. **Las siluetas de las tres ranuras** (arma, cuerpo, complemento), apagadas, para el muñeco de
   la ficha.
3. **El almacén** (sala `almacen`; ahora no tiene dibujo en `world/rooms/salas/index.ts`):
   estanterías, cajas, sacos y lingotes que **se apilan según lo que hay** (`s.mats` y `matCap`:
   vacío, a medias, lleno). Que se vea llenarse.
4. **El rincón de la bodega**: sin almacén, unas pocas cajas y sacos en un rincón de la bodega,
   que crecen hasta el tope (10 de cada).
5. **El «+N»** de los objetos mejorados: un brillo o unas marquitas en su icono.

## Hecho (agente de arte, 8 de noviembre)

Todo, con capturas en `capturas/materiales/`; detalle en [`../plan-arte.md`](../plan-arte.md).
Para la interfaz: `materialIcon(m, 16 | 32)` y `slotIcon(slot, 16 | 32)` en `art/materials.ts`
(con `BufferImage`), e `itemIcon(icon, rarity, plus)` ya pinta el «+N». La escena recibe
`SceneModel.mats` (lo lleno de cada material y si hay almacén) desde `ui/view.ts`.
