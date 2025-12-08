const CACHE_NAME = 'murajaah-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/download-worker.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(response => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return response;
                });
            })
            .catch(() => {
                // Return offline page if available
                return caches.match('/index.html');
            })
    );
});
