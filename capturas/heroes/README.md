# Hojas de los héroes (para mejorar el arte)

Todo sale del código de verdad (`src/art/heroes/`, `src/art/portraits/`, `src/art/items.ts`,
`src/world/weapons.ts`). Para rehacerlas tras cambiar el arte:

```bash
node tools/textos/esbuild.mjs tools/hoja-heroes.ts hoja capturas/heroes
python3 tools/hoja-heroes.py capturas/heroes
```

| Hoja                          | Qué hay                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `1-heroes`                    | Las 5 clases (guerrero, pícaro, mago, clérigo, explorador) × hombre/mujer, 6 aspectos cada una                    |
| `2-retratos`                  | Los mismos, en retrato de la ficha                                                                                |
| `3-variaciones`               | Peinados, color de pelo, piel, ojos, cara, cejas, boca, tocados y marcas (barba, pecas, cicatriz, parche, herido) |
| `4-sastreria`                 | Tintes (7) sobre cada clase y prendas (capa, tabardo, faja, bufanda)                                              |
| `5-otros-personajes`          | Trabajadores y visitantes (mismo cuerpo) y el tío                                                                 |
| `6-equipo-iconos`             | Iconos de todos los objetos, y cada tipo en cada rareza y con mejoras                                             |
| `7`, `8-equipo-puesto`        | Cada objeto puesto: frente, perfil, espalda y retrato                                                             |
| `9-equipo-completo`           | Arma + cuerpo + complemento por clase, de común a legendario                                                      |
| `10-armas-pelea`              | Armas y herramientas que se pintan en la mano                                                                     |
| `11`–`15-animaciones-<clase>` | Todos los fotogramas: frente, andar (8), escalera, mesa y cama, pelea (5 poses)                                   |

- `gif/`: andar, quieto (respira y parpadea) y una ronda de pelea de cada clase.
- `sueltos/`: cada dibujo a tamaño real (1 px = 1 px) y con transparencia, para editarlo.
- `indice.json`: qué dibujo suelto va en cada hoja, fila y celda.

Medidas: sprite 18×28 (16×26 de dibujo + 1 px de contorno), pies en la fila 26; paleta cerrada en
`src/art/palette.ts`. Los aspectos se componen por capas (`layers.ts`, `layersSide.ts`) y el
equipo se pinta encima (`gear.ts`): un dibujo mejorado tiene que volver a esas capas.
