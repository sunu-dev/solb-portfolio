const CACHE_NAME = 'joobi-static-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 구버전 캐시 정리
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('joobi-') && k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Store public artwork/fonts only. Documents and RSC may contain account data or OAuth codes.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/_next/') || url.pathname.startsWith('/auth/')
    || event.request.headers.has('authorization') || event.request.headers.has('rsc')) return;
  // Revised sector artwork uses stable names and must always revalidate over HTTP.
  if (url.pathname.startsWith('/illustrations/sectors/')) return;
  const asset = !url.search && /\.(png|svg|ico|woff2?|ttf)$/.test(url.pathname)
    && (/^\/[^/]+$/.test(url.pathname) || /^\/(?:illustrations|logos|mentors|fonts)\//.test(url.pathname));
  if (asset) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
      } catch { /* Cache storage can be unavailable in private browsing. */ }
      const response = await fetch(event.request);
      const policy = response.headers.get('cache-control') || '';
      const type = response.headers.get('content-type') || '';
      if (cache && response.ok && !response.redirected && !/private|no-store/i.test(policy)
        && /^(?:image\/|font\/|application\/(?:font|x-font|octet-stream))/.test(type)) {
        const copy = response.clone();
        event.waitUntil(cache.put(event.request, copy).catch(() => {}));
      }
      return response;
    })());
    return;
  }
  // Do not cache account HTML, query strings, JSON, or Next.js navigation payloads.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => new Response(
      '오프라인 상태예요. 네트워크에 다시 연결한 뒤 주비를 열어주세요.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    )));
  }
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
