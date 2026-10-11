# Dirección de arte y pixel art

## Idea

Pixel art nocturno y cálido: la taberna iluminada por la chimenea en mitad de la noche. Una **paleta única** (`src/art/palette.ts`) para todo el juego, que también usará la Tienda de pociones.

Para el prototipo, **el arte está hecho con código**. Cada sprite es una cuadrícula de caracteres:

```ts
// Un barril: cada carácter es un color de la paleta, '.' es transparente.
barril: [
  '..wWWWWw..',
  '.wWWvvWWw.',
  'SSSSSSSSSS',
  ...
]
```

Así el arte vive en git, se revisa en los diffs, se recolorea por capas y los tests comprueban que ninguna fila esté mal. Si más adelante un artista hace PNG con Aseprite, se cargan como `Pixels` y el resto del código no cambia.

## Héroes (`src/art/heroes/`)

Un héroe mide 16×22 píxeles (18×28 con margen para sombreros y contorno) y se monta por capas:

1. **Cuerpo**: cara, ojos y manos, con el tono de piel del héroe (4 tonos).
2. **Traje de clase**: armadura de guerrero, ropa oscura de pícaro, túnica de mago, hábito de clérigo, ropa de explorador o delantal de tabernero.
3. **Barba** (algunos hombres).
4. **Pelo**: corto, largo, coleta, de punta, moño o calvo, en 6 colores.
5. **Sombrero o casco** según la clase: casco, capucha, sombrero de mago o gorra con pluma.
6. **Marcas**: parche (secuela «Tuerto») y venda (herido).
7. **Arma**: espada, dagas, bastón, maza, arco.

Al final se añade el **contorno** automáticamente. El aspecto sale de la **semilla** del héroe (su id): el mismo héroe se ve siempre igual y cada partida trae caras nuevas.

## La taberna (`src/art/tavern/`)

Se ve en **corte lateral**, como una casa de muñecas, a 180×210 píxeles y escalada a 2× en el móvil:

| Planta | Qué hay | Qué cambia con las mejoras |
| --- | --- | --- |
| Tejado | Tejas, chimenea con humo, ventana del desván | — |
| Arriba izquierda | **Dormitorios** | En ruinas: paja en el suelo y ventana tapiada. Nivel 1–3: 2, 3 o 4 literas; mantas de lana, luego rojas y al final colchas azules con farol |
| Arriba derecha | **Enfermería** | Cerrada: a oscuras y con tablones. Nivel 1: una camilla y una vela. Nivel 2: dos camillas y hierbas colgadas. Nivel 3: botica con pociones |
| Planta baja | **Sala común**: barra, tablón, mesas, escalera, chimenea | En ruinas: chimenea apagada y telarañas. Nivel 1: una mesa. Nivel 2: dos mesas, barriles, faroles y jarras. Nivel 3: manteles, trofeo de caza, estandarte y fuego grande |
| Bodega | Barriles y **un cofre por objeto del arcón** | Crece con el botín |

El **tablón** muestra un papel clavado por cada encargo disponible.

**Los héroes viven dentro:**
- Los disponibles **pasean** por la sala.
- Los candidatos **esperan en la barra**.
- Los heridos **guardan cama** con su venda: en camilla si hay enfermería y, si no, en las literas.
- Los que están de misión no están en casa.
- Al tocar a alguien aparece su nombre.

**Animación:** el fuego, las velas, el humo y las estrellas se mueven; los héroes caminan y respiran. La escena se para cuando la pestaña no está visible, para ahorrar batería.

## Siguiente paso posible

- Retratos grandes (32×32) para las fichas, con la misma lógica de capas.
- Ciclo día y noche, y clima.
- Más variedad: cicatrices, armaduras que mejoran con el equipo y mascotas.
