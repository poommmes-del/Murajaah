const CACHE_NAME = 'murajaah-cache-v2';
const DATA_CACHE_NAME = 'murajaah-data-v4'; // CHANGEMENT DE VERSION POUR FORCER LA MISE À JOUR + FIX

// Fichier principal de l'application et les données essentielles
const APP_SHELL_URLS = [
  'murajaah_v2_offline.html', // La page HTML
  // Ajout de l'URL pour la liste des sourates afin que l'interface de sélection fonctionne hors-ligne
  'https://api.quran.sutanlab.id/surah' 
];

// Hôtes des APIs dont les données seront mises en cache
const API_HOSTS = [
  'api.quran.sutanlab.id',
  'api.alquran.cloud',
  'raw.githubusercontent.com'
];

// Étape d'installation : mise en cache de l'App Shell + les données essentielles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache de l\'App Shell et des données essentielles');
      // Tente d'ajouter tous les fichiers de l'APP_SHELL_URLS
      return cache.addAll(APP_SHELL_URLS).catch(error => {
          // Si un fichier (comme l'API) ne se charge pas, on continue quand même pour ne pas bloquer
          // l'installation du Service Worker. Les fichiers HTML/JS restent en cache.
          console.error('[SW] Échec de l\'ajout de certaines URLs (normal pour API):', error);
      });
    })
  );
});

// Étape d'activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // On supprime les caches qui n'ont pas la nouvelle version v4
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

  // 1. Requête API (Stratégie : Cache d'abord, puis Réseau si échec)
  if (API_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Si la réponse est en cache (même les données API de l'install), on la renvoie immédiatement
        if (cachedResponse) {
            console.log('[SW] API Servi depuis le cache de données:', event.request.url);
            return cachedResponse;
        }

        // Sinon, on essaie le réseau et on met en cache le résultat
        return fetch(event.request).then(async (response) => {
            if (response && response.status === 200) {
                const cache = await caches.open(DATA_CACHE_NAME);
                cache.put(event.request, response.clone());
            }
            return response;
        }).catch(async (error) => {
            // Si le réseau échoue et que ce n'était pas en cache, on retourne une erreur.
            console.error('[SW] API Réseau échoué et non trouvé dans le cache:', event.request.url, error);
            // Retourne une réponse synthétique pour éviter un crash (utile pour les données non trouvées)
            return new Response(JSON.stringify({ error: "Données indisponibles hors-ligne." }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        });
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
            // En cas d'échec, le navigateur affichera sa propre page d'erreur (si non trouvée dans le cache).
        });
      })
    );
  }
});
