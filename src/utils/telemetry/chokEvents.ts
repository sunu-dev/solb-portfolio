import { logApiCall } from '@/lib/apiLogger';

/**
 * AI 촉 노출·상호작용 텔레메트리.
 *
 * 목적: "자동노출 = 매일 촉 확인 습관 → 리텐션" 가설을 측정 가능하게 한다.
 *   검증=측정 룰(feedback_validation_instrumentation): 측정 장치 없는 자동로드 유지는 '시연'에 그친다.
 *   logApiCall → api_logs 테이블(로그인 유저만, silent fail). AI 촉은 로그인 필수라 커버리지 충분.
 *
 * 이벤트:
 * - ai_chok_impression : 카드가 로드되어 화면에 그려짐(렌더 깔때기 분모). 매 fetch 결과당 1회.
 * - ai_chok_inview     : 카드가 실제로 뷰포트에 들어옴(실 노출). 세션당 1회.
 * - ai_chok_<kind>     : 상호작용(analyze/watch/feedback/generate) 전환율.
 */

type ChokMeta = Record<string, unknown>;

export function trackChokImpression(meta: ChokMeta = {}) {
  logApiCall('ai_chok_impression', undefined, meta);
}

export function trackChokInView(meta: ChokMeta = {}) {
  logApiCall('ai_chok_inview', undefined, meta);
}

export function trackChokInteraction(
  kind: 'analyze' | 'watch' | 'feedback' | 'generate',
  symbol?: string,
  meta: ChokMeta = {},
) {
  logApiCall(`ai_chok_${kind}`, symbol, meta);
}
