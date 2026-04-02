const CACHE_NAME = 'flight-checklist-v2.0';
const URLs_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style_mobile.css?v=2.0',
  './js/checklist.js?v=2.0',
  './js/html2pdf.bundle.min.js?v=2.0',
  './js/word_export.js?v=2.0',
  './img/icon-192.png',
  './img/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(response => {
           if(!response || response.status !== 200 || response.type !== 'basic') {
             return response;
           }
           const responseToCache = response.clone();
           caches.open(CACHE_NAME).then(cache => {
             cache.put(event.request, responseToCache);
           });
           return response;
        });
      })
  );
});
