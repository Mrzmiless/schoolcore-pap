// Migration worker: remove only SchoolCore's previous offline caches.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('minha-pwa-v')).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
