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
  // 기록 신뢰 샘플 funnel — 실제 계좌/종목 데이터 없이 게스트도 체험
  'record_preview_started',
  'record_preview_approved',
  'record_preview_restored',
  // 시장 길잡이 — 매번 기록해 학습·재방문 흐름을 확인
  'guide_open',
  'guide_check',
  'guide_save',
] as const;

export type TourEventName = typeof TOUR_EVENT_NAMES[number];

export const TOUR_EVENT_SET: ReadonlySet<string> = new Set(TOUR_EVENT_NAMES);

export const GUIDE_EVENT_NAMES = {
  open: 'guide_open',
  check: 'guide_check',
  save: 'guide_save',
} as const;
export type GuideAction = keyof typeof GUIDE_EVENT_NAMES;
const GUIDE_EVENT_SET: ReadonlySet<string> = new Set(Object.values(GUIDE_EVENT_NAMES));
const GUIDE_IDS: ReadonlySet<string> = new Set(['rates', 'inflation', 'currency', 'earnings']);

export function isGuideEvent(event: string): boolean {
  return GUIDE_EVENT_SET.has(event);
}

/** Client/server share the same allowlist; never collect written explanations or holdings. */
export function getGuideEventMeta(event: string, raw: unknown): { guideId: string; correct?: boolean } | null {
  if (!isGuideEvent(event) || !raw || typeof raw !== 'object') return null;
  const meta = raw as Record<string, unknown>;
  if (typeof meta.guideId !== 'string' || !GUIDE_IDS.has(meta.guideId)) return null;
  if (event === GUIDE_EVENT_NAMES.check) {
    if (typeof meta.correct !== 'boolean') return null;
    return { guideId: meta.guideId, correct: meta.correct };
  }
  return { guideId: meta.guideId };
}
