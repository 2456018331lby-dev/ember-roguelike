const CACHE = 'ember-mvp-v1';
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
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
