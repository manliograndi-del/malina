/* Compilatutto – fa funzionare l'app anche senza connessione. Prima prova la rete, così gli aggiornamenti arrivano subito. */
const CACHE = 'compilatutto-v2';
const FILE = ['./', 'index.html', 'stile.css', 'campi.js', 'motore.js', 'pulsante.js', 'cassaforte.js', 'moduli-pdf.js',
  'lib/pdf-lib.min.js', 'app.js', 'manifest.webmanifest', 'icone/icona.svg', 'icone/icona-192.png', 'icone/icona-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) { return; }
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) {
      const copia = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
    }
    return r;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
  }));
});
