const CACHE_NAME = 'murajaah-cache-v2';
const DATA_CACHE_NAME = 'murajaah-data-v6'; // CHANGEMENT DE VERSION POUR FORCER LA MISE À JOUR

// Fichier principal de l'application et les données essentielles (API des sourates)
const APP_SHELL_URLS = [
  'murajaah_v2_offline.html',
  'https://api.quran.sutanlab.id/surah' 
];

// Hôtes des APIs dont les données seront mises en cache (texte, audio, traduction)
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
      // On ajoute l'URL du fichier HTML lui-même
      return cache.addAll(APP_SHELL_URLS.concat(['/Murajaah/murajaah_v2_offline.html'])).catch(error => {
          console.warn('[SW] Avertissement: Échec de l\'ajout de certaines URLs durant l\'installation (attendu pour les APIs)', error);
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
          // On supprime les caches qui n'ont pas la nouvelle version v6
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
        // Si la réponse est en cache, on la renvoie immédiatement (stratégie Cache-First)
        if (cachedResponse) {
            // console.log('[SW] API Servi depuis le cache de données:', event.request.url);
            return cachedResponse;
        }

        // Sinon, on essaie le réseau et on met en cache le résultat
        return fetch(event.request).then(async (response) => {
            if (response && response.status === 200) {
                const cache = await caches.open(DATA_CACHE_NAME);
                // Si c'est une requête HEAD (pour vérifier l'existence de l'audio), on ne cache pas
                if (event.request.method !== 'HEAD') {
                    // Vérifie que l'URL n'est pas trop longue pour le cache (limitations Chrome)
                    if (event.request.url.length < 2000) {
                       cache.put(event.request, response.clone());
                    }
                }
            }
            return response;
        }).catch(async (error) => {
            // Si le réseau échoue et que ce n'était pas en cache, on retourne une erreur.
            console.error('[SW] API Réseau échoué et non trouvé dans le cache:', event.request.url, error);
            // Retourne une réponse vide ou un message d'erreur JSON pour éviter de bloquer l'App
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
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Vérifie que l'URL n'est pas trop longue
              if (event.request.url.length < 2000) {
                 cache.put(event.request, responseToCache);
              }
            });
          }
          return response;
        }).catch(error => {
            console.log('[SW] Fetch App Shell échoué', error);
        });
      })
    );
  }
});
