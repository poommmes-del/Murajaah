const CACHE_VERSION = 'v1.4';
const CACHE_NAME = `murajaah-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './offline.html',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// CDNs à mettre en cache
const CDN_URLS = [
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installation...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Mise en cache des fichiers');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => console.error('[SW] Erreur:', error))
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activation...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('murajaah-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Suppression ancien cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    // Navigation requests
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then((cached) => cached || caches.match('./index.html'))
                        .then((response) => response || caches.match('./offline.html'));
                })
        );
        return;
    }

    // API AlQuran - Network first
    if (url.hostname.includes('alquran.cloud')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // CDNs et autres ressources - Cache first
    event.respondWith(
        caches.match(request)
            .then((cached) => {
                if (cached) {
                    // Mise à jour en arrière-plan
                    fetch(request).then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
                        }
                    }).catch(() => {});
                    return cached;
                }

                return fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return response;
                    });
            })
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
