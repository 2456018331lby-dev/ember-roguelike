const CACHE = 'ember-v12';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './sw.js',
  './src/main.mjs', './src/game_core.mjs', './src/audio.mjs', './src/save.mjs',
  './src/characters.mjs', './src/presentation.mjs', './icons/icon.svg',
  './assets/ember-characters-spritesheet.png',
  './assets/ember-enemies-spritesheet.png',
  './assets/arena-ember-fortress.png'
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
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone));
      return resp;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});
