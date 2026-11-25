/* Service worker: guarda el juego para poder abrirlo sin conexión.
   Al instalarse guarda de una vez todos los archivos del juego (el build apunta aquí la lista, una
   huella de la versión y la versión del juego: cada versión nueva se baja entera y la vieja se
   borra), así que basta con abrirlo una vez con conexión. La página se pide primero a la red y sin
   caché HTTP (para recibir las actualizaciones) y, si no hay red, sale de la caché; lo demás, caché
   primero. Una versión nueva espera a que la página la active (src/platform/update.ts): así la
   página vieja no se queda sin sus archivos a media partida. */
const CACHE = 'jarro-v1';
const VERSION = 'dev';
const FILES = [];
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

// Lo que no lleva huella en el nombre se pide a la red, no a la caché HTTP (GitHub Pages da 10 min).
const fresh = (u) => (u.startsWith('./assets/') ? u : new Request(u, { cache: 'reload' }));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([...new Set([...SHELL, ...FILES])].map(fresh))),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'activar') self.skipWaiting();
  else if (e.data === 'version') e.ports[0]?.postMessage(VERSION);
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      // 'no-cache': siempre se pregunta al servidor (con la etiqueta, la respuesta es corta).
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
