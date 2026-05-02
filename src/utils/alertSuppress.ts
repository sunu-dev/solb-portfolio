/**
 * Alert 억제(Suppression) 통합 Facade
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §3.4
 *
 * 두 가지 억제 방식을 단일 API로 통합:
 *   1. Snooze (alertSnooze.ts) — 시간 기반 explicit (사용자가 1h/3h/24h/장마감 선택)
 *   2. Learning (alertLearning.ts) — 횟수 기반 implicit (반복 dismiss → 자동 억제)
 *
 * 두 시스템은 데이터·로직이 다르므로 facade로 묶어 일관된 표면만 노출.
 * Consumer는 본 모듈만 import하면 양쪽 정책이 모두 적용된다.
 */

import { isAlertSnoozed, snoozeAlert, unsnoozeAlert } from '@/utils/alertSnooze';
import type { SnoozeDuration } from '@/utils/alertSnooze';
import { isAlertSuppressed as isLearningSuppressed, recordDismissal } from '@/utils/alertLearning';

/**
 * 알림이 현재 억제(snooze OR learning) 상태인지 통합 체크.
 * Consumer는 이 한 함수만 호출하면 됨.
 */
export function isSuppressed(alertId: string): boolean {
  return isAlertSnoozed(alertId) || isLearningSuppressed(alertId);
}

/**
 * "이 알림 그만보기" 단일 액션.
 * 디폴트는 24시간 snooze + learning 카운터 1 증가.
 * UI에서 별도 duration 선택은 AlertCard가 snoozeAlert를 직접 사용.
 */
export function suppressAlert(alertId: string, duration: SnoozeDuration = '24h') {
  snoozeAlert(alertId, duration);
  recordDismissal(alertId); // 학습용 카운터도 함께 증가
}

/**
 * 억제 해제 (snooze만 해제 — learning 기록은 7일 자연 만료).
 */
export function unsuppressAlert(alertId: string) {
  unsnoozeAlert(alertId);
}

// 하위 호환 위해 핵심 심볼만 re-export
export { snoozeAlert, type SnoozeDuration };
