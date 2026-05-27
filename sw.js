// Service worker AUTO-DESTRUTIVO.
// O SW de cache anterior travava o app (cache-first servindo versão presa).
// Esta versão limpa todos os caches, se desregistra e recarrega as abas abertas,
// destravando qualquer navegador que tenha ficado preso na versão antiga.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => client.navigate(client.url));
    })());
});

// Enquanto este SW ainda estiver vivo, passa tudo pela rede (sem cache).
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
