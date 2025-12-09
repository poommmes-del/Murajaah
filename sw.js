const CACHE_NAME = 'murajaah-cache-v1';
const urlsToCache = [
    '/',
    '/index.html', // Assurez-vous que votre fichier HTML principal est bien nommé 'index.html'
    // Ajoutez ici les fichiers essentiels pour l'affichage initial
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    // Ajoutez les polices Google que vous utilisez
    'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    'https://fonts.gstatic.com',
    // Ajoutez les chemins vers vos icônes
    '/icons/icon-192x192.png'
    // Note: Les appels à l'API du Coran (alquran.cloud) ne peuvent pas être mis en cache ici.
];

// Installation du Service Worker et mise en cache des ressources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Interception des requêtes et récupération depuis le cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retourne la ressource mise en cache si elle existe
                if (response) {
                    return response;
                }
                // Sinon, fetch la ressource depuis le réseau
                return fetch(event.request);
            }
        )
    );
});

// Suppression des anciens caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
