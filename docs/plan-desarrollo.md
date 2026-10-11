# Plan de desarrollo

**Objetivo:** un prototipo jugable en el navegador (móvil y escritorio) que después se convierta en app Android **sin reescribirlo**.

Diseño del juego: [`diseno.md`](diseno.md).

## 1. Tecnología

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Lenguaje | **TypeScript** | Tipos para un modelo de datos grande; refactors seguros |
| Build | **Vite** | Rápido, estándar, buen soporte de PWA |
| Interfaz | **Preact** + CSS propio | El juego es casi todo interfaz (listas, cartas, botones). El DOM gana a canvas en texto, accesibilidad y escalado. Preact es ligero y usa la API de React |
| Núcleo del juego | **TS puro, sin DOM** | Testeable, reutilizable y ejecutable en Node para el simulador de balance |
| Aleatoriedad | Generador con semilla (sfc32/mulberry32) | Partidas reproducibles, bugs reproducibles, tests deterministas |
| Tests | **Vitest** | Integrado con Vite |
| Guardado | `localStorage` tras una interfaz `SaveStorage` | En Android se cambia por Capacitor Preferences/Filesystem sin tocar el juego |
| Web instalable | **vite-plugin-pwa** | Instalable y offline: paso intermedio gratis hacia Android |
| Android | **Capacitor** | Empaqueta la misma web en una app nativa (WebView), con plugins de vibración, botón atrás, barra de estado y almacenamiento |
| CI/CD | GitHub Actions + **GitHub Pages** | Lint, tipos, tests y build en cada push; un enlace para probar en el móvil |

**Alternativas descartadas:**
- **TWA:** depende de hosting y ofrece menos control.
- **Reescribir en Godot o Unity:** se perdería el trabajo hecho en web.
- **React Native:** exige otra capa de interfaz.
- **Motor de canvas (Phaser):** sobra para un juego de menús. Si más adelante queremos una escena animada de la taberna, irá en un `<canvas>` dentro de la vista.

## 2. Arquitectura

```
src/
  core/          # Lógica del juego. TS puro, sin DOM ni efectos.
    rng.ts         generador con semilla
    model.ts       tipos: GameState, Hero, Quest, Item…
    generate/      generación de héroes, encargos, nombres, textos
    resolve.ts     resolución de misiones
    economy.ts     salarios, deuda, ventas
    day.ts         avance de día (orquesta todo lo anterior)
    actions.ts     reducer: (state, action) => state
  data/          # Contenido como datos: clases, rasgos, plantillas, nombres
  ui/            # Componentes y pantallas Preact
  platform/      # Guardado, vibración… (implementación web y Capacitor)
  main.tsx
tools/
  sim.ts         # Simulador sin interfaz para balance
```

**Principios:**
- **El estado es un objeto JSON serializable.** Guardar es `JSON.stringify` y el formato lleva número de versión para migrar partidas.
- **Todas las acciones del jugador pasan por un reducer puro.** Eso facilita los tests, el guardado y las repeticiones; un posible «deshacer» saldría casi gratis.
- **El contenido vive en `data/`.** Añadir un rasgo, una clase o una plantilla de encargo no requiere tocar la lógica.
- **La UI no calcula reglas.** Solo lee el estado y despacha acciones. Por ejemplo, la estimación de riesgo la calcula `core`.

## 3. Fases

Los tamaños son relativos (S < M < L). Cada fase termina en algo que se puede probar.

### Fase 0: Cimientos · S ✅
- [x] Proyecto Vite + TypeScript + Preact
- [x] ESLint + Prettier, `tsconfig` estricto
- [x] Vitest con tests de ejemplo (RNG, capas de héroes, distribución de la taberna)
- [x] GitHub Actions: lint, formato, typecheck, test y build (`.github/workflows/ci.yml`)
- [x] Despliegue automático en GitHub Pages al hacer push a `main` (`.github/workflows/deploy.yml`)
- [x] Esqueleto de interfaz: 4 pestañas, diseño vertical
- [x] Adelantado: pixel art generado por código (ver [`arte.md`](arte.md))
  - [x] Retratos 40×48 dibujados a mano por piezas, sprites de frente y de perfil con animación
  - [x] Taberna de tres plantas, desván y bodega con cámara, paralaje, luz tramada, partículas y vida
  - [x] Objetos interactivos enlazados con la interfaz (tablón → encargos, camas → mejoras…)
  - [x] Sonido sintetizado: ambiente, laúd y efectos

**Terminado cuando** un enlace público abre la app en el móvil. Falta activar GitHub Pages en el repositorio (Settings → Pages → Source: GitHub Actions) y fusionar en `main`.

