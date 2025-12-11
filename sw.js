const CACHE_VERSION = 'v1.3';
const CACHE_NAME = `murajaah-${CACHE_VERSION}`;
const OFFLINE_URL = './offline.html';

// Fichiers à mettre en cache immédiatement
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './offline.html',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installation...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Mise en cache des fichiers statiques');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Installation terminée');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Erreur installation:', error);
            })
    );
});

// Activation du Service Worker
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
            .then(() => {
                console.log('[SW] Activation terminée');
                return self.clients.claim();
            })
    );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignorer les requêtes chrome-extension, etc.
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Stratégie pour les requêtes de navigation (pages HTML)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Mettre en cache la réponse
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Hors ligne : retourner depuis le cache
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Si pas en cache, retourner la page d'accueil cachée
                            return caches.match('./index.html')
                                .then((indexResponse) => {
                                    if (indexResponse) {
                                        return indexResponse;
                                    }
                                    // Dernier recours : page offline
                                    return caches.match(OFFLINE_URL);
                                });
                        });
                })
        );
        return;
    }
    
    // Stratégie pour les API AlQuran (Network First)
    if (url.hostname.includes('alquran.cloud')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }
    
    // Stratégie pour les autres ressources (Cache First)
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Mise à jour en arrière-plan
                    fetch(request).then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, response);
                            });
                        }
                    }).catch(() => {});
                    
                    return cachedResponse;
                }
                
                return fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    });
            })
    );
});

// Réception de messages
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'clearCache') {
        caches.keys().then((names) => {
            names.forEach((name) => {
                if (name.startsWith('murajaah-')) {
                    caches.delete(name);
                }
            });
        });
    }
});
