/**
 * Service Worker for Push Notifications
 *
 * Handles background notifications and offline support
 */

const CACHE_NAME = "second-brain-v1";
const API_URL = self.location.origin.replace(":5173", ":3000"); // Adjust for dev/prod

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/", "/index.html", "/main.css"]).catch((err) => {
        console.warn("[Service Worker] Cache installation failed:", err);
      });
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push received:", event);

  let notificationData = {
    title: "Second Brain",
    body: "You have a new notification",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: "default",
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.message || payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || payload.id || notificationData.tag,
        requireInteraction: payload.requireInteraction || false,
        data: {
          ...payload,
          timestamp: Date.now(),
        },
      };
    } catch (err) {
      console.error("[Service Worker] Failed to parse push data:", err);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: "view",
          title: "View",
          icon: "/icons/view.png",
        },
        {
          action: "dismiss",
          title: "Dismiss",
          icon: "/icons/close.png",
        },
      ],
    }),
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked:", event);

  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === "dismiss") {
    // Mark as read in background
    if (notificationData?.id) {
      fetch(`${API_URL}/api/notifications/${notificationData.id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${notificationData.authToken}`,
          "Content-Type": "application/json",
        },
      }).catch((err) => console.error("Failed to mark as read:", err));
    }
    return;
  }

  // Default action or 'view' action
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus().then(() => {
              // Navigate to specific page if actionUrl is provided
              if (notificationData?.actionUrl) {
                client.postMessage({
                  type: "NAVIGATE",
                  url: notificationData.actionUrl,
                });
              }
              // Mark as read
              if (notificationData?.id) {
                client.postMessage({
                  type: "NOTIFICATION_READ",
                  id: notificationData.id,
                });
              }
            });
          }
        }

        // If no window is open, open a new one
        const urlToOpen = notificationData?.actionUrl
          ? `${self.location.origin}${notificationData.actionUrl}`
          : self.location.origin;

        return clients.openWindow(urlToOpen);
      }),
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("[Service Worker] Notification closed:", event);
  // Optional: Track dismissals
});

// Message event - handle messages from clients
self.addEventListener("message", (event) => {
  console.log("[Service Worker] Message received:", event.data);

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch event - network-first strategy for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Network-first for API requests
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache on network failure
          return caches.match(event.request);
        }),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache new resources
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    }),
  );
});
