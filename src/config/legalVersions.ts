// ==========================================
// LEGAL VERSIONS — 약관·개인정보·동의 버전 SSOT
// ==========================================
//
// 동의 증거 정합성: 사용자가 화면(/terms, /privacy)에서 본 문서 버전과
// user_consents DB에 기록되는 버전이 반드시 일치해야 한다.
// 자본시장법 면책(약관 제7조)의 증거력이 이 정합성에 의존하기 때문이다 —
// 손실 분쟁 시 "동의 기록 버전 ≠ 게시 약관 버전"은 면책 동의의 유효성을
// 다툴 빌미가 된다.
//
// 버전 개정 시 이 파일 한 곳만 수정하면 다음이 모두 동기화된다:
//   - /terms, /privacy 페이지 시행일·버전 표기
//   - LoginModal 동의 sessionStorage 기록값 (terms/privacy)
//   - useAuth user_consents DB INSERT 값 (terms/privacy/age_18_plus)
//
// 드리프트 사고 이력 (2026-05-29 수정): 약관 페이지는 v3로 개정됐으나
// LoginModal 동의 상수는 v2로 남아, 신규 가입자가 화면에서 v3에 동의해도
// DB에는 terms=v2로 기록되던 증거 결함. 이 SSOT 도입으로 근본 차단.

/** 이용약관 (/terms)
 *  v4 (2026-05-29): 단일종목 레버리지 '중간 옵션' 반영 — 신규 추천 제외 유지 +
 *  보유분 사후 위험 해설 허용 + 성인·위험 게이트. ⚠️ 변호사 정식 검토 후 배포할 것
 *  (의견서 §5). 텍스트와 버전은 항상 함께 이동 (동의 증거력 정합성).
 *  v5 (2026-07-27): Gemini API 제공 조건에 맞춰 서비스 이용 연령을 만 18세 이상으로 변경. */
export const TERMS_VERSION = 'v5';
export const TERMS_EFFECTIVE_DATE = '2026년 7월 27일';

/** 개인정보처리방침 (/privacy)
 *  v4 (2026-07-27): 무료 Gemini 운영에 맞춰 OCR을 비활성화하고,
 *  AI 외부 전송 범위를 공개 시장정보로 제한한 사실을 반영. */
export const PRIVACY_VERSION = 'v4';
export const PRIVACY_EFFECTIVE_DATE = '2026년 7월 27일';

/** 만 18세 게이트 동의 — Gemini API Client 연령 요건과 성인 금융정보 서비스 기준 */
export const AGE_GATE_VERSION = 'v2';

/** 세무 도구(해외주식 양도세 계산기) 약관·면책 버전 — 골격 예약.
 *  세무 기능은 '계산·정리 도구이며 세무대리·상담·자문 아님' 면책 4축(docs/TAX_PIVOT_MVP_SPEC §법무)을
 *  약관 v6에 포함하며, ⚠️ **세무사 calc 감수 + 변호사 카피·약관 검토 후 배포**(docs/legal-review/LEGAL_CONSULTATION_TAX.md).
 *  현재는 골격만 — 세무 calc/UI 미배선이라 사용자 동의 경로엔 아직 연결하지 않는다(드리프트 방지). */
export const TAX_TOOL_VERSION = 'v1-draft';
export const TAX_TOOL_EFFECTIVE_DATE = null; // 변호사 검토 후 배포 시점에 확정
