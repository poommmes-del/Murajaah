// sw.js
// Version du cache
const CACHE_NAME = 'murajaah-cache-v2.0';

// Ressources de base à mettre en cache lors de l'installation
// Le fichier HTML principal sera toujours mis en cache pour l'App Shell.
const urlsToCache = [
  './murajaah_v2_offline.html',
  // Ajoutez d'autres fichiers statiques (manifest.json, images) si vous en avez
  './manifest.json', // Nécessaire si vous utilisez cette implémentation PWA
];

// URLs des APIs à mettre en cache (pour les données dynamiques)
const API_URLS_TO_CACHE_PATTERN = [
    'https://api.quran.sutanlab.id/',
    'https://api.alquran.cloud/v1/',
];

// Logique d'installation : Mise en cache des ressources de base
self.addEventListener('install', event => {
  console.log('[Service Worker] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Mise en cache de l\'App Shell');
        return cache.addAll(urlsToCache).catch(error => {
            // Certaines ressources comme manifest.json peuvent ne pas exister initialement
            console.warn('[Service Worker] Cache partiel App Shell réussi, erreurs ignorées:', error);
        });
      })
  );
});

// Logique d'activation : Nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activation et nettoyage des anciens caches...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Suppression de l\'ancien cache :', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prend immédiatement le contrôle du client
  return self.clients.claim();
});

// Logique de récupération (Fetch) : Stratégie Cache-first pour l'App Shell et Network-first avec Cache Fallback pour l'API.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isApiRequest = API_URLS_TO_CACHE_PATTERN.some(pattern => url.href.startsWith(pattern));
  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation || url.pathname.endsWith('.html')) {
    // 1. Stratégie Cache-first pour le HTML (App Shell)
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // Si l'App Shell est dans le cache, on le retourne immédiatement.
            return response;
          }
          // Sinon, on passe au réseau
          return fetch(event.request);
        })
    );
    return;
  }
  
  if (isApiRequest) {
    // 2. Stratégie Network-first avec Cache Fallback pour les requêtes API
    // Ceci permet d'obtenir les données les plus fraîches, mais utilise le cache en cas d'échec réseau.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la requête réussit, clonez la réponse et mettez-la dans le cache
          if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // En cas d'échec réseau, essayez de retourner une réponse du cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Autres assets (CSS, JS, images, etc.) - Cache-first, Network fallback
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
