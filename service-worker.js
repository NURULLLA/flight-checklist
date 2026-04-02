// service-worker.js - Simple cache for offline support
const CACHE_NAME = 'flight-checklist-v1';
const URLs_TO_CACHE = [
  './checklist.html',
  './manifest.json',
  './css/style_mobile.css',
  './js/checklist.js',
  './js/html2pdf.bundle.min.js',
  './js/word_export.js',
  './img/icon-192.png',
  './img/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLs_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
