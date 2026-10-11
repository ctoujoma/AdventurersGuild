# AdventurersGuild

Juego de gestión para navegador (y futura app Android): heredas una taberna con deuda, contratas héroes, los mandas a misiones y gestionas lo que traen… o que no vuelvan.

- [Documento de diseño](docs/diseno.md)
- [Plan de desarrollo](docs/plan-desarrollo.md)
- [Dirección de arte, escena y sonido](docs/arte.md)
- [Mockup jugable de la interfaz](docs/mockup/el-jarro-partido.html) (ábrelo en el navegador)

**Estado:** fase 0 terminada: cimientos, taberna viva en pixel art (cámara, luz, partículas, sonido) y retratos de héroes. Siguiente: fase 1, el núcleo de simulación.

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
  art/    paleta, búfer de píxeles, retratos y sprites de héroes
  world/  la taberna: geometría, construcción, luz, paralaje, partículas, cámara y escena
  audio/  sonido sintetizado
  data/   datos de ejemplo
  ui/     interfaz en Preact (paneles y marcos en pixel art)
```
