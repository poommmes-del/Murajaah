const CACHE_NAME = 'murajaah-v1.2';
const STATIC_CACHE = 'murajaah-static-v1.2';
const DYNAMIC_CACHE = 'murajaah-dynamic-v1.2';
const AUDIO_CACHE = 'murajaah-audio-v1';

// Resources to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
    /api\.alquran\.cloud/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => {
                    return new Request(url, { mode: 'cors' });
                })).catch(err => {
                    console.log('[SW] Some static assets failed to cache:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('murajaah-') && 
                                   name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE &&
                                   name !== AUDIO_CACHE;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Handle API requests
    if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.href))) {
        event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
        return;
    }

    // Handle audio files
    if (url.href.includes('.mp3') || url.href.includes('audio')) {
        event.respondWith(cacheFirstWithNetwork(request, AUDIO_CACHE));
        return;
    }

    // Handle fonts
    if (url.href.includes('fonts.googleapis.com') || url.href.includes('fonts.gstatic.com')) {
        event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
        return;
    }

    // Handle static assets
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
});

// Cache-first strategy (for static assets)
async function cacheFirstWithNetwork(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Return cached version and update in background
        fetchAndCache(request, cache);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Return offline page or fallback
        return new Response('Offline - Contenu non disponible', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// Network-first strategy (for API)
async function networkFirstWithCache(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response(JSON.stringify({
            error: true,
            message: 'Offline - Données en cache non disponibles'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Background fetch and cache
async function fetchAndCache(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response);
        }
    } catch (error) {
        // Silently fail for background updates
    }
}

// Handle messages from the app
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

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Sync any pending data when back online
    console.log('[SW] Syncing data...');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
