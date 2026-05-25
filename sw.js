// Service worker do PWA — cache do app shell (offline) + rede para APIs.
const CACHE = 'lifecounter-v7';

const ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon.svg',
    './favicon.jfif',
    './src/styles/main.css',
    './src/js/main.js',
    './src/js/ui.js',
    './src/js/state.js',
    './src/js/audio.js',
    './src/js/types.js',
    './src/js/aiClient.js',
    './src/js/cardScanner.js',
    './src/js/fingerPicker.js',
    './src/js/aiNarrator.js',
    './src/js/config.js',
    './dano.mp3',
    './monark.mp3',
    './viado.mp3',
    './fluminense.mp3',
];

// Instala: cacheia o que conseguir (allSettled tolera arquivos ausentes, ex.: config.js).
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(a))))
            .then(() => self.skipWaiting()),
    );
});

// Ativa: limpa caches antigos.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

// Fetch: cache-first para arquivos próprios; APIs externas (Gemini/Scryfall/Tenor) sempre pela rede.
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (new URL(req.url).origin !== self.location.origin) return; // não intercepta APIs externas

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copy));
                return res;
            }).catch(() => cached);
        }),
    );
});
