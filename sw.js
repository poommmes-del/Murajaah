const CACHE_NAME = 'murajaah-v2-offline';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon.png',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap'
];

// Installation : Mise en cache des ressources statiques
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
});

// Interception des requêtes (Stratégie : Cache First, then Network)
self.addEventListener('fetch', (event) => {
    // On laisse passer les requêtes non GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Si trouvé dans le cache, on retourne le cache
            if (cachedResponse) {
                return cachedResponse;
            }

            // Sinon, on va chercher sur le réseau
            return fetch(event.request).then((networkResponse) => {
                // Si la réponse est valide, on la met en cache pour la prochaine fois
                // On clone la réponse car elle ne peut être lue qu'une fois
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback si offline et pas de cache (optionnel)
                console.log("Offline et ressource non cachée");
            });
        })
    );
});
