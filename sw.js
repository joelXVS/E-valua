// Service Worker for offline caching
const CACHE_NAME = "evaluacion-online-v1"
const STATIC_CACHE = "static-v1"

// Files to cache for offline use
const STATIC_FILES = [
  "/",
  "/index.html",
  "/styles/main.css",
  "/js/app.js",
  "/js/auth.js",
  "/js/data-manager.js",
  "/js/dashboard.js",
  "/js/test-creator.js",
  "/js/test-evaluator.js",
  "/js/results-analyzer.js",
  "/js/offline-manager.js",
  "/manifest.json",
]

// Install event - cache static files
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker")

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static files")
        return cache.addAll(STATIC_FILES)
      })
      .then(() => {
        console.log("[SW] Static files cached")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("[SW] Error caching static files:", error)
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker")

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("[SW] Service worker activated")
        return self.clients.claim()
      }),
  )
})

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        console.log("[SW] Serving from cache:", request.url)
        return cachedResponse
      }

      // Try to fetch from network
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response for caching
          const responseToCache = response.clone()

          // Cache the response for future use
          caches.open(CACHE_NAME).then((cache) => {
            console.log("[SW] Caching new resource:", request.url)
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch((error) => {
          console.log("[SW] Network request failed:", request.url, error)

          // Return offline page for navigation requests
          if (request.destination === "document") {
            return caches.match("/index.html")
          }

          // Return empty response for other requests
          return new Response("", {
            status: 408,
            statusText: "Request timeout - offline",
          })
        })
    }),
  )
})

// Background sync for pending data
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync triggered:", event.tag)

  if (event.tag === "sync-offline-data") {
    event.waitUntil(syncOfflineData())
  }
})

// Sync offline data function
async function syncOfflineData() {
  try {
    console.log("[SW] Starting background sync")

    // Get offline data from IndexedDB or localStorage
    const offlineData = await getOfflineData()

    if (offlineData && offlineData.length > 0) {
      // Send data to server
      for (const item of offlineData) {
        try {
          await syncItem(item)
          await removeOfflineItem(item.id)
          console.log("[SW] Synced item:", item.id)
        } catch (error) {
          console.error("[SW] Error syncing item:", item.id, error)
        }
      }
    }

    console.log("[SW] Background sync completed")
  } catch (error) {
    console.error("[SW] Background sync failed:", error)
  }
}

// Get offline data (placeholder - would use IndexedDB in production)
async function getOfflineData() {
  // In a real implementation, this would read from IndexedDB
  return []
}

// Sync individual item (placeholder)
async function syncItem(item) {
  // In a real implementation, this would make API calls
  return Promise.resolve()
}

// Remove synced item (placeholder)
async function removeOfflineItem(itemId) {
  // In a real implementation, this would remove from IndexedDB
  return Promise.resolve()
}

// Push notification support
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received")

  const options = {
    body: event.data ? event.data.text() : "Nueva notificación",
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Ver",
        icon: "/icon-explore.png",
      },
      {
        action: "close",
        title: "Cerrar",
        icon: "/icon-close.png",
      },
    ],
  }

  event.waitUntil(self.registration.showNotification("Sistema de Evaluación", options))
})

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action)

  event.notification.close()

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/"))
  }
})

// Message handler for communication with main thread
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME })
  }
})
