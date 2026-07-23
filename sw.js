const CACHE_VERSION = "3";
const CACHE_NAME = `nfc-ring-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `nfc-ring-runtime-v${CACHE_VERSION}`;
const IMAGE_CACHE = `nfc-ring-images-v${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/nfc.js",
    "/storage.js",
    "/autofill.js",
    "/test.js",
    "/apdu.js",
    "/encoding.js",
    "/encoding-tests.js",
    "/manifest.json",
    "/pages/home.html",
    "/pages/guide.html",
    "/pages/test.html",
    "/pages/apdu.html",
    "/pages/cards.html"
];

const CDN_RESOURCES = [
    "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css",
    "https://code.jquery.com/jquery-3.6.0.min.js",
    "https://cdn.jsdelivr.net/npm/@webnfc/webnfc@0.1.0/dist/webnfc.min.js"
];

// Install event: Cache essential assets
self.addEventListener("install", (event) => {
    console.log("[SW] Installing Service Worker...");
    
    event.waitUntil(
        Promise.all([
            // Cache local assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log("[SW] Caching local assets...");
                return cache.addAll(ASSETS_TO_CACHE)
                    .then(() => console.log("[SW] Local assets cached"))
                    .catch(err => console.warn("[SW] Error caching assets:", err));
            }),
            
            // Pre-cache CDN resources
            caches.open(RUNTIME_CACHE).then((cache) => {
                console.log("[SW] Pre-caching CDN resources...");
                return Promise.allSettled(
                    CDN_RESOURCES.map(url => 
                        fetch(url)
                            .then(response => response.ok ? cache.put(url, response) : null)
                            .catch(() => console.warn(`[SW] Failed to pre-cache ${url}`))
                    )
                );
            })
        ]).then(() => {
            console.log("[SW] Installation complete");
            return self.skipWaiting();
        })
    );
});

// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating Service Worker...");
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== RUNTIME_CACHE && 
                        cacheName !== IMAGE_CACHE) {
                        console.log("[SW] Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log("[SW] Activation complete");
            return self.clients.claim();
        })
    );
});

// Fetch event: Intelligent caching strategies
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests to external APIs (if any)
    if (url.origin !== location.origin && 
        !CDN_RESOURCES.some(cdn => request.url.includes(cdn))) {
        return;
    }

    // Strategy 1: Cache first for images and fonts
    if (request.destination === "image" || url.pathname.endsWith(".woff2")) {
        event.respondWith(
            caches.match(request).then((response) => {
                if (response) {
                    return response;
                }
                return fetch(request).then((response) => {
                    if (!response || response.status !== 200 || response.type !== "basic") {
                        return response;
                    }
                    const responseToCache = response.clone();
                    caches.open(IMAGE_CACHE).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                    return response;
                }).catch(() => {
                    // Return a placeholder or cached version
                    return caches.match(request);
                });
            })
        );
        return;
    }

    // Strategy 2: Network first for API calls and data
    if (request.method === "POST" || url.pathname.includes("/api")) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache successful responses
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if offline
                    return caches.match(request)
                        .then(response => response || createOfflineResponse());
                })
        );
        return;
    }

    // Strategy 3: Cache first for static assets
    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response;
            }

            return fetch(request)
                .then((response) => {
                    // Cache successful responses to documents and scripts
                    if (response && response.status === 200 && 
                        (response.type === "basic" || request.destination === "style" || request.destination === "script")) {
                        const responseToCache = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch((error) => {
                    console.warn("[SW] Fetch failed:", request.url, error);
                    
                    // Try to return a cached version
                    return caches.match(request)
                        .then(response => response || createOfflineResponse(request));
                });
        })
    );
});

// Create offline response fallback
function createOfflineResponse(request) {
    return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
            <title>Offline</title>
            <style>
                body { background: #000; color: #00ff00; font-family: monospace; padding: 20px; }
                h1 { color: #ff00ff; }
            </style>
        </head>
        <body>
            <h1>💀 OFFLINE</h1>
            <p>The requested resource is not available offline.</p>
            <p>URL: ${request ? request.url : 'unknown'}</p>
            <p>Please reconnect to the internet and try again.</p>
        </body>
        </html>`,
        {
            headers: { "Content-Type": "text/html" },
            status: 503,
            statusText: "Service Unavailable"
        }
    );
}

// Handle messages from clients
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === "CLEAR_CACHE") {
        caches.delete(RUNTIME_CACHE).then(() => {
            console.log("[SW] Runtime cache cleared");
        });
    }
    
    if (event.data && event.data.type === "GET_CACHE_SIZE") {
        getCacheSize().then(size => {
            event.ports[0].postMessage({ cacheSize: size });
        });
    }
});

// Calculate total cache size
async function getCacheSize() {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                totalSize += response.headers.get("content-length") || 0;
            }
        }
    }
    
    return totalSize;
}

console.log("[SW] Service Worker script loaded");
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
