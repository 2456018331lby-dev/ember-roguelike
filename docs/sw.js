const CACHE = 'ember-v3';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './sw.js',
  './src/main.mjs', './src/game_core.mjs', './icons/icon.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone));
      return resp;
    }).catch(() => caches.match(event.request))
  );
});
