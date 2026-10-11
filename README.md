# AdventurersGuild

Juego de gestión para navegador (y futura app Android): heredas una taberna con deuda, contratas héroes, los mandas a misiones y gestionas lo que traen… o que no vuelvan.

- [Documento de diseño](docs/diseno.md)
- [Plan de desarrollo](docs/plan-desarrollo.md)
- [Dirección de arte, escena y sonido](docs/arte.md)
- [Mockup jugable de la interfaz](docs/mockup/el-jarro-partido.html) (ábrelo en el navegador)

**Estado:** fases 0, 1 y 2 terminadas: se juega «La deuda» completa (30 días) en el navegador, con la taberna viva en pixel art, simulación con semilla y guardado automático. Siguiente: primera ronda de pruebas y fase 3 (rasgos, moral, secuelas, botín y eventos).

## Desarrollo

Requiere Node 22.

```sh
npm install
npm run dev        # servidor local con recarga
npm test           # tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # build de producción en dist/
npm run sim        # simulador de balance: juega cientos de partidas sin interfaz
```

## Estructura

```
src/
  core/   lógica del juego, sin DOM: modelo, generadores, resolución, día, reducer y balance
  art/    paleta, búfer de píxeles, retratos y sprites de héroes
  world/  la taberna: geometría, construcción, luz, paralaje, partículas, cámara y escena
  audio/  sonido sintetizado
  data/   contenido: nombres, plantillas de encargos, frases de informe, rasgos y textos
  platform/ guardado (localStorage; Capacitor en Android)
  ui/     interfaz en Preact (paneles y marcos en pixel art)
tools/
  sim.ts  simulador de balance
```
