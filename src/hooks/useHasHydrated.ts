import { useState, useEffect } from 'react';

/**
 * 클라이언트 하이드레이션 완료 여부.
 *
 * 홈 편집 숨김/순서는 localStorage(persist)에서 오는데, 서버는 그 값을 모르고 초기상태(전부 표시)로 렌더한다.
 * 숨긴 위젯을 클라 첫 렌더에서 바로 제거하면 서버 HTML과 어긋나 hydration mismatch + flash가 난다.
 * 이 훅은 SSR·클라 첫 렌더에서 false(=서버와 동일, 전부 표시) → 마운트 후 true로 전환해
 * 그때부터 숨김/순서를 적용한다(WidgetCard·zone 렌더가 이 플래그로 게이트).
 */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}
