const CACHE_NAME = 'murajaah-cache-v2';
const DATA_CACHE_NAME = 'murajaah-data-v2';

// Fichier principal de l'application à mettre en cache
const APP_SHELL_URLS = [
  'murajaah_v2_offline.html' // Doit correspondre au nom du fichier HTML
];

// Hôtes des APIs dont les données seront mises en cache
const API_HOSTS = [
  'api.quran.sutanlab.id',
  'api.alquran.cloud',
  'raw.githubusercontent.com'
];

// Étape d'installation : mise en cache de l'App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache de l\'App Shell');
      // Note : L'utilisateur doit accéder à 'murajaah_v2_offline.html'
      // pour que cela fonctionne depuis le cache.
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Étape d'activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[SW] Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Étape de Fetch : intercepter les requêtes réseau
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Requête API (Stratégie : Réseau d'abord, puis Cache)
  if (API_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(async (cache) => {
        try {
          // Essayer d'abord le réseau
          const response = await fetch(event.request);
          if (response.ok) {
            // Si succès, mettre en cache et retourner la réponse
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          // Si réseau échoue, servir depuis le cache
          console.log('[SW] API Réseau échoué, service depuis le cache:', event.request.url);
          return await cache.match(event.request); // Retourne la réponse en cache ou undefined
        }
      })
    );
  }
  // 2. Requête vers un Proxy (Stratégie : Réseau seulement, ne jamais mettre en cache)
  else if (url.hostname.includes('allorigins.win') || url.hostname.includes('isomorphic-git.org') || url.hostname.includes('freeboard.io')) {
    event.respondWith(fetch(event.request));
  }
  // 3. App Shell et autres ressources (Stratégie : Cache d'abord, puis Réseau)
  else {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Si trouvé en cache, le retourner
        if (cachedResponse) {
          return cachedResponse;
        }
        // Sinon, essayer le réseau
        return fetch(event.request).then((response) => {
          // Mettre en cache les réponses valides
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(error => {
            console.log('[SW] Fetch App Shell échoué', error);
            // Si le fetch échoue (hors ligne) et que ce n'est pas en cache,
            // cela échouera, mais la page principale (APP_SHELL_URLS)
            // devrait déjà être en cache depuis l'installation.
        });
      })
    );
  }
});
