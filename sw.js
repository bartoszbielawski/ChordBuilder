/*
 * ChordBuilder — service worker: działanie offline.
 * Strategia „stale-while-revalidate”: odpowiedź od razu z pamięci podręcznej,
 * a w tle pobranie świeżej wersji (zmiany widać przy kolejnym otwarciu).
 * Po zmianie listy plików podbij VERSION.
 */
const VERSION = 'v2';
const CACHE = 'chordbuilder-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'sheet.html',
  'intervals.html',
  'modes.html',
  'quiz.html',
  'css/style.css',
  'css/sheet.css',
  'js/theory.js',
  'js/instruments.js',
  'js/audio.js',
  'js/app.js',
  'js/sheet.js',
  'js/common.js',
  'js/intervals.js',
  'js/modes.js',
  'js/quiz.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('chordbuilder-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Adres z #… lub ?… dla strony głównej → ta sama strona z pamięci.
      const cached = await cache.match(req, { ignoreSearch: sameOrigin && req.mode === 'navigate' });
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
