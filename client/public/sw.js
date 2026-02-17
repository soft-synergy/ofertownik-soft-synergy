/* eslint-disable no-restricted-globals */
// Minimal service worker for PWA installability (Ofertownik)
const CACHE_NAME = 'ofertownik-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first: always try network, fallback not required for install
  event.respondWith(fetch(event.request));
});
