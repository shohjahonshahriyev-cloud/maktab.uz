const CACHE_NAME = 'maktab-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/logo.png',
    '/manifest.json'
];

// Install: cache essential files
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate: clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET and API/socket requests — always go to network
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return;
    if (event.request.url.includes('/socket.io/')) return;
    if (event.request.url.includes('/uploads/')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache a copy of the fresh response
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Network failed — return from cache
                return caches.match(event.request).then((cached) => {
                    return cached || caches.match('/index.html');
                });
            })
    );
});

// Push notifications
self.addEventListener('push', function(event) {
    let data = { title: 'Yangi xabar', body: 'Maktabdan yangi xabar keldi' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'maktab-notification',
        renotify: true,
        requireInteraction: true,
        data: { dateOfArrival: Date.now(), primaryKey: '1' },
        actions: [
            { action: 'explore', title: "Ko'rish" },
            { action: 'close', title: 'Yopish' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (let client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/');
        })
    );
});
