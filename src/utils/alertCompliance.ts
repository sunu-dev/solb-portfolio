// ==========================================
// ALERT COMPLIANCE — 자본시장법 회색지대 회피 정책
// ==========================================
//
// 정책 SSOT: docs/NOTIFICATION_POLICY.md §4
//
// 본 모듈은 알림 메시지·디테일에서 매수/매도 권유로 해석될 수 있는
// 어휘를 차단하고, 모든 사용자 노출 표면(AlertCard, Toast, Push)에
// 면책 문구를 강제 첨부하기 위한 단일 진실 원천이다.

/** 절대 금지 어휘 — validateAlertMessage()가 검출 시 violation 반환 */
export const FORBIDDEN_PHRASES: readonly string[] = [
  '지금 사세요',
  '지금 매수',
  '지금 매도',
  '매수하세요',
  '매도하세요',
  '매수 추천',
  '매도 추천',
  '추천 종목',
  '매수 타이밍',
  '매도 타이밍',
  '사야 한다',
  '팔아야 한다',
  '사야합니다',
  '팔아야합니다',
  '확실한 수익',
  '수익 보장',
  '100% 보장',
  '반드시 오릅니다',
  '반드시 떨어집니다',
];

/** 사용자 노출 면책 문구 — AlertCard·Toast·Push 템플릿이 첨부 */
export const DISCLAIMER =
  '본 알림은 정보 제공 목적이며, 투자 결정과 그 결과는 투자자 본인의 판단과 책임입니다.';

/** 짧은 변형 — 푸시 body 등 공간 제약 시 */
export const DISCLAIMER_SHORT = '정보 제공용. 투자 판단은 본인 책임.';

export interface ComplianceViolation {
  phrase: string;
  field: 'message' | 'detail';
  context: string;
}

/**
 * 알림 메시지·디테일에 금지 어휘가 포함됐는지 검사.
 * dev에서는 console.warn, prod에서는 silent (메시지는 그대로 통과).
 * 빌드 타임 검사가 필요하면 `npm run lint:alerts` 같은 스크립트로 별도 추출.
 */
export function validateAlertMessage(
  message: string,
  detail: string,
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const phrase of FORBIDDEN_PHRASES) {
    if (message.includes(phrase)) {
      violations.push({ phrase, field: 'message', context: message });
    }
    if (detail.includes(phrase)) {
      violations.push({ phrase, field: 'detail', context: detail });
    }
  }

  if (violations.length > 0 && process.env.NODE_ENV !== 'production') {
    for (const v of violations) {
      console.warn(
        `[ALERT COMPLIANCE] 금지 어휘 검출: "${v.phrase}" in ${v.field} — "${v.context}"`,
      );
    }
  }

  return violations;
}
