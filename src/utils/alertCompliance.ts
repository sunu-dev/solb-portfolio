// ==========================================
// ALERT COMPLIANCE — 자본시장법 회색지대 회피 정책
// ==========================================
//
// 정책 SSOT: docs/NOTIFICATION_POLICY.md §4
//
// 본 모듈은 알림 메시지·디테일에서 매수/매도 권유로 해석될 수 있는
// 어휘를 차단하고, 모든 사용자 노출 표면(AlertCard, Toast, Push)에
// 면책 문구를 강제 첨부하기 위한 단일 진실 원천이다.

/** 절대 금지 어휘 — validateAlertMessage()가 검출 시 violation 반환
 *
 * 분류:
 * - 매매 권유 직접 표현
 * - 수익 보장 표현
 * - "특정성"을 갖는 추천 표현 (자본시장법 회피 — 9인 패널 법무 의견)
 *   "당신에게 추천" 류는 개인 맞춤 자문으로 해석될 수 있어 위험
 */
export const FORBIDDEN_PHRASES: readonly string[] = [
  // 매매 권유 (기존)
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
  // 수익 보장 (기존)
  '확실한 수익',
  '수익 보장',
  '100% 보장',
  '반드시 오릅니다',
  '반드시 떨어집니다',
  // 개인 맞춤 추천 — 유사투자자문업 신호 (2026-05-15 추가, 법무 패널 의견)
  '당신에게 추천',
  '당신에게 맞춤',
  '맞춤 추천',
  '회원님께 추천',
  '회원님께 맞춤',
  '귀하에게 추천',
  '나에게 맞는 종목',
  // 단일종목 레버리지 권유 — 2026-05-27 KRX 상장 대응 (자본시장법 §57·금소법 광고규제)
  '레버리지 추천',
  '레버리지 매수',
  '인버스 추천',
  '인버스 매수',
  '곱버스 추천',
  '곱버스 진입',
  '2배 수익',
  '2배 레버리지 추천',
  '단일종목 2배 추천',
  // 연관 종목 도입 사전 준비 — 2026-05-28 8인 패널 법무 P0 (V1.2 알고리즘 도입 전 박제)
  // "인기 종목"·"같이 사는"·"함께 매수"는 군중 추종 유도 시그널 → 매수 권유로 해석 가능
  '인기 종목',
  '같이 사는',
  '함께 매수',
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

// ==========================================
// AI RESPONSE SANITIZER — Gemini/Claude 응답 후처리
// ==========================================
//
// 정책 SSOT: docs/ALGORITHM_REVIEW.md §4 (결정적 결함 #2 대응)
//
// AI 응답에 FORBIDDEN_PHRASES가 섞여 나올 수 있어, 응답을 사용자에게
// 노출하기 전 자동으로 안전한 표현으로 교체한다. ai-analysis 등
// AI 응답 라우트에서 사용.

/** 금지 어휘 → 안전 대체 표현 매핑 */
const SAFE_REPLACEMENTS: Record<string, string> = {
  '지금 사세요': '지금 관찰해보세요',
  '지금 매수': '지금 관찰',
  '지금 매도': '지금 점검',
  '매수하세요': '관찰해보세요',
  '매도하세요': '점검해보세요',
  '매수 추천': '관찰 후보',
  '매도 추천': '점검 후보',
  '추천 종목': '관찰 후보 종목',
  '매수 타이밍': '진입 시점 관찰',
  '매도 타이밍': '청산 시점 점검',
  '사야 한다': '관찰할 만하다',
  '팔아야 한다': '점검할 만하다',
  '사야합니다': '관찰해볼 수 있어요',
  '팔아야합니다': '점검해볼 수 있어요',
  '확실한 수익': '예상 수익',
  '수익 보장': '수익 가능성',
  '100% 보장': '높은 가능성',
  '반드시 오릅니다': '오를 가능성이 있어요',
  '반드시 떨어집니다': '떨어질 가능성이 있어요',
  // 단일종목 레버리지 권유 — 안전 대체
  '레버리지 추천': '레버리지는 단기 트레이딩 도구',
  '레버리지 매수': '레버리지는 단기 트레이딩 도구',
  '인버스 추천': '인버스는 헤지 도구',
  '인버스 매수': '인버스는 헤지 도구',
  '곱버스 추천': '곱버스는 단기 헤지 도구',
  '곱버스 진입': '곱버스는 단기 헤지 도구',
  '2배 수익': '2배 수익 가능성(2배 손실 가능성도 동일)',
  '2배 레버리지 추천': '2배 레버리지는 단기 트레이딩 도구',
  '단일종목 2배 추천': '단일종목 2배는 분석 대상 아님',
};

export interface SanitizeResult {
  text: string;
  replaced: string[];  // 교체된 어휘 목록 (audit용)
}

/**
 * AI 응답 텍스트의 금지 어휘를 안전한 표현으로 자동 교체.
 *
 * @param raw AI 원본 응답 (JSON 문자열 또는 일반 텍스트)
 * @returns 교체된 텍스트 + 교체 기록
 */
export function sanitizeAiOutput(raw: string): SanitizeResult {
  let text = raw;
  const replaced: string[] = [];

  for (const phrase of FORBIDDEN_PHRASES) {
    if (text.includes(phrase)) {
      const safe = SAFE_REPLACEMENTS[phrase] ?? phrase.replace(/매수|매도|사야|팔아야/g, '관찰');
      // 한국어 단어 경계 (공백·구두점) 고려 — String.prototype.replaceAll 전역
      text = text.split(phrase).join(safe);
      replaced.push(phrase);
    }
  }

  if (replaced.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[AI SANITIZE] ${replaced.length}개 금지 어휘 자동 교체:`,
      replaced.join(', '),
    );
  }

  return { text, replaced };
}

/**
 * AI 응답 JSON 객체의 모든 string 필드를 재귀적으로 sanitize.
 * 멘토 보고서(keyAdvice, mentorVerdict, conclusion.desc 등) 일괄 처리용.
 */
export function sanitizeAiObject<T>(obj: T): { result: T; replacedTotal: number } {
  let replacedTotal = 0;

  function walk(node: unknown): unknown {
    if (typeof node === 'string') {
      const { text, replaced } = sanitizeAiOutput(node);
      replacedTotal += replaced.length;
      return text;
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  }

  const result = walk(obj) as T;
  return { result, replacedTotal };
}
