/*
 * ChordBuilder — service worker: działanie offline.
 * Strategia dla plików strony: „najpierw sieć” — online zawsze świeże i spójne
 * wersje plików (HTML, JS i CSS z jednego wdrożenia), offline — kopia z pamięci.
 * Czcionki Google: najpierw pamięć (nie zmieniają się).
 * Po zmianie listy plików podbij VERSION.
 */
const VERSION = 'v11';
const CACHE = 'chordbuilder-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'sheet.html',
  'intervals.html',
  'modes.html',
  'quiz.html',
  'worksheet.html',
  'glossary.html',
  'rhythm.html',
  'learn.html',
  'css/style.css',
  'css/sheet.css',
  'js/theory.js',
  'js/i18n.js',
  'js/i18n-en.js',
  'js/instruments.js',
  'js/audio.js',
  'js/app.js',
  'js/sheet.js',
  'js/common.js',
  'js/intervals.js',
  'js/modes.js',
  'js/quiz.js',
  'js/worksheet.js',
  'js/glossary.js',
  'js/rhythm-core.js',
  'js/rhythm.js',
  'js/learn.js',
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
      // Adres z #… lub ?… dla strony → ta sama strona z pamięci.
      const match = () => cache.match(req, { ignoreSearch: sameOrigin && req.mode === 'navigate' });
      if (!sameOrigin) {
        const cached = await match();
        if (cached) return cached;
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const cached = await match();
        if (cached) return cached;
        throw e;
      }
    })
  );
});
