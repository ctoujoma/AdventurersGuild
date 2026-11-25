/* Actualizaciones de la web instalada (PWA).
   La app instalada casi nunca vuelve a cargar la página (se reanuda con el código en memoria),
   así que el navegador no busca un sw.js nuevo por su cuenta. Aquí se busca al volver a la app y
   cada media hora; cuando hay un service worker nuevo esperando, se avisa al juego, que ofrece
   recargar. Si la página ya es la nueva (llegó por la red), se activa sin avisar. */

/** Qué hacer con un service worker nuevo que espera, según su versión y la de esta página. */
export function onWaiting(page: string, waiting: string | null): 'activar' | 'avisar' {
  return waiting !== null && waiting !== 'dev' && waiting === page ? 'activar' : 'avisar';
}

/** Cada cuánto se busca versión nueva con el juego abierto, y lo mínimo entre dos búsquedas. */
const EVERY = 30 * 60_000;
const GAP = 10_000;

let waiting: ServiceWorker | null = null;
const subs = new Set<(ready: boolean) => void>();

/** Avisa cuando hay versión nueva lista (y enseguida, si ya la hay). Devuelve cómo darse de baja. */
export function onUpdateReady(fn: (ready: boolean) => void): () => void {
  subs.add(fn);
  if (waiting) fn(true);
  return () => subs.delete(fn);
}

/** Activa la versión nueva y recarga la página cuando toma el mando. */
export function applyUpdate(): void {
  const sw = navigator.serviceWorker;
  if (!waiting || !sw) return location.reload();
  sw.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage('activar');
  // Por si el cambio de mando no llega (navegador raro): se recarga igual.
  setTimeout(() => location.reload(), 4000);
}

/** Pregunta su versión a un service worker (los viejos no contestan: null). */
function askVersion(w: ServiceWorker): Promise<string | null> {
  return new Promise((ok) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => ok(null), 1500);
    ch.port1.onmessage = (e) => {
      clearTimeout(t);
      ok(typeof e.data === 'string' ? e.data : null);
    };
    w.postMessage('version', [ch.port2]);
  });
}

/** Registra el service worker y vigila las versiones nuevas. */
export async function registerSw(version: string): Promise<void> {
  const sw = navigator.serviceWorker;
  // updateViaCache 'none': el sw.js (y lo que importe) se pide siempre a la red, sin caché HTTP.
  const reg = await sw.register('./sw.js', { updateViaCache: 'none' });

  const consider = async (w: ServiceWorker) => {
    // Primera instalación: no hay página vieja que cambiar, se activa sola.
    if (!sw.controller) return;
    if (onWaiting(version, await askVersion(w)) === 'activar') {
      w.postMessage('activar');
      return;
    }
    waiting = w;
    subs.forEach((fn) => fn(true));
  };
  const track = (w: ServiceWorker) => {
    if (w.state === 'installed') void consider(w);
    else
      w.addEventListener('statechange', () => {
        if (w.state === 'installed') void consider(w);
      });
  };
  if (reg.waiting) void consider(reg.waiting);
  if (reg.installing) track(reg.installing);
  reg.addEventListener('updatefound', () => {
    if (reg.installing) track(reg.installing);
  });

  let last = 0;
  const check = () => {
    if (Date.now() - last < GAP || navigator.onLine === false) return;
    last = Date.now();
    reg.update().catch(() => {
      /* sin red o servidor caído: ya se buscará otra vez */
    });
  };
  // Al abrir también: el navegador lo deja para cuando el service worker esté ocioso (a veces nunca).
  check();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  setInterval(() => {
    if (!document.hidden) check();
  }, EVERY);
}
