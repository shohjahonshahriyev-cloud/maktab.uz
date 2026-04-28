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
        sound: '/notif-sound.mp3',
        tag: 'maktab-notification',
        renotify: true,
        requireInteraction: true,
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
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
            // If app is already open, focus it
            for (let client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            return clients.openWindow('/');
        })
    );
});
