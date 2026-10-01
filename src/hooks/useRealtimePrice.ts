'use client';

/** 브라우저 직접 연결은 공용 키 노출 때문에 중단. useAutoRefresh의 서버 폴링은 유지한다. */
export function useRealtimePrice() {
  // 서버 중계와 세션별 인증을 갖추기 전에는 직접 WebSocket을 재활성화하지 않는다.
}
