/**
 * 투어/활성화 텔레메트리 이벤트 화이트리스트 — 순수 상수(클라이언트 가드 + 서버 엔드포인트 검증 공유 SSOT).
 *
 * logTourEvent(클라)와 /api/tour-event(서버)가 같은 목록으로 검증해 임의 이벤트 주입을 차단한다.
 * 새 이벤트는 여기 한 곳에 추가.
 */
export const TOUR_EVENT_NAMES = [
  // 투어 funnel
  'tour_started',
  'tour_step',
  'tour_completed',
  'tour_skipped',
  'tour_anchor_missing',   // 600ms 무음 skip 대체 — 이탈 vs 미마운트 구분
  // 활성화 채택
  'feature_first_use',     // meta.featureId 1회 발화
  // 게스트(비로그인) 데모 funnel — Phase 3 게스트 투어에서 소비
  'demo_started',
  'demo_sample_loaded',
  'demo_to_login',
] as const;

export type TourEventName = typeof TOUR_EVENT_NAMES[number];

export const TOUR_EVENT_SET: ReadonlySet<string> = new Set(TOUR_EVENT_NAMES);
