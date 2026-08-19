const CACHE_NAME = 'joobi-v2';

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
  // Next.js 빌드 청크는 파일명/모듈 그래프가 개발·배포마다 달라진다.
  // SW cache-first로 잡으면 이전 청크가 새 HTML과 섞여 module factory 오류가 발생한다.
  // 브라우저/Next의 HTTP 캐시에 맡기고 서비스 워커는 절대 가로채지 않는다.
  if (url.pathname.startsWith('/_next/')) return;
  // 버전과 무관한 앱 정적 자산만 cache-first
  if (url.pathname.match(/\.(png|svg|ico|woff2?)$/)) {
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
          // clone은 응답을 브라우저에 넘기기 전에 동기적으로 만들어야 한다.
          // caches.open() 뒤에서 clone하면 원본 body가 이미 소비되어 InvalidStateError가 난다.
          const cacheCopy = resp.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, cacheCopy))
              .catch(() => {})
          );
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then(cached =>
        cached || new Response('오프라인 상태예요. 네트워크 연결을 확인해주세요.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      ))
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
