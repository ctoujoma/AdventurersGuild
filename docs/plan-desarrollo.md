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

### Fase 0: Cimientos · S
- [ ] Proyecto Vite + TypeScript + Preact
- [ ] ESLint + Prettier, `tsconfig` estricto
- [ ] Vitest con un test de ejemplo
- [ ] GitHub Actions: lint, typecheck, test y build
- [ ] Despliegue automático en GitHub Pages
- [ ] Esqueleto de interfaz: 4 pestañas vacías, diseño vertical

**Terminado cuando** un enlace público abre la app vacía en el móvil.

### Fase 1: Núcleo de simulación · M
- [ ] RNG con semilla y utilidades (elegir, barajar, tirada ponderada)
- [ ] Modelo de datos: héroe, encargo, estado de partida
- [ ] Datos: 5 clases, unos 10 rasgos, unos 6 tipos de encargo, listas de nombres
- [ ] Generadores de candidatos y encargos (escalados por rango)
- [ ] Cálculo de habilidades del grupo y estimación de riesgo
- [ ] Resolución de misiones: desafíos, 5 resultados y consecuencias básicas (oro, XP, heridas)
- [ ] Avance de día: regresos, caducidades, rotación de candidatos, salarios semanales
- [ ] Acciones: contratar, despedir, enviar grupo, terminar día
- [ ] Tests unitarios de cada pieza
- [ ] `npm run sim`: juega N partidas con una estrategia simple y saca estadísticas (oro, muertes, % de victorias)

**Terminado cuando** el simulador juega 30 días completos sin interfaz y los tests pasan.

### Fase 2: Primer prototipo jugable · M
- [ ] Taberna: resumen del día, candidatos y botón de contratar
- [ ] Tablón: lista de encargos con detalle
- [ ] Envío: elegir héroes, ver estimación, enviar
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