### Fase 1: Núcleo de simulación · M ✅
- [x] RNG con semilla y utilidades (elegir, tirada ponderada); su estado se guarda con la partida
- [x] Modelo de datos: héroe, encargo, misión, informe, estado de partida (`core/model.ts`), serializable y versionado
- [x] Datos: 5 clases, 10 rasgos, 6 tipos de encargo con plantillas, nombres, frases de informe (`data/`)
- [x] Generadores de candidatos y encargos (escalados por rango y nivel de taberna)
- [x] Cálculo de habilidades del grupo y estimación de riesgo (`core/party.ts`); un mago descubre giros ocultos
- [x] Resolución de misiones: desafíos, 5 resultados y consecuencias (oro, XP y niveles, heridas, secuelas y apodos, muertes, desaparecidos, botín, rasgos que se descubren)
- [x] Avance de día: regresos, curación, desaparecidos que vuelven o no, caducidades, rotación de candidatos, ingresos de la taberna, salarios y pagos semanales, victoria y derrota
- [x] Acciones con un reducer puro: contratar, despedir, enviar grupo, mejorar, vender, leer informe, terminar día
- [x] Tests unitarios de cada pieza
- [x] `npm run sim`: juega N partidas con cinco estrategias y saca estadísticas

**Balance inicial** (300 partidas por estrategia): sin mandar a nadie se pierde siempre; con una estrategia normal (enviar si la estimación pasa del 55 %) se gana el 66 %; con una cauta (75 %), el 30 %; la temeraria (30 %) gana el 82 % pero pierde un héroe cada dos partidas. Las constantes están en `core/balance.ts`.

### Fase 2: Primer prototipo jugable · M
- [ ] Taberna: resumen del día, candidatos y botón de contratar
- [ ] Tablón: lista de encargos con detalle
- [x] Envío: elegir héroes, ver estimación, enviar (los héroes salen por la puerta en la escena) · adelantado
- [ ] Héroes: plantilla y ficha (atributos, rasgos, estado)
- [ ] Informes de misión al amanecer (texto simple)
- [ ] Botón «Terminar día» y barra superior con oro, día y deuda
- [ ] Guardado automático y opción de nueva partida

**🎯 Hito:** se juegan los 30 días de «La deuda» en el móvil desde un enlace. Primera ronda de pruebas.

### Fase 3: Lo que traen (y lo que no) · L
- [ ] Rasgos ocultos que se revelan tras la primera misión
- [ ] Moral, deserción y peticiones de aumento
- [ ] Heridas graves con secuelas y apodos
- [ ] Muerte permanente y Muro de los caídos
- [ ] Desaparecidos que regresan, se confirman muertos o generan un encargo de rescate
- [ ] Botín e inventario: vender y equipar (objetos simples con bonificaciones)
- [ ] Eventos en ruta
- [ ] Informes narrativos con plantillas ricas y variación
- [ ] Giros ocultos en encargos y su detección
- [ ] Instalaciones: Dormitorios, Enfermería y Taberna (3 niveles)
- [ ] Reputación y rangos

**Terminado cuando** el juego produce anécdotas y las decisiones tienen consecuencias que duran.

### Fase 4: Pulido y pruebas · M
- [ ] Balance con el simulador y con pruebas de jugadores reales
- [ ] Tutorial integrado en los primeros días (el tío deja notas)
- [ ] Animaciones y transiciones; las cartas de informe se deslizan
- [ ] Sonido sintetizado con WebAudio
- [ ] PWA: instalable, offline, icono y pantalla de carga
- [ ] Exportar e importar la partida (copia de seguridad en texto)
- [ ] Accesibilidad básica: contraste, tamaños de toque, modo oscuro

**🎯 Hito:** prototipo pulido para enseñar.

### Fase 5: Android · M
- [ ] Integrar Capacitor y crear el proyecto Android
- [ ] Guardado con Capacitor Preferences/Filesystem
- [ ] Botón atrás de Android, márgenes seguros (notch), barra de estado y vibración
- [ ] Icono adaptativo y pantalla de inicio
- [ ] Build de APK/AAB en CI y firma
- [ ] Publicación en Google Play (pruebas internas → cerradas)

**🎯 Hito:** la app instalada desde Google Play en pruebas internas.

### Más adelante
Arte en pixel art compartido con la Tienda de pociones, campaña por actos, más clases y rasgos, relaciones entre héroes, modo infinito, idiomas y cruce con la Tienda de pociones.

## 4. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Balance económico frágil | Simulador sin interfaz desde la Fase 1; constantes en un único fichero |
| Textos repetitivos | Plantillas con variantes y combinaciones; contenido en `data/` para crecer fácil |
| Que el proyecto crezca sin control | Fases cerradas; el diseño marca qué queda fuera |
| Pérdida de partidas (caché borrada, cambio de versión) | Versionado y migraciones del guardado; exportar e importar |
| Rendimiento en WebView de gama baja | Interfaz DOM ligera, sin librerías pesadas; probar pronto en un Android modesto |
| El juego no engancha | Llegar cuanto antes al hito de la Fase 2 y probarlo con gente |

## 5. Decisiones abiertas

1. **Nombre del juego.** «El Gremio de Aventureros» es provisional.
2. **Tiempo por días o en tiempo real.** El plan asume días, pero un modo idle podría añadirse más tarde.
3. **Idiomas.** Español primero; ¿preparar la traducción desde el principio o más tarde?
4. **Estilo de arte definitivo**, compartido con la Tienda de pociones.
