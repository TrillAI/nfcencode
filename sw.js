const CACHE_NAME = "nfc-ring-v3";
const ASSETS = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/nfc.js",
    "/storage.js",
    "/autofill.js",
    "/test.js",
    "/apdu.js",
    "/manifest.json",
    "/pages/home.html",
    "/pages/guide.html",
    "/pages/test.html",
    "/pages/apdu.html",
    "/pages/cards.html",
    "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css",
    "https://code.jquery.com/jquery-3.6.0.min.js",
    "https://cdn.jsdelivr.net/npm/@webnfc/webnfc@0.1.0/dist/webnfc.min.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log("[SW] Caching assets...");
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log("[SW] Assets cached successfully.");
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error("[SW] Error caching assets:", error);
            })
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("[SW] Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log("[SW] Service Worker activated.");
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.url.includes("http") || event.request.url.includes("https")) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        console.log("[SW] Serving from cache:", event.request.url);
                        return response;
                    }
                    console.log("[SW] Fetching from network:", event.request.url);
                    return fetch(event.request)
                        .then((response) => {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                            return response;
                        });
                })
                .catch((error) => {
                    console.error("[SW] Fetch failed:", error);
                    return caches.match("/pages/offline.html");
                })
        );
    } else {
        event.respondWith(fetch(event.request));
    }
});

self.addEventListener("sync", (event) => {
    if (event.tag === "sync-cards") {
        event.waitUntil(syncCards());
    }
});

async function syncCards() {
    console.log("[SW] Syncing cards...");
}
