const CACHE_NAME = 'workrank-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'WorkRank';
  const options = {
    body: data.body || '',
    icon: '/workrank-mark.svg',
    badge: '/workrank-mark.svg',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const match = windowClients.find((c) => c.url.includes(url));
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});
