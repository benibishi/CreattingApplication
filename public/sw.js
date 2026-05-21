/**
 * SITE-SECURE SERVICE WORKER
 * Enhanced offline support with caching and background sync
 */

const CACHE_NAME = 'site-secure-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/store.js',
    '/js/i18n.js',
    '/js/sound.js',
    '/js/theme.js',
    '/js/modals.js',
    '/js/auth.js',
    '/js/admin.js',
    '/js/itadmin.js',
    '/js/signin.js',
    '/js/incidents.js',
    '/js/profile.js',
    '/js/app.js',
    '/manifest.json'
];

const API_CACHE_NAME = 'site-secure-api-v1';
const OFFLINE_QUEUE_KEY = 'OFFLINE_SIGNIN_QUEUE';

// Install: Cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (POST, PATCH, DELETE) — handle separately
    if (request.method !== 'GET') {
        // For sign-in POST requests, queue if offline
        if (url.pathname === '/api/signins' && request.method === 'POST') {
            event.respondWith(
                fetch(request.clone()).catch(async () => {
                    // Queue the sign-in for later
                    const body = await request.clone().json();
                    const clients = await self.clients.matchAll();
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'OFFLINE_QUEUE',
                            data: body
                        });
                    });
                    return new Response(JSON.stringify({
                        id: 'offline-' + Date.now(),
                        ...body,
                        timestamp: new Date().toISOString(),
                        _offline: true
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
            );
            return;
        }
        return;
    }

    // API requests: network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).then((response) => {
                // Cache successful API responses
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(API_CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                return caches.match(request).then((cached) => {
                    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                });
            })
        );
        return;
    }

    // Static assets: cache-first with network fallback
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            });
        }).catch(() => {
            // Fallback to index.html for SPA routes
            if (request.headers.get('accept')?.includes('text/html')) {
                return caches.match('/index.html');
            }
        })
    );
});

// Listen for online event to sync queued sign-ins
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_OFFLINE') {
        const queue = event.data.queue || [];
        queue.forEach(async (item) => {
            try {
                await fetch('/api/signins', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                console.log('[SW] Synced offline sign-in:', item);
            } catch (e) {
                console.error('[SW] Failed to sync:', e);
            }
        });
    }
});