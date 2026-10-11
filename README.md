# AdventurersGuild

Juego de gestión para navegador (y futura app Android): heredas una taberna con deuda, contratas héroes, los mandas a misiones y gestionas lo que traen… o que no vuelvan.

- [Documento de diseño](docs/diseno.md)
- [Plan de desarrollo](docs/plan-desarrollo.md)
- [Dirección de arte y pixel art](docs/arte.md)
- [Mockup jugable de la interfaz](docs/mockup/el-jarro-partido.html) (ábrelo en el navegador)

**Estado:** fase 0 terminada (cimientos, pixel art de héroes y taberna). Siguiente: fase 1, el núcleo de simulación.

## Desarrollo

Requiere Node 22.

```sh
npm install
npm run dev        # servidor local con recarga
npm test           # tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # build de producción en dist/
```

## Estructura

```
src/
  core/   lógica del juego, sin DOM (de momento, el RNG con semilla)
  art/    pixel art: paleta, sprites, héroes por capas y escena de la taberna
  data/   datos de ejemplo
  ui/     interfaz en Preact
```
