# Para agentes

- Responde y escribe en español (código, comentarios, PR), breve.
- El juego es el gremio por salas (ya en `main`; cada PR va contra `main`). Antes de nada, lee
  [`docs/salas/README.md`](docs/salas/README.md) (estado, forma de trabajar, mapa del código).
- Trabajo en curso: el arte de cada sala, ver [`docs/salas/encargo-arte.md`](docs/salas/encargo-arte.md).
- Si eres el agente de arte, el plan y el estado de lo que viene: [`docs/plan-arte.md`](docs/plan-arte.md)
  (léelo al empezar y ponlo al día al acabar cada pieza).
- Enemigos de las expediciones (calco de las hojas del usuario, animación, visor): [`docs/enemigos.md`](docs/enemigos.md).
- Si eres el agente principal, para retomar: [`docs/agente-principal.md`](docs/agente-principal.md).
- Decisiones abiertas con el usuario (aprobar o rechazar por partes): [`docs/decisiones.md`](docs/decisiones.md)
  y la página «Decisiones del Jarro» (https://claude.ai/artifact/5MgZx3bgd3pJQay91rDtjk). Léelas antes de empezar algo nuevo.
- Economía del oro (auditoría, lo hecho y lo pendiente; `npm run auditoria`): [`docs/economia.md`](docs/economia.md).
- Plan del juego completo (lo decidido, por fases y quién hace qué): [`docs/plan.md`](docs/plan.md).
  Ideas y detalle: [`docs/futuro.md`](docs/futuro.md).
- **Textos:** todo texto del juego va en `src/textos/<idioma>/*.yaml` y se usa con `t('zona.clave', { huecos })`;
  frases enteras (plurales y género con ICU). Convención y estado: [`docs/textos.md`](docs/textos.md).
- Antes de subir: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
