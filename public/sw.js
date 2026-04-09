const CACHE_NAME = 'solb-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 구버전 캐시 정리
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Network-first + 정적 자산 캐시
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // API 호출과 외부 리소스는 캐싱 제외
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;
  // 정적 자산(JS/CSS/이미지) → cache-first
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(resp => {
            if (resp.ok) cache.put(event.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }
  // 페이지 요청 → network-first, 오프라인 시 캐시 fallback
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resp.clone()));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle push notification display
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SOLB PORTFOLIO';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'solb-alert',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

// Handle messages from the client (fallback notification)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'show-notification') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title || 'SOLB PORTFOLIO', {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'solb-alert',
      data: '/',
    });
  }
});
