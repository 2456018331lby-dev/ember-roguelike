const CACHE = 'ember-v23';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './sw.js',
  './src/main.mjs', './src/game_core.mjs', './src/audio.mjs', './src/save.mjs',
  './src/characters.mjs', './src/presentation.mjs', './icons/icon.svg',
  './assets/ember-characters-spritesheet.png',
  './assets/ember-enemies-spritesheet.png',
  './assets/arena-ember-fortress.png'
];
async function precacheAssets() {
  const cache = await caches.open(CACHE);
  await Promise.all(ASSETS.map(async asset => {
    try {
      await cache.add(asset);
    } catch (_) {
      // Android WebView may reject individual Cache writes; runtime fetch remains authoritative.
    }
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAssets().catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .catch(() => {})
  );
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE)
        .then(cache => cache.put(event.request, clone))
        .catch(() => {});
      return resp;
    }).catch(async () => {
      const cached = await caches.match(event.request).catch(() => null);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const shell = await caches.match('./index.html').catch(() => null);
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});
